//+------------------------------------------------------------------+
//| Strategy_1_MomentumBurst.mqh                                     |
//| EMA9/EMA21 Cross + Breakout Momentum                             |
//+------------------------------------------------------------------+
#ifndef __STRATEGY_1_MOMENTUM_MQH__
#define __STRATEGY_1_MOMENTUM_MQH__

#include "StrategyBase.mqh"

class CStrategy1_MomentumBurst : public CStrategyBase
{
private:
   int m_hEma9;
   int m_hEma21;

public:
   virtual void Init(int id, CVirtualAccount *acc) override
   {
      CStrategyBase::Init(id, acc);
      m_hEma9 = iMA(_Symbol, PERIOD_M1, 9, 0, MODE_EMA, PRICE_CLOSE);
      m_hEma21 = iMA(_Symbol, PERIOD_M1, 21, 0, MODE_EMA, PRICE_CLOSE);
   }

   virtual void OnTickInternal() override
   {
      if(m_account.GetOpenOrdersCount() > 0) return; // Only 1 order per round
      
      double ema9[], ema21[];
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      ArraySetAsSeries(ema9, true);
      ArraySetAsSeries(ema21, true);
      
      if(CopyBuffer(m_hEma9, 0, 0, 2, ema9) < 2) return;
      if(CopyBuffer(m_hEma21, 0, 0, 2, ema21) < 2) return;
      if(CopyRates(_Symbol, PERIOD_M1, 0, 6, rates) < 6) return;
      
            double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      if(digits == 3 || digits == 5) point = point * 10.0;
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      
      // Buy logic: EMA9 > EMA21 and closed above previous 5 highs
      if(ema9[0] > ema21[0]) //&& ema9[1] <= ema21[1])
      {
         double highest = 0;
         for(int i=1; i<=5; i++) { if(rates[i].high > highest) highest = rates[i].high; }
         if(rates[0].close > highest && rates[1].close <= highest) // Just crossed
         {
            double sl = ask - (250 * point); // Balanced SL (25 gold pips)
            double tp = ask + (200 * point); // Balanced TP (20 gold pips)
            m_account.OpenOrder(POSITION_TYPE_BUY, 0.05, sl, tp, "MOM_BUY");
         }
      }
      
      // Sell logic
      if(ema9[0] < ema21[0]) //&& ema9[1] >= ema21[1])
      {
         double lowest = 999999;
         for(int i=1; i<=5; i++) { if(rates[i].low < lowest) lowest = rates[i].low; }
         if(rates[0].close < lowest && rates[1].close >= lowest) // Just crossed
         {
            double sl = bid + (250 * point); // Balanced SL (25 gold pips)
            double tp = bid - (200 * point); // Balanced TP (20 gold pips)
            m_account.OpenOrder(POSITION_TYPE_SELL, 0.05, sl, tp, "MOM_SELL");
         }
      }
   }
};

#endif
