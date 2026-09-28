//+------------------------------------------------------------------+
//|                                          EAEZE_Licensing_v200.mqh|
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//|                                            Release Version: 2.00 |
//+------------------------------------------------------------------+
//| [บันทึกการแก้ไข / CHANGELOG - Version 2.00 (Single URL 3-Tier Engine)]:
//| 1. ระบบ 1 WebRequest อัจฉริยะ (Single URL Whitelist):
//|    - ใน MT5 Options ช่อง Allow WebRequest ให้ใส่เพียง: https://eaeze.com
//|    - รองรับการทำงานทุก Tier ภายใต้โดเมนเดียว ไม่ต้องใส่ URL ที่สองอีกต่อไป
//| 2. โครงสร้าง 3 Tiers เต็มรูปแบบ:
//|    - Tier 1 (ตรวจสิทธิ์ 12 ชม. & Init): ส่งเลขพอร์ต, ทุน, Equity, กำไรวันนี้,
//|      เวอร์ชัน v2.00, คู่เงิน เพื่อให้หน้าแดชบอร์ดมีข้อมูลตั้งแต่เปิด EA ทันที
//|    - Tier 2 (Smart Ping ทุก 3 นาที): ส่ง Heartbeat ทุน, Equity, Drawdown,
//|      Floating PnL, จำนวนไม้รวม เพื่อให้ Fleet Status Matrix เขียวสดและถูกต้อง
//|    - Tier 3 (Farm Live Stream ทุก 20 วิ): ทำงานอัตโนมัติเฉพาะตอนมีคนเปิดดู
//|      หน้าเว็บฟาร์มของพอร์ตนี้บน eaeze.com และสลับกลับไปโหมดหลับ (3 นาที)
//|      ทันทีเมื่อปิดหน้าเว็บ
//| 3. ป้องกันปัญหาพอร์ตทุนเป็น 0 จากรุ่นเดิม และรองรับทั้งพอร์ตที่ดูฟาร์ม
//|    และพอร์ตของลูกค้าที่ไม่ดูหน้าฟาร์มอย่างสมบูรณ์แบบ
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, EAEZE Systems"
#property link      "https://eaeze.com"
#property version   "2.00"
#property strict

// --- 1. SETTINGS & INPUTS ---
#ifndef EA_PRODUCT_ID
   #define EA_PRODUCT_ID "EZM-MAX-V1"
#endif

string InpLicenseUrl = "https://eaeze.com/api/verify-license";
string InpSyncUrl    = "https://eaeze.com/api/sync-dashboard";
string InpProductID  = EA_PRODUCT_ID;
string InpApiKey     = "KHUCHAI_SUPHAKORN";
string InpEaVersion  = "v2.00";

// --- 2. INTERNAL STATE & CONSTANTS ---
const int LICENSE_REFRESH_INTERVAL = 43200;   // 12 hours (43200 seconds)
const int LICENSE_GRACE_PERIOD     = 172800;  // 48 hours (172800 seconds)
const int RETRY_COOLDOWN           = 60;      // 1 minute before retrying failed WebRequest

const int SMART_PING_INTERVAL_SLEEP = 180;    // 3 minutes (180s) when no active viewer
const int SMART_PING_INTERVAL_LIVE  = 20;     // 20 seconds when viewer is active on web

static bool g_full_sync_mode = false;
static uint g_last_telemetry_ticks = 0;

// --- 3. TELEMETRY SCANNING HELPERS ---

// Helper to calculate exact closed profit for today from MT5 history deals
double GetEaezeTodayClosedProfit() {
    MqlDateTime mdt;
    TimeToStruct(TimeCurrent(), mdt);
    mdt.hour = 0; mdt.min = 0; mdt.sec = 0;
    datetime day_start = StructToTime(mdt);
    
    if(!HistorySelect(day_start, TimeCurrent())) return 0.0;
    
    double profit = 0.0;
    int total = HistoryDealsTotal();
    for(int i = 0; i < total; i++) {
        ulong ticket = HistoryDealGetTicket(i);
        if(ticket > 0) {
            long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT || entry == DEAL_ENTRY_OUT_BY) {
                profit += HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_SWAP) + HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            }
        }
    }
    return profit;
}

