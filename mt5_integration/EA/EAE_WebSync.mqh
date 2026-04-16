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
bool     g_eae_full_sync_mode = true; // Start with true to ensure initial data
string   g_eae_api_url        = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data";

// Internal System Key (Do not change)
string   g_eae_system_key     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo";

// Current active partner key for identification
string   g_eae_api_key        = "EZE-123456"; 

//+------------------------------------------------------------------+
//| Initialize the WebSync module with custom settings               |
//+------------------------------------------------------------------+
void EAE_WebSyncInit(string api_url, string api_key, int interval_sec)
{
   g_eae_api_url       = api_url;
   g_eae_api_key       = api_key;
   g_eae_sync_interval = (interval_sec < 5 ? 5 : interval_sec); // Min 5s
   Print("EAE WebSync: Initialized. API Key ending ...", StringSubstr(api_key, StringLen(api_key)-4));
}

//+------------------------------------------------------------------+
//| Internal helper to build an Order JSON list for the Farm UI      |
//+------------------------------------------------------------------+
string EAE_BuildOrdersJson()
{
   string json = "[";
   bool first = true;
   int total = PositionsTotal();
   
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         // We only sync orders that belong to this EA/System (optional filtering can be added)
         if(!first) json += ",";
         
         string pos_type = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL";
         
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
//| Calculate total closed profit for the current day                |
//+------------------------------------------------------------------+
double EAE_CalculateTodayProfit()
{
   double profit = 0;
   datetime todayStart = (TimeCurrent() / 86400) * 86400; // Start of day 00:00
   
   if(HistorySelect(todayStart, TimeCurrent()))
   {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket > 0)
         {
            // Only count if it's a profit/loss relevant deal
            long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
            {
               profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
               profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
               profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
            }
         }
      }
   }
   return profit;
}

//+------------------------------------------------------------------+
//| Calculate total closed lots for the current day                  |
//+------------------------------------------------------------------+
double EAE_CalculateTodayClosedLots()
{
   double total_lots = 0;
   datetime todayStart = (TimeCurrent() / 86400) * 86400; // Start of day 00:00
   
   if(HistorySelect(todayStart, TimeCurrent()))
   {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket > 0)
         {
            long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT)
            {
               total_lots += HistoryDealGetDouble(ticket, DEAL_VOLUME);
            }
         }
      }
   }
   return total_lots;
}

//+------------------------------------------------------------------+
//| Update and Get Daily Max Drawdown (Fixed Amount)                 |
//| Persists peak DD in a Global Variable until midnight reset       |
//+------------------------------------------------------------------+
double EAE_GetDailyMaxDrawdown()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double current_pnl = equity - balance;
   
   string gv_peak_name = "EAE_PeakEquity_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string gv_max_dd_name = "EAE_MaxDD_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string gv_date_name = "EAE_LastDate_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   
   datetime today_start = (TimeCurrent() / 86400) * 86400;
   
   // Reset if new day
   if(!GlobalVariableCheck(gv_date_name) || GlobalVariableGet(gv_date_name) != (double)today_start)
   {
      GlobalVariableSet(gv_peak_name, balance);
      GlobalVariableSet(gv_max_dd_name, 0);
      GlobalVariableSet(gv_date_name, (double)today_start);
   }
   
   double peak = GlobalVariableGet(gv_peak_name);
   if(equity > peak) {
      peak = equity;
      GlobalVariableSet(gv_peak_name, peak);
   }
   
   double current_dd = peak - equity;
   double max_dd = GlobalVariableGet(gv_max_dd_name);
   
   if(current_dd > max_dd) {
      max_dd = current_dd;
      GlobalVariableSet(gv_max_dd_name, max_dd);
   }
   
   return max_dd;
}

