//+------------------------------------------------------------------+
//| EAE_WebSync.mqh                                                  |
//| EAEZE Universal Sync Module for MT5                              |
//|                                                                  |
//| Purpose: modular synchronization of EA data to web dashboard.    |
//| Features:                                                        |
//|  - Direct-to-Supabase RPC primary endpoint (Zero Vercel quota)   |
//|  - Automatic fallback to https://eaeze.com/api/sync-dashboard    |
//|  - 10-minute (600s) Standby Sleep Mode / 20s Live Viewer Mode    |
//|  - Full support for Farm UI, Prime Cockpit & 20-Pair Telemetry   |
//+------------------------------------------------------------------+
#ifndef __EAE_WEB_SYNC_MQH__
#define __EAE_WEB_SYNC_MQH__

#include <Trade/PositionInfo.mqh>
#include "EAE_MonitorTypes.mqh"
#ifdef ENABLE_EM_WEB_CONTROL
#include "EM_WebControl.mqh"
#endif

// --- Global Sync State ---
uint     g_eae_last_sync_ticks        = 0;
uint     g_eae_last_fallback_ticks    = 0;    // Strictly throttles 1-URL fallback (eaeze.com) to once every 10 minutes
int      g_eae_sync_interval          = 20;    // Live mode default: Sync every 20 seconds
int      g_eae_sleep_interval         = 600;   // Standby/Sleep mode default: 10 minutes (600s)
int      g_eae_active_sync_interval   = 0;     // Dynamic server override (0 = use mode default)
bool     g_eae_full_sync_mode         = false; // Default to standby after initial boot sync

// Primary Direct-to-Supabase RPC Endpoints + Automatic Vercel Fallback
string   g_eae_supabase_sync_url      = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data";
string   g_eae_supabase_history_url   = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_history_batch";
string   g_eae_fallback_url           = "https://eaeze.com/api/sync-dashboard";
string   g_eae_api_url                = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data";
bool     g_eae_using_fallback         = false;

// Internal System Key (Do not change)
string   g_eae_system_key     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo";

// Current active partner key for identification
string   g_eae_api_key        = "LICENSE_AUTO"; 

// --- Smart Sync State ---
string   g_eae_last_sync_hash = "";
string   g_eae_sync_status    = "IDLE"; // Shared status for UI: IDLE, SYNCING, OK, ERR
string   g_eae_sync_message   = "Connecting...";
uint     g_eae_last_heartbeat_ticks = 0;
const int g_eae_heartbeat_interval = 300; // Force full sync every 5 minutes when viewer is active
bool     g_eae_history_checked = false;
string   g_eae_license_tier   = "free";
bool     g_eae_is_trial       = false;

//+------------------------------------------------------------------+
//| Helper: Check if magic belongs to EasyM / Prime portfolio        |
//| Covers Regular (2000+), Hedge (3000+), and Rescue (4000+)        |
//+------------------------------------------------------------------+
bool EAE_IsPortfolioMagic(long magic, long baseMagic)
{
   if(baseMagic <= 0) return true;
   if(magic >= baseMagic && magic < baseMagic + 100) return true;           // Regular Grid (2001-2023)
   if(magic >= baseMagic + 1000 && magic < baseMagic + 1100) return true;   // Auto-Hedge (3001-3023)
   if(magic >= baseMagic + 2000 && magic < baseMagic + 2100) return true;   // Smart 3 Rescue (4001-4023)
   return false;
}

