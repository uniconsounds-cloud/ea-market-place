//+------------------------------------------------------------------+
//| EASYGOLD Farming (Native MT5) - baseline close to original        |
//|                                                                  |
//| Version history (English):                                       |
//|  v1.02 - Fix standard MT5 position selection by index            |
//|         (PositionGetTicket + PositionSelectByTicket).            |
//|         Remove deprecated commission access from basket profit.   |
//|  v1.04 - Add basket duration tracking + optional time-limit      |
//|         force close. Add on-chart basket dashboard (stats).      |
//|         Replace multi-line label with spreadsheet-like table.     |
//|  v1.05 - Add dashboard auto scaling across different resolutions |
//|         (chart pixel width based) + manual user scale multiplier.|
//|         Add inputs for dashboard background/grid/text colors and |
//|         font size. Improve sectioned code layout with numbered   |
//|         headers for patching and future expansion.               |
//|  v1.06 - FIX: Dashboard background color works on Mac (use        |
//|         OBJPROP_BGCOLOR + OBJPROP_FILL). Improve alpha fallback. |
//|         CHANGE: LastCnt column shows MAX closed count per side.   |
//|  v1.07 - CHANGE: Fast-Stuck trigger uses reachSec >= limit        |
//|  v1.07p005 - NEW: EarlyCloseDate (one-day Friday-plan +8h shift). |
//|  v1.07p006 - CHANGE: Counter-trend SL back to fixed POINTS input.|
//|  v1.07p007 - NEW: Optional age-based force-close module (test).   |
//|  v1.07p008 - CHANGE: Reduce Inputs list (UI). NEW: Bottom-right quick stats text. |
//|         (per user request).                                      |
//|         NEW: Add MT5 comment tagging before basket close:         |
//|         reason + magic + ticket list for ALL positions in basket. |
//|         NEW: Add sequence numbers to comments: rtb/rts/follow.    |
//|         NEW: Cooldown after FAST_STUCK close (per side).          |
//|  p003  - FIX: Compile errors after SL% patch (missing brace).     |
//|         FIX: SeqSanitizeTag uses StringToUpper() correctly.       |
//|  p009  - FIX: Reduce UI flicker in Strategy Tester/visual mode by |
//|         removing forced ChartRedraw() calls from timer/UI update. |
//|         Objects update still works via EventSetTimer(1).          |
//|   v1.08b001 new base line on EasyGold Farming                     |
//|   0410_v1 new base line on EasyGold Farming with mgh files        |
//+------------------------------------------------------------------+
#property strict
#property version   "1.001"

// At top of file
#include "EAE_MonitorTypes.mqh"
#include "EAE_CollectorCore.mqh"
#include "EAE_BasketTracker.mqh"
#include "EG_Farming_DashboardMap.mqh"
#include "EAE_DashboardBase.mqh"
#include "EAE_FileLogger.mqh"

//==================================================================//
// [LICENSE] Runtime restrictions (EDIT HERE)                        //
// - Account login whitelist  :   LIC_ALLOWED_LOGINS                 //
// - Minimum balance (cent account) : LIC_MIN_BALANCE_CENT           //
// - Expiration date (server date) : LIC_EXPIRY_DATE                 //
// - onInit() Remove Comment for Use                                 //
// - onTick() Remove Comment for Use                                 //
//==================================================================//
bool   LIC_ENABLE_LOCK        = false;          // DEV BASELINE - lock disabled <==== EDIT ME ====
bool   LIC_FAIL_INIT_IF_INVALID = true;        // true=EA will not start if invalid

// Allowed MT5 account logins (ACCOUNT_LOGIN)
// NOTE: If you leave this list EMPTY => allow ALL accounts (useful for dev).
ulong  LIC_ALLOWED_LOGINS[]   = { 97021489, 96964799, 97045908 };   // <==== EDIT ME ====

// Minimum balance required (cent account balance shown as "50000" for $500.00 in USC)
double LIC_MIN_BALANCE_CENT   = 45000.0;       // <==== EDIT ME ====

// Expiration date in server date: "YYYY.MM.DD"
// NOTE: Empty string => no expiry check.
string LIC_EXPIRY_DATE        = "2026.5.31";  // <==== EDIT ME ====

// Internal flag
bool   g_license_ok = true;

//----- helpers (kept inside license block) -----
int LicenseDateId(const datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   return dt.year*10000 + dt.mon*100 + dt.day;
}

bool LicenseParseDateId(const string s, int &outId)
{
   outId = 0;
   if(StringLen(s) == 0) return false;

   string p[];
   int n = StringSplit(s, '.', p);
   if(n != 3) n = StringSplit(s, '-', p);
   if(n != 3) n = StringSplit(s, '/', p);
   if(n != 3) return false;

   int y = (int)StringToInteger(p[0]);
   int m = (int)StringToInteger(p[1]);
   int d = (int)StringToInteger(p[2]);
   if(y < 1970 || m < 1 || m > 12 || d < 1 || d > 31) return false;

   outId = y*10000 + m*100 + d;
   return true;
}

bool LicenseIsLoginAllowed(const ulong login)
{
   if(!LIC_ENABLE_LOCK) return true;

   int n = ArraySize(LIC_ALLOWED_LOGINS);
   if(n <= 0) return true; // empty list => allow all (dev-friendly)

   for(int i=0; i<n; i++)
      if(LIC_ALLOWED_LOGINS[i] == login)
         return true;

   return false;
}

bool LicenseIsExpired()
{
   if(StringLen(LIC_EXPIRY_DATE) == 0) return false;

   int expId = 0;
   if(!LicenseParseDateId(LIC_EXPIRY_DATE, expId))
      return true; // fail-safe: bad date format => treat as expired

   int nowId = LicenseDateId(TimeCurrent());
   return (nowId > expId); // valid THROUGH the expiry day
}

bool LicenseCheck(string &reason)
{
   reason = "";

   if(!LIC_ENABLE_LOCK)
      return true;

   ulong  login = (ulong)AccountInfoInteger(ACCOUNT_LOGIN);
   double bal   = AccountInfoDouble(ACCOUNT_BALANCE);

   if(!LicenseIsLoginAllowed(login))
   {
      reason = StringFormat("Login not allowed: %I64d", (long)login);
      return false;
   }

   if(bal < LIC_MIN_BALANCE_CENT)
   {
      reason = StringFormat("Balance too low: %.2f < %.2f (cent)", bal, LIC_MIN_BALANCE_CENT);
      return false;
   }

   if(LicenseIsExpired())
   {
      reason = StringFormat("Expired: %s", LIC_EXPIRY_DATE);
      return false;
   }

   return true;
}

#include <Trade/Trade.mqh>
CTrade g_trade;

//==================================================================//
// [100] INPUTS - Trading (original-like)                            //
//==================================================================//
// [PATCH 008] CHANGE: Reduce Inputs - only essential parameters remain as 'input'. Others are internal variables.
input double InpUpperLimitLotSize = 0.1;  // Upper_limit_lot_size
input double InpLots              = 0.01;  // Lots (initial)
input double InpCloseMoney        = 10.0;  // Close_Money (USC)
input double InpLotPlusB          = 0.01;  // Lot_plus_B
input double InpLotPlusS          = 0.01;  // Lot_plus_S
input int    InpMaxOrderLoss      = 100;   // Max_Order_Loss
bool   InpModeSell          = true;  // Mode_Sell
bool   InpModeBuy           = true;  // Mode_Buy
input int    InpMagicStart        = 4800;  // MagicStart
int    InpCounterTrendSL_Points = 6000; // [PATCH 006] CHANGE: Counter-trend SL distance in POINTS (0=disabled)

//==================================================================//
// [110] INPUTS - Signal / Indicators                                //
//==================================================================//
int    InpEmaFastPeriod     = 5;
int    InpEmaSlowPeriod     = 20;
int    InpAtrGridPeriod     = 14;
int    InpAtrFilterPeriod   = 5;
double InpAtrFilterMax      = 4.0;   // Threshold (unit depends on InpAtrFilterUnitIsPrice)
int    InpPipsDistanceToEma = 100;

//==================================================================//
// [120] INPUTS - Unit controls                                      //
//==================================================================//
// If 0 => auto pip size from digits; else override (price per 1 pip).
double InpPipSizePrice      = 0.0;

// ATR unit modes:
// - UnitIsPrice=true: ATR buffer treated as PRICE (standard iATR output).
// - UnitIsPrice=false: ATR buffer treated as PIPS.
bool   InpAtrGridUnitIsPrice   = true;
bool   InpAtrFilterUnitIsPrice = true;

// Grid multipliers (original-like)
double InpRTB_AtrMultiplier = 0.2;
double InpRTS_AtrMultiplier = 0.2;

//==================================================================//
// [130] INPUTS - Follow logic                                       //
//==================================================================//
double InpFollowGridPips    = 0.0;  // If >0 => fixed pips range in NoNearby check
double InpFollowAtrMult     = 0.0;  // If >0 and FollowGridPips==0 => follow grid from ATR
bool   InpFollowUseSL       = true;
int    InpFollowSL_Pips     = 6000;

//==================================================================//
// [140] INPUTS - Basket profit                                      //
//==================================================================//
bool   InpBasketIncludeSwap = false; // Commission removed to avoid deprecated warnings

//==================================================================//
// [150] INPUTS - Execution / Logs                                   //
//==================================================================//
int    InpSlippagePoints    = 0;
bool   InpEnableLogs        = true;

//==================================================================//
// [160] INPUTS - Basket limits + Dashboard + Fast-Stuck close        //
//==================================================================//
bool InpEnableBasketDashboard = true;
// Dashboard placement
int  InpDashboardCorner       = 0;     // 0=TL,1=TR,2=BL,3=BR
int  InpDashboardX            = 200;
int  InpDashboardY            = 20;

// Spreadsheet style (base sizes; actual will be scaled)
int  InpDashRowH              = 16;    // Base row height (px)
int  InpDashPad               = 6;     // Base inner padding (px)
int  InpDashGridThickness     = 1;     // Base grid thickness (px)
int  InpDashAlphaBG           = 220;   // Background alpha (0..255)
int  InpDashAlphaGrid         = 180;   // Grid alpha (0..255)

// Dashboard scaling
bool   InpDashAutoScale       = true;   // Auto scale by chart width in pixels
input double InpDashUserScale       = 0.7;    // Auto scale
int    InpDashBaseChartW      = 1600;   // Reference chart width for scale=1.0
double InpDashScaleMin        = 0.80;   // Clamp min
double InpDashScaleMax        = 1.80;   // Clamp max