//+------------------------------------------------------------------+
//| Send a full modular snapshot to the web server                   |
//+------------------------------------------------------------------+
bool EAE_WebSyncPerform(EAE_RealtimeSnapshot &snap, bool force_now = false)
{
   // Check if it's time to sync (Throttling)
   datetime now = TimeCurrent();
   if(!force_now && (now - g_eae_last_sync_time < g_eae_sync_interval))
      return false;
      
   g_eae_last_sync_time = now;

   // 1. Construct Snapshot Data JSON manually (to avoid external JSON libs)
   string snapshot_json = "{";
   snapshot_json += "\"identity\":{";
   snapshot_json += "\"product_family\":\"" + snap.identity.product_family + "\",";
   snapshot_json += "\"system_code\":\"" + snap.identity.system_code + "\",";
   snapshot_json += "\"ea_version\":\"" + snap.identity.ea_version + "\"";
   snapshot_json += "},";
   
   snapshot_json += "\"account\":{";
   snapshot_json += "\"balance\":" + DoubleToString(snap.account.balance, 2) + ",";
   snapshot_json += "\"equity\":" + DoubleToString(snap.account.equity, 2) + ",";
   snapshot_json += "\"margin_level\":" + DoubleToString(snap.account.margin_level, 2) + ",";
   snapshot_json += "\"currency\":\"" + snap.account.currency + "\"";
   snapshot_json += "},";
   
   snapshot_json += "\"buy_state\":{";
   snapshot_json += "\"open_count\":" + IntegerToString(snap.buy_state.open_count) + ",";
   snapshot_json += "\"open_lots\":" + DoubleToString(snap.buy_state.open_lots, 2) + ",";
   snapshot_json += "\"floating_pnl\":" + DoubleToString(snap.buy_state.floating_pnl, 2);
   snapshot_json += "},";
   
   snapshot_json += "\"sell_state\":{";
   snapshot_json += "\"open_count\":" + IntegerToString(snap.sell_state.open_count) + ",";
   snapshot_json += "\"open_lots\":" + DoubleToString(snap.sell_state.open_lots, 2) + ",";
   snapshot_json += "\"floating_pnl\":" + DoubleToString(snap.sell_state.floating_pnl, 2);
   snapshot_json += "}";
   snapshot_json += "}";

   // 2. Build Full Payload for Supabase RPC
   string payload = "{";
   payload += "\"p_payload\": {";
   payload += "\"is_heartbeat\":" + (g_eae_full_sync_mode ? "false" : "true") + ",";
   payload += "\"snapshot\":" + snapshot_json + ",";
   if(g_eae_full_sync_mode) {
      payload += "\"orders\":"   + EAE_BuildOrdersJson() + ",";
   }
   payload += "\"today_profit\":" + DoubleToString(EAE_CalculateTodayProfit(), 2) + ",";
   payload += "\"today_closed_lots\":" + DoubleToString(EAE_CalculateTodayClosedLots(), 2) + ",";
   payload += "\"daily_max_drawdown\":" + DoubleToString(EAE_GetDailyMaxDrawdown(), 2) + ",";
   payload += "\"server_time\":" + IntegerToString(TimeCurrent()) + ",";
   payload += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\"";
   payload += "},";
   payload += "\"p_api_key\":\"" + g_eae_api_key + "\"";
   payload += "}";

   // 3. Dispatch WebRequest (Async-style with short timeout)
   char data[];
   char result[];
   string result_headers;
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1); // Remove null terminator

   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + g_eae_system_key + "\r\n" +
                    "Authorization: Bearer " + g_eae_system_key + "\r\n";
   
   ResetLastError();
   int res = WebRequest("POST", g_eae_api_url, headers, 3000, data, result, result_headers);
   
   if(res == -1) {
      Print("EAE Sync Error (WebRequest failed): ", GetLastError());
      return false;
   }
   
   if(res != 200) {
      string err_resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      Print("EAE Sync Server Error (", res, "): ", err_resp);
      return false;
   }
   
   // 4. Parse response for on-demand sync control
   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(StringFind(response, "\"should_sync_full\":true") >= 0) {
      g_eae_full_sync_mode = true;
   } else {
      g_eae_full_sync_mode = false;
   }
   
   return true;
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
