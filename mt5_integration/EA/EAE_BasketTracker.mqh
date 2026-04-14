//+------------------------------------------------------------------+
//| EAE_BasketTracker.mqh                                            |
//| EA Easy basket lifecycle tracker                                 |
//+------------------------------------------------------------------+
#ifndef __EAE_BASKET_TRACKER_MQH__
#define __EAE_BASKET_TRACKER_MQH__

#include "EAE_MonitorTypes.mqh"

// Update summary from one close record
void EAE_TrackerApplyCloseRecord(const EAE_BasketCloseRecord &rec,
                                 EAE_BasketStatsSummary &sum)
{
   sum.total_cycles++;
   if(rec.close_reason == EAE_CLOSE_FORCED)
      sum.total_forced_cycles++;

   sum.last_duration_sec = rec.duration_sec;
   if(sum.min_duration_sec == 0 || rec.duration_sec < sum.min_duration_sec)
      sum.min_duration_sec = rec.duration_sec;
   if(rec.duration_sec > sum.max_duration_sec)
      sum.max_duration_sec = rec.duration_sec;
   sum.sum_duration_sec += rec.duration_sec;
   sum.avg_duration_sec = (double)sum.sum_duration_sec / (double)sum.total_cycles;

   sum.last_closed_count = rec.closed_count;
   if(sum.min_closed_count == 0 || rec.closed_count < sum.min_closed_count)
      sum.min_closed_count = rec.closed_count;
   if(rec.closed_count > sum.max_closed_count)
      sum.max_closed_count = rec.closed_count;
   sum.sum_closed_count += rec.closed_count;
   sum.avg_closed_count = (double)sum.sum_closed_count / (double)sum.total_cycles;

   sum.last_closed_lots = rec.closed_lots;
   if(sum.min_closed_lots == 0.0 || rec.closed_lots < sum.min_closed_lots)
      sum.min_closed_lots = rec.closed_lots;
   if(rec.closed_lots > sum.max_closed_lots)
      sum.max_closed_lots = rec.closed_lots;
   sum.sum_closed_lots += rec.closed_lots;
   sum.avg_closed_lots = sum.sum_closed_lots / (double)sum.total_cycles;

   sum.total_closed_orders += rec.closed_count;
   sum.total_closed_lots   += rec.closed_lots;
   sum.total_realized_pnl  += rec.realized_pnl;
   sum.last_close_time      = rec.end_time;
}

// Track one side and detect basket start/end
bool EAE_TrackerUpdateSide(EAE_SideRuntimeState   &state,
                           EAE_BasketStatsSummary &summary,
                           const EAE_AccountSnapshot &acc,
                           const EAE_SymbolMeta      &meta,
                           const string symbol,
                           const long   magic,
                           const int    close_reason_hint,
                           EAE_BasketCloseRecord &out_record,
                           bool &out_has_close_record)
{
   out_has_close_record = false;

   // Basket started
   if(state.prev_open_count <= 0 && state.open_count > 0)
   {
      state.basket_active     = true;
      state.basket_cycle_id++;
      state.basket_start_time = (state.oldest_open_time > 0 ? state.oldest_open_time : TimeCurrent());

      state.peak_open_count      = state.open_count;
      state.peak_open_lots       = state.open_lots;
      state.peak_floating_profit = MathMax(0.0, state.floating_pnl);
      state.peak_floating_loss   = MathMin(0.0, state.floating_pnl);
   }

   // Basket active, update peaks
   if(state.open_count > 0)
   {
      if(state.open_count > state.peak_open_count)
         state.peak_open_count = state.open_count;

      if(state.open_lots > state.peak_open_lots)
         state.peak_open_lots = state.open_lots;

      if(state.floating_pnl > state.peak_floating_profit)
         state.peak_floating_profit = state.floating_pnl;

      if(state.floating_pnl < state.peak_floating_loss)
         state.peak_floating_loss = state.floating_pnl;
   }

   // Basket ended
   if(state.prev_open_count > 0 && state.open_count == 0)
   {
      out_record.cycle_id              = state.basket_cycle_id;
      out_record.side                  = state.side;
      out_record.symbol                = symbol;
      out_record.magic                 = magic;
      out_record.start_time            = state.basket_start_time;
      out_record.end_time              = TimeCurrent();
      out_record.duration_sec          = (int)(out_record.end_time - state.basket_start_time);
      out_record.close_reason          = close_reason_hint;
      out_record.closed_count          = state.prev_open_count;
      out_record.closed_lots           = state.peak_open_lots;     // placeholder for first version
      out_record.realized_pnl          = 0.0;                      // placeholder for first version
      out_record.max_open_count_cycle  = state.peak_open_count;
      out_record.max_open_lots_cycle   = state.peak_open_lots;
      out_record.max_floating_profit   = state.peak_floating_profit;
      out_record.max_floating_loss     = state.peak_floating_loss;
      out_record.balance_after_close   = acc.balance;
      out_record.equity_after_close    = acc.equity;
      out_record.spread_at_close       = meta.spread_points;

      EAE_TrackerApplyCloseRecord(out_record, summary);
      out_has_close_record = true;

      // Reset current basket state
      state.basket_active        = false;
      state.basket_start_time    = 0;
      state.oldest_open_time     = 0;
      state.current_age_sec      = 0;
      state.peak_open_count      = 0;
      state.peak_open_lots       = 0.0;
      state.peak_floating_profit = 0.0;
      state.peak_floating_loss   = 0.0;
   }

   state.prev_open_count = state.open_count;
   return true;
}

#endif // __EAE_BASKET_TRACKER_MQH__