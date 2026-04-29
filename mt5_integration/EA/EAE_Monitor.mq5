//+------------------------------------------------------------------+
//|                                                  EAE_Monitor.mq5 |
//|                                  Copyright 2024, eaeze.com (EAE_) |
//|                                             https://www.eaeze.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, eaeze.com (EAE_)"
#property link      "https://www.eaeze.com"
#property version   "1.00"
#property strict

// --- Include Core Sync Library ---
#include "EAE_WebSync.mqh"

// --- Inputs ---
input string   InpApiKey      = "EZE-YOUR-KEY"; // Partner API Key
input int      InpSyncSeconds = 20;             // Sync Interval (Seconds)
input string   InpAssetType   = "GOLD";         // Asset Type (GOLD/FOREX/BTC)
input string   InpSystemCode  = "EAE_MONITOR";  // System Identifier

// --- State ---
EAE_RealtimeSnapshot g_snapshot;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Initialize sync module
   EAE_WebSyncInit("https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data", InpApiKey, InpSyncSeconds);
   
   // Pre-fill Identity
   g_snapshot.identity.product_family = InpAssetType;
   g_snapshot.identity.system_code    = InpSystemCode;
   g_snapshot.identity.ea_name        = "EAE Universal Monitor";
   g_snapshot.identity.ea_version     = "1.00";
   
   EventSetTimer(1);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // 1. Refresh Account Data
   g_snapshot.account.balance      = AccountInfoDouble(ACCOUNT_BALANCE);
   g_snapshot.account.equity       = AccountInfoDouble(ACCOUNT_EQUITY);
   g_snapshot.account.margin_level = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   g_snapshot.account.currency     = AccountInfoString(ACCOUNT_CURRENCY);
   
   // 2. Scan All Open Positions (Universal Mode)
   EAE_InitSideState(g_snapshot.buy_state, EAE_SIDE_BUY);
   EAE_InitSideState(g_snapshot.sell_state, EAE_SIDE_SELL);
   
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long type = PositionGetInteger(POSITION_TYPE);
         double lots = PositionGetDouble(POSITION_VOLUME);
         double pnl = PositionGetDouble(POSITION_PROFIT);
         
         if(type == POSITION_TYPE_BUY) {
            g_snapshot.buy_state.open_count++;
            g_snapshot.buy_state.open_lots += lots;
            g_snapshot.buy_state.floating_pnl += pnl;
         } else {
            g_snapshot.sell_state.open_count++;
            g_snapshot.sell_state.open_lots += lots;
            g_snapshot.sell_state.floating_pnl += pnl;
         }
      }
   }
   
   // 3. Perform Sync (Enhanced V1.406 with Daily Stats)
   // We pass identity magics so history scanner knows what to look for
   g_snapshot.identity.magic_buy  = 0; // Monitor mode: Scan all or specify
   g_snapshot.identity.magic_sell = 0; 
   
   EAE_WebSyncPerform(g_snapshot);
}

//+------------------------------------------------------------------+
//| OnTick function (Optional for faster updates)                    |
//+------------------------------------------------------------------+
void OnTick()
{
   // In monitor mode, timer is usually sufficient to save resources
}