//+------------------------------------------------------------------+
//| Check if deal belongs to EasyM Portfolio (Magic + Comment check) |
//+------------------------------------------------------------------+
bool EAE_IsPortfolioDeal(ulong ticket, long baseMagic, datetime restoreStart = 0, datetime restoreEnd = 0)
{
   if(baseMagic <= 0) return true;
   long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
   if(EAE_IsPortfolioMagic(magic, baseMagic)) return true;

   string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
   if(StringFind(comment, "EMP:") >= 0 || StringFind(comment, "EasyM") >= 0 || StringFind(comment, "RescueCut") >= 0)
      return true;

   // Check if this deal closed a position originally opened by our EA (e.g. user closed by hand)
   long posId = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
   if(posId > 0)
   {
      // 1. Fast check if the opening order is in active order cache
      if(HistoryOrderSelect((ulong)posId))
      {
         long openMagic = HistoryOrderGetInteger((ulong)posId, ORDER_MAGIC);
         if(EAE_IsPortfolioMagic(openMagic, baseMagic)) return true;

         string openComment = HistoryOrderGetString((ulong)posId, ORDER_COMMENT);
         if(StringFind(openComment, "EMP:") >= 0 || StringFind(openComment, "EasyM") >= 0 || StringFind(openComment, "RescueCut") >= 0)
            return true;
      }

      // 2. Position ID Backtracking: Query full broker position history across all dates
      if(HistorySelectByPosition((ulong)posId))
      {
         bool is_ea_origin = false;
         int pDeals = HistoryDealsTotal();
         for(int pd = 0; pd < pDeals; pd++)
         {
            ulong pTicket = HistoryDealGetTicket(pd);
            if(pTicket > 0 && HistoryDealGetInteger(pTicket, DEAL_ENTRY) == DEAL_ENTRY_IN)
            {
               long pMagic = HistoryDealGetInteger(pTicket, DEAL_MAGIC);
               if(EAE_IsPortfolioMagic(pMagic, baseMagic))
               {
                  is_ea_origin = true;
                  break;
               }
               string pComm = HistoryDealGetString(pTicket, DEAL_COMMENT);
               if(StringFind(pComm, "EMP:") >= 0 || StringFind(pComm, "EasyM") >= 0 || StringFind(pComm, "RescueCut") >= 0)
               {
                  is_ea_origin = true;
                  break;
               }
            }
         }

         // Restore original history range
         if(restoreStart > 0 && restoreEnd > 0)
         {
            HistorySelect(restoreStart, restoreEnd);
         }

         if(is_ea_origin) return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Helper: Escape raw JSON string for embedding inside JSON string  |
//+------------------------------------------------------------------+
string EAE_EscapeJsonString(string raw)
{
   string out = raw;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   return out;
}

//+------------------------------------------------------------------+
//| Initialize the WebSync module with custom settings               |
//+------------------------------------------------------------------+
void EAE_WebSyncInit(string api_url, int interval_sec)
{
   g_eae_api_url              = api_url;
   g_eae_api_key              = "LICENSE_AUTO"; // Auto-license mapping based on account number
   g_eae_sync_interval        = (interval_sec < 5 ? 5 : interval_sec); // Min 5s
   g_eae_last_sync_ticks      = 0;
   g_eae_last_fallback_ticks  = 0;
   g_eae_last_heartbeat_ticks = 0;
   g_eae_last_sync_hash       = "";
   g_eae_history_checked      = false;
   g_eae_using_fallback       = false;
   Print("EAE WebSync: Initialized (Direct-to-Supabase RPC + Auto-Fallback mode).");
}

//+------------------------------------------------------------------+
//| Initialize the WebSync module with custom settings (overload)    |
//+------------------------------------------------------------------+
void EAE_WebSyncInit(string api_url, string api_key, int interval_sec)
{
   g_eae_api_url              = api_url;
   g_eae_api_key              = api_key;
   g_eae_sync_interval        = (interval_sec < 5 ? 5 : interval_sec); // Min 5s
   g_eae_last_sync_ticks      = 0;
   g_eae_last_fallback_ticks  = 0;
   g_eae_last_heartbeat_ticks = 0;
   g_eae_last_sync_hash       = "";
   g_eae_history_checked      = false;
   g_eae_using_fallback       = false;
   Print("EAE WebSync: Initialized (Custom API key mode: " + api_key + ").");
}

//+------------------------------------------------------------------+
//| Internal helper to build an Order JSON list for the Farm UI      |
//+------------------------------------------------------------------+
string EAE_BuildOrdersJson(long magicB = 0, long magicS = 0)
{
   string json = "[";
   bool first = true;
   int total = PositionsTotal();
   
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long type = PositionGetInteger(POSITION_TYPE);
         long magic = PositionGetInteger(POSITION_MAGIC);
         
         if(magicB == magicS) {
            if(!EAE_IsPortfolioMagic(magic, magicB)) continue;
         }
         else {
            if(type == POSITION_TYPE_BUY) {
               if(magicB != 0 && magic != magicB) continue;
            }
            else if(type == POSITION_TYPE_SELL) {
               if(magicS != 0 && magic != magicS) continue;
            }
         }
         
         if(!first) json += ",";
         
         string pos_type = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
         string sym_str  = PositionGetString(POSITION_SYMBOL);
         int    sym_dig  = (int)SymbolInfoInteger(sym_str, SYMBOL_DIGITS);
         if(sym_dig <= 0) sym_dig = 5;
         double net_pnl  = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
         
         json += "{";
         json += "\"ticket_id\":" + IntegerToString(ticket) + ",";
         json += "\"symbol\":\"" + sym_str + "\",";
         json += "\"type\":\"" + pos_type + "\",";
         json += "\"status\":\"OPEN\",";
         json += "\"magic\":" + IntegerToString(magic) + ",";
         json += "\"open_price\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), sym_dig) + ",";
         json += "\"current_pnl\":" + DoubleToString(net_pnl, 2) + ",";
         json += "\"raw_lot_size\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2);
         json += "}";
         
         first = false;
      }
   }
   
   json += "]";
   return json;
}

//+------------------------------------------------------------------+
//| Update and Get Daily Max Drawdown (PERCENTAGE)                   |
//| Persists peak DD% in a Global Variable until midnight reset      |
//+------------------------------------------------------------------+
double EAE_GetDailyMaxDrawdownPct()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(balance <= 0) return 0.0;
   
   double current_pnl = equity - balance;
   double current_dd_pct = (current_pnl < 0 ? MathAbs(current_pnl) / balance * 100.0 : 0.0);
   
   string gv_max_dd_name = "EAE_MaxDDPct_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string gv_date_name   = "EAE_LastDateVal_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   
   datetime today_start = (TimeCurrent() / 86400) * 86400;
   
   // Reset if new day
   if(!GlobalVariableCheck(gv_date_name) || GlobalVariableGet(gv_date_name) != (double)today_start)
   {
      GlobalVariableSet(gv_max_dd_name, current_dd_pct);
      GlobalVariableSet(gv_date_name, (double)today_start);
   }
   
   double max_dd_pct = GlobalVariableGet(gv_max_dd_name);
   if(current_dd_pct > max_dd_pct) {
      max_dd_pct = current_dd_pct;
      GlobalVariableSet(gv_max_dd_name, max_dd_pct);
   }
   
   return max_dd_pct;
}

