//+------------------------------------------------------------------+
//| EAE_CollectorCore.mqh                                            |
//| EA Easy monitoring collectors                                    |
//+------------------------------------------------------------------+
#ifndef __EAE_COLLECTOR_CORE_MQH__
#define __EAE_COLLECTOR_CORE_MQH__

#include <Trade/PositionInfo.mqh>
#include "EAE_MonitorTypes.mqh"

// Read current account snapshot
bool EAE_CollectAccountSnapshot(EAE_AccountSnapshot &out_acc)
{
   out_acc.timestamp     = TimeCurrent();
   out_acc.account_login = (long)AccountInfoInteger(ACCOUNT_LOGIN);
   out_acc.account_name  = AccountInfoString(ACCOUNT_NAME);
   out_acc.server_name   = AccountInfoString(ACCOUNT_SERVER);
   out_acc.balance       = AccountInfoDouble(ACCOUNT_BALANCE);
   out_acc.equity        = AccountInfoDouble(ACCOUNT_EQUITY);
   out_acc.margin        = AccountInfoDouble(ACCOUNT_MARGIN);
   out_acc.free_margin   = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   out_acc.margin_level  = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   out_acc.currency      = AccountInfoString(ACCOUNT_CURRENCY);
   return true;
}

// Read current symbol specification and live prices
bool EAE_CollectSymbolMeta(const string symbol, EAE_SymbolMeta &out_meta)
{
   out_meta.symbol          = symbol;
   out_meta.digits          = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   out_meta.point           = SymbolInfoDouble(symbol, SYMBOL_POINT);
   out_meta.tick_size       = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   out_meta.tick_value      = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   out_meta.contract_size   = SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   out_meta.volume_min      = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   out_meta.volume_max      = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   out_meta.volume_step     = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   out_meta.bid             = SymbolInfoDouble(symbol, SYMBOL_BID);
   out_meta.ask             = SymbolInfoDouble(symbol, SYMBOL_ASK);
   out_meta.spread_points   = (out_meta.ask - out_meta.bid) / out_meta.point;
   out_meta.profit_currency = SymbolInfoString(symbol, SYMBOL_CURRENCY_PROFIT);
   out_meta.margin_currency = SymbolInfoString(symbol, SYMBOL_CURRENCY_MARGIN);
   return true;
}

// Read oldest open time for one side/magic/symbol
datetime EAE_GetOldestOpenTime(const string symbol, const long magic, const int side)
{
   datetime oldest = 0;
   int total = PositionsTotal();

   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;

      if(!PositionSelectByTicket(ticket))
         continue;

      string pos_symbol = PositionGetString(POSITION_SYMBOL);
      long   pos_magic  = PositionGetInteger(POSITION_MAGIC);
      long   pos_type   = PositionGetInteger(POSITION_TYPE);

      if(pos_symbol != symbol)
         continue;
      if(pos_magic != magic)
         continue;

      if(side == EAE_SIDE_BUY && pos_type != POSITION_TYPE_BUY)
         continue;
      if(side == EAE_SIDE_SELL && pos_type != POSITION_TYPE_SELL)
         continue;

      datetime open_time = (datetime)PositionGetInteger(POSITION_TIME);
      if(oldest == 0 || open_time < oldest)
         oldest = open_time;
   }

   return oldest;
}

// Read open count, lots, pnl and basket age for one side
bool EAE_CollectSideRuntimeState(const string symbol,
                                 const long magic,
                                 const int side,
                                 EAE_SideRuntimeState &io_state)
{
   int      count      = 0;
   int      rescue_cnt = 0;
   int      follow_cnt = 0;
   double   lots       = 0.0;
   double   floating   = 0.0;
   double   sum_weighted_px = 0.0;
   datetime oldest     = 0;
   int      total      = PositionsTotal();

   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;

      if(!PositionSelectByTicket(ticket))
         continue;

      string pos_symbol = PositionGetString(POSITION_SYMBOL);
      long   pos_magic  = PositionGetInteger(POSITION_MAGIC);
      long   pos_type   = PositionGetInteger(POSITION_TYPE);

      if(pos_symbol != symbol)
         continue;
         
      // [V1.500] Multi-Cluster Magic Range Check
      // Accepts base magic AND any dynamically generated local cluster magic (offset by 2s)
      bool isValidMagic = false;
      if(pos_magic >= magic && pos_magic <= magic + 30) // Buffer of 30 covers ~15 chunks
      {
         if((pos_magic - magic) % 2 == 0)
            isValidMagic = true;
      }
      
      if(!isValidMagic)
         continue;

      if(side == EAE_SIDE_BUY && pos_type != POSITION_TYPE_BUY)
         continue;
      if(side == EAE_SIDE_SELL && pos_type != POSITION_TYPE_SELL)
         continue;

      count++;
      
      // Parse comment to distinguish Follow vs Rescue
      string comment = PositionGetString(POSITION_COMMENT);
      if(StringFind(comment, "FOL") >= 0)
         follow_cnt++;
      else
         rescue_cnt++;

      double pos_lots = PositionGetDouble(POSITION_VOLUME);
      lots     += pos_lots;
      floating += PositionGetDouble(POSITION_PROFIT);
      
      sum_weighted_px += (pos_lots * PositionGetDouble(POSITION_PRICE_OPEN));

      datetime open_time = (datetime)PositionGetInteger(POSITION_TIME);
      if(oldest == 0 || open_time < oldest)
         oldest = open_time;
   }

   io_state.open_count       = count;
   io_state.rescue_count     = rescue_cnt;
   io_state.follow_count     = follow_cnt;
   io_state.open_lots        = lots;
   io_state.floating_pnl     = floating;
   io_state.oldest_open_time = oldest;
   io_state.be_price         = (lots > 0 ? sum_weighted_px / lots : 0.0);
   io_state.basket_active    = (count > 0);
   io_state.current_age_sec  = (oldest > 0 ? (int)(TimeCurrent() - oldest) : 0);
   io_state.last_update_time = TimeCurrent();

   return true;
}

#endif // __EAE_COLLECTOR_CORE_MQH__