// Helper to scan live open positions
void ScanEaezeOpenPositions(int &buy_count, double &buy_lots, double &buy_pnl,
                            int &sell_count, double &sell_lots, double &sell_pnl) {
    buy_count = 0; buy_lots = 0.0; buy_pnl = 0.0;
    sell_count = 0; sell_lots = 0.0; sell_pnl = 0.0;
    
    int total = PositionsTotal();
    for(int i = 0; i < total; i++) {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0 && PositionSelectByTicket(ticket)) {
            long type = PositionGetInteger(POSITION_TYPE);
            double lots = PositionGetDouble(POSITION_VOLUME);
            double pnl = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
            
            if(type == POSITION_TYPE_BUY) {
                buy_count++;
                buy_lots += lots;
                buy_pnl += pnl;
            } else if(type == POSITION_TYPE_SELL) {
                sell_count++;
                sell_lots += lots;
                sell_pnl += pnl;
            }
        }
    }
}

// Helper to calculate daily max drawdown percentage
double GetEaezeDailyMaxDrawdownPct() {
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    if(balance <= 0) return 0.0;
    
    double current_pnl = equity - balance;
    double current_dd_pct = (current_pnl < 0 ? MathAbs(current_pnl) / balance * 100.0 : 0.0);
    
    string gv_max_dd = "EAE_MaxDDPct_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    string gv_date   = "EAE_LastDateVal_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    
    datetime today_start = (TimeCurrent() / 86400) * 86400;
    
    if(!GlobalVariableCheck(gv_date) || GlobalVariableGet(gv_date) != (double)today_start) {
        GlobalVariableSet(gv_max_dd, current_dd_pct);
        GlobalVariableSet(gv_date, (double)today_start);
    }
    
    double max_dd = GlobalVariableGet(gv_max_dd);
    if(current_dd_pct > max_dd) {
        max_dd = current_dd_pct;
        GlobalVariableSet(gv_max_dd, max_dd);
    }
    return max_dd;
}

// Helper to detect asset family (Forex vs Gold vs Crypto)
string GetEaezeAssetFamily() {
    string chart_sym = _Symbol;
    StringToUpper(chart_sym);
    if(StringFind(chart_sym, "XAU") >= 0 || StringFind(chart_sym, "GOLD") >= 0 || StringFind(chart_sym, "XAG") >= 0) {
        return "GOLD";
    }
    if(StringFind(chart_sym, "BTC") >= 0 || StringFind(chart_sym, "ETH") >= 0 || StringFind(chart_sym, "CRYPTO") >= 0) {
        return "CRYPTO";
    }
    return "FOREX";
}

