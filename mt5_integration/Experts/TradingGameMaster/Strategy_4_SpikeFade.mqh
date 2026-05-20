//+------------------------------------------------------------------+
//| Strategy_4_SpikeFade.mqh                                         |
//| ATR based Spike Fade (Mean Reversion)                            |
//+------------------------------------------------------------------+
#ifndef __STRATEGY_4_SPIKEFADE_MQH__
#define __STRATEGY_4_SPIKEFADE_MQH__

#include "StrategyBase.mqh"

class CStrategy4_SpikeFade : public CStrategyBase
{
private:
   int m_hAtr;
   int m_hEma20;

public:
   virtual void Init(int id, CVirtualAccount *acc) override
   {
      CStrategyBase::Init(id, acc);
      m_hAtr = iATR(_Symbol, PERIOD_M1, 14);
      m_hEma20 = iMA(_Symbol, PERIOD_M1, 20, 0, MODE_EMA, PRICE_CLOSE);
   }

   virtual void OnTickInternal() override
   {
      if(m_account.GetOpenOrdersCount() > 0) return;
      
      double atr[], ema[];
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      ArraySetAsSeries(atr, true);
      ArraySetAsSeries(ema, true);
      
      if(CopyBuffer(m_hAtr, 0, 0, 2, atr) < 2) return;
      if(CopyBuffer(m_hEma20, 0, 0, 2, ema) < 2) return;
      if(CopyRates(_Symbol, PERIOD_M1, 0, 2, rates) < 2) return;
      
            double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      if(digits == 3 || digits == 5) point = point * 10.0;
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      
      double candleSize = rates[1].high - rates[1].low;
      
      // If candle size is > 3x ATR (Abnormal spike)
      if(candleSize > (atr[1] * 3.0))
      {
         // Spike UP -> Fade SELL
         if(rates[1].close > rates[1].open)
         {
            double sl = bid + (300 * point); // Balanced SL (30 gold pips)
            double tp = bid - (200 * point); // Balanced TP (20 gold pips)
            m_account.OpenOrder(POSITION_TYPE_SELL, 0.05, sl, tp, "SPIKE_SELL");
         }
         // Spike DOWN -> Fade BUY
         else
         {
            double sl = ask - (300 * point); // Balanced SL (30 gold pips)
            double tp = ask + (200 * point); // Balanced TP (20 gold pips)
            m_account.OpenOrder(POSITION_TYPE_BUY, 0.05, sl, tp, "SPIKE_BUY");
         }
      }
   }
};

#endif
