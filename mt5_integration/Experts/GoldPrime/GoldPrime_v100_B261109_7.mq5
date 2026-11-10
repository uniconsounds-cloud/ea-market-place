//+------------------------------------------------------------------+
//|                                     GoldPrime_v100_B261109_7.mq5 |
//|                                  Copyright 2026, EAeze Solutions |
//|                                       https://www.eaeze.trade    |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, EAeze Solutions"
#property link        "https://www.eaeze.trade"
#property version     "1.00"
#property description "GoldPrime - XAUUSD M1 Cascading Recovery EA with Hybrid Volatility Exhaustion Engine"

//+------------------------------------------------------------------+
//| VERSION CONTROL & DEVELOPMENT CHANGELOG                          |
//+------------------------------------------------------------------+
/*
 * SYSTEM CODE : GP-XAU-M1
 * BUILD NUMBER: B261109.7
 * RELEASE DATE: 2026.11.09
 *
 * CHANGELOG HISTORY:
 * ------------------------------------------------------------------
 * v1.00 [B261109.1 - B261109.5]
 *   - 3-Tier Cascading Recovery Architecture with Independent Point Gaps.
 *   - Continuous Lot Pipeline (T1 -> T2 -> T3) without slot reservation for anchors.
 *   - Any-order-count take profit (>= 1 order) for all tiers.
 *
 * v1.00 [B261109.6] - Dynamic Lowest-Price Single Anchor Engine
 *   - Strictly 1 Anchor in portfolio at all times at the lowest entry price.
 *   - Dynamic anchor swap and absorption: superseded anchors are absorbed back into the tier scalp.
 *
 * v1.00 [B261109.7] - Hybrid Dynamic Entry (Volatility & Momentum Exhaustion)
 *   - PROBLEM SOLVED: On M1 Gold, during massive news candles or flash crashes, fixed point gaps
 *     could trigger entry right in the middle of a waterfall drop (Falling Knife).
 *   - HYBRID DYNAMIC ENTRY: Combines physical Minimum Gap distance with M1 Price Action Cooling.
 *     Even after reaching the minimum gap, the EA pauses and verifies that the market has stopped
 *     running violently before firing recovery orders.
 *   - MULTI-FACTOR EXHAUSTION DETECTION:
 *     1) Falling Knife Blocker: Disallows entry on solid bearish bodies (> 75%) with tiny wicks (< 20%).
 *     2) Consecutive Low Failure: Verifies that M1 has stopped making Lower Lows.
 *     3) Absorption Wick Rejection: Detects strong buyer absorption wicks (Lower Wick >= 35%).
 *     4) Range Contraction: Detects consolidation when M1 candle range contracts <= 50% of the previous 3-bar average.
 *     5) Optional Fast EMA Momentum Reclaim.
 */

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

#define EA_BUILD_TAG     "B261109.7"
#define EA_SYSTEM_CODE   "GoldPrime"
#define EA_DASH_TITLE    "GoldPrime v1.00 [B261109.7] - Volatility Cooling Engine"
#define MAX_LOT_SLOTS    50

//+------------------------------------------------------------------+
//| ENUMERATIONS                                                     |
//+------------------------------------------------------------------+
enum ENUM_LOT_CALC_MODE
{
   LOT_FIXED        = 0, // Fixed Lot (All orders identical)
   LOT_LINEAR_STEP  = 1, // Linear Step (+Step lot per order)
   LOT_MULTIPLIER   = 2, // Multiplier (Base * Multiplier^N)
   LOT_LADDER_STEP  = 3  // Ladder Step (Repeat 2 times then add step - Prime Mode)
};

enum ENUM_INITIAL_ENTRY_SIDE
{
   SIDE_BUY  = 0, // Open Immediate BUY on attach
   SIDE_SELL = 1  // Open Immediate SELL on attach
};

//+------------------------------------------------------------------+
//| INPUT PARAMETERS                                                 |
//+------------------------------------------------------------------+
input group "=== GENERAL EA CONFIGURATION ==="
input ulong                  InpBaseMagicNumber       = 780000;      // Base Magic Number
input string                 InpTradeCommentPrefix    = "GP-B261109"; // Order Comment Prefix
input int                    InpMaxSpreadPoints       = 0;           // Max Allowed Spread (Points, 0=Disable Filter)

input group "=== INITIAL ENTRY & PRIMARY BASKET (TIER 1) ==="
input bool                   InpImmediateEntry        = true;        // Immediate Entry on Attachment
input ENUM_INITIAL_ENTRY_SIDE InpInitialSide          = SIDE_BUY;    // Initial Order Direction
input int                    InpTier1Orders           = 7;           // Number of Orders in Tier 1 Basket
input int                    InpGridDistancePoints    = 100;         // Grid Spacing Between Orders (Points)
input double                 InpBasketTargetMoney     = 5.0;         // Primary Basket Take Profit ($)

input group "=== CASCADING RECOVERY TIERS (TIER 2 & TIER 3) ==="
input int                    InpGapT1ToT2Points       = 500;         // Min Floor Gap: Tier 1 -> Tier 2 (Points)
input int                    InpGapT2ToT3Points       = 500;         // Min Floor Gap: Tier 2 -> Tier 3 (Points)
input int                    InpTier2Orders           = 3;           // Regular Orders in Tier 2
input int                    InpTier3Orders           = 3;           // Regular Orders in Tier 3
input double                 InpTierScalpTargetMoney  = 5.0;         // Scalp Take Profit for T2 / T3 ($)
input bool                   InpResetGapOnScalpExit   = true;        // Reset Gap Reference Price on Scalp Exit for Fresh Cycle

