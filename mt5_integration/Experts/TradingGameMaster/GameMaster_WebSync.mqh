//+------------------------------------------------------------------+
//| GameMaster_WebSync.mqh                                           |
//| Handles API communication with Supabase REST API                   |
//+------------------------------------------------------------------+
#ifndef __GAMEMASTER_WEBSYNC_MQH__
#define __GAMEMASTER_WEBSYNC_MQH__

input string InpSupabaseUrl = ""; // e.g. https://xyz.supabase.co
input string InpSupabaseKey = ""; // anon key or service role key

class CGameMasterWebSync
{
private:
   string m_baseUrl;
   string m_apiKey;
   
   bool SendPostRequest(string endpoint, string jsonPayload)
   {
      if(m_baseUrl == "" || m_apiKey == "") return false;
      
      char post[], result[];
      string headers = "apikey: " + m_apiKey + "\r\n" +
                       "Authorization: Bearer " + m_apiKey + "\r\n" +
                       "Content-Type: application/json\r\n" +
                       "Prefer: return=minimal\r\n"; // Supabase optimization
                       
      StringToCharArray(jsonPayload, post, 0, WHOLE_ARRAY, CP_UTF8);
      if(ArraySize(post) > 0) ArrayResize(post, ArraySize(post)-1);
      
      string resultHeaders;
      string url = m_baseUrl + "/rest/v1/" + endpoint;
      
      int res = WebRequest("POST", url, headers, 5000, post, result, resultHeaders);
      if(res == 200 || res == 201 || res == 204) return true;
      
      Print("WebRequest POST failed: ", res, " URL: ", url, " Error: ", GetLastError());
      return false;
   }

   bool SendPatchRequest(string endpoint, string jsonPayload)
   {
      if(m_baseUrl == "" || m_apiKey == "") return false;
      
      char post[], result[];
      string headers = "apikey: " + m_apiKey + "\r\n" +
                       "Authorization: Bearer " + m_apiKey + "\r\n" +
                       "Content-Type: application/json\r\n" +
                       "Prefer: return=minimal\r\n";
                       
      StringToCharArray(jsonPayload, post, 0, WHOLE_ARRAY, CP_UTF8);
      if(ArraySize(post) > 0) ArrayResize(post, ArraySize(post)-1);
      
      string resultHeaders;
      string url = m_baseUrl + "/rest/v1/" + endpoint;
      
      int res = WebRequest("PATCH", url, headers, 5000, post, result, resultHeaders);
      if(res == 200 || res == 201 || res == 204) return true;
      
      Print("WebRequest PATCH failed: ", res, " URL: ", url, " Error: ", GetLastError());
      return false;
   }

public:
   CGameMasterWebSync() {}
   
   void Init(string url, string key)
   {
      m_baseUrl = url;
      m_apiKey = key;
   }
   
   void BroadcastSignal(int strategyId, string action, ulong ticket, double price, double sl, double tp)
   {
      string payload = StringFormat("{\"strategy_id\":%d, \"action\":\"%s\", \"ticket\":%I64u, \"price\":%.3f, \"sl\":%.3f, \"tp\":%.3f}", 
                                     strategyId, action, ticket, price, sl, tp);
      SendPostRequest("tg_signals", payload);
   }
   
   void BroadcastRoundOpen(int strategyId, ulong ticket, string type, double vol, double openPrice, double sl, double tp)
   {
      string payload = StringFormat("{\"strategy_id\":%d, \"ticket\":%I64u, \"type\":\"%s\", \"volume\":%.2f, \"open_price\":%.3f, \"sl\":%.3f, \"tp\":%.3f, \"status\":\"OPEN\"}", 
                                     strategyId, ticket, type, vol, openPrice, sl, tp);
      SendPostRequest("tg_virtual_rounds", payload);
   }
   
   void BroadcastRoundClose(ulong ticket, double closePrice, double profit, double maxDd)
   {
      // Supabase timestamp format requires ISO8601 or similar, but default Postgres accepts 'YYYY-MM-DD HH:MI:SS'
      string closeTimeStr = TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS);
      StringReplace(closeTimeStr, ".", "-"); // Convert MT5 "YYYY.MM.DD" to "YYYY-MM-DD"
      
      string payload = StringFormat("{\"close_price\":%.3f, \"profit\":%.2f, \"max_dd\":%.2f, \"status\":\"CLOSED\", \"close_time\":\"%s\"}", 
                                     closePrice, profit, maxDd, closeTimeStr);
      
      string endpoint = StringFormat("tg_virtual_rounds?ticket=eq.%I64u", ticket);
      SendPatchRequest(endpoint, payload);
   }
   
   void BroadcastRoundPing(ulong ticket, double profit, double maxDd)
   {
      string payload = StringFormat("{\"profit\":%.2f, \"max_dd\":%.2f}", profit, maxDd);
      string endpoint = StringFormat("tg_virtual_rounds?ticket=eq.%I64u", ticket);
      SendPatchRequest(endpoint, payload);
   }
   
   void BroadcastStrategyStatus(int strategyId, double balance, double floatingPl, int totalTrades)
   {
      string updateTimeStr = TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS);
      StringReplace(updateTimeStr, ".", "-");
      
      string payload = StringFormat("{\"virtual_balance\":%.2f, \"floating_pl\":%.2f, \"total_trades\":%d, \"last_updated\":\"%s\"}", 
                                     balance, floatingPl, totalTrades, updateTimeStr);
      
      string endpoint = StringFormat("tg_strategies?id=eq.%d", strategyId);
      SendPatchRequest(endpoint, payload);
   }
};

#endif
