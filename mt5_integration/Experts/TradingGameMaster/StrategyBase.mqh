//+------------------------------------------------------------------+
//| StrategyBase.mqh                                                 |
//| Base class for virtual trading strategies                        |
//+------------------------------------------------------------------+
#ifndef __STRATEGY_BASE_MQH__
#define __STRATEGY_BASE_MQH__

#include "VirtualEngine.mqh"

enum ENUM_STRATEGY_VERSION
{
   VERSION_1_0_WINRATE = 0,   // V1.0 (Win Rate Focus - High SL, Low TP)
   VERSION_1_1_BALANCED = 1   // V1.1 (Balanced SL/TP - Current Default)
};

class CStrategyBase
{
protected:
   int m_strategy_id;
   CVirtualAccount *m_account;
   ENUM_STRATEGY_VERSION m_version;
   
   // Abstract method that each strategy must implement
   virtual void OnTickInternal() = 0;

public:
   CStrategyBase() : m_strategy_id(0), m_account(NULL), m_version(VERSION_1_1_BALANCED) {}
   virtual ~CStrategyBase() {}
   
   virtual void Init(int id, CVirtualAccount *acc, ENUM_STRATEGY_VERSION ver)
   {
      m_strategy_id = id;
      m_account = acc;
      m_version = ver;
   }
   
   void ProcessTick()
   {
      if(m_account == NULL) return;
      OnTickInternal();
   }
};

#endif