// Dashboard colors + font
color  InpDashBgColor         = clrBlack;
color  InpDashGridColor       = clrDimGray;
color  InpDashTextColor       = clrWhite;
input int    InpDashFontSize        = 15;     // Font size (scaled)
// bool   InpShowCornerInfo      = false;   // Show quick info at bottom-right

//==================================================================//
// [170] INPUTS - Daily Trade Window (server time)                   //
//==================================================================//
// EA blocks NEW orders from (Close - StopBeforeClose) to (Open + StartAfterOpen).
// DOW is not used in this daily mode.
input int    InpMarketCloseHour      = 23; // Market Close Hour
input int    InpMarketCloseMin       = 0; // Market Close Min
input int    InpMarketOpenHour       = 1; // Market Open Hour
input int    InpMarketOpenMin        = 0; // Market Open Min
input int    InpStopBeforeClose_Min  = 60; // Before Close Min
input int    InpStartAfterOpen_Min   = 60; // After Open Min

//==================================================================//
// [175] INPUTS - Friday Profit Lock + Weekend Pause (server time)   //
//==================================================================//
// Friday trigger: if (FridayClosedProfit >= target) OR (time to daily close <= start hours)
input double InpFridayProfitTargetMoney        = 3000.0; // Friday Profit (USC)
int    InpFridayStartBeforeClose_Hours   = 8;     // start manage mode when time-to-close <= this
int    InpFridaySoftCloseWindow_Hours    = 4;     // start soft liquidation when time-to-close <= this
int    InpFridayForceCloseBefore_Hours   = 1;     // force close all when time-to-close <= this
int    InpFridayRetraceTrigger_Points    = 500;   // retrace from latest extreme to close ONE position
int    InpFridayStaggerCloseDelay_Sec    = 20;    // delay between closing each position (soft mode)

//==================================================================//
// [178] INPUTS - Test: Age-based Force Close (optional)              //
//==================================================================//
// [PATCH 007] NEW: If enabled and basket age >= limit, force-close the whole side.
// This module is isolated and easy to remove.
bool   InpEnableAgeForceClose   = true;
int    InpAgeForceClose_Hours   = 13;      // 0=disabled

// [PATCH 005] NEW: Special early-close date (server date). Format: YYYY.MM.DD (empty=disabled)
input string InpEarlyCloseDate = "2026.12.24"; // Early Close Date

#include "EAE_DashboardBase.mqh"
#include "EG_Farming_MonitorAdapter.mqh"

//==================================================================//
// [200] GLOBALS - State / Handles                                   //
//==================================================================//
int      g_magicBuy  = 0;
int      g_magicSell = 0;

double   g_lotsB = 0.0;
double   g_lotsS = 0.0;

datetime g_lastBarTime = 0;

datetime g_lastEntryBuyBar   = 0;
datetime g_lastEntrySellBar  = 0;
datetime g_lastRescueBuyBar  = 0;
datetime g_lastRescueSellBar = 0;
datetime g_lastFollowBuyBar  = 0;
datetime g_lastFollowSellBar = 0;

// Indicator handles
int g_hEmaFast = INVALID_HANDLE;
int g_hEmaSlow = INVALID_HANDLE;
int g_hAtrGrid = INVALID_HANDLE;
int g_hAtrFilt = INVALID_HANDLE;

// Basket stats (per side)
int      g_prevCntBuy  = 0;
int      g_prevCntSell = 0;

datetime g_basketStartBuy  = 0;
datetime g_basketStartSell = 0;

int      g_lastCloseCountBuy   = 0;  // last closed count (kept for logs)
int      g_lastCloseCountSell  = 0;

int      g_maxCloseCountBuy    = 0;  // maximum closed count ever
int      g_maxCloseCountSell   = 0;

int      g_totalCloseBuy       = 0;
int      g_totalCloseSell      = 0;

int      g_totalForcedBuy      = 0;
int      g_totalForcedSell     = 0;

int      g_maxDurationSecBuy   = 0;
int      g_maxDurationSecSell  = 0;

int      g_lastDurationSecBuy  = 0;
int      g_lastDurationSecSell = 0;

// Comment sequence counters (reset per basket end)
int g_seqRtbBuy=0, g_seqRtsSell=0, g_seqFollowBuy=0, g_seqFollowSell=0;

// Per-basket order sequence (restart-safe: synced from open positions)
int g_seqOrderBuy=0;
int g_seqOrderSell=0;

// Dashboard
string   g_dashPrefix = "EZD_";
double   g_dashScale  = 1.0;

//==================================================================//
// [210] GLOBALS - Friday profit lock / liquidation state            //
//==================================================================//


enum EZ_FRIDAY_STATE
{
   EZ_STATE_NORMAL = 0,
   EZ_STATE_FRI_MANAGE = 1,
   EZ_STATE_FRI_SOFT = 2,
   EZ_STATE_FRI_FORCE = 3,
   EZ_STATE_WEEKEND_PAUSE = 4,
   EZ_STATE_EARLYDAY_PAUSE = 5 // [PATCH 005] NEW: pause until next day
};

EZ_FRIDAY_STATE g_friState = EZ_STATE_NORMAL;

// [PATCH 005] NEW: early-close day (acts like Friday plan for that date only)
bool g_hasEarlyCloseDate = false;
int  g_earlyCloseDateId  = 0; // YYYYMMDD

// Soft liquidation reference tracker (swing extreme + retrace, per side)
// Reference price moves with price in the current direction; when price retraces from reference by trigger, close one position.
bool   g_buyRefInit  = false;
bool   g_sellRefInit = false;
double g_buyRefPrice = 0.0;
double g_sellRefPrice = 0.0;
int    g_buyRefDir   = 0;   // 0=unknown, 1=tracking up extreme, -1=tracking down extreme
int    g_sellRefDir  = 0;   // 0=unknown, 1=tracking up extreme, -1=tracking down extreme

datetime g_lastSoftCloseTime = 0; // stagger close delay

// Flag to mark baskets ended under liquidation/forced closure
bool g_liquidatingBuy  = false;
bool g_liquidatingSell = false;

//==================================================================//
// [300] UTIL - Logging / Clamp / Cooldown                            //
//==================================================================//
void Log(const string msg)
{
   if(InpEnableLogs) Print(msg);
}

double ClampD(const double v, const double lo, const double hi)
{
   if(v < lo) return lo;
   if(v > hi) return hi;
   return v;
}

bool IsSideInCooldown(const bool isBuy)
{
   // Cooldown logic removed in this branch.
   return false;
}


//==================================================================//
// [305] UTIL - Daily trade window (no new orders)                   //
//==================================================================//
datetime DateAt(const datetime anchor, const int hour, const int min)
{
   MqlDateTime dt;
   TimeToStruct(anchor, dt);
   dt.hour = hour;
   dt.min  = min;
   dt.sec  = 0;
   return StructToTime(dt);
}

bool IsInBlockedWindow(const datetime now, const datetime closeDT)
{
   datetime openDT = DateAt(closeDT, InpMarketOpenHour, InpMarketOpenMin);
   if(openDT <= closeDT) openDT += 86400;

   datetime start = closeDT - (datetime)(InpStopBeforeClose_Min * 60);
   datetime end   = openDT  + (datetime)(InpStartAfterOpen_Min  * 60);

   return (now >= start && now < end);
}

bool CanOpenNewOrdersNow()
{
   datetime now = TimeCurrent();
   datetime closeToday = DateAt(now, InpMarketCloseHour, InpMarketCloseMin);
   datetime closeYday  = closeToday - 86400;

   if(IsInBlockedWindow(now, closeToday)) return false;
   if(IsInBlockedWindow(now, closeYday))  return false;

   return true;
}

//==================================================================//
// [307] UTIL - Friday plan helpers                                  //
//==================================================================//
int TimeToDailyCloseSec(const datetime now)
{
   datetime closeDT = DateAt(now, InpMarketCloseHour, InpMarketCloseMin);
   if(closeDT <= now) closeDT += 86400;
   return (int)(closeDT - now);
}

bool IsFriday(const datetime now)
{
   MqlDateTime dt;
   TimeToStruct(now, dt);
   return (dt.day_of_week == 5);
}

bool IsMonday(const datetime now)
{
   MqlDateTime dt;
   TimeToStruct(now, dt);
   return (dt.day_of_week == 1);
}

datetime DayStart(const datetime now)
{
   MqlDateTime dt;
   TimeToStruct(now, dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   return StructToTime(dt);
}

// [PATCH 005] NEW: Date helpers for special early-close day
int DateId(const datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   return dt.year*10000 + dt.mon*100 + dt.day;
}

bool InitEarlyCloseDate()
{
   g_hasEarlyCloseDate = false;
   g_earlyCloseDateId  = 0;

   string s = InpEarlyCloseDate;
   if(StringLen(s) == 0) return false;

   // Accept YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD
   string parts[];
   int n = StringSplit(s, '.', parts);
   if(n != 3) n = StringSplit(s, '-', parts);
   if(n != 3) n = StringSplit(s, '/', parts);
   if(n != 3) return false;

   int y = (int)StringToInteger(parts[0]);
   int m = (int)StringToInteger(parts[1]);
   int d = (int)StringToInteger(parts[2]);

   if(y < 1970 || m < 1 || m > 12 || d < 1 || d > 31) return false;

   g_earlyCloseDateId  = y*10000 + m*100 + d;
   g_hasEarlyCloseDate = true;
   return true;
}

bool IsEarlyCloseDay(const datetime now)
{
   if(!g_hasEarlyCloseDate) return false;
   return (DateId(now) == g_earlyCloseDateId);
}

bool IsFridayOrEarlyCloseDay(const datetime now)
{
   return (IsFriday(now) || IsEarlyCloseDay(now));
}

double ClosedProfitSince(const datetime fromTime)
{
   datetime toTime = TimeCurrent();
   if(!HistorySelect(fromTime, toTime)) return 0.0;

   double sum = 0.0;
   int deals = HistoryDealsTotal();
   for(int i=0; i<deals; i++)
   {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0) continue;

      // Only count closing deals
      long entry = (long)HistoryDealGetInteger(deal, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT) continue;

      string sym = HistoryDealGetString(deal, DEAL_SYMBOL);
      if(sym != _Symbol) continue;

      int magic = (int)HistoryDealGetInteger(deal, DEAL_MAGIC);
      if(magic != g_magicBuy && magic != g_magicSell) continue;

      double profit = HistoryDealGetDouble(deal, DEAL_PROFIT);
      double swap   = HistoryDealGetDouble(deal, DEAL_SWAP);
      double comm   = HistoryDealGetDouble(deal, DEAL_COMMISSION);
      sum += (profit + swap + comm);
   }
   return sum;
}

