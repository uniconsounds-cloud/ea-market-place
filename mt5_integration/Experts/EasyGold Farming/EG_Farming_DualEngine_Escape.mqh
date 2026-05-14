//+------------------------------------------------------------------+
//| EG_Farming_DualEngine_Escape.mqh                                 |
//| Unified State Escape & Dual Engine (Grid & Scalper)              |
//+------------------------------------------------------------------+
#ifndef __EG_FARMING_DUALENGINE_ESCAPE_MQH__
#define __EG_FARMING_DUALENGINE_ESCAPE_MQH__

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>

// Enums
enum ENUM_EG_STATE
{
   EG_STATE_NORMAL = 0,    // Safe state, normal gridding & normal scalping
   EG_STATE_CAUTION = 1,   // Medium stress, wide grid spacing, capped lots, hedging scalp
   EG_STATE_CRISIS = 2,    // High stress, frozen grid, defensive scalp only
   EG_STATE_ESCAPE = 3,    // Near-BE pullback detected, closing all for safety
   EG_STATE_LOCKDOWN = 4   // Extreme stress, hard reduction of positions, scalper off
};

// Basket statistics structure per side
struct EG_BasketStats
{
   int count;
   double totalLots;
   double weightedBE;
   double floatingProfit;
   double distanceFromBE; // Points from BE
   int maxSeq;
   double highestPrice;
   double lowestPrice;
   datetime oldestOpenTime;
};

// Position item for sorting
struct EG_PositionItem
{
   ulong ticket;
   double lot;
   double profit;
};

// Global configurations are directly accessible from the main .mq5 scope since this header is included after the inputs block.

// Class declarations
class CEGEscapeManager
{
private:
   CTrade m_trade;
   ENUM_EG_STATE m_buyState;
   ENUM_EG_STATE m_sellState;
   EG_BasketStats m_buyStats;
   EG_BasketStats m_sellStats;
   
   double m_worstFloatingBuy;  // Peak drawdown tracked
   double m_worstFloatingSell; // Peak drawdown tracked
   
   datetime m_buyCooldownUntil;
   datetime m_sellCooldownUntil;
   
   bool PositionSelectByIndexLocal(const int index)
   {
      ulong ticket = PositionGetTicket(index);
      if(ticket == 0) return false;
      return PositionSelectByTicket(ticket);
   }

public:
   CEGEscapeManager()
   {
      m_buyState = EG_STATE_NORMAL;
      m_sellState = EG_STATE_NORMAL;
      m_worstFloatingBuy = 0.0;
      m_worstFloatingSell = 0.0;
      m_buyCooldownUntil = 0;
      m_sellCooldownUntil = 0;
      ZeroMemory(m_buyStats);
      ZeroMemory(m_sellStats);
   }

   ENUM_EG_STATE GetBuyState() const { return m_buyState; }
   ENUM_EG_STATE GetSellState() const { return m_sellState; }
   
   EG_BasketStats GetBuyStats() const { return m_buyStats; }
   EG_BasketStats GetSellStats() const { return m_sellStats; }

   bool IsBuyInCooldown() const { return TimeCurrent() < m_buyCooldownUntil; }
   bool IsSellInCooldown() const { return TimeCurrent() < m_sellCooldownUntil; }
   
   void SetBuyCooldown(int minutes) { m_buyCooldownUntil = TimeCurrent() + minutes * 60; }
   void SetSellCooldown(int minutes) { m_sellCooldownUntil = TimeCurrent() + minutes * 60; }

