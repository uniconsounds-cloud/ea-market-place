//+------------------------------------------------------------------+
//| StrategyBase.mqh                                                 |
//| Base class for virtual trading strategies                        |
//+------------------------------------------------------------------+
#ifndef __STRATEGY_BASE_MQH__
#define __STRATEGY_BASE_MQH__

#include "VirtualEngine.mqh"

class CStrategyBase
{
protected:
   int m_strategy_id;
   CVirtualAccount *m_account;
   
   // Abstract method that each strategy must implement
   virtual void OnTickInternal() = 0;

public:
   CStrategyBase() : m_strategy_id(0), m_account(NULL) {}
   virtual ~CStrategyBase() {}
   
   virtual void Init(int id, CVirtualAccount *acc)
   {
      m_strategy_id = id;
      m_account = acc;
   }
   
   void ProcessTick()
   {
      if(m_account == NULL) return;
      OnTickInternal();
   }
};

#endif
