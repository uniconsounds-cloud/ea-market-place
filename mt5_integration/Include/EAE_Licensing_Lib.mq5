//+------------------------------------------------------------------+
//|                                          EAE_Licensing_Lib.mq5   |
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//|                                             update : 2026.05.30  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, EAEZE Systems"
#property link      "https://eaeze.com"
#property version   "1.10"
#property strict
#property library

// --- Settings & Database Credentials ---
string InpLicenseUrl = "https://eaeze.com/api/verify-license";
string InpSyncUrl    = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data";
string InpSystemKey  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo";

const int LICENSE_REFRESH_INTERVAL = 43200;   // 12 hours
const int LICENSE_GRACE_PERIOD     = 172800;  // 48 hours
const int RETRY_COOLDOWN           = 120;     // 2 minutes

// --- Anti-Tampering Double-Ulong Union ---
union DoubleUlong {
   double d_val;
   ulong u_val;
};

// --- Calculate checksum hash (FNV-1a 64-bit) for F3 protection ---
ulong CalculateF3Checksum(long account, string product_id, double status, datetime check_time)
{
   string salt = "EAEZE_SECRET_SALT_2026_KHUCHAI";
   string data = IntegerToString(account) + "_" + product_id + "_" + DoubleToString(status, 2) + "_" + IntegerToString((long)check_time) + "_" + salt;
   
   ulong hash = 14695981039346656037ULL;
   int len = StringLen(data);
   for(int i = 0; i < len; i++) {
      hash = hash ^ data[i];
      hash = hash * 1099511628211ULL;
   }
   return hash;
}

