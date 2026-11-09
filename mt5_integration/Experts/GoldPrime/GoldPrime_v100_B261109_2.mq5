//+------------------------------------------------------------------+
//|                                     GoldPrime_v100_B261109_2.mq5 |
//|                                  Copyright 2026, EAeze Solutions |
//|                                       https://www.eaeze.trade    |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, EAeze Solutions"
#property link        "https://www.eaeze.trade"
#property version     "1.00"
#property description "GoldPrime - XAUUSD M1 Cascading Recovery EA with Dual-Anchor Ladder Protocol"

//+------------------------------------------------------------------+
//| VERSION CONTROL & DEVELOPMENT CHANGELOG                          |
//+------------------------------------------------------------------+
/*
 * SYSTEM CODE : GP-XAU-M1
 * BUILD NUMBER: B261109.2
 * RELEASE DATE: 2026.11.09
 *
 * CHANGELOG HISTORY:
 * ------------------------------------------------------------------
 * v1.00 [B261109.1] - Initial Release
 *   - 3-Tier Cascading Recovery Architecture (Tier 1: 3, Tier 2: 3+Anchor, Tier 3: 3+Anchor)
 *   - +4.0% Drawdown expansion pause between tiers
 *   - Pre-computed Lot Pipeline (Fixed, Linear Step, Multiplier, Ladder Step)
 *   - Price Action Exhaustion Filter (Anti-Falling Knife: lower wick >= 35%)
 *   - Toxic Trim (Partial Close of oldest ticket on Tier 3 scalping profit)
 *   - On-Chart HUD Dashboard
 *
 * v1.00 [B261109.2] - Decoupled Tier Lifecycles & Dual-Anchor Engine
 *   - FIX: Decoupled Tier 2 & Tier 3 scalp lifecycles completely from Anchor orders.
 *     Closing regular scalp orders resets the tier state so it can open fresh cycles immediately.
 *   - TIER-SPECIFIC PRICE TRACKING: Each tier tracks its own lowest order price independently
 *     instead of being blocked by deep anchor prices.
 *   - ACCURATE BASE DD CAPTURE: Base DD for expansion (+4%) is captured strictly at OrderOpen
 *     of order #3 (the final regular order of that tier), NOT upon anchor creation.
 *   - AUTOMATIC BASE DD RESET: When a tier closes its regular orders in scalp TP, its Base DD
 *     is reset to 0.0 to prepare for fresh future expansion.
 *   - DUAL ANCHOR PROTOCOL: Each recovery tier (T2 and T3) can now deploy up to 2 Anchors
 *     (Anchor 1.1, Anchor 1.2, Anchor 2.1, Anchor 2.2).
 *   - STRICT ANCHOR 2 SEQUENCING: Anchor #2 CANNOT open directly after Anchor #1. It requires
 *     a full scalp exit of regular orders followed by a fresh 3-order regular cycle first
 *     (Anchor is strictly the 4th order of an active cycle), and must be below Anchor #1
 *     by at least InpMinAnchorStepPoints.
 */

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

#define EA_BUILD_TAG     "B261109.2"
#define EA_SYSTEM_CODE   "GoldPrime"
#define EA_DASH_TITLE    "GoldPrime v1.00 [B261109.2] - Dual Anchor Engine"
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
input int                    InpMaxSpreadPoints       = 50;          // Max Allowed Spread (Points, 0=Disable)

input group "=== INITIAL ENTRY & PRIMARY BASKET (TIER 1) ==="
input bool                   InpImmediateEntry        = true;        // Immediate Entry on Attachment
input ENUM_INITIAL_ENTRY_SIDE InpInitialSide          = SIDE_BUY;    // Initial Order Direction
input int                    InpTier1Orders           = 3;           // Number of Orders in Tier 1 Basket
input int                    InpGridDistancePoints    = 250;         // Grid Spacing Between Orders (Points)
input double                 InpBasketTargetMoney     = 3.0;         // Primary Basket Take Profit ($)

input group "=== CASCADING RECOVERY TIERS (TIER 2 & TIER 3) ==="
input double                 InpTierDeltaDD_Pct       = 4.0;         // Required DD Expansion Between Tiers (%)
input int                    InpTier2Orders           = 3;           // Regular Orders in Tier 2
input int                    InpTier3Orders           = 3;           // Regular Orders in Tier 3
input double                 InpTierScalpTargetMoney  = 1.5;         // Scalp Take Profit for T2 / T3 ($)
input bool                   InpResetBaseDDOnScalpExit= true;        // Reset Base DD on Scalp Exit for Fresh Cycle

input group "=== DUAL ANCHOR ENGINE (MAX 2 ANCHORS PER TIER) ==="
input int                    InpMaxAnchorsPerTier     = 2;           // Max Anchors per Tier (1 or 2)
input int                    InpMinAnchorStepPoints   = 300;         // Min Distance from Previous Anchor for Anchor #2 (Points)

input group "=== TOXIC TRIM ENGINE (PARTIAL CLOSE ON TIER 3) ==="
input bool                   InpEnableToxicTrim       = true;        // Enable Toxic Trim on Oldest Ticket
input double                 InpTrimProfitSharePct    = 50.0;        // % of T3 Profit Allocated to Trim Worst Ticket

input group "=== PRE-COMPUTED LOT PIPELINE ==="
input ENUM_LOT_CALC_MODE     InpLotMode               = LOT_LADDER_STEP; // Lot Calculation Mode
input double                 InpStartLot              = 0.01;        // Starting Lot Size
input double                 InpLotStep               = 0.01;        // Step Addition (Linear & Ladder)
input double                 InpLotMultiplier         = 1.30;        // Multiplier Factor
input int                    InpLadderGroupSize       = 2;           // Ladder Step Group Size (Repeat Count)
input double                 InpHardMaxLot            = 5.00;        // Hard Ceiling Maximum Lot

input group "=== ANTI-FALLING KNIFE & SAFETY CIRCUITS ==="
input bool                   InpUseExhaustionFilter   = true;        // Filter: Require Rejection Wick / Exhaustion
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
   
   // Tier 2
   int    t2Count;
   double t2Volume;
   double t2Profit;
   double t2LowestBuy;
   
   // Tier 3
   int    t3Count;
   double t3Volume;
   double t3Profit;
   double t3LowestBuy;
   
   // Tier 2 Anchors
   int    anchor1_1Count;
   ulong  anchor1_1Ticket;
   double anchor1_1Price;
   double anchor1_1Profit;
   
   int    anchor1_2Count;
   ulong  anchor1_2Ticket;
   double anchor1_2Price;
   double anchor1_2Profit;
   
   // Tier 3 Anchors
   int    anchor2_1Count;
   ulong  anchor2_1Ticket;
   double anchor2_1Price;
   double anchor2_1Profit;
   
   int    anchor2_2Count;
   ulong  anchor2_2Ticket;
   double anchor2_2Price;
   double anchor2_2Profit;

   // Aggregated Anchors
   int    totalAnchorsCount;
   double totalAnchorsProfit;
   
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

// Dedicated Magic Numbers for Hierarchical Separation
ulong g_magicT1        = 0;
ulong g_magicT2        = 0;
ulong g_magicT3        = 0;
ulong g_magicAnchor1_1 = 0; // Tier 2 Anchor #1
ulong g_magicAnchor1_2 = 0; // Tier 2 Anchor #2
ulong g_magicAnchor2_1 = 0; // Tier 3 Anchor #1
ulong g_magicAnchor2_2 = 0; // Tier 3 Anchor #2
ulong g_magicHedge     = 0;

// Pre-computed Lot Pipeline Array
double g_lotSequence[MAX_LOT_SLOTS];

// Recovery & Drawdown State Trackers
double   g_tier1AnchorDD      = 0.0; // Base DD captured when T1 Order #3 opened
double   g_tier2AnchorDD      = 0.0; // Base DD captured when T2 Order #3 opened
double   g_tier3AnchorDD      = 0.0; // Base DD captured when T3 Order #3 opened
datetime g_lastOrderBarTime   = 0;
bool     g_isHedgeLocked      = false;

