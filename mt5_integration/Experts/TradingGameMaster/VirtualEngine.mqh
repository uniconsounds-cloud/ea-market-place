//+------------------------------------------------------------------+
//| VirtualEngine.mqh                                                |
//| Core Paper Trading Engine for Trading Game Master                |
//+------------------------------------------------------------------+
#ifndef __VIRTUAL_ENGINE_MQH__
#define __VIRTUAL_ENGINE_MQH__

enum ENUM_VIRTUAL_ORDER_STATE
{
   V_ORDER_OPEN = 0,
   V_ORDER_CLOSED = 1
};

struct CVirtualOrder
{
   ulong    ticket;
   int      strategy_id;
   long     magic;
   ENUM_POSITION_TYPE type; // POSITION_TYPE_BUY or POSITION_TYPE_SELL
   double   volume;
   double   open_price;
   double   sl;
   double   tp;
   datetime open_time;
   
   ENUM_VIRTUAL_ORDER_STATE state;
   double   close_price;
   datetime close_time;
   double   profit;
   double   max_dd;
   bool     is_open;
   string   comment;
};

#include "GameMaster_WebSync.mqh"

class CVirtualAccount
{
private:
   double m_initial_balance;
   double m_balance;
   int    m_strategy_id;
   CGameMasterWebSync *m_webSync;
   
   CVirtualOrder m_orders[];
   int m_order_count;
   ulong m_ticket_counter;

public:
   CVirtualAccount() { m_order_count = 0; m_ticket_counter = 100000; m_webSync = NULL; }
   
   void Init(int strategyId, double startBalance, CGameMasterWebSync *sync)
   {
      m_strategy_id = strategyId;
      m_initial_balance = startBalance;
      m_balance = startBalance;
      m_webSync = sync;
      m_ticket_counter = strategyId * 100000;
   }
   
   int GetStrategyId() const { return m_strategy_id; }
   
   ulong OpenOrder(ENUM_POSITION_TYPE type, double vol, double sl, double tp, string comment)
   {
      int idx = m_order_count;
      ArrayResize(m_orders, idx + 1);
      
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      
      m_orders[idx].ticket = ++m_ticket_counter;
      m_orders[idx].strategy_id = m_strategy_id;
      m_orders[idx].type = type;
      m_orders[idx].volume = vol;
      m_orders[idx].open_price = (type == POSITION_TYPE_BUY) ? ask : bid;
      m_orders[idx].sl = sl;
      m_orders[idx].tp = tp;
      m_orders[idx].open_time = TimeCurrent();
      m_orders[idx].state = V_ORDER_OPEN;
      m_orders[idx].profit = 0;
      m_orders[idx].max_dd = 0;
      m_orders[idx].is_open = true;
      m_orders[idx].comment = comment;
      
      m_order_count++;
      
      string typeStr = (type == POSITION_TYPE_BUY ? "BUY" : "SELL");
      PrintFormat("[SimEngine %d] Opened %s %.2f at %.2f. SL: %.2f TP: %.2f", 
                  m_strategy_id, typeStr, vol, m_orders[idx].open_price, sl, tp);
                  
      if(m_webSync != NULL)
      {
         m_webSync.BroadcastRoundOpen(m_strategy_id, m_orders[idx].ticket, typeStr, vol, m_orders[idx].open_price, sl, tp);
         m_webSync.BroadcastSignal(m_strategy_id, "OPEN_" + typeStr, m_orders[idx].ticket, m_orders[idx].open_price, sl, tp);
      }
                  
      return m_orders[idx].ticket;
   }
   
   void ProcessTicks(double bid, double ask, double tickValue)
   {
      double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
      for(int i=0; i<m_order_count; i++)
      {
         if(m_orders[i].state == V_ORDER_CLOSED) continue;
         
         // Calculate Profit
         if(m_orders[i].type == POSITION_TYPE_BUY)
            m_orders[i].profit = (bid - m_orders[i].open_price) * m_orders[i].volume * tickValue / point;
         else
            m_orders[i].profit = (m_orders[i].open_price - ask) * m_orders[i].volume * tickValue / point;
            
         // Track Maximum Drawdown
         if(m_orders[i].profit < m_orders[i].max_dd)
            m_orders[i].max_dd = m_orders[i].profit;
         
         // Check SL / TP
         bool hitSL = false, hitTP = false;
         if(m_orders[i].type == POSITION_TYPE_BUY)
         {
            if(m_orders[i].sl > 0 && bid <= m_orders[i].sl) hitSL = true;
            if(m_orders[i].tp > 0 && bid >= m_orders[i].tp) hitTP = true;
         }
         else
         {
            if(m_orders[i].sl > 0 && ask >= m_orders[i].sl) hitSL = true;
            if(m_orders[i].tp > 0 && ask <= m_orders[i].tp) hitTP = true;
         }
         
         if(hitSL || hitTP)
         {
            double current_price = (m_orders[i].type == POSITION_TYPE_BUY) ? bid : ask;
            CloseOrder(i, current_price, hitSL ? "SL" : "TP");
         }
      }
   }
   
   void CloseOrder(int idx, double price, string reason)
   {
      if(m_orders[idx].state == V_ORDER_CLOSED) return;
      
      m_orders[idx].state = V_ORDER_CLOSED;
      m_orders[idx].close_price = price;
      m_orders[idx].close_time = TimeCurrent();
      
      m_balance += m_orders[idx].profit;
      PrintFormat("[SimEngine %d] Closed ticket %I64u at %.2f. Profit: %.2f. Reason: %s", 
                  m_strategy_id, m_orders[idx].ticket, price, m_orders[idx].profit, reason);
                  
      if(m_webSync != NULL)
      {
         m_webSync.BroadcastRoundClose(m_orders[idx].ticket, price, m_orders[idx].profit, m_orders[idx].max_dd);
         m_webSync.BroadcastSignal(m_strategy_id, "CLOSE", m_orders[idx].ticket, price, 0, 0);
         m_webSync.BroadcastStrategyStatus(m_strategy_id, m_balance, 0.0, 0);
      }
   }
   
   void CloseAllOrders()
   {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      for(int i=0; i<m_order_count; i++)
      {
         if(m_orders[i].state == V_ORDER_OPEN)
         {
            double current_price = (m_orders[i].type == POSITION_TYPE_BUY) ? bid : ask;
            CloseOrder(i, current_price, "FORCE_CLOSE");
         }
      }
   }
   
   int GetOpenOrdersCount()
   {
      int cnt = 0;
      for(int i=0; i<m_order_count; i++)
      {
         if(m_orders[i].state == V_ORDER_OPEN) cnt++;
      }
      return cnt;
   }
   
   double GetFloatingProfit()
   {
      double f = 0;
      for(int i=0; i<m_order_count; i++)
      {
         if(m_orders[i].state == V_ORDER_OPEN) f += m_orders[i].profit;
      }
      return f;
   }
   
   ulong GetActiveTicket()
   {
      for(int i=0; i<m_order_count; i++)
      {
         if(m_orders[i].state == V_ORDER_OPEN) return m_orders[i].ticket;
      }
      return 0;
   }
   
   double GetActiveMaxDD()
   {
      for(int i=0; i<m_order_count; i++)
      {
         if(m_orders[i].state == V_ORDER_OPEN) return m_orders[i].max_dd;
      }
      return 0.0;
   }
   
   double GetBalance() { return m_balance; }
   double GetEquity() { return m_balance + GetFloatingProfit(); }
};

#endif
