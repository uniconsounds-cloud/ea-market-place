//+------------------------------------------------------------------+
//| Strategy_5_MultiIndicator.mqh                                    |
//| 5-Indicator Agreement Scalping Strategy targeting $3 profit      |
//+------------------------------------------------------------------+
#ifndef __STRATEGY_5_MULTIINDICATOR_MQH__
#define __STRATEGY_5_MULTIINDICATOR_MQH__

#include "StrategyBase.mqh"
#include "GameMaster_WebSync.mqh"

class CStrategy5_MultiIndicator : public CStrategyBase
{
private:
   int m_hEma9;
   int m_hEma21;
   int m_hRsi;
   int m_hMacd;
   int m_hStoch;
   int m_hSar;

   CGameMasterWebSync *m_webSync;
   int m_requiredThreshold;
   ulong m_lastThresholdQuery;
   
   string m_lastSignal;
   datetime m_signalStartTime;
   string m_indicatorStates;

public:
   CStrategy5_MultiIndicator() : m_webSync(NULL), m_requiredThreshold(3), m_lastThresholdQuery(0), m_lastSignal("NONE"), m_signalStartTime(0), m_indicatorStates("0,0,0,0,0") {}
   
   virtual void Init(int id, CVirtualAccount *acc, ENUM_STRATEGY_VERSION ver) override
   {
      CStrategyBase::Init(id, acc, ver);
      m_hEma9 = iMA(_Symbol, PERIOD_M1, 9, 0, MODE_EMA, PRICE_CLOSE);
      m_hEma21 = iMA(_Symbol, PERIOD_M1, 21, 0, MODE_EMA, PRICE_CLOSE);
      m_hRsi = iRSI(_Symbol, PERIOD_M1, 14, PRICE_CLOSE);
      m_hMacd = iMACD(_Symbol, PERIOD_M1, 12, 26, 9, PRICE_CLOSE);
      m_hStoch = iStochastic(_Symbol, PERIOD_M1, 5, 3, 3, MODE_SMA, STO_LOWHIGH);
      m_hSar = iSAR(_Symbol, PERIOD_M1, 0.02, 0.2);
   }
   
   void SetWebSync(CGameMasterWebSync *sync)
   {
      m_webSync = sync;
   }
   
   string GetIndicatorStates() const
   {
      return m_indicatorStates;
   }

   virtual void OnTickInternal() override
   {
      // 1. Query required threshold dynamically
      ulong nowMs = GetTickCount64();
      if(nowMs - m_lastThresholdQuery >= 10000)
      {
         m_lastThresholdQuery = nowMs;
         if(m_webSync != NULL)
         {
            m_requiredThreshold = m_webSync.GetRequiredThreshold(m_strategy_id);
            if(m_requiredThreshold < 2) m_requiredThreshold = 2;
            if(m_requiredThreshold > 5) m_requiredThreshold = 5;
         }
      }

      // 2. Fetch buffers
      double ema9[], ema21[], rsi[], macdMain[], macdSig[], stochK[], stochD[], sar[];
      ArraySetAsSeries(ema9, true);
      ArraySetAsSeries(ema21, true);
      ArraySetAsSeries(rsi, true);
      ArraySetAsSeries(macdMain, true);
      ArraySetAsSeries(macdSig, true);
      ArraySetAsSeries(stochK, true);
      ArraySetAsSeries(stochD, true);
      ArraySetAsSeries(sar, true);

      if(CopyBuffer(m_hEma9, 0, 0, 1, ema9) < 1) return;
      if(CopyBuffer(m_hEma21, 0, 0, 1, ema21) < 1) return;
      if(CopyBuffer(m_hRsi, 0, 0, 1, rsi) < 1) return;
      if(CopyBuffer(m_hMacd, 0, 0, 1, macdMain) < 1) return;
      if(CopyBuffer(m_hMacd, 1, 0, 1, macdSig) < 1) return;
      if(CopyBuffer(m_hStoch, 0, 0, 1, stochK) < 1) return;
      if(CopyBuffer(m_hStoch, 1, 0, 1, stochD) < 1) return;
      if(CopyBuffer(m_hSar, 0, 0, 1, sar) < 1) return;

      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double price = (ask + bid) / 2.0;

      int bullishCount = 0;
      int bearishCount = 0;

      // Indicator 1: EMA 9/21
      bool ema_bull = (ema9[0] > ema21[0]);
      if(ema_bull) bullishCount++; else bearishCount++;

      // Indicator 2: RSI 14
      bool rsi_bull = (rsi[0] > 50 || rsi[0] < 30);
      if(rsi_bull) bullishCount++; else bearishCount++;

      // Indicator 3: MACD
      bool macd_bull = (macdMain[0] > macdSig[0]);
      if(macd_bull) bullishCount++; else bearishCount++;

      // Indicator 4: Stochastic
      bool stoch_bull = (stochK[0] > stochD[0]);
      if(stoch_bull) bullishCount++; else bearishCount++;

      // Indicator 5: Parabolic SAR
      bool sar_bull = (price > sar[0]);
      if(sar_bull) bullishCount++; else bearishCount++;

      // 3. Update Indicator States
      m_indicatorStates = StringFormat("%d,%d,%d,%d,%d",
                                       ema_bull ? 1 : 0,
                                       rsi_bull ? 1 : 0,
                                       macd_bull ? 1 : 0,
                                       stoch_bull ? 1 : 0,
                                       sar_bull ? 1 : 0);

      // 4. Calculate signal and check stability
      string currentSignal = "NONE";
      if(bullishCount >= m_requiredThreshold && bearishCount < m_requiredThreshold)
         currentSignal = "BUY";
      else if(bearishCount >= m_requiredThreshold && bullishCount < m_requiredThreshold)
         currentSignal = "SELL";

      if(currentSignal != m_lastSignal)
      {
         m_lastSignal = currentSignal;
         m_signalStartTime = TimeCurrent();
      }

      bool isStable = false;
      if(currentSignal != "NONE" && m_signalStartTime > 0)
      {
         if(TimeCurrent() - m_signalStartTime >= 5) // Stable for 5 seconds
         {
            isStable = true;
         }
      }

      // 5. Open trade if stable and idle
      if(m_account.GetOpenOrdersCount() > 0) return;

      if(isStable)
      {
         double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
         int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
         if(digits == 3 || digits == 5) point = point * 10.0;

         if(currentSignal == "BUY")
         {
            double sl = ask - (300 * point); // $3 target
            double tp = ask + (300 * point);
            m_account.OpenOrder(POSITION_TYPE_BUY, 0.05, sl, tp, "MI_BUY");
         }
         else if(currentSignal == "SELL")
         {
            double sl = bid + (300 * point); // $3 target
            double tp = bid - (300 * point);
            m_account.OpenOrder(POSITION_TYPE_SELL, 0.05, sl, tp, "MI_SELL");
         }
      }
   }
};

#endif
