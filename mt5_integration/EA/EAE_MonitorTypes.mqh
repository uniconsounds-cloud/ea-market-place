//+------------------------------------------------------------------+
//| EAE_MonitorTypes.mqh                                             |
//| EA Easy monitoring shared data types                             |
//+------------------------------------------------------------------+
#ifndef __EAE_MONITOR_TYPES_MQH__
#define __EAE_MONITOR_TYPES_MQH__

enum EAE_AssetClass
{
   EAE_ASSET_UNKNOWN = 0,
   EAE_ASSET_METAL   = 1,
   EAE_ASSET_FOREX   = 2,
   EAE_ASSET_CRYPTO  = 3,
   EAE_ASSET_INDEX   = 4,
   EAE_ASSET_CFD     = 5
};

enum EAE_Side
{
   EAE_SIDE_BUY  = 1,
   EAE_SIDE_SELL = -1
};

enum EAE_CloseReason
{
   EAE_CLOSE_UNKNOWN = 0,
   EAE_CLOSE_NORMAL  = 1,
   EAE_CLOSE_FORCED  = 2,
   EAE_CLOSE_MANUAL  = 3
};

enum EAE_RuntimeStatus
{
   EAE_RT_IDLE   = 0,
   EAE_RT_ACTIVE = 1,
   EAE_RT_PAUSED = 2
};

struct EAE_SystemIdentity
{
   string brand_name;
   string site_name;
   string product_family;
   string family_code;
   string strategy_name;
   string system_code;
   int    asset_class;

   string ea_name;
   string ea_version;

   string symbol;
   long   chart_id;
   long   magic_buy;
   long   magic_sell;
};

struct EAE_AccountSnapshot
{
   datetime timestamp;
   long     account_login;
   string   account_name;
   string   server_name;
   double   balance;
   double   equity;
   double   margin;
   double   free_margin;
   double   margin_level;
   string   currency;
};

struct EAE_SymbolMeta
{
   string symbol;
   int    digits;
   double point;
   double tick_size;
   double tick_value;
   double contract_size;
   double volume_min;
   double volume_max;
   double volume_step;
   double bid;
   double ask;
   double spread_points;
   string profit_currency;
   string margin_currency;
};

struct EAE_SideRuntimeState
{
   int      side;
   bool     basket_active;
   long     basket_cycle_id;
   datetime basket_start_time;
   datetime oldest_open_time;
   int      current_age_sec;

   int      open_count;
   double   open_lots;
   double   floating_pnl;

   int      peak_open_count;
   double   peak_open_lots;
   double   peak_floating_profit;
   double   peak_floating_loss;

   int      prev_open_count;
   datetime last_update_time;
};

struct EAE_BasketCloseRecord
{
   long     cycle_id;
   int      side;
   string   symbol;
   long     magic;

   datetime start_time;
   datetime end_time;
   int      duration_sec;
   int      close_reason;

   int      closed_count;
   double   closed_lots;
   double   realized_pnl;

   int      max_open_count_cycle;
   double   max_open_lots_cycle;
   double   max_floating_profit;
   double   max_floating_loss;

   double   balance_after_close;
   double   equity_after_close;
   double   spread_at_close;
};

struct EAE_BasketStatsSummary
{
   int      side;

   int      total_cycles;
   int      total_forced_cycles;

   int      last_duration_sec;
   int      min_duration_sec;
   int      max_duration_sec;
   long     sum_duration_sec;
   double   avg_duration_sec;

   int      last_closed_count;
   int      min_closed_count;
   int      max_closed_count;
   long     sum_closed_count;
   double   avg_closed_count;

   double   last_closed_lots;
   double   min_closed_lots;
   double   max_closed_lots;
   double   sum_closed_lots;
   double   avg_closed_lots;

   long     total_closed_orders;
   double   total_closed_lots;
   double   total_realized_pnl;
   datetime last_close_time;
};

struct EAE_RealtimeSnapshot
{
   EAE_SystemIdentity     identity;
   EAE_AccountSnapshot    account;
   EAE_SymbolMeta         symbol_meta;
   EAE_SideRuntimeState   buy_state;
   EAE_SideRuntimeState   sell_state;
   EAE_BasketStatsSummary buy_summary;
   EAE_BasketStatsSummary sell_summary;
   datetime               timestamp;
};

//------------------------------
// Init helpers
//------------------------------
void EAE_InitSideState(EAE_SideRuntimeState &state, const int side)
{
   state.side                 = side;
   state.basket_active        = false;
   state.basket_cycle_id      = 0;
   state.basket_start_time    = 0;
   state.oldest_open_time     = 0;
   state.current_age_sec      = 0;
   state.open_count           = 0;
   state.open_lots            = 0.0;
   state.floating_pnl         = 0.0;
   state.peak_open_count      = 0;
   state.peak_open_lots       = 0.0;
   state.peak_floating_profit = 0.0;
   state.peak_floating_loss   = 0.0;
   state.prev_open_count      = 0;
   state.last_update_time     = 0;
}

void EAE_InitStatsSummary(EAE_BasketStatsSummary &sum, const int side)
{
   sum.side               = side;
   sum.total_cycles       = 0;
   sum.total_forced_cycles= 0;

   sum.last_duration_sec  = 0;
   sum.min_duration_sec   = 0;
   sum.max_duration_sec   = 0;
   sum.sum_duration_sec   = 0;
   sum.avg_duration_sec   = 0.0;

   sum.last_closed_count  = 0;
   sum.min_closed_count   = 0;
   sum.max_closed_count   = 0;
   sum.sum_closed_count   = 0;
   sum.avg_closed_count   = 0.0;

   sum.last_closed_lots   = 0.0;
   sum.min_closed_lots    = 0.0;
   sum.max_closed_lots    = 0.0;
   sum.sum_closed_lots    = 0.0;
   sum.avg_closed_lots    = 0.0;

   sum.total_closed_orders= 0;
   sum.total_closed_lots  = 0.0;
   sum.total_realized_pnl = 0.0;
   sum.last_close_time    = 0;
}

string EAE_SideToString(const int side)
{
   return (side == EAE_SIDE_BUY ? "BUY" : "SELL");
}

string EAE_SecondsToHMS(const int sec)
{
   int s = MathMax(sec, 0);
   int h = s / 3600;
   int m = (s % 3600) / 60;
   int x = s % 60;
   return StringFormat("%02d:%02d:%02d", h, m, x);
}

#endif // __EAE_MONITOR_TYPES_MQH__