input group "=== HYBRID VOLATILITY COOLING & MOMENTUM EXHAUSTION ==="
input bool                   InpUseVolCoolingCheck    = true;        // Enable Volatility Cooling & Momentum Filter
input int                    InpConsecutiveLowBars    = 2;           // Min M1 Bars without New Low (0=Disable)
input double                 InpRejectionWickMinPct   = 35.0;        // Rejection Wick Min % of Candle (0=Disable)
input double                 InpContractionRatioPct   = 50.0;        // Range Contraction % vs Previous 3-Bar Avg (0=Disable)
input bool                   InpRequireFastEmaReclaim = false;       // Require M1 Close > Fast EMA
input int                    InpFastEmaPeriod         = 5;           // Fast EMA Period for Momentum Reclaim

input group "=== TOXIC TRIM ENGINE (PARTIAL CLOSE ON TIER 3) ==="
input bool                   InpEnableToxicTrim       = true;        // Enable Toxic Trim on Oldest Ticket
input double                 InpTrimProfitSharePct    = 50.0;        // % of T3 Profit Allocated to Trim Worst Ticket

input group "=== PRE-COMPUTED LOT PIPELINE ==="
input ENUM_LOT_CALC_MODE     InpLotMode               = LOT_LINEAR_STEP; // Lot Calculation Mode
input double                 InpStartLot              = 0.01;        // Starting Lot Size
input double                 InpLotStep               = 0.01;        // Step Addition (Linear & Ladder)
input double                 InpLotMultiplier         = 1.30;        // Multiplier Factor
input int                    InpLadderGroupSize       = 2;           // Ladder Step Group Size (Repeat Count)
input double                 InpHardMaxLot            = 5.00;        // Hard Ceiling Maximum Lot

input group "=== SAFETY CIRCUITS ==="
input int                    InpBarCooldownPeriod     = 1;           // Bar Cooldown (Min M1 bars between orders)
input bool                   InpEnableAutoHedge       = true;        // Enable Auto-Hedge Circuit Breaker
input double                 InpHedgeTriggerDD_Pct    = 25.0;        // Auto-Hedge Trigger Drawdown (%)

//+------------------------------------------------------------------+
//| STRUCTS FOR BASKET STATE TRACKING                                |
//+------------------------------------------------------------------+
struct BasketSnapshot
{
   int    totalCount;
   double totalVolume;
   double totalProfit;
   double totalFloatingLoss;
   
   // Tier 1
   int    t1Count;
   double t1Volume;
   double t1Profit;
   double t1LowestBuy;
   
   // Tier 2 (excluding active anchor)
   int    t2Count;
   double t2Volume;
   double t2Profit;
   double t2LowestBuy;
   
   // Tier 3 (excluding active anchor)
   int    t3Count;
   double t3Volume;
   double t3Profit;
   double t3LowestBuy;
   
   // Single Active Anchor (Always the lowest ticket)
   ulong  anchorTicket;
   double anchorPrice;
   double anchorVolume;
   double anchorProfit;
   
   // Global lowest/highest
   double lowestBuyPrice;
   double highestSellPrice;
   
   // Worst Toxic Ticket (Oldest order in T1)
   ulong  worstTicket;
   double worstLoss;
   double worstVolume;
};

//+------------------------------------------------------------------+
//| GLOBAL SYSTEM VARIABLES                                          |
//+------------------------------------------------------------------+
CTrade         trade;
CPositionInfo  posInfo;

// Dedicated Magic Numbers
ulong g_magicT1        = 0;
ulong g_magicT2        = 0;
ulong g_magicT3        = 0;
ulong g_magicAnchor    = 0;
ulong g_magicHedge     = 0;

// Dynamic Lowest-Price Anchor Tracker
ulong    g_currentAnchorTicket = 0;
double   g_anchorPrice         = 0.0;

// Pre-computed Lot Pipeline Array
double g_lotSequence[MAX_LOT_SLOTS];

// Physical Reference Prices for Tier Gaps
double   g_tier1LastOrderPrice = 0.0;
double   g_tier2LastOrderPrice = 0.0;
double   g_tier3LastOrderPrice = 0.0;

datetime g_lastOrderBarTime   = 0;
bool     g_isHedgeLocked      = false;
string   g_statusMessage      = "SYSTEM READY";

// Forward Declarations
void UpdateDashboard(double ddPct, double totalProfit, string customStatus = "");
int  GetMagicCount(ulong magic);
void AutoDetectFillingMode();
ulong OpenOrder(ENUM_POSITION_TYPE type, double lot, ulong magic, string comment);
void CheckAnchorValidation();
bool IsVolatilityCoolingConfirmed(ENUM_POSITION_TYPE posType);

//+------------------------------------------------------------------+
//| Auto-detect and configure broker filling mode dynamically        |
//+------------------------------------------------------------------+
void AutoDetectFillingMode()
{
   uint fillingMode = (uint)SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);
   
   if((fillingMode & SYMBOL_FILLING_FOK) != 0)
      trade.SetTypeFilling(ORDER_FILLING_FOK);
   else if((fillingMode & SYMBOL_FILLING_IOC) != 0)
      trade.SetTypeFilling(ORDER_FILLING_IOC);
   else
      trade.SetTypeFilling(ORDER_FILLING_RETURN);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   g_magicT1        = InpBaseMagicNumber + 1;
   g_magicT2        = InpBaseMagicNumber + 2;
   g_magicT3        = InpBaseMagicNumber + 3;
   g_magicAnchor    = InpBaseMagicNumber + 90;
   g_magicHedge     = InpBaseMagicNumber + 99;

   trade.SetExpertMagicNumber(g_magicT1);
   trade.SetDeviationInPoints(30);

   AutoDetectFillingMode();
   PrecalculateLotPipeline();

   PrintFormat("[%s] Initialized Successfully! Build: %s | Symbol: %s | Magic Base: %I64u",
               EA_SYSTEM_CODE, EA_BUILD_TAG, _Symbol, InpBaseMagicNumber);

   UpdateDashboard(0.0, 0.0, "INITIALIZING...");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Comment("");
}

