//+------------------------------------------------------------------+
//|  EASY_M v1.0 10P e1.1.mq5                       |
//|  Multi-Symbol MVP (10 correlation pairs = 20 symbols)              |
//|   with manual edit 4th. all dashboard scale use.                  |
//|      manual edit5. mini RSI+wick signal
//|      edit 6.  Portfolio 3 Mode: NORMAL/SLOW/FREEZE
//|               and Worst-Symbol Throttle
//|      edit 7.  dashboard 3Mode+Worst-Symbol Throttle
//|      edit 8.2  dashboard above any graph + Tahoma Font
//|      edit 9.  new input design + Port and min balance Lock
//|      edit 0122. expire date time ภาษาไทยได้แล้ว
//|      edit e1.1   add to 10 pair 20 symbol
//|      edit 0521_LicensingV2: Upgrade to Licensing V2 (Cache & Grace Period)
//|  Core idea: 1 Symbol = 1 Engine (Magic per symbol)                |
//|  ***0304_Licenses disable inside Port,Min Balance,Expire Check    |
//|     1.GUARD_ENABLE = false
//|     2.GUARD_EXPIRE_DATE = ""
//|     3.Comment This Block onTick > GuardRefresh(); if(!g_guard_ok){...return;}
//|  DASH PATCH (VU flat left bars - FIX orange border issue):        |
//|  - VU shows order count as left-aligned solid bars (no bg/border) |
//|  - 1st bar thick, next bars thin                                  |
//|  - Hide/show via XSIZE/YSIZE=0 (works on all MT5 builds)          |
//|  - Set both OBJPROP_COLOR + OBJPROP_BGCOLOR for solid fill         |
//|  - DashboardUpdate skips disabled symbols                          |
//+------------------------------------------------------------------+
#property strict
#property version   "1.12.8.L2"
#property description "EASY_M Max0324 (10Pairs) - Licensing V2"

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>
#define EA_PRODUCT_ID "EZM-MAX-TEST"
#include <EAEZE_Licensing.mqh>
#include "EM_MonitorAdapter.mqh"

//====================================================================
// ACCOUNT GUARD (EDIT HERE)
// - Login whitelist + minimum BALANCE only.
// - OnTick will stop trading when blocked.
//====================================================================

static const bool   GUARD_ENABLE      = false ;   // Master switch
static const double GUARD_MIN_BALANCE = 0;   // <==== Minimum balance (account currency). 0=disable ====
// [GUARD] Expiry date (server time). Empty = no expiry.
static const string GUARD_EXPIRE_DATE = ""; // <==== YYYY.MM.DD ==== ""=disable
static const int    GUARD_EXPIRE_HOUR = 23;           // 0..23 (server time = thai time - 5hrs.)
static const int    GUARD_EXPIRE_MIN  = 59;           // 0..59


// Allowed logins. Empty list = allow all.
static const long GUARD_ALLOWED_LOGINS[1] =
{
   0    // <==== Port Number Enable ==== 0=Allow All
};

// Runtime state (read these for dashboard)
static bool   g_guard_ok = true;
static string g_guard_reason = "ENABLED";

bool GuardLoginAllowed(const long login)
{
   int n = (int)ArraySize(GUARD_ALLOWED_LOGINS);
   if(n <= 0) return true;

   // NEW: 0 means allow all
   if(n == 1 && GUARD_ALLOWED_LOGINS[0] == 0)
      return true;

   for(int i=0; i<n; i++)
      if(GUARD_ALLOWED_LOGINS[i] == login) return true;
   return false;
}

bool GuardParseExpire(datetime &outTs)
{
   outTs = 0;
   if(StringLen(GUARD_EXPIRE_DATE) < 8) return false; // treat as disabled

   // Expect "YYYY.MM.DD"
   string s = GUARD_EXPIRE_DATE;
   int y = (int)StringToInteger(StringSubstr(s, 0, 4));
   int m = (int)StringToInteger(StringSubstr(s, 5, 2));
   int d = (int)StringToInteger(StringSubstr(s, 8, 2));

   if(y < 1970 || m < 1 || m > 12 || d < 1 || d > 31) return false;

   MqlDateTime dt;
   dt.year = y; dt.mon = m; dt.day = d;
   dt.hour = GUARD_EXPIRE_HOUR;
   dt.min  = GUARD_EXPIRE_MIN;
   dt.sec  = 0;

   outTs = StructToTime(dt);
   return (outTs > 0);
}

bool GuardIsExpired()
{
   datetime expTs = 0;
   if(!GuardParseExpire(expTs)) return false; // no expiry
   return (TimeTradeServer() >= expTs);       // use server time
}

void GuardRefresh()
{
   g_guard_ok = true;
   g_guard_reason = "ENABLED";

   if(GuardIsExpired())
   {
      g_guard_ok = false;
      g_guard_reason = "PORT EXPIRED";
      return;
   }

   if(!GUARD_ENABLE) return;

   long login = (long)AccountInfoInteger(ACCOUNT_LOGIN);
   if(!GuardLoginAllowed(login))
   {
      g_guard_ok = false;
      g_guard_reason = StringFormat("ACCOUNT_NOT_ALLOWED (%I64d)", login);
      return;
   }

   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   if(GUARD_MIN_BALANCE > 0.0 && bal < GUARD_MIN_BALANCE)
   {
      g_guard_ok = false;
      g_guard_reason = StringFormat("BALANCE_LOW (%.2f < %.2f)", bal, GUARD_MIN_BALANCE);
      return;
   }
}


//====================================================================
// INPUTS (UI) - Minimal, grouped
// Only inputs listed here will show in EA settings.
// Everything else is kept as in-code constants for you to edit.
//====================================================================

input group "------- General / UI"
input long   InpMagicBase     = 2000;   // Magic Number
input int    InpDashFontSize  = 10;     // Font size
input double InpDashScale     = 1.00;   // Dashboard Scale

input group "------- Lot Setting"
input double InpBaseLot          = 0.1; // Lot start
input double LADDER_STEP_LOT     = 0.1; // Lot add
input int    LADDER_GROUP_SIZE   = 3;    // Orders per step
input double InpHardMaxLotPerPos = 1.10; // Max lot per order (hard cap)
input int    InpMaxPositionsTotal= 33;   // Max orders per symbol
input double InpMaxSymbolLots    = 20.00; // Max total lots per symbol
input double InpBasketTargetMoney= 10.0;  // Close money (cent)

input group "------- Portfolio Safety"
input int InpMaxNewSymbolsPerBar = 10; // Max new symbols per bar
input int InpMaxActiveSymbols    = 16; // Max active symbols
input int InpMaxGridAddsPerBar   = 4; // Max order adds per bar

input group "====== Advanced Setting ======"
input bool   InpEnableAutoMode = true; // Auto mode ON/OFF
input double InpDD_SlowOn      = 18.0;  // DD% -> SLOW
input double InpDD_FreezeOn    = 28.0; // DD% -> FREEZE
input double InpDD_Resume      = 12.0;  // DD% -> back to NORMAL

input group "------- SLOW MODE"
input int InpSlowMaxNewSymbolsPerBar = 4; // SLOW: Max new symbols per bar
input int InpSlowMaxActiveSymbols    = 6; // SLOW: Max active symbols
input int InpSlowMaxGridAddsPerBar   = 2; // SLOW: Max order adds per bar

input group "------- FREEZE MODE"
input int InpFreezeMaxNewSymbolsPerBar = 0; // FREEZE: Max new symbols per bar
input int InpFreezeMaxActiveSymbols    = 2; // FREEZE: Max active symbols
input int InpFreezeMaxGridAddsPerBar   = 0; // FREEZE: Max order adds per bar

input group "------- SYMBOL BREAK"
input bool   InpEnableWorstThrottle     = true; // Symbol Break ON/OFF
input int    InpWorstTopN               = 4;    // Worst symbols count
input double InpWorstSlowOnLossPct      = 5.0;  // DD% -> SLOW
input double InpWorstFreezeOnLossPct    = 8.0;  // DD% -> FREEZE
input double InpWorstResumeLossPct      = 4.0;  // DD% -> back to NORMAL
input int    InpWorstSlowGridEveryBars  = 3;    // SLOW: allow order add every N bars

//====================================================================
// HIDDEN SETTINGS (edit in code only)
// Keep variable names the same to avoid touching stable logic.
//====================================================================

// Trading / broker glue (hidden)
static const string InpEA_Label            = "EASY_M 10Pair"; // Order comment / EA label
static const bool   InpShowDashboard       = true;          // Dashboard ON/OFF (hidden)
static const string InpSymbolSuffix        = ".v";       // Broker symbol suffix (hidden)
static const bool   InpRequireAllSymbols   = false;         // Fail init if any missing (hidden)

// Master portfolio safety switch (hidden)
// (Your visible safety limits above still apply only when this is true.)
static const bool   InpEnablePortfolioSafety = true;        // Portfolio safety ON/OFF (hidden)

//====================================================================
// FIXED SETTINGS (kept in code to avoid "logic drift")
//====================================================================

// --- Signal (RSI + wick filter)
static const ENUM_TIMEFRAMES InpRSI_TF  = PERIOD_CURRENT;
static const int    InpRSI_Period       = 7;
static const double InpRSI_Oversold     = 30.0;   // BUY when RSI < oversold
static const double InpRSI_Overbought   = 70.0;   // SELL when RSI > overbought
static const bool   InpAllowBUY         = true;
static const bool   InpAllowSELL        = true;

// --- Grid / execution filters
static const int    InpGridDistancePips = 15;     // Grid step in pips
static const bool   InpUseSpreadFilter  = true;
static const int    InpMaxSpreadPoints  = 58;
static const bool   InpAvoidMultiEntryBar = true;
static const bool   InpAvoidMultiExitBar  = true;

// --- Exit style (peel/sweep)
static const bool   InpExit_CloseOldestOne   = true;
static const bool   InpExit_CloseProfitables = true;
static const double InpExit_ProfitThreshold  = 0.0; // 0 => net > 0 only
static const int    InpExit_MinPositions     = 1;

// Safety: minimum seconds between trade requests per symbol
static const int MIN_TRADE_COOLDOWN_SEC = 1;

// --- ATR(D1) adaptive settings (per symbol) ---
static const bool   USE_ATR_GRID      = false; // core = fixed grid (original-like)
static const int    ATR_D1_PERIOD     = 14;
static const double GRID_ATR_MULT     = 0.25;
static const double GRID_MIN_MULT     = 1.00;
static const double GRID_MAX_MULT     = 4.00;
static const double TARGET_ATR_REF_PIPS = 60.0;
static const double TARGET_MIN_MULT   = 0.50;
static const double TARGET_MAX_MULT   = 3.00;

// --- Previous candle wick filter for FIRST entry ---
static const double WICK_BODY_MULT    = 1.5;
static const double WICK_RANGE_MIN    = 0.45;

CTrade trade;

//-------------------- Broker symbol resolver ------------------------
bool SymbolExistsAndSelect(const string sym)
{
   if((bool)SymbolInfoInteger(sym, SYMBOL_EXIST) == false)
      return false;
   return SymbolSelect(sym, true);
}

