//+------------------------------------------------------------------+
//| EG_Farming_MonitorAdapter.mqh                                    |
//| EasyGold Farming monitoring adapter                              |
//+------------------------------------------------------------------+
#ifndef __EG_FARMING_MONITOR_ADAPTER_MQH__
#define __EG_FARMING_MONITOR_ADAPTER_MQH__

#include "EAE_MonitorTypes.mqh"
#include "EAE_CollectorCore.mqh"
#include "EAE_BasketTracker.mqh"
#include "EAE_DashboardBase.mqh"
#include "EAE_WebSync.mqh" // Unified web synchronization module

//-------------------------------------------------------------------
// External values from EA main file
// Map these names to your real EA variables later
//-------------------------------------------------------------------
// extern long   InpMagicBuy;
// extern long   InpMagicSell;

//-------------------------------------------------------------------
// Adapter state
//-------------------------------------------------------------------
EAE_SystemIdentity     g_eae_identity;
EAE_AccountSnapshot    g_eae_account;
EAE_SymbolMeta         g_eae_symbol_meta;

EAE_SideRuntimeState   g_eae_buy_state;
EAE_SideRuntimeState   g_eae_sell_state;

EAE_BasketStatsSummary g_eae_buy_summary;
EAE_BasketStatsSummary g_eae_sell_summary;

EAE_BasketCloseRecord  g_eae_last_close_buy;
EAE_BasketCloseRecord  g_eae_last_close_sell;

bool                   g_eae_has_last_buy  = false;
bool                   g_eae_has_last_sell = false;

string                 g_eae_dashboard_prefix = "EGF0410";
bool                   g_eae_initialized = false;

datetime g_eae_last_snapshot_log_time = 0;
string   g_eae_snapshot_file_name     = "EG_Farming_Snapshot_Live.csv";
string   g_eae_close_file_name        = "EG_Farming_BasketClose.csv";
string   g_eae_summary_state_file_name= "EG_Farming_SummaryState.csv";

   long EG_Farming_GetBuyMagic()
   {
      return (long)InpMagicStart + 1;
   }
   
   long EG_Farming_GetSellMagic()
   {
      return (long)InpMagicStart + 2;
   }

// Build identity once
void EG_Farming_BuildIdentity(EAE_SystemIdentity &id)
{
   id.brand_name     = "EA Easy Shop Marketplace";
   id.site_name      = "eaeze.com";
   id.product_family = "EasyGold";
   id.family_code    = "EG";
   id.strategy_name  = "Farming";
   id.system_code    = "EG_FARMING";
   id.asset_class    = EAE_ASSET_METAL;

   id.ea_name        = "EasyGold_Farming_0410_V1";
   id.ea_version     = "V1";

   id.symbol         = _Symbol;
   id.chart_id       = ChartID();
   id.magic_buy      = EG_Farming_GetBuyMagic();
   id.magic_sell     = EG_Farming_GetSellMagic();
}

// Build one full realtime snapshot
bool EG_Farming_BuildRealtimeSnapshot(EAE_RealtimeSnapshot &out_snap)
{
   out_snap.identity     = g_eae_identity;
   out_snap.account      = g_eae_account;
   out_snap.symbol_meta  = g_eae_symbol_meta;
   out_snap.buy_state    = g_eae_buy_state;
   out_snap.sell_state   = g_eae_sell_state;
   out_snap.buy_summary  = g_eae_buy_summary;
   out_snap.sell_summary = g_eae_sell_summary;
   out_snap.timestamp    = TimeCurrent();
   return true;
}

// Init monitoring module
void EG_Farming_MonitorInit(string api_key)
{
   EG_Farming_BuildIdentity(g_eae_identity);

   EAE_InitSideState(g_eae_buy_state,  EAE_SIDE_BUY);
   EAE_InitSideState(g_eae_sell_state, EAE_SIDE_SELL);

   EAE_InitStatsSummary(g_eae_buy_summary,  EAE_SIDE_BUY);
   EAE_InitStatsSummary(g_eae_sell_summary, EAE_SIDE_SELL);

   // Load persisted summary state if available
   EAE_LoadSummaryStateCsv(g_eae_summary_state_file_name,
                           g_eae_buy_summary,
                           g_eae_sell_summary);

   EAE_CollectAccountSnapshot(g_eae_account);
   EAE_CollectSymbolMeta(_Symbol, g_eae_symbol_meta);

   EAE_DashboardInit(ChartID(), g_eae_dashboard_prefix);

   // Initialize WebSync with the Partner API Key (Default sync interval 30s)
   EAE_WebSyncInit("https://eaeze.com/api/mt5/sync", api_key, 30);

   g_eae_initialized = true;
}