//+------------------------------------------------------------------+
//| Scan MT5 History for a summary of a specific day                 |
//+------------------------------------------------------------------+
bool EAE_ScanHistoryDailySummary(datetime targetDay, long magicB, long magicS, EAE_DailySummary &out_sum)
{
   MqlDateTime dt; TimeToStruct(targetDay, dt); dt.hour=0; dt.min=0; dt.sec=0;
   datetime start = StructToTime(dt);
   datetime end   = targetDay;
   
   ZeroMemory(out_sum);
   out_sum.date          = start;
   out_sum.account_login = AccountInfoInteger(ACCOUNT_LOGIN);
   
   if(!HistorySelect(start, end)) return false;
   
   int total = HistoryDealsTotal();
   ulong dealTickets[];
   ArrayResize(dealTickets, total);
   for(int k = 0; k < total; k++)
      dealTickets[k] = HistoryDealGetTicket(k);

   for(int i = 0; i < total; i++)
   {
      ulong ticket = dealTickets[i];
      if(ticket <= 0) continue;
      HistoryDealSelect(ticket);
      
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
      {
         long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
         long deal_type = HistoryDealGetInteger(ticket, DEAL_TYPE);
         bool is_buy_side = (deal_type == DEAL_TYPE_SELL);
         bool is_sell_side = (deal_type == DEAL_TYPE_BUY);
         
         // Filter closed deals strictly by EA Magic Number (Portfolio 2000+/3000+/4000+ or Directional magicB/magicS)
         if(magicB == magicS && magicB > 0) {
            if(!EAE_IsPortfolioDeal(ticket, magicB, start, end)) continue;
         }
         else if(magicB != magicS && magicB != 0) {
            if(is_buy_side && magic != magicB) continue;
            if(is_sell_side && magicS != 0 && magic != magicS) continue;
         }
         
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
         out_sum.total_lots   += HistoryDealGetDouble(ticket, DEAL_VOLUME);
         
         string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
         if(StringFind(comment, "CLOSE") >= 0 || StringFind(comment, "LOK") >= 0 || StringFind(comment, "BRK") >= 0)
         {
            if(magicB == magicS) {
               if(EAE_IsPortfolioMagic(magic, magicB)) {
                  out_sum.buy_cycles++;
               }
            }
            else {
               if(magic == magicB) out_sum.buy_cycles++;
               else if(magic == magicS) out_sum.sell_cycles++;
            }
         }
      }
   }
   
   // Daily Max DD is retrieved from persistence
   out_sum.max_dd_pct = EAE_GetDailyMaxDrawdownPct();
   
   return true;
}

//+------------------------------------------------------------------+
//| Push a Daily Performance Summary to the Cloud (UPSERT mode)      |
//+------------------------------------------------------------------+
void EAE_WebSyncPushDailySummary(const EAE_DailySummary &sum)
{
   string json = "{ \"p_payload\": {";
   json += "\"type\":\"DAILY_SUMMARY\",";
   json += "\"port_number\":\"" + IntegerToString(sum.account_login) + "\",";
   json += "\"date\":\"" + TimeToString(sum.date, TIME_DATE) + "\",";
   json += "\"profit\":" + DoubleToString(sum.total_profit, 2) + ",";
   json += "\"lots\":" + DoubleToString(sum.total_lots, 2) + ",";
   json += "\"max_dd_pct\":" + DoubleToString(sum.max_dd_pct, 2) + ",";
   json += "\"buy_cycles\":" + IntegerToString(sum.buy_cycles) + ",";
   json += "\"sell_cycles\":" + IntegerToString(sum.sell_cycles);
   json += "}, \"p_api_key\":\"" + g_eae_api_key + "\" }";

   char data[]; char result[]; string result_headers;
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
   
   Print("EAE: Sending Daily Summary for ", TimeToString(sum.date, TIME_DATE));
   string target_url = (g_eae_using_fallback ? g_eae_fallback_url : g_eae_supabase_sync_url);
   int res = WebRequest("POST", target_url, headers, 5000, data, result, result_headers);
   if(res != 200 && !g_eae_using_fallback) {
      WebRequest("POST", g_eae_fallback_url, headers, 5000, data, result, result_headers);
   }
}

//+------------------------------------------------------------------+
//| Calculate a unique hash for the current state to detect changes  |
//+------------------------------------------------------------------+
string EAE_CalculateDataHash(const EAE_RealtimeSnapshot &snap)
{
   return StringFormat("%d|%.2f|%.2f|%.2f|%d|%.2f|%d|%.2f",
      AccountInfoInteger(ACCOUNT_LOGIN),
      snap.account.balance,
      snap.account.equity,
      snap.buy_state.floating_pnl,
      snap.buy_state.open_count,
      snap.sell_state.floating_pnl,
      snap.sell_state.open_count,
      PositionsTotal());
}