string ResolveSymbolName(const string baseSym)
{
   if(StringLen(InpSymbolSuffix) > 0)
   {
      string withSuffix = baseSym + InpSymbolSuffix;
      if(SymbolExistsAndSelect(withSuffix))
         return withSuffix;
   }
   if(SymbolExistsAndSelect(baseSym))
      return baseSym;
   return "";
}

//-------------------- Helpers: pip <-> point ------------------------
double PipSizeForSymbol(const string sym)
{
   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double pt  = SymbolInfoDouble(sym, SYMBOL_POINT);
   if(digits == 3 || digits == 5) return 10.0 * pt;
   return pt;
}

double GridDistancePointsAdaptive(const string sym, const double gridPips)
{
   return (double)gridPips * PipSizeForSymbol(sym);
}

//-------------------- Symbol config & state -------------------------
struct SymbolConfig
{
   string sym;
   int    groupId;
};

struct SymbolState
{
   string baseSym; // display symbol without suffix
   string sym;
   int    groupId;
   long   magic;

   bool   enabled;

   int    rsiHandle;
   int    atrHandle;

   int    activeSide; // 0=None, 1=BUY, 2=SELL

   datetime lastEntryBarTimeBuy;
   datetime lastEntryBarTimeSell;
   datetime lastExitBarTimeBuy;
   datetime lastExitBarTimeSell;
   datetime lastGridBarTimeBuy;
   datetime lastGridBarTimeSell;
   datetime lastTradeTime;

   int    buyCount;
   int    sellCount;

   double lowestBuyOpen;
   double highestSellOpen;

   double basketProfitBuy;
   double basketProfitSell;

   double gridPips;
   double targetMoney;

   string lastAction;
   string lastReason;
   datetime lastD1BarTime;

   double nextBuyLot;
   double nextSellLot;
};

//-------------------- 10 correlation pairs (20 symbols) -------------
// NOTE: groupId is for grouping/display only (no correlation calc).
SymbolConfig g_cfg[] =
{
   // Pair 1: EURUSD vs GBPUSD
   {"EURUSD", 1}, {"GBPUSD", 1},

   // Pair 2: AUDUSD vs NZDUSD
   {"AUDUSD", 2}, {"NZDUSD", 2},

   // Pair 3: USDJPY vs USDCHF
   {"USDJPY", 3}, {"USDCHF", 3},

   // Pair 4: EURJPY vs GBPJPY
   {"EURJPY", 4}, {"GBPJPY", 4},

   // Pair 5: USDCAD vs AUDCAD
   {"USDCAD", 5}, {"AUDCAD", 5},

   // Pair 6: EURCHF vs GBPCHF
   {"EURCHF", 6}, {"GBPCHF", 6},

   // Pair 7: EURCAD vs GBPCAD
   {"EURCAD", 7}, {"GBPCAD", 7},

   // Pair 8: EURAUD vs GBPAUD
   {"EURAUD", 8}, {"GBPAUD", 8},

   // Pair 9: AUDJPY vs NZDJPY
   {"AUDJPY", 9}, {"NZDJPY", 9},

   // Pair 10: EURNZD vs GBPNZD
   {"EURNZD",10}, {"GBPNZD",10}
};

SymbolState g_state[];

// --- Portfolio grid-add throttle state
datetime g_portGridBarTime = 0;
int      g_portGridAddsThisBar = 0;

// Portfolio-level limiter (ENTRY only)
static datetime g_portEntryBarTime = 0;
static int      g_portNewSymbolsThisBar = 0;
static bool     g_portSymbolCounted[];

//====================================================================
// AUTO MODE STATE (runtime effective limits)
//====================================================================
enum PORT_MODE
{
   PM_NORMAL = 0,
   PM_SLOW   = 1,
   PM_FREEZE = 2
};

enum SYM_THROTTLE
{
   ST_NONE   = 0,
   ST_SLOW   = 1,
   ST_FREEZE = 2
};

int      g_portMode      = PM_NORMAL; // current portfolio mode
int      g_effMaxNew     = 0;         // effective max new symbols per bar
int      g_effMaxActive  = 0;         // effective max active symbols
int      g_effMaxGrid    = 0;         // effective max grid adds per bar

bool     g_isWorst[];                // TopN mask
int      g_symThrottle[];            // ST_*
double   g_symLossPct[];             // cached loss% per symbol
long     g_lastWorstGridSlot[];      // last allowed grid slot for slow mode


//====================================================================
// Position iteration helpers
//====================================================================
bool SelectPositionByIndexFiltered(const int index, const string sym, const long magic)
{
   ulong ticket = PositionGetTicket(index);
   if(ticket == 0) return false;
   if(!PositionSelectByTicket(ticket)) return false;

   if((string)PositionGetString(POSITION_SYMBOL) != sym) return false;
   if((long)PositionGetInteger(POSITION_MAGIC) != magic) return false;

   return true;
}

double PositionNetProfit()
{
   return PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
}

datetime CurrentBarTime(const string sym, ENUM_TIMEFRAMES tf)
{
   datetime t[];
   if(CopyTime(sym, tf, 0, 1, t) != 1) return (datetime)0;
   return t[0];
}

//+------------------------------------------------------------------+
//| Portfolio helpers                                                |
//+------------------------------------------------------------------+
void ResetPortfolioGridCounterIfNewBar()
{
   datetime bt = CurrentBarTime(_Symbol, PERIOD_CURRENT);
   if(bt == 0) return;

   if(g_portGridBarTime != bt)
   {
      g_portGridBarTime = bt;
      g_portGridAddsThisBar = 0;
   }
}

int CountActiveSymbols()
{
   bool active[];
   ArrayResize(active, ArraySize(g_state));
   ArrayInitialize(active, false);

   CPositionInfo pi;
   for(int i=PositionsTotal()-1; i>=0; --i)
   {
      if(!pi.SelectByIndex(i)) continue;

      string sym = pi.Symbol();
      long   mg  = pi.Magic();

      for(int s=0; s<ArraySize(g_state); ++s)
      {
         if(g_state[s].sym == sym && g_state[s].magic == mg)
         {
            active[s] = true;
            break;
         }
      }
   }

   int cnt=0;
   for(int s=0; s<ArraySize(active); ++s)
      if(active[s]) cnt++;
   return cnt;
}

double CurrentSymbolLots(const string sym, const long magic)
{
   double lots = 0.0;
   CPositionInfo pi;
   for(int i=PositionsTotal()-1; i>=0; --i)
   {
      if(!pi.SelectByIndex(i)) continue;
      if(pi.Symbol()!=sym) continue;
      if(pi.Magic()!=magic) continue;
      lots += pi.Volume();
   }
   return lots;
}

bool SpreadOK(const string sym)
{
   if(!InpUseSpreadFilter) return true;
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   if(ask <= 0 || bid <= 0) return false;
   double sprPts = (ask - bid) / SymbolInfoDouble(sym, SYMBOL_POINT);
   return (sprPts <= (double)InpMaxSpreadPoints);
}

//====================================================================
// AUTO MODE HELPERS
//====================================================================
double FloatingDDPct()
{
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(bal <= 0.0) return 0.0;
   double dd = (bal - eq) / bal * 100.0;
   if(dd < 0.0) dd = 0.0;
   return dd;
}

int ClampInt(const int v, const int lo, const int hi)
{
   if(v < lo) return lo;
   if(v > hi) return hi;
   return v;
}

int StateIndexBySymbolMagic(const string sym, const long magic)
{
   for(int i=0; i<ArraySize(g_state); i++)
      if(g_state[i].sym == sym && g_state[i].magic == magic)
         return i;
   return -1;
}

long BarSlot(const datetime barTime, const ENUM_TIMEFRAMES tf)
{
   int ps = PeriodSeconds(tf);
   if(ps <= 0) ps = PeriodSeconds(PERIOD_CURRENT);
   if(ps <= 0) ps = 60;
   return (long)(barTime / ps);
}

void UpdatePortfolioAutoMode()
{
   // Default = NORMAL (use existing inputs)
   g_effMaxNew    = InpMaxNewSymbolsPerBar;
   g_effMaxActive = InpMaxActiveSymbols;
   g_effMaxGrid   = InpMaxGridAddsPerBar;

   // If safety is OFF, do not auto-throttle portfolio limits
   if(!InpEnablePortfolioSafety || !InpEnableAutoMode)
   {
      g_portMode = PM_NORMAL;
      return;
   }

   double dd = FloatingDDPct();

   // Mode transitions (with hysteresis)
   if(g_portMode == PM_NORMAL)
   {
      if(dd >= InpDD_FreezeOn) g_portMode = PM_FREEZE;
      else if(dd >= InpDD_SlowOn) g_portMode = PM_SLOW;
   }
   else if(g_portMode == PM_SLOW)
   {
      if(dd >= InpDD_FreezeOn) g_portMode = PM_FREEZE;
      else if(dd <= InpDD_Resume) g_portMode = PM_NORMAL;
   }
   else // PM_FREEZE
   {
      if(dd <= InpDD_Resume) g_portMode = PM_NORMAL;
      else if(dd < InpDD_FreezeOn) g_portMode = PM_SLOW;
   }

   // Apply effective limits by mode
   if(g_portMode == PM_SLOW)
   {
      g_effMaxNew    = InpSlowMaxNewSymbolsPerBar;
      g_effMaxActive = InpSlowMaxActiveSymbols;
      g_effMaxGrid   = InpSlowMaxGridAddsPerBar;
   }
   else if(g_portMode == PM_FREEZE)
   {
      g_effMaxNew    = InpFreezeMaxNewSymbolsPerBar;
      g_effMaxActive = InpFreezeMaxActiveSymbols;
      g_effMaxGrid   = InpFreezeMaxGridAddsPerBar;
   }

   // Safety clamps
   g_effMaxNew    = ClampInt(g_effMaxNew, 0, 50);
   g_effMaxActive = ClampInt(g_effMaxActive, 0, ArraySize(g_state));
   g_effMaxGrid   = ClampInt(g_effMaxGrid, 0, 50);
}

void UpdateWorstSymbolsTopN()
{
   // Default: none
   int n = ArraySize(g_state);
   if(n <= 0) return;

   // Disable if safety layer is off
   if(!InpEnablePortfolioSafety || !InpEnableWorstThrottle)
   {
      ArrayInitialize(g_isWorst, false);
      for(int i=0;i<n;i++)
      {
         g_symThrottle[i] = ST_NONE;
         g_symLossPct[i]  = 0.0;
      }
      return;
   }

   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   if(bal <= 0.0) bal = 1.0;

   // Compute loss%
   for(int i=0;i<n;i++)
   {
      double pnl = (g_state[i].basketProfitBuy + g_state[i].basketProfitSell);
      double lossPct = 0.0;
      if(pnl < 0.0) lossPct = (-pnl) / bal * 100.0;
      g_symLossPct[i] = lossPct;
   }

   // Update throttle state (hysteresis)
   for(int i=0;i<n;i++)
   {
      double lp = g_symLossPct[i];

      if(g_symThrottle[i] == ST_NONE)
      {
         if(lp >= InpWorstFreezeOnLossPct) g_symThrottle[i] = ST_FREEZE;
         else if(lp >= InpWorstSlowOnLossPct) g_symThrottle[i] = ST_SLOW;
      }
      else if(g_symThrottle[i] == ST_SLOW)
      {
         if(lp >= InpWorstFreezeOnLossPct) g_symThrottle[i] = ST_FREEZE;
         else if(lp <= InpWorstResumeLossPct) g_symThrottle[i] = ST_NONE;
      }
      else // ST_FREEZE
      {
         if(lp <= InpWorstResumeLossPct) g_symThrottle[i] = ST_NONE;
         else if(lp < InpWorstFreezeOnLossPct) g_symThrottle[i] = ST_SLOW;
      }
   }

   // Select TopN by lossPct (simple selection)
   ArrayInitialize(g_isWorst, false);

   int topN = ClampInt(InpWorstTopN, 1, 4);
   int picked = 0;

   bool used[];
   ArrayResize(used, n);
   ArrayInitialize(used, false);

   while(picked < topN)
   {
      int best = -1;
      double bestLp = 0.0;

      for(int i=0;i<n;i++)
      {
         if(used[i]) continue;
         if(!g_state[i].enabled) continue;
         int cnt = g_state[i].buyCount + g_state[i].sellCount;
         if(cnt <= 0) continue;

         double lp = g_symLossPct[i];
         if(lp <= 0.0) continue;

         if(best < 0 || lp > bestLp)
         {
            best = i;
            bestLp = lp;
         }
      }

      if(best < 0) break;

      used[best] = true;
      g_isWorst[best] = true;
      picked++;
   }
}

