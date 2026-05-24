//+------------------------------------------------------------------+
//|                                      EAEZE_Licensing_Imports.mqh |
//|                                    Copyright 2026, EAEZE Systems |
//|                                             https://eaeze.com    |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, EAEZE Systems"
#property link      "https://eaeze.com"
#property version   "1.00"
#property strict

// --- Import functions from compiled library EX5 ---
#import "EAEZE_Licensing_Lib.ex5"
   bool EaezeCheckLicense(string product_id, string api_key = "KHUCHAI_SUPHAKORN", bool force_check = false);
   void EaezeCheckLicensePeriodic(string product_id, string api_key = "KHUCHAI_SUPHAKORN");
   void EaezeRemoveLicenseAlert();
#import