//+------------------------------------------------------------------+
//| Send a full modular snapshot to Supabase RPC (with Fallback)     |
//+------------------------------------------------------------------+
bool EAE_WebSyncPerform(EAE_RealtimeSnapshot &snap, bool force_now = false, string extra_payload_json = "")
{
   datetime now = TimeCurrent();
   datetime today_start = (now / 86400) * 86400;
   uint now_ticks = GetTickCount();
   string current_hash = "";
   
   // 1. Throttling / Sleep-Wake Check
   // On initial boot (g_eae_last_sync_ticks == 0), sync immediately so dashboard has instant data!
   bool is_initial_sync = (g_eae_last_sync_ticks == 0);
   bool is_dev_port = (AccountInfoInteger(ACCOUNT_LOGIN) == 97053088);
   if(g_eae_last_sync_ticks > 0)
   {
      int current_interval = g_eae_sync_interval;
      if(g_eae_using_fallback && !is_dev_port) {
         // 1-URL Fallback Mode: Strictly locked to 10-minute (600s) summary sync only (zero 10s/20s polling overhead on VPS)
         current_interval = g_eae_sleep_interval;
      } else if(g_eae_full_sync_mode) {
         if(g_eae_active_sync_interval > 0 && g_eae_active_sync_interval <= 60) {
            current_interval = g_eae_active_sync_interval;
         } else {
            current_interval = 20; // Live Viewer Mode: every 20 seconds
         }
      } else {
         if(g_eae_active_sync_interval >= 180) {
            current_interval = g_eae_active_sync_interval;
         } else {
            current_interval = g_eae_sleep_interval; // Standby Mode: every 10 minutes (600s)
         }
      }
      
      if(!force_now && (int)(now_ticks - g_eae_last_sync_ticks) < current_interval * 1000) {
         return true; 
      }
   }
   
   g_eae_last_sync_ticks = now_ticks;
   
   // 2. Build Primary Payload (2-URL Direct Supabase RPC)
   // Include open orders on initial sync and when recovering from fallback so Live Farm populates immediately
   bool skip_orders = (g_eae_license_tier == "free" && !g_eae_is_trial);
   string orders_json = ((g_eae_full_sync_mode || g_eae_using_fallback || is_initial_sync) && !skip_orders ? EAE_BuildOrdersJson(snap.identity.magic_buy, snap.identity.magic_sell) : "[]");
   
   // Daily stats
   EAE_DailySummary today;
   EAE_ScanHistoryDailySummary(now, snap.identity.magic_buy, snap.identity.magic_sell, today);

   // Hash Check for Throttling (only applies to regular customer ports in live full sync mode on 2-URL; dev port 97053088 is never throttled)
   if(!is_dev_port && g_eae_full_sync_mode && !g_eae_using_fallback && !is_initial_sync)
   {
      current_hash = IntegerToString(snap.buy_state.open_count) + "_" + IntegerToString(snap.sell_state.open_count) + "_" + DoubleToString(snap.account.equity, 2) + "_" + DoubleToString(today.total_profit, 2);
      if(!force_now && current_hash == g_eae_last_sync_hash && (int)(now_ticks - g_eae_last_heartbeat_ticks) < g_eae_heartbeat_interval * 1000)
      {
         return true; // Skip redundant upload if nothing changed
      }
   }

   g_eae_last_heartbeat_ticks = now_ticks;
   
   // Embed prime_data into system_code (EasyM Prime:::<escaped_json>) so Direct Supabase RPC
   // stores prime_data into farm_port_status.system_code natively without needing extra DB columns
   string base_sys_code = snap.identity.system_code;
   string sys_code_encoded = base_sys_code;
   if(StringLen(extra_payload_json) > 0)
   {
      sys_code_encoded = base_sys_code + ":::" + EAE_EscapeJsonString(extra_payload_json);
   }

   string payload = "{ \"p_payload\": {";
   payload += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   payload += "\"server_time\":" + IntegerToString(now) + ",";
   payload += "\"current_price\":" + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits) + ",";
   payload += "\"ping_only\":false,";
   payload += "\"today_profit\":" + DoubleToString(today.total_profit, 2) + ",";
   payload += "\"today_closed_lots\":" + DoubleToString(today.total_lots, 2) + ",";
   payload += "\"daily_max_drawdown\":" + DoubleToString(today.max_dd_pct, 2) + ",";
   
   // Snapshot
   payload += "\"snapshot\":{";
   payload += "\"account\":{\"balance\":" + DoubleToString(snap.account.balance, 2) + ",\"equity\":" + DoubleToString(snap.account.equity, 2) + ",\"margin_level\":" + DoubleToString(snap.account.margin_level, 2) + ",\"currency\":\"" + snap.account.currency + "\"},";
   payload += "\"buy_state\":{\"open_count\":" + IntegerToString(snap.buy_state.open_count) + ",\"open_lots\":" + DoubleToString(snap.buy_state.open_lots, 2) + ",\"floating_pnl\":" + DoubleToString(snap.buy_state.floating_pnl, 2) + "},";
   payload += "\"sell_state\":{\"open_count\":" + IntegerToString(snap.sell_state.open_count) + ",\"open_lots\":" + DoubleToString(snap.sell_state.open_lots, 2) + ",\"floating_pnl\":" + DoubleToString(snap.sell_state.floating_pnl, 2) + "},";
   payload += "\"identity\":{\"product_family\":\"" + snap.identity.product_family + "\",\"system_code\":\"" + sys_code_encoded + "\",\"ea_version\":\"" + snap.identity.ea_version + "\"}";
   payload += "},";
   
   payload += "\"orders\":" + orders_json;
   if(StringLen(extra_payload_json) > 0)
   {
      payload += ",\"prime_data\":" + extra_payload_json;
   }
   payload += "}, \"p_api_key\":\"" + g_eae_api_key + "\" }";
   
   // Check Daily Summary Rollover
   string gv_last_sync_date = "EAE_LastSyncDate_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   if(GlobalVariableCheck(gv_last_sync_date))
   {
      datetime last_date = (datetime)GlobalVariableGet(gv_last_sync_date);
      if(last_date < today_start)
      {
         datetime scan_day = today_start - 86400; // Yesterday
         EAE_DailySummary sum;
         if(EAE_ScanHistoryDailySummary(scan_day, snap.identity.magic_buy, snap.identity.magic_sell, sum))
         {
            Print("EAE WebSync: Uploading Daily Summary for ", TimeToString(scan_day, TIME_DATE), " PnL: ", sum.total_profit);
            EAE_WebSyncPushDailySummary(sum);
         }
         GlobalVariableSet(gv_last_sync_date, (double)today_start);
      }
   }
   else
   {
      GlobalVariableSet(gv_last_sync_date, (double)today_start);
   }

   // 3. Dispatch WebRequest (Always try Primary 2-URL Direct Supabase RPC first; if not whitelisted, fallback to 1-URL 10m summary mode)
   char data[]; char result[]; string result_headers;
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
   
   ResetLastError();
   int res = WebRequest("POST", g_eae_supabase_sync_url, headers, 10000, data, result, result_headers);

   if(res == 200)
   {
      if(g_eae_using_fallback)
      {
         Print("EAE WebSync: Direct Supabase URL #2 is now connected! Restoring full live Farm telemetry.");
         g_eae_last_sync_hash = "";
      }
      g_eae_using_fallback = false;
   }
   else
   {
      int primary_err = GetLastError();
      if(!is_dev_port)
      {
         if(!g_eae_using_fallback)
         {
            g_eae_using_fallback = true;
            if(res == -1 && (primary_err == 4060 || primary_err == 4014))
            {
               Print("EAE WebSync: URL #2 (https://mfrspvzxmpksqnzcrysz.supabase.co) is not whitelisted in MT5. Switching to 10-Minute Standby Fallback via https://eaeze.com (Live Farm disabled until URL #2 is added).");
            }
         }

         // Strictly throttle URL #1 Fallback (eaeze.com) to once every 10 minutes (600s)
         if(!force_now && g_eae_last_fallback_ticks > 0 && (int)(now_ticks - g_eae_last_fallback_ticks) < g_eae_sleep_interval * 1000)
         {
            return true;
         }
         g_eae_last_fallback_ticks = now_ticks;

         // Build stripped 10-minute summary payload for 1-URL Fallback (no live orders, no live pair details, tagged FALLBACK_1URL)
         string fb_meta = "{\"sync_mode\":\"FALLBACK_1URL\"}";
         string fb_sys_code = base_sys_code + ":::" + EAE_EscapeJsonString(fb_meta);
         string fb_payload = "{ \"p_payload\": {";
         fb_payload += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
         fb_payload += "\"server_time\":" + IntegerToString(now) + ",";
         fb_payload += "\"current_price\":0,";
         fb_payload += "\"ping_only\":false,";
         fb_payload += "\"sync_mode\":\"FALLBACK_1URL\",";
         fb_payload += "\"today_profit\":" + DoubleToString(today.total_profit, 2) + ",";
         fb_payload += "\"today_closed_lots\":" + DoubleToString(today.total_lots, 2) + ",";
         fb_payload += "\"daily_max_drawdown\":" + DoubleToString(today.max_dd_pct, 2) + ",";
         fb_payload += "\"snapshot\":{";
         fb_payload += "\"account\":{\"balance\":" + DoubleToString(snap.account.balance, 2) + ",\"equity\":" + DoubleToString(snap.account.equity, 2) + ",\"margin_level\":" + DoubleToString(snap.account.margin_level, 2) + ",\"currency\":\"" + snap.account.currency + "\"},";
         fb_payload += "\"buy_state\":{\"open_count\":" + IntegerToString(snap.buy_state.open_count) + ",\"open_lots\":" + DoubleToString(snap.buy_state.open_lots, 2) + ",\"floating_pnl\":" + DoubleToString(snap.buy_state.floating_pnl, 2) + "},";
         fb_payload += "\"sell_state\":{\"open_count\":" + IntegerToString(snap.sell_state.open_count) + ",\"open_lots\":" + DoubleToString(snap.sell_state.open_lots, 2) + ",\"floating_pnl\":" + DoubleToString(snap.sell_state.floating_pnl, 2) + "},";
         fb_payload += "\"identity\":{\"product_family\":\"" + snap.identity.product_family + "\",\"system_code\":\"" + fb_sys_code + "\",\"ea_version\":\"" + snap.identity.ea_version + "\"}";
         fb_payload += "},";
         fb_payload += "\"orders\":[],";
         fb_payload += "\"prime_data\":" + fb_meta;
         fb_payload += "}, \"p_api_key\":\"" + g_eae_api_key + "\" }";

         char fb_data[];
         StringToCharArray(fb_payload, fb_data, 0, WHOLE_ARRAY, CP_UTF8);
         ArrayResize(fb_data, ArraySize(fb_data) - 1);

         ResetLastError();
         res = WebRequest("POST", g_eae_fallback_url, headers, 10000, fb_data, result, result_headers);
      }
      else
      {
         // Dev port 97053088 is connected directly to eaeze.com; retry on next 5s tick without entering 600s sleep
         PrintFormat("EAE WebSync: [DEV PORT 97053088] WebRequest HTTP %d (Err %d) - Retrying on next tick", res, primary_err);
      }
   }

   if(res == -1) {
      int err = GetLastError();
      g_eae_sync_status = "ERR: CONN";
      g_eae_sync_message = "Connection Failed (" + IntegerToString(err) + ")";
      
      if(err == 4060 || err == 4014) {
         static bool printed_sync_warning = false;
         if(!printed_sync_warning) {
            Print("[EAE_SYSTEM WARNING] WebRequest is not whitelisted. Please add 'https://eaeze.com' and 'https://mfrspvzxmpksqnzcrysz.supabase.co' to MT5 WebRequest options.");
            printed_sync_warning = true;
         }
      } else {
         Print("EAE Sync Error (WebRequest failed): ", err);
      }
      return false;
   }
   
   if(res != 200) {
      if(res == 1003) {
         g_eae_sync_status = "RETRYING";
         g_eae_sync_message = "Network Timeout (Auto-recovering)";
         return false;
      }
      g_eae_sync_status = "ERR: " + IntegerToString(res);
      string err_resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      g_eae_sync_message = "HTTP " + IntegerToString(res);
      Print("EAE Sync Server Error (", res, "): ", err_resp);
      return false;
   }
   
   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(StringFind(response, "\"success\":false") >= 0 || StringFind(response, "\"success\": false") >= 0) {
      g_eae_sync_status = "UNAUTHORIZED";
      int msg_pos = StringFind(response, "\"message\":\"");
      if(msg_pos >= 0) {
         int msg_end = StringFind(response, "\"", msg_pos + 11);
         if(msg_end >= 0) g_eae_sync_message = StringSubstr(response, msg_pos + 11, msg_end - (msg_pos + 11));
      } else {
         g_eae_sync_message = "Invalid API Key / No Active License";
      }
      Print("EAE WebSync: Failed Auth: ", g_eae_sync_message);
      return false;
   }
   
   // Update last hash on successful sync
   g_eae_last_sync_hash = current_hash;
   g_eae_sync_status = (g_eae_using_fallback ? "OK (10m FALLBACK)" : "OK (ONLINE)");
   g_eae_sync_message = (g_eae_using_fallback ? "1-URL Mode (Add URL #2 for Live Farm)" : "Connected to Farm 2.5D");
   
   // Update Last Online Time for Self-Healing
   string gv_last_online = "EAE_LastOnline_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   GlobalVariableSet(gv_last_online, (double)now);
   
   // 4. Parse response for on-demand viewer control
   // CRITICAL: If using 1-URL fallback (g_eae_using_fallback), NEVER allow live 20s full_sync_mode!
   if(g_eae_using_fallback)
   {
      g_eae_full_sync_mode = false;
      g_eae_active_sync_interval = g_eae_sleep_interval; // Locked to 600s (10 minutes)
   }
   else
   {
      bool viewer_active = false;
      if(StringFind(response, "\"viewer_active\":true") >= 0 || StringFind(response, "\"viewer_active\": true") >= 0) {
         viewer_active = true;
      } else if(StringFind(response, "\"viewer_active\":false") >= 0 || StringFind(response, "\"viewer_active\": false") >= 0) {
         viewer_active = false;
      } else if(StringFind(response, "\"should_sync_full\":true") >= 0 || StringFind(response, "\"should_sync_full\": true") >= 0) {
         viewer_active = true;
      }

      if(viewer_active) {
         if(!g_eae_full_sync_mode) {
            g_eae_last_sync_ticks = 0; // Trigger instant full sync with orders on next timer tick!
            g_eae_last_sync_hash = "";
            g_eae_last_heartbeat_ticks = 0;
            Print("EAE WebSync: >> FARM VIEWER ACTIVE << (Viewer online - Syncing live data every 20s)");
         }
         g_eae_full_sync_mode = true;
      } else {
         if(g_eae_full_sync_mode) {
            Print("EAE WebSync: >> STANDBY MODE << (Farm viewer closed - Low resource mode, syncing every 10m)");
         }
         g_eae_full_sync_mode = false;
      }
      
      // Dynamic sync interval parsing
      int pos = StringFind(response, "\"sync_interval\":");
      if(pos >= 0) {
         int start = pos + StringLen("\"sync_interval\":");
         int end = start;
         while(end < StringLen(response) && (response[end] == ' ' || response[end] == ':')) {
            end++;
         }
         start = end;
         while(end < StringLen(response) && response[end] >= '0' && response[end] <= '9') {
            end++;
         }
         if(end > start) {
            int parsed_interval = (int)StringToInteger(StringSubstr(response, start, end - start));
            if(viewer_active) {
               g_eae_active_sync_interval = (parsed_interval > 0 && parsed_interval <= 60) ? parsed_interval : 20;
            } else {
               // In standby mode, enforce at least 10m (600s) unless server sends an even longer interval
               g_eae_active_sync_interval = (parsed_interval >= 600 ? parsed_interval : g_eae_sleep_interval);
            }
         }
      }
   }

   // License tier parsing
   int tier_pos = StringFind(response, "\"license_tier\":");
   if(tier_pos >= 0) {
      int start = tier_pos + StringLen("\"license_tier\":");
      int end = start;
      while(end < StringLen(response) && response[end] != '"') {
         end++;
      }
      if(end < StringLen(response)) {
         end++;
         start = end;
         while(end < StringLen(response) && response[end] != '"') {
            end++;
         }
         if(end > start) {
            g_eae_license_tier = StringSubstr(response, start, end - start);
         }
      }
   }

   // Is trial parsing
   int trial_pos = StringFind(response, "\"is_trial\":");
   if(trial_pos >= 0) {
      int start = trial_pos + StringLen("\"is_trial\":");
      int end = start;
      while(end < StringLen(response) && response[end] != 't' && response[end] != 'f' && response[end] != 'T' && response[end] != 'F') {
         end++;
      }
      start = end;
      while(end < StringLen(response) && ((response[end] >= 'a' && response[end] <= 'z') || (response[end] >= 'A' && response[end] <= 'Z'))) {
         end++;
      }
      if(end > start) {
         string trial_val = StringSubstr(response, start, end - start);
         g_eae_is_trial = (trial_val == "true" || trial_val == "TRUE");
      }
   }
   
   // 5. Parse 2-Way Web Command & Control Config (Active when ENABLE_EM_WEB_CONTROL is defined)