// --- 4. TIER 1: CORE LICENSE VERIFICATION (Every 12h or Init) ---
bool CheckEaezeLicense(bool force_check = false) {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    string time_var    = "EAEZE_T_" + account_no + "_" + InpProductID;
    string status_var  = "EAEZE_S_" + account_no + "_" + InpProductID;
    string attempt_var = "EAEZE_A_" + account_no + "_" + InpProductID;
    
    datetime now = TimeLocal();
    
    // 1. Cached validation (under 12 hours)
    if(!force_check && GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        
        if(cached_status == 1.0 && (now - last_check) < LICENSE_REFRESH_INTERVAL) {
            RemoveLicenseAlert();
            return true;
        }
    }
    
    // 2. Retry rate limit
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
            return false;
        }
    }
    
    GlobalVariableSet(attempt_var, (double)now);
    
    char data[];
    char result[];
    string result_headers;
    
    string balance_str = DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);
    string equity_str  = DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2);
    string profit_str  = DoubleToString(GetEaezeTodayClosedProfit(), 2);
    
    string post_data = "{"
        + "\"account_number\":\"" + account_no + "\","
        + "\"product_id\":\"" + InpProductID + "\","
        + "\"ea_version\":\"" + InpEaVersion + "\","
        + "\"tier_engine\":\"3_tier\","
        + "\"symbol\":\"" + _Symbol + "\","
        + "\"balance\":" + balance_str + ","
        + "\"equity\":" + equity_str + ","
        + "\"today_profit\":" + profit_str
        + "}";
        
    int len = StringToCharArray(post_data, data, 0, WHOLE_ARRAY, CP_UTF8);
    if (len > 0) ArrayResize(data, len - 1);
    
    string headers = "Content-Type: application/json\r\n" + "x-api-key: " + InpApiKey + "\r\n";
    
    ResetLastError();
    int res = WebRequest("POST", InpLicenseUrl, headers, 10000, data, result, result_headers);
    
    if(res == -1) {
        int last_error = GetLastError();
        Print("EAEZE [v2.00]: Connection Error. Code: ", last_error);
        
        if(last_error == 4060 || last_error == 4014) {
            Print("EAEZE ERROR: Please add 'https://eaeze.com' to Allow WebRequest in Tools > Options > Expert Advisors");
            ShowLicenseAlert("Please add https://eaeze.com to MT5 WebRequest Options");
            return false;
        }
        
        if(GlobalVariableCheck(status_var)) {
            double cached_status = GlobalVariableGet(status_var);
            if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
                datetime last_check = (datetime)GlobalVariableGet(time_var);
                if((now - last_check) < LICENSE_GRACE_PERIOD) {
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
            Print("EAEZE [v2.00]: License verified for account ", account_no, " | Balance: ", balance_str);
            RemoveLicenseAlert();
            GlobalVariableSet(status_var, 1.0);
            GlobalVariableSet(time_var, (double)now);
            return true;
        }
        
        if(StringFind(response, "\"status\":\"insufficient_balance\"") >= 0) {
             ShowLicenseAlert("Balance is too low for this EA. (Account: " + account_no + ")");
             GlobalVariableSet(status_var, 2.0);
             GlobalVariableSet(time_var, (double)now);
             return false;
        }

        if(StringFind(response, "\"status\":\"invalid\"") >= 0 || StringFind(response, "\"status\":\"expired\"") >= 0) {
             ShowLicenseAlert("License Invalid or Expired for Account: " + account_no);
             GlobalVariableSet(status_var, 3.0);
             GlobalVariableSet(time_var, (double)now);
             return false;
        }
    }

    string error_msg = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
    Print("EAEZE [v2.00]: Server Error (", res, "): ", error_msg);
    
    if(GlobalVariableCheck(status_var)) {
        double cached_status = GlobalVariableGet(status_var);
        if(cached_status == 1.0 && GlobalVariableCheck(time_var)) {
            datetime last_check = (datetime)GlobalVariableGet(time_var);
            if((now - last_check) < LICENSE_GRACE_PERIOD) {
                RemoveLicenseAlert();
                return true;
            }
        }
    }
    
    ShowLicenseAlert("Connection Error: " + IntegerToString(res));
    return false;
}

