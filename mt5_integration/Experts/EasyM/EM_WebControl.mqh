//+------------------------------------------------------------------+
//| EM_WebControl.mqh                                                |
//| EasyM 2-Way Web Command & Control Engine                         |
//+------------------------------------------------------------------+
#ifndef __EM_WEB_CONTROL_MQH__
#define __EM_WEB_CONTROL_MQH__

enum ENUM_CONTROL_MODE
{
   CONTROL_MODE_WEB_SYNC = 0, // Web Controlled
   CONTROL_MODE_MANUAL   = 1  // Manual MT5
};

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

void WebControlParseAndApplyResponse(const string response)
{
   int wcPos = StringFind(response, "\"web_config\"");
   if(wcPos < 0) wcPos = StringFind(response, "\"control\"");
   if(wcPos < 0) return;
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string subJson = StringSubstr(response, wcPos);
   
   // 0. Sequence Check (Prevents clobbering manual MT5 chart clicks with stale commands)
   string seqStr = WebControlExtractJsonString(subJson, "command_seq");
   long cmdSeq = (seqStr != "") ? StringToInteger(seqStr) : 0;
   string gvAckKey = StringFormat("EMP_%I64d_ACK_SEQ", login);
   long lastAckSeq = GlobalVariableCheck(gvAckKey) ? (long)GlobalVariableGet(gvAckKey) : 0;

   // If this command sequence was already applied, skip so local MT5 chart clicks are not clobbered
   if(cmdSeq > 0 && cmdSeq <= lastAckSeq)
   {
      return;
   }
   
   // 1. Control Mode ("web" vs "manual")
   string ctrlMode = WebControlExtractJsonString(subJson, "control_mode");
   if(ctrlMode != "")
   {
      double modeVal = (ctrlMode == "manual") ? 0.0 : 1.0;
      GlobalVariableSet(StringFormat("EMP_%I64d_CONTROL_MODE", login), modeVal);
      GlobalVariableSet(StringFormat("EMP18_%I64d_CONTROL_MODE", login), modeVal);
   }
   
   // 2. Port Mode ("NORMAL", "SLOW", "FREEZE")
   string portMode = WebControlExtractJsonString(subJson, "port_mode");
   if(portMode != "")
   {
      double pmVal = 0.0;
      if(portMode == "SLOW") pmVal = 1.0;
      else if(portMode == "FREEZE") pmVal = 2.0;
      GlobalVariableSet(StringFormat("EMP_%I64d_PORT_MODE", login), pmVal);
      GlobalVariableSet(StringFormat("EMP18_%I64d_PORT_MODE", login), pmVal);
   }
   
   // 3. Pause New Orders
   if(StringFind(subJson, "\"pause_new_orders\":") >= 0)
   {
      bool isPaused = WebControlExtractJsonBool(subJson, "pause_new_orders", false);
      GlobalVariableSet(StringFormat("EMP_%I64d_PAUSE", login), isPaused ? 1.0 : 0.0);
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
               
               string gvEn = StringFormat("EMP_%I64d_%s_EN", login, sym);
               string gvEn18 = StringFormat("EMP18_%I64d_%s_EN", login, sym);
               string gvQt = StringFormat("EMP_%I64d_%s_QT", login, sym);
               string gvQt18 = StringFormat("EMP18_%I64d_%s_QT", login, sym);

               double prevVal = GlobalVariableCheck(gvEn) ? GlobalVariableGet(gvEn) : -1.0;

               if(StringFind(block, "\"close_only\":true") >= 0 || StringFind(block, "\"close_only\": true") >= 0 ||
                  StringFind(block, "\"enabled\":false") >= 0 || StringFind(block, "\"enabled\": false") >= 0)
               {
                  GlobalVariableSet(gvEn, 0.0);
                  GlobalVariableSet(gvEn18, 0.0);
                  if(prevVal != 0.0)
                  {
                     PrintFormat("[WebControl] Remote Switch Applied: %s -> CLOSE-ONLY", sym);
                  }
               }
               else if(StringFind(block, "\"enabled\":true") >= 0 || StringFind(block, "\"enabled\": true") >= 0)
               {
                  GlobalVariableSet(gvEn, 1.0);
                  GlobalVariableSet(gvEn18, 1.0);
                  if(prevVal != 1.0)
                  {
                     PrintFormat("[WebControl] Remote Switch Applied: %s -> ACTIVE", sym);
                  }
               }

               if(StringFind(block, "\"quarantined\":true") >= 0 || StringFind(block, "\"quarantined\": true") >= 0)
               {
                  GlobalVariableSet(gvQt, 1.0);
                  GlobalVariableSet(gvQt18, 1.0);
               }
               else if(StringFind(block, "\"quarantined\":false") >= 0 || StringFind(block, "\"quarantined\": false") >= 0)
               {
                  GlobalVariableSet(gvQt, 0.0);
                  GlobalVariableSet(gvQt18, 0.0);
               }
            }
         }
      }
   }
   
   if(cmdSeq > 0)
   {
      GlobalVariableSet(gvAckKey, (double)cmdSeq);
   }

   // Clean up any old timestamp key from previous builds
   string gvLastUpdateKey = StringFormat("EMP_%I64d_LAST_WEB_UPDATE", login);
   if(GlobalVariableCheck(gvLastUpdateKey)) GlobalVariableDel(gvLastUpdateKey);
   string gvLastUpdateKey18 = StringFormat("EMP18_%I64d_LAST_WEB_UPDATE", login);
   if(GlobalVariableCheck(gvLastUpdateKey18)) GlobalVariableDel(gvLastUpdateKey18);
}

bool WebControlIsPaused()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string gvPauseKey = StringFormat("EMP_%I64d_PAUSE", login);
   if(GlobalVariableCheck(gvPauseKey) && GlobalVariableGet(gvPauseKey) > 0.5) return true;
   string gvPauseKey18 = StringFormat("EMP18_%I64d_PAUSE", login);
   if(GlobalVariableCheck(gvPauseKey18) && GlobalVariableGet(gvPauseKey18) > 0.5) return true;
   return false;
}

string WebControlGetBadge(ENUM_CONTROL_MODE mode)
{
   return (mode == CONTROL_MODE_WEB_SYNC) ? "[🌐 WEB CONTROL]" : "[💻 MANUAL]";
}

#endif // __EM_WEB_CONTROL_MQH__