bool WorstGridAllowedNow(const int idx, const datetime barTime)
{
   if(idx < 0) return true;

   // Portfolio FREEZE has priority: grid already blocked by g_effMaxGrid=0
   if(g_portMode == PM_FREEZE) return false;

   int st = g_symThrottle[idx];
   if(st == ST_FREEZE) return false;
   if(st != ST_SLOW) return true;

   int N = InpWorstSlowGridEveryBars;
   if(N <= 1) return true;

   long slot = BarSlot(barTime, InpRSI_TF);
   if(slot - g_lastWorstGridSlot[idx] >= (long)N) return true;
   return false;
}

void MarkWorstGridUsed(const int idx, const datetime barTime)
{
   if(idx < 0) return;
   g_lastWorstGridSlot[idx] = BarSlot(barTime, InpRSI_TF);
}

//====================================================================
// Lot sizing (LADDER)
//====================================================================
double LadderLot(const int level)
{
   int step = (level <= 1 ? 0 : (int)MathFloor((double)(level-1) / (double)LADDER_GROUP_SIZE));
   double lot = InpBaseLot + (double)step * LADDER_STEP_LOT;
   if(lot > InpHardMaxLotPerPos) lot = InpHardMaxLotPerPos;
   return lot;
}

double NormalizeLot(const string sym, double lot)
{
   double minLot  = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double stepLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);

   if(stepLot <= 0) stepLot = 0.01;

   lot = MathMax(lot, minLot);
   lot = MathMin(lot, maxLot);
   lot = MathMin(lot, InpHardMaxLotPerPos);

   lot = MathFloor(lot / stepLot) * stepLot;
   if(lot < minLot) lot = minLot;
   return lot;
}

//====================================================================
// Indicator: RSI
//====================================================================
bool GetRSI(const SymbolState &st, double &rsiOut)
{
   double buf[];
   ArraySetAsSeries(buf, true);
   if(CopyBuffer(st.rsiHandle, 0, 0, 2, buf) < 2) return false;
   rsiOut = buf[0];
   return true;
}

bool UpdateAdaptiveParams(SymbolState &st)
{
   st.targetMoney = InpBasketTargetMoney;

   if(!USE_ATR_GRID)
   {
      st.gridPips = (double)InpGridDistancePips;
      return true;
   }

   datetime d1t = CurrentBarTime(st.sym, PERIOD_D1);
   if(d1t == 0) return false;

   if(st.lastD1BarTime == d1t && st.gridPips > 0.0)
      return true;

   double atrBuf[];
   ArraySetAsSeries(atrBuf, true);
   if(CopyBuffer(st.atrHandle, 0, 0, 2, atrBuf) < 2) return false;

   double atr = atrBuf[0];
   if(atr <= 0) return false;

   double pip = PipSizeForSymbol(st.sym);
   double atrPips = atr / pip;

   double baseGrid = (double)InpGridDistancePips;
   double grid = atrPips * GRID_ATR_MULT;
   double gridMin = baseGrid * GRID_MIN_MULT;
   double gridMax = baseGrid * GRID_MAX_MULT;
   if(grid < gridMin) grid = gridMin;
   if(grid > gridMax) grid = gridMax;

   st.gridPips = grid;
   st.lastD1BarTime = d1t;
   return true;
}

bool PrevCandleWickOK(const string sym, ENUM_TIMEFRAMES tf, const int side)
{
   double o[1], h[1], l[1], c[1];
   if(CopyOpen(sym, tf, 1, 1, o) != 1) return false;
   if(CopyHigh(sym, tf, 1, 1, h) != 1) return false;
   if(CopyLow(sym, tf, 1, 1, l) != 1) return false;
   if(CopyClose(sym, tf, 1, 1, c) != 1) return false;

   double open  = o[0], high = h[0], low = l[0], close = c[0];
   double range = high - low;
   if(range <= 0) return false;

   double body = MathAbs(close - open);
   double upperWick = high - MathMax(open, close);
   double lowerWick = MathMin(open, close) - low;

   if(side == 1) // BUY
      return (lowerWick >= body * WICK_BODY_MULT) && (lowerWick >= range * WICK_RANGE_MIN);
   if(side == 2) // SELL
      return (upperWick >= body * WICK_BODY_MULT) && (upperWick >= range * WICK_RANGE_MIN);

   return true;
}

//====================================================================
// Update positions & metrics per symbol
//====================================================================
void UpdateSymbolPositions(SymbolState &st)
{
   st.buyCount = 0;
   st.sellCount = 0;
   st.lowestBuyOpen = 0.0;
   st.highestSellOpen = 0.0;
   st.basketProfitBuy = 0.0;
   st.basketProfitSell = 0.0;

   for(int i=0; i<PositionsTotal(); i++)
   {
      if(!SelectPositionByIndexFiltered(i, st.sym, st.magic)) continue;

      ENUM_POSITION_TYPE ptype = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double net = PositionNetProfit();

      if(ptype == POSITION_TYPE_BUY)
      {
         st.buyCount++;
         st.basketProfitBuy += net;
         if(st.lowestBuyOpen == 0.0 || openPrice < st.lowestBuyOpen) st.lowestBuyOpen = openPrice;
      }
      else if(ptype == POSITION_TYPE_SELL)
      {
         st.sellCount++;
         st.basketProfitSell += net;
         if(st.highestSellOpen == 0.0 || openPrice > st.highestSellOpen) st.highestSellOpen = openPrice;
      }
   }

   st.nextBuyLot  = NormalizeLot(st.sym, LadderLot(st.buyCount + 1));
   st.nextSellLot = NormalizeLot(st.sym, LadderLot(st.sellCount + 1));

   if(st.buyCount > 0 && st.sellCount == 0) st.activeSide = 1;
   else if(st.sellCount > 0 && st.buyCount == 0) st.activeSide = 2;
   else if(st.buyCount == 0 && st.sellCount == 0) st.activeSide = 0;

   UpdateAdaptiveParams(st);
}

//====================================================================
// Trading helpers
//====================================================================
bool CooldownOK(SymbolState &st)
{
   if(st.lastTradeTime == 0) return true;
   return ((TimeCurrent() - st.lastTradeTime) >= MIN_TRADE_COOLDOWN_SEC);
}

bool OpenBuy(SymbolState &st, double lot)
{
   if(!CooldownOK(st)) return false;

   trade.SetExpertMagicNumber(st.magic);
   lot = NormalizeLot(st.sym, lot);

   if(InpEnablePortfolioSafety)
   {
      double curLots = CurrentSymbolLots(st.sym, st.magic);
      if(curLots + lot > InpMaxSymbolLots)
      {
         PrintFormat("[SAFETY] %s BUY lot cap reached: cur=%.2f add=%.2f cap=%.2f",
                     st.sym, curLots, lot, InpMaxSymbolLots);
         return false;
      }
   }

   bool ok = trade.Buy(lot, st.sym, 0.0, 0.0, 0.0, InpEA_Label);
   if(ok)
   {
      st.lastTradeTime = TimeCurrent();
      st.lastAction = "OPEN BUY " + DoubleToString(lot,2);
   }
   return ok;
}

bool OpenSell(SymbolState &st, double lot)
{
   if(!CooldownOK(st)) return false;

   trade.SetExpertMagicNumber(st.magic);
   lot = NormalizeLot(st.sym, lot);

   if(InpEnablePortfolioSafety)
   {
      double curLots = CurrentSymbolLots(st.sym, st.magic);
      if(curLots + lot > InpMaxSymbolLots)
      {
         PrintFormat("[SAFETY] %s SELL lot cap reached: cur=%.2f add=%.2f cap=%.2f",
                     st.sym, curLots, lot, InpMaxSymbolLots);
         return false;
      }
   }

   bool ok = trade.Sell(lot, st.sym, 0.0, 0.0, 0.0, InpEA_Label);
   if(ok)
   {
      st.lastTradeTime = TimeCurrent();
      st.lastAction = "OPEN SELL " + DoubleToString(lot,2);
   }
   return ok;
}

//==================================================================//
// Trade helpers
//==================================================================//
bool CloseByTicket(const ulong ticket)
{
   if(ticket==0) return false;
   trade.SetAsyncMode(false);
   bool ok = trade.PositionClose(ticket);
   if(!ok)
   {
      if(PositionSelectByTicket(ticket))
      {
         string sym = (string)PositionGetString(POSITION_SYMBOL);
         ok = trade.PositionClose(sym);
      }
   }
   return ok;
}

