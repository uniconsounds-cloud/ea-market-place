//+------------------------------------------------------------------+
//| EG_Farming_DashboardMap.mqh                                      |
//| EasyGold Farming dashboard mapping                               |
//| Modified for V1.01 display-only changes                          |
//+------------------------------------------------------------------+
#ifndef __EG_FARMING_DASHBOARD_MAP_MQH__
#define __EG_FARMING_DASHBOARD_MAP_MQH__

#include "EAE_MonitorTypes.mqh"

string EG_Farming_GetDashboardTitle()
{
   return "EASYGOLD Farming V.1";
}

int EG_Farming_GetBasketColumnCount()
{
   // V1.01: added Profit column to monitor summary.
   return 9;
}

string EG_Farming_GetBasketColumnName(const int col)
{
   switch(col)
   {
      case 0: return "Side";
      case 1: return "Open";
      case 2: return "Profit";
      case 3: return "Age";
      case 4: return "LastCnt";
      case 5: return "LastDur";
      case 6: return "MaxDur";
      case 7: return "Total";
      case 8: return "Forced";
   }
   return "";
}

string EG_Farming_GetBasketCellValue(const int row_side,
                                     const int col,
                                     const EAE_RealtimeSnapshot &snap)
{
   EAE_SideRuntimeState   st;
   EAE_BasketStatsSummary su;

   if(row_side == EAE_SIDE_BUY)
   {
      st = snap.buy_state;
      su = snap.buy_summary;
   }
   else
   {
      st = snap.sell_state;
      su = snap.sell_summary;
   }

   switch(col)
   {
      case 0: return EAE_SideToString(row_side);
      case 1: return IntegerToString(st.open_count);
      case 2: return DoubleToString(st.floating_pnl, 2);
      case 3: return EAE_SecondsToHMS(st.current_age_sec);
      case 4: return IntegerToString(su.last_closed_count);
      case 5: return EAE_SecondsToHMS(su.last_duration_sec);
      case 6: return EAE_SecondsToHMS(su.max_duration_sec);
      case 7: return IntegerToString(su.total_cycles);
      case 8: return IntegerToString(su.total_forced_cycles);
   }

   return "";
}

#endif // __EG_FARMING_DASHBOARD_MAP_MQH__