// Forward Declarations
void UpdateDashboard(double ddPct, double totalProfit);
int  GetMagicCount(ulong magic);

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Initialize Magic Numbers
   g_magicT1        = InpBaseMagicNumber + 1;
   g_magicT2        = InpBaseMagicNumber + 2;
   g_magicT3        = InpBaseMagicNumber + 3;
   g_magicAnchor1_1 = InpBaseMagicNumber + 11;
   g_magicAnchor1_2 = InpBaseMagicNumber + 12;
   g_magicAnchor2_1 = InpBaseMagicNumber + 21;
   g_magicAnchor2_2 = InpBaseMagicNumber + 22;
   g_magicHedge     = InpBaseMagicNumber + 99;

   trade.SetExpertMagicNumber(g_magicT1);
   trade.SetDeviationInPoints(20);
   trade.SetTypeFilling(ORDER_FILLING_FOK);

   // Precalculate Lot Pipeline into static cache
   PrecalculateLotPipeline();

   PrintFormat("[%s] Initialized Successfully! Build: %s | Symbol: %s | Magic Base: %I64u",
               EA_SYSTEM_CODE, EA_BUILD_TAG, _Symbol, InpBaseMagicNumber);

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
//| Precompute Fixed / Linear / Multiplier / Ladder Lot Table        |
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

      // Hard max lot cap
      if(InpHardMaxLot > 0.0)
         calcLot = MathMin(calcLot, InpHardMaxLot);
          
      // Clamp to broker limits
      calcLot = MathMax(minLot, MathMin(maxLot, calcLot));
      
      // Normalize to lot step
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
           magic == g_magicAnchor1_1 || magic == g_magicAnchor1_2 ||
           magic == g_magicAnchor2_1 || magic == g_magicAnchor2_2 ||
           magic == g_magicHedge);
}

//+------------------------------------------------------------------+
//| Scan and snapshot current market basket                          |
//+------------------------------------------------------------------+
void ScanPositions(BasketSnapshot &snap)
{
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

      // Categorize by Magic
      if(magic == g_magicT1)
      {
         snap.t1Count++;
         snap.t1Volume += vol;
         snap.t1Profit += profit;
         if(price < snap.t1LowestBuy) snap.t1LowestBuy = price;
         
         // Track worst toxic position in T1
         if(profit < snap.worstLoss)
         {
            snap.worstLoss   = profit;
            snap.worstTicket = ticket;
            snap.worstVolume = vol;
         }
      }
      else if(magic == g_magicT2)
      {
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
      else if(magic == g_magicAnchor1_1)
      {
         snap.anchor1_1Count++;
         snap.anchor1_1Ticket = ticket;
         snap.anchor1_1Price  = price;
         snap.anchor1_1Profit = profit;
         snap.totalAnchorsCount++;
         snap.totalAnchorsProfit += profit;
      }
      else if(magic == g_magicAnchor1_2)
      {
         snap.anchor1_2Count++;
         snap.anchor1_2Ticket = ticket;
         snap.anchor1_2Price  = price;
         snap.anchor1_2Profit = profit;
         snap.totalAnchorsCount++;
         snap.totalAnchorsProfit += profit;
      }
      else if(magic == g_magicAnchor2_1)
      {
         snap.anchor2_1Count++;
         snap.anchor2_1Ticket = ticket;
         snap.anchor2_1Price  = price;
         snap.anchor2_1Profit = profit;
         snap.totalAnchorsCount++;
         snap.totalAnchorsProfit += profit;
      }
      else if(magic == g_magicAnchor2_2)
      {
         snap.anchor2_2Count++;
         snap.anchor2_2Ticket = ticket;
         snap.anchor2_2Price  = price;
         snap.anchor2_2Profit = profit;
         snap.totalAnchorsCount++;
         snap.totalAnchorsProfit += profit;
      }
   }

   if(snap.lowestBuyPrice >= 999999.0) snap.lowestBuyPrice = 0.0;
   if(snap.t1LowestBuy    >= 999999.0) snap.t1LowestBuy    = 0.0;
   if(snap.t2LowestBuy    >= 999999.0) snap.t2LowestBuy    = 0.0;
   if(snap.t3LowestBuy    >= 999999.0) snap.t3LowestBuy    = 0.0;
}

