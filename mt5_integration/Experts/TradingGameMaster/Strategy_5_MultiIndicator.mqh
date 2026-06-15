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
   
   string m_lastSignal;
   datetime m_signalStartTime;
   string m_indicatorStates;
   bool m_isSideway;

   bool CheckSidewayState()
   {
      double ema9_vals[30];
      double ema21_vals[30];
      
      // Copy from index 1 (previous completed bars) to avoid live tick fluctuations
      if(CopyBuffer(m_hEma9, 0, 1, 30, ema9_vals) < 30) return false;
      if(CopyBuffer(m_hEma21, 0, 1, 30, ema21_vals) < 30) return false;
      
      // 1. Count EMA crosses in the last 30 bars
      int crossCount = 0;
      bool lastState = (ema9_vals[0] > ema21_vals[0]);
      for(int i = 1; i < 30; i++)
      {
         bool currentState = (ema9_vals[i] > ema21_vals[i]);
         if(currentState != lastState)
         {
            crossCount++;
            lastState = currentState;
         }
      }
      
      if(crossCount >= 3) return true;
      
      // 2. Check the average distance between EMA9 and EMA21 over the last 15 bars
      double totalDist = 0.0;
      for(int i = 15; i < 30; i++)
      {
         totalDist += MathAbs(ema9_vals[i] - ema21_vals[i]);
      }
      double avgDist = totalDist / 15.0;
      
      double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      if(digits == 3 || digits == 5) point = point * 10.0;
      
      double minDistancePoints = 80.0; // 80 points (0.80 USD on Gold)
      if(avgDist < minDistancePoints * point) return true;
      
      return false;
   }

public:
   CStrategy5_MultiIndicator() : m_webSync(NULL), m_requiredThreshold(3), m_lastSignal("NONE"), m_signalStartTime(0), m_indicatorStates("0,0,0,0,0"), m_isSideway(false) {}
   
   bool IsSideway() const
   {
      return m_isSideway;
   }
   
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
   
   void SetRequiredThreshold(int threshold)
   {
      m_requiredThreshold = threshold;
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
      // 1. Threshold config is pre-set via SetRequiredThreshold()

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

      m_isSideway = CheckSidewayState();

      // 4. Calculate signal based on EMA trend direction and required threshold
      string currentSignal = "NONE";
      if(ema_bull)
      {
         if(bullishCount >= m_requiredThreshold)
            currentSignal = "BUY";
      }
      else
      {
         if(bearishCount >= m_requiredThreshold)
            currentSignal = "SELL";
      }

      if(currentSignal != m_lastSignal)
      {
         m_lastSignal = currentSignal;
         m_signalStartTime = TimeCurrent();
      }

      bool isStable = false;
      if(currentSignal != "NONE" && m_signalStartTime > 0)
      {
         if(TimeCurrent() - m_signalStartTime >= 20) // Stable for 20 seconds or more
         {
            isStable = true;
         }
      }

      // 5. Open trade if stable and idle
      if(m_account.GetOpenOrdersCount() > 0) return;

      if(isStable)
      {
         if(m_isSideway) return; // Block trade entry in sideway market
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