#ifdef ENABLE_EM_WEB_CONTROL
   WebControlParseAndApplyResponse(response);
#endif

   return true;
}

//+------------------------------------------------------------------+
//| Push a Batch of Daily Histories to Supabase (with Auto-Fallback) |
//+------------------------------------------------------------------+
bool EAE_WebSyncPushHistoryBatch(int days_to_sync, long magicB, long magicS)
{
   if(days_to_sync <= 0) return false;
   if(days_to_sync > 30) days_to_sync = 30;
   
   datetime now = TimeCurrent();
   datetime today_start = (now / 86400) * 86400;
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   
   // Pre-allocate daily summary array
   EAE_DailySummary summaries[];
   ArrayResize(summaries, days_to_sync);
   for(int i = 0; i < days_to_sync; i++)
   {
      ZeroMemory(summaries[i]);
      summaries[i].date          = today_start - (i * 86400);
      summaries[i].account_login = login;
      if(i == 0)
      {
         summaries[i].max_dd_pct = EAE_GetDailyMaxDrawdownPct();
      }
      else
      {
         summaries[i].max_dd_pct = 0.0;
      }
   }
   
   // Select history once for the entire range
   datetime start_time = today_start - (days_to_sync * 86400);
   if(HistorySelect(start_time, now))
   {
      int total = HistoryDealsTotal();
      ulong dealTickets[];
      ArrayResize(dealTickets, total);
      for(int k = 0; k < total; k++)
         dealTickets[k] = HistoryDealGetTicket(k);

      for(int i = 0; i < total; i++)
      {
         ulong ticket = dealTickets[i];
         if(ticket <= 0) continue;
         HistoryDealSelect(ticket);
         
         long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
         {
            datetime deal_time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
            datetime deal_day_start = (deal_time / 86400) * 86400;
            long diff_sec = today_start - deal_day_start;
            if(diff_sec < 0) continue;
            
            int idx = (int)(diff_sec / 86400);
            if(idx < 0 || idx >= days_to_sync) continue;
            
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            long deal_type = HistoryDealGetInteger(ticket, DEAL_TYPE);
            bool is_buy_side = (deal_type == DEAL_TYPE_SELL);
            bool is_sell_side = (deal_type == DEAL_TYPE_BUY);
            
            if(magicB == magicS && magicB > 0) {
               if(!EAE_IsPortfolioDeal(ticket, magicB, start_time, now)) continue;
            }
            else if(magicB != magicS && magicB != 0) {
               if(is_buy_side && magic != magicB) continue;
               if(is_sell_side && magicS != 0 && magic != magicS) continue;
            }
            
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
            summaries[idx].total_lots   += HistoryDealGetDouble(ticket, DEAL_VOLUME);
            
            string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
            if(StringFind(comment, "CLOSE") >= 0 || StringFind(comment, "LOK") >= 0 || StringFind(comment, "BRK") >= 0)
            {
               if(magicB == magicS) {
                  if(EAE_IsPortfolioMagic(magic, magicB)) {
                     summaries[idx].buy_cycles++;
                  }
               }
               else {
                  if(magic == magicB) summaries[idx].buy_cycles++;
                  else if(magic == magicS) summaries[idx].sell_cycles++;
               }
            }
         }
      }
   }
   else
   {
      Print("EAE WebSync: HistorySelect failed for range from ", TimeToString(start_time), " to ", TimeToString(now));
   }
   
   string json_array = "[";
   for(int i = 0; i < days_to_sync; i++)
   {
      if(i > 0) json_array += ",";
      
      string date_str = TimeToString(summaries[i].date, TIME_DATE);
      StringReplace(date_str, ".", "-"); // Convert YYYY.MM.DD to YYYY-MM-DD
      
      json_array += "{";
      json_array += "\"date\":\"" + date_str + "\",";
      json_array += "\"profit\":" + DoubleToString(summaries[i].total_profit, 2) + ",";
      json_array += "\"lots\":" + DoubleToString(summaries[i].total_lots, 2) + ",";
      json_array += "\"max_dd\":" + DoubleToString(summaries[i].max_dd_pct, 2);
      json_array += "}";
   }
   json_array += "]";
   
   string payload = "{";
   payload += "\"p_port_number\":\"" + IntegerToString(login) + "\",";
   payload += "\"p_history_array\":" + json_array + ",";
   payload += "\"p_api_key\":\"" + g_eae_api_key + "\"";
   payload += "}";

   char data[]; char result[]; string result_headers;
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   
   string headers = "Content-Type: application/json\r\n" +
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
                    
   string target_url = (g_eae_using_fallback ? g_eae_fallback_url : g_eae_supabase_history_url);
   ResetLastError();
   int res = WebRequest("POST", target_url, headers, 10000, data, result, result_headers);
   if((res == -1 || res != 200) && !g_eae_using_fallback)
   {
      int primary_err = GetLastError();
      if(AccountInfoInteger(ACCOUNT_LOGIN) != 97053088 && res == -1 && (primary_err == 4060 || primary_err == 4014))
      {
         g_eae_using_fallback = true;
      }
      ResetLastError();
      res = WebRequest("POST", g_eae_fallback_url, headers, 10000, data, result, result_headers);
   }

   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   
   if(res == 200 && StringFind(response, "\"success\":false") < 0 && StringFind(response, "\"success\": false") < 0) {
      Print("EAE WebSync: Successfully pushed " + IntegerToString(days_to_sync) + " days of history. Resp: " + response);
      return true;
   } else {
      Print("EAE WebSync: Failed to push history batch. Res: ", res, " Resp: ", response);
      return false;
   }
}