//+------------------------------------------------------------------+
//| Price Action Exhaustion Confirmation (Anti-Falling Knife)        |
//+------------------------------------------------------------------+
bool IsExhaustionConfirmed(ENUM_POSITION_TYPE posType)
{
   if(!InpUseExhaustionFilter) return true;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, _Period, 1, 4, rates) < 4) return true;

   double o1 = rates[0].open;
   double h1 = rates[0].high;
   double l1 = rates[0].low;
   double c1 = rates[0].close;
   double range1 = h1 - l1;
   if(range1 <= 0.0) return true;

   double upperWick = h1 - MathMax(o1, c1);
   double lowerWick = MathMin(o1, c1) - l1;
   double body      = MathAbs(c1 - o1);

   if(posType == POSITION_TYPE_BUY)
   {
      // Falling knife guard: Giant solid bearish candle with tiny lower wick
      if(c1 < o1 && (body / range1) > 0.75 && (lowerWick / range1) < 0.20)
      {
         return false; // Falling knife! Wait for exhaustion
      }

      bool hasRejection   = (lowerWick / range1) >= 0.35;
      bool isBullishClose = (c1 > o1);
      double prev3Avg     = (rates[1].high - rates[1].low + rates[2].high - rates[2].low + rates[3].high - rates[3].low) / 3.0;
      bool isContraction  = (prev3Avg > 0.0 && range1 <= prev3Avg * 0.50);

      return (hasRejection || isBullishClose || isContraction);
   }
   else // SELL
   {
      if(c1 > o1 && (body / range1) > 0.75 && (upperWick / range1) < 0.20)
      {
         return false; // Rocket spike! Wait for exhaustion
      }

      bool hasRejection   = (upperWick / range1) >= 0.35;
      bool isBearishClose = (c1 < o1);
      double prev3Avg     = (rates[1].high - rates[1].low + rates[2].high - rates[2].low + rates[3].high - rates[3].low) / 3.0;
      bool isContraction  = (prev3Avg > 0.0 && range1 <= prev3Avg * 0.50);

      return (hasRejection || isBearishClose || isContraction);
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
//| Open Market Order with Custom Magic & Comment                    |
//+------------------------------------------------------------------+
bool OpenOrder(ENUM_POSITION_TYPE type, double lot, ulong magic, string comment)
{
   trade.SetExpertMagicNumber(magic);
   
   double price = (type == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   bool res = false;
   
   if(type == POSITION_TYPE_BUY)
      res = trade.Buy(lot, _Symbol, price, 0, 0, comment);
   else
      res = trade.Sell(lot, _Symbol, price, 0, 0, comment);

   if(res)
   {
      RegisterOrderBar();
      PrintFormat("[%s] Opened %s %.2f lot @ %.2f (Magic: %I64u | %s)",
                  EA_SYSTEM_CODE, EnumToString(type), lot, price, magic, comment);
   }
   else
   {
      PrintFormat("[%s] OrderOpen FAILED: %s (Err: %d)", EA_SYSTEM_CODE, trade.ResultRetcodeDescription(), GetLastError());
   }
   return res;
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
   
   // Reset internal states
   g_tier1AnchorDD       = 0.0;
   g_tier2AnchorDD       = 0.0;
   g_tier3AnchorDD       = 0.0;
   g_isHedgeLocked       = false;
}

//+------------------------------------------------------------------+
//| Close Specific Group of Orders by Magic                          |
//+------------------------------------------------------------------+
void CloseByMagic(ulong magic)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Symbol() != _Symbol) continue;
      if(posInfo.Magic() != magic) continue;
      
      trade.PositionClose(ticket);
   }
}

//+------------------------------------------------------------------+
//| Close All Anchor Orders                                          |
//+------------------------------------------------------------------+
void CloseAllAnchors()
{
   CloseByMagic(g_magicAnchor1_1);
   CloseByMagic(g_magicAnchor1_2);
   CloseByMagic(g_magicAnchor2_1);
   CloseByMagic(g_magicAnchor2_2);
}

