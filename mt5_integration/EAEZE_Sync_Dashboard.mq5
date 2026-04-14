//+------------------------------------------------------------------+
//|                                        EAEZE_Sync_Dashboard.mq5  |
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, EAEZE Systems"
#property link      "https://eaeze.com"
#property version   "1.00"
#property strict

enum enum_asset_type {
    ASSET_GOLD,  // GOLD (XAU)
    ASSET_FOREX, // FOREX
    ASSET_CRYPTO // CRYPTO
};

// --- Input Parameters ---
input string InpApiUrl    = "https://eaeze.com/api/sync-dashboard";
input string InpApiKey    = "KHUCHAI_SUPHAKORN";
input enum_asset_type InpAssetType = ASSET_GOLD;
input int InpSyncInterval = 2; // Sync every X seconds

// --- Internal Variables ---
int prev_orders_count = 0;
double prev_balance = 0;
datetime last_sync_time = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    prev_orders_count = PositionsTotal();
    prev_balance = AccountInfoDouble(ACCOUNT_BALANCE);
    
    // Send 30-day history on start
    SyncHistoricData();
    
    Print("EAEZE Sync: Started. Asset Type: ", EnumToString(InpAssetType));
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    // Send offline status
    SendAccountStats(false);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
    datetime now = TimeCurrent();
    if (now - last_sync_time < InpSyncInterval) return;
    last_sync_time = now;

    int current_orders = PositionsTotal();
    double current_balance = AccountInfoDouble(ACCOUNT_BALANCE);
    
    // 1. Detect Batch Closure
    if (prev_orders_count - current_orders > 1) {
        DetectBatchClose(prev_orders_count - current_orders);
    }
    
    // 2. Regular Stats Sync
    SendAccountStats(true);
    
    prev_orders_count = current_orders;
    prev_balance = current_balance;
}

//+------------------------------------------------------------------+
//| Detect Batch Close (Multiple orders closed at once)              |
//+------------------------------------------------------------------+
void DetectBatchClose(int closed_count) {
    HistorySelect(TimeCurrent() - 10, TimeCurrent());
    int total_history = HistoryDealsTotal();
    
    double batch_profit = 0;
    double batch_lots = 0;
    int found_count = 0;
    
    for (int i = total_history - 1; i >= 0; i--) {
        ulong ticket = HistoryDealGetTicket(i);
        if (HistoryDealGetInteger(ticket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
        
        batch_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
        batch_lots += HistoryDealGetDouble(ticket, DEAL_VOLUME);
        found_count++;
        
        if (found_count >= closed_count) break;
    }
    
    string json = "{"
        "\"port_number\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\","
        "\"total_orders\":" + IntegerToString(found_count) + ","
        "\"total_lots\":" + DoubleToString(batch_lots, 2) + ","
        "\"total_profit\":" + DoubleToString(batch_profit, 2) + ","
        "\"type\":\"BATCH_CLOSE\""
    "}";
    
    SendJson(json);
}

//+------------------------------------------------------------------+
//| Send Account Real-time Stats                                     |
//+------------------------------------------------------------------+
void SendAccountStats(bool is_online) {
    string acc_no = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    double balance = AccountInfoDouble(ACCOUNT_BALANCE);
    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    double max_dd = (balance > 0) ? ((balance - equity) / balance * 100) : 0;
    
    // Buy/Sell stats
    int buy_count = 0, sell_count = 0;
    double buy_pnl = 0, sell_pnl = 0, total_lots = 0;
    
    for (int i = 0; i < PositionsTotal(); i++) {
        ulong ticket = PositionGetTicket(i);
        if (PositionSelectByTicket(ticket)) {
            double pnl = PositionGetDouble(POSITION_PROFIT);
            double lots = PositionGetDouble(POSITION_VOLUME);
            total_lots += lots;
            
            if (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) {
                buy_count++;
                buy_pnl += pnl;
            } else {
                sell_count++;
                sell_pnl += pnl;
            }
        }
    }
    
    string asset_str = "GOLD";
    if (InpAssetType == ASSET_FOREX) asset_str = "FOREX";
    if (InpAssetType == ASSET_CRYPTO) asset_str = "CRYPTO";
    
    string acc_type = (AccountInfoString(ACCOUNT_CURRENCY) == "USD" || AccountInfoString(ACCOUNT_CURRENCY) == "EUR") ? "USD" : "USC";

    string json = "{"
        "\"port_number\":\"" + acc_no + "\","
        "\"balance\":" + DoubleToString(balance, 2) + ","
        "\"equity\":" + DoubleToString(equity, 2) + ","
        "\"floating_pnl\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ","
        "\"max_drawdown\":" + DoubleToString(max_dd, 2) + ","
        "\"total_lots\":" + DoubleToString(total_lots, 2) + ","
        "\"buy_count\":" + IntegerToString(buy_count) + ","
        "\"sell_count\":" + IntegerToString(sell_count) + ","
        "\"buy_pnl\":" + DoubleToString(buy_pnl, 2) + ","
        "\"sell_pnl\":" + DoubleToString(sell_pnl, 2) + ","
        "\"account_type\":\"" + acc_type + "\","
        "\"asset_type\":\"" + asset_str + "\","
        "\"is_online\":" + (is_online ? "true" : "false") + ","
        "\"type\":\"STATS_SYNC\""
    "}";
    
    SendJson(json);
}

//+------------------------------------------------------------------+
//| Sync 30-day History                                              |
//+------------------------------------------------------------------+
void SyncHistoricData() {
    datetime from = TimeCurrent() - (30 * 24 * 60 * 60);
    datetime to = TimeCurrent();
    
    if (!HistorySelect(from, to)) return;
    
    Print("EAEZE Sync: Sending 30-day history...");
    
    // This part should be aggregated by day on the server side or here
    // For simplicity, we send a summary of historical deals for the last 30 days
    // In a real scenario, you'd loop through each day and sum them up
    
    string acc_no = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    string json = "{\"port_number\":\"" + acc_no + "\", \"type\":\"HISTORY_INIT\", \"days\":30}";
    SendJson(json);
}

//+------------------------------------------------------------------+
//| WebRequest JSON Transmission                                     |
//+------------------------------------------------------------------+
void SendJson(string json) {
    char data[];
    char result[];
    string result_headers;
    
    int len = StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
    if (len > 0) ArrayResize(data, len - 1);
    
    string headers = "Content-Type: application/json\r\n" + "x-api-key: " + InpApiKey + "\r\n";
    
    ResetLastError();
    int res = WebRequest("POST", InpApiUrl, headers, 5000, data, result, result_headers);
    
    if (res == -1) {
        Print("EAEZE Sync Error: WebRequest failed. Error code: ", GetLastError());
    }
}
