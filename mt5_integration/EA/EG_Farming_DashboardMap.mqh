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
   string lic_status  = (G_IsLicenseVerified ? "" : "[VERIFYING...] ");
   string sync_status = (g_eae_sync_status == "IDLE" ? "" : "[" + g_eae_sync_status + "] ");
   
   string fri_status = "";
   if(g_friState == EZ_STATE_FRI_MANAGE)      fri_status = "[FRI: MANAGE] ";
   else if(g_friState == EZ_STATE_FRI_SOFT)   fri_status = "[FRI: SOFT CLOSE] ";
   else if(g_friState == EZ_STATE_FRI_FORCE)  fri_status = "[FRI: FORCE CLOSE] ";
   else if(g_friState == EZ_STATE_WEEKEND_PAUSE)  fri_status = "[FRI: PAUSED] ";
   else if(g_friState == EZ_STATE_EARLYDAY_PAUSE) fri_status = "[ECL: PAUSED] ";

   if(g_friRescueBlocked) fri_status += "[FRI: GROWTH STOP] ";

   // --- [NEW] Breaker / Cooldown Status (High Priority) ---
   string brk_status = "";
   if(g_breakerRescueBlocked) brk_status = "[BREAKER: RESCUE STOP] ";
   
   datetime now = TimeCurrent();
   if(now < g_globalCooldownUntil)
   {
      int remain = (int)(g_globalCooldownUntil - now);
      brk_status = StringFormat("[COOLDOWN: %02d:%02d] ", remain/60, remain%60);
   }

   // --- [NEW] Market Gate / Risk Alert (High Priority) ---
   string gate_alert = "";
   if(g_marketGateBlocked) gate_alert = "[GATE: STOP] ";
   
   string risk_alert = "";
   if(g_eae_buy_state.abrg_risk_score >= 2) risk_alert += StringFormat("[RISK-B: %d] ", g_eae_buy_state.abrg_risk_score);
   if(g_eae_sell_state.abrg_risk_score >= 2) risk_alert += StringFormat("[RISK-S: %d] ", g_eae_sell_state.abrg_risk_score);

   return "EASYGOLD Farming V" + EA_VERSION + " " + lic_status + sync_status + brk_status + gate_alert + risk_alert + fri_status;
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

string EG_Farming_GetDashboardGateStatus()
{
   return g_marketGateStatus;
}

#endif // __EG_FARMING_DASHBOARD_MAP_MQH__