//+------------------------------------------------------------------+
//| Re-tag Remaining Tier Orders to become New Tier 1 (Promotion)    |
//+------------------------------------------------------------------+
void PromoteRemainingOrdersToNewTier1(double currentDD)
{
   PrintFormat("[%s] 🔄 Promoting remaining regular orders into NEW Tier 1...", EA_SYSTEM_CODE);
   g_tier1AnchorDD = currentDD;
   g_tier2AnchorDD = 0.0;
   g_tier3AnchorDD = 0.0;
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
//| Check Hierarchical Exit Matrix                                   |
//+------------------------------------------------------------------+
void CheckHierarchicalExits(BasketSnapshot &snap, double currentDD)
{
   // 1. Total Portfolio Clean Sweep
   if(snap.totalProfit >= InpBasketTargetMoney)
   {
      CloseAllPortfolio();
      return;
   }

   // 2. Primary Basket (Tier 1) + All Anchors Sweep
   double t1WithAnchorsProfit = snap.t1Profit + snap.totalAnchorsProfit;
   if(snap.t1Count > 0 && snap.totalAnchorsCount > 0 && t1WithAnchorsProfit >= InpBasketTargetMoney)
   {
      PrintFormat("[%s] ⚓ Primary Basket + Anchors Target Reached (+%.2f $)! Closing T1 & All Anchors.",
                  EA_SYSTEM_CODE, t1WithAnchorsProfit);
      CloseByMagic(g_magicT1);
      CloseAllAnchors();
      
      // If there are still regular T2/T3 orders, promote them to new Tier 1
      PromoteRemainingOrdersToNewTier1(currentDD);
      return;
   }

   // 3. Independent Tier 2 Scalp Exit
   if(snap.t2Count >= InpTier2Orders && snap.t2Profit >= InpTierScalpTargetMoney)
   {
      PrintFormat("[%s] 🟡 Tier 2 Scalp Take Profit (+%.2f $)! Closing T2 regular orders, preserving Anchors.",
                  EA_SYSTEM_CODE, snap.t2Profit);
      CloseByMagic(g_magicT2);

      if(InpResetBaseDDOnScalpExit)
      {
         g_tier2AnchorDD = 0.0;
         PrintFormat("[%s] 🔄 Reset Base DD Tier 2 to 0.0 for fresh cycle.", EA_SYSTEM_CODE);
      }
      return;
   }

   // 4. Independent Tier 3 Scalp Exit & Toxic Trim
   if(snap.t3Count >= InpTier3Orders && snap.t3Profit >= InpTierScalpTargetMoney)
   {
      PrintFormat("[%s] 🔴 Tier 3 Scalp Take Profit (+%.2f $)! Closing T3 regular orders.",
                  EA_SYSTEM_CODE, snap.t3Profit);
      
      double realizedT3 = snap.t3Profit;
      CloseByMagic(g_magicT3);

      if(InpResetBaseDDOnScalpExit)
      {
         g_tier3AnchorDD = 0.0;
         PrintFormat("[%s] 🔄 Reset Base DD Tier 3 to 0.0 for fresh cycle.", EA_SYSTEM_CODE);
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
//| Check Grid & Anchor Orders Deployment                            |
//+------------------------------------------------------------------+
void CheckGridAndAnchorDeployment(BasketSnapshot &snap, double currentDD)
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
         if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
         {
            int slotIdx = snap.t1Count;
            if(OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT1, StringFormat("%s:T1:#%d", InpTradeCommentPrefix, snap.t1Count + 1)))
            {
               // Capture Base DD strictly at OrderOpen of Order #3
               if(snap.t1Count + 1 == InpTier1Orders)
               {
                  g_tier1AnchorDD = MathMax(currentDD, 0.1);
                  PrintFormat("[%s] 🛑 Tier 1 Complete (3/3). Base DD recorded at %.2f%%. Awaiting +%.1f%% expansion.",
                              EA_SYSTEM_CODE, g_tier1AnchorDD, InpTierDeltaDD_Pct);
               }
               return;
            }
         }
      }
   }

   // ================================================================
   // TIER 2 DEPLOYMENT (Requires DD >= Tier 1 Base DD + InpTierDeltaDD_Pct)
   // ================================================================
   bool isT2Eligible = (snap.t1Count >= InpTier1Orders && g_tier1AnchorDD > 0.0 && currentDD >= (g_tier1AnchorDD + InpTierDeltaDD_Pct));
   
   if(isT2Eligible)
   {
      // 1. Regular Tier 2 Grid Orders (1 to 3)
      if(snap.t2Count < InpTier2Orders)
      {
         bool priceConditionMet = false;

         if(snap.t2Count == 0)
         {
            // Fresh cycle / Round 1 or subsequent round:
            // Round 1: ensure spacing below T1 lowest buy
            // Subsequent rounds: open when exhaustion signals after scalp exit
            if(snap.t1LowestBuy > 0.0 && (snap.t1LowestBuy - ask) >= InpGridDistancePoints * _Point)
               priceConditionMet = true;
            else if(snap.t1Count >= InpTier1Orders)
               priceConditionMet = true; // Round 2+ scalp re-entry
         }
         else
         {
            // Orders 2 & 3: must be below Tier 2's own lowest price in this cycle
            if(snap.t2LowestBuy > 0.0 && (snap.t2LowestBuy - ask) >= InpGridDistancePoints * _Point)
               priceConditionMet = true;
         }

         if(priceConditionMet && IsExhaustionConfirmed(POSITION_TYPE_BUY))
         {
            int slotIdx = InpTier1Orders + snap.t2Count; // Slots 3, 4, 5
            if(OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT2, StringFormat("%s:T2:#%d", InpTradeCommentPrefix, snap.t2Count + 1)))
            {
               // Capture Base DD strictly at OrderOpen of Order #3
               if(snap.t2Count + 1 == InpTier2Orders)
               {
                  g_tier2AnchorDD = currentDD;
                  PrintFormat("[%s] 🛑 Tier 2 Order #%d opened. Base DD recorded at %.2f%%. Awaiting Tier 3 trigger at DD=%.2f%%",
                              EA_SYSTEM_CODE, InpTier2Orders, g_tier2AnchorDD, g_tier2AnchorDD + InpTierDeltaDD_Pct);
               }
               return;
            }
         }
      }
      // 2. Anchor Deployment for Tier 2 (Order #4 of the current cycle)
      else if(snap.t2Count >= InpTier2Orders && InpMaxAnchorsPerTier >= 1)
      {
         // Case A: Anchor 1.1 Deployment (First Anchor of Tier 2)
         if(snap.anchor1_1Count == 0)
         {
            if((snap.t2LowestBuy - ask) >= InpGridDistancePoints * _Point)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + InpTier2Orders; // Slot 6
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicAnchor1_1, InpTradeCommentPrefix + ":Anchor-1.1");
                  PrintFormat("[%s] ⚓ ANCHOR 1.1 DEPLOYED at Slot %d (%.2f lot) @ %.2f",
                              EA_SYSTEM_CODE, slotIdx, g_lotSequence[slotIdx], ask);
                  return;
               }
            }
         }
         // Case B: Anchor 1.2 Deployment (Second Anchor of Tier 2)
         // STRICT REQUIREMENT: Anchor 1.1 already exists, regular orders have recycled to 3 again,
         // and price must be BELOW Anchor 1.1 by at least InpMinAnchorStepPoints!
         else if(snap.anchor1_1Count > 0 && snap.anchor1_2Count == 0 && InpMaxAnchorsPerTier >= 2)
         {
            bool isLowerThanAnchor1 = (snap.anchor1_1Price > 0.0 && ask <= (snap.anchor1_1Price - InpMinAnchorStepPoints * _Point));
            bool isLowerThanT2Grid  = (snap.t2LowestBuy > 0.0 && (snap.t2LowestBuy - ask) >= InpGridDistancePoints * _Point);

            if(isLowerThanAnchor1 && isLowerThanT2Grid)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + InpTier2Orders + 1; // Slot 7
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicAnchor1_2, InpTradeCommentPrefix + ":Anchor-1.2");
                  PrintFormat("[%s] ⚓ ANCHOR 1.2 DEPLOYED at Slot %d (%.2f lot) @ %.2f (Dist from A1.1: %.1f pts)",
                              EA_SYSTEM_CODE, slotIdx, g_lotSequence[slotIdx], ask, (snap.anchor1_1Price - ask) / _Point);
                  return;
               }
            }
         }
      }
   }

   // ================================================================
   // TIER 3 DEPLOYMENT (Requires DD >= Tier 2 Base DD + InpTierDeltaDD_Pct)
   // ================================================================
   bool isT3Eligible = (g_tier2AnchorDD > 0.0 && currentDD >= (g_tier2AnchorDD + InpTierDeltaDD_Pct));

   if(isT3Eligible)
   {
      // 1. Regular Tier 3 Grid Orders (1 to 3)
      if(snap.t3Count < InpTier3Orders)
      {
         bool priceConditionMet = false;

         if(snap.t3Count == 0)
         {
            if(snap.t2LowestBuy > 0.0 && (snap.t2LowestBuy - ask) >= InpGridDistancePoints * _Point)
               priceConditionMet = true;
            else if(snap.t2Count >= InpTier2Orders)
               priceConditionMet = true; // Round 2+ scalp re-entry
         }
         else
         {
            if(snap.t3LowestBuy > 0.0 && (snap.t3LowestBuy - ask) >= InpGridDistancePoints * _Point)
               priceConditionMet = true;
         }

         if(priceConditionMet && IsExhaustionConfirmed(POSITION_TYPE_BUY))
         {
            int slotIdx = InpTier1Orders + InpTier2Orders + InpMaxAnchorsPerTier + snap.t3Count; // Slots 8, 9, 10
            if(OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT3, StringFormat("%s:T3:#%d", InpTradeCommentPrefix, snap.t3Count + 1)))
            {
               // Capture Base DD strictly at OrderOpen of Order #3
               if(snap.t3Count + 1 == InpTier3Orders)
               {
                  g_tier3AnchorDD = currentDD;
                  PrintFormat("[%s] 🛑 Tier 3 Order #%d opened. Base DD recorded at %.2f%%.",
                              EA_SYSTEM_CODE, InpTier3Orders, g_tier3AnchorDD);
               }
               return;
            }
         }
      }
      // 2. Anchor Deployment for Tier 3 (Order #4 of the current cycle)
      else if(snap.t3Count >= InpTier3Orders && InpMaxAnchorsPerTier >= 1)
      {
         // Case A: Anchor 2.1 Deployment (First Anchor of Tier 3)
         if(snap.anchor2_1Count == 0)
         {
            if((snap.t3LowestBuy - ask) >= InpGridDistancePoints * _Point)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + InpTier2Orders + InpMaxAnchorsPerTier + InpTier3Orders;
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicAnchor2_1, InpTradeCommentPrefix + ":Anchor-2.1");
                  PrintFormat("[%s] ⚓ ANCHOR 2.1 DEPLOYED at Slot %d (%.2f lot) @ %.2f",
                              EA_SYSTEM_CODE, slotIdx, g_lotSequence[slotIdx], ask);
                  return;
               }
            }
         }
         // Case B: Anchor 2.2 Deployment (Second Anchor of Tier 3)
         else if(snap.anchor2_1Count > 0 && snap.anchor2_2Count == 0 && InpMaxAnchorsPerTier >= 2)
         {
            bool isLowerThanAnchor1 = (snap.anchor2_1Price > 0.0 && ask <= (snap.anchor2_1Price - InpMinAnchorStepPoints * _Point));
            bool isLowerThanT3Grid  = (snap.t3LowestBuy > 0.0 && (snap.t3LowestBuy - ask) >= InpGridDistancePoints * _Point);

            if(isLowerThanAnchor1 && isLowerThanT3Grid)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + InpTier2Orders + InpMaxAnchorsPerTier + InpTier3Orders + 1;
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicAnchor2_2, InpTradeCommentPrefix + ":Anchor-2.2");
                  PrintFormat("[%s] ⚓ ANCHOR 2.2 DEPLOYED at Slot %d (%.2f lot) @ %.2f (Dist from A2.1: %.1f pts)",
                              EA_SYSTEM_CODE, slotIdx, g_lotSequence[slotIdx], ask, (snap.anchor2_1Price - ask) / _Point);
                  return;
               }
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
   // Spread filter check
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(InpMaxSpreadPoints > 0 && spread > InpMaxSpreadPoints)
   {
      UpdateDashboard(0.0, 0.0);
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
   UpdateDashboard(currentDD_Pct, snap.totalProfit);

   // 1. EMERGENCY CIRCUIT BREAKER (Auto-Hedge Lock)
   if(InpEnableAutoHedge && currentDD_Pct >= InpHedgeTriggerDD_Pct && !g_isHedgeLocked)
   {
      PrintFormat("[%s] 🚨 EMERGENCY HEDGE TRIGGERED at DD=%.2f%% (>= %.2f%%)! Locking Delta=0!",
                  EA_SYSTEM_CODE, currentDD_Pct, InpHedgeTriggerDD_Pct);
      if(snap.totalVolume > 0.0)
      {
         OpenOrder(POSITION_TYPE_SELL, snap.totalVolume, g_magicHedge, InpTradeCommentPrefix + ":HedgeLock");
         g_isHedgeLocked = true;
      }
      return;
   }

   // 2. INITIAL ENTRY (If portfolio is completely clean 0 positions)
   if(snap.totalCount == 0)
   {
      if(InpImmediateEntry)
      {
         ENUM_POSITION_TYPE initType = (InpInitialSide == SIDE_SELL) ? POSITION_TYPE_SELL : POSITION_TYPE_BUY;
         OpenOrder(initType, g_lotSequence[0], g_magicT1, InpTradeCommentPrefix + ":T1:#1");
      }
      return;
   }

   // 3. HIERARCHICAL EXITS & SCALP DECISION MATRIX
   CheckHierarchicalExits(snap, currentDD_Pct);

   // Re-scan after potential closures
   ScanPositions(snap);
   if(snap.totalCount == 0) return;

   // 4. CASCADING RECOVERY GRID & DUAL ANCHORS DEPLOYMENT
   CheckGridAndAnchorDeployment(snap, currentDD_Pct);
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
//| On-Chart HUD Dashboard                                           |
//+------------------------------------------------------------------+
void UpdateDashboard(double ddPct, double totalProfit)
{
   string text = "\n";
   text += StringFormat(" %s | %s\n", EA_DASH_TITLE, _Symbol);
   text += " ──────────────────────────────────────────\n";
   text += StringFormat(" Balance: $%.2f | Equity: $%.2f\n", AccountInfoDouble(ACCOUNT_BALANCE), AccountInfoDouble(ACCOUNT_EQUITY));
   text += StringFormat(" Drawdown: %.2f%% | Floating PnL: %s$%.2f\n", ddPct, (totalProfit >= 0 ? "+" : ""), totalProfit);
   text += " ──────────────────────────────────────────\n";
   text += StringFormat(" Total Positions: %d | Total Anchors: %d (PnL: $%.2f)\n", 
                        PositionsTotal(), 
                        (GetMagicCount(g_magicAnchor1_1) + GetMagicCount(g_magicAnchor1_2) + GetMagicCount(g_magicAnchor2_1) + GetMagicCount(g_magicAnchor2_2)),
                        (posInfo.SelectByTicket(1) ? 0.0 : 0.0));
   text += StringFormat(" Tier 1 Orders: %d/%d (Base DD: %.1f%%)\n", 
                        GetMagicCount(g_magicT1), InpTier1Orders, g_tier1AnchorDD);
   text += StringFormat(" Tier 2 Orders: %d/%d | Anchors: [A1.1:%s, A1.2:%s] | Base DD: %.1f%%\n", 
                        GetMagicCount(g_magicT2), InpTier2Orders, 
                        (GetMagicCount(g_magicAnchor1_1) > 0 ? "⚓" : "-"),
                        (GetMagicCount(g_magicAnchor1_2) > 0 ? "⚓" : "-"),
                        g_tier2AnchorDD);
   text += StringFormat(" Tier 3 Orders: %d/%d | Anchors: [A2.1:%s, A2.2:%s] | Base DD: %.1f%%\n", 
                        GetMagicCount(g_magicT3), InpTier3Orders, 
                        (GetMagicCount(g_magicAnchor2_1) > 0 ? "⚓" : "-"),
                        (GetMagicCount(g_magicAnchor2_2) > 0 ? "⚓" : "-"),
                        g_tier3AnchorDD);
   text += " ──────────────────────────────────────────\n";
   text += StringFormat(" Lot Mode: %s | Next Slot Lot: %.2f\n", EnumToString(InpLotMode), g_lotSequence[MathMin(PositionsTotal(), MAX_LOT_SLOTS - 1)]);
   text += StringFormat(" Auto-Hedge: %s (Ceiling: %.1f%%)\n", (g_isHedgeLocked ? "LOCKED 🚨" : "READY"), InpHedgeTriggerDD_Pct);
   text += " ──────────────────────────────────────────\n";

   Comment(text);
}
//+------------------------------------------------------------------+