// Internal warning display
void ShowLicenseAlert(string message) {
    string boxName = "EAEZE_Alert_BG";
    string txtName = "EAEZE_Alert_TXT";

    ObjectCreate(0, boxName, OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, boxName, OBJPROP_XDISTANCE, 100);
    ObjectSetInteger(0, boxName, OBJPROP_YDISTANCE, 100);
    ObjectSetInteger(0, boxName, OBJPROP_XSIZE, 900);
    ObjectSetInteger(0, boxName, OBJPROP_YSIZE, 90);
    ObjectSetInteger(0, boxName, OBJPROP_BGCOLOR, clrDarkRed);
    ObjectSetInteger(0, boxName, OBJPROP_CORNER, CORNER_LEFT_UPPER);

    ObjectCreate(0, txtName, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, txtName, OBJPROP_XDISTANCE, 160);
    ObjectSetInteger(0, txtName, OBJPROP_YDISTANCE, 130);
    ObjectSetInteger(0, txtName, OBJPROP_COLOR, clrWhite);
    ObjectSetString(0, txtName, OBJPROP_TEXT, "EAEZE: " + message);
    ObjectSetInteger(0, txtName, OBJPROP_FONTSIZE, 11);
    ObjectSetInteger(0, txtName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    
    ChartRedraw(0);
}

// --- Exported: Remove alert ---
void EaezeRemoveLicenseAlert() export {
    ObjectDelete(0, "EAEZE_Alert_BG");
    ObjectDelete(0, "EAEZE_Alert_TXT");
    ChartRedraw(0);
}

// --- Exported: Verify license status ---
bool EaezeCheckLicense(string product_id, string api_key = "KHUCHAI_SUPHAKORN", bool force_check = false) export {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    string time_var     = "EAEZE_T_" + account_no + "_" + product_id;
    string status_var   = "EAEZE_S_" + account_no + "_" + product_id;
    string attempt_var  = "EAEZE_A_" + account_no + "_" + product_id;
    string checksum_var = "EAEZE_C_" + account_no + "_" + product_id;
    
    datetime now = TimeLocal();
    
    // 1. Verify Cached Status with Signature Checksum to prevent F3 tampering
    if(!force_check && GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var) && GlobalVariableCheck(checksum_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        double cached_checksum = GlobalVariableGet(checksum_var);
        
        DoubleUlong check_union;
        check_union.d_val = cached_checksum;
        
        ulong calculated = CalculateF3Checksum(current_account, product_id, cached_status, last_check);
        if(check_union.u_val == calculated) {
            if(cached_status == 1.0 && (now - last_check) < LICENSE_REFRESH_INTERVAL) {
                Print("EAEZE: Valid cached license found & verified (checked ", now - last_check, "s ago). Account: ", account_no);
                EaezeRemoveLicenseAlert();
                return true;
            }
        } else {
            Print("EAEZE SECURITY WARNING: Cache tampering detected in Global Variables! (Account: ", account_no, ")");
            ShowLicenseAlert("Security Warning: Cache Tampering Detected!");
            return false;
        }
    }
    
    // 2. Prevent spamming the server if within retry cooldown
    if(!force_check && GlobalVariableCheck(attempt_var)) {
        datetime last_attempt = (datetime)GlobalVariableGet(attempt_var);
        if((now - last_attempt) < RETRY_COOLDOWN) {
            if(GlobalVariableCheck(status_var) && GlobalVariableCheck(checksum_var)) {
                double cached_status = GlobalVariableGet(status_var);
                double cached_checksum = GlobalVariableGet(checksum_var);
                datetime last_check = (datetime)GlobalVariableGet(time_var);
                
                DoubleUlong check_union;
                check_union.d_val = cached_checksum;
                ulong calculated = CalculateF3Checksum(current_account, product_id, cached_status, last_check);
                
                if(check_union.u_val == calculated && cached_status == 1.0 && (now - last_check) < LICENSE_GRACE_PERIOD) {
                    return true;
                }
            }
            Print("EAEZE: WebRequest rate-limited. Failing check.");
            return false;
        }
    }
    
    GlobalVariableSet(attempt_var, (double)now);
    
    Print("EAEZE: Performing license verification WebRequest...");
    
    char data[];
    char result[];
    string result_headers;
    
    string balance_str = DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);
    string post_data   = "{\"account_number\":\"" + account_no + "\", \"product_id\":\"" + product_id + "\", \"balance\":" + balance_str + "}";
    int len = StringToCharArray(post_data, data, 0, WHOLE_ARRAY, CP_UTF8);
    if (len > 0) ArrayResize(data, len - 1);
    
    string headers = "Content-Type: application/json\r\n" + "x-api-key: " + api_key + "\r\n";
    
    ResetLastError();
    int res = WebRequest("POST", InpLicenseUrl, headers, 2000, data, result, result_headers);
    
    if(res == -1) {
        int last_error = GetLastError();
        Print("EAEZE: Connection Error. Code: ", last_error);
        
        if(last_error == 4060 || last_error == 4014) {
            Print("EAEZE ERROR: Please enable 'Allow WebRequest' in Tools > Options > Expert Advisors");
            ShowLicenseAlert("Please enable 'Allow WebRequest' in Tools > Options");
            return false;
        }
        
        // Grace period fallback
        if(GlobalVariableCheck(status_var) && GlobalVariableCheck(checksum_var)) {
            double cached_status = GlobalVariableGet(status_var);
            double cached_checksum = GlobalVariableGet(checksum_var);
            datetime last_check = (datetime)GlobalVariableGet(time_var);
            
            DoubleUlong check_union;
            check_union.d_val = cached_checksum;
            ulong calculated = CalculateF3Checksum(current_account, product_id, cached_status, last_check);
            
            if(check_union.u_val == calculated && cached_status == 1.0 && (now - last_check) < LICENSE_GRACE_PERIOD) {
                Print("EAEZE: Server unreachable. Using cached license.");
                EaezeRemoveLicenseAlert();
                return true;
            }
        }
        
        ShowLicenseAlert("Connection Error: Server Unreachable");
        return false;
    }
    
    if(res == 200) {
        string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
        
        if(StringFind(response, "\"status\":\"active\"") >= 0) {
            Print("EAEZE: License verified for account ", account_no, " | Balance: ", balance_str);
            EaezeRemoveLicenseAlert();
            
            GlobalVariableSet(status_var, 1.0);
            GlobalVariableSet(time_var, (double)now);
            
            DoubleUlong sig_union;
            sig_union.u_val = CalculateF3Checksum(current_account, product_id, 1.0, now);
            GlobalVariableSet(checksum_var, sig_union.d_val);
            return true;
        }
        
        double fail_status = 3.0; // expired/invalid
        string fail_msg = "License Invalid or Expired for Account: " + account_no;
        
        if(StringFind(response, "\"status\":\"insufficient_balance\"") >= 0) {
             fail_status = 2.0;
             fail_msg = "Balance is too low for this EA. (Account: " + account_no + ")";
        }
        
        Print("EAEZE License Failed: ", response);
        ShowLicenseAlert(fail_msg);
        
        GlobalVariableSet(status_var, fail_status);
        GlobalVariableSet(time_var, (double)now);
        
        DoubleUlong sig_union;
        sig_union.u_val = CalculateF3Checksum(current_account, product_id, fail_status, now);
        GlobalVariableSet(checksum_var, sig_union.d_val);
        return false;
    }

    string error_msg = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
    Print("EAEZE: Server Error (", res, "): ", error_msg);
    
    if(GlobalVariableCheck(status_var) && GlobalVariableCheck(checksum_var)) {
        double cached_status = GlobalVariableGet(status_var);
        double cached_checksum = GlobalVariableGet(checksum_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        
        DoubleUlong check_union;
        check_union.d_val = cached_checksum;
        ulong calculated = CalculateF3Checksum(current_account, product_id, cached_status, last_check);
        
        if(check_union.u_val == calculated && cached_status == 1.0 && (now - last_check) < LICENSE_GRACE_PERIOD) {
            Print("EAEZE: Server returned error ", res, ". Using cached license.");
            EaezeRemoveLicenseAlert();
            return true;
        }
    }
    
    ShowLicenseAlert("Connection Error: " + IntegerToString(res));
    return false;
}

// --- Exported: Periodic checks ---
void EaezeCheckLicensePeriodic(string product_id, string api_key = "KHUCHAI_SUPHAKORN") export {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    string time_var     = "EAEZE_T_" + account_no + "_" + product_id;
    string status_var   = "EAEZE_S_" + account_no + "_" + product_id;
    string checksum_var = "EAEZE_C_" + account_no + "_" + product_id;
    
    datetime now = TimeLocal();
    
    if(GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var) && GlobalVariableCheck(checksum_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        double cached_checksum = GlobalVariableGet(checksum_var);
        
        DoubleUlong check_union;
        check_union.d_val = cached_checksum;
        ulong calculated = CalculateF3Checksum(current_account, product_id, cached_status, last_check);
        
        if(check_union.u_val != calculated) {
            Print("EAEZE: Periodic signature check failed (tampered). Removing EA.");
            ShowLicenseAlert("Security Warning: Cache Tampering Detected!");
            ExpertRemove();
            return;
        }
        
        if(cached_status == 1.0 && (now - last_check) < LICENSE_REFRESH_INTERVAL) {
            return;
        }
        
        if(cached_status > 1.0) {
            string alert_msg = "License Invalid or Expired";
            if(cached_status == 2.0) alert_msg = "Balance is too low for this EA.";
            Print("EAEZE: Periodic check failed (cached status: ", cached_status, "). Removing EA.");
            ShowLicenseAlert(alert_msg + " (Account: " + account_no + ")");
            ExpertRemove();
            return;
        }
    }
    
    if (!EaezeCheckLicense(product_id, api_key, false)) {
        Print("EAEZE: Periodic license verification failed. Removing EA.");
        ExpertRemove();
    }
}

// --- Position Scanning Helper for Web Sync ---
void EaezeScanPositions(long magic_buy, long magic_sell, 
                         int &buy_count, double &buy_lots, double &buy_pnl,
                         int &sell_count, double &sell_lots, double &sell_pnl)
{
   buy_count = 0; buy_lots = 0.0; buy_pnl = 0.0;
   sell_count = 0; sell_lots = 0.0; sell_pnl = 0.0;
   
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long type = PositionGetInteger(POSITION_TYPE);
         double lots = PositionGetDouble(POSITION_VOLUME);
         double pnl = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
         long magic = PositionGetInteger(POSITION_MAGIC);
         
         if(type == POSITION_TYPE_BUY)
         {
            if(magic_buy == 0 || magic == magic_buy)
            {
               buy_count++;
               buy_lots += lots;
               buy_pnl += pnl;
            }
         }
         else if(type == POSITION_TYPE_SELL)
         {
            if(magic_sell == 0 || magic == magic_sell)
            {
               sell_count++;
               sell_lots += lots;
               sell_pnl += pnl;
            }
         }
      }
   }
}

