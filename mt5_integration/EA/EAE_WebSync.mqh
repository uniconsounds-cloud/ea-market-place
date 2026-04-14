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
datetime g_eae_last_sync_time = 0;
int      g_eae_sync_interval  = 20; // Default: Sync every 20 seconds
string   g_eae_api_url        = "https://eaeze.com/api/mt5/sync";
string   g_eae_api_key        = "KHUCHAI_SUPHAKORN"; // Partner Key

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

   // 2. Build Full Payload
   string payload = "{";
   payload += "\"snapshot\":" + snapshot_json + ",";
   payload += "\"orders\":"   + EAE_BuildOrdersJson() + ",";
   payload += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\"";
   payload += "}";

   // 3. Dispatch WebRequest (Async-style with short timeout)
   char data[];
   char result[];
   string result_headers;
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1); // Remove null terminator

   string headers = "Content-Type: application/json\r\n" + "x-api-key: " + g_eae_api_key + "\r\n";
   
   ResetLastError();
   int res = WebRequest("POST", g_eae_api_url, headers, 3000, data, result, result_headers);
   
   if(res == -1) {
      Print("EAE Sync Error (WebRequest failed): ", GetLastError());
      return false;
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Immediate Sync for major events (e.g. Batch Close)               |
//+------------------------------------------------------------------+
void EAE_WebSyncTriggerEvent(string type, int total_orders, double total_lots, double total_profit)
{
   string json = "{";
   json += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"type\":\"" + type + "\",";
   json += "\"total_orders\":" + IntegerToString(total_orders) + ",";
   json += "\"total_lots\":" + DoubleToString(total_lots, 2) + ",";
   json += "\"total_profit\":" + DoubleToString(total_profit, 2);
   json += "}";

   char data[]; char result[]; string result_headers;
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   
   string headers = "Content-Type: application/json\r\n" + "x-api-key: " + g_eae_api_key + "\r\n";
   WebRequest("POST", g_eae_api_url, headers, 2000, data, result, result_headers);
}

#endif // __EAE_WEB_SYNC_MQH__