void CloseAllProfitable(const string sym, const long magic, const int posType, const double thresholdMoney)
{
   int total = PositionsTotal();
   for(int i=total-1; i>=0; --i)
   {
      ulong _pt=PositionGetTicket(i); if(_pt==0) continue;
      if(!PositionSelectByTicket(_pt)) continue;
      if((string)PositionGetString(POSITION_SYMBOL) != sym) continue;
      if((long)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((int)PositionGetInteger(POSITION_TYPE) != posType) continue;

      double net = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      if(net > thresholdMoney)
      {
         ulong ticket = (ulong)PositionGetInteger(POSITION_TICKET);
         CloseByTicket(ticket);
      }
   }
}

//====================================================================
// Entry (RSI) per side
//====================================================================
void TryEntry(SymbolState &st)
{
   st.lastReason = "";
   if(!SpreadOK(st.sym)) { st.lastReason="Spread"; return; }

   if(st.activeSide != 0) { st.lastReason="ActiveSide"; return; }
   if(st.buyCount != 0 || st.sellCount != 0) { st.lastReason="HasPositions"; return; }

   datetime barTime = CurrentBarTime(st.sym, InpRSI_TF);
   if(barTime == 0) { st.lastReason="NoBarTime"; return; }

   // ==== new function for auto 3 mode ====
   if(InpEnablePortfolioSafety)
   {
      int activeNow = CountActiveSymbols();
      if(activeNow >= g_effMaxActive) { st.lastReason="MaxActiveSymbols"; return; }
   }

   if(g_portEntryBarTime != barTime)
   {
      g_portEntryBarTime = barTime;
      g_portNewSymbolsThisBar = 0;
      for(int k=0; k<ArraySize(g_portSymbolCounted); k++) g_portSymbolCounted[k] = false;
   }

   int idx = -1;
   for(int i=0; i<ArraySize(g_state); i++)
   {
      if(g_state[i].sym == st.sym) { idx = i; break; }
      g_state[i].lastAction = "";
      g_state[i].lastReason = "";
   }
   if(idx < 0) { st.lastReason="IndexNotFound"; return; }

   bool alreadyCounted = (idx < ArraySize(g_portSymbolCounted)) ? g_portSymbolCounted[idx] : false;
   if(InpEnablePortfolioSafety && !alreadyCounted && g_portNewSymbolsThisBar >= g_effMaxNew)
      return;

   double rsi=0;
   if(!GetRSI(st, rsi)) return;

   bool wickBuyOK  = PrevCandleWickOK(st.sym, InpRSI_TF, 1);
   bool wickSellOK = PrevCandleWickOK(st.sym, InpRSI_TF, 2);

   bool buySignal  = (InpAllowBUY  && rsi < InpRSI_Oversold   && wickBuyOK);
   bool sellSignal = (InpAllowSELL && rsi > InpRSI_Overbought && wickSellOK);

   if(!buySignal && !sellSignal) return;

   if(buySignal && sellSignal)
   {
      double buyStrength  = InpRSI_Oversold - rsi;
      double sellStrength = rsi - InpRSI_Overbought;
      if(sellStrength > buyStrength) buySignal = false;
      else sellSignal = false;
   }

   if(buySignal)
   {
      if(InpAvoidMultiEntryBar && st.lastEntryBarTimeBuy == barTime) return;

      if(OpenBuy(st, st.nextBuyLot))
      {
         st.activeSide = 1;
         st.lastEntryBarTimeBuy = barTime;

         if(!alreadyCounted)
         {
            g_portSymbolCounted[idx] = true;
            g_portNewSymbolsThisBar++;
         }
      }
      return;
   }

   if(sellSignal)
   {
      if(InpAvoidMultiEntryBar && st.lastEntryBarTimeSell == barTime) return;

      if(OpenSell(st, st.nextSellLot))
      {
         st.activeSide = 2;
         st.lastEntryBarTimeSell = barTime;

         if(!alreadyCounted)
         {
            g_portSymbolCounted[idx] = true;
            g_portNewSymbolsThisBar++;
         }
      }
      return;
   }
}

//====================================================================
void TryGrid(SymbolState &st)
{
   if(!SpreadOK(st.sym)) return;

   datetime barTime = CurrentBarTime(st.sym, InpRSI_TF);
   if(barTime == 0) { st.lastReason="NoBarTime"; return; }

   // WorstTopN throttle gate (grid only)
   int idx = StateIndexBySymbolMagic(st.sym, st.magic);
   if(InpEnablePortfolioSafety && InpEnableWorstThrottle && idx >= 0 && idx < ArraySize(g_isWorst))
   {
      if(g_isWorst[idx])
      {
         if(!WorstGridAllowedNow(idx, barTime))
         {
            st.lastReason = "WorstGridGate";
            return;
         }
      }
   }

   if(InpEnablePortfolioSafety)
   {
      if(g_portGridAddsThisBar >= g_effMaxGrid) return;
   }

   int total = st.buyCount + st.sellCount;
   if(total >= InpMaxPositionsTotal) return;

   double ask = SymbolInfoDouble(st.sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(st.sym, SYMBOL_BID);
   if(ask <= 0 || bid <= 0) return;

   UpdateAdaptiveParams(st);
   double dist = GridDistancePointsAdaptive(st.sym, st.gridPips);

   if(st.activeSide==1 && InpAllowBUY && st.buyCount > 0 && total < InpMaxPositionsTotal)
   {
      if(st.lastGridBarTimeBuy != barTime)
      {
         if(st.lowestBuyOpen > 0 && ask <= (st.lowestBuyOpen - dist))
         {
            if(OpenBuy(st, st.nextBuyLot))
            {
               st.lastGridBarTimeBuy = barTime;
               g_portGridAddsThisBar++;
            
               if(InpEnablePortfolioSafety && InpEnableWorstThrottle && idx >= 0 && idx < ArraySize(g_isWorst) && g_isWorst[idx])
                  MarkWorstGridUsed(idx, barTime);
            }
         }
      }
   }

   if(st.activeSide==2 && InpAllowSELL && st.sellCount > 0 && total < InpMaxPositionsTotal)
   {
      if(st.lastGridBarTimeSell != barTime)
      {
         if(st.highestSellOpen > 0 && bid >= (st.highestSellOpen + dist))
         {
            if(OpenSell(st, st.nextSellLot))
            {
               st.lastGridBarTimeSell = barTime;
               g_portGridAddsThisBar++;
            
               if(InpEnablePortfolioSafety && InpEnableWorstThrottle && idx >= 0 && idx < ArraySize(g_isWorst) && g_isWorst[idx])
                  MarkWorstGridUsed(idx, barTime);
            }
         }
      }
   }
}

//====================================================================
// Exit (peel/sweep original-like)
//====================================================================
ulong FindOldestTicket(const string sym, const long magic, const ENUM_POSITION_TYPE type)
{
   datetime bestTime = 0;
   ulong bestTicket = 0;

   for(int i=0; i<PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      if((string)PositionGetString(POSITION_SYMBOL) != sym) continue;
      if((long)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != type) continue;

      datetime pt = (datetime)PositionGetInteger(POSITION_TIME);
      if(bestTime == 0 || pt < bestTime)
      {
         bestTime = pt;
         bestTicket = ticket;
      }
   }
   return bestTicket;
}

void CloseProfitables(const string sym, const long magic, const ENUM_POSITION_TYPE type, const double thresholdMoney)
{
   ulong tickets[];
   ArrayResize(tickets, 0);

   for(int i=0; i<PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      if((string)PositionGetString(POSITION_SYMBOL) != sym) continue;
      if((long)PositionGetInteger(POSITION_MAGIC) != magic) continue;
      if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != type) continue;

      double net = PositionNetProfit();
      if(net > thresholdMoney)
      {
         int n = ArraySize(tickets);
         ArrayResize(tickets, n+1);
         tickets[n] = ticket;
      }
   }

   for(int k=0; k<ArraySize(tickets); k++)
      trade.PositionClose(tickets[k]);
}

void TryExit(SymbolState &st)
{
   datetime barTime = CurrentBarTime(st.sym, InpRSI_TF);
   if(barTime == 0) { st.lastReason="NoBarTime"; return; }

   if(st.buyCount >= InpExit_MinPositions && st.basketProfitBuy >= InpBasketTargetMoney)
   {
      if(!(InpAvoidMultiExitBar && st.lastExitBarTimeBuy == barTime))
      {
         trade.SetExpertMagicNumber(st.magic);

         if(InpExit_CloseOldestOne)
         {
            ulong oldest = FindOldestTicket(st.sym, st.magic, POSITION_TYPE_BUY);
            if(oldest > 0 && PositionSelectByTicket(oldest))
            {
               double net = PositionNetProfit();
               if(net > InpExit_ProfitThreshold)
                  trade.PositionClose(oldest);
            }
         }

         if(InpExit_CloseProfitables)
            CloseProfitables(st.sym, st.magic, POSITION_TYPE_BUY, InpExit_ProfitThreshold);

         st.lastExitBarTimeBuy = barTime;

         UpdateSymbolPositions(st);
         if(st.buyCount==0 && st.sellCount==0) st.activeSide=0;
      }
   }

   if(st.sellCount >= InpExit_MinPositions && st.basketProfitSell >= InpBasketTargetMoney)
   {
      if(!(InpAvoidMultiExitBar && st.lastExitBarTimeSell == barTime))
      {
         trade.SetExpertMagicNumber(st.magic);

         if(InpExit_CloseOldestOne)
         {
            ulong oldest = FindOldestTicket(st.sym, st.magic, POSITION_TYPE_SELL);
            if(oldest > 0) CloseByTicket(oldest);
         }

         if(InpExit_CloseProfitables)
            CloseAllProfitable(st.sym, st.magic, POSITION_TYPE_SELL, InpExit_ProfitThreshold);

         st.lastExitBarTimeSell = barTime;

         UpdateSymbolPositions(st);
         if(st.buyCount==0 && st.sellCount==0) st.activeSide=0;
      }
   }
}

//====================================================================
// DASHBOARD (Timer-only)
//====================================================================
string   DASH_PREFIX = "EASYM_DASH_";
bool     g_dashBuilt = false;
long     g_dashChart = 0;

int      g_dashLastW = 0;
int      g_dashLastH = 0;
int      g_dashLastFont = 0;
double   g_dashLastScale = 0.0;

static const int DASH_TIMER_SEC = 1;

// ---- Theme colors (no red) ----
color DASH_BG      = clrBlack;
color DASH_GRID    = clrDimGray;
color DASH_TEXT    = clrSilver;
color DASH_GOLD    = (color)0xFFD700;      // Gold (RGB) - your preferred
color DASH_GOLD_TEXT    = (color)0x00D7FF;   // Gold (BGR)
color DASH_BLUE    = clrDeepSkyBlue;
color DASH_GREEN   = clrLime;
color DASH_ORANGE  = clrOrange;
color DASH_GREY    = clrSilver;

//==============================
// Scale helpers (NO raw px)
//==============================
double DashAutoFactor()
{
   long w = ChartGetInteger(g_dashChart, CHART_WIDTH_IN_PIXELS, 0);
   double a = (w>0 ? (double)w/1600.0 : 1.0);
   if(a < 0.70) a = 0.70;
   if(a > 1.80) a = 1.80;

   double f = InpDashScale * a;
   if(f < 0.50) f = 0.50;
   if(f > 3.00) f = 3.00;
   return f;
}

// Scale a base px value
int DashS(const double basePx)
{
   return (int)MathRound(basePx * DashAutoFactor());
}

// Scale with min 1px (for lines / thickness)
int DashS1(const double basePx)
{
   int v = DashS(basePx);
   return (v < 1 ? 1 : v);
}

int DashFS()  { return (int)MathMax(9, MathRound((double)InpDashFontSize * DashAutoFactor())); }
int DashPad() { return (int)MathMax(1, DashS(6)); }
int DashRow() { return (int)MathMax(DashS(22), DashS(28)); } // scaled row height

int DashX() { return DashPad(); }
int DashY() { return DashPad(); }

// Scale any pixel value by current dashboard factor
int DashPx(const int px)
{
   return (int)MathMax(1, MathRound((double)px * DashAutoFactor()));
}

//==============================
// Names / delete
//==============================
string DashName(const string key){ return DASH_PREFIX + key; }
string DashNameRC(const string key,const int r,const int c){ return DASH_PREFIX + key + "_" + (string)r + "_" + (string)c; }
string DashSigName(const int row,const int baseCol,const string tag)
{
   return DASH_PREFIX + "SIG_" + tag + "_" + (string)row + "_" + (string)baseCol;
}

void DashDeleteAll()
{
   int total = ObjectsTotal(g_dashChart,0,-1);
   for(int i=total-1;i>=0;--i)
   {
      string n = ObjectName(g_dashChart,i,0,-1);
      if(StringFind(n, DASH_PREFIX)==0)
         ObjectDelete(g_dashChart,n);
   }
   g_dashBuilt = false;
}

void DashHideRect(const string name)
{
   if(ObjectFind(g_dashChart, name) < 0) return;
   ObjectSetInteger(g_dashChart, name, OBJPROP_XDISTANCE, -10000);
   ObjectSetInteger(g_dashChart, name, OBJPROP_YDISTANCE, -10000);
   ObjectSetInteger(g_dashChart, name, OBJPROP_XSIZE, 0);
   ObjectSetInteger(g_dashChart, name, OBJPROP_YSIZE, 0);
}

//==============================
// Draw helpers
//==============================
// Force chart to keep dashboard above tester trade markers.
// Call this in OnInit + OnTimer (tester can reset these flags).
void DashApplyChartRules()
{
   long cid = g_dashChart;
   if(cid == 0) cid = ChartID();

   // Put chart drawings behind objects
   ChartSetInteger(cid, CHART_FOREGROUND, 0, false);

   // Hide trade markers / levels (works on live; tester may need repeated apply)
   ChartSetInteger(cid, CHART_SHOW_TRADE_HISTORY, 0, false);
   ChartSetInteger(cid, CHART_SHOW_TRADE_LEVELS,  0, false);
}

// [FIX] Solid rectangles across builds: set COLOR + BGCOLOR, and hide selectable borders.
void DashMakeRect(const string name,const int x,const int y,const int w,const int h,const color col,const int alpha,const int z)
{
   if(ObjectFind(g_dashChart,name) < 0)
      ObjectCreate(g_dashChart,name,OBJ_RECTANGLE_LABEL,0,0,0);

   ObjectSetInteger(g_dashChart,name,OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(g_dashChart,name,OBJPROP_XDISTANCE, x);
   ObjectSetInteger(g_dashChart,name,OBJPROP_YDISTANCE, y);
   ObjectSetInteger(g_dashChart,name,OBJPROP_XSIZE, w);
   ObjectSetInteger(g_dashChart,name,OBJPROP_YSIZE, h);

   ObjectSetInteger(g_dashChart,name,OBJPROP_BACK, false);
   ObjectSetInteger(g_dashChart,name,OBJPROP_ZORDER, z);

   int a = alpha;
   if(a < 0) a = 0;
   if(a > 255) a = 255;

   color c = (color)ColorToARGB(col, (uchar)a);
   ObjectSetInteger(g_dashChart,name,OBJPROP_COLOR,   c);
   ObjectSetInteger(g_dashChart,name,OBJPROP_BGCOLOR, c);
   ObjectSetInteger(g_dashChart,name,OBJPROP_BORDER_TYPE, BORDER_FLAT);

   ObjectSetInteger(g_dashChart,name,OBJPROP_SELECTABLE, false);
   ObjectSetInteger(g_dashChart,name,OBJPROP_HIDDEN,     true);
}

void DashMakeText(const string name,const int x,const int y,const string txt,const color col,const int fs,const int z)
{
   if(ObjectFind(g_dashChart,name) < 0)
      ObjectCreate(g_dashChart,name,OBJ_LABEL,0,0,0);

   ObjectSetInteger(g_dashChart,name,OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(g_dashChart,name,OBJPROP_XDISTANCE, x);
   ObjectSetInteger(g_dashChart,name,OBJPROP_YDISTANCE, y);
   ObjectSetInteger(g_dashChart,name,OBJPROP_COLOR, col);
   ObjectSetInteger(g_dashChart,name,OBJPROP_FONTSIZE, fs);
   ObjectSetString (g_dashChart,name,OBJPROP_FONT, "Arial"); //Tahoma
   ObjectSetInteger(g_dashChart,name,OBJPROP_BACK, false);
   ObjectSetInteger(g_dashChart,name,OBJPROP_ZORDER, z);
   ObjectSetString (g_dashChart,name,OBJPROP_TEXT, txt);

   ObjectSetInteger(g_dashChart,name,OBJPROP_SELECTABLE, false);
   ObjectSetInteger(g_dashChart,name,OBJPROP_HIDDEN,     true);
}

//==============================
// VU style (base px; scaled via DashS/DashS1)
//==============================
static const int   VU_MAX_BARS     = 14;
color             VU_COLOR        = clrDeepSkyBlue; // visible blue
static const int   VU_ALPHA        = 220;

static const double VU_FIRST_W     = 6;
static const double VU_NEXT_W      = 3;
static const double VU_GAP         = 2;
static const double VU_PAD_X       = 2;
static const double VU_PAD_Y       = 2;

// guide frame inside VU zone
color             VU_GUIDE_COLOR   = clrDimGray;
static const int  VU_GUIDE_ALPHA   = 70;
static const double VU_GUIDE_INSET = 1;

// [SIG_STYLE] 2x2 triangles inside SYM cell (BUY=up, SELL=down)
string SIG_UP = "▲";
string SIG_DN = "▼";

color  SIG_OFF_COLOR     = clrDimGray; // off = grey
double SIG_FS_MULT       = 0.85;       // triangle font size = fs*mult

int    SIG_STEP_X_PX     = 12;         // horizontal step (base px)
int    SIG_STEP_Y_PX     = 12;         // vertical step (base px)
int    SIG_LEFT_PAD_PX   = 4;          // left pad inside SYM cell (base px)
int    SIG_TEXT_GAP_PX   = 6;          // gap between signal block and symbol text


//==============================
// Utils
//==============================
bool IsCentCurrency(const string cur)
{
   string u = cur;
   StringToUpper(u);

   if(StringFind(u, "USC")  >= 0) return true;
   if(StringFind(u, "CENT") >= 0) return true;
   if(StringFind(u, "CUSD") >= 0) return true;
   return false;
}

string Money2(const double v){ return StringFormat("%.2f", v); }

//====================================================================
// DASH: status text helpers (Table D)
//====================================================================
string PortModeToStr()
{
   if(g_portMode == PM_FREEZE) return "FREEZE";
   if(g_portMode == PM_SLOW)   return "SLOW";
   return "NORMAL";
}

string SymThrottleToStr(const int st)
{
   if(st == ST_FREEZE) return "F";
   if(st == ST_SLOW)   return "S";
   return "-";
}

// Example: "USDJPY 7.8F | GBPUSD 5.6S"
string BuildWorstSummary(const int maxChars)
{
   int n = ArraySize(g_state);
   if(n <= 0) return "-";

   string s = "";
   int shown = 0;

   for(int i=0;i<n;i++)
   {
      if(i >= ArraySize(g_isWorst)) break;
      if(!g_isWorst[i]) continue;

      int cnt = g_state[i].buyCount + g_state[i].sellCount;
      if(cnt <= 0) continue;

      double lp = (i < ArraySize(g_symLossPct) ? g_symLossPct[i] : 0.0);
      int st = (i < ArraySize(g_symThrottle) ? g_symThrottle[i] : ST_NONE);

      string name = g_state[i].baseSym;
      if(StringLen(name) <= 0) name = g_state[i].sym;

      string one = name + " " + StringFormat("%.1f", lp) + SymThrottleToStr(st);

      if(shown > 0) s += " | ";
      s += one;
      shown++;

      if(StringLen(s) >= maxChars) break;
   }

   if(StringLen(s) == 0) s = "-";
   return s;
}

double TodayClosedProfit()
{
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   dt.hour=0; dt.min=0; dt.sec=0;
   datetime from = StructToTime(dt);
   datetime to   = TimeCurrent();

   if(!HistorySelect(from, to)) return 0.0;

   double sum=0.0;
   int deals = HistoryDealsTotal();
   for(int i=0;i<deals;i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket==0) continue;

      long entry = (long)HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry!=DEAL_ENTRY_OUT && entry!=DEAL_ENTRY_INOUT) continue;

      double p = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double s = HistoryDealGetDouble(ticket, DEAL_SWAP);
      double c = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      sum += (p + s + c);
   }
   return sum;
}

struct SymDash
{
   string sym;
   int    side;   // 0 none, 1 buy, 2 sell
   int    count;
   double pnl;
   double lots;
};

void BuildSymDash(const SymbolState &st, SymDash &out)
{
   out.sym   = st.baseSym;                 // show no suffix
   out.side  = st.activeSide;              // 1=BUY,2=SELL
   out.count = st.buyCount + st.sellCount;
   out.pnl   = st.basketProfitBuy + st.basketProfitSell;

   out.lots  = 0.0;
   if(st.enabled && StringLen(st.sym) > 0)
      out.lots = CurrentSymbolLots(st.sym, st.magic);
}

//====================================================================
// DashboardBuild
//====================================================================
void DashboardBuild()
{
   if(!InpShowDashboard) { DashDeleteAll(); return; }

   int w = (int)ChartGetInteger(g_dashChart, CHART_WIDTH_IN_PIXELS, 0);
   int h = (int)ChartGetInteger(g_dashChart, CHART_HEIGHT_IN_PIXELS, 0);

   int fs = DashFS();
   double sc = DashAutoFactor();

   bool needRebuild = (!g_dashBuilt);
   if(w!=g_dashLastW || h!=g_dashLastH || fs!=g_dashLastFont || MathAbs(sc-g_dashLastScale)>0.0001)
      needRebuild = true;

   if(!needRebuild) return;

   DashDeleteAll();

   g_dashLastW = w; g_dashLastH = h; g_dashLastFont = fs; g_dashLastScale = sc;

   // common scaled insets
   int pad   = DashPad();
   int rowH  = DashRow();
   int line  = DashS1(1);
   int txPad = DashS(4);
   int tyPad = DashS(3);

   int inset2  = DashS(2);
   int inset4  = DashS(4);
   int inset6  = DashS(6);
   int inset8  = DashS(8);
   int inset12 = DashS(12);

   //==============================
   // Table A (Summary)
   //==============================
   int aCols = 6;
   int aColW[]; ArrayResize(aColW, aCols);
   aColW[0]=DashS(190);
   aColW[1]=DashS(170);
   aColW[2]=DashS(110);
   aColW[3]=DashS(140);
   aColW[4]=DashS(150);
   aColW[5]=DashS(210);

   int aW=0; for(int i=0;i<aCols;i++) aW+=aColW[i];
   int aH = rowH*2 + pad;

   //==============================
   // Table B (Pairs)
   //==============================
   int bBodyRows = 10;           // 10 pairs => 10 rows
   int bRows = 1 + bBodyRows;    // header + body

   int blkCols = 7;

   int bColW[]; ArrayResize(bColW, blkCols*2);
   int c=0;

   int wSym =DashS(110);
   int wSide=DashS(28);
   int wVU  =DashS(90);
   int wCnt =DashS(40);
   int wBar =DashS(110);
   int wPnL =DashS(80);
   int wLot =DashS(65);

   for(int k=0;k<2;k++)
   {
      bColW[c++]=wSym;
      bColW[c++]=wSide;
      bColW[c++]=wVU;
      bColW[c++]=wCnt;
      bColW[c++]=wBar;
      bColW[c++]=wPnL;
      bColW[c++]=wLot;
   }

   int bW=0; for(int i=0;i<ArraySize(bColW);i++) bW+=bColW[i];
   int bH = bRows*rowH + pad;

   //==============================
   // Table C (Account info) - 1 row, 5 cols
   // PORT | value | TYPE | value | TAG
   //==============================
   int cCols = 5;
   int cColW[]; ArrayResize(cColW, cCols);
   cColW[0] = DashS(90);
   cColW[1] = DashS(220);
   cColW[2] = DashS(90);
   cColW[3] = DashS(160);
   int cMinTag = DashS(180);

   int cFirst4 = cColW[0]+cColW[1]+cColW[2]+cColW[3];
   cColW[4] = MathMax(cMinTag, bW - cFirst4);

   int cW = cFirst4 + cColW[4];
   int cH = rowH + pad;

   // --- Table D (Auto status): 1 row, 4 columns
   // [MODE][value][WORST][value]
   int dCols = 4;
   int dColW[]; ArrayResize(dColW, dCols);
   dColW[0] = (int)MathRound(90*sc);   // MODE
   dColW[1] = (int)MathRound(220*sc);  // mode value
   dColW[2] = (int)MathRound(90*sc);   // WORST
   dColW[3] = MathMax(200, bW - (dColW[0] + dColW[1] + dColW[2])); // fill
   
   int dW = dColW[0] + dColW[1] + dColW[2] + dColW[3];
   int dH = rowH + pad;

   //==============================
   // Panel size
   //==============================
   int panelW = MathMax(aW, MathMax(bW, MathMax(cW, dW))) + pad*2;
   int panelH = aH + bH + cH + dH + pad*2;

   // Background panel
   DashMakeRect(DashName("BDG"), DashX(), DashY()+inset8+inset6, panelW+inset8, panelH+inset8, DASH_BLUE, 150, 20000);
   DashMakeRect(DashName("BG"), DashX()+inset4, DashY()+inset12+inset6, panelW, panelH, DASH_BG, 150, 20000);
   //==============================
   // Draw Table A grid
   //==============================
   int ax = DashX() + pad;
   int ay = DashY() + pad+inset6;

   int x=ax;
   for(int i=0;i<=aCols;i++)
   {
      DashMakeRect(DashNameRC("A_V",0,i), x, ay+inset12, line, rowH*2, DASH_GRID, 140, 20010);
      if(i<aCols) x += aColW[i];
   }
   for(int r=0;r<=2;r++)
      DashMakeRect(DashNameRC("A_H",r,0), ax, ay+inset12 + r*rowH, aW, line, DASH_GRID, 140, 20010);

   string hA[]={"BALANCE","EQUITY","DD%","ALL LOTS","ALL ORDERS","TODAY P/L"};
   x=ax+txPad;
   for(int i=0;i<aCols;i++)
   {
      DashMakeText(DashNameRC("A_T",0,i), x, ay+tyPad+inset12, hA[i], DASH_BLUE, fs, 20020);
      x += aColW[i];
   }
   x=ax+txPad;
   for(int i=0;i<aCols;i++)
   {
      DashMakeText(DashNameRC("A_VV",1,i), x, ay+rowH+tyPad+inset12, "-", DASH_TEXT, fs, 20020);
      x += aColW[i];
   }

   //==============================
   // Draw Table B grid
   //==============================
   int bx = DashX() + pad;
   int by = ay + aH + pad+inset6;

   x=bx;
   for(int i=0;i<=ArraySize(bColW);i++)
   {
      DashMakeRect(DashNameRC("B_V",0,i), x, by, line, rowH*bRows, DASH_GRID, 140, 20010);
      if(i<ArraySize(bColW)) x += bColW[i];
   }
   for(int r=0;r<=bRows;r++)
      DashMakeRect(DashNameRC("B_H",r,0), bx, by + r*rowH, bW, line, DASH_GRID, 140, 20010);

   // header labels
   string headL[]={"SYM"," ","ORDERS"," ","P/L","P/L","LOT"};
   int hx=bx+txPad;
   int hy=by+tyPad;

   for(int i=0;i<blkCols;i++)
   {
      DashMakeText(DashNameRC("B_HL",0,i), hx, hy, headL[i], DASH_BLUE, fs, 20020);
      hx += bColW[i];
   }
   hx=bx+txPad;
   for(int i=0;i<blkCols;i++) hx += bColW[i];

   for(int i=0;i<blkCols;i++)
   {
      DashMakeText(DashNameRC("B_HR",0,i), hx, hy, headL[i], DASH_BLUE, fs, 20020);
      hx += bColW[blkCols+i];
   }

   //==============================
   // Body placeholders + VU pre-create
   //==============================
   for(int r=1;r<=bBodyRows;r++)
   {
      for(int k=0;k<2;k++)
      {
         int baseCol = k*blkCols;
         int cx = bx + txPad;
         for(int j=0;j<baseCol;j++) cx += bColW[j];

         // --- SYM cell: 2x2 signal triangles + symbol text (scaled)
         int cellX = bx;
         for(int j=0;j<baseCol;j++) cellX += bColW[j];
         int cellY = by + r*rowH-inset6;
         
         int sigFs   = (int)MathMax(8, MathRound((double)fs * SIG_FS_MULT));
         int stepX   = DashPx(SIG_STEP_X_PX);
         int stepY   = DashPx(SIG_STEP_Y_PX);
         int leftPad = DashPx(SIG_LEFT_PAD_PX);
         int txtGap  = DashPx(SIG_TEXT_GAP_PX);
         
         int blockW = stepX + sigFs;
         int blockH = stepY + sigFs;
         
         int sigX0 = cellX + leftPad;
         int sigY0 = cellY + (rowH - blockH)/2;
         int sigX1 = sigX0 + stepX;
         int sigY1 = sigY0 + stepY;
         
         // Pre-create 4 signals (colors updated in DashboardUpdate)
         DashMakeText(DashSigName(r, baseCol, "B_RSI"),  sigX0, sigY0, SIG_UP, SIG_OFF_COLOR, sigFs, 20021);
         DashMakeText(DashSigName(r, baseCol, "B_WICK"), sigX1, sigY0, SIG_UP, SIG_OFF_COLOR, sigFs, 20021);
         DashMakeText(DashSigName(r, baseCol, "S_RSI"),  sigX0, sigY1, SIG_DN, SIG_OFF_COLOR, sigFs, 20021);
         DashMakeText(DashSigName(r, baseCol, "S_WICK"), sigX1, sigY1, SIG_DN, SIG_OFF_COLOR, sigFs, 20021);
         
         // Symbol text starts after signal block
         int symTextX = sigX0 + blockW + txtGap;
         DashMakeText(DashNameRC("B_SYM",r,baseCol+0), symTextX, cellY + DashPx(10), "-", DASH_GOLD_TEXT, fs, 20020);
         
         // Move cx to next cell (SIDE) exactly as before
         cx += bColW[baseCol+0];


         // SIDE box + letter (default black)
         DashMakeRect(DashNameRC("B_SIDEBOX",r,baseCol+1),
                      cx - inset2, by + r*rowH + inset2,
                      bColW[baseCol+1]-inset4, rowH-inset4,
                      DASH_BG, 0, 20015);
         DashMakeText(DashNameRC("B_SIDE",r,baseCol+1), cx+DashS(6), by + r*rowH + tyPad, "-", clrWhite, fs, 20020);
         cx += bColW[baseCol+1];

         // VU zone (transparent)
         int vuzX = cx;
         int vuzY = by + r*rowH + inset2;
         int vuzW = bColW[baseCol+2] - inset6;
         int vuzH = rowH - inset4;
         DashMakeRect(DashNameRC("B_VUZ",r,baseCol+2), vuzX, vuzY, vuzW, vuzH, DASH_BG, 0, 20012);

         // VU guide frame (faint)
         int gi = DashS1(VU_GUIDE_INSET);
         DashMakeRect(DashNameRC("B_VUG",r,baseCol+2),
                      vuzX+gi, vuzY+gi,
                      MathMax(1, vuzW-gi*2),
                      MathMax(1, vuzH-gi*2),
                      VU_GUIDE_COLOR, VU_GUIDE_ALPHA, 20011);

         // Pre-create VU bars (hidden)
         for(int bi=0; bi<VU_MAX_BARS; bi++)
         {
            string bn = DashNameRC("VU", r*100 + baseCol, bi);
            DashMakeRect(bn, -10000, -10000, 0, 0, VU_COLOR, 0, 20014);
         }

         cx += bColW[baseCol+2];

         // CNT
         DashMakeText(DashNameRC("B_CNT",r,baseCol+3), cx, by + r*rowH + tyPad, "0", DASH_TEXT, fs, 20020);
         cx += bColW[baseCol+3];

         // PnL bar bg + fill (bg black)
         DashMakeRect(DashNameRC("B_PNLB",r,baseCol+4),
                      cx, by + r*rowH + inset4,
                      bColW[baseCol+4]-inset6,
                      rowH-inset8,
                      DASH_BG, 0, 20012);

         DashMakeRect(DashNameRC("B_PNLF",r,baseCol+4),
                      cx+inset2, by + r*rowH + inset6,
                      DashS1(1),
                      rowH-inset12,
                      DASH_GREEN, 180, 20013);

         cx += bColW[baseCol+4];

         // PnL number
         DashMakeText(DashNameRC("B_PNLN",r,baseCol+5), cx, by + r*rowH + tyPad, "0.00", DASH_TEXT, fs, 20020);
         cx += bColW[baseCol+5];

         // LOT box + text (bg black)
         DashMakeRect(DashNameRC("B_LOTBOX",r,baseCol+6),
                      cx+inset2, by + r*rowH + inset4,
                      bColW[baseCol+6]-inset6, rowH-inset8,
                      DASH_BG, 0, 20015);
         DashMakeText(DashNameRC("B_LOT",r,baseCol+6), cx+DashS(6), by + r*rowH + tyPad, "0.00", DASH_TEXT, fs, 20020);
      }
   }

   //==============================
   // Draw Table C under Table B
   //==============================
   int cx0 = DashX() + pad;
   int cy0 = by + rowH*bRows + pad;

   int xx = cx0;
   DashMakeRect(DashName("CBG"), cx0, cy0,      cW, rowH, g_guard_ok ? clrDarkRed:clrDarkViolet, 150, 20000);
   for(int i=0;i<=cCols;i++)
   {
      DashMakeRect(DashNameRC("C_V",0,i), xx, cy0, line, rowH, DASH_GRID, 140, 20010);
      if(i<cCols) xx += cColW[i];
   }
   DashMakeRect(DashNameRC("C_H",0,0), cx0, cy0,      cW, line, DASH_GRID, 140, 20010);
   DashMakeRect(DashNameRC("C_H",1,0), cx0, cy0+rowH, cW, line, DASH_GRID, 140, 20010);

   int t = cx0 + txPad;
   DashMakeText(DashNameRC("C_T",0,0),  t, cy0+tyPad, "PORT", DASH_BLUE, fs, 20020); t += cColW[0];
   DashMakeText(DashNameRC("C_VV",0,1), t, cy0+tyPad, "-",    DASH_TEXT, fs, 20020); t += cColW[1];
   DashMakeText(DashNameRC("C_T",0,2),  t, cy0+tyPad, "TYPE", DASH_BLUE, fs, 20020); t += cColW[2];
   DashMakeText(DashNameRC("C_VV",0,3), t, cy0+tyPad, "-",    DASH_BLUE, fs, 20020); t += cColW[3];
   DashMakeText(DashNameRC("C_T",0,4), t, cy0+tyPad, g_guard_reason, g_guard_ok ? clrLightBlue : clrWhite, fs, 20020); t += cColW[3];
   DashMakeText(DashNameRC("C_TAG",0,5),t, cy0+tyPad, g_guard_ok ? "=== EASY_M 10Pair === [0123]":" ", DASH_GOLD, fs, 20020);

   // --- Draw Table D (Auto status) under Table C
   int dx0 = DashX() + pad;
   int dy0 = cy0 + rowH + pad; // below Table C
   
   // Grid lines
   int ddx = dx0;
   for(int i=0;i<=dCols;i++)
   {
      DashMakeRect(DashNameRC("D_V",0,i), ddx, dy0, 1, rowH, DASH_GRID, 140, 20010);
      if(i<dCols) ddx += dColW[i];
   }
   DashMakeRect(DashNameRC("D_H",0,0), dx0, dy0,      dW, 1, DASH_GRID, 140, 20010);
   DashMakeRect(DashNameRC("D_H",1,0), dx0, dy0+rowH, dW, 1, DASH_GRID, 140, 20010);
   
   // Text placeholders
   int txD = dx0 + DashPx(5);
   int tyD = dy0 + DashPx(3);
   
   DashMakeText(DashNameRC("D_T",0,0),  txD, tyD, "MODE",  DASH_BLUE, fs, 20020); txD += dColW[0];
   DashMakeText(DashNameRC("D_VV",0,1), txD, tyD, "-",     DASH_TEXT, fs, 20020); txD += dColW[1];
   DashMakeText(DashNameRC("D_T",0,2),  txD, tyD, "WORST", DASH_BLUE, fs, 20020); txD += dColW[2];
   DashMakeText(DashNameRC("D_VV",0,3), txD, tyD, "-",     DASH_TEXT, fs, 20020);

   g_dashBuilt = true;
}

//====================================================================
// DashboardUpdate
//====================================================================
void DashboardUpdate()
{
   if(!InpShowDashboard) { DashDeleteAll(); return; }
   DashboardBuild();
   if(!g_dashBuilt) return;
   // [GUARD] Refresh status for dashboard
   GuardRefresh();

   // Refresh states (dashboard-only; skip disabled)
   for(int i=0;i<ArraySize(g_state);i++)
   {
      if(!g_state[i].enabled) continue;
      UpdateSymbolPositions(g_state[i]);
   }

   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   double ddp = (bal>0 ? (bal-eq)/bal*100.0 : 0.0);

   // totals
   double lots=0.0; int orders=0;
   for(int i=0;i<ArraySize(g_state);i++)
   {
      if(!g_state[i].enabled) continue;
      lots   += CurrentSymbolLots(g_state[i].sym, g_state[i].magic);
      orders += (g_state[i].buyCount + g_state[i].sellCount);
   }
   double today = TodayClosedProfit();

   // Table A values
   ObjectSetString(g_dashChart, DashNameRC("A_VV",1,0), OBJPROP_TEXT, Money2(bal));
   ObjectSetString(g_dashChart, DashNameRC("A_VV",1,1), OBJPROP_TEXT, Money2(eq));
   ObjectSetString(g_dashChart, DashNameRC("A_VV",1,2), OBJPROP_TEXT, StringFormat("%.2f", ddp));
   ObjectSetString(g_dashChart, DashNameRC("A_VV",1,3), OBJPROP_TEXT, StringFormat("%.2f", lots));
   ObjectSetString(g_dashChart, DashNameRC("A_VV",1,4), OBJPROP_TEXT, StringFormat("%d", orders));
   ObjectSetString(g_dashChart, DashNameRC("A_VV",1,5), OBJPROP_TEXT, Money2(today));

   // DD / Today colors (no red)
   ObjectSetInteger(g_dashChart, DashNameRC("A_VV",1,2), OBJPROP_COLOR, (ddp>10.0 ? DASH_GREEN : DASH_GOLD_TEXT));
   ObjectSetInteger(g_dashChart, DashNameRC("A_VV",1,5), OBJPROP_COLOR, (today>=0 ? DASH_GREEN : DASH_GOLD));

   // Per row data (dynamic: supports 10 pairs / 20 symbols)
   int nSym = ArraySize(g_state);
   
   SymDash sd[];
   ArrayResize(sd, nSym);
   
   for(int i=0; i<nSym; i++)
      BuildSymDash(g_state[i], sd[i]);

      int lenPad = DashS(2);  // padding inside pnl bar half-width   
   // max abs pnl for scaling bars
   double maxAbs = 0.0;
   for(int i=0; i<nSym; i++)
   {
      double a = MathAbs(sd[i].pnl);
      if(a > maxAbs) maxAbs = a;
   }
   if(maxAbs < 0.01) maxAbs = 0.01;
   
   // Table B body rows = 10 (left/right blocks => 20 symbols)
   int bBodyRows = 10;
   
   for(int pr=0; pr<bBodyRows; pr++)
   {
      int row = 1 + pr;
   
      int i1 = pr*2;       // left symbol index
      int i2 = pr*2 + 1;   // right symbol index
   
      for(int k=0; k<2; k++)
      {
         int idx = (k==0 ? i1 : i2);
         if(idx < 0 || idx >= nSym) continue;
   
         SymDash d = sd[idx];
         int baseCol = k*7;

         // SYM (always show base symbol)
         ObjectSetString(g_dashChart, DashNameRC("B_SYM",row,baseCol+0), OBJPROP_TEXT, d.sym);
         
         // --- Signal states (first-entry conditions only)
         bool rsiOK = false;
         double rsi = 0.0;
         
         if(g_state[idx].enabled && g_state[idx].rsiHandle != INVALID_HANDLE)
         {
            if(GetRSI(g_state[idx], rsi))
               rsiOK = true;
         }
         
         bool buyRSI  = (rsiOK && (rsi < InpRSI_Oversold));
         bool sellRSI = (rsiOK && (rsi > InpRSI_Overbought));
         
         bool buyWick  = false;
         bool sellWick = false;
         
         if(g_state[idx].enabled && StringLen(g_state[idx].sym) > 0)
         {
            buyWick  = PrevCandleWickOK(g_state[idx].sym, InpRSI_TF, 1);
            sellWick = PrevCandleWickOK(g_state[idx].sym, InpRSI_TF, 2);
         }
         
         // Colors: BUY=blue, SELL=gold, OFF=grey
         color onBuy  = DASH_BLUE;
         color onSell = DASH_GOLD_TEXT;
         color offC   = SIG_OFF_COLOR;
         
         ObjectSetInteger(g_dashChart, DashSigName(row, baseCol, "B_RSI"),  OBJPROP_COLOR, (buyRSI  ? onBuy  : offC));
         ObjectSetInteger(g_dashChart, DashSigName(row, baseCol, "B_WICK"), OBJPROP_COLOR, (buyWick ? onBuy  : offC));
         ObjectSetInteger(g_dashChart, DashSigName(row, baseCol, "S_RSI"),  OBJPROP_COLOR, (sellRSI ? onSell : offC));
         ObjectSetInteger(g_dashChart, DashSigName(row, baseCol, "S_WICK"), OBJPROP_COLOR, (sellWick? onSell : offC));

         // SIDE (FIX: BUY=BLUE, SELL=ORANGE; empty=black)
         string s = "-";
         color  sb = DASH_BG;
         int    a  = 0;

         if(d.count > 0)
         {
            if(d.side==1) { s="B"; sb=DASH_ORANGE;   a=90; }
            if(d.side==2) { s="S"; sb=DASH_BLUE; a=90; }
         }

         string sideTxt = DashNameRC("B_SIDE",row,baseCol+1);
         string sideBox = DashNameRC("B_SIDEBOX",row,baseCol+1);

         ObjectSetString (g_dashChart, sideTxt, OBJPROP_TEXT, s);
         ObjectSetInteger(g_dashChart, sideTxt, OBJPROP_COLOR, clrWhite);

         color fillSB = (color)ColorToARGB(sb, (uchar)a);
         ObjectSetInteger(g_dashChart, sideBox, OBJPROP_COLOR,   fillSB);
         ObjectSetInteger(g_dashChart, sideBox, OBJPROP_BGCOLOR, fillSB);

         // CNT
         ObjectSetString(g_dashChart, DashNameRC("B_CNT",row,baseCol+3), OBJPROP_TEXT, StringFormat("%d", d.count));

         // PnL number
         ObjectSetString(g_dashChart, DashNameRC("B_PNLN",row,baseCol+5), OBJPROP_TEXT, Money2(d.pnl));
         ObjectSetInteger(g_dashChart, DashNameRC("B_PNLN",row,baseCol+5), OBJPROP_COLOR, (d.pnl>=0?DASH_GREEN:DASH_GOLD_TEXT));

         // LOT
         ObjectSetString(g_dashChart, DashNameRC("B_LOT",row,baseCol+6), OBJPROP_TEXT, StringFormat("%.2f", d.lots));

         // PnL fill: center-based
         string bg   = DashNameRC("B_PNLB",row,baseCol+4);
         string fill = DashNameRC("B_PNLF",row,baseCol+4);

         int bgW = (int)ObjectGetInteger(g_dashChart, bg, OBJPROP_XSIZE);
         int bgX = (int)ObjectGetInteger(g_dashChart, bg, OBJPROP_XDISTANCE);
         int yy  = (int)ObjectGetInteger(g_dashChart, bg, OBJPROP_YDISTANCE);
         int hh  = (int)ObjectGetInteger(g_dashChart, bg, OBJPROP_YSIZE);

         int mid = bgX + bgW/2;
         int half = bgW/2 - lenPad;
         if(half < 1) half = 1;

         int len = (int)MathRound((MathAbs(d.pnl)/maxAbs) * (double)half);
         if(len < 1) len = 1;

         if(d.pnl >= 0)
         {
            ObjectSetInteger(g_dashChart, fill, OBJPROP_XDISTANCE, mid);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_XSIZE, len);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_YSIZE, hh);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_YDISTANCE, yy);

            color cc = (color)ColorToARGB(DASH_GREEN, (uchar)200);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_COLOR,   cc);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_BGCOLOR, cc);
         }
         else
         {
            ObjectSetInteger(g_dashChart, fill, OBJPROP_XDISTANCE, mid - len);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_XSIZE, len);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_YSIZE, hh);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_YDISTANCE, yy);

            color cc = (color)ColorToARGB(DASH_GOLD, (uchar)200);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_COLOR,   cc);
            ObjectSetInteger(g_dashChart, fill, OBJPROP_BGCOLOR, cc);
         }

         //==============================
         // VU bars (reuse objects)
         //==============================
         int bars = MathMin(d.count, VU_MAX_BARS);

         string vuz = DashNameRC("B_VUZ",row,baseCol+2);
         int zx = (int)ObjectGetInteger(g_dashChart, vuz, OBJPROP_XDISTANCE);
         int zy = (int)ObjectGetInteger(g_dashChart, vuz, OBJPROP_YDISTANCE);
         int zw = (int)ObjectGetInteger(g_dashChart, vuz, OBJPROP_XSIZE);
         int zh = (int)ObjectGetInteger(g_dashChart, vuz, OBJPROP_YSIZE);

         int padX = DashS(VU_PAD_X);
         int padY = DashS(VU_PAD_Y);
         int gap  = DashS1(VU_GAP);
         int w1   = DashS1(VU_FIRST_W);
         int wN   = DashS1(VU_NEXT_W);

         int barY = zy + padY;
         int barH = MathMax(1, zh - padY*2);

         int x0   = zx + padX;
         int maxW = MathMax(1, zw - padX - 1);

         color showC = (color)ColorToARGB(VU_COLOR, (uchar)VU_ALPHA);

         int bxIt = x0;

         for(int bi=0; bi<VU_MAX_BARS; bi++)
         {
            int bw = (bi==0 ? w1 : wN);
            string bn = DashNameRC("VU", row*100 + baseCol, bi);

            if(bi >= bars)
            {
               DashHideRect(bn);
               continue;
            }

            if((bxIt - x0) + bw > maxW)
            {
               DashHideRect(bn);
               continue;
            }

            ObjectSetInteger(g_dashChart, bn, OBJPROP_XDISTANCE, bxIt);
            ObjectSetInteger(g_dashChart, bn, OBJPROP_YDISTANCE, barY);
            ObjectSetInteger(g_dashChart, bn, OBJPROP_XSIZE, bw);
            ObjectSetInteger(g_dashChart, bn, OBJPROP_YSIZE, barH);
            ObjectSetInteger(g_dashChart, bn, OBJPROP_COLOR,   showC);
            ObjectSetInteger(g_dashChart, bn, OBJPROP_BGCOLOR, showC);
            ObjectSetInteger(g_dashChart, bn, OBJPROP_BORDER_TYPE, BORDER_FLAT);

            bxIt += bw + gap;
         }
      }
   }

   //==============================
   // Table C (Account info)
   //==============================
   long login = (long)AccountInfoInteger(ACCOUNT_LOGIN);
   string loginS = StringFormat("%I64d", login);

   string cur = AccountInfoString(ACCOUNT_CURRENCY);
   bool isCent = IsCentCurrency(cur);

   string typeS = (isCent ? "CENT" : "USD");
   string typeFull = typeS + " (" + cur + ")";

   ObjectSetString(g_dashChart, DashNameRC("C_VV",0,1), OBJPROP_TEXT, loginS);
   ObjectSetString(g_dashChart, DashNameRC("C_VV",0,3), OBJPROP_TEXT, typeFull);
   ObjectSetString(g_dashChart, DashNameRC("C_T",0,4), OBJPROP_TEXT, g_guard_reason);
   ObjectSetInteger(g_dashChart, DashNameRC("C_T",0,4), OBJPROP_COLOR, (g_guard_ok ? clrLightBlue : clrWhite));
   ObjectSetString(g_dashChart, DashNameRC("C_TAG",0,5), OBJPROP_TEXT, g_guard_ok ? "=== EASY_M 10Pair === [0123]":" ");
   ObjectSetInteger(g_dashChart, DashName("CBG"), OBJPROP_BGCOLOR, g_guard_ok ? clrDarkBlue:clrDarkRed);
   ObjectSetInteger(g_dashChart, DashNameRC("C_VV",0,3), OBJPROP_COLOR, (isCent ? DASH_GREEN : DASH_ORANGE));
   
      // --- Update Table D (Auto status)
   string modeTxt = PortModeToStr() + "  DD=" + StringFormat("%.2f%%", FloatingDDPct());
   string worstTxt = "-";
   if(InpEnablePortfolioSafety && InpEnableWorstThrottle)
      worstTxt = BuildWorstSummary(80);
   
   ObjectSetString(g_dashChart, DashNameRC("D_VV",0,1), OBJPROP_TEXT, modeTxt);
   ObjectSetString(g_dashChart, DashNameRC("D_VV",0,3), OBJPROP_TEXT, worstTxt);
   
   // Colors
   color modeCol = DASH_GREEN;
   if(g_portMode == PM_SLOW)   modeCol = DASH_ORANGE;
   if(g_portMode == PM_FREEZE) modeCol = DASH_GOLD_TEXT;
   
   ObjectSetInteger(g_dashChart, DashNameRC("D_VV",0,1), OBJPROP_COLOR, modeCol);
   ObjectSetInteger(g_dashChart, DashNameRC("D_VV",0,3), OBJPROP_COLOR, DASH_TEXT);
   
}