// --- 5. TIER 2 & TIER 3: SMART TELEMETRY & PING (Every 3 min / 20 sec) ---
void EaezeSmartTelemetrySync() {
    uint now_ticks = GetTickCount();
    int current_interval = g_full_sync_mode ? SMART_PING_INTERVAL_LIVE : SMART_PING_INTERVAL_SLEEP;
    
    if(g_last_telemetry_ticks > 0 && (int)(now_ticks - g_last_telemetry_ticks) < current_interval * 1000) {
        return;
    }
    
    g_last_telemetry_ticks = now_ticks;
    
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    int buy_count = 0, sell_count = 0;
    double buy_lots = 0.0, buy_pnl = 0.0, sell_lots = 0.0, sell_pnl = 0.0;
    ScanEaezeOpenPositions(buy_count, buy_lots, buy_pnl, sell_count, sell_lots, sell_pnl);
    
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
    double floating_pnl = buy_pnl + sell_pnl;
    double today_profit = GetEaezeTodayClosedProfit();
    double max_dd_pct   = GetEaezeDailyMaxDrawdownPct();
    string acc_type     = (AccountInfoString(ACCOUNT_CURRENCY) == "USC" ? "USC" : "USD");
    string asset_fam    = GetEaezeAssetFamily();
    
    string payload = "{"
        + "\"type\":\"STATS_SYNC\","
        + "\"port_number\":\"" + account_no + "\","
        + "\"ea_version\":\"" + InpEaVersion + "\","
        + "\"tier_engine\":\"3_tier\","
        + "\"system_code\":\"" + InpProductID + "\","
        + "\"symbol\":\"" + _Symbol + "\","
        + "\"balance\":" + DoubleToString(balance, 2) + ","
        + "\"equity\":" + DoubleToString(equity, 2) + ","
        + "\"floating_pnl\":" + DoubleToString(floating_pnl, 2) + ","
        + "\"daily_max_drawdown\":" + DoubleToString(max_dd_pct, 2) + ","
        + "\"today_profit\":" + DoubleToString(today_profit, 2) + ","
        + "\"total_lots\":" + DoubleToString(buy_lots + sell_lots, 2) + ","
        + "\"buy_count\":" + IntegerToString(buy_count) + ","
        + "\"sell_count\":" + IntegerToString(sell_count) + ","
        + "\"buy_pnl\":" + DoubleToString(buy_pnl, 2) + ","
        + "\"sell_pnl\":" + DoubleToString(sell_pnl, 2) + ","
        + "\"account_type\":\"" + acc_type + "\","
        + "\"asset_type\":\"" + asset_fam + "\","
        + "\"is_online\":true"
        + "}";
        
    char data[];
    char result[];
    string result_headers;
    
    int len = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
    if(len > 0) ArrayResize(data, len - 1);
    
    string headers = "Content-Type: application/json\r\n" + "x-api-key: " + InpApiKey + "\r\n";
    
    ResetLastError();
    int res = WebRequest("POST", InpSyncUrl, headers, 5000, data, result, result_headers);
    
    if(res == 200) {
        string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
        if(StringFind(response, "\"should_sync_full\":true") >= 0 || StringFind(response, "\"should_sync_full\": true") >= 0) {
            g_full_sync_mode = true;
        } else {
            g_full_sync_mode = false;
        }
    }
}

// Periodic check called inside OnTick()
void CheckEaezeLicensePeriodic() {
    long current_account = AccountInfoInteger(ACCOUNT_LOGIN);
    string account_no = IntegerToString(current_account);
    
    string time_var   = "EAEZE_T_" + account_no + "_" + InpProductID;
    string status_var = "EAEZE_S_" + account_no + "_" + InpProductID;
    
    datetime now = TimeLocal();
    
    if(GlobalVariableCheck(status_var) && GlobalVariableCheck(time_var)) {
        double cached_status = GlobalVariableGet(status_var);
        datetime last_check = (datetime)GlobalVariableGet(time_var);
        
        if(cached_status > 1.0) {
            string alert_msg = "License Invalid or Expired";
            if(cached_status == 2.0) alert_msg = "Balance is too low for this EA.";
            ShowLicenseAlert(alert_msg + " (Account: " + account_no + ")");
            ExpertRemove();
            return;
        }
        
        if(cached_status == 1.0 && (now - last_check) >= LICENSE_REFRESH_INTERVAL) {
            if(!CheckEaezeLicense(false)) {
                ExpertRemove();
                return;
            }
        }
    } else {
        if(!CheckEaezeLicense(false)) {
            ExpertRemove();
            return;
        }
    }
    
    // Auto-fire Smart Telemetry Ping (3 min in sleep / 20s in live farm)
    EaezeSmartTelemetrySync();
}

// --- 6. UI NOTIFICATION ---
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
    ObjectSetString(0, txtName, OBJPROP_TEXT, "EAEZE [v2.00]: " + message);
    ObjectSetInteger(0, txtName, OBJPROP_FONTSIZE, 11);
    ObjectSetInteger(0, txtName, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    
    ChartRedraw(0);
}

void RemoveLicenseAlert() {
    ObjectDelete(0, "EAEZE_Alert_BG");
    ObjectDelete(0, "EAEZE_Alert_TXT");
    ChartRedraw(0);
}
