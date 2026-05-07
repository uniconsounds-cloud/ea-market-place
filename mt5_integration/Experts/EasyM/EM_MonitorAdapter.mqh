//+------------------------------------------------------------------+
//| EM_MonitorAdapter.mqh                                            |
//| EasyM Multi-Currency Monitoring Adapter                          |
//+------------------------------------------------------------------+
#ifndef __EM_MONITOR_ADAPTER_MQH__
#define __EM_MONITOR_ADAPTER_MQH__

#include "../EAE_MonitorTypes.mqh"
#include "../EAE_CollectorCore.mqh"
#include "../EAE_BasketTracker.mqh"
#include "../EAE_WebSync.mqh" 
#include <EAEZE_Licensing.mqh> // For InpPartnerApiKey

//-------------------------------------------------------------------
// Adapter state
//-------------------------------------------------------------------
EAE_SystemIdentity     g_em_identity;
EAE_AccountSnapshot    g_em_account;
EAE_SymbolMeta         g_em_symbol_meta;

EAE_SideRuntimeState   g_em_buy_state;
EAE_SideRuntimeState   g_em_sell_state;

bool                   g_em_initialized = false;
bool                   g_em_data_loaded = false; 

// We will initialize magic base during EM_BuildIdentity
long g_em_magic_base = 0;

// Build identity once
void EM_BuildIdentity(EAE_SystemIdentity &id, long magicBase)
{
   g_em_magic_base = magicBase;
   id.brand_name     = "EA Easy Shop Marketplace";
   id.site_name      = "eaeze.com";
   id.product_family = "EasyM";
   
   // Check which EA is running based on the EA_PRODUCT_ID macro
   if(StringFind(InpProductID, "MAX") >= 0) {
       id.system_code = "EasyM MAX";
       id.ea_name     = "EasyM MAX";
   } else {
       id.system_code = "EasyM mini";
       id.ea_name     = "EasyM mini";
   }

   id.family_code    = "EM";
   id.strategy_name  = "Multi-Currency";
   id.product_family = EAE_AutoDetectAssetType(_Symbol);

   id.ea_version     = "V1";

   id.symbol         = "MULTI"; // Multi-currency
   id.chart_id       = ChartID();
   id.magic_buy      = g_em_magic_base;
   id.magic_sell     = g_em_magic_base;
}

// Custom Collector for Multi-Currency EasyM
void EM_CollectRuntimeState()
{
   // Reset states
   EAE_InitSideState(g_em_buy_state, EAE_SIDE_BUY);
   EAE_InitSideState(g_em_sell_state, EAE_SIDE_SELL);
   
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket)) continue;

      long pos_magic = PositionGetInteger(POSITION_MAGIC);
      // Only count orders belonging to EasyM (magic >= base and magic < base + 100)
      if(pos_magic < g_em_magic_base || pos_magic >= g_em_magic_base + 100) continue;

      long pos_type = PositionGetInteger(POSITION_TYPE);
      double vol = PositionGetDouble(POSITION_VOLUME);
      // Removed POSITION_COMMISSION to fix deprecation warning
      double pnl = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);

      if(pos_type == POSITION_TYPE_BUY) {
         g_em_buy_state.open_count++;
         g_em_buy_state.open_lots += vol;
         g_em_buy_state.floating_pnl += pnl;
      } else if(pos_type == POSITION_TYPE_SELL) {
         g_em_sell_state.open_count++;
         g_em_sell_state.open_lots += vol;
         g_em_sell_state.floating_pnl += pnl;
      }
   }
}

// Init monitoring module
void EM_MonitorInit(long magicBase)
{
   EM_BuildIdentity(g_em_identity, magicBase);
   EAE_InitSideState(g_em_buy_state,  EAE_SIDE_BUY);
   EAE_InitSideState(g_em_sell_state, EAE_SIDE_SELL);

   EAE_WebSyncInit("https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data", InpPartnerApiKey, 20);
   
   g_em_initialized = true;
   g_em_data_loaded = false; 
}

void EM_MonitorDeinit()
{
   g_em_initialized = false;
}

// Timer update
void EM_MonitorOnTimer()
{
   if(!g_em_initialized) return;

   // Lazy load account state
   if(!g_em_data_loaded) {
      EAE_CollectAccountSnapshot(g_em_account);
      g_em_data_loaded = true;
   }

   // Update account & custom multi-currency state
   EAE_CollectAccountSnapshot(g_em_account);
   EM_CollectRuntimeState();

   // Build Snapshot
   EAE_RealtimeSnapshot snap;
   snap.identity     = g_em_identity;
   snap.account      = g_em_account;
   snap.symbol_meta  = g_em_symbol_meta;
   snap.buy_state    = g_em_buy_state;
   snap.sell_state   = g_em_sell_state;
   snap.timestamp    = TimeCurrent();
   
   // --- [NEW] Self-Healing 30-Day Sync Check ---
   EAE_WebSyncCheckAndPushHistory(g_em_magic_base, g_em_magic_base);
   
   // Sync to web
   EAE_WebSyncPerform(snap);
}

#endif // __EM_MONITOR_ADAPTER_MQH__