//====================================================================
// Event Operation Start Here
//====================================================================

void OnTimer()
{
   DashApplyChartRules();
   DashboardUpdate();
   ChartRedraw(g_dashChart);
   EM_MonitorOnTimer();
}

//====================================================================
// Init / Deinit / Tick
//====================================================================
int OnInit()
{
    if(!CheckEaezeLicense()) {
        return(INIT_FAILED);
    }
    RemoveLicenseAlert();
    EM_MonitorInit(InpMagicBase);
   
   g_dashChart = ChartID();

   PrintFormat("[GUARD DEBUG] login=%I64d bal=%.2f cur=%s allowedN=%d",
               (long)AccountInfoInteger(ACCOUNT_LOGIN),
               AccountInfoDouble(ACCOUNT_BALANCE),
               AccountInfoString(ACCOUNT_CURRENCY),
               (int)ArraySize(GUARD_ALLOWED_LOGINS));

   // Keep dashboard above chart drawings
   ChartSetInteger(g_dashChart, CHART_FOREGROUND, false);
      
      // Keep dashboard clean
   ChartSetInteger(g_dashChart, CHART_SHOW_TRADE_HISTORY, false);
   ChartSetInteger(g_dashChart, CHART_SHOW_TRADE_LEVELS,  false);
   ChartSetInteger(g_dashChart, CHART_SHOW_OBJECT_DESCR,  false);
   ChartRedraw(g_dashChart);

   int n = (int)(sizeof(g_cfg)/sizeof(g_cfg[0]));
   ArrayResize(g_state, n);
   ArrayResize(g_portSymbolCounted, n);
   
   ArrayResize(g_isWorst, n);
   ArrayResize(g_symThrottle, n);
   ArrayResize(g_symLossPct, n);
   ArrayResize(g_lastWorstGridSlot, n);
   
   ArrayInitialize(g_isWorst, false);
   for(int i=0;i<n;i++)
   {
      g_symThrottle[i] = ST_NONE;
      g_symLossPct[i]  = 0.0;
      g_lastWorstGridSlot[i] = -999999;
   }

   
   for(int i=0;i<n;i++) g_portSymbolCounted[i]=false;

   for(int i=0; i<n; i++)
   {
      g_state[i].baseSym = g_cfg[i].sym;

      g_state[i].sym = ResolveSymbolName(g_cfg[i].sym);
      g_state[i].groupId = g_cfg[i].groupId;
      g_state[i].enabled = true;

      g_state[i].magic = InpMagicBase + (long)(i + 1);

      g_state[i].lastEntryBarTimeBuy  = 0;
      g_state[i].lastEntryBarTimeSell = 0;
      g_state[i].lastExitBarTimeBuy   = 0;
      g_state[i].lastExitBarTimeSell  = 0;
      g_state[i].lastGridBarTimeBuy   = 0;
      g_state[i].lastGridBarTimeSell  = 0;
      g_state[i].activeSide           = 0;
      g_state[i].gridPips              = (double)InpGridDistancePips;
      g_state[i].targetMoney           = InpBasketTargetMoney;
      g_state[i].lastD1BarTime          = 0;

      g_state[i].lastAction = "";
      g_state[i].lastReason = "";

      if(!SymbolSelect(g_state[i].sym, true))
      {
         PrintFormat("[WARN] Symbol not available: %s (base=%s suffix=%s)",
                     g_state[i].sym, g_cfg[i].sym, InpSymbolSuffix);
         g_state[i].enabled = false;
         g_state[i].rsiHandle = INVALID_HANDLE;
         g_state[i].atrHandle = INVALID_HANDLE;
         if(InpRequireAllSymbols)
            return(INIT_FAILED);
         continue;
      }

      g_state[i].rsiHandle = iRSI(g_state[i].sym, InpRSI_TF, InpRSI_Period, PRICE_CLOSE);
      if(g_state[i].rsiHandle == INVALID_HANDLE)
      {
         Print("RSI handle creation failed for ", g_state[i].sym);
         g_state[i].enabled = false;
         if(InpRequireAllSymbols)
            return(INIT_FAILED);
         continue;
      }

      g_state[i].atrHandle = iATR(g_state[i].sym, PERIOD_D1, ATR_D1_PERIOD);
      if(g_state[i].atrHandle == INVALID_HANDLE)
      {
         Print("ATR handle creation failed for ", g_state[i].sym);
         g_state[i].enabled = false;
         if(InpRequireAllSymbols)
            return(INIT_FAILED);
         continue;
      }
   }

   Print("EASY_M_10Pairs initialized. Symbols=", n, ", MagicBase=", InpMagicBase);

   EventSetTimer(DASH_TIMER_SEC);
   DashApplyChartRules();
   // Build dashboard objects once
   if(InpShowDashboard)
   {
      GuardRefresh();      // Ensure guard state is ready for the first paint
      DashboardBuild();
      DashboardUpdate();   // Force first update now (no need to wait for timer)
      ChartRedraw(g_dashChart);
   }
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
    if(reason != REASON_INITFAILED) {
        RemoveLicenseAlert();
    }
    EM_MonitorDeinit();
    
   EventKillTimer();
   DashDeleteAll();

   for(int i=0; i<ArraySize(g_state); i++)
   {
      if(g_state[i].rsiHandle != INVALID_HANDLE)
         IndicatorRelease(g_state[i].rsiHandle);
      if(g_state[i].atrHandle != INVALID_HANDLE)
         IndicatorRelease(g_state[i].atrHandle);
   }
}