// Cleanup monitoring module
void EG_Farming_MonitorDeinit()
{
   EAE_SaveSummaryStateCsv(g_eae_summary_state_file_name,
                           g_eae_identity,
                           g_eae_buy_summary,
                           g_eae_sell_summary);

   EAE_DashboardDeinit(ChartID(), g_eae_dashboard_prefix);
   g_eae_initialized = false;
}

// Lightweight update on tick
void EG_Farming_MonitorOnTick()
{
   if(!g_eae_initialized)
      return;

   // Read latest runtime states
   EAE_CollectSideRuntimeState(_Symbol, EG_Farming_GetBuyMagic(),  EAE_SIDE_BUY,  g_eae_buy_state);
   EAE_CollectSideRuntimeState(_Symbol, EG_Farming_GetSellMagic(), EAE_SIDE_SELL, g_eae_sell_state);

   // Use current account/meta for close record enrichment
   EAE_CollectAccountSnapshot(g_eae_account);
   EAE_CollectSymbolMeta(_Symbol, g_eae_symbol_meta);

   // Track BUY
   bool has_close_buy = false;
   EAE_BasketCloseRecord rec_buy;
   EAE_TrackerUpdateSide(g_eae_buy_state,
                         g_eae_buy_summary,
                         g_eae_account,
                         g_eae_symbol_meta,
                         _Symbol,
                         EG_Farming_GetBuyMagic(),
                         EAE_CLOSE_UNKNOWN,
                         rec_buy,
                         has_close_buy);

   if(has_close_buy)
   {
      g_eae_last_close_buy = rec_buy;
      g_eae_has_last_buy   = true;
   
      EAE_SaveSummaryStateCsv(g_eae_summary_state_file_name,
                              g_eae_identity,
                              g_eae_buy_summary,
                              g_eae_sell_summary);
                              
      // Real-time Event: Trigger immediate sync to web dashboard on basket closure
      EAE_WebSyncTriggerEvent("BATCH_CLOSE", rec_buy.closed_count, rec_buy.closed_lots, rec_buy.realized_pnl);
   }

   // Track SELL
   bool has_close_sell = false;
   EAE_BasketCloseRecord rec_sell;
   EAE_TrackerUpdateSide(g_eae_sell_state,
                         g_eae_sell_summary,
                         g_eae_account,
                         g_eae_symbol_meta,
                         _Symbol,
                         EG_Farming_GetSellMagic(),
                         EAE_CLOSE_UNKNOWN,
                         rec_sell,
                         has_close_sell);

   if(has_close_sell)
   {
      g_eae_last_close_sell = rec_sell;
      g_eae_has_last_sell   = true;
   
      EAE_SaveSummaryStateCsv(g_eae_summary_state_file_name,
                              g_eae_identity,
                              g_eae_buy_summary,
                              g_eae_sell_summary);
                              
      // Real-time Event: Trigger immediate sync to web dashboard on basket closure
      EAE_WebSyncTriggerEvent("BATCH_CLOSE", rec_sell.closed_count, rec_sell.closed_lots, rec_sell.realized_pnl);
   }
   
}

// Timer update for dashboard and future file/api outputs
void EG_Farming_MonitorOnTimer()
{
   if(!g_eae_initialized)
      return;

   EAE_CollectAccountSnapshot(g_eae_account);
   EAE_CollectSymbolMeta(_Symbol, g_eae_symbol_meta);

   EAE_RealtimeSnapshot snap;
   if(EG_Farming_BuildRealtimeSnapshot(snap))
   {
      EAE_DashboardRender(snap);

      if(g_eae_last_snapshot_log_time == 0 || (TimeCurrent() - g_eae_last_snapshot_log_time) >= 5)
      {
         g_eae_last_snapshot_log_time = TimeCurrent();
      }
      
      // Perform Periodic Web Sync (Throttled based on EAE_WebSync settings)
      // This sends both Summary metrics (Spaceship) and Active Orders (Farm UI)
      EAE_WebSyncPerform(snap);
   }
}

#endif // __EG_FARMING_MONITOR_ADAPTER_MQH__