//+------------------------------------------------------------------+
//| Precompute Continuous Lot Pipeline (T1 -> T2 -> T3)              |
//+------------------------------------------------------------------+
void PrecalculateLotPipeline()
{
   ArrayInitialize(g_lotSequence, 0.0);
   
   double minLot   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(minLot <= 0)  minLot = 0.01;
   if(lotStep <= 0) lotStep = 0.01;
   if(maxLot <= 0)  maxLot = 100.0;

   double base = MathMax(InpStartLot, minLot);

   for(int i = 0; i < MAX_LOT_SLOTS; i++)
   {
      double calcLot = base;
      
      switch(InpLotMode)
      {
         case LOT_FIXED:
            calcLot = base;
            break;
            
         case LOT_LINEAR_STEP:
            calcLot = base + (i * InpLotStep);
            break;
            
         case LOT_MULTIPLIER:
            calcLot = base * MathPow(InpLotMultiplier, i);
            break;
            
         case LOT_LADDER_STEP:
         {
            int groupIndex = (InpLadderGroupSize > 0) ? (i / InpLadderGroupSize) : i;
            calcLot = base + (groupIndex * InpLotStep);
            break;
         }
      }

      if(InpHardMaxLot > 0.0)
         calcLot = MathMin(calcLot, InpHardMaxLot);
          
      calcLot = MathMax(minLot, MathMin(maxLot, calcLot));
      calcLot = MathFloor(calcLot / lotStep + 0.00001) * lotStep;
      
      g_lotSequence[i] = calcLot;
   }
}

//+------------------------------------------------------------------+
//| Check if order belongs to this EA                                |
//+------------------------------------------------------------------+
bool IsOurMagic(ulong magic)
{
   return (magic == g_magicT1 || magic == g_magicT2 || magic == g_magicT3 ||
           magic == g_magicAnchor || magic == g_magicHedge);
}

//+------------------------------------------------------------------+
//| Validate Active Anchor Ticket Status                             |
//+------------------------------------------------------------------+
void CheckAnchorValidation()
{
   if(g_currentAnchorTicket > 0)
   {
      if(!posInfo.SelectByTicket(g_currentAnchorTicket) || posInfo.Symbol() != _Symbol)
      {
         g_currentAnchorTicket = 0;
         g_anchorPrice         = 0.0;
      }
      else
      {
         g_anchorPrice = posInfo.PriceOpen();
      }
   }
}

//+------------------------------------------------------------------+
//| Scan and snapshot current market basket                          |
//+------------------------------------------------------------------+
void ScanPositions(BasketSnapshot &snap)
{
   CheckAnchorValidation();
   ZeroMemory(snap);
   snap.lowestBuyPrice   = 999999.0;
   snap.highestSellPrice = 0.0;
   snap.worstLoss        = 0.0;
   snap.t1LowestBuy      = 999999.0;
   snap.t2LowestBuy      = 999999.0;
   snap.t3LowestBuy      = 999999.0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Symbol() != _Symbol) continue;
      
      ulong magic = posInfo.Magic();
      if(!IsOurMagic(magic)) continue;

      double profit = posInfo.Profit() + posInfo.Swap();
      double vol    = posInfo.Volume();
      double price  = posInfo.PriceOpen();

      snap.totalCount++;
      snap.totalVolume += vol;
      snap.totalProfit += profit;
      if(profit < 0.0) snap.totalFloatingLoss += MathAbs(profit);

      if(posInfo.PositionType() == POSITION_TYPE_BUY)
      {
         if(price < snap.lowestBuyPrice) snap.lowestBuyPrice = price;
      }
      else
      {
         if(price > snap.highestSellPrice) snap.highestSellPrice = price;
      }

      // Active Dynamic Anchor
      if(ticket == g_currentAnchorTicket)
      {
         snap.anchorTicket = ticket;
         snap.anchorPrice  = price;
         snap.anchorVolume = vol;
         snap.anchorProfit = profit;
         continue;
      }

      // Regular Tiers
      if(magic == g_magicT1)
      {
         snap.t1Count++;
         snap.t1Volume += vol;
         snap.t1Profit += profit;
         if(price < snap.t1LowestBuy) snap.t1LowestBuy = price;
         
         if(profit < snap.worstLoss)
         {
            snap.worstLoss   = profit;
            snap.worstTicket = ticket;
            snap.worstVolume = vol;
         }
      }
      else if(magic == g_magicT2 || magic == g_magicAnchor)
      {
         // Absorbed former anchors count towards T2 scalp!
         snap.t2Count++;
         snap.t2Volume += vol;
         snap.t2Profit += profit;
         if(price < snap.t2LowestBuy) snap.t2LowestBuy = price;
      }
      else if(magic == g_magicT3)
      {
         snap.t3Count++;
         snap.t3Volume += vol;
         snap.t3Profit += profit;
         if(price < snap.t3LowestBuy) snap.t3LowestBuy = price;
      }
   }

   if(snap.lowestBuyPrice >= 999999.0) snap.lowestBuyPrice = 0.0;
   if(snap.t1LowestBuy    >= 999999.0) snap.t1LowestBuy    = 0.0;
   if(snap.t2LowestBuy    >= 999999.0) snap.t2LowestBuy    = 0.0;
   if(snap.t3LowestBuy    >= 999999.0) snap.t3LowestBuy    = 0.0;

   // Synchronize reference prices if positions exist
   if(snap.t1Count >= InpTier1Orders && g_tier1LastOrderPrice == 0.0 && snap.t1LowestBuy > 0.0)
      g_tier1LastOrderPrice = snap.t1LowestBuy;

   if(snap.t2Count >= InpTier2Orders && g_tier2LastOrderPrice == 0.0 && snap.t2LowestBuy > 0.0)
      g_tier2LastOrderPrice = snap.t2LowestBuy;
}

//+------------------------------------------------------------------+
//| Multi-Factor Volatility Cooling & Momentum Exhaustion Detector   |
//+------------------------------------------------------------------+
bool IsVolatilityCoolingConfirmed(ENUM_POSITION_TYPE posType)
{
   if(!InpUseVolCoolingCheck) return true;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, _Period, 1, 6, rates);
   if(copied < 5) return true; // Fail open if data missing

   double o1 = rates[0].open;
   double h1 = rates[0].high;
   double l1 = rates[0].low;
   double c1 = rates[0].close;
   double range1 = h1 - l1;
   if(range1 <= 0.0) return true;

   if(posType == POSITION_TYPE_BUY)
   {
      // 1. Extreme Falling Knife Blocker: Solid bearish candle with tiny lower wick
      double lowerWick = MathMin(o1, c1) - l1;
      double body      = MathAbs(c1 - o1);
      if(c1 < o1 && (body / range1) > 0.75 && (lowerWick / range1) < 0.20)
      {
         return false; // Active falling knife! Wait for exhaustion
      }

      // 2. Factor A: Consecutive Low Failure (M1 has stopped dropping lower)
      bool hasStoppedNewLow = false;
      if(InpConsecutiveLowBars > 0)
      {
         if(rates[0].low >= rates[1].low)
         {
            if(InpConsecutiveLowBars >= 2)
            {
               if(rates[0].low >= rates[1].low && (rates[1].low >= rates[2].low || rates[0].close > rates[1].high))
                  hasStoppedNewLow = true;
               else if(rates[0].low >= rates[1].low)
                  hasStoppedNewLow = true;
            }
            else
            {
               hasStoppedNewLow = true;
            }
         }
      }

      // 3. Factor B: Buyer Absorption Lower Wick Rejection
      bool hasRejectionWick = false;
      if(InpRejectionWickMinPct > 0.0)
      {
         double wickPct = (lowerWick / range1) * 100.0;
         if(wickPct >= InpRejectionWickMinPct)
            hasRejectionWick = true;
      }

      // 4. Factor C: Candle Range Contraction (Drop in volatility / consolidation)
      bool hasContraction = false;
      if(InpContractionRatioPct > 0.0)
      {
         double prevAvgRange = ((rates[1].high - rates[1].low) +
                                (rates[2].high - rates[2].low) +
                                (rates[3].high - rates[3].low)) / 3.0;
         if(prevAvgRange > 0.0 && range1 <= (prevAvgRange * (InpContractionRatioPct / 100.0)))
            hasContraction = true;
      }

      // 5. Factor D: Bullish Reversal Close
      bool isBullishReversal = (c1 > o1 && (c1 > rates[1].close || c1 > (rates[1].open + rates[1].close) / 2.0));

      // 6. Factor E: Optional Fast EMA Reclaim
      if(InpRequireFastEmaReclaim && InpFastEmaPeriod > 0)
      {
         double sum = 0.0;
         for(int i = 0; i < InpFastEmaPeriod; i++) sum += rates[i].close;
         double sma = sum / InpFastEmaPeriod;
         if(c1 < sma) return false;
      }

      return (hasStoppedNewLow || hasRejectionWick || hasContraction || isBullishReversal);
   }
   else // SELL
   {
      double upperWick = h1 - MathMax(o1, c1);
      double body      = MathAbs(c1 - o1);
      if(c1 > o1 && (body / range1) > 0.75 && (upperWick / range1) < 0.20)
         return false; // Active rocket spike!

      bool hasStoppedNewHigh = (rates[0].high <= rates[1].high);
      bool hasRejectionWick  = ((upperWick / range1) * 100.0 >= InpRejectionWickMinPct);
      double prevAvgRange    = ((rates[1].high - rates[1].low) + (rates[2].high - rates[2].low) + (rates[3].high - rates[3].low)) / 3.0;
      bool hasContraction    = (prevAvgRange > 0.0 && range1 <= (prevAvgRange * (InpContractionRatioPct / 100.0)));
      bool isBearishReversal = (c1 < o1 && c1 < rates[1].close);

      return (hasStoppedNewHigh || hasRejectionWick || hasContraction || isBearishReversal);
   }
}

//+------------------------------------------------------------------+
//| Check Current Bar Cooldown                                       |
//+------------------------------------------------------------------+
bool IsBarCooldownActive()
{
   if(InpBarCooldownPeriod <= 0) return false;
   datetime currentBarTime = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   if(g_lastOrderBarTime == currentBarTime) return true;
   return false;
}

void RegisterOrderBar()
{
   g_lastOrderBarTime = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
}

//+------------------------------------------------------------------+
//| Open Market Order with Dynamic Filling Mode Fallback             |
//+------------------------------------------------------------------+
ulong OpenOrder(ENUM_POSITION_TYPE type, double lot, ulong magic, string comment)
{
   AutoDetectFillingMode();
   trade.SetExpertMagicNumber(magic);
   
   MqlTick lastTick;
   if(!SymbolInfoTick(_Symbol, lastTick))
   {
      PrintFormat("[%s] OrderOpen FAILED: Cannot get tick for %s", EA_SYSTEM_CODE, _Symbol);
      return 0;
   }

   double price = (type == POSITION_TYPE_BUY) ? lastTick.ask : lastTick.bid;
   double minLot   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(minLot <= 0) minLot = 0.01;
   if(maxLot <= 0) maxLot = 100.0;
   if(lotStep <= 0) lotStep = 0.01;

   lot = MathMax(minLot, MathMin(maxLot, lot));
   lot = MathFloor(lot / lotStep + 0.00001) * lotStep;

   bool res = false;
   if(type == POSITION_TYPE_BUY)
      res = trade.Buy(lot, _Symbol, price, 0, 0, comment);
   else
      res = trade.Sell(lot, _Symbol, price, 0, 0, comment);

   // Fallback retry with alternative filling modes
   if(!res && (trade.ResultRetcode() == TRADE_RETCODE_INVALID_FILL || trade.ResultRetcode() == 10030))
   {
      trade.SetTypeFilling(ORDER_FILLING_IOC);
      res = (type == POSITION_TYPE_BUY) ? trade.Buy(lot, _Symbol, price, 0, 0, comment)
                                        : trade.Sell(lot, _Symbol, price, 0, 0, comment);
      if(!res && (trade.ResultRetcode() == TRADE_RETCODE_INVALID_FILL || trade.ResultRetcode() == 10030))
      {
         trade.SetTypeFilling(ORDER_FILLING_RETURN);
         res = (type == POSITION_TYPE_BUY) ? trade.Buy(lot, _Symbol, price, 0, 0, comment)
                                           : trade.Sell(lot, _Symbol, price, 0, 0, comment);
      }
   }

   if(res)
   {
      RegisterOrderBar();
      ulong ticket = trade.ResultOrder();
      g_statusMessage = StringFormat("ORDER OK: %s %.2f lot @ %.2f", EnumToString(type), lot, price);
      PrintFormat("[%s] ✅ Opened %s %.2f lot @ %.2f (Ticket: #%I64u | Magic: %I64u | %s)",
                  EA_SYSTEM_CODE, EnumToString(type), lot, price, ticket, magic, comment);
      return ticket;
   }
   else
   {
      g_statusMessage = StringFormat("ORDER FAILED: %s (Err %d)", trade.ResultRetcodeDescription(), trade.ResultRetcode());
      PrintFormat("[%s] ❌ OrderOpen FAILED: %s (Retcode: %d | Err: %d)",
                  EA_SYSTEM_CODE, trade.ResultRetcodeDescription(), trade.ResultRetcode(), GetLastError());
      return 0;
   }
}

//+------------------------------------------------------------------+
//| Close Position Completely                                        |
//+------------------------------------------------------------------+
bool ClosePosition(ulong ticket)
{
   if(trade.PositionClose(ticket))
   {
      PrintFormat("[%s] Closed ticket #%I64u", EA_SYSTEM_CODE, ticket);
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Close Entire Portfolio (100% Clean Sweep)                        |
//+------------------------------------------------------------------+
void CloseAllPortfolio()
{
   PrintFormat("[%s] 🎯 Executing Total Portfolio Clean Sweep!", EA_SYSTEM_CODE);
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Symbol() != _Symbol) continue;
      if(!IsOurMagic(posInfo.Magic())) continue;
      
      trade.PositionClose(ticket);
   }
   
   g_currentAnchorTicket = 0;
   g_anchorPrice         = 0.0;
   g_tier1LastOrderPrice = 0.0;
   g_tier2LastOrderPrice = 0.0;
   g_tier3LastOrderPrice = 0.0;
   g_isHedgeLocked       = false;
   g_statusMessage       = "CLEAN SWEEP COMPLETED";
}

//+------------------------------------------------------------------+
//| Close Specific Group of Orders by Magic (Excluding Active Anchor)|
//+------------------------------------------------------------------+
void CloseByMagicExceptAnchor(ulong magic)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Symbol() != _Symbol) continue;
      if(ticket == g_currentAnchorTicket) continue;
      
      if(posInfo.Magic() == magic)
         trade.PositionClose(ticket);
   }
}

//+------------------------------------------------------------------+
//| Close Tier 2 Regular Orders (Including absorbed former anchors)  |
//+------------------------------------------------------------------+
void CloseTier2OrdersExceptAnchor()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Symbol() != _Symbol) continue;
      if(ticket == g_currentAnchorTicket) continue;
      
      ulong magic = posInfo.Magic();
      if(magic == g_magicT2 || magic == g_magicAnchor)
      {
         trade.PositionClose(ticket);
      }
   }
}

//+------------------------------------------------------------------+
//| Close Tier 1 AND Active Anchor Together                          |
//+------------------------------------------------------------------+
void CloseTier1AndAnchor()
{
   PrintFormat("[%s] 🎯 Closing Tier 1 + Active Anchor #%I64u!", EA_SYSTEM_CODE, g_currentAnchorTicket);
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Symbol() != _Symbol) continue;
      
      if(posInfo.Magic() == g_magicT1 || ticket == g_currentAnchorTicket)
      {
         trade.PositionClose(ticket);
      }
   }
   
   g_currentAnchorTicket = 0;
   g_anchorPrice         = 0.0;
}

//+------------------------------------------------------------------+
//| Re-tag Remaining Tier Orders to become New Tier 1 (Promotion)    |
//+------------------------------------------------------------------+
void PromoteRemainingOrdersToNewTier1()
{
   PrintFormat("[%s] 🔄 Promoting remaining regular orders into NEW Tier 1...", EA_SYSTEM_CODE);
   g_tier1LastOrderPrice = g_tier2LastOrderPrice;
   g_tier2LastOrderPrice = 0.0;
   g_tier3LastOrderPrice = 0.0;
   g_statusMessage = "TIER PROMOTION ACTIVE";
}

//+------------------------------------------------------------------+
//| Toxic Trim: Partial Close Oldest Toxic Position                  |
//+------------------------------------------------------------------+
bool TrimWorstTicketPartial(ulong worstTicket, double availableBudget)
{
   if(availableBudget <= 0.0 || worstTicket <= 0) return false;
   if(!posInfo.SelectByTicket(worstTicket)) return false;

   double openVol  = posInfo.Volume();
   double totalLoss= MathAbs(posInfo.Profit() + posInfo.Swap());
   if(totalLoss <= 0.0 || openVol <= 0.0) return false;

   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(lotStep <= 0.0) lotStep = 0.01;
   
   double lossPerMinLot = (totalLoss / openVol) * lotStep;
   if(lossPerMinLot <= 0.0) return false;

   int stepsCanTrim = (int)MathFloor(availableBudget / lossPerMinLot);
   double trimVolume = stepsCanTrim * lotStep;

   if(trimVolume >= openVol)
   {
      if(trade.PositionClose(worstTicket))
      {
         PrintFormat("[%s] ✂️ Toxic Trim [FULL CLOSE]: Closed ticket #%I64u (Loss: %.2f covered by budget %.2f)",
                     EA_SYSTEM_CODE, worstTicket, totalLoss, availableBudget);
         return true;
      }
   }
   else if(trimVolume >= lotStep)
   {
      if(trade.PositionClosePartial(worstTicket, trimVolume))
      {
         PrintFormat("[%s] ✂️ Toxic Trim [PARTIAL CLOSE]: Trimmed %.2f lot from ticket #%I64u (Remaining: %.2f lot)",
                     EA_SYSTEM_CODE, trimVolume, worstTicket, openVol - trimVolume);
         return true;
      }
   }

   return false;
}

//+------------------------------------------------------------------+
//| Check Hierarchical Exit Matrix (Any order count >= 1 can scalp)  |
//+------------------------------------------------------------------+
void CheckHierarchicalExits(BasketSnapshot &snap)
{
   // 1. Total Portfolio Clean Sweep
   if(snap.totalProfit >= InpBasketTargetMoney)
   {
      CloseAllPortfolio();
      return;
   }

   // 2. Primary Basket (Tier 1) + Single Anchor Sweep
   double t1WithAnchorProfit = snap.t1Profit + snap.anchorProfit;
   if(snap.t1Count > 0 && snap.anchorTicket > 0 && t1WithAnchorProfit >= InpBasketTargetMoney)
   {
      PrintFormat("[%s] ⚓ Primary Basket + Single Anchor Target Reached (+%.2f $)! Closing T1 & Anchor #%I64u.",
                  EA_SYSTEM_CODE, t1WithAnchorProfit, snap.anchorTicket);
      CloseTier1AndAnchor();
      PromoteRemainingOrdersToNewTier1();
      return;
   }

   // 3. Tier 1 Standalone Exit (If no anchor yet and T1 reached target)
   if(snap.t1Count > 0 && snap.anchorTicket == 0 && snap.t1Profit >= InpBasketTargetMoney)
   {
      PrintFormat("[%s] 🟢 Tier 1 Basket Take Profit (+%.2f $)! Closing T1.", EA_SYSTEM_CODE, snap.t1Profit);
      CloseByMagicExceptAnchor(g_magicT1);
      return;
   }

   // 4. Independent Tier 2 Scalp Exit (Triggers for ANY order count >= 1 if target reached)
   if(snap.t2Count > 0 && snap.t2Profit >= InpTierScalpTargetMoney)
   {
      PrintFormat("[%s] 🟡 Tier 2 Scalp Take Profit (+%.2f $ with %d orders)! Closing T2, keeping Anchor #%I64u intact.",
                  EA_SYSTEM_CODE, snap.t2Profit, snap.t2Count, snap.anchorTicket);
      CloseTier2OrdersExceptAnchor();

      if(InpResetGapOnScalpExit)
      {
         g_tier2LastOrderPrice = 0.0;
         PrintFormat("[%s] 🔄 Reset Gap Reference Price Tier 2 for fresh cycle.", EA_SYSTEM_CODE);
      }
      return;
   }

   // 5. Independent Tier 3 Scalp Exit & Toxic Trim (Triggers for ANY order count >= 1 if target reached)
   if(snap.t3Count > 0 && snap.t3Profit >= InpTierScalpTargetMoney)
   {
      PrintFormat("[%s] 🔴 Tier 3 Scalp Take Profit (+%.2f $ with %d orders)! Closing T3, keeping Anchor #%I64u intact.",
                  EA_SYSTEM_CODE, snap.t3Profit, snap.t3Count, snap.anchorTicket);
      
      double realizedT3 = snap.t3Profit;
      CloseByMagicExceptAnchor(g_magicT3);

      if(InpResetGapOnScalpExit)
      {
         g_tier3LastOrderPrice = 0.0;
         PrintFormat("[%s] 🔄 Reset Gap Reference Price Tier 3 for fresh cycle.", EA_SYSTEM_CODE);
      }

      if(InpEnableToxicTrim && snap.worstTicket > 0)
      {
         double trimBudget = realizedT3 * (InpTrimProfitSharePct / 100.0);
         TrimWorstTicketPartial(snap.worstTicket, trimBudget);
      }
      return;
   }
}

