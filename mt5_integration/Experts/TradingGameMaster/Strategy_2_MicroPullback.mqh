//+------------------------------------------------------------------+
//| Strategy_2_MicroPullback.mqh                                     |
//| EMA20/50 Cross + Pullback                                        |
//+------------------------------------------------------------------+
#ifndef __STRATEGY_2_PULLBACK_MQH__
#define __STRATEGY_2_PULLBACK_MQH__

#include "StrategyBase.mqh"

class CStrategy2_MicroPullback : public CStrategyBase
{
private:
   int m_hEma20;
   int m_hEma50;

public:
   virtual void Init(int id, CVirtualAccount *acc) override
   {
      CStrategyBase::Init(id, acc);
      m_hEma20 = iMA(_Symbol, PERIOD_M1, 20, 0, MODE_EMA, PRICE_CLOSE);
      m_hEma50 = iMA(_Symbol, PERIOD_M1, 50, 0, MODE_EMA, PRICE_CLOSE);
   }

   virtual void OnTickInternal() override
   {
      if(m_account.GetOpenOrdersCount() > 0) return;
      
      double ema20[], ema50[];
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      ArraySetAsSeries(ema20, true);
      ArraySetAsSeries(ema50, true);
      
      if(CopyBuffer(m_hEma20, 0, 0, 3, ema20) < 3) return;
      if(CopyBuffer(m_hEma50, 0, 0, 3, ema50) < 3) return;
      if(CopyRates(_Symbol, PERIOD_M1, 0, 3, rates) < 3) return;
      
            double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      if(digits == 3 || digits == 5) point = point * 10.0;
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      
      // Buy logic: EMA20 > EMA50, price dipped below EMA20 but closed back above it
      if(ema20[0] > ema50[0])
      {
         if(rates[1].low < ema20[1] && rates[1].close > ema20[1] && rates[0].close > rates[1].high) 
         {
            double sl = ask - (500 * point);
            double tp = ask + (150 * point); // Adjusted for higher win rate
            m_account.OpenOrder(POSITION_TYPE_BUY, 0.05, sl, tp, "PULL_BUY");
         }
      }
      
      // Sell logic
      if(ema20[0] < ema50[0])
      {
         if(rates[1].high > ema20[1] && rates[1].close < ema20[1] && rates[0].close < rates[1].low) 
         {
            double sl = bid + (500 * point);
            double tp = bid - (150 * point); // Adjusted for higher win rate
            m_account.OpenOrder(POSITION_TYPE_SELL, 0.05, sl, tp, "PULL_SELL");
         }
      }
   }
};

#endif