// --- Historical Daily Scanning Helper for Web Sync ---
double EaezeGetDailyMaxDrawdownPct()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(balance <= 0) return 0.0;
   
   double current_pnl = equity - balance;
   double current_dd_pct = (current_pnl < 0 ? MathAbs(current_pnl) / balance * 100.0 : 0.0);
   
   string gv_max_dd = "EAE_MaxDDPct_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string gv_date   = "EAE_LastDateVal_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   
   datetime today_start = (TimeCurrent() / 86400) * 86400;
   
   if(!GlobalVariableCheck(gv_date) || GlobalVariableGet(gv_date) != (double)today_start)
   {
      GlobalVariableSet(gv_max_dd, 0);
      GlobalVariableSet(gv_date, (double)today_start);
   }
   
   double max_dd = GlobalVariableGet(gv_max_dd);
   if(current_dd_pct > max_dd) {
      max_dd = current_dd_pct;
      GlobalVariableSet(gv_max_dd, max_dd);
   }
   return max_dd;
}

double EaezeScanTodayProfit(long magic_buy, long magic_sell, double &out_lots)
{
   datetime start = (TimeCurrent() / 86400) * 86400;
   datetime end   = start + 86399;
   double profit = 0.0;
   out_lots = 0.0;
   
   if(HistorySelect(start, end))
   {
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
            bool is_buy = (deal_type == DEAL_TYPE_SELL);
            bool is_sell = (deal_type == DEAL_TYPE_BUY);
            
            if(magic_buy == magic_sell) {
               if(magic_buy != 0 && (magic < magic_buy || magic >= magic_buy + 100)) continue;
            } else {
               if(is_buy && magic_buy != 0 && magic != magic_buy) continue;
               if(is_sell && magic_sell != 0 && magic != magic_sell) continue;
            }
            
            profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
            profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
            out_lots += HistoryDealGetDouble(ticket, DEAL_VOLUME);
         }
      }
   }
   return profit;
}

}

