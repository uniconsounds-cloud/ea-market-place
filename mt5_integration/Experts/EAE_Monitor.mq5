//+------------------------------------------------------------------+
//|                                                  EAE_Monitor.mq5 |
//|                                  Copyright 2024, eaeze.com (EAE_) |
//|                                             https://www.eaeze.com |
//|                                             update : 2026.05.30  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, eaeze.com (EAE_)"
#property link      "https://www.eaeze.com"
#property version   "1.03"
#property strict

// --- Include Core Licensing & Sync Library ---
#define EAEZE_SYNC_ENABLED
#include <EAE_Licensing.mqh>

input int      InpSyncSeconds = 20;             // Sync Interval (Seconds)
input string   InpSystemCode  = "EAE_MONITOR";  // System Identifier (e.g. EASYM, EAE_MONITOR)
input long     InpMagicBuy    = 0;              // Filter Buy Magic (0 = All)
input long     InpMagicSell   = 0;              // Filter Sell Magic (0 = All)

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("EAE Universal Monitor: Starting (Unified Library Mode).");
   
   // Verify account status
   if(!EaezeCheckLicense("EAE-MONITOR"))
   {
      Print("EAE_SYSTEM: EAE-MONITOR license check failed.");
      return(INIT_FAILED);
   }
   EaezeRemoveLicenseAlert();
   
   EventSetTimer(1);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment(""); // Clear dashboard on exit
   if(reason != REASON_INITFAILED)
   {
      EaezeRemoveLicenseAlert();
   }
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // [EAE_SYSTEM] - Perform licensing checks and lightweight Sci-Fi sync
   EaezeCheckLicenseAndSync("EAE-MONITOR", InpSystemCode, "1.03", InpSyncSeconds, InpMagicBuy, InpMagicSell);
   
   // --- On-Chart Status Dashboard ---
   string dash = "========================================\n";
   dash += "       EAE UNIVERSAL MONITOR v1.03\n";
   dash += "========================================\n\n";
   dash += " Account   : " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + " (" + AccountInfoString(ACCOUNT_CURRENCY) + ")\n";
   dash += " Balance   : " + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + "\n";
   dash += " Equity    : " + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + "\n";
   dash += " Magic Buy : " + IntegerToString(InpMagicBuy) + " (0 = All)\n";
   dash += " Magic Sell: " + IntegerToString(InpMagicSell) + " (0 = All)\n\n";
   dash += "----------------------------------------\n";
   dash += " [ CLOUD TELEMETRY STATUS ]\n";
   dash += " Mode      : Light Sync (Sci-Fi Dashboard)\n";
   dash += " Status    : OK (ONLINE)\n";
   dash += "========================================";
   
   Comment(dash);
}

//+------------------------------------------------------------------+
//| OnTick function                                                  |
//+------------------------------------------------------------------+
void OnTick()
{
}