//+------------------------------------------------------------------+
//| [2026-08-20] Self-Healing Boot & Day-Change Rollover Sync        |
//| Staggered execution prevents cloud server request spikes.        |
//+------------------------------------------------------------------+
void EAE_WebSyncCheckAndPushHistory(long magicB, long magicS)
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   datetime now = TimeCurrent();
   datetime current_day = (now / 86400) * 86400;

   static datetime last_synced_day = 0;
   static datetime scheduled_sync_time = 0;
   static bool boot_scheduled = false;

   // 1. Initial Boot Check / Timeframe Refresh: Sync immediately in 2s
   if(!boot_scheduled)
   {
      boot_scheduled = true;
      scheduled_sync_time = now + 2;
      Print("EAE WebSync: Boot/Refresh detected. Immediate 14-day history sync scheduled in 2s.");
   }

   // 2. Day-Change Rollover Detection: When server time crosses into new day
   if(last_synced_day == 0)
   {
      string gv_last_history = "EAE_LastHistorySync_" + IntegerToString(login);
      if(GlobalVariableCheck(gv_last_history))
      {
         datetime saved_time = (datetime)GlobalVariableGet(gv_last_history);
         last_synced_day = (saved_time / 86400) * 86400;
      }
   }

   if(current_day > last_synced_day && scheduled_sync_time <= now)
   {
      MathSrand((uint)GetTickCount() + (uint)login);
      int day_delay = (int)(login % 180) + (MathRand() % 120);
      scheduled_sync_time = current_day + day_delay;
      last_synced_day = current_day;
      Print("EAE WebSync: Day rollover detected. Next history sync scheduled in ", (scheduled_sync_time - now), "s.");
   }

   // 3. Check if scheduled time has arrived
   if(scheduled_sync_time == 0 || now < scheduled_sync_time) return;

   scheduled_sync_time = 0;

   int days_to_sync = 14;
   string gv_last_history = "EAE_LastHistorySync_" + IntegerToString(login);
   if(GlobalVariableCheck(gv_last_history))
   {
      datetime last_sync = (datetime)GlobalVariableGet(gv_last_history);
      int diff_sec = (int)(now - last_sync);
      if(diff_sec > 0)
      {
         int gap_days = (diff_sec / 86400) + 1;
         if(gap_days > days_to_sync) days_to_sync = gap_days;
      }
   }
   if(days_to_sync > 30) days_to_sync = 30;

   Print("EAE WebSync: Executing auto history sync for last ", days_to_sync, " days...");
   if(EAE_WebSyncPushHistoryBatch(days_to_sync, magicB, magicS))
   {
      GlobalVariableSet(gv_last_history, (double)now);
      last_synced_day = current_day;
      Print("EAE WebSync: Auto history sync completed successfully.");
   }
   else
   {
      Print("EAE WebSync: Auto history sync failed. Will retry in 60s.");
      scheduled_sync_time = now + 60;
   }
}

