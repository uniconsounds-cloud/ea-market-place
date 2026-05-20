//+------------------------------------------------------------------+
//| GameMaster_SimEngine.mq5                                         |
//| Master EA for Trading Game Dashboard (Simulation Engine)           |
//+------------------------------------------------------------------+
//| CHANGELOG:                                                       |
//| 1.00 - Initial setup of Virtual Engine and 4 Strategies.         |
//| 1.01 - Fixed static array warnings in Strategy modules.          |
//| 1.02 - Integrated WebSync for Supabase JSON broadcasting.        |
//| 1.03 - Added real-time on-chart text dashboard (Comment overlay). |
//+------------------------------------------------------------------+
#property copyright "juntarasate@gmail.com"
#property link      ""
#property version   "1.03"
#property strict

#include "VirtualEngine.mqh"
#include "Strategy_1_MomentumBurst.mqh"
#include "Strategy_2_MicroPullback.mqh"
#include "Strategy_3_RangeBounce.mqh"
#include "Strategy_4_SpikeFade.mqh"

input double InpInitialBalance = 100.0; // Virtual Starting Balance ($100 USD)

CVirtualAccount g_acc1;
CVirtualAccount g_acc2;
CVirtualAccount g_acc3;
CVirtualAccount g_acc4;

CStrategy1_MomentumBurst g_strat1;
CStrategy2_MicroPullback g_strat2;
CStrategy3_RangeBounce   g_strat3;
CStrategy4_SpikeFade     g_strat4;

CGameMasterWebSync g_webSync;
ulong g_lastHeartbeat = 0;

//+------------------------------------------------------------------+
//| Update on-chart text dashboard overlay                          |
//+------------------------------------------------------------------+
void UpdateChartDashboard()
{
   string text = "==================================================\n";
   text += "      TRADING GAME - SIMULATION ENGINE (v1.03)    \n";
   text += "==================================================\n";
   text += "Engine Status  : ACTIVE (RUNNING)\n";
   text += "Supabase Sync  : CONNECTED\n";
   text += "Current Bid    : " + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), 5) + "\n";
   text += "Current Ask    : " + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_ASK), 5) + "\n";
   text += "Time           : " + TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES|TIME_SECONDS) + "\n\n";
   
   text += "----------------- STRATEGY STATUS -----------------\n";
   
   // Strat 1
   text += "[1] Momentum Burst      : ";
   if(g_acc1.GetOpenOrdersCount() > 0)
      text += "ACTIVE ROUND (Float: $" + DoubleToString(g_acc1.GetFloatingProfit(), 2) + ", MaxDD: $" + DoubleToString(g_acc1.GetActiveMaxDD(), 2) + ")\n";
   else
      text += "WAITING SIGNAL (Bal: $" + DoubleToString(g_acc1.GetBalance(), 2) + ")\n";
      
   // Strat 2
   text += "[2] Micro Pullback      : ";
   if(g_acc2.GetOpenOrdersCount() > 0)
      text += "ACTIVE ROUND (Float: $" + DoubleToString(g_acc2.GetFloatingProfit(), 2) + ", MaxDD: $" + DoubleToString(g_acc2.GetActiveMaxDD(), 2) + ")\n";
   else
      text += "WAITING SIGNAL (Bal: $" + DoubleToString(g_acc2.GetBalance(), 2) + ")\n";

   // Strat 3
   text += "[3] Range Bounce        : ";
   if(g_acc3.GetOpenOrdersCount() > 0)
      text += "ACTIVE ROUND (Float: $" + DoubleToString(g_acc3.GetFloatingProfit(), 2) + ", MaxDD: $" + DoubleToString(g_acc3.GetActiveMaxDD(), 2) + ")\n";
   else
      text += "WAITING SIGNAL (Bal: $" + DoubleToString(g_acc3.GetBalance(), 2) + ")\n";

   // Strat 4
   text += "[4] Spike Fade          : ";
   if(g_acc4.GetOpenOrdersCount() > 0)
      text += "ACTIVE ROUND (Float: $" + DoubleToString(g_acc4.GetFloatingProfit(), 2) + ", MaxDD: $" + DoubleToString(g_acc4.GetActiveMaxDD(), 2) + ")\n";
   else
      text += "WAITING SIGNAL (Bal: $" + DoubleToString(g_acc4.GetBalance(), 2) + ")\n";
      
   text += "==================================================\n";
   
   Comment(text);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   g_webSync.Init(InpSupabaseUrl, InpSupabaseKey);
   
   // Initialize Virtual Accounts
   g_acc1.Init(1, InpInitialBalance, &g_webSync);
   g_acc2.Init(2, InpInitialBalance, &g_webSync);
   g_acc3.Init(3, InpInitialBalance, &g_webSync);
   g_acc4.Init(4, InpInitialBalance, &g_webSync);
   
   // Initialize Strategies
   g_strat1.Init(1, &g_acc1);
   g_strat2.Init(2, &g_acc2);
   g_strat3.Init(3, &g_acc3);
   g_strat4.Init(4, &g_acc4);

   // Reset DB states to clean initial state on MT5 startup
   g_webSync.BroadcastStrategyStatus(1, g_acc1.GetBalance(), 0.0, 0);
   g_webSync.BroadcastStrategyStatus(2, g_acc2.GetBalance(), 0.0, 0);
   g_webSync.BroadcastStrategyStatus(3, g_acc3.GetBalance(), 0.0, 0);
   g_webSync.BroadcastStrategyStatus(4, g_acc4.GetBalance(), 0.0, 0);

   EventSetTimer(1); // For background sync if needed later
   
   UpdateChartDashboard();
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment(""); // Clear chart overlay comments
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double tv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   
   // 1. Process Virtual Ticks (SL/TP Hits, Profit Updates)
   g_acc1.ProcessTicks(bid, ask, tv);
   g_acc2.ProcessTicks(bid, ask, tv);
   g_acc3.ProcessTicks(bid, ask, tv);
   g_acc4.ProcessTicks(bid, ask, tv);
   
   // 2. Evaluate Strategy Logic
   g_strat1.ProcessTick();
   g_strat2.ProcessTick();
   g_strat3.ProcessTick();
   g_strat4.ProcessTick();
   
   // 3. Update dashboard overlay in real-time
   UpdateChartDashboard();
   
   // 4. Throttle Heartbeat for Supabase (5 seconds)
   ulong nowTick = GetTickCount64();
   if(nowTick - g_lastHeartbeat >= 5000)
   {
      // Only broadcast if there are open orders to save API quota
      if(g_acc1.GetOpenOrdersCount() > 0)
      {
         g_webSync.BroadcastStrategyStatus(1, g_acc1.GetBalance(), g_acc1.GetFloatingProfit(), 0);
         g_webSync.BroadcastRoundPing(g_acc1.GetActiveTicket(), g_acc1.GetFloatingProfit(), g_acc1.GetActiveMaxDD());
      }
      if(g_acc2.GetOpenOrdersCount() > 0)
      {
         g_webSync.BroadcastStrategyStatus(2, g_acc2.GetBalance(), g_acc2.GetFloatingProfit(), 0);
         g_webSync.BroadcastRoundPing(g_acc2.GetActiveTicket(), g_acc2.GetFloatingProfit(), g_acc2.GetActiveMaxDD());
      }
      if(g_acc3.GetOpenOrdersCount() > 0)
      {
         g_webSync.BroadcastStrategyStatus(3, g_acc3.GetBalance(), g_acc3.GetFloatingProfit(), 0);
         g_webSync.BroadcastRoundPing(g_acc3.GetActiveTicket(), g_acc3.GetFloatingProfit(), g_acc3.GetActiveMaxDD());
      }
      if(g_acc4.GetOpenOrdersCount() > 0)
      {
         g_webSync.BroadcastStrategyStatus(4, g_acc4.GetBalance(), g_acc4.GetFloatingProfit(), 0);
         g_webSync.BroadcastRoundPing(g_acc4.GetActiveTicket(), g_acc4.GetFloatingProfit(), g_acc4.GetActiveMaxDD());
      }
         
      g_lastHeartbeat = nowTick;
   }
}
//+------------------------------------------------------------------+