//+------------------------------------------------------------------+
//| Check Grid & Dynamic Lowest Anchor Deployment                    |
//+------------------------------------------------------------------+
void CheckGridAndAnchorDeployment(BasketSnapshot &snap)
{
   if(IsBarCooldownActive()) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   // ================================================================
   // TIER 1 DEPLOYMENT
   // ================================================================
   if(snap.t1Count < InpTier1Orders)
   {
      if(snap.t1LowestBuy > 0.0 && (snap.t1LowestBuy - ask) >= InpGridDistancePoints * _Point)
      {
         if(IsVolatilityCoolingConfirmed(POSITION_TYPE_BUY))
         {
            int slotIdx = snap.t1Count;
            ulong ticket = OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT1, StringFormat("%s:T1:#%d", InpTradeCommentPrefix, snap.t1Count + 1));
            if(ticket > 0)
            {
               if(snap.t1Count + 1 == InpTier1Orders)
               {
                  g_tier1LastOrderPrice = ask;
                  PrintFormat("[%s] 🛑 Tier 1 Complete (%d/%d). Last Order Price=%.2f. Awaiting Gap 1->2 (%d pts).",
                              EA_SYSTEM_CODE, InpTier1Orders, InpTier1Orders, g_tier1LastOrderPrice, InpGapT1ToT2Points);
               }
               return;
            }
         }
      }
   }

   // ================================================================
   // TIER 2 DEPLOYMENT (Requires distance >= InpGapT1ToT2Points + Volatility Cooling)
   // ================================================================
   double t1RefPrice = (g_tier1LastOrderPrice > 0.0) ? g_tier1LastOrderPrice : snap.t1LowestBuy;
   bool isT2Eligible = (snap.t1Count >= InpTier1Orders && t1RefPrice > 0.0 && (t1RefPrice - ask) >= InpGapT1ToT2Points * _Point);
   
   if(isT2Eligible)
   {
      // 1. Regular Tier 2 Grid Orders (1 to InpTier2Orders)
      if(snap.t2Count < InpTier2Orders)
      {
         bool priceConditionMet = false;

         if(snap.t2Count == 0)
         {
            if((t1RefPrice - ask) >= InpGapT1ToT2Points * _Point)
               priceConditionMet = true;
         }
         else
         {
            if(snap.t2LowestBuy > 0.0 && (snap.t2LowestBuy - ask) >= InpGridDistancePoints * _Point)
               priceConditionMet = true;
         }

         // Must meet price gap AND confirm that volatility has cooled down
         if(priceConditionMet && IsVolatilityCoolingConfirmed(POSITION_TYPE_BUY))
         {
            int slotIdx = InpTier1Orders + snap.t2Count;
            ulong ticket = OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT2, StringFormat("%s:T2:#%d", InpTradeCommentPrefix, snap.t2Count + 1));
            if(ticket > 0)
            {
               // If this new order is opened lower than current anchor, it becomes the new Anchor!
               if(ask < g_anchorPrice || g_currentAnchorTicket == 0)
               {
                  g_currentAnchorTicket = ticket;
                  g_anchorPrice         = ask;
                  PrintFormat("[%s] ⚓ DYNAMIC ANCHOR SWAP: Ticket #%I64u @ %.2f is now the new lowest Anchor!",
                              EA_SYSTEM_CODE, ticket, ask);
               }

               if(snap.t2Count + 1 == InpTier2Orders)
               {
                  g_tier2LastOrderPrice = ask;
                  PrintFormat("[%s] 🛑 Tier 2 Order #%d opened @ %.2f. Awaiting Anchor or Gap 2->3 (%d pts).",
                              EA_SYSTEM_CODE, InpTier2Orders, g_tier2LastOrderPrice, InpGapT2ToT3Points);
               }
               return;
            }
         }
      }
      // 2. Anchor Deployment for Tier 2 (Order after regular orders are filled)
      else if(snap.t2Count >= InpTier2Orders && snap.anchorTicket == 0)
      {
         if((snap.t2LowestBuy - ask) >= InpGridDistancePoints * _Point)
         {
            if(IsVolatilityCoolingConfirmed(POSITION_TYPE_BUY))
            {
               int lastT2Slot = InpTier1Orders + InpTier2Orders - 1;
               double anchorLot = g_lotSequence[lastT2Slot];

               ulong ticket = OpenOrder(POSITION_TYPE_BUY, anchorLot, g_magicAnchor, InpTradeCommentPrefix + ":Anchor");
               if(ticket > 0)
               {
                  g_currentAnchorTicket = ticket;
                  g_anchorPrice         = ask;
                  PrintFormat("[%s] ⚓ SINGLE ANCHOR DEPLOYED at Slot %d (%.2f lot) @ %.2f! (Ticket #%I64u)",
                              EA_SYSTEM_CODE, lastT2Slot, anchorLot, ask, ticket);
                  return;
               }
            }
         }
      }
   }

   // ================================================================
   // TIER 3 DEPLOYMENT (Requires distance >= InpGapT2ToT3Points + Volatility Cooling)
   // ================================================================
   double t2RefPrice = (g_tier2LastOrderPrice > 0.0) ? g_tier2LastOrderPrice : snap.t2LowestBuy;
   if(g_anchorPrice > 0.0 && g_anchorPrice < t2RefPrice) t2RefPrice = g_anchorPrice;

   bool isT3Eligible = (t2RefPrice > 0.0 && (t2RefPrice - ask) >= InpGapT2ToT3Points * _Point);

   if(isT3Eligible)
   {
      // 1. Regular Tier 3 Grid Orders (1 to InpTier3Orders)
      if(snap.t3Count < InpTier3Orders)
      {
         bool priceConditionMet = false;

         if(snap.t3Count == 0)
         {
            if((t2RefPrice - ask) >= InpGapT2ToT3Points * _Point)
               priceConditionMet = true;
         }
         else
         {
            if(snap.t3LowestBuy > 0.0 && (snap.t3LowestBuy - ask) >= InpGridDistancePoints * _Point)
               priceConditionMet = true;
         }

         if(priceConditionMet && IsVolatilityCoolingConfirmed(POSITION_TYPE_BUY))
         {
            int slotIdx = InpTier1Orders + InpTier2Orders + snap.t3Count;
            ulong ticket = OpenOrder(POSITION_TYPE_BUY, g_lotSequence[MathMin(slotIdx, MAX_LOT_SLOTS - 1)], g_magicT3, StringFormat("%s:T3:#%d", InpTradeCommentPrefix, snap.t3Count + 1));
            if(ticket > 0)
            {
               // In Tier 3, any new lowest order takes over as the Anchor!
               if(ask < g_anchorPrice || g_currentAnchorTicket == 0)
               {
                  g_currentAnchorTicket = ticket;
                  g_anchorPrice         = ask;
                  PrintFormat("[%s] ⚓ DYNAMIC ANCHOR SWAP (T3): Ticket #%I64u @ %.2f is now the new lowest Anchor!",
                              EA_SYSTEM_CODE, ticket, ask);
               }

               if(snap.t3Count + 1 == InpTier3Orders)
               {
                  g_tier3LastOrderPrice = ask;
                  PrintFormat("[%s] 🛑 Tier 3 Order #%d opened @ %.2f.", EA_SYSTEM_CODE, InpTier3Orders, g_tier3LastOrderPrice);
               }
               return;
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check MT5 Algo Trading Permission
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      UpdateDashboard(0.0, 0.0, "⚠️ ALGO TRADING DISABLED! Click 'Algo Trading' in MT5 toolbar.");
      return;
   }

   // Spread filter check
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(InpMaxSpreadPoints > 0 && spread > InpMaxSpreadPoints)
   {
      UpdateDashboard(0.0, 0.0, StringFormat("⚠️ SPREAD HIGH: %d > %d pts (Waiting)", spread, InpMaxSpreadPoints));
      return;
   }

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(balance <= 0.0) return;

   double currentDD_Pct = (balance > equity) ? ((balance - equity) / balance * 100.0) : 0.0;

   // Take snapshot of positions
   BasketSnapshot snap;
   ScanPositions(snap);

   // Update HUD Dashboard
   UpdateDashboard(currentDD_Pct, snap.totalProfit, g_statusMessage);

   // 1. EMERGENCY CIRCUIT BREAKER (Auto-Hedge Lock)
   if(InpEnableAutoHedge && currentDD_Pct >= InpHedgeTriggerDD_Pct && !g_isHedgeLocked)
   {
      PrintFormat("[%s] 🚨 EMERGENCY HEDGE TRIGGERED at DD=%.2f%% (>= %.2f%%)! Locking Delta=0!",
                  EA_SYSTEM_CODE, currentDD_Pct, InpHedgeTriggerDD_Pct);
      if(snap.totalVolume > 0.0)
      {
         OpenOrder(POSITION_TYPE_SELL, snap.totalVolume, g_magicHedge, InpTradeCommentPrefix + ":HedgeLock");
         g_isHedgeLocked = true;
         g_statusMessage = "🚨 AUTO-HEDGE LOCKED";
      }
      return;
   }

   // 2. INITIAL ENTRY (Immediate order execution on clean basket)
   if(snap.totalCount == 0)
   {
      if(InpImmediateEntry)
      {
         ENUM_POSITION_TYPE initType = (InpInitialSide == SIDE_SELL) ? POSITION_TYPE_SELL : POSITION_TYPE_BUY;
         double lot = (g_lotSequence[0] > 0.0) ? g_lotSequence[0] : InpStartLot;
         
         PrintFormat("[%s] 🚀 Clean portfolio detected. Sending immediate initial order...", EA_SYSTEM_CODE);
         if(OpenOrder(initType, lot, g_magicT1, InpTradeCommentPrefix + ":T1:#1") > 0)
         {
            g_statusMessage = "INITIAL ORDER OPENED #1";
         }
      }
      return;
   }

   // 3. HIERARCHICAL EXITS & SCALP DECISION MATRIX
   CheckHierarchicalExits(snap);

   // Re-scan after potential closures
   ScanPositions(snap);
   if(snap.totalCount == 0) return;

   // 4. CASCADING RECOVERY GRID & DYNAMIC ANCHOR DEPLOYMENT
   CheckGridAndAnchorDeployment(snap);
}

//+------------------------------------------------------------------+
//| Helper to count positions by magic                               |
//+------------------------------------------------------------------+
int GetMagicCount(ulong magic)
{
   int c = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(!posInfo.SelectByTicket(t)) continue;
      if(posInfo.Symbol() != _Symbol) continue;
      if(posInfo.Magic() == magic) c++;
   }
   return c;
}

//+------------------------------------------------------------------+
//| On-Chart HUD Dashboard with Real-time Diagnostics                |
//+------------------------------------------------------------------+
void UpdateDashboard(double ddPct, double totalProfit, string customStatus = "")
{
   string status = (customStatus != "") ? customStatus : g_statusMessage;

   string anchorStr = "NONE";
   if(g_currentAnchorTicket > 0)
      anchorStr = StringFormat("#%I64u @ %.2f ⚓", g_currentAnchorTicket, g_anchorPrice);

   string text = "\n";
   text += StringFormat(" %s | %s\n", EA_DASH_TITLE, _Symbol);
   text += " ──────────────────────────────────────────\n";
   text += StringFormat(" Status: %s\n", status);
   text += StringFormat(" Balance: $%.2f | Equity: $%.2f\n", AccountInfoDouble(ACCOUNT_BALANCE), AccountInfoDouble(ACCOUNT_EQUITY));
   text += StringFormat(" Drawdown: %.2f%% | Floating PnL: %s$%.2f\n", ddPct, (totalProfit >= 0 ? "+" : ""), totalProfit);
   text += " ──────────────────────────────────────────\n";
   text += StringFormat(" Vol Cooling: %s (LowFail:%d | Wick>=%.0f%% | Contraction<=%.0f%%)\n",
                        (InpUseVolCoolingCheck ? "ACTIVE 🛡️" : "OFF"),
                        InpConsecutiveLowBars, InpRejectionWickMinPct, InpContractionRatioPct);
   text += StringFormat(" Total Positions: %d | Lowest Anchor: %s\n", PositionsTotal(), anchorStr);
   text += StringFormat(" Tier 1 Orders: %d/%d | Last Price: %.2f\n", 
                        GetMagicCount(g_magicT1), InpTier1Orders, g_tier1LastOrderPrice);
   text += StringFormat(" Tier 2 Orders: %d/%d | Gap 1->2: %d pts\n", 
                        GetMagicCount(g_magicT2), InpTier2Orders, InpGapT1ToT2Points);
   text += StringFormat(" Tier 3 Orders: %d/%d | Gap 2->3: %d pts\n", 
                        GetMagicCount(g_magicT3), InpTier3Orders, InpGapT2ToT3Points);
   text += " ──────────────────────────────────────────\n";
   text += StringFormat(" Lot Mode: %s | Next Slot Lot: %.2f\n", EnumToString(InpLotMode), g_lotSequence[MathMin(PositionsTotal(), MAX_LOT_SLOTS - 1)]);
   text += StringFormat(" Auto-Hedge: %s (Ceiling: %.1f%%)\n", (g_isHedgeLocked ? "LOCKED 🚨" : "READY"), InpHedgeTriggerDD_Pct);
   text += " ──────────────────────────────────────────\n";

   Comment(text);
}
//+------------------------------------------------------------------+
