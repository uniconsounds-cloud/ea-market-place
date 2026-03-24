//+------------------------------------------------------------------+
//|                                              EAEZE_Licensing.mqh |
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//|                                             update : 25 March 2026 |
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
            //--- Check every 15 minutes ---
            CheckEaezeLicensePeriodic(); // license check (every 15 minutes)
            if(!G_IsLicenseVerified) return; // if license is not verified, stop working
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
//+------------------------------------------------------------------+
// --- 1. SETTINGS & INPUTS ---
string InpLicenseUrl = "https://eaeze.com/api/verify-license";
string InpProductID  = "EZM-5P-V1";    // < ==== Product ID ==== [1]
string InpApiKey     = "KHUCHAI_SUPHAKORN";

// --- 2. INTERNAL STATE ---
bool G_IsLicenseVerified = false; // Global Flag to check in main EA code
datetime last_license_check = 0;
const int license_check_interval = 900; // 15 minutes (900 seconds)

// --- 3. LICENSE CHECK LOGIC ---
bool CheckEaezeLicense() {
    G_IsLicenseVerified = false; // Reset before check
    char data[];
    char result[];
    string result_headers;
    
    string account_no = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    string balance_str = DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);
    
    string post_data  = "{\"account_number\":\"" + account_no + "\", \"product_id\":\"" + InpProductID + "\", \"balance\":" + balance_str + "}";
    int len = StringToCharArray(post_data, data, 0, WHOLE_ARRAY, CP_UTF8);
    if (len > 0) ArrayResize(data, len - 1);
    
    string headers = "Content-Type: application/json\r\n" + "x-api-key: " + InpApiKey + "\r\n";
    
    ResetLastError();
    int res = WebRequest("POST", InpLicenseUrl, headers, 10000, data, result, result_headers);
    
    // Check if WebRequest is NOT allowed (Error 4060)
    if(res == -1) {
        int last_error = GetLastError();
        if(last_error == 4060 || last_error == 4014) {
            Print("EAEZE ERROR: Please enable 'Allow WebRequest' in Tools > Options > Expert Advisors");
            ShowLicenseAlert("Please enable 'Allow WebRequest' in Tools > Options");
        } else {
            Print("EAEZE: Connection Error. Code: ", last_error);
        }
        return false;
    }
    
    if(res == 200) {
        string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
        
        if(StringFind(response, "\"status\":\"active\"") >= 0) {
            Print("EAEZE: License verified for account ", account_no, " | Balance: ", balance_str);
            G_IsLicenseVerified = true;
            RemoveLicenseAlert();
            return true;
        }
        
        if(StringFind(response, "\"status\":\"insufficient_balance\"") >= 0) {
             Print("EAEZE License Failed (Balance): ", response);
             ShowLicenseAlert("Balance is too low for this EA. (Account: " + account_no + ")");
             return false;
        }

        if(StringFind(response, "\"status\":\"invalid\"") >= 0 || StringFind(response, "\"status\":\"expired\"") >= 0) {
             Print("EAEZE License Failed: ", response);
             ShowLicenseAlert("License Invalid or Expired for Account: " + account_no);
             return false;
        }
    }

    string error_msg = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
    Print("EAEZE: Server Error (", res, "): ", error_msg);
    ShowLicenseAlert("Connection Error: " + IntegerToString(res));
    return false;
}

// Periodic check to be called in OnTick or OnTimer
void CheckEaezeLicensePeriodic() {
    datetime now = TimeCurrent();
    
    // Initial check at startup or every 15 minutes
    if (last_license_check == 0 || (now - last_license_check) >= license_check_interval) {
        last_license_check = now;
        
        Print("EAEZE: Performing periodic license check...");
        CheckEaezeLicense(); // Just update the G_IsLicenseVerified flag. 
        // We don't call ExpertRemove() anymore to allow Auto-Resume.
    }
}

// --- 3. UI NOTIFICATION ---
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

// --- 4. MANDATORY FUNCTIONS (For .mq5 files) ---
// If you save as .mqh, you can remove these functions.
/*============================================
int OnInit() {
    //-------- Copy Start Here ----------
    if(!CheckEaezeLicense()) {
        return(INIT_FAILED);
    }
    RemoveLicenseAlert();
    //------------ End Here --------------
    //.......................    already Code
    return(INIT_SUCCEEDED);   // at the end. if none.
}

void OnTick() {
   //--- Check every 15 minutes ---
   CheckEaezeLicensePeriodic(); // license check (every 15 minutes)
   if(!G_IsLicenseVerified) return; // if license is not verified, stop working
   
   //... already EA code ...
}

void OnDeinit(const int reason) {
    //-------- Copy Start Here ----------
    if(reason != REASON_INITFAILED) {
        RemoveLicenseAlert();
    }
    //------------ End Here --------------
    //.......................    already Code
}

=============================================*/
