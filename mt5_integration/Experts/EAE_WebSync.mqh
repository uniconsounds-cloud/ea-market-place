//+------------------------------------------------------------------+
//| EAE_WebSync.mqh                                                  |
//| EAEZE Universal Sync Module for MT5                              |
//|                                                                  |
//| Purpose: modular synchronization of EA data to web dashboard.    |
//| Features:                                                        |
//|  - Partner-Base API Key authentication                           |
//|  - Scalable performance (Throttling)                             |
//|  - Non-blocking-style WebRequests                                |
//|  - Full support for Farm UI and Spaceship Dashboard              |
//+------------------------------------------------------------------+
#ifndef __EAE_WEB_SYNC_MQH__
#define __EAE_WEB_SYNC_MQH__

#include <Trade/PositionInfo.mqh>
#include "EAE_MonitorTypes.mqh"

// --- Global Sync State ---
// Default to direct Supabase integration for new EAs
datetime g_eae_last_sync_time = 0;
int      g_eae_sync_interval  = 20; // Default: Sync every 20 seconds
int      g_eae_active_sync_interval = 0; // Dynamic server override (0 = use g_eae_sync_interval)
bool     g_eae_full_sync_mode = true; // Start with true to ensure initial data
string   g_eae_api_url        = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data";

// Internal System Key (Do not change)
string   g_eae_system_key     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo";

// Current active partner key for identification
string   g_eae_api_key        = "EZE-123456"; 

// --- Smart Sync State ---
string   g_eae_last_sync_hash = "";
string   g_eae_sync_status    = "IDLE"; // Shared status for UI: IDLE, SYNCING, OK, ERR
string   g_eae_sync_message   = "Connecting...";
datetime g_eae_last_heartbeat = 0;
const int g_eae_heartbeat_interval = 300; // Force full sync every 5 minutes even if no change
bool     g_eae_history_checked = false;

//+------------------------------------------------------------------+
//| Initialize the WebSync module with custom settings               |
//+------------------------------------------------------------------+
void EAE_WebSyncInit(string api_url, int interval_sec)
{
   g_eae_api_url       = api_url;
   g_eae_api_key       = "LICENSE_AUTO"; // Auto-license mapping based on account number
   g_eae_sync_interval = (interval_sec < 5 ? 5 : interval_sec); // Min 5s
   g_eae_history_checked = false; // Reset history check on EA Init
   Print("EAE WebSync: Initialized (Auto-license mode).");
}