void OnTick()
{
      // [GUARD] Block trading when account is not allowed
   /* //============== Disable inside Port Check =================
   GuardRefresh();
   if(!g_guard_ok)
   {
      // Print at most once per 30 seconds (avoid spam)
      static datetime lastPrint = 0;
      datetime now = TimeCurrent();
      if(now - lastPrint >= 30)
      {
         PrintFormat("[GUARD] Trading blocked: %s", g_guard_reason);
         lastPrint = now;
      }
      return; // stop trading loop
   }
   */ //============== Disable inside Port Check =================
   
   CheckEaezeLicensePeriodic();           // check allow every 15 min on eaeze_licensing.mgh
   ResetPortfolioGridCounterIfNewBar();

   // Pass 1: refresh metrics for all enabled symbols
   for(int i=0; i<ArraySize(g_state); i++)
   {
      if(!g_state[i].enabled) continue;
      UpdateSymbolPositions(g_state[i]);
   }

   // Update modes (uses refreshed metrics)
   UpdatePortfolioAutoMode();
   UpdateWorstSymbolsTopN();

   // Pass 2: trading loop (minimal behavior change, more consistent limits)
   for(int i=0; i<ArraySize(g_state); i++)
   {
      if(!g_state[i].enabled) continue;

      TryEntry(g_state[i]);
      TryGrid(g_state[i]);
      TryExit(g_state[i]);
   }
}
//+------------------------------------------------------------------+