// --- Structure for Daily History summaries ---
struct EaezeDailySummary
{
   datetime date;
   long     account_login;
   double   max_dd_pct;
   double   total_profit;
   double   total_lots;
   int      buy_cycles;
   int      sell_cycles;
};

// --- Helper to scan history daily summary ---
bool EaezeScanHistoryDailySummary(datetime targetDay, long magic_buy, long magic_sell, EaezeDailySummary &out_sum)
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
         bool is_buy = (deal_type == DEAL_TYPE_SELL);
         bool is_sell = (deal_type == DEAL_TYPE_BUY);
         
         if(magic_buy == magic_sell) {
            if(magic_buy != 0 && (magic < magic_buy || magic >= magic_buy + 100)) continue;
         }
         else {
            if(is_buy) {
               if(magic_buy != 0 && magic != magic_buy) continue;
            }
            else if(is_sell) {
               if(magic_sell != 0 && magic != magic_sell) continue;
            }
         }
         
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         out_sum.total_profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
         out_sum.total_lots   += HistoryDealGetDouble(ticket, DEAL_VOLUME);
         
         string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
         if(StringFind(comment, "CLOSE") >= 0 || StringFind(comment, "LOK") >= 0 || StringFind(comment, "BRK") >= 0)
         {
            if(magic_buy == magic_sell) {
               if(magic >= magic_buy && magic < magic_buy + 100) {
                  out_sum.buy_cycles++;
               }
            }
            else {
               if(magic == magic_buy) out_sum.buy_cycles++;
               else if(magic == magic_sell) out_sum.sell_cycles++;
            }
         }
      }
   }
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance <= 0) balance = 1.0;
   string gv_max_dd = "EAE_MaxDDPct_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   out_sum.max_dd_pct = GlobalVariableCheck(gv_max_dd) ? GlobalVariableGet(gv_max_dd) : 0.0;
   
   return true;
}

// --- Push history batch to database ---
bool EaezeWebSyncPushHistoryBatch(int days_to_sync, long magic_buy, long magic_sell)
{
   if(days_to_sync <= 0) return false;
   if(days_to_sync > 30) days_to_sync = 30;
   
   datetime now = TimeCurrent();
   datetime today_start = (now / 86400) * 86400;
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   
   EaezeDailySummary summaries[];
   ArrayResize(summaries, days_to_sync);
   for(int i = 0; i < days_to_sync; i++)
   {
      ZeroMemory(summaries[i]);
      summaries[i].date          = today_start - (i * 86400);
      summaries[i].account_login = login;
      if(i == 0)
      {
         string gv_max_dd = "EAE_MaxDDPct_" + IntegerToString(login);
         summaries[i].max_dd_pct = GlobalVariableCheck(gv_max_dd) ? GlobalVariableGet(gv_max_dd) : 0.0;
      }
   }
   
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
            if(diff_sec < 0) continue;
            
            int idx = (int)(diff_sec / 86400);
            if(idx < 0 || idx >= days_to_sync) continue;
            
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            long deal_type = HistoryDealGetInteger(ticket, DEAL_TYPE);
            bool is_buy = (deal_type == DEAL_TYPE_SELL);
            bool is_sell = (deal_type == DEAL_TYPE_BUY);
            
            if(magic_buy == magic_sell) {
               if(magic_buy != 0 && (magic < magic_buy || magic >= magic_buy + 100)) continue;
            }
            else {
               if(is_buy) {
                  if(magic_buy != 0 && magic != magic_buy) continue;
               }
               else if(is_sell) {
                  if(magic_sell != 0 && magic != magic_sell) continue;
               }
            }
            
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            summaries[idx].total_profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
            summaries[idx].total_lots   += HistoryDealGetDouble(ticket, DEAL_VOLUME);
         }
      }
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
   payload += "\"p_api_key\":\"LICENSE_AUTO\"";
   payload += "}";

   char data[]; char result[]; string result_headers;
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   
   string url = "https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_history_batch";
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + InpSystemKey + "\r\n" +
                    "Authorization: Bearer " + InpSystemKey + "\r\n";
                    
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, data, result, result_headers);
   
   if(res == 200) {
      string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      if(StringFind(response, "\"success\":false") < 0 && StringFind(response, "\"success\": false") < 0) {
         Print("EAEZE History Sync: Successfully pushed ", days_to_sync, " days of history. Response: ", response);
         return true;
      }
   }
   Print("EAEZE History Sync: Failed to push batch history. Code: ", res);
   return false;
}

// --- Self-healing history sync check ---
void EaezeWebSyncCheckAndPushHistory(long magic_buy, long magic_sell)
{
   static bool local_history_checked = false;
   if(local_history_checked) return;
   
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string gv_last_history = "EAE_LastHistorySync_" + IntegerToString(login);
   int days_to_sync = 30; // Default: Sync last 30 days on new boot
   
   if(GlobalVariableCheck(gv_last_history))
   {
      datetime last_sync = (datetime)GlobalVariableGet(gv_last_history);
      datetime now = TimeCurrent();
      int diff_sec = (int)(now - last_sync);
      
      if(diff_sec > 0) {
         days_to_sync = (diff_sec / 86400) + 1; // Round up
      } else {
         days_to_sync = 0;
      }
   }
   
   if(days_to_sync > 0)
   {
      if(days_to_sync > 30) days_to_sync = 30;
      Print("EAEZE History Sync: Boot-up Self-Healing triggered. Checking missing days: ", days_to_sync);
      if(EaezeWebSyncPushHistoryBatch(days_to_sync, magic_buy, magic_sell))
      {
         GlobalVariableSet(gv_last_history, (double)TimeCurrent());
      }
   }
   else
   {
      Print("EAEZE History Sync: History is up to date.");
   }
   
   local_history_checked = true;
}

// --- Exported: Unified check and sync ---
void EaezeCheckLicenseAndSync(string product_id, string system_code, string ea_version, int sync_interval_sec, long magic_buy = 0, long magic_sell = 0) export
{
   // 1. Perform licensing check (will call ExpertRemove if failed)
   EaezeCheckLicensePeriodic(product_id, "KHUCHAI_SUPHAKORN");
   
   // --- [NEW] Self-Healing 30-Day Sync Check ---
   EaezeWebSyncCheckAndPushHistory(magic_buy, magic_sell);
   
   // 2. Perform the lightweight sync (Smart Sleep/Wake)
   static datetime last_sync_time = 0;
   static bool full_sync_mode = true;
   static int active_sync_interval = 0;
   if(active_sync_interval <= 0) {
      active_sync_interval = sync_interval_sec;
   }
   
   datetime now = TimeCurrent();
   
   int current_interval = active_sync_interval;
   if(!full_sync_mode) {
      current_interval = 10; // Sleep mode: sync only once every 10 seconds
   }
   
   if(last_sync_time > 0 && (int)(now - last_sync_time) < current_interval) {
      return;
   }
   
   last_sync_time = now;
   
   // Gather data
   int buy_count = 0, sell_count = 0;
   double buy_lots = 0.0, buy_pnl = 0.0, sell_lots = 0.0, sell_pnl = 0.0;
   EaezeScanPositions(magic_buy, magic_sell, buy_count, buy_lots, buy_pnl, sell_count, sell_lots, sell_pnl);
   
   double today_closed_lots = 0.0;
   double today_profit = EaezeScanTodayProfit(magic_buy, magic_sell, today_closed_lots);
   double max_dd_pct = EaezeGetDailyMaxDrawdownPct();
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin  = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   
   // Auto-detect asset family (product_family / asset_type) based on symbol
   string chart_sym = _Symbol;
   StringToUpper(chart_sym);
   string prod_fam = "FOREX";
   if(StringFind(chart_sym, "XAU") >= 0 || StringFind(chart_sym, "GOLD") >= 0 || StringFind(chart_sym, "XAG") >= 0 || StringFind(chart_sym, "SILVER") >= 0) {
      prod_fam = "GOLD";
   } else if(StringFind(chart_sym, "BTC") >= 0 || StringFind(chart_sym, "ETH") >= 0 || StringFind(chart_sym, "XRP") >= 0 || StringFind(chart_sym, "LTC") >= 0 || StringFind(chart_sym, "CRYPTO") >= 0) {
      prod_fam = "CRYPTO";
   }

   // Build Simple Payload
   string payload = "{ \"p_payload\": {";
   payload += "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   payload += "\"server_time\":" + IntegerToString(now) + ",";
   payload += "\"ping_only\":" + (full_sync_mode ? "false" : "true") + ",";
   payload += "\"today_profit\":" + DoubleToString(today_profit, 2) + ",";
   payload += "\"today_closed_lots\":" + DoubleToString(today_closed_lots, 2) + ",";
   payload += "\"daily_max_drawdown\":" + DoubleToString(max_dd_pct, 2) + ",";
   
   payload += "\"snapshot\":{";
   payload += "\"account\":{\"balance\":" + DoubleToString(balance, 2) + ",\"equity\":" + DoubleToString(equity, 2) + ",\"margin_level\":" + DoubleToString(margin, 2) + ",\"currency\":\"" + currency + "\"},";
   payload += "\"buy_state\":{\"open_count\":" + IntegerToString(buy_count) + ",\"open_lots\":" + DoubleToString(buy_lots, 2) + ",\"floating_pnl\":" + DoubleToString(buy_pnl, 2) + "},";
   payload += "\"sell_state\":{\"open_count\":" + IntegerToString(sell_count) + ",\"open_lots\":" + DoubleToString(sell_lots, 2) + ",\"floating_pnl\":" + DoubleToString(sell_pnl, 2) + "},";
   payload += "\"identity\":{\"product_family\":\"" + prod_fam + "\",\"system_code\":\"" + system_code + "\",\"ea_version\":\"" + ea_version + "\"}";
   payload += "},";
   
   payload += "\"orders\":[]"; // Keep order logs empty for simple light sync
   payload += "}, \"p_api_key\":\"LICENSE_AUTO\" }";
   
   // Send WebRequest to Supabase
   char data[]; char result[]; string result_headers;
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);
   
   string headers = "Content-Type: application/json\r\n" + 
                    "apikey: " + InpSystemKey + "\r\n" +
                    "Authorization: Bearer " + InpSystemKey + "\r\n";
   
   ResetLastError();
   int res = WebRequest("POST", InpSyncUrl, headers, 2000, data, result, result_headers);
   
   if(res == 200) {
      string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      
      // Smart sleep/wake parsing
      if(StringFind(response, "\"should_sync_full\":true") >= 0 || StringFind(response, "\"should_sync_full\": true") >= 0) {
         if(!full_sync_mode) {
            last_sync_time = 0; // Trigger sync immediately on next tick!
         }
         full_sync_mode = true;
      } else {
         full_sync_mode = false;
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
            active_sync_interval = (int)StringToInteger(StringSubstr(response, start, end - start));
         }
      }
   }
}
