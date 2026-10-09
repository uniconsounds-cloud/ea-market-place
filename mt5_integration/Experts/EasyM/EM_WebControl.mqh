//+------------------------------------------------------------------+
//| EM_WebControl.mqh                                                |
//| EasyM 2-Way Web Command & Control Engine                         |
//+------------------------------------------------------------------+
#ifndef __EM_WEB_CONTROL_MQH__
#define __EM_WEB_CONTROL_MQH__

//====================================================================
// 2-WAY WEB COMMAND & CONTROL AUTHORITY ENUM
//====================================================================
enum ENUM_CONTROL_MODE
{
   CONTROL_MODE_WEB_SYNC = 0, // Web Controlled (แนะนำ - ระบบเว็บคุมหลัก ซิงค์ 2 ทาง ไม่ถูก F7 ทับ)
   CONTROL_MODE_MANUAL   = 1  // Manual MT5 (ตั้งค่าตาม F7 เท่านั้น ไม่รับคำสั่งจากเว็บ)
};

//+------------------------------------------------------------------+
//| Helper: Extract JSON String value by key                         |
//+------------------------------------------------------------------+
string WebControlExtractJsonString(const string json, const string key)
{
   int keyPos = StringFind(json, "\"" + key + "\":");
   if(keyPos < 0) return "";
   int start = keyPos + StringLen("\"" + key + "\":");
   while(start < StringLen(json) && (json[start] == ' ' || json[start] == '\"')) start++;
   int end = start;
   while(end < StringLen(json) && json[end] != '\"' && json[end] != ',' && json[end] != '}') end++;
   if(end > start)
   {
      string val = StringSubstr(json, start, end - start);
      StringTrimLeft(val);
      StringTrimRight(val);
      return val;
   }
   return "";
}

//+------------------------------------------------------------------+
//| Helper: Extract JSON Boolean value by key                        |
//+------------------------------------------------------------------+
bool WebControlExtractJsonBool(const string json, const string key, bool defaultVal = false)
{
   int keyPos = StringFind(json, "\"" + key + "\":");
   if(keyPos < 0) return defaultVal;
   int start = keyPos + StringLen("\"" + key + "\":");
   while(start < StringLen(json) && json[start] == ' ') start++;
   if(StringSubstr(json, start, 4) == "true" || StringSubstr(json, start, 4) == "TRUE") return true;
   if(StringSubstr(json, start, 5) == "false" || StringSubstr(json, start, 5) == "FALSE") return false;
   return defaultVal;
}

//+------------------------------------------------------------------+
//| Parse & Apply Web Command Config from Server HTTP Response       |
//+------------------------------------------------------------------+
void WebControlParseAndApplyResponse(const string response)
{
   int wcPos = StringFind(response, "\"web_config\"");
   if(wcPos < 0) return;
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string subJson = StringSubstr(response, wcPos);
   
   // 1. Control Mode ("web" vs "manual")
   string ctrlMode = WebControlExtractJsonString(subJson, "control_mode");
   if(ctrlMode != "")
   {
      double modeVal = (ctrlMode == "manual") ? 0.0 : 1.0;
      GlobalVariableSet(StringFormat("EMP18_%I64d_CONTROL_MODE", login), modeVal);
   }
   
   // 2. Port Mode ("NORMAL", "SLOW", "FREEZE")
   string portMode = WebControlExtractJsonString(subJson, "port_mode");
   if(portMode != "")
   {
      double pmVal = 0.0;
      if(portMode == "SLOW") pmVal = 1.0;
      else if(portMode == "FREEZE") pmVal = 2.0;
      GlobalVariableSet(StringFormat("EMP18_%I64d_PORT_MODE", login), pmVal);
   }
   
   // 3. Pause New Orders
   if(StringFind(subJson, "\"pause_new_orders\":") >= 0)
   {
      bool isPaused = WebControlExtractJsonBool(subJson, "pause_new_orders", false);
      GlobalVariableSet(StringFormat("EMP18_%I64d_PAUSE", login), isPaused ? 1.0 : 0.0);
   }
   
   // 4. Symbols Configuration
   int symPos = StringFind(subJson, "\"symbols\"");
   if(symPos >= 0)
   {
      string symJson = StringSubstr(subJson, symPos);
      
      string knownSymbols[] = {
         "EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDJPY", "USDCHF",
         "EURJPY", "GBPJPY", "USDCAD", "AUDNZD", "CADCHF", "NZDCAD",
         "EURCAD", "GBPCAD", "EURAUD", "GBPAUD", "AUDJPY", "NZDJPY",
         "EURNZD", "GBPNZD", "AUDCAD", "EURCHF", "GBPCHF"
      };
      
      for(int s = 0; s < ArraySize(knownSymbols); s++)
      {
         string sym = knownSymbols[s];
         int sKey = StringFind(symJson, "\"" + sym + "\":");
         if(sKey >= 0)
         {
            int sEnd = StringFind(symJson, "}", sKey);
            if(sEnd > sKey)
            {
               string block = StringSubstr(symJson, sKey, sEnd - sKey + 1);
               
               string gvEn = StringFormat("EMP18_%I64d_%s_EN", login, sym);
               string gvQt = StringFormat("EMP18_%I64d_%s_QT", login, sym);

               if(StringFind(block, "\"close_only\":true") >= 0 || StringFind(block, "\"close_only\": true") >= 0)
                  GlobalVariableSet(gvEn, 0.0);
               else if(StringFind(block, "\"enabled\":false") >= 0 || StringFind(block, "\"enabled\": false") >= 0)
                  GlobalVariableSet(gvEn, 0.0);
               else if(StringFind(block, "\"enabled\":true") >= 0 || StringFind(block, "\"enabled\": true") >= 0)
                  GlobalVariableSet(gvEn, 1.0);

               if(StringFind(block, "\"quarantined\":true") >= 0 || StringFind(block, "\"quarantined\": true") >= 0)
                  GlobalVariableSet(gvQt, 1.0);
               else if(StringFind(block, "\"quarantined\":false") >= 0 || StringFind(block, "\"quarantined\": false") >= 0)
                  GlobalVariableSet(gvQt, 0.0);
            }
         }
      }
   }
   
   GlobalVariableSet(StringFormat("EMP18_%I64d_LAST_WEB_UPDATE", login), (double)TimeCurrent());
}

//+------------------------------------------------------------------+
//| Check if New Orders are paused from Web                          |
//+------------------------------------------------------------------+
bool WebControlIsPaused()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string gvPauseKey = StringFormat("EMP18_%I64d_PAUSE", login);
   if(GlobalVariableCheck(gvPauseKey) && GlobalVariableGet(gvPauseKey) > 0.5)
      return true;
   return false;
}

//+------------------------------------------------------------------+
//| Get Dashboard Authority Badge text                               |
//+------------------------------------------------------------------+
string WebControlGetBadge(ENUM_CONTROL_MODE mode)
{
   return (mode == CONTROL_MODE_WEB_SYNC) ? "[🌐 WEB CONTROL]" : "[💻 MANUAL]";
}

#endif // __EM_WEB_CONTROL_MQH__
