//+------------------------------------------------------------------+
//|                                              EAEZE_Licensing.mqh |
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//|                                             update : 21 May 2026  |
//+------------------------------------------------------------------+
/*
============== Doing 5 Steps to Make EA Product Complete ==============
   [1] on this code : Change Product ID
   [2] on EA Product : insert Code at Top line
         #include <EAEZE_Licensing.mqh>
   [3] on EA Product : insert Code at > Oninit <
         int OnInit() {
             //----------- Copy Start Here --------------
             if(!CheckEaezeLicense()) {
                 return(INIT_FAILED);
             }
             RemoveLicenseAlert();
             //----------- Copy End Here ----------------
             //.......................    already Code
             return(INIT_SUCCEEDED);   // at the end. if none.
          }      
   [4] void OnTick() {
             //--- Check cached license (non-blocking) ---
             CheckEaezeLicensePeriodic(); 
             //... already EA code ...
             }
         
   [5] on EA Product : insert Code at > OnDeinit <
         void OnDeinit(const int reason) {
             //----------- Copy Start Here --------------
             if(reason != REASON_INITFAILED) {
                 RemoveLicenseAlert();
             }
             //----------- Copy End Here ----------------
             //.......................    already Code
         }
*/

// --- 1. SETTINGS & INPUTS ---
string InpLicenseUrl = "https://eaeze.com/api/verify-license";
#ifndef EA_PRODUCT_ID
   #define EA_PRODUCT_ID "EZM-5P-V1"
#endif
string InpProductID  = EA_PRODUCT_ID;
string InpApiKey     = "KHUCHAI_SUPHAKORN";

// --- 2. INTERNAL STATE & CONSTANTS ---
datetime last_license_check = 0;              // Kept for backward compatibility
const int license_check_interval = 900;       // Kept for backward compatibility

const int LICENSE_REFRESH_INTERVAL = 43200;   // 12 hours (43200 seconds)
const int LICENSE_GRACE_PERIOD     = 172800;  // 48 hours (172800 seconds)
const int RETRY_COOLDOWN           = 120;     // 2 minutes (120 seconds) before retrying failed WebRequest

// --- 3. LICENSE CHECK LOGIC ---

