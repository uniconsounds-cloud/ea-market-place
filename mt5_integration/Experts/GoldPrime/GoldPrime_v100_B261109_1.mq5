//+------------------------------------------------------------------+
//|                                                   GoldPrime.mq5 |
//|                                  Copyright 2026, EA Market Place |
//|                                             https://eaeze.com    |
//+------------------------------------------------------------------+
// v1.00 (1109.1) - [2026-11-09] Initial Genesis Release:
// - Specialized Gold (XAUUSD) M1 High-Frequency Cascading Recovery Engine
// - Dual-Anchor Ladder Adoption Architecture:
//     * Tier 1: Initial Entry + 3 Primary Defense Orders
//     * Tier 2: 3 Rescue Orders + Order #4 as Anchor 1 (ไม้สมอที่ 1)
//     * Tier 3: 3 Rescue Orders + Order #4 as Anchor 2 (ไม้สมอที่ 2)
// - Dynamic +4.0% Drawdown Expansion Freeze Gates between tiers
// - 3-Tier Hierarchical Exit Decision Matrix (Waterfall Priority):
//     * Priority 1: Total Portfolio Clean Sweep (Close All 100%)
//     * Priority 2: Smart Anchor Re-Handover (Attach Anchor 2 to Tier 2)
//     * Priority 3: Primary Basket + Twin Anchors Sweep
// - Dynamic State Promotion Protocol: Seamlessly re-indexes remaining orders
//   into a new Tier 1 without index overflow or state conflicts
// - Tier 3 Self-Relief Engine: Profit-driven Partial Close of oldest toxic order
// - Anti-Falling Knife & Price Action Exhaustion Confirmation Guards
// - Pre-computed Lot Sequence Pipeline (Fixed, Linear, Multiplier, Ladder)
// - Emergency Circuit Breaker: Auto-Hedge Lock at single-pair DD ceiling
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, EA Market Place"
#property link        "https://eaeze.com"
#property version     "1.00"
#property description "GoldPrime v1.00 1109 [B261109.1] - M1 Gold Dual-Anchor Recovery EA"
#property strict

//====================================================================
// EA RELEASE METADATA (SINGLE SOURCE OF TRUTH)
//====================================================================
#define EA_VERSION_STR       "v1.00-1109"
#define EA_BUILD_ID          "B261109.1"
#define EA_DASH_TITLE        "=== GoldPrime v1.00 [B261109.1] ==="
#define EA_SYSTEM_CODE       "GoldPrime"

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>

//====================================================================
// ENUMS & CUSTOM TYPES
//====================================================================
enum ENUM_LOT_MODE
{
   LOT_FIXED         = 0, // คงที่ (Fixed Lot)
   LOT_LINEAR_STEP   = 1, // บวกเพิ่มคงที่ (Linear Increment)
   LOT_MULTIPLIER    = 2, // ตัวคูณ (Multiplier / Martingale)
   LOT_LADDER_STEP   = 3  // ขั้นบันได (Ladder Step ซ้ำ N ครั้งแล้วบวก)
};

enum ENUM_INITIAL_SIDE
{
   SIDE_BUY          = 0, // BUY เท่านั้น (ค่าเริ่มต้นทองคำ)
   SIDE_SELL         = 1, // SELL เท่านั้น
   SIDE_AUTO_TREND   = 2  // อัตโนมัติตาม EMA
};

//====================================================================
// INPUT PARAMETERS
//====================================================================
input group "======= 1. General & UI ======="
input ulong               InpMagicBase            = 888800;          // Magic Number เริ่มต้น
input string              InpTradeCommentPrefix   = "GoldPrime";     // Order Comment Prefix
input int                 InpDashFontSize         = 9;               // ขนาด Font บนหน้าจอ

input group "======= 2. Lot Calculation Pipeline ======="
input ENUM_LOT_MODE       InpLotMode              = LOT_LADDER_STEP; // รูปแบบการคำนวณ Lot
input double              InpBaseLot              = 0.01;            // Lot เริ่มต้น (ไม้ที่ 1)
input double              InpLotStep              = 0.01;            // ค่าบวกเพิ่ม (สำหรับ Linear / Ladder)
input double              InpLotMultiplier        = 1.5;             // ตัวคูณ (สำหรับ Multiplier)
input int                 InpLadderGroupSize      = 2;               // จำนวนไม้ซ้ำก่อนเพิ่มขั้น (สำหรับ Ladder)
input double              InpHardMaxLot           = 0.50;            // เพดาน Lot สูงสุดต่อไม้ (Hard Cap)

input group "======= 3. Initial Entry Settings ======="
input bool                InpImmediateEntry       = true;            // เปิดไม้แรกทันทีเมื่อรัน EA
input ENUM_INITIAL_SIDE   InpInitialSide          = SIDE_BUY;        // ฝั่งของไม้แรก (BUY/SELL)
input int                 InpEmaFilterPeriod      = 50;              // EMA Period (เมื่อเลือก Auto Trend)

input group "======= 4. 3-Tier Cascading Recovery Architecture ======="
input int                 InpTier1Orders          = 3;               // จำนวนไม้ในชุดที่ 1 (ไม้หลัก)
input int                 InpTier2Orders          = 3;               // จำนวนไม้ปกติในชุดที่ 2 (กู้ภัย)
input int                 InpTier3Orders          = 3;               // จำนวนไม้ปกติในชุดที่ 3 (กู้ภัยลึก)
input double              InpTierDeltaDD_Pct      = 4.0;             // DD% ที่ต้องขยายตัวเพิ่มก่อนปลดล็อค Tier ถัดไป (+4%)
input int                 InpGridDistancePoints   = 500;             // ระยะห่างขั้นต่ำระหว่างไม้ (Points: 500 = 50 pips)
input bool                InpEnableAnchor1        = true;            // เปิดใช้งานไม้สมอที่ 1 (ไม้ที่ 4 ของ Tier 2)
input bool                InpEnableAnchor2        = true;            // เปิดใช้งานไม้สมอที่ 2 (ไม้ที่ 4 ของ Tier 3)

input group "======= 5. Profit Targets & Exit Waterfall ======="
input double              InpBasketTargetMoney    = 5.0;             // กำไรเป้าหมายปิดรวบตะกร้าหลัก ($)
input double              InpTierScalpTargetMoney = 3.0;             // กำไรเป้าหมายปิดสเกลป์ชุด 2 และ 3 ($)
input bool                InpEnableCleanSweep     = true;            // Priority 1: ปิดเกลี้ยงพอร์ต 100% เมื่อ Net Profit ถึงเป้า
input bool                InpEnableSmartReHandover= true;            // Priority 2: ส่งต่อสมอ 2 ให้ชุด 2 เมื่อสมอ 1 พอปิดชุด 1

input group "======= 6. Tier 3 Self-Relief (Partial Close) ======="
input bool                InpEnableToxicTrim      = true;            // เปิดระบบนำกำไร Tier 3 มาเฉือนไม้บนสุดทิ้ง
input double              InpTrimProfitSharePct   = 70.0;            // สัดส่วนกำไร Tier 3 ที่จะนำมาตัดไม้บน (%)

input group "======= 7. Safety Shields & Circuit Breakers ======="
input bool                InpUseExhaustionFilter  = true;            // ตรวจจับแท่งเทียนหมดแรง (ห้ามรับมีดตก)
input int                 InpMaxSpreadPoints      = 80;              // สเปรดสูงสุดที่ยอมให้ออกไม้ (Points)
input int                 InpBarCooldownPeriod    = 1;               // ห้ามออกเกิน 1 ไม้ ต่อ N แท่ง (Bar Cooldown)
input bool                InpEnableAutoHedge      = true;            // เปิดระบบล็อคพอร์ตฉุกเฉิน (Delta = 0)
input double              InpHedgeTriggerDD_Pct   = 35.0;            // Drawdown % ที่จะล็อคพอร์ตฉุกเฉิน

//====================================================================
// GLOBAL VARIABLES & OBJECTS
//====================================================================
CTrade         trade;
CPositionInfo  posInfo;

// Pre-computed lot sequence array (up to 30 slots for safety)
#define MAX_LOT_SLOTS 30
double g_lotSequence[MAX_LOT_SLOTS];

// Tracking variables for active state
int      g_activeTier         = 1;      // 1, 2, or 3
double   g_tier1AnchorDD      = 0.0;    // Baseline DD% recorded when Tier 1 completes
double   g_tier2AnchorDD      = 0.0;    // Baseline DD% recorded when Tier 2 completes
datetime g_lastOrderBarTime   = 0;      // Cooldown bar tracker
double   g_accumulatedTrimBudg= 0.0;    // งบกำไรสะสมสำหรับตัดไม้บน (Partial Trim Fund)
bool     g_isHedgeLocked      = false;  // สถานะล็อคพอร์ตฉุกเฉิน

// Magic Numbers per tier for precise segregation
ulong g_magicT1;
ulong g_magicT2;
ulong g_magicT3;
ulong g_magicAnchor1;
ulong g_magicAnchor2;
ulong g_magicHedge;

// Struct to store categorized position data
struct BasketSnapshot
{
   int    totalCount;
   double totalVolume;
   double totalProfit;
   double totalFloatingLoss;
   
   int    t1Count;
   double t1Volume;
   double t1Profit;
   
   int    t2Count;
   double t2Volume;
   double t2Profit;
   
   int    t3Count;
   double t3Volume;
   double t3Profit;
   
   ulong  anchor1Ticket;
   double anchor1Volume;
   double anchor1Profit;
   
   ulong  anchor2Ticket;
   double anchor2Volume;
   double anchor2Profit;
   
   ulong  worstTicket;       // ไม้ที่ขาดทุนหนักสุดบนสุด (สำหรับ Partial Trim)
   double worstLoss;
   double worstVolume;
   
   double lowestBuyPrice;
   double highestSellPrice;
};

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // Set magic numbers
   g_magicT1      = InpMagicBase + 1;
   g_magicT2      = InpMagicBase + 2;
   g_magicT3      = InpMagicBase + 3;
   g_magicAnchor1 = InpMagicBase + 10;
   g_magicAnchor2 = InpMagicBase + 20;
   g_magicHedge   = InpMagicBase + 99;

   // Configure trade object
   trade.SetExpertMagicNumber(InpMagicBase);
   trade.SetMarginMode();
   trade.SetTypeFillingBySymbol(_Symbol);

   // Pre-compute lot sequence pipeline
   ComputeLotSequence();

   PrintFormat("[%s] Initialized successfully. BaseLot=%.2f, HardMax=%.2f, Distance=%d pts",
               EA_SYSTEM_CODE, InpBaseLot, InpHardMaxLot, InpGridDistancePoints);
               
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
//| Pre-compute Lot Sequence Pipeline                                |
//+------------------------------------------------------------------+
void ComputeLotSequence()
{
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(lotStep <= 0.0) lotStep = 0.01;
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   if(minLot <= 0.0) minLot = 0.01;
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(maxLot <= 0.0) maxLot = 100.0;

   double base = MathMax(minLot, InpBaseLot);

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
           magic == g_magicAnchor1 || magic == g_magicAnchor2 || magic == g_magicHedge);
}

//+------------------------------------------------------------------+
//| Take Snapshot of All Open Positions                              |
//+------------------------------------------------------------------+
void ScanPositions(BasketSnapshot &snap)
{
   ZeroMemory(snap);
   snap.lowestBuyPrice   = 999999.0;
   snap.highestSellPrice = 0.0;
   snap.worstLoss        = 0.0;

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
      }
      else if(magic == g_magicT2)
      {
         snap.t2Count++;
         snap.t2Volume += vol;
         snap.t2Profit += profit;
      }
      else if(magic == g_magicT3)
      {
         snap.t3Count++;
         snap.t3Volume += vol;
         snap.t3Profit += profit;
      }
      else if(magic == g_magicAnchor1)
      {
         snap.anchor1Ticket = ticket;
         snap.anchor1Volume = vol;
         snap.anchor1Profit = profit;
      }
      else if(magic == g_magicAnchor2)
      {
         snap.anchor2Ticket = ticket;
         snap.anchor2Volume = vol;
         snap.anchor2Profit = profit;
      }

      // Track worst toxic position (excluding anchors, highest loss)
      if(magic == g_magicT1 && profit < snap.worstLoss)
      {
         snap.worstLoss   = profit;
         snap.worstTicket = ticket;
         snap.worstVolume = vol;
      }
   }

   if(snap.lowestBuyPrice >= 999999.0) snap.lowestBuyPrice = 0.0;
}

//+------------------------------------------------------------------+
//| Price Action Exhaustion Confirmation (Anti-Falling Knife)        |
//+------------------------------------------------------------------+
bool IsExhaustionConfirmed(ENUM_POSITION_TYPE posType)
{
   if(!InpUseExhaustionFilter) return true;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, _Period, 1, 4, rates) < 4) return true; // Fail open if data missing

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

      // Entry confirmed if:
      // 1. Lower rejection wick >= 35% of total bar range
      // 2. Bullish reversal close
      // 3. Range contraction (consolidation)
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
   
   // Reset internal state
   g_activeTier         = 1;
   g_tier1AnchorDD      = 0.0;
   g_tier2AnchorDD      = 0.0;
   g_accumulatedTrimBudg= 0.0;
   g_isHedgeLocked      = false;
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
//| Re-tag Remaining Tier 2 Orders to become Tier 1 (Promotion)      |
//+------------------------------------------------------------------+
void PromoteRemainingOrdersToNewTier1(double currentDD)
{
   PrintFormat("[%s] 🔄 Promoting remaining Tier 2 orders into NEW Tier 1...", EA_SYSTEM_CODE);
   
   // In MT5 we cannot edit magic number of an open position directly,
   // so we update internal state tracker and order mapping:
   // - Tier 2 is recognized as the new Tier 1 anchor
   // - Baseline DD is reset to current portfolio DD
   g_activeTier    = 1;
   g_tier1AnchorDD = currentDD;
   g_tier2AnchorDD = 0.0;
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
   
   // Calculate loss per 0.01 lot
   double lossPerMinLot = (totalLoss / openVol) * lotStep;
   if(lossPerMinLot <= 0.0) return false;

   // Calculate how many lot steps this profit budget can finance
   int stepsCanTrim = (int)MathFloor(availableBudget / lossPerMinLot);
   double trimVolume = stepsCanTrim * lotStep;

   if(trimVolume >= openVol)
   {
      // Can afford to eliminate the entire position!
      if(trade.PositionClose(worstTicket))
      {
         PrintFormat("[%s] ✂️ Toxic Trim [FULL CLOSE]: Closed ticket #%I64u (Loss: %.2f covered by budget %.2f)",
                     EA_SYSTEM_CODE, worstTicket, totalLoss, availableBudget);
         return true;
      }
   }
   else if(trimVolume >= lotStep)
   {
      // Partial close
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
      // Open hedge position matching net exposure
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

   // 3. WATERFALL PROFIT TAKING & BASKET CLOSURE
   CheckHierarchicalExits(snap, currentDD_Pct);

   // Re-scan after potential closures
   ScanPositions(snap);
   if(snap.totalCount == 0) return;

   // 4. CASCADING RECOVERY GRID & ANCHOR DEPLOYMENT
   CheckGridAndAnchorDeployment(snap, currentDD_Pct);
}

//+------------------------------------------------------------------+
//| Check 3-Tier Hierarchical Exit Decision Matrix                   |
//+------------------------------------------------------------------+
void CheckHierarchicalExits(BasketSnapshot &snap, double currentDD)
{
   // Priority 1: Total Portfolio Clean Sweep
   if(InpEnableCleanSweep && snap.totalProfit >= InpBasketTargetMoney)
   {
      CloseAllPortfolio();
      return;
   }

   // Calculate Primary Basket + Anchors PnL
   double t1WithAnchorsProfit = snap.t1Profit + snap.anchor1Profit + snap.anchor2Profit;
   double t1WithAnchor1Only   = snap.t1Profit + snap.anchor1Profit;

   // Priority 2: Smart Anchor Re-Handover (Anchor 1 is enough for Tier 1, preserve Anchor 2 for Tier 2)
   if(InpEnableSmartReHandover && snap.anchor1Ticket > 0 && snap.anchor2Ticket > 0 && t1WithAnchor1Only >= InpBasketTargetMoney)
   {
      PrintFormat("[%s] 🥈 Priority 2: Smart Re-Handover! Closing Tier 1 + Anchor 1. Preserving Anchor 2 for Tier 2!", EA_SYSTEM_CODE);
      CloseByMagic(g_magicT1);
      ClosePosition(snap.anchor1Ticket);

      // Re-assign Anchor 2 to become Anchor 1 for Tier 2
      trade.SetExpertMagicNumber(g_magicAnchor1);
      PromoteRemainingOrdersToNewTier1(currentDD);
      return;
   }

   // Priority 3: Primary Basket + Twin Anchors Sweep
   if(t1WithAnchorsProfit >= InpBasketTargetMoney)
   {
      PrintFormat("[%s] 🥉 Priority 3: Primary Basket + Twin Anchors Take Profit reached (+%.2f $)!", EA_SYSTEM_CODE, t1WithAnchorsProfit);
      CloseByMagic(g_magicT1);
      if(snap.anchor1Ticket > 0) ClosePosition(snap.anchor1Ticket);
      if(snap.anchor2Ticket > 0) ClosePosition(snap.anchor2Ticket);

      // Promote remaining Tier 2/Tier 3 orders to become new Tier 1
      PromoteRemainingOrdersToNewTier1(currentDD);
      return;
   }

   // Independent Tier 2 Scalp Exit
   if(snap.t2Count >= InpTier2Orders && snap.t2Profit >= InpTierScalpTargetMoney)
   {
      PrintFormat("[%s] 🟡 Tier 2 Scalp Take Profit (+%.2f $)! Closing Tier 2 regular orders, keeping Anchor 1 intact.", EA_SYSTEM_CODE, snap.t2Profit);
      CloseByMagic(g_magicT2);
      return;
   }

   // Independent Tier 3 Scalp Exit & Self-Relief Toxic Trim
   if(snap.t3Count >= InpTier3Orders && snap.t3Profit >= InpTierScalpTargetMoney)
   {
      PrintFormat("[%s] 🔴 Tier 3 Scalp Take Profit (+%.2f $)! Executing Toxic Trim on worst ticket...", EA_SYSTEM_CODE, snap.t3Profit);
      
      double realizedT3 = snap.t3Profit;
      CloseByMagic(g_magicT3);

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
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // TIER 1 DEPLOYMENT
   if(snap.t1Count < InpTier1Orders)
   {
      // Check distance from lowest buy
      if(snap.lowestBuyPrice > 0.0 && (snap.lowestBuyPrice - ask) >= InpGridDistancePoints * _Point)
      {
         if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
         {
            int slotIdx = snap.t1Count;
            OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT1, StringFormat("%s:T1:#%d", InpTradeCommentPrefix, snap.t1Count + 1));
            return;
         }
      }
   }
   else if(snap.t1Count == InpTier1Orders && g_tier1AnchorDD == 0.0)
   {
      // Freeze Tier 1, lock baseline DD anchor
      g_tier1AnchorDD = MathMax(currentDD, 1.0);
      PrintFormat("[%s] 🛑 Tier 1 Complete (3/3). FREEZE ACTIVE. Anchor DD=%.2f%%. Awaiting +%.1f%% expansion.",
                  EA_SYSTEM_CODE, g_tier1AnchorDD, InpTierDeltaDD_Pct);
   }

   // TIER 2 DEPLOYMENT (Requires DD >= Tier 1 Anchor DD + Delta DD%)
   if(snap.t1Count >= InpTier1Orders && g_tier1AnchorDD > 0.0)
   {
      double t2TriggerDD = g_tier1AnchorDD + InpTierDeltaDD_Pct;
      if(currentDD >= t2TriggerDD)
      {
         if(snap.t2Count < InpTier2Orders)
         {
            if((snap.lowestBuyPrice - ask) >= InpGridDistancePoints * _Point)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + snap.t2Count; // Slot 3, 4, 5
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT2, StringFormat("%s:T2:#%d", InpTradeCommentPrefix, snap.t2Count + 1));
                  return;
               }
            }
         }
         else if(snap.t2Count >= InpTier2Orders && InpEnableAnchor1 && snap.anchor1Ticket == 0)
         {
            // Deploy ANCHOR 1 (Order #4 of Tier 2)
            if((snap.lowestBuyPrice - ask) >= InpGridDistancePoints * _Point)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + InpTier2Orders; // Slot 6
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicAnchor1, InpTradeCommentPrefix + ":Anchor-1");
                  g_tier2AnchorDD = MathMax(currentDD, t2TriggerDD);
                  PrintFormat("[%s] ⚓ ANCHOR 1 DEPLOYED at Slot %d (%.2f lot). Awaiting Tier 3 trigger at DD=%.2f%%",
                              EA_SYSTEM_CODE, slotIdx, g_lotSequence[slotIdx], g_tier2AnchorDD + InpTierDeltaDD_Pct);
                  return;
               }
            }
         }
      }
   }

   // TIER 3 DEPLOYMENT (Requires DD >= Tier 2 Anchor DD + Delta DD%)
   if(snap.anchor1Ticket > 0 && g_tier2AnchorDD > 0.0)
   {
      double t3TriggerDD = g_tier2AnchorDD + InpTierDeltaDD_Pct;
      if(currentDD >= t3TriggerDD)
      {
         if(snap.t3Count < InpTier3Orders)
         {
            if((snap.lowestBuyPrice - ask) >= InpGridDistancePoints * _Point)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + InpTier2Orders + 1 + snap.t3Count; // Slot 7, 8, 9
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicT3, StringFormat("%s:T3:#%d", InpTradeCommentPrefix, snap.t3Count + 1));
                  return;
               }
            }
         }
         else if(snap.t3Count >= InpTier3Orders && InpEnableAnchor2 && snap.anchor2Ticket == 0)
         {
            // Deploy ANCHOR 2 (Order #4 of Tier 3)
            if((snap.lowestBuyPrice - ask) >= InpGridDistancePoints * _Point)
            {
               if(IsExhaustionConfirmed(POSITION_TYPE_BUY))
               {
                  int slotIdx = InpTier1Orders + InpTier2Orders + 1 + InpTier3Orders; // Slot 10
                  OpenOrder(POSITION_TYPE_BUY, g_lotSequence[slotIdx], g_magicAnchor2, InpTradeCommentPrefix + ":Anchor-2");
                  PrintFormat("[%s] ⚓ ANCHOR 2 DEPLOYED at Slot %d (%.2f lot)! Twin Anchors Active!",
                              EA_SYSTEM_CODE, slotIdx, g_lotSequence[slotIdx]);
                  return;
               }
            }
         }
      }
   }
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
   text += StringFormat(" Active Tier: %d | Total Orders: %d\n", g_activeTier, PositionsTotal());
   text += StringFormat(" Tier 1 Orders: %d/%d (Base DD: %.1f%%)\n", 
                        GetMagicCount(g_magicT1), InpTier1Orders, g_tier1AnchorDD);
   text += StringFormat(" Tier 2 Orders: %d/%d | Anchor 1: %s\n", 
                        GetMagicCount(g_magicT2), InpTier2Orders, (GetMagicCount(g_magicAnchor1) > 0 ? "ACTIVE ⚓" : "OFF"));
   text += StringFormat(" Tier 3 Orders: %d/%d | Anchor 2: %s\n", 
                        GetMagicCount(g_magicT3), InpTier3Orders, (GetMagicCount(g_magicAnchor2) > 0 ? "ACTIVE ⚓" : "OFF"));
   text += " ──────────────────────────────────────────\n";
   text += StringFormat(" Lot Mode: %s | Next Slot Lot: %.2f\n", EnumToString(InpLotMode), g_lotSequence[MathMin(PositionsTotal(), MAX_LOT_SLOTS - 1)]);
   text += StringFormat(" Auto-Hedge: %s (Ceiling: %.1f%%)\n", (g_isHedgeLocked ? "LOCKED 🚨" : "READY"), InpHedgeTriggerDD_Pct);
   text += " ──────────────────────────────────────────\n";

   Comment(text);
}