//+------------------------------------------------------------------+
//| Immediate Sync for major events (e.g. Batch Close)               |
//+------------------------------------------------------------------+
void EAE_WebSyncTriggerEvent(string type, int total_orders, double total_lots, double total_profit)
{
   EAE_WebSyncTriggerBasketEvent(type, "", "", total_orders, total_lots, total_profit, 0, 0.0);
}

//+------------------------------------------------------------------+
//| Immediate Sync for Basket Closure Events (Rich Telemetry)        |
//+------------------------------------------------------------------+
void EAE_WebSyncTriggerBasketEvent(string exit_type, string sym, string side, int total_orders, double total_lots, double total_profit, int duration_sec = 0, double max_dd_pct = 0.0)
{
   string json = "{ \"p_payload\": {";
   json += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"type\":\"BATCH_CLOSE\",";
   json += "\"exit_type\":\"" + exit_type + "\",";
   json += "\"symbol\":\"" + sym + "\",";
   json += "\"side\":\"" + side + "\",";
   json += "\"total_orders\":" + IntegerToString(total_orders) + ",";
   json += "\"total_lots\":" + DoubleToString(total_lots, 2) + ",";
   json += "\"total_profit\":" + DoubleToString(total_profit, 2) + ",";
   json += "\"duration_sec\":" + IntegerToString(duration_sec) + ",";
   json += "\"max_dd_pct\":" + DoubleToString(max_dd_pct, 2) + ",";
#ifdef EA_SYSTEM_CODE
   json += "\"ea_name\":\"" + EA_SYSTEM_CODE + "\",";
#else
   json += "\"ea_name\":\"EasyM\",";
#endif
#ifdef EA_BUILD_ID
   json += "\"ea_build\":\"" + EA_BUILD_ID + "\"";
#else
   json += "\"ea_build\":\"\"";
#endif
   json += "}, \"p_api_key\":\"" + g_eae_api_key + "\" }";

   char data[]; char result[]; string result_headers;
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
   string target_url = (g_eae_using_fallback ? g_eae_fallback_url : g_eae_supabase_sync_url);
   WebRequest("POST", target_url, headers, 2000, data, result, result_headers);
}

#endif // __EAE_WEB_SYNC_MQH__
