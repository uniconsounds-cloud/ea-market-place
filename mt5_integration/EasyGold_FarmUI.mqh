//+------------------------------------------------------------------+
//|                                              EasyGold_FarmUI.mqh |
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//|                                             update : 07 Mar 2026 |
//+------------------------------------------------------------------+
/*
============== Setup Instructions for EasyGold Farm ==============
   [1] Include header at the top of your EA:
         #include <EasyGold_FarmUI.mqh>
   [2] In your OnInit() function, start the timer (e.g., 3 seconds):
         EventSetTimer(3);
   [3] In your OnTimer() function, call the sync function:
         void OnTimer() {
             SyncFarmData();
         }
   [4] Ensure "Allow WebRequest" is ON for your endpoint URL.
==================================================================
*/

#property strict

// --- Configuration ---
// During local dev, change this to "http://localhost:3000/api/farm/sync" if testing locally
string FarmApiUrl = "https://eaeze.com/api/farm/sync"; 
string FarmApiKey = "KHUCHAI_SUPHAKORN";

// Reference capital used for risk calculation if no SL is present
double FarmReferenceCapital = 50000.0; 

//+------------------------------------------------------------------+
//| Synchronizes active and recently closed trades with Farm WebApp  |
//+------------------------------------------------------------------+
void SyncFarmData() {
    string account_no = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    double total_pnl = 0;
    double total_lots = 0;
    
    string orders_json = "[";
    bool first_order = true;
    
    // --- 1. Process Active Open Positions ---
    int total_positions = PositionsTotal();
    for(int i = 0; i < total_positions; i++) {
        ulong ticket = PositionGetTicket(i);
        if(ticket > 0) {
            string type = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL";
            double pnl = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
            double volume = PositionGetDouble(POSITION_VOLUME);
            double sl = PositionGetDouble(POSITION_SL);
            double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
            double current_price = PositionGetDouble(POSITION_PRICE_CURRENT);
            
            // Calculate Risk Percent (0 to 100)
            double risk_percent = 0;
            if(sl > 0) {
                double max_risk_points = MathAbs(open_price - sl);
                double current_risk_points = MathAbs(open_price - current_price);
                if(max_risk_points > 0) {
                   risk_percent = (current_risk_points / max_risk_points) * 100;
                   if (pnl > 0) risk_percent = 0; // In profit means 0 risk (Golden)
                }
            } else {
                // If no StopLoss, estimate risk based on current drawdown relative to reference capital
                if(pnl < 0) {
                    risk_percent = (MathAbs(pnl) / FarmReferenceCapital) * 100.0 * 10.0; // Multiplier to make it visibly react faster
                }
            }
            if(risk_percent > 100) risk_percent = 100;
            if(risk_percent < 0) risk_percent = 0;
            
            total_pnl += pnl;
            total_lots += volume;
            
            if(!first_order) orders_json += ",";
            orders_json += "{";
            orders_json += "\"ticket_id\":" + IntegerToString(ticket) + ",";
            orders_json += "\"type\":\"" + type + "\",";
            orders_json += "\"status\":\"OPEN\",";
            orders_json += "\"current_pnl\":" + DoubleToString(pnl, 2) + ",";
            orders_json += "\"sl_risk_percent\":" + DoubleToString(risk_percent, 2) + ",";
            orders_json += "\"raw_lot_size\":" + DoubleToString(volume, 2);
            orders_json += "}";
            
            first_order = false;
        }
    }
    
    // --- 2. Process Recently Closed Orders (Last 24 Hours) ---
    // This allows the WebApp to know exactly when to morph a flower into a Gold Fruit or Dead Flower
    datetime end_time = TimeCurrent();
    datetime start_time = end_time - 86400; // 24 hours ago
    
    HistorySelect(start_time, end_time);
    int history_total = HistoryDealsTotal();
    
    for(int i = 0; i < history_total; i++) {
        ulong ticket = HistoryDealGetTicket(i);
        if(ticket > 0) {
            long entryType = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            
            // We only care about deals that closed a position (DEAL_ENTRY_OUT)
            if(entryType == DEAL_ENTRY_OUT) { 
                double pnl = HistoryDealGetDouble(ticket, DEAL_PROFIT);
                long reason = HistoryDealGetInteger(ticket, DEAL_REASON);
                
                // Determine closing status
                string status = "CLOSED_MANUAL";
                if(reason == DEAL_REASON_SL) status = "CLOSED_SL";
                else if(reason == DEAL_REASON_TP) status = "CLOSED_TP";
                else if(pnl > 0) status = "CLOSED_TP"; // Auto classify manual positive closes as TP (Fruit)
                else if(pnl < 0) status = "CLOSED_SL"; // Auto classify manual negative closes as SL (Dead)
                
                // For closed orders, risk is irrelevant visually, just pass closing data
                if(!first_order) orders_json += ",";
                orders_json += "{";
                orders_json += "\"ticket_id\":" + IntegerToString(ticket) + ",";
                orders_json += "\"status\":\"" + status + "\",";
                orders_json += "\"current_pnl\":" + DoubleToString(pnl, 2);
                orders_json += "}";
                
                first_order = false;
            }
        }
    }
    
    orders_json += "]";
    
    // --- 3. Construct Final JSON Payload ---
    // Format timestamp manually since MQL5 TimeToString isn't strict ISO8601
    MqlDateTime dt;
    TimeCurrent(dt);
    string timestamp = StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ", dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
    
    string payload = "{";
    payload += "\"port_number\":\"" + account_no + "\",";
    payload += "\"summary\":{";
    payload += "\"floating_pnl\":" + DoubleToString(total_pnl, 2) + ",";
    payload += "\"total_raw_lots\":" + DoubleToString(total_lots, 2) + ",";
    payload += "\"timestamp\":\"" + timestamp + "\"";
    payload += "},";
    payload += "\"orders\":" + orders_json;
    payload += "}";

    // --- 4. Dispatch HTTP POST ---
    char data[];
    char result[];
    string result_headers;
    int len = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
    if(len > 0) ArrayResize(data, len - 1);
    
    string headers = "Content-Type: application/json\r\n" + "x-api-key: " + FarmApiKey + "\r\n";
    
    // Non-blocking quick request. 3000ms timeout so it doesn't freeze the EA loop excessively.
    ResetLastError();
    int res = WebRequest("POST", FarmApiUrl, headers, 3000, data, result, result_headers);
    
    if(res == -1) {
        int last_error = GetLastError();
        if(last_error == 4060 || last_error == 4014) {
            Print("EasyGold Farm ERROR: Please add URL '", FarmApiUrl, "' to allowed WebRequest list in Options.");
        }
    }
}