// Main verification function (callable with optional force parameter)
bool CheckEaezeLicense(bool force_check = false) {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    // Construct Global Variable Names
    string time_var    = "EAEZE_T_" + account_no + "_" + InpProductID;
    string status_var  = "EAEZE_S_" + account_no + "_" + InpProductID;
    string attempt_var = "EAEZE_A_" + account_no + "_" + InpProductID;
    
    datetime now = TimeLocal();
    
    // 1. If not forcing a check, see if we have a valid, recent cached status (under 12 hours old)
    if(!force_check && GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        
        if(cached_status == 1.0 && (now - last_check) < LICENSE_REFRESH_INTERVAL) {
            Print("EAEZE: Valid cached license found (checked ", now - last_check, "s ago). Account: ", account_no);
            RemoveLicenseAlert();
            return true;
        }
    }
    
    // 2. If we are not forcing, prevent spamming the server if the last WebRequest attempt was less than 1 hour ago
    if(!force_check && GlobalVariableCheck(attempt_var)) {
        datetime last_attempt = (datetime)GlobalVariableGet(attempt_var);
        if((now - last_attempt) < RETRY_COOLDOWN) {
            // Check if we can use the cached active status under the 48-hour grace period
            if(GlobalVariableCheck(status_var)) {
                double cached_status = GlobalVariableGet(status_var);
                if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
                    datetime last_check = (datetime)GlobalVariableGet(time_var);
                    if((now - last_check) < LICENSE_GRACE_PERIOD) {
                        return true;
                    }
                }
            }
            Print("EAEZE: WebRequest rate-limited (last attempt ", (int)(now - last_attempt), "s ago). Failing check.");
            return false;
        }
    }
    
    // Record this attempt timestamp to enforce retry cooldown
    GlobalVariableSet(attempt_var, (double)now);
    
    Print("EAEZE: Performing license verification WebRequest...");
    
    char data[];
    char result[];
    string result_headers;
    
    string balance_str = DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);
    string post_data   = "{\"account_number\":\"" + account_no + "\", \"product_id\":\"" + InpProductID + "\", \"balance\":" + balance_str + "}";
    int len = StringToCharArray(post_data, data, 0, WHOLE_ARRAY, CP_UTF8);
    if (len > 0) ArrayResize(data, len - 1);
    
    string headers = "Content-Type: application/json\r\n" + "x-api-key: " + InpApiKey + "\r\n";
    
    ResetLastError();
    // Timeout set to 2000ms (2s) to prevent locking up tick processing thread
    int res = WebRequest("POST", InpLicenseUrl, headers, 2000, data, result, result_headers);
    
    // Check if WebRequest is NOT allowed (Error 4060/4014) or failed
    if(res == -1) {
        int last_error = GetLastError();
        Print("EAEZE: Connection Error. Code: ", last_error);
        
        if(last_error == 4060 || last_error == 4014) {
            Print("EAEZE ERROR: Please enable 'Allow WebRequest' in Tools > Options > Expert Advisors");
            ShowLicenseAlert("Please enable 'Allow WebRequest' in Tools > Options");
            return false;
        }
        
        // Handle network outage grace period (48 hours)
        if(GlobalVariableCheck(status_var)) {
            double cached_status = GlobalVariableGet(status_var);
            if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
                datetime last_check = (datetime)GlobalVariableGet(time_var);
                if((now - last_check) < LICENSE_GRACE_PERIOD) {
                    Print("EAEZE: Server unreachable. Using cached license (grace period expires in ", (LICENSE_GRACE_PERIOD - (now - last_check)) / 3600, " hours).");
                    RemoveLicenseAlert();
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
            RemoveLicenseAlert();
            
            // Update cache to ACTIVE
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

    // HTTP response other than 200 (server side issue)
    string error_msg = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
    Print("EAEZE: Server Error (", res, "): ", error_msg);
    
    // Handle server error grace period (48 hours)
    if(GlobalVariableCheck(status_var)) {
        double cached_status = GlobalVariableGet(status_var);
        if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
            datetime last_check = (datetime)GlobalVariableGet(time_var);
            if((now - last_check) < LICENSE_GRACE_PERIOD) {
                Print("EAEZE: Server returned error ", res, ". Using cached license under grace period.");
                RemoveLicenseAlert();
                return true;
            }
        }
    }
    
    ShowLicenseAlert("Connection Error: " + IntegerToString(res));
    return false;
}

// Periodic check called inside OnTick()
void CheckEaezeLicensePeriodic() {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    // Construct Global Variable Names
    string time_var   = "EAEZE_T_" + account_no + "_" + InpProductID;
    string status_var = "EAEZE_S_" + account_no + "_" + InpProductID;
    
    datetime now = TimeLocal();
    
    // Check if cache exists
    if(GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        
        // 1. If cache status is ACTIVE and less than 12 hours old, do nothing and return.
        if(cached_status == 1.0 && (now - last_check) < LICENSE_REFRESH_INTERVAL) {
            return;
        }
        
        // 2. If cached status is EXPLICITLY INVALID/EXPIRED/INSUFFICIENT BALANCE, remove the EA immediately.
        if(cached_status > 1.0) {
            string alert_msg = "License Invalid or Expired";
            if(cached_status == 2.0) alert_msg = "Balance is too low for this EA.";
            Print("EAEZE: Periodic check failed (cached status: ", cached_status, "). Removing EA from chart.");
            ShowLicenseAlert(alert_msg + " (Account: " + account_no + ")");
            ExpertRemove();
            return;
        }
    }
    
    // 3. Cache is older than 12 hours (or doesn't exist). Perform WebRequest.
    if (!CheckEaezeLicense(false)) {
        Print("EAEZE: Periodic license verification failed. Removing EA from chart.");
        ExpertRemove();
    }
}

// --- 4. UI NOTIFICATION ---
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

void RemoveLicenseAlert() {
    ObjectDelete(0, "EAEZE_Alert_BG");
    ObjectDelete(0, "EAEZE_Alert_TXT");
    ChartRedraw(0);
}
