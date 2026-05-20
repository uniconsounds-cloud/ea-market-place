//+------------------------------------------------------------------+
//| Strategy_3_RangeBounce.mqh                                       |
//| RSI Overbought/Oversold Bounce                                   |
//+------------------------------------------------------------------+
#ifndef __STRATEGY_3_RANGEBOUNCE_MQH__
#define __STRATEGY_3_RANGEBOUNCE_MQH__

#include "StrategyBase.mqh"

class CStrategy3_RangeBounce : public CStrategyBase
{
private:
   int m_hRsi;

public:
   virtual void Init(int id, CVirtualAccount *acc) override
   {
      CStrategyBase::Init(id, acc);
      m_hRsi = iRSI(_Symbol, PERIOD_M1, 7, PRICE_CLOSE);
   }

   virtual void OnTickInternal() override
   {
      if(m_account.GetOpenOrdersCount() > 0) return;
      
      double rsi[];
      if(CopyBuffer(m_hRsi, 0, 0, 2, rsi) < 2) return;
      
      ArraySetAsSeries(rsi, true);
      
            double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      if(digits == 3 || digits == 5) point = point * 10.0;
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      
      // Buy logic: RSI dipped below 30 and crossed back up
      if(rsi[1] < 30 && rsi[0] >= 30)
      {
         double sl = ask - (500 * point);
         double tp = ask + (150 * point); // Adjusted for higher win rate
         m_account.OpenOrder(POSITION_TYPE_BUY, 0.05, sl, tp, "BOUNCE_BUY");
      }
      
      // Sell logic: RSI spiked above 70 and crossed back down
      if(rsi[1] > 70 && rsi[0] <= 70)
      {
         double sl = bid + (500 * point);
         double tp = bid - (150 * point); // Adjusted for higher win rate
         m_account.OpenOrder(POSITION_TYPE_SELL, 0.05, sl, tp, "BOUNCE_SELL");
      }
   }
};

#endif