   // Core loop per side
   void UpdateStats(const int base_magic, const ENUM_POSITION_TYPE side, EG_BasketStats &stats)
   {
      ZeroMemory(stats);
      int total = PositionsTotal();
      double sumLotPrice = 0.0;
      
      stats.highestPrice = 0.0;
      stats.lowestPrice = 999999.0;
      
      for(int i = 0; i < total; i++)
      {
         if(!PositionSelectByIndexLocal(i)) continue;
         if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
         
         int magic = (int)PositionGetInteger(POSITION_MAGIC);
         // Support standard multi-cluster magics
         bool isCoreMagic = (magic == base_magic || (magic >= base_magic && magic <= base_magic + 20));
         if(!isCoreMagic) continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

         double lot = PositionGetDouble(POSITION_VOLUME);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
         datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
         
         stats.count++;
         stats.totalLots += lot;
         sumLotPrice += openPrice * lot;
         stats.floatingProfit += profit;
         
         if(openPrice > stats.highestPrice) stats.highestPrice = openPrice;
         if(openPrice < stats.lowestPrice) stats.lowestPrice = openPrice;
         if(stats.oldestOpenTime == 0 || openTime < stats.oldestOpenTime) stats.oldestOpenTime = openTime;
         
         // Extract sequence number from comment if present
         string comment = PositionGetString(POSITION_COMMENT);
         int seqIdx = StringFind(comment, "#");
         if(seqIdx >= 0)
         {
            int seqVal = (int)StringToInteger(StringSubstr(comment, seqIdx + 1));
            if(seqVal > stats.maxSeq) stats.maxSeq = seqVal;
         }
      }

      if(stats.count > 0 && stats.totalLots > 0)
      {
         stats.weightedBE = NormalizeDouble(sumLotPrice / stats.totalLots, _Digits);
         double currentPrice = (side == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         stats.distanceFromBE = MathAbs(currentPrice - stats.weightedBE) / _Point;
      }
   }

   // State evaluation
   ENUM_EG_STATE EvaluateState(const EG_BasketStats &stats, const ENUM_POSITION_TYPE side, double &worstFloatingTracker)
   {
      if(stats.count == 0)
      {
         worstFloatingTracker = 0.0;
         return EG_STATE_NORMAL;
      }

      // Track peak floating loss (worst case)
      if(stats.floatingProfit < worstFloatingTracker)
         worstFloatingTracker = stats.floatingProfit;

      // Eval Lockdown
      double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
      if(stats.count >= InpLockdownOrders || stats.floatingProfit <= InpLockdownLoss || (marginLevel > 0 && marginLevel < 300.0))
      {
         return EG_STATE_LOCKDOWN;
      }

      // Eval Crisis
      if(stats.count >= InpCrisisOrders || stats.floatingProfit <= InpCrisisLoss || stats.distanceFromBE >= 3000.0)
      {
         return EG_STATE_CRISIS;
      }

      // Eval Caution
      if(stats.count >= InpCautionOrders || stats.floatingProfit <= InpCautionLoss)
      {
         return EG_STATE_CAUTION;
      }

      return EG_STATE_NORMAL;
   }

   // Process active operations
   void Process(const int magicBuy, const int magicSell)
   {
      // 1. Process BUY
      UpdateStats(magicBuy, POSITION_TYPE_BUY, m_buyStats);
      m_buyState = EvaluateState(m_buyStats, POSITION_TYPE_BUY, m_worstFloatingBuy);
      
      if(m_buyState != EG_STATE_NORMAL && !IsBuyInCooldown())
      {
         ExecuteEscapes(magicBuy, POSITION_TYPE_BUY, m_buyStats, m_worstFloatingBuy, m_buyState);
      }

      // 2. Process SELL
      UpdateStats(magicSell, POSITION_TYPE_SELL, m_sellStats);
      m_sellState = EvaluateState(m_sellStats, POSITION_TYPE_SELL, m_worstFloatingSell);
      
      if(m_sellState != EG_STATE_NORMAL && !IsSellInCooldown())
      {
         ExecuteEscapes(magicSell, POSITION_TYPE_SELL, m_sellStats, m_worstFloatingSell, m_sellState);
      }

      // Sync state and cooldowns to global reporting variables for UI Display
      g_escapeBuyState = (int)m_buyState;
      g_escapeSellState = (int)m_sellState;
      g_escapeBuyCooldownUntil = m_buyCooldownUntil;
      g_escapeSellCooldownUntil = m_sellCooldownUntil;
   }

   // Execution router
   void ExecuteEscapes(const int magic, const ENUM_POSITION_TYPE side, const EG_BasketStats &stats, double worstFloating, ENUM_EG_STATE &state)
   {
      // A. Check Near-BE Escape
      if(stats.count >= InpNearBEStartOrders)
      {
         double currentPrice = (side == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double distance = MathAbs(currentPrice - stats.weightedBE) / _Point;
         
         if(distance <= InpNearBEDistance && stats.floatingProfit >= InpAllowedEscapeLoss)
         {
            PrintFormat("[ESCAPE] Triggered Near-BE Escape for %s. Count=%d, BE=%f, Loss=%f", 
                        (side == POSITION_TYPE_BUY ? "BUY" : "SELL"), stats.count, stats.weightedBE, stats.floatingProfit);
            state = EG_STATE_ESCAPE;
            CloseAllPositions(magic, side);
            if(side == POSITION_TYPE_BUY) m_buyCooldownUntil = TimeCurrent() + 600; // 10m
            else m_sellCooldownUntil = TimeCurrent() + 600;
            return;
         }
      }

      // B. Check Partial Escape
      if(stats.count >= 15 && worstFloating < 0)
      {
         // If current floating profit has recovered from worst floating loss by more than threshold
         double recoveryPercent = (1.0 - (stats.floatingProfit / worstFloating)) * 100.0;
         if(recoveryPercent >= InpPartialRecoveryPct)
         {
            PrintFormat("[ESCAPE] Triggered Partial Escape for %s. Recovered %.1f%% from peak loss (%f)", 
                        (side == POSITION_TYPE_BUY ? "BUY" : "SELL"), recoveryPercent, worstFloating);
            PartialClosePositions(magic, side, 0.60); // Close ~60% of positions (profitable/smallest loss)
            if(side == POSITION_TYPE_BUY) m_buyCooldownUntil = TimeCurrent() + 300; // 5m
            else m_sellCooldownUntil = TimeCurrent() + 300;
            return;
         }
      }

      // C. Lockdown Hard Reduce
      if(state == EG_STATE_LOCKDOWN)
      {
         PrintFormat("[ESCAPE] Triggered Lockdown Hard Reduction for %s. Count=%d, MarginLevel=%.1f%%", 
                     (side == POSITION_TYPE_BUY ? "BUY" : "SELL"), stats.count, AccountInfoDouble(ACCOUNT_MARGIN_LEVEL));
         HardReducePositions(magic, side, 0.25); // Hard reduce 25% exposure
         if(side == POSITION_TYPE_BUY) m_buyCooldownUntil = TimeCurrent() + 1200; // 20m
         else m_sellCooldownUntil = TimeCurrent() + 1200;
      }
   }

   // Helpers for closures
   void CloseAllPositions(const int base_magic, const ENUM_POSITION_TYPE side)
   {
      int total = PositionsTotal();
      m_trade.SetDeviationInPoints(30);
      for(int i = total - 1; i >= 0; i--)
      {
         if(!PositionSelectByIndexLocal(i)) continue;
         if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
         
         int magic = (int)PositionGetInteger(POSITION_MAGIC);
         bool isCoreMagic = (magic == base_magic || (magic >= base_magic && magic <= base_magic + 20));
         if(!isCoreMagic) continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

         m_trade.PositionClose(PositionGetInteger(POSITION_TICKET));
      }
   }

   // Sort positions to close profitable and small-loss ones first
   void PartialClosePositions(const int base_magic, const ENUM_POSITION_TYPE side, double pctToClose)
   {
      int total = PositionsTotal();
      EG_PositionItem items[];
      int itemsCount = 0;
      
      for(int i = 0; i < total; i++)
      {
         if(!PositionSelectByIndexLocal(i)) continue;
         if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
         
         int magic = (int)PositionGetInteger(POSITION_MAGIC);
         bool isCoreMagic = (magic == base_magic || (magic >= base_magic && magic <= base_magic + 20));
         if(!isCoreMagic) continue;
         if((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) != side) continue;

         int arrSize = ArraySize(items);
         if(itemsCount >= arrSize)
            ArrayResize(items, arrSize + 10);
            
         items[itemsCount].ticket = PositionGetInteger(POSITION_TICKET);
         items[itemsCount].lot = PositionGetDouble(POSITION_VOLUME);
         items[itemsCount].profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
         itemsCount++;
      }
      
      if(itemsCount == 0) return;
      ArrayResize(items, itemsCount);
      
      // Simple bubble sort (Profit descending: profitable & small-loss first)
      for(int i = 0; i < itemsCount - 1; i++)
      {
         for(int j = 0; j < itemsCount - i - 1; j++)
         {
            if(items[j].profit < items[j+1].profit)
            {
               EG_PositionItem temp = items[j];
               items[j] = items[j+1];
               items[j+1] = temp;
            }
         }
      }

      int targetCountToClose = (int)MathRound(itemsCount * pctToClose);
      if(targetCountToClose <= 0) targetCountToClose = 1;
      
      m_trade.SetDeviationInPoints(30);
      for(int i = 0; i < targetCountToClose && i < itemsCount; i++)
      {
         m_trade.PositionClose(items[i].ticket);
         PrintFormat("[ESCAPE] Partial close ticket %I64u lot=%.2f profit=%.2f", items[i].ticket, items[i].lot, items[i].profit);
      }
   }

   void HardReducePositions(const int base_magic, const ENUM_POSITION_TYPE side, double pctToClose)
   {
      // Hard reduce closes smallest loss orders to save margin
      PartialClosePositions(base_magic, side, pctToClose);
   }

   // Lot Caps depending on state
   double GetLotCap(const ENUM_POSITION_TYPE side, const double originalLimit)
   {
      ENUM_EG_STATE state = (side == POSITION_TYPE_BUY) ? m_buyState : m_sellState;
      if(state == EG_STATE_LOCKDOWN) return 0.0; // Block completely
      if(state == EG_STATE_CRISIS) return InpMaxLotCrisis;
      if(state == EG_STATE_CAUTION) return InpMaxLotNormal;
      return originalLimit;
   }

   // Blocking grid entries
   bool IsGridBlocked(const ENUM_POSITION_TYPE side)
   {
      ENUM_EG_STATE state = (side == POSITION_TYPE_BUY) ? m_buyState : m_sellState;
      return (state == EG_STATE_CRISIS || state == EG_STATE_LOCKDOWN || state == EG_STATE_ESCAPE);
   }

   // Dynamic Spacing multiplier
   int GetSpacingMultiplier(const ENUM_POSITION_TYPE side)
   {
      ENUM_EG_STATE state = (side == POSITION_TYPE_BUY) ? m_buyState : m_sellState;
      if(state == EG_STATE_CAUTION) return 2; // Double grid spacing
      return 1;
   }
};

class CEGDualEngineScalper
{
private:
   CTrade m_trade;
   int m_scalperMagic;
   datetime m_lastTradeTime;
   int m_lossStreak;
   datetime m_streakCooldownUntil;
   
   bool PositionSelectByIndexLocal(const int index)
   {
      ulong ticket = PositionGetTicket(index);
      if(ticket == 0) return false;
      return PositionSelectByTicket(ticket);
   }

   int CountActiveScalperOrders()
   {
      int total = PositionsTotal();
      int cnt = 0;
      for(int i = 0; i < total; i++)
      {
         if(!PositionSelectByIndexLocal(i)) continue;
         if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
         if((int)PositionGetInteger(POSITION_MAGIC) == m_scalperMagic) cnt++;
      }
      return cnt;
   }

public:
   CEGDualEngineScalper()
   {
      m_scalperMagic = 0;
      m_lastTradeTime = 0;
      m_lossStreak = 0;
      m_streakCooldownUntil = 0;
   }

   void Init(int baseMagic)
   {
      m_scalperMagic = baseMagic + InpScalperMagicOffset;
   }

   int GetMagic() const { return m_scalperMagic; }

   // Track closed trade deals to evaluate Loss Streak
   void CheckClosedDeals()
   {
      if(TimeCurrent() < m_streakCooldownUntil) return;

      datetime fromTime = TimeCurrent() - 3600; // scan past hour
      if(HistorySelect(fromTime, TimeCurrent()))
      {
         int dealsTotal = HistoryDealsTotal();
         int losses = 0;
         
         // Loop deals backwards to find last closed scalper deals
         for(int i = dealsTotal - 1; i >= 0; i--)
         {
            ulong ticket = HistoryDealGetTicket(i);
            if(ticket == 0) continue;
            
            if((int)HistoryDealGetInteger(ticket, DEAL_MAGIC) != m_scalperMagic) continue;
            long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            if(entry != DEAL_ENTRY_OUT) continue; // Only count closed outings
            
            double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_SWAP) + HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            if(profit < 0)
            {
               losses++;
               if(losses >= InpLossStreakStop)
               {
                  m_lossStreak = losses;
                  m_streakCooldownUntil = TimeCurrent() + InpScalperCooldownMin * 60;
                  PrintFormat("[SCALPER] %d Losses in a row detected. Entering Cooldown for %d min.", InpLossStreakStop, InpScalperCooldownMin);
                  break;
               }
            }
            else
            {
               // Broken streak
               m_lossStreak = 0;
               break;
            }
         }
      }
   }

    void OnTickProcess(CEGEscapeManager &escapeMgr)
    {
       if(!InpEnableScalper) return;
       if(TimeCurrent() < m_streakCooldownUntil) return;
       if(TimeCurrent() - m_lastTradeTime < 300) return; // 5-minute cooldown (once per M5 bar) to prevent trade spamming
       
       CheckClosedDeals();
       if(TimeCurrent() < m_streakCooldownUntil) return;
 
       int currentScalpers = CountActiveScalperOrders();
       if(currentScalpers >= InpMaxScalperOrders) return;
 
       ENUM_EG_STATE buyState = escapeMgr.GetBuyState();
       ENUM_EG_STATE sellState = escapeMgr.GetSellState();
       
       // Stop completely in Lockdown
       if(buyState == EG_STATE_LOCKDOWN || sellState == EG_STATE_LOCKDOWN) return;
       
       // Filter out high spread or missing data
       double spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
       if(spread > 100) return; // Spread Filter (Points)
 
       // Get short EMA values for trend/momentum (M5)
       double emaFastVal = 0.0, emaSlowVal = 0.0;
       int hEmaFast = iMA(_Symbol, PERIOD_M5, 5, 0, MODE_EMA, PRICE_CLOSE);
       int hEmaSlow = iMA(_Symbol, PERIOD_M5, 20, 0, MODE_EMA, PRICE_CLOSE);
       
       double bufferFast[], bufferSlow[];
       ArraySetAsSeries(bufferFast, true);
       ArraySetAsSeries(bufferSlow, true);
       
       if(CopyBuffer(hEmaFast, 0, 0, 2, bufferFast) <= 0 || CopyBuffer(hEmaSlow, 0, 0, 2, bufferSlow) <= 0)
       {
          IndicatorRelease(hEmaFast);
          IndicatorRelease(hEmaSlow);
          return;
       }
       
       emaFastVal = bufferFast[0];
       emaSlowVal = bufferSlow[0];
       
       IndicatorRelease(hEmaFast);
       IndicatorRelease(hEmaSlow);
 
       double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
       double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
       
       // 1. NORMAL REBATE MODE: Grid is fine on both sides
       if(buyState == EG_STATE_NORMAL && sellState == EG_STATE_NORMAL)
       {
          // Scalp with short M5 EMA trend
          if(emaFastVal > emaSlowVal && bid > emaFastVal)
          {
             // Buy momentum
             double slPrice = NormalizeDouble(ask - InpScalperSL * _Point, _Digits);
             double tpPrice = NormalizeDouble(ask + InpScalperTP * _Point, _Digits);
             m_trade.SetExpertMagicNumber(m_scalperMagic);
             if(m_trade.Buy(InpScalperLot, _Symbol, ask, slPrice, tpPrice, "Scalp_Buy"))
             {
                m_lastTradeTime = TimeCurrent();
             }
          }
          else if(emaFastVal < emaSlowVal && bid < emaFastVal)
          {
             // Sell momentum
             double slPrice = NormalizeDouble(bid + InpScalperSL * _Point, _Digits);
             double tpPrice = NormalizeDouble(bid - InpScalperTP * _Point, _Digits);
             m_trade.SetExpertMagicNumber(m_scalperMagic);
             if(m_trade.Sell(InpScalperLot, _Symbol, bid, slPrice, tpPrice, "Scalp_Sell"))
             {
                m_lastTradeTime = TimeCurrent();
             }
          }
       }
       
       // 2. DEFENSIVE HEDGE-SCALP MODE: Grid is stuck
       // Scalp only on opposite side of stuck Grid to gain hedge profits
       else if(buyState >= EG_STATE_CAUTION || sellState >= EG_STATE_CAUTION)
       {
          if(buyState >= EG_STATE_CAUTION && emaFastVal < emaSlowVal)
          {
             // Buy grid is stuck (prices falling) -> Scalp SELL to gain hedge/balance
             double slPrice = NormalizeDouble(bid + InpScalperSL * _Point, _Digits);
             double tpPrice = NormalizeDouble(bid - InpScalperTP * _Point, _Digits);
             m_trade.SetExpertMagicNumber(m_scalperMagic);
             if(m_trade.Sell(InpScalperLot, _Symbol, bid, slPrice, tpPrice, "Hedge_Scalp_Sell"))
             {
                m_lastTradeTime = TimeCurrent();
             }
          }
          else if(sellState >= EG_STATE_CAUTION && emaFastVal > emaSlowVal)
          {
             // Sell grid is stuck (prices rising) -> Scalp BUY to gain hedge/balance
             double slPrice = NormalizeDouble(ask - InpScalperSL * _Point, _Digits);
             double tpPrice = NormalizeDouble(ask + InpScalperTP * _Point, _Digits);
             m_trade.SetExpertMagicNumber(m_scalperMagic);
             if(m_trade.Buy(InpScalperLot, _Symbol, ask, slPrice, tpPrice, "Hedge_Scalp_Buy"))
             {
                m_lastTradeTime = TimeCurrent();
             }
          }
       }
    }
};

#endif // __EG_FARMING_DUALENGINE_ESCAPE_MQH__
