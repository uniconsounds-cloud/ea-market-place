//+------------------------------------------------------------------+
//|                                          EAEZE_Licensing_Lib.mq5 |
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, EAEZE Systems"
#property link      "https://eaeze.com"
#property version   "1.00"
#property strict
#property library

// Settings
string InpLicenseUrl = "https://eaeze.com/api/verify-license";

const int LICENSE_REFRESH_INTERVAL = 43200;   // 12 hours
const int LICENSE_GRACE_PERIOD     = 172800;  // 48 hours
const int RETRY_COOLDOWN           = 120;     // 2 minutes

// Internal alert display functions (not exported)
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

// Exported Functions
void EaezeRemoveLicenseAlert() export {
    ObjectDelete(0, "EAEZE_Alert_BG");
    ObjectDelete(0, "EAEZE_Alert_TXT");
    ChartRedraw(0);
}

bool EaezeCheckLicense(string product_id, string api_key = "KHUCHAI_SUPHAKORN", bool force_check = false) export {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    // Construct Global Variable Names
    string time_var    = "EAEZE_T_" + account_no + "_" + product_id;
    string status_var  = "EAEZE_S_" + account_no + "_" + product_id;
    string attempt_var = "EAEZE_A_" + account_no + "_" + product_id;
    
    datetime now = TimeLocal();
    
    // 1. Check cached status (under 12 hours old)
    if(!force_check && GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        
        if(cached_status == 1.0 && (now - last_check) < LICENSE_REFRESH_INTERVAL) {
            Print("EAEZE: Valid cached license found (checked ", now - last_check, "s ago). Account: ", account_no);
            EaezeRemoveLicenseAlert();
            return true;
        }
    }
    
    // 2. Prevent spamming the server if within retry cooldown
    if(!force_check && GlobalVariableCheck(attempt_var)) {
        datetime last_attempt = (datetime)GlobalVariableGet(attempt_var);
        if((now - last_attempt) < RETRY_COOLDOWN) {
            if(GlobalVariableCheck(status_var)) {
                double cached_status = GlobalVariableGet(status_var);
                if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
                    datetime last_check = (datetime)GlobalVariableGet(time_var);
                    if((now - last_check) < LICENSE_GRACE_PERIOD) {
                        return true;
                    }
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
        if(GlobalVariableCheck(status_var)) {
            double cached_status = GlobalVariableGet(status_var);
            if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
                datetime last_check = (datetime)GlobalVariableGet(time_var);
                if((now - last_check) < LICENSE_GRACE_PERIOD) {
                    Print("EAEZE: Server unreachable. Using cached license.");
                    EaezeRemoveLicenseAlert();
                    return true;
                }
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
            return true;
        }
        
        if(StringFind(response, "\"status\":\"insufficient_balance\"") >= 0) {
             Print("EAEZE License Failed (Balance): ", response);
             ShowLicenseAlert("Balance is too low for this EA. (Account: " + account_no + ")");
             GlobalVariableSet(status_var, 2.0);
             GlobalVariableSet(time_var, (double)now);
             return false;
        }

        if(StringFind(response, "\"status\":\"invalid\"") >= 0 || StringFind(response, "\"status\":\"expired\"") >= 0) {
             Print("EAEZE License Failed: ", response);
             ShowLicenseAlert("License Invalid or Expired for Account: " + account_no);
             GlobalVariableSet(status_var, 3.0);
             GlobalVariableSet(time_var, (double)now);
             return false;
        }
    }

    string error_msg = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
    Print("EAEZE: Server Error (", res, "): ", error_msg);
    
    if(GlobalVariableCheck(status_var)) {
        double cached_status = GlobalVariableGet(status_var);
        if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
            datetime last_check = (datetime)GlobalVariableGet(time_var);
            if((now - last_check) < LICENSE_GRACE_PERIOD) {
                Print("EAEZE: Server returned error ", res, ". Using cached license.");
                EaezeRemoveLicenseAlert();
                return true;
            }
        }
    }
    
    ShowLicenseAlert("Connection Error: " + IntegerToString(res));
    return false;
}

void EaezeCheckLicensePeriodic(string product_id, string api_key = "KHUCHAI_SUPHAKORN") export {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    string time_var   = "EAEZE_T_" + account_no + "_" + product_id;
    string status_var = "EAEZE_S_" + account_no + "_" + product_id;
    
    datetime now = TimeLocal();
    
    if(GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        
        if(cached_status == 1.0 && (now - last_check) < LICENSE_REFRESH_INTERVAL) {
            return;
        }
        
        if(cached_status > 1.0) {
            string alert_msg = "License Invalid or Expired";
            if(cached_status == 2.0) alert_msg = "Balance is too low for this EA.";
            Print("EAEZE: Periodic check failed. Removing EA from chart.");
            ShowLicenseAlert(alert_msg + " (Account: " + account_no + ")");
            ExpertRemove();
            return;
        }
    }
    
    if (!EaezeCheckLicense(product_id, api_key, false)) {
        Print("EAEZE: Periodic license verification failed. Removing EA from chart.");
        ExpertRemove();
    }
}