//+------------------------------------------------------------------+
//| Initialize the WebSync module with custom settings (compatibility overload)|
//+------------------------------------------------------------------+
void EAE_WebSyncInit(string api_url, string api_key, int interval_sec)
{
   g_eae_api_url       = api_url;
   g_eae_api_key       = api_key;
   g_eae_sync_interval = (interval_sec < 5 ? 5 : interval_sec); // Min 5s
   g_eae_history_checked = false; // Reset history check on EA Init
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
            if(magicB != 0 && (magic < magicB || magic >= magicB + 100)) continue;
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
         
         json += "{";
         json += "\"ticket_id\":" + IntegerToString(ticket) + ",";
         json += "\"type\":\"" + pos_type + "\",";
         json += "\"status\":\"OPEN\",";
         json += "\"current_pnl\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + ",";
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
//| Persists peak DD% in a Global Variable until midnight reset       |
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
      GlobalVariableSet(gv_max_dd_name, 0);
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
   datetime start = (targetDay / 86400) * 86400;
   datetime end   = start + 86399;
   
   ZeroMemory(out_sum);
   out_sum.date          = start;
   out_sum.account_login = AccountInfoInteger(ACCOUNT_LOGIN);
   
   if(!HistorySelect(start, end)) return false;
   
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket <= 0) continue;
      
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
      {
         long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
         long deal_type = HistoryDealGetInteger(ticket, DEAL_TYPE);
         bool is_buy_side = (deal_type == DEAL_TYPE_SELL);
         bool is_sell_side = (deal_type == DEAL_TYPE_BUY);
         
         if(magicB == magicS) {
            if(magicB != 0 && (magic < magicB || magic >= magicB + 100)) continue;
         }
         else {
            if(is_buy_side) {
               if(magicB != 0 && magic != magicB) continue;
            }
            else if(is_sell_side) {
               if(magicS != 0 && magic != magicS) continue;
            }
         }
         
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
         out_sum.total_lots   += HistoryDealGetDouble(ticket, DEAL_VOLUME);
         
         string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
         if(StringFind(comment, "CLOSE") >= 0 || StringFind(comment, "LOK") >= 0 || StringFind(comment, "BRK") >= 0)
         {
            if(magicB == magicS) {
               if(magic >= magicB && magic < magicB + 100) {
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
   WebRequest("POST", g_eae_api_url, headers, 3000, data, result, result_headers);
}

//+------------------------------------------------------------------+
//| Calculate a unique hash for the current state to detect changes  |
//+------------------------------------------------------------------+
string EAE_CalculateDataHash(const EAE_RealtimeSnapshot &snap)
{
   // Combine critical metrics into a string to detect "Real Changes"
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
//| Send a full modular snapshot to the web server                   |
//+------------------------------------------------------------------+
bool EAE_WebSyncPerform(EAE_RealtimeSnapshot &snap, bool force_now = false)
{
   datetime now = TimeCurrent();
   datetime today_start = (now / 86400) * 86400;
   
   // 1. Throttling / Sleep-Wake Check
   if(g_eae_last_sync_time > 0)
   {
      int current_interval = g_eae_sync_interval;
      if(g_eae_active_sync_interval > 0) {
         current_interval = g_eae_active_sync_interval;
      }
      if(!g_eae_full_sync_mode) {
         current_interval = 10; // Sleep mode: ping to check for active viewer every 10 seconds
      }
      
      if(!force_now && (int)(now - g_eae_last_sync_time) < current_interval) {
         return true; 
      }
   }
   
   g_eae_last_sync_time = now;
   
   // 2. Build Payload
   string orders_json = (g_eae_full_sync_mode ? EAE_BuildOrdersJson(snap.identity.magic_buy, snap.identity.magic_sell) : "[]");
   string payload = "{ \"p_payload\": {";
   payload += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   payload += "\"server_time\":" + IntegerToString(now) + ",";
   payload += "\"ping_only\":" + (g_eae_full_sync_mode ? "false" : "true") + ",";
   
   // Daily stats
   EAE_DailySummary today;
   EAE_ScanHistoryDailySummary(now, snap.identity.magic_buy, snap.identity.magic_sell, today);
   payload += "\"today_profit\":" + DoubleToString(today.total_profit, 2) + ",";
   payload += "\"today_closed_lots\":" + DoubleToString(today.total_lots, 2) + ",";
   payload += "\"daily_max_drawdown\":" + DoubleToString(today.max_dd_pct, 2) + ",";
   
   // Snapshot
   payload += "\"snapshot\":{";
   payload += "\"account\":{\"balance\":" + DoubleToString(snap.account.balance, 2) + ",\"equity\":" + DoubleToString(snap.account.equity, 2) + ",\"margin_level\":" + DoubleToString(snap.account.margin_level, 2) + ",\"currency\":\"" + snap.account.currency + "\"},";
   payload += "\"buy_state\":{\"open_count\":" + IntegerToString(snap.buy_state.open_count) + ",\"open_lots\":" + DoubleToString(snap.buy_state.open_lots, 2) + ",\"floating_pnl\":" + DoubleToString(snap.buy_state.floating_pnl, 2) + "},";
   payload += "\"sell_state\":{\"open_count\":" + IntegerToString(snap.sell_state.open_count) + ",\"open_lots\":" + DoubleToString(snap.sell_state.open_lots, 2) + ",\"floating_pnl\":" + DoubleToString(snap.sell_state.floating_pnl, 2) + "},";
   payload += "\"identity\":{\"product_family\":\"" + snap.identity.product_family + "\",\"system_code\":\"" + snap.identity.system_code + "\",\"ea_version\":\"" + snap.identity.ea_version + "\"}";
   payload += "},";
   
   payload += "\"orders\":" + orders_json;
   payload += "}, \"p_api_key\":\"" + g_eae_api_key + "\" }";

   // Hash Check for Throttling (only applies in full sync mode)
   if(g_eae_full_sync_mode)
   {
      string current_hash = IntegerToString(snap.buy_state.open_count) + "_" + IntegerToString(snap.sell_state.open_count) + "_" + DoubleToString(snap.account.equity, 2);
      if(!force_now && current_hash == g_eae_last_sync_hash && (int)(now - g_eae_last_heartbeat) < g_eae_heartbeat_interval)
      {
         return true; // Skip redundant upload if nothing changed
      }
   }
   
   g_eae_last_heartbeat = now;
   
   // Check Daily Summary
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

   // 3. Dispatch WebRequest
   char data[]; char result[]; string result_headers;
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
   
   ResetLastError();
   int res = WebRequest("POST", g_eae_api_url, headers, 3000, data, result, result_headers);
   
   if(res == -1) {
      g_eae_sync_status = "ERR: CONN";
      g_eae_sync_message = "Connection Failed (" + IntegerToString(GetLastError()) + ")";
      Print("EAE Sync Error (WebRequest failed): ", GetLastError());
      return false;
   }
   
   if(res != 200) {
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
   g_eae_sync_status = "OK (ONLINE)";
   g_eae_sync_message = "Connected to Farm 2.5D";
   
   // --- [NEW] Update Last Online Time for Self-Healing ---
   string gv_last_online = "EAE_LastOnline_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   GlobalVariableSet(gv_last_online, (double)now);
   
   // 4. Parse response for on-demand sync control
   bool was_full = g_eae_full_sync_mode;
   
   if(StringFind(response, "\"should_sync_full\":true") >= 0 || StringFind(response, "\"should_sync_full\": true") >= 0) {
      if(!g_eae_full_sync_mode) {
         g_eae_last_sync_time = 0; // Trigger instant full sync on the very next tick!
         g_eae_last_sync_hash = ""; // Clear hash to force a full update!
         g_eae_last_heartbeat = 0;  // Reset heartbeat timer!
         Print("EAE WebSync: >> WAKING UP << (Viewer active, initiating full sync...)");
      }
      g_eae_full_sync_mode = true;
   } else {
      g_eae_full_sync_mode = false;
   }
   
   // Dynamic sync interval parsing
   int pos = StringFind(response, "\"sync_interval\":");
   if(pos >= 0) {
      int start = pos + StringLen("\"sync_interval\":");
      int end = start;
      while(end < StringLen(response) && response[end] >= '0' && response[end] <= '9') {
         end++;
      }
      if(end > start) {
         g_eae_active_sync_interval = (int)StringToInteger(StringSubstr(response, start, end - start));
      }
   }
   
   if(g_eae_full_sync_mode) {
      Print("EAE WebSync: WAKE MODE (Full push successful). Response: ", response);
   } else {
      Print("EAE WebSync: SLEEP MODE (Lightweight ping sent). Response: ", response);
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Push a Batch of Daily Histories to Supabase                      |
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
      // For the current day (i == 0), retrieve max drawdown from global variables
      if(i == 0)
      {
         summaries[i].max_dd_pct = EAE_GetDailyMaxDrawdownPct();
      }
      else
      {
         summaries[i].max_dd_pct = 0.0;
      }
   }
   
   // Select history once for the entire range (from start of the oldest day in the batch to now)
   datetime start_time = today_start - (days_to_sync * 86400);
   if(HistorySelect(start_time, now))
   {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket <= 0) continue;
         
         long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
         {
            datetime deal_time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
            datetime deal_day_start = (deal_time / 86400) * 86400;
            long diff_sec = today_start - deal_day_start;
            if(diff_sec < 0) continue; // Deal in the future
            
            int idx = (int)(diff_sec / 86400);
            if(idx < 0 || idx >= days_to_sync) continue; // Deal outside the batch window
            
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            long deal_type = HistoryDealGetInteger(ticket, DEAL_TYPE);
            bool is_buy_side = (deal_type == DEAL_TYPE_SELL);
            bool is_sell_side = (deal_type == DEAL_TYPE_BUY);
            
            if(magicB == magicS) {
               if(magicB != 0 && (magic < magicB || magic >= magicB + 100)) continue;
            }
            else {
               if(is_buy_side) {
                  if(magicB != 0 && magic != magicB) continue;
               }
               else if(is_sell_side) {
                  if(magicS != 0 && magic != magicS) continue;
               }
            }
            
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
            summaries[idx].total_lots   += HistoryDealGetDouble(ticket, DEAL_VOLUME);
            
            string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
            if(StringFind(comment, "CLOSE") >= 0 || StringFind(comment, "LOK") >= 0 || StringFind(comment, "BRK") >= 0)
            {
               if(magicB == magicS) {
                  if(magic >= magicB && magic < magicB + 100) {
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
   
   string url = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_history_batch";
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
                    
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, data, result, result_headers);
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
//| Self-Healing Boot Check: Call this in OnTimer                    |
//+------------------------------------------------------------------+
void EAE_WebSyncCheckAndPushHistory(long magicB, long magicS)
{
   if(g_eae_history_checked) return;
   
   string gv_last_history = "EAE_LastHistorySync_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   int days_to_sync = 30; // Default if no GV exists
   
   if(GlobalVariableCheck(gv_last_history))
   {
      datetime last_sync = (datetime)GlobalVariableGet(gv_last_history);
      datetime now = TimeCurrent();
      int diff_sec = (int)(now - last_sync);
      
      if(diff_sec > 0) {
         days_to_sync = (diff_sec / 86400) + 1; // Round up to cover the missing gap
      } else {
         days_to_sync = 0;
      }
   }
   
   if(days_to_sync > 0)
   {
      if(days_to_sync > 30) days_to_sync = 30;
      Print("EAE WebSync: Self-Healing Triggered. Missing days: ", days_to_sync);
      if(EAE_WebSyncPushHistoryBatch(days_to_sync, magicB, magicS))
      {
         GlobalVariableSet(gv_last_history, (double)TimeCurrent());
      }
   }
   else
   {
      Print("EAE WebSync: History is up to date.");
   }
   
   g_eae_history_checked = true; // Only check once per EA Boot
}

//+------------------------------------------------------------------+
//| Immediate Sync for major events (e.g. Batch Close)               |
//+------------------------------------------------------------------+
void EAE_WebSyncTriggerEvent(string type, int total_orders, double total_lots, double total_profit)
{
   string json = "{ \"p_payload\": {";
   json += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"type\":\"" + type + "\",";
   json += "\"total_orders\":" + IntegerToString(total_orders) + ",";
   json += "\"total_lots\":" + DoubleToString(total_lots, 2) + ",";
   json += "\"total_profit\":" + DoubleToString(total_profit, 2);
   json += "}, \"p_api_key\":\"" + g_eae_api_key + "\" }";

   char data[]; char result[]; string result_headers;
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
   WebRequest("POST", g_eae_api_url, headers, 2000, data, result, result_headers);
}

#endif // __EAE_WEB_SYNC_MQH__