//==================================================================//
// [310] UTIL - Scale helpers                                         //
//==================================================================//
int S(const int px)
{
   return (int)MathMax(1.0, MathRound((double)px * g_dashScale));
}

//==================================================================//
// [320] UTIL - Pip helpers                                           //
//==================================================================//
double AutoPipSize(const string sym)
{
   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);

   if(digits == 5 || digits == 3) return point * 10.0;
   return point;
}

double PipSize(const string sym)
{
   if(InpPipSizePrice > 0.0) return InpPipSizePrice;
   return AutoPipSize(sym);
}

double PipsToPrice(const double pips, const string sym)
{
   return pips * PipSize(sym);
}

double PriceToPips(const double priceDelta, const string sym)
{
   double pip = PipSize(sym);
   if(pip <= 0.0) return 0.0;
   return priceDelta / pip;
}

double AtrBufferToPips(const double atrBuffer, const string sym, const bool unitIsPrice)
{
   if(unitIsPrice)
      return PriceToPips(atrBuffer, sym);
   return atrBuffer;
}

//==================================================================//
// [330] UTIL - Volume helper                                         //
//==================================================================//
double NormalizeVolume(const string sym, double vol)
{
   double vmin  = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double vmax  = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double vstep = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);

   if(vol < vmin) vol = vmin;
   if(vol > vmax) vol = vmax;

   double steps = MathFloor((vol - vmin) / vstep + 0.5);
   double vnorm = vmin + steps * vstep;

   if(vnorm > InpUpperLimitLotSize) vnorm = InpUpperLimitLotSize;
   if(vnorm < vmin) vnorm = vmin;

   return vnorm;

} // end NormalizeVolume


//==================================================================//
// [335] UTIL - Counter-trend SL (fixed points)                       //
// [PATCH 006] CHANGE: Revert counter-trend SL to a fixed POINTS      //
//                     distance (legacy-style), not % of balance.     //
// Notes:                                                            //
// - Applies to ENT/RTB/RTS entries (PlaceBuy/PlaceSell).             //
// - Follow SL remains controlled by InpFollowSL_Pips (unchanged).    //
// - This is a per-position SL distance; basket logic is unchanged.   //
//==================================================================//
double CalcSLPriceFromFixedPoints(const bool isBuy)
{
   if(InpCounterTrendSL_Points <= 0) return 0.0;

   double point  = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   int    digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(point <= 0.0) point = _Point;

   double distPx = (double)InpCounterTrendSL_Points * point;

   // Respect broker stop level (minimum distance)
   int stopsLevelPts = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   if(stopsLevelPts > 0)
   {
      double minDist = (double)stopsLevelPts * point;
      if(distPx < minDist) distPx = minDist;
   }

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(ask <= 0.0 || bid <= 0.0) return 0.0;

   double sl = 0.0;
   if(isBuy)  sl = ask - distPx;
   else       sl = bid + distPx;

   return NormalizeDouble(sl, digits);
}



//==================================================================//
// [340] UTIL - Bar helpers                                           //
//==================================================================//
bool IsNewBar()
{
   datetime t = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(t != g_lastBarTime)
   {
      g_lastBarTime = t;
      return true;
   }
   return false;
}

bool OncePerBar(datetime &stamp)
{
   datetime t = iTime(_Symbol, PERIOD_CURRENT, 0);
   if(stamp == t) return false;
   stamp = t;
   return true;
}

//==================================================================//
// [350] UTIL - Indicator buffer helpers                              //
//==================================================================//
bool GetBufferValue(const int handle, const int shift, double &outVal)
{
   if(handle == INVALID_HANDLE) return false;
   double buf[1];
   if(CopyBuffer(handle, 0, shift, 1, buf) != 1) return false;
   outVal = buf[0];
   return true;
}

bool GetEMA(const int shift, double &emaFast, double &emaSlow)
{
   if(!GetBufferValue(g_hEmaFast, shift, emaFast)) return false;
   if(!GetBufferValue(g_hEmaSlow, shift, emaSlow)) return false;
   return true;
}

//==================================================================//
// [360] UTIL - Position select by index (standard MT5)               //
//==================================================================//
bool SelectPositionByIndex(const int index)
{
   ulong ticket = PositionGetTicket(index);
   if(ticket == 0) return false;
   return PositionSelectByTicket(ticket);
}

//==================================================================//
// [400] POSITIONS - Scanning / Basket ops / Comment tagging          //
//==================================================================//
int CountPositionsByMagicSide(const int magic, const ENUM_POSITION_TYPE side)
{
   int total = PositionsTotal();
   int count = 0;

   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;
      count++;
   }
   return count;
}

double BasketProfitByMagicSide(const int magic, const ENUM_POSITION_TYPE side)
{
   int total = PositionsTotal();
   double sum = 0.0;

   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      double p = PositionGetDouble(POSITION_PROFIT);
      if(InpBasketIncludeSwap) p += PositionGetDouble(POSITION_SWAP);
      sum += p;
   }
   return sum;
}

bool CloseAllByMagicSide(const int magic, const ENUM_POSITION_TYPE side)
{
   bool ok = true;
   int total = PositionsTotal();

   for(int i=total-1; i>=0; i--)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
      if(!g_trade.PositionClose(ticket, InpSlippagePoints))
         ok = false;
   }
   return ok;
}

// --- v1.07: set comment for a position (best effort)
bool SetPositionCommentByTicket(const ulong ticket, const string newComment)
{
   if(!PositionSelectByTicket(ticket)) return false;

   MqlTradeRequest req;
   MqlTradeResult  res;
   ZeroMemory(req);
   ZeroMemory(res);

   req.action   = TRADE_ACTION_SLTP; // modify position
   req.symbol   = PositionGetString(POSITION_SYMBOL);
   req.position = ticket;

   // Keep SL/TP unchanged
   req.sl = PositionGetDouble(POSITION_SL);
   req.tp = PositionGetDouble(POSITION_TP);

   req.magic   = (uint)PositionGetInteger(POSITION_MAGIC);
   req.comment = newComment;

   if(!OrderSend(req, res))
      return false;

   return (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_DONE_PARTIAL);
}

string BuildBasketCloseComment(const string reason, const int magic, const ENUM_POSITION_TYPE side)
{
   string tickets = "";
   int total = PositionsTotal();
   int n=0;

   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      ulong tk = (ulong)PositionGetInteger(POSITION_TICKET);
      if(n>0) tickets += ",";
      tickets += (string)tk;
      n++;
   }

   string base = StringFormat("CLOSE[%s] M=%d T=%s", reason, magic, tickets);

   // Broker comment limits vary; keep it reasonably short.
   if(StringLen(base) > 120)
      base = StringSubstr(base, 0, 120);

   return base;
}

void TagBasketPositionsBeforeClose(const string reason, const int magic, const ENUM_POSITION_TYPE side)
{
   string cmt = BuildBasketCloseComment(reason, magic, side);

   int total = PositionsTotal();
   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      ulong tk = (ulong)PositionGetInteger(POSITION_TICKET);
      SetPositionCommentByTicket(tk, cmt); // best effort
   }
}

bool CloseAllByMagicSideTagged(const string reason, const int magic, const ENUM_POSITION_TYPE side)
{
   TagBasketPositionsBeforeClose(reason, magic, side);
   return CloseAllByMagicSide(magic, side);
}

bool GetNewestOpenPrice(const int magic, const ENUM_POSITION_TYPE side, double &outPrice)
{
   bool found = false;
   datetime newest = 0;
   double price = 0.0;

   int total = PositionsTotal();
   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      datetime t = (datetime)PositionGetInteger(POSITION_TIME);
      if(!found || t > newest)
      {
         newest = t;
         price  = PositionGetDouble(POSITION_PRICE_OPEN);
         found  = true;
      }
   }

   if(found) outPrice = price;
   return found;
}

bool HasNearbyOpenPrice(const int magic, const ENUM_POSITION_TYPE side, const double rangePips)
{
   if(rangePips <= 0.0)
      return false;

   double rangePrice = PipsToPrice(rangePips, _Symbol);
   double half = rangePrice * 0.5;

   double curPrice = (side == POSITION_TYPE_BUY)
                     ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                     : SymbolInfoDouble(_Symbol, SYMBOL_BID);

   int total = PositionsTotal();
   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      double op = PositionGetDouble(POSITION_PRICE_OPEN);
      if(curPrice <= (op + half) && curPrice >= (op - half))
         return true;
   }
   return false;
}

//==================================================================//
// [410] FILTER - Volatility                                          //
//==================================================================//
bool VolatilityFilterOK()
{
   double atr = 0.0;
   if(!GetBufferValue(g_hAtrFilt, 1, atr)) return true; // fail-open

   if(InpAtrFilterUnitIsPrice)
      return (atr < InpAtrFilterMax);

   double atrPips = AtrBufferToPips(atr, _Symbol, true);
   return (atrPips < InpAtrFilterMax);
}

//==================================================================//
// [500] SIGNAL - Entry conditions                                    //
//==================================================================//
bool EntryBuySignal()
{
   double emaF0, emaS0, emaF1;
   if(!GetEMA(0, emaF0, emaS0)) return false;
   if(!GetBufferValue(g_hEmaFast, 1, emaF1)) return false;

   if(!(emaF0 > emaS0)) return false;
   if(!(emaF0 > emaF1)) return false;

   double price = iClose(_Symbol, PERIOD_CURRENT, 0);
   double distPrice = MathAbs(price - emaF0);
   double maxDistPrice = PipsToPrice((double)InpPipsDistanceToEma, _Symbol);
   if(distPrice >= maxDistPrice) return false;

   return true;
}

bool EntrySellSignal()
{
   double emaF0, emaS0, emaF1;
   if(!GetEMA(0, emaF0, emaS0)) return false;
   if(!GetBufferValue(g_hEmaFast, 1, emaF1)) return false;

   if(!(emaF0 < emaS0)) return false;
   if(!(emaF0 < emaF1)) return false;

   double price = iClose(_Symbol, PERIOD_CURRENT, 0);
   double distPrice = MathAbs(price - emaF0);
   double maxDistPrice = PipsToPrice((double)InpPipsDistanceToEma, _Symbol);
   if(distPrice >= maxDistPrice) return false;

   return true;
}


//==================================================================//
// [405] ORDER COMMENT - Sequence tagging                             //
//==================================================================//
// Format (kept short to avoid broker truncation):
//   EZ|B|001|TAG
//   EZ|S|001|TAG
string SeqSanitizeTag(string raw)
{
   // Keep tags short, ASCII-safe, and consistent across brokers.
   // Output keeps only [A-Z0-9_], max 10 chars.
   // NOTE: In MQL5 StringToUpper() modifies the string in-place and returns a count.
   // [PATCH 003] FIX: avoid assigning StringToUpper() return value into a string.
   string s = raw;
   StringToUpper(s);

   // Replace separators that could break parsing
   StringReplace(s, "|", "_");
   StringReplace(s, " ", "_");

   string out = "";
   for(int i=0; i<StringLen(s); i++)
   {
      ushort ch = (ushort)StringGetCharacter(s, i);

      // Keep simple ASCII only to avoid broker/comment encoding issues
      if(ch > 255) continue;

      bool ok = ((ch >= 'A' && ch <= 'Z') ||
                 (ch >= '0' && ch <= '9') ||
                 (ch == '_'));

      if(ok)
         out += CharToString((uchar)ch);
   }

   // Fallback should be explicit and rare (means caller passed empty/invalid tag)
   if(StringLen(out) == 0)
   {
      if(InpEnableLogs)
         Print("[SEQ] Empty/invalid tag, raw='", raw, "' -> UNK");
      out = "UNK";
   }

   if(StringLen(out) > 10)
      out = StringSubstr(out, 0, 10);

   return out;
}

int SeqParseFromComment(const string cmt)
{
   // Supports legacy "...#123" and new "EZ|B|123|TAG"
   int p = StringFind(cmt, "#");
   if(p >= 0)
   {
      string tail = StringSubstr(cmt, p+1);
      int v = (int)StringToInteger(tail);
      if(v > 0) return v;
   }

   if(StringFind(cmt, "EZ|") == 0)
   {
      string parts[];
      int n = StringSplit(cmt, '|', parts);
      if(n >= 4)
      {
         int v = (int)StringToInteger(parts[2]);
         if(v > 0) return v;
      }
   }
   return 0;
}

int SeqMaxFromOpenPositions(const bool isBuy)
{
   int magic = (isBuy ? g_magicBuy : g_magicSell);
   ENUM_POSITION_TYPE side = (isBuy ? POSITION_TYPE_BUY : POSITION_TYPE_SELL);

   int maxSeq = 0;
   int total = PositionsTotal();

   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      string cmt = PositionGetString(POSITION_COMMENT);
      int seq = SeqParseFromComment(cmt);
      if(seq > maxSeq) maxSeq = seq;
   }
   return maxSeq;
}

void SeqSyncIfNeeded(const bool isBuy)
{
   int cnt = CountPositionsByMagicSide(isBuy ? g_magicBuy : g_magicSell,
                                      isBuy ? POSITION_TYPE_BUY : POSITION_TYPE_SELL);

   if(cnt <= 0)
   {
      if(isBuy) g_seqOrderBuy = 0;
      else      g_seqOrderSell = 0;
      return;
   }

   if(isBuy)
   {
      if(g_seqOrderBuy <= 0) g_seqOrderBuy = SeqMaxFromOpenPositions(true);
   }
   else
   {
      if(g_seqOrderSell <= 0) g_seqOrderSell = SeqMaxFromOpenPositions(false);
   }
}

string SeqBuildComment(const bool isBuy, const string rawTag)
{
   SeqSyncIfNeeded(isBuy);

   int seq = 0;
   if(isBuy) seq = ++g_seqOrderBuy;
   else      seq = ++g_seqOrderSell;

   string tag = SeqSanitizeTag(rawTag);
   return StringFormat("EZ|%s|%03d|%s", (isBuy ? "B" : "S"), seq, tag);
}

//==================================================================//
// [600] TRADE - Actions                                               //
//==================================================================//
bool PlaceBuy(double vol, const string comment)
{
   if(!CanOpenNewOrdersNow()) return false;

   vol = NormalizeVolume(_Symbol, vol);
   g_trade.SetExpertMagicNumber(g_magicBuy);
   g_trade.SetDeviationInPoints(InpSlippagePoints);

   double sl = 0.0;
   // [PATCH 006] CHANGE: Counter-trend SL uses fixed POINTS distance (InpCounterTrendSL_Points).
   sl = CalcSLPriceFromFixedPoints(true);

   string cmt = SeqBuildComment(true, comment);
   bool ok = g_trade.Buy(vol, _Symbol, 0.0, sl, 0.0, cmt);
   if(!ok) Log("Buy failed: " + g_trade.ResultRetcodeDescription());
   return ok;
}

bool PlaceSell(double vol, const string comment)
{
   if(!CanOpenNewOrdersNow()) return false;

   vol = NormalizeVolume(_Symbol, vol);
   g_trade.SetExpertMagicNumber(g_magicSell);
   g_trade.SetDeviationInPoints(InpSlippagePoints);

   double sl = 0.0;
   // [PATCH 006] CHANGE: Counter-trend SL uses fixed POINTS distance (InpCounterTrendSL_Points).
   sl = CalcSLPriceFromFixedPoints(false);

   string cmt = SeqBuildComment(false, comment);
   bool ok = g_trade.Sell(vol, _Symbol, 0.0, sl, 0.0, cmt);
   if(!ok) Log("Sell failed: " + g_trade.ResultRetcodeDescription());
   return ok;
}

bool PlaceFollowBuy()
{
   if(!CanOpenNewOrdersNow()) return false;

   double vol = NormalizeVolume(_Symbol, InpLots);
   g_trade.SetExpertMagicNumber(g_magicBuy);
   g_trade.SetDeviationInPoints(InpSlippagePoints);

   double sl = 0.0;
   if(InpFollowUseSL && InpFollowSL_Pips > 0)
   {
      double slDist = PipsToPrice((double)InpFollowSL_Pips, _Symbol);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      sl = ask - slDist;
   }
   string cmt = SeqBuildComment(true, "FOL");

   bool ok = g_trade.Buy(vol, _Symbol, 0.0, sl, 0.0, cmt);
   if(!ok) Log("Follow Buy failed: " + g_trade.ResultRetcodeDescription());
   return ok;
}

bool PlaceFollowSell()
{
   if(!CanOpenNewOrdersNow()) return false;

   double vol = NormalizeVolume(_Symbol, InpLots);
   g_trade.SetExpertMagicNumber(g_magicSell);
   g_trade.SetDeviationInPoints(InpSlippagePoints);

   double sl = 0.0;
   if(InpFollowUseSL && InpFollowSL_Pips > 0)
   {
      double slDist = PipsToPrice((double)InpFollowSL_Pips, _Symbol);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      sl = bid + slDist;
   }
   string cmt = SeqBuildComment(false, "FOL");

   bool ok = g_trade.Sell(vol, _Symbol, 0.0, sl, 0.0, cmt);
   if(!ok) Log("Follow Sell failed: " + g_trade.ResultRetcodeDescription());
   return ok;
}

//==================================================================//
// [700] BASKET - Duration tracking + formatting                       //
//==================================================================//
datetime GetOldestOpenTime(const int magic, const ENUM_POSITION_TYPE side)
{
   datetime oldest = 0;
   int total = PositionsTotal();

   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((int)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

      datetime t = (datetime)PositionGetInteger(POSITION_TIME);
      if(oldest == 0 || t < oldest) oldest = t;
   }
   return oldest;
}

string FormatHMS(const int seconds)
{
   int s = seconds;
   if(s < 0) s = 0;
   int h = s / 3600; s -= h*3600;
   int m = s / 60;   s -= m*60;
   return StringFormat("%02d:%02d:%02d", h, m, s);
}

void ResetSeqOnBasketEnd(const bool isBuy)
{
   if(isBuy)
   {
      g_seqRtbBuy = 0;
      g_seqFollowBuy = 0;
      g_seqOrderBuy = 0;
   }
   else
   {
      g_seqRtsSell = 0;
      g_seqFollowSell = 0;
      g_seqOrderSell = 0;
   }
}
void OnBasketEnded(const bool isBuy, const int closeCount, const int durationSec, const bool forced)
{
   if(isBuy)
   {
      g_lastCloseCountBuy   = closeCount;
      g_lastDurationSecBuy  = durationSec;
      g_totalCloseBuy++;
      if(forced) g_totalForcedBuy++;
      if(durationSec > g_maxDurationSecBuy) g_maxDurationSecBuy = durationSec;
      if(closeCount > g_maxCloseCountBuy) g_maxCloseCountBuy = closeCount;
   }
   else
   {
      g_lastCloseCountSell  = closeCount;
      g_lastDurationSecSell = durationSec;
      g_totalCloseSell++;
      if(forced) g_totalForcedSell++;
      if(durationSec > g_maxDurationSecSell) g_maxDurationSecSell = durationSec;
      if(closeCount > g_maxCloseCountSell) g_maxCloseCountSell = closeCount;
   }

   // Reset per-basket sequence counters
   ResetSeqOnBasketEnd(isBuy);

   string side = (isBuy ? "BUY" : "SELL");

   if(forced)
   {
      Log(StringFormat("[FORCE CLOSE] %s count=%d duration=%s total=%d forced_total=%d",
                       side, closeCount, FormatHMS(durationSec),
                       (isBuy ? g_totalCloseBuy : g_totalCloseSell),
                       (isBuy ? g_totalForcedBuy : g_totalForcedSell)));
   }
   else
   {
      Log(StringFormat("[BASKET CLOSE] %s count=%d duration=%s max=%s total=%d",
                       side, closeCount, FormatHMS(durationSec),
                       FormatHMS(isBuy ? g_maxDurationSecBuy : g_maxDurationSecSell),
                       (isBuy ? g_totalCloseBuy : g_totalCloseSell)));
   }
}

//==================================================================//
// [760] BASKET - State update (start/end detection)                 //
//==================================================================//
void BasketStateUpdate()
{
   int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
   int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);

   // BUY start
   if(g_prevCntBuy <= 0 && cntB > 0)
   {
      g_basketStartBuy = GetOldestOpenTime(g_magicBuy, POSITION_TYPE_BUY);
      g_liquidatingBuy = (g_friState == EZ_STATE_FRI_SOFT || g_friState == EZ_STATE_FRI_FORCE);
   }
   // BUY end
   if(g_prevCntBuy > 0 && cntB <= 0)
   {
      int duration = (g_basketStartBuy > 0 ? (int)(TimeCurrent() - g_basketStartBuy) : 0);
      bool forced = g_liquidatingBuy;
      OnBasketEnded(true, g_prevCntBuy, duration, forced);
      g_basketStartBuy = 0;
      g_liquidatingBuy = false;
      g_buyRefInit  = false;
   }

   // SELL start
   if(g_prevCntSell <= 0 && cntS > 0)
   {
      g_basketStartSell = GetOldestOpenTime(g_magicSell, POSITION_TYPE_SELL);
      g_liquidatingSell = (g_friState == EZ_STATE_FRI_SOFT || g_friState == EZ_STATE_FRI_FORCE);
   }
   // SELL end
   if(g_prevCntSell > 0 && cntS <= 0)
   {
      int duration = (g_basketStartSell > 0 ? (int)(TimeCurrent() - g_basketStartSell) : 0);
      bool forced = g_liquidatingSell;
      OnBasketEnded(false, g_prevCntSell, duration, forced);
      g_basketStartSell = 0;
      g_liquidatingSell = false;
      g_sellRefInit  = false;
   }

   g_prevCntBuy  = cntB;
   g_prevCntSell = cntS;
}

//==================================================================//
// [800] DASH - Auto scale                                            //
//==================================================================//
void DashboardUpdateScale()
{
   double scale = 1.0;

   if(InpDashAutoScale && InpDashBaseChartW > 0)
   {
      long cw = ChartGetInteger(0, CHART_WIDTH_IN_PIXELS, 0);
      if(cw > 0)
         scale = (double)cw / (double)InpDashBaseChartW;
   }

   scale *= MathMax(0.1, InpDashUserScale);
   g_dashScale = ClampD(scale, InpDashScaleMin, InpDashScaleMax);
}

//==================================================================//
// [810] DASH - Object helpers (panel, grid, cell text)               //
//==================================================================//
void DashboardDelete()
{
   int total = ObjectsTotal(0, 0, -1);
   for(int i=total-1; i>=0; i--)
   {
      string name = ObjectName(0, i, 0, -1);

      // Only delete dashboard objects, NOT corner-info objects
      if(StringFind(name, g_dashPrefix) == 0)
      {
         if(StringFind(name, g_dashPrefix+"CI_") == 0) // skip CI_*
            continue;

         ObjectDelete(0, name);
      }
   }
}

// Use OBJPROP_BGCOLOR + OBJPROP_FILL for solid background on Mac builds.
void RectLabel(const string name, const int x, const int y, const int w, const int h, const color col, const bool back=false)
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, InpDashboardCorner);
      ObjectSetInteger(0, name, OBJPROP_BACK, back ? 1 : 0);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, 0);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, 1);

      ObjectSetInteger(0, name, OBJPROP_FILL, 1);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   }

   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, S(x));
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, S(y));
   ObjectSetInteger(0, name, OBJPROP_XSIZE,     S(w));
   ObjectSetInteger(0, name, OBJPROP_YSIZE,     S(h));

   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, col);
   ObjectSetInteger(0, name, OBJPROP_COLOR,   col);
}

void CellText(const string name, const int x, const int y, const string txt, const color col, const int fontBase)
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, InpDashboardCorner);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, 0);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, 1);
      ObjectSetString (0, name, OBJPROP_FONT, "Arial");
   }

   int fs = (int)MathMax(7.0, MathRound((double)fontBase * g_dashScale));

   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, S(x));
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, S(y));
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE,  fs);
   ObjectSetInteger(0, name, OBJPROP_COLOR,     col);
   ObjectSetString (0, name, OBJPROP_TEXT,      txt);
}

void GridLineV(const string name, const int x, const int y, const int h, const color col)
{
   RectLabel(name, x, y, MathMax(1, InpDashGridThickness), h, col, false);
}

void GridLineH(const string name, const int x, const int y, const int w, const color col)
{
   RectLabel(name, x, y, w, MathMax(1, InpDashGridThickness), col, false);
}

int SumWidth(const int &arr[], const int n)
{
   int s=0;
   for(int i=0;i<n;i++) s += arr[i];
   return s;
}

int CellX(const int gx, const int &cw[], const int col)
{
   int x = gx;
   for(int i=0;i<col;i++) x += cw[i];
   return x + 4;
}

int CellY(const int gy, const int rowH, const int row)
{
   return gy + row*rowH + 2;
}

//==================================================================//
// [820] DASH - Spreadsheet dashboard update                          //
//==================================================================//
void BasketDashboardUpdate()
{
   if(!InpEnableBasketDashboard)
   {
      DashboardDelete();
      return;
   }

   DashboardUpdateScale();

   int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
   int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);

   datetime startB = (cntB > 0 ? g_basketStartBuy : 0);
   datetime startS = (cntS > 0 ? g_basketStartSell : 0);

   int ageB = (startB > 0 ? (int)(TimeCurrent() - startB) : 0);
   int ageS = (startS > 0 ? (int)(TimeCurrent() - startS) : 0);

   int x0 = InpDashboardX;
   int y0 = InpDashboardY;

   // Columns: Side | Open | Age | LastCnt(max) | LastDur | MaxDur | Total | Forced
   int cw[8] = {50, 45, 70, 80, 70, 70, 55, 60};
   int cols = 8;
   int rows = 3;

   int pad  = InpDashPad;
   int rowH = InpDashRowH;

   int tableW = SumWidth(cw, cols);
   int tableH = rows * rowH;

   // Alpha fallback: base color still works if ARGB is ignored.
   color bg   = InpDashBgColor;
   color grid = InpDashGridColor;
   if(InpDashAlphaBG < 255)   bg   = (color)ColorToARGB(InpDashBgColor,   (uchar)InpDashAlphaBG);
   if(InpDashAlphaGrid < 255) grid = (color)ColorToARGB(InpDashGridColor, (uchar)InpDashAlphaGrid);

   color txt  = InpDashTextColor;

   RectLabel(g_dashPrefix+"PANEL", x0, y0, tableW + pad*2, tableH + pad*2, bg, false);

   int gx = x0 + pad;
   int gy = y0 + pad;

   GridLineH(g_dashPrefix+"G_TOP",   gx,          gy,          tableW, grid);
   GridLineH(g_dashPrefix+"G_BOT",   gx,          gy+tableH,   tableW, grid);
   GridLineV(g_dashPrefix+"G_LEFT",  gx,          gy,          tableH, grid);
   GridLineV(g_dashPrefix+"G_RIGHT", gx+tableW,   gy,          tableH, grid);

   for(int r=1; r<rows; r++)
      GridLineH(g_dashPrefix+"GH_"+(string)r, gx, gy + r*rowH, tableW, grid);

   int xx = gx;
   for(int c=1; c<cols; c++)
   {
      xx += cw[c-1];
      GridLineV(g_dashPrefix+"GV_"+(string)c, xx, gy, tableH, grid);
   }

   // Header row
   CellText(g_dashPrefix+"H0", CellX(gx, cw, 0), CellY(gy, rowH, 0), "Side",    txt, InpDashFontSize);
   CellText(g_dashPrefix+"H1", CellX(gx, cw, 1), CellY(gy, rowH, 0), "Open",    txt, InpDashFontSize);
   CellText(g_dashPrefix+"H2", CellX(gx, cw, 2), CellY(gy, rowH, 0), "Age",     txt, InpDashFontSize);
   CellText(g_dashPrefix+"H3", CellX(gx, cw, 3), CellY(gy, rowH, 0), "LastCnt", txt, InpDashFontSize); // shows MAX closed count
   CellText(g_dashPrefix+"H4", CellX(gx, cw, 4), CellY(gy, rowH, 0), "LastDur", txt, InpDashFontSize);
   CellText(g_dashPrefix+"H5", CellX(gx, cw, 5), CellY(gy, rowH, 0), "MaxDur",  txt, InpDashFontSize);
   CellText(g_dashPrefix+"H6", CellX(gx, cw, 6), CellY(gy, rowH, 0), "Total",   txt, InpDashFontSize);
   CellText(g_dashPrefix+"H7", CellX(gx, cw, 7), CellY(gy, rowH, 0), "Forced",  txt, InpDashFontSize);

   // BUY row
   CellText(g_dashPrefix+"B0", CellX(gx, cw, 0), CellY(gy, rowH, 1), "BUY", txt, InpDashFontSize);
   CellText(g_dashPrefix+"B1", CellX(gx, cw, 1), CellY(gy, rowH, 1), StringFormat("%d", cntB), txt, InpDashFontSize);
   CellText(g_dashPrefix+"B2", CellX(gx, cw, 2), CellY(gy, rowH, 1), FormatHMS(ageB), txt, InpDashFontSize);
   CellText(g_dashPrefix+"B3", CellX(gx, cw, 3), CellY(gy, rowH, 1), StringFormat("%d", g_maxCloseCountBuy), txt, InpDashFontSize);
   CellText(g_dashPrefix+"B4", CellX(gx, cw, 4), CellY(gy, rowH, 1), FormatHMS(g_lastDurationSecBuy), txt, InpDashFontSize);
   CellText(g_dashPrefix+"B5", CellX(gx, cw, 5), CellY(gy, rowH, 1), FormatHMS(g_maxDurationSecBuy), txt, InpDashFontSize);
   CellText(g_dashPrefix+"B6", CellX(gx, cw, 6), CellY(gy, rowH, 1), StringFormat("%d", g_totalCloseBuy), txt, InpDashFontSize);
   CellText(g_dashPrefix+"B7", CellX(gx, cw, 7), CellY(gy, rowH, 1), StringFormat("%d", g_totalForcedBuy), txt, InpDashFontSize);

   // SELL row
   CellText(g_dashPrefix+"S0", CellX(gx, cw, 0), CellY(gy, rowH, 2), "SELL", txt, InpDashFontSize);
   CellText(g_dashPrefix+"S1", CellX(gx, cw, 1), CellY(gy, rowH, 2), StringFormat("%d", cntS), txt, InpDashFontSize);
   CellText(g_dashPrefix+"S2", CellX(gx, cw, 2), CellY(gy, rowH, 2), FormatHMS(ageS), txt, InpDashFontSize);
   CellText(g_dashPrefix+"S3", CellX(gx, cw, 3), CellY(gy, rowH, 2), StringFormat("%d", g_maxCloseCountSell), txt, InpDashFontSize);
   CellText(g_dashPrefix+"S4", CellX(gx, cw, 4), CellY(gy, rowH, 2), FormatHMS(g_lastDurationSecSell), txt, InpDashFontSize);
   CellText(g_dashPrefix+"S5", CellX(gx, cw, 5), CellY(gy, rowH, 2), FormatHMS(g_maxDurationSecSell), txt, InpDashFontSize);
   CellText(g_dashPrefix+"S6", CellX(gx, cw, 6), CellY(gy, rowH, 2), StringFormat("%d", g_totalCloseSell), txt, InpDashFontSize);
   CellText(g_dashPrefix+"S7", CellX(gx, cw, 7), CellY(gy, rowH, 2), StringFormat("%d", g_totalForcedSell), txt, InpDashFontSize);

   // [PATCH 009] FIX: Do NOT force ChartRedraw() here.
   // MT5 will redraw after object property updates; forced redraw can cause flicker (Tester/visual mode).
}


//==================================================================//
// [830] UI - Bottom-right quick stats (simple overlay)               //
// [PATCH 008] NEW: Show key values in bottom-right corner.           //
// Notes:                                                             //
// - Uses the existing auto-scale system (g_dashScale).               //
// - Uses separate labels to mimic two-color text (value + title).    //
// - No new inputs were added (to keep Inputs panel minimal).         //
//==================================================================//

// Visual style (edit here if needed)
bool  g_cornerInfoEnabled = true; // runtime mirror of input
color g_cornerValueColor  = clrYellow;
color g_cornerTextColor   = clrDeepSkyBlue;
int   g_cornerFontBase    = 6;   // will be scaled by g_dashScale
int   g_cornerCorner      = 2;    // 0=TL,1=TR,2=BL,3=BR
int   g_cornerX           = 10;   // distance from corner (px, scaled)
int   g_cornerY           = 40;   // distance from corner (px, scaled)
int   g_cornerLineGap     = 18;   // vertical gap between lines (px, scaled)
int   g_cornerValueX      = 120;  // value column x (from corner, px, scaled)
int   g_cornerTextX       = 10;   // text column x (from corner, px, scaled)

// Create/update one label (OBJ_LABEL) in a fixed corner
void CornerLabel(const string name,
                 const int corner,
                 const int x,
                 const int y,
                 const string txt,
                 const color col,
                 const int fontBase,
                 const ENUM_ANCHOR_POINT anchor=ANCHOR_RIGHT_LOWER)
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, corner);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, 0);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, 1);
      ObjectSetString (0, name, OBJPROP_FONT, "Arial");
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, anchor);
   }

   int fs = (int)MathMax(7.0, MathRound((double)fontBase * g_dashScale));

   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, S(x));
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, S(y));
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE,  fs);
   ObjectSetInteger(0, name, OBJPROP_COLOR,     col);
   ObjectSetString (0, name, OBJPROP_TEXT,      txt);
}

/* // === Remove ===
void CornerInfoDelete()
{
   // Delete only the quick-stats labels (prefix)
   int total = ObjectsTotal(0, 0, -1);
   for(int i=total-1; i>=0; i--)
   {
      string name = ObjectName(0, i, 0, -1);
      if(StringFind(name, g_dashPrefix+"CI_") == 0)
         ObjectDelete(0, name);
   }
}

void CornerInfoUpdate()
{
   g_cornerInfoEnabled = InpShowCornerInfo;

   if(!g_cornerInfoEnabled)
   {
      CornerInfoDelete();
      return;
   }

   // Keep the same scale behavior as dashboard
   DashboardUpdateScale();

   // [PATCH] Keep CornerInfo font/spacing consistent with dashboard inputs
   g_cornerFontBase = InpDashFontSize+2;
   g_cornerLineGap  = MathMax(InpDashRowH + 2, InpDashFontSize + 6);

   double pBuy  = BasketProfitByMagicSide(g_magicBuy,  POSITION_TYPE_BUY);
   double pSell = BasketProfitByMagicSide(g_magicSell, POSITION_TYPE_SELL);

   int cBuy  = CountPositionsByMagicSide(g_magicBuy,  POSITION_TYPE_BUY);
   int cSell = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);

   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);

   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point <= 0.0) point = 0.00001;
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   int spreadPts = (int)MathRound((ask - bid) / point);

   // Build lines (value + title) to mimic "0.0 Profit Sell"
   string v0 = StringFormat("%.1f", pSell);
   string t0 = "Profit Sell";

   string v1 = StringFormat("%.1f", pBuy);
   string t1 = "Profit Buy";

   string v2 = StringFormat("%d", cSell);
   string t2 = "Count Sell";

   string v3 = StringFormat("%d", cBuy);
   string t3 = "Count Buy";

   string v4 = StringFormat("%.2f", equity);
   string t4 = "Equity";

   string v5 = StringFormat("%.2f", balance);
   string t5 = "Balance";

   string v6 = StringFormat("%d", spreadPts);
   string t6 = "Spread";

   // --- EA Title (bottom line) ---
   string title = "EASYGOLD Farming";
   int    titleFontBase = g_cornerFontBase+6;
   color  titleColor    = clrGold;

   int titleY = g_cornerY - g_cornerLineGap*3;

   CornerLabel(g_dashPrefix+"CI_TITLE", g_cornerCorner, g_cornerTextX, titleY,
               title, titleColor, titleFontBase, ANCHOR_RIGHT_LOWER);

   const int baseY = g_cornerY;

   // Line 0 (top) -> Line 6 (bottom)
   // Use anchor RIGHT_LOWER so text grows to the left from the corner.
   CornerLabel(g_dashPrefix+"CI_V0", g_cornerCorner, g_cornerValueX, baseY + g_cornerLineGap*6, v0, g_cornerValueColor, g_cornerFontBase, ANCHOR_RIGHT_LOWER);
   CornerLabel(g_dashPrefix+"CI_T0", g_cornerCorner, g_cornerTextX,  baseY + g_cornerLineGap*6, t0, g_cornerTextColor,  g_cornerFontBase, ANCHOR_RIGHT_LOWER);

   CornerLabel(g_dashPrefix+"CI_V1", g_cornerCorner, g_cornerValueX, baseY + g_cornerLineGap*5, v1, g_cornerValueColor, g_cornerFontBase, ANCHOR_RIGHT_LOWER);
   CornerLabel(g_dashPrefix+"CI_T1", g_cornerCorner, g_cornerTextX,  baseY + g_cornerLineGap*5, t1, g_cornerTextColor,  g_cornerFontBase, ANCHOR_RIGHT_LOWER);

   CornerLabel(g_dashPrefix+"CI_V2", g_cornerCorner, g_cornerValueX, baseY + g_cornerLineGap*4, v2, g_cornerValueColor, g_cornerFontBase, ANCHOR_RIGHT_LOWER);
   CornerLabel(g_dashPrefix+"CI_T2", g_cornerCorner, g_cornerTextX,  baseY + g_cornerLineGap*4, t2, g_cornerTextColor,  g_cornerFontBase, ANCHOR_RIGHT_LOWER);

   CornerLabel(g_dashPrefix+"CI_V3", g_cornerCorner, g_cornerValueX, baseY + g_cornerLineGap*3, v3, g_cornerValueColor, g_cornerFontBase, ANCHOR_RIGHT_LOWER);
   CornerLabel(g_dashPrefix+"CI_T3", g_cornerCorner, g_cornerTextX,  baseY + g_cornerLineGap*3, t3, g_cornerTextColor,  g_cornerFontBase, ANCHOR_RIGHT_LOWER);

   CornerLabel(g_dashPrefix+"CI_V4", g_cornerCorner, g_cornerValueX, baseY + g_cornerLineGap*2, v4, g_cornerValueColor, g_cornerFontBase, ANCHOR_RIGHT_LOWER);
   CornerLabel(g_dashPrefix+"CI_T4", g_cornerCorner, g_cornerTextX,  baseY + g_cornerLineGap*2, t4, g_cornerTextColor,  g_cornerFontBase, ANCHOR_RIGHT_LOWER);

   CornerLabel(g_dashPrefix+"CI_V5", g_cornerCorner, g_cornerValueX, baseY + g_cornerLineGap*1, v5, g_cornerValueColor, g_cornerFontBase, ANCHOR_RIGHT_LOWER);
   CornerLabel(g_dashPrefix+"CI_T5", g_cornerCorner, g_cornerTextX,  baseY + g_cornerLineGap*1, t5, g_cornerTextColor,  g_cornerFontBase, ANCHOR_RIGHT_LOWER);

   CornerLabel(g_dashPrefix+"CI_V6", g_cornerCorner, g_cornerValueX, baseY + g_cornerLineGap*0, v6, g_cornerValueColor, g_cornerFontBase, ANCHOR_RIGHT_LOWER);
   CornerLabel(g_dashPrefix+"CI_T6", g_cornerCorner, g_cornerTextX,  baseY + g_cornerLineGap*0, t6, g_cornerTextColor,  g_cornerFontBase, ANCHOR_RIGHT_LOWER);
}
// === Remove === */


//==================================================================//
// [850] FRIDAY PLAN - Soft liquidation / Force close                //
//==================================================================//
bool SelectFarthestPositionToClose(const bool allowBuy, const bool allowSell, ulong &outTicket)
{
   outTicket = 0;
   double bestDist = -1.0;

   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point <= 0.0) point = 0.00001;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   int total = PositionsTotal();
   for(int i=0; i<total; i++)
   {
      if(!SelectPositionByIndex(i)) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;

      int magic = (int)PositionGetInteger(POSITION_MAGIC);
      ENUM_POSITION_TYPE side = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

      bool isBuyPos = (side == POSITION_TYPE_BUY);
      if(isBuyPos)
      {
         if(!allowBuy) continue;
         if(magic != g_magicBuy) continue;
      }
      else
      {
         if(!allowSell) continue;
         if(magic != g_magicSell) continue;
      }

      double op = PositionGetDouble(POSITION_PRICE_OPEN);
      double cur = isBuyPos ? bid : ask;
      double dist = MathAbs(cur - op) / point;

      if(dist > bestDist)
      {
         bestDist = dist;
         outTicket = (ulong)PositionGetInteger(POSITION_TICKET);
      }
   }
   return (outTicket != 0);
}

void SoftLiquidateStep()
{
   datetime now = TimeCurrent();

   // stagger delay
   if(g_lastSoftCloseTime > 0 && (now - g_lastSoftCloseTime) < (datetime)InpFridayStaggerCloseDelay_Sec)
      return;

   int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
   int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);
   if(cntB <= 0 && cntS <= 0) return;

   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point <= 0.0) point = 0.00001;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   int trig = (InpFridayRetraceTrigger_Points < 0 ? 0 : InpFridayRetraceTrigger_Points);
   double trigPx = trig * point;

   // Update reference trackers (reference follows price in current direction; close when retrace from reference >= trigger)
   bool allowBuyClose  = false;
   bool allowSellClose = false;

   if(cntB > 0)
   {
      double p = bid;
      if(!g_buyRefInit)
      {
         g_buyRefInit  = true;
         g_buyRefPrice = p;
         g_buyRefDir   = 0;
      }
      else
      {
         if(g_buyRefDir == 0)
         {
            if(p > g_buyRefPrice) { g_buyRefDir = 1;  g_buyRefPrice = p; }
            else if(p < g_buyRefPrice) { g_buyRefDir = -1; g_buyRefPrice = p; }
         }
         else if(g_buyRefDir == 1)
         {
            if(p > g_buyRefPrice) g_buyRefPrice = p;
            else if((g_buyRefPrice - p) >= trigPx) allowBuyClose = true;
         }
         else // -1
         {
            if(p < g_buyRefPrice) g_buyRefPrice = p;
            else if((p - g_buyRefPrice) >= trigPx) allowBuyClose = true;
         }
      }
   }
   else
   {
      g_buyRefInit  = false;
      g_buyRefDir   = 0;
      g_buyRefPrice = 0.0;
   }

   if(cntS > 0)
   {
      double p = ask;
      if(!g_sellRefInit)
      {
         g_sellRefInit  = true;
         g_sellRefPrice = p;
         g_sellRefDir   = 0;
      }
      else
      {
         if(g_sellRefDir == 0)
         {
            if(p > g_sellRefPrice) { g_sellRefDir = 1;  g_sellRefPrice = p; }
            else if(p < g_sellRefPrice) { g_sellRefDir = -1; g_sellRefPrice = p; }
         }
         else if(g_sellRefDir == 1)
         {
            if(p > g_sellRefPrice) g_sellRefPrice = p;
            else if((g_sellRefPrice - p) >= trigPx) allowSellClose = true;
         }
         else // -1
         {
            if(p < g_sellRefPrice) g_sellRefPrice = p;
            else if((p - g_sellRefPrice) >= trigPx) allowSellClose = true;
         }
      }
   }
   else
   {
      g_sellRefInit  = false;
      g_sellRefDir   = 0;
      g_sellRefPrice = 0.0;
   }

   if(!allowBuyClose && !allowSellClose)
      return;

   ulong tk = 0;
   if(!SelectFarthestPositionToClose(allowBuyClose, allowSellClose, tk))
      return;

   // Best effort: set close reason on this ticket only.
   string cmt = "CLOSE[FSL]";
   SetPositionCommentByTicket(tk, cmt);

   // Determine which side this ticket is before closing (for ref dir flip)
   bool isBuyTicket = false;
   if(PositionSelectByTicket((ulong)tk))
      isBuyTicket = ((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);

   if(g_trade.PositionClose(tk, InpSlippagePoints))
   {
      g_lastSoftCloseTime = now;

      // Flip the reference direction for the closed side and start tracking from current price.
      if(isBuyTicket && g_buyRefInit)
      {
         double p = bid;
         if(g_buyRefDir == 1) g_buyRefDir = -1;
         else if(g_buyRefDir == -1) g_buyRefDir = 1;
         else g_buyRefDir = 0;
         g_buyRefPrice = p;
      }
      if(!isBuyTicket && g_sellRefInit)
      {
         double p = ask;
         if(g_sellRefDir == 1) g_sellRefDir = -1;
         else if(g_sellRefDir == -1) g_sellRefDir = 1;
         else g_sellRefDir = 0;
         g_sellRefPrice = p;
      }

      Log(StringFormat("[FRI] Soft close ticket=%I64d", (long)tk));
   }
   else
   {
      Log("[FRI] Soft close failed: " + g_trade.ResultRetcodeDescription());
   }
}

void FridayPlanUpdate()
{
   datetime now = TimeCurrent();

   bool early = IsEarlyCloseDay(now);
   bool fri   = IsFriday(now);
   bool activeDay = (fri || early);

   // Resume after weekend pause (Friday)
   if(g_friState == EZ_STATE_WEEKEND_PAUSE)
   {
      if(IsMonday(now) && CanOpenNewOrdersNow())
      {
         g_friState = EZ_STATE_NORMAL;

         g_buyRefInit = false;
         g_sellRefInit = false;
         g_buyRefDir = 0;
         g_sellRefDir = 0;
         g_buyRefPrice = 0.0;
         g_sellRefPrice = 0.0;
         g_lastSoftCloseTime = 0;

         Log("[FRI] Resume NORMAL (Monday)");
      }
      return;
   }

   // Resume after early-close day pause (next day)
   if(g_friState == EZ_STATE_EARLYDAY_PAUSE)
   {
      if(!early && CanOpenNewOrdersNow())
      {
         g_friState = EZ_STATE_NORMAL;

         g_buyRefInit = false;
         g_sellRefInit = false;
         g_buyRefDir = 0;
         g_sellRefDir = 0;
         g_buyRefPrice = 0.0;
         g_sellRefPrice = 0.0;
         g_lastSoftCloseTime = 0;

         Log("[ECL] Resume NORMAL (next day)");
      }
      return;
   }

   int ttc = TimeToDailyCloseSec(now);

   // [PATCH 005] NEW: shift all Friday thresholds earlier by 8 hours on the selected date
   int addH   = (early ? 8 : 0);
   int startH = InpFridayStartBeforeClose_Hours + addH;
   int softH  = InpFridaySoftCloseWindow_Hours  + addH;
   int forceH = InpFridayForceCloseBefore_Hours + addH;

   int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
   int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);
   int totalPos = cntB + cntS;

   // Trigger manage mode (Friday OR early-close day)
   if(activeDay && g_friState == EZ_STATE_NORMAL)
   {
      double dayProfit = ClosedProfitSince(DayStart(now));
      if(dayProfit >= InpFridayProfitTargetMoney || ttc <= startH * 3600)
      {
         g_friState = EZ_STATE_FRI_MANAGE;
         Log(StringFormat("[%s] Start MANAGE (profit=%.2f, ttc=%ds)", (early ? "ECL" : "FRI"), dayProfit, ttc));
      }
   }

   // Transition to SOFT
   if(activeDay && g_friState == EZ_STATE_FRI_MANAGE)
   {
      if(ttc <= softH * 3600)
      {
         g_friState = EZ_STATE_FRI_SOFT;

         g_lastSoftCloseTime = 0;
         g_buyRefInit = false;
         g_sellRefInit = false;
         g_buyRefDir = 0;
         g_sellRefDir = 0;
         g_buyRefPrice = 0.0;
         g_sellRefPrice = 0.0;

         // Mark current baskets as liquidation/forced closure (for stats).
         if(cntB > 0) g_liquidatingBuy  = true;
         if(cntS > 0) g_liquidatingSell = true;

         Log(StringFormat("[%s] Enter SOFT liquidation (no new/rescue)", (early ? "ECL" : "FRI")));
      }
   }

   // Transition to FORCE
   if(activeDay && g_friState == EZ_STATE_FRI_SOFT)
   {
      if(ttc <= forceH * 3600)
      {
         g_friState = EZ_STATE_FRI_FORCE;
         Log(StringFormat("[%s] Enter FORCE close", (early ? "ECL" : "FRI")));
      }
   }

   // Actions
   if(activeDay && g_friState == EZ_STATE_FRI_SOFT)
   {
      // no rescue allowed in soft mode
      SoftLiquidateStep();
   }

   if(activeDay && g_friState == EZ_STATE_FRI_FORCE)
   {
      if(cntB > 0) g_liquidatingBuy  = true;
      if(cntS > 0) g_liquidatingSell = true;

      if(cntB > 0) CloseAllByMagicSideTagged("FRC", g_magicBuy, POSITION_TYPE_BUY);
      if(cntS > 0) CloseAllByMagicSideTagged("FRC", g_magicSell, POSITION_TYPE_SELL);
   }

   // All closed => pause
   if(activeDay && (g_friState == EZ_STATE_FRI_MANAGE || g_friState == EZ_STATE_FRI_SOFT || g_friState == EZ_STATE_FRI_FORCE) && totalPos == 0)
   {
      g_buyRefInit = false;
      g_sellRefInit = false;
      g_lastSoftCloseTime = 0;

      if(fri)
      {
         g_friState = EZ_STATE_WEEKEND_PAUSE;
         Log("[FRI] All positions closed => WEEKEND PAUSE");
      }
      else if(early)
      {
         g_friState = EZ_STATE_EARLYDAY_PAUSE;
         Log("[ECL] All positions closed => DAY PAUSE");
      }
      else
      {
         g_friState = EZ_STATE_NORMAL;
      }
   }
}

//==================================================================//
// [885] TEST - Age-based force close (isolated module)               //
//==================================================================//
// [PATCH 007] NEW: Optional hard cut by basket age (per side).
// Does not change other states; it only closes positions.
void AgeForceCloseUpdate()
{
   if(!InpEnableAgeForceClose) return;
   if(InpAgeForceClose_Hours <= 0) return;

   datetime now = TimeCurrent();
   const int retrySec = 30; // simple anti-spam retry gate

   static datetime lastBuyTry  = 0;
   static datetime lastSellTry = 0;

   // BUY side
   int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
   if(cntB > 0)
   {
      datetime oldest = GetOldestOpenTime(g_magicBuy, POSITION_TYPE_BUY);
      int ageSec = (oldest > 0 ? (int)(now - oldest) : 0);

      if(ageSec >= InpAgeForceClose_Hours * 3600)
      {
         if(lastBuyTry == 0 || (now - lastBuyTry) >= retrySec)
         {
            lastBuyTry = now;
            Log(StringFormat("[AGE] Force close BUY cnt=%d age=%s", cntB, FormatHMS(ageSec)));
            CloseAllByMagicSideTagged("AGE", g_magicBuy, POSITION_TYPE_BUY);
         }
      }
   }
   else
   {
      lastBuyTry = 0;
   }

   // SELL side
   int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);
   if(cntS > 0)
   {
      datetime oldest = GetOldestOpenTime(g_magicSell, POSITION_TYPE_SELL);
      int ageSec = (oldest > 0 ? (int)(now - oldest) : 0);

      if(ageSec >= InpAgeForceClose_Hours * 3600)
      {
         if(lastSellTry == 0 || (now - lastSellTry) >= retrySec)
         {
            lastSellTry = now;
            Log(StringFormat("[AGE] Force close SELL cnt=%d age=%s", cntS, FormatHMS(ageSec)));
            CloseAllByMagicSideTagged("AGE", g_magicSell, POSITION_TYPE_SELL);
         }
      }
   }
   else
   {
      lastSellTry = 0;
   }
}
//==================================================================//
// [900] BASKET - Time limit + Fast-Stuck enforce                      //
//==================================================================//
//==================================================================//
// [900] (REMOVED) Time-limit + Fast-stuck + Cooldown
//==================================================================//

//==================================================================//
// [1000] CORE - Entry / Rescue / Follow / Basket close               //
//==================================================================//
void TryEntry()
{
   if(InpModeBuy && !IsSideInCooldown(true))
   {
      int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
      if(cntB == 0 && EntryBuySignal() && OncePerBar(g_lastEntryBuyBar))
      {
         if(PlaceBuy(InpLots, "ENT"))
            g_lotsB = InpLots;
      }
   }

   if(InpModeSell && !IsSideInCooldown(false))
   {
      int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);
      if(cntS == 0 && EntrySellSignal() && OncePerBar(g_lastEntrySellBar))
      {
         if(PlaceSell(InpLots, "ENT"))
            g_lotsS = InpLots;
      }
   }
}

void TryRescue()
{
   // BUY rescue
   if(InpModeBuy && !IsSideInCooldown(true))
   {
      int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
      if(cntB > 0 && cntB < InpMaxOrderLoss && VolatilityFilterOK())
      {
         double newestOpen = 0.0;
         if(GetNewestOpenPrice(g_magicBuy, POSITION_TYPE_BUY, newestOpen))
         {
            double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
            if(price < newestOpen)
            {
               double atr = 0.0;
               if(GetBufferValue(g_hAtrGrid, 0, atr))
               {
                  double atrPips  = AtrBufferToPips(atr, _Symbol, InpAtrGridUnitIsPrice);
                  double gridPips = atrPips * InpRTB_AtrMultiplier;

                  if(!HasNearbyOpenPrice(g_magicBuy, POSITION_TYPE_BUY, gridPips) && OncePerBar(g_lastRescueBuyBar))
                  {
                     if(g_lotsB <= 0.0) g_lotsB = InpLots;
                  if(PlaceBuy(g_lotsB, "RTB"))
                     {
                        g_lotsB += InpLotPlusB;
                        if(g_lotsB > InpUpperLimitLotSize) g_lotsB = InpUpperLimitLotSize;
                     }
                  }
               }
            }
         }
      }
   }

   // SELL rescue
   if(InpModeSell && !IsSideInCooldown(false))
   {
      int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);
      if(cntS > 0 && cntS < InpMaxOrderLoss && VolatilityFilterOK())
      {
         double newestOpen = 0.0;
         if(GetNewestOpenPrice(g_magicSell, POSITION_TYPE_SELL, newestOpen))
         {
            double price = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
            if(price > newestOpen)
            {
               double atr = 0.0;
               if(GetBufferValue(g_hAtrGrid, 0, atr))
               {
                  double atrPips  = AtrBufferToPips(atr, _Symbol, InpAtrGridUnitIsPrice);
                  double gridPips = atrPips * InpRTS_AtrMultiplier;

                  if(!HasNearbyOpenPrice(g_magicSell, POSITION_TYPE_SELL, gridPips) && OncePerBar(g_lastRescueSellBar))
                  {
                     if(g_lotsS <= 0.0) g_lotsS = InpLots;
                  if(PlaceSell(g_lotsS, "RTS"))
                     {
                        g_lotsS += InpLotPlusS;
                        if(g_lotsS > InpUpperLimitLotSize) g_lotsS = InpUpperLimitLotSize;
                     }
                  }
               }
            }
         }
      }
   }
}

double ResolveFollowGridPips()
{
   if(InpFollowGridPips > 0.0) return InpFollowGridPips;

   if(InpFollowAtrMult > 0.0)
   {
      double atr = 0.0;
      if(GetBufferValue(g_hAtrGrid, 0, atr))
      {
         double atrPips = AtrBufferToPips(atr, _Symbol, InpAtrGridUnitIsPrice);
         return atrPips * InpFollowAtrMult;
      }
   }
   return 0.0;
}

void TryFollow()
{
   double followGridPips = ResolveFollowGridPips();

   if(InpModeBuy && !IsSideInCooldown(true))
   {
      int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
      if(cntB > 0)
      {
         double newestOpen = 0.0;
         if(GetNewestOpenPrice(g_magicBuy, POSITION_TYPE_BUY, newestOpen))
         {
            double price = iClose(_Symbol, PERIOD_CURRENT, 0);
            if(price > newestOpen && !HasNearbyOpenPrice(g_magicBuy, POSITION_TYPE_BUY, followGridPips) && OncePerBar(g_lastFollowBuyBar))
               PlaceFollowBuy();
         }
      }
   }

   if(InpModeSell && !IsSideInCooldown(false))
   {
      int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);
      if(cntS > 0)
      {
         double newestOpen = 0.0;
         if(GetNewestOpenPrice(g_magicSell, POSITION_TYPE_SELL, newestOpen))
         {
            double price = iClose(_Symbol, PERIOD_CURRENT, 0);
            if(price < newestOpen && !HasNearbyOpenPrice(g_magicSell, POSITION_TYPE_SELL, followGridPips) && OncePerBar(g_lastFollowSellBar))
               PlaceFollowSell();
         }
      }
   }
}

void TryBasketClose()
{
   int cntB = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
   if(cntB >= 2)
   {
      double pB = BasketProfitByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
      if(pB >= InpCloseMoney)
         CloseAllByMagicSideTagged("TP", g_magicBuy, POSITION_TYPE_BUY);
   }

   int cntS = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);
   if(cntS >= 2)
   {
      double pS = BasketProfitByMagicSide(g_magicSell, POSITION_TYPE_SELL);
      if(pS >= InpCloseMoney)
         CloseAllByMagicSideTagged("TP", g_magicSell, POSITION_TYPE_SELL);
   }
}

//==================================================================//
// [1100] MT5 - Events                                                //
//==================================================================//

//==================================================================//
// [1100] MT5 - Events                                                //
//==================================================================//
void OnTimer()
{
   // update scale + UI even when no ticks
   // V1.01 display-only change: disable legacy dashboard rendering.
   // DashboardUpdateScale();
   // CornerInfoUpdate();
   // BasketDashboardUpdate();

   // [PATCH 009] FIX: Do NOT force ChartRedraw() here.
   // Forced redraw every timer tick can cause flicker (especially in Strategy Tester visual mode).
   EG_Farming_MonitorOnTimer();
}

int OnInit()
{
   /*==============================================
   string lic_reason="";
   g_license_ok = LicenseCheck(lic_reason);

   if(!g_license_ok)
   {
      Print("[LICENSE] BLOCKED: ", lic_reason);

      if(LIC_FAIL_INIT_IF_INVALID)
         return INIT_FAILED;   // EA won't run at all
   }
   ============================================== */

   EventSetTimer(1);   // update every 1 second
   // g_cornerInfoEnabled = InpShowCornerInfo;

   g_magicBuy  = InpMagicStart + 1;
   g_magicSell = InpMagicStart + 2;

   g_lotsB = InpLots;
   g_lotsS = InpLots;

   g_hEmaFast = iMA(_Symbol, PERIOD_CURRENT, InpEmaFastPeriod, 0, MODE_EMA, PRICE_CLOSE);
   g_hEmaSlow = iMA(_Symbol, PERIOD_CURRENT, InpEmaSlowPeriod, 0, MODE_EMA, PRICE_CLOSE);
   g_hAtrGrid = iATR(_Symbol, PERIOD_CURRENT, InpAtrGridPeriod);
   g_hAtrFilt = iATR(_Symbol, PERIOD_CURRENT, InpAtrFilterPeriod);

   if(g_hEmaFast == INVALID_HANDLE || g_hEmaSlow == INVALID_HANDLE ||
      g_hAtrGrid  == INVALID_HANDLE || g_hAtrFilt  == INVALID_HANDLE)
   {
      Print("Failed to create indicator handles.");
      return INIT_FAILED;
   }

   g_lastBarTime = iTime(_Symbol, PERIOD_CURRENT, 0);

   // Initialize basket state (in case EA starts mid-basket)
   g_prevCntBuy  = CountPositionsByMagicSide(g_magicBuy, POSITION_TYPE_BUY);
   g_prevCntSell = CountPositionsByMagicSide(g_magicSell, POSITION_TYPE_SELL);

   if(g_prevCntBuy > 0)  g_basketStartBuy  = GetOldestOpenTime(g_magicBuy, POSITION_TYPE_BUY);
   if(g_prevCntSell > 0) g_basketStartSell = GetOldestOpenTime(g_magicSell, POSITION_TYPE_SELL);

   // Sync per-basket sequence from open positions (restart-safe)
   if(g_prevCntBuy > 0)  g_seqOrderBuy  = SeqMaxFromOpenPositions(true);
   if(g_prevCntSell > 0) g_seqOrderSell = SeqMaxFromOpenPositions(false);

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double pip = PipSize(_Symbol);

   Log(StringFormat("Init OK v1.08 | Symbol=%s digits=%d point=%.6f pip=%.6f | BuyMagic=%d SellMagic=%d",
                    _Symbol, digits, point, pip, g_magicBuy, g_magicSell));

   // [PATCH 005] NEW: parse early-close date input
   if(StringLen(InpEarlyCloseDate) > 0)
   {
      if(InitEarlyCloseDate())
         Log(StringFormat("EarlyCloseDate enabled: %d (YYYYMMDD)", g_earlyCloseDateId));
      else
         Log("EarlyCloseDate parse failed (use YYYY.MM.DD)");
   }

   // BasketDashboardUpdate();
   
      // V1.01 display-only change:
   // Remove legacy dashboard objects before showing the new monitor panel.
   DashboardDelete();
   // CornerInfoDelete();
   EG_Farming_MonitorInit();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EG_Farming_MonitorDeinit();
   
   EventKillTimer();
   DashboardDelete();
   // CornerInfoDelete(); // [PATCH 008]

   if(g_hEmaFast != INVALID_HANDLE) IndicatorRelease(g_hEmaFast);
   if(g_hEmaSlow != INVALID_HANDLE) IndicatorRelease(g_hEmaSlow);
   if(g_hAtrGrid != INVALID_HANDLE) IndicatorRelease(g_hAtrGrid);
   if(g_hAtrFilt != INVALID_HANDLE) IndicatorRelease(g_hAtrFilt);
}

void OnTick()
{
   /*==============================================
   if(!g_license_ok)
      return;
   ============================================== */
   
   IsNewBar();

   // Friday profit lock / weekend pause state machine
   FridayPlanUpdate();

   // Trading gates by state
   bool allowEntryFollow = (g_friState == EZ_STATE_NORMAL) && CanOpenNewOrdersNow();
   bool allowRescue      = (g_friState == EZ_STATE_NORMAL || g_friState == EZ_STATE_FRI_MANAGE) && CanOpenNewOrdersNow();

   if(allowEntryFollow)
      TryEntry();

   if(allowRescue)
      TryRescue();

   if(allowEntryFollow)
      TryFollow();

   // Basket close is always allowed (it reduces exposure)
   TryBasketClose();

   // [PATCH 007] Test module: age-based force close (optional)
   AgeForceCloseUpdate();

   // Update basket start/end + dashboard values
   BasketStateUpdate();
   EG_Farming_MonitorOnTick();
}
