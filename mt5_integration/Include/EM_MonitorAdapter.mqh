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
   
   // Check which EA is running based on EA_SYSTEM_CODE or EA_PRODUCT_ID macro
#ifdef EA_SYSTEM_CODE
   id.system_code = EA_SYSTEM_CODE;
   id.ea_name     = EA_SYSTEM_CODE;
#else
   if(StringFind(EA_PRODUCT_ID, "PRIME") >= 0 || StringFind(EA_PRODUCT_ID, "Prime") >= 0) {
       id.system_code = "EasyM Prime";
       id.ea_name     = "EasyM Prime";
   } else if(StringFind(EA_PRODUCT_ID, "FARM") >= 0 || StringFind(EA_PRODUCT_ID, "Farm") >= 0) {
       id.system_code = "EasyM Farm";
       id.ea_name     = "EasyM Farm";
   } else if(StringFind(EA_PRODUCT_ID, "MIN") >= 0 || StringFind(EA_PRODUCT_ID, "mini") >= 0) {
       id.system_code = "EasyM mini";
       id.ea_name     = "EasyM mini";
   } else if(StringFind(EA_PRODUCT_ID, "MAX") >= 0 || StringFind(EA_PRODUCT_ID, "Max") >= 0) {
       id.system_code = "EasyM Max";
       id.ea_name     = "EasyM Max";
   } else {
       id.system_code = "EasyM";
       id.ea_name     = "EasyM";
   }
#endif

   id.family_code    = "EM";
   id.strategy_name  = "Multi-Currency";
   id.product_family = EAE_AutoDetectAssetType(_Symbol);

#ifdef EA_VERSION_STR
   #ifdef EA_BUILD_ID
      id.ea_version     = EA_VERSION_STR + " [" + EA_BUILD_ID + "]";
   #else
      id.ea_version     = EA_VERSION_STR;
   #endif
#else
   #ifdef EA_VERSION
      id.ea_version  = EA_VERSION;
   #else
      id.ea_version  = "v1.16";
   #endif
#endif

   id.symbol         = "MULTI"; // Multi-currency
   id.chart_id       = ChartID();
   id.magic_buy      = g_em_magic_base;
   id.magic_sell     = g_em_magic_base;
}

// Custom Collector for Multi-Currency EasyM (includes Regular 2000+, Hedge 3000+, and Rescue 4000+)
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
      if(!EAE_IsPortfolioMagic(pos_magic, g_em_magic_base)) continue;

      long pos_type = PositionGetInteger(POSITION_TYPE);
      double vol = PositionGetDouble(POSITION_VOLUME);
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
   // mini and Farm only verify license, no live farm UI streaming needed to save resources
#ifdef EA_PRODUCT_ID
   if(StringFind(EA_PRODUCT_ID, "MIN") >= 0 || StringFind(EA_PRODUCT_ID, "FARM") >= 0)
   {
      g_em_initialized = false;
      return;
   }
#endif

   EM_BuildIdentity(g_em_identity, magicBase);
   EAE_InitSideState(g_em_buy_state,  EAE_SIDE_BUY);
   EAE_InitSideState(g_em_sell_state, EAE_SIDE_SELL);

   long login = AccountInfoInteger(ACCOUNT_LOGIN);

   // Direct-to-Supabase RPC primary endpoint (Dev port 97053088 routes to eaeze.com for two-way web control)
   if(login == 97053088)
   {
      EAE_WebSyncInit("https://eaeze.com/api/sync-dashboard", 5);
      g_eae_supabase_sync_url = "https://eaeze.com/api/sync-dashboard";
      g_eae_supabase_history_url = "https://eaeze.com/api/sync-dashboard";
      Print("EAE WebSync: [DEV PORT 97053088] Two-Way Remote Command Channel Active via eaeze.com");
   }
   else
   {
      EAE_WebSyncInit("https://mfrspvzxmpksqnzcrysz.supabase.co/rest/v1/rpc/sync_ea_data", 20);
   }
   
   // Set a Global Variable to signal that Universal EA monitor is active (prevents duplicate sync loop)
   string gvName = "EAE_Universal_Active_" + IntegerToString(login);
   GlobalVariableSet(gvName, (double)TimeCurrent());
   
   // Load any unsent basket closures from disk cache (resilience against power failure / VPS crash)
   EM_LoadHarvestQueueFromDisk();

   g_em_initialized = true;
   g_em_data_loaded = false; 
}

void EM_MonitorDeinit()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string gvName = "EAE_Universal_Active_" + IntegerToString(login);
   if(GlobalVariableCheck(gvName)) GlobalVariableDel(gvName);
   g_em_initialized = false;
}

//+------------------------------------------------------------------+
//| EAE Resilient Harvest Queue & Anti-Duplicate Telemetry System    |
//+------------------------------------------------------------------+
struct EAE_HarvestEventItem
{
   string   event_id;
   string   symbol;
   string   side;
   string   exit_type;
   int      orders;
   double   lots;
   double   profit;
   int      duration_sec;
   double   max_dd;
   datetime closed_at;
};

EAE_HarvestEventItem g_em_harvest_queue[];
string g_em_last_basket_json = "";

// Save queue to local disk file (MQL5/Files/EAE_HarvestQueue_<login>.json)
void EM_SaveHarvestQueueToDisk()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string filename = StringFormat("EAE_HarvestQueue_%I64d.json", login);
   int h = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE) return;

   string json = "[";
   int count = ArraySize(g_em_harvest_queue);
   for(int i = 0; i < count; i++)
   {
      if(i > 0) json += ",";
      json += StringFormat("{\"event_id\":\"%s\",\"symbol\":\"%s\",\"side\":\"%s\",\"exit_type\":\"%s\",\"orders\":%d,\"lots\":%.2f,\"profit\":%.2f,\"duration_sec\":%d,\"max_dd\":%.2f,\"closed_at\":%I64d}",
                           g_em_harvest_queue[i].event_id,
                           g_em_harvest_queue[i].symbol,
                           g_em_harvest_queue[i].side,
                           g_em_harvest_queue[i].exit_type,
                           g_em_harvest_queue[i].orders,
                           g_em_harvest_queue[i].lots,
                           g_em_harvest_queue[i].profit,
                           g_em_harvest_queue[i].duration_sec,
                           g_em_harvest_queue[i].max_dd,
                           (long)g_em_harvest_queue[i].closed_at);
   }
   json += "]";
   FileWriteString(h, json);
   FileClose(h);
}

// Load queue from local disk file (Survives power outage / VPS restart)
void EM_LoadHarvestQueueFromDisk()
{
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string filename = StringFormat("EAE_HarvestQueue_%I64d.json", login);
   if(!FileIsExist(filename)) return;

   int h = FileOpen(filename, FILE_READ | FILE_TXT | FILE_ANSI);
   if(h == INVALID_HANDLE) return;

   string content = "";
   while(!FileIsEnding(h))
   {
      content += FileReadString(h);
   }
   FileClose(h);

   if(StringLen(content) < 5) return;

   int searchPos = 0;
   while(true)
   {
      int startObj = StringFind(content, "{\"event_id\":", searchPos);
      if(startObj < 0) break;
      int endObj = StringFind(content, "}", startObj);
      if(endObj < 0) break;

      string objStr = StringSubstr(content, startObj, endObj - startObj + 1);
      searchPos = endObj + 1;

      EAE_HarvestEventItem item;
      item.event_id     = WebControlExtractJsonString(objStr, "event_id");
      item.symbol       = WebControlExtractJsonString(objStr, "symbol");
      item.side         = WebControlExtractJsonString(objStr, "side");
      item.exit_type    = WebControlExtractJsonString(objStr, "exit_type");
      item.orders       = (int)StringToInteger(WebControlExtractJsonString(objStr, "orders"));
      item.lots         = StringToDouble(WebControlExtractJsonString(objStr, "lots"));
      item.profit       = StringToDouble(WebControlExtractJsonString(objStr, "profit"));
      item.duration_sec = (int)StringToInteger(WebControlExtractJsonString(objStr, "duration_sec"));
      item.max_dd       = StringToDouble(WebControlExtractJsonString(objStr, "max_dd"));
      item.closed_at    = (datetime)StringToInteger(WebControlExtractJsonString(objStr, "closed_at"));

      if(StringLen(item.event_id) > 0 && StringLen(item.symbol) > 0)
      {
         int sz = ArraySize(g_em_harvest_queue);
         ArrayResize(g_em_harvest_queue, sz + 1);
         g_em_harvest_queue[sz] = item;
      }
   }

   if(ArraySize(g_em_harvest_queue) > 0)
   {
      PrintFormat("EAE Harvest Telemetry: [RESILIENCE RECOVERY] Restored %d pending basket events from disk cache", ArraySize(g_em_harvest_queue));
   }
}

// Build serialized harvest_events JSON string for telemetry payload
string EM_BuildHarvestQueueJson()
{
   int count = ArraySize(g_em_harvest_queue);
   if(count == 0) return "[]";

   string json = "[";
   for(int i = 0; i < count; i++)
   {
      if(i > 0) json += ",";
      json += StringFormat("{\"event_id\":\"%s\",\"symbol\":\"%s\",\"side\":\"%s\",\"exit_type\":\"%s\",\"orders\":%d,\"lots\":%.2f,\"profit\":%.2f,\"duration_sec\":%d,\"max_dd\":%.2f,\"closed_at\":%I64d}",
                           g_em_harvest_queue[i].event_id,
                           g_em_harvest_queue[i].symbol,
                           g_em_harvest_queue[i].side,
                           g_em_harvest_queue[i].exit_type,
                           g_em_harvest_queue[i].orders,
                           g_em_harvest_queue[i].lots,
                           g_em_harvest_queue[i].profit,
                           g_em_harvest_queue[i].duration_sec,
                           g_em_harvest_queue[i].max_dd,
                           (long)g_em_harvest_queue[i].closed_at);
   }
   json += "]";
   return json;
}

// Prune acknowledged events after successful sync
void EM_ClearHarvestQueue()
{
   if(ArraySize(g_em_harvest_queue) > 0)
   {
      ArrayResize(g_em_harvest_queue, 0);
      EM_SaveHarvestQueueToDisk();
   }
}

//+------------------------------------------------------------------+
//| Trigger Basket Event Telemetry                                    |
//+------------------------------------------------------------------+
void EM_TriggerBasketEvent(string exit_type, string sym, string side, int total_orders, double total_lots, double total_profit, int duration_sec = 0, double max_dd_pct = 0.0)
{
   if(!g_em_initialized) return;

   datetime now = TimeCurrent();
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   int profitCents = (int)MathRound(total_profit * 100.0);
   string event_id = StringFormat("%I64d_%s_%I64d_%d_%d", login, sym, (long)now, total_orders, profitCents);

   // 1. Cache last basket summary for continuous heartbeat telemetry
   g_em_last_basket_json = StringFormat("{\"event_id\":\"%s\",\"symbol\":\"%s\",\"side\":\"%s\",\"exit_type\":\"%s\",\"orders\":%d,\"lots\":%.2f,\"profit\":%.2f,\"duration_sec\":%d,\"max_dd\":%.2f,\"closed_at\":%I64d}",
                                        event_id, sym, side, exit_type, total_orders, total_lots, total_profit, duration_sec, max_dd_pct, (long)now);

   // 2. Append to resilient disk-backed queue (up to 50 events)
   int sz = ArraySize(g_em_harvest_queue);
   if(sz >= 50)
   {
      for(int i = 0; i < sz - 1; i++) g_em_harvest_queue[i] = g_em_harvest_queue[i+1];
      ArrayResize(g_em_harvest_queue, sz);
      sz = sz - 1;
   }
   else
   {
      ArrayResize(g_em_harvest_queue, sz + 1);
   }

   g_em_harvest_queue[sz].event_id     = event_id;
   g_em_harvest_queue[sz].symbol       = sym;
   g_em_harvest_queue[sz].side         = side;
   g_em_harvest_queue[sz].exit_type    = exit_type;
   g_em_harvest_queue[sz].orders       = total_orders;
   g_em_harvest_queue[sz].lots         = total_lots;
   g_em_harvest_queue[sz].profit       = total_profit;
   g_em_harvest_queue[sz].duration_sec = duration_sec;
   g_em_harvest_queue[sz].max_dd       = max_dd_pct;
   g_em_harvest_queue[sz].closed_at    = now;

   // 3. Persist immediately to disk so power outage cannot erase it
   EM_SaveHarvestQueueToDisk();

   // 4. Send immediate event
   EAE_WebSyncTriggerBasketEvent(exit_type, sym, side, total_orders, total_lots, total_profit, duration_sec, max_dd_pct);
}

// Timer update
void EM_MonitorOnTimer(string extra_payload_json = "", bool force_now = false)
{
   if(!g_em_initialized) return;

   // Embed cached last basket closure and harvest queue into telemetry payload
   string harvestQueueJson = EM_BuildHarvestQueueJson();
   string telemetryEmbed = "";
   if(StringLen(g_em_last_basket_json) > 0 && ArraySize(g_em_harvest_queue) > 0)
   {
      telemetryEmbed = "\"last_basket\":" + g_em_last_basket_json + ",\"harvest_events\":" + harvestQueueJson;
   }
   else if(StringLen(g_em_last_basket_json) > 0)
   {
      telemetryEmbed = "\"last_basket\":" + g_em_last_basket_json;
   }
   else if(ArraySize(g_em_harvest_queue) > 0)
   {
      telemetryEmbed = "\"harvest_events\":" + harvestQueueJson;
   }

   if(StringLen(telemetryEmbed) > 0)
   {
      if(StringLen(extra_payload_json) == 0)
      {
         extra_payload_json = "{" + telemetryEmbed + "}";
      }
      else if(StringFind(extra_payload_json, "{") == 0)
      {
         extra_payload_json = "{" + telemetryEmbed + "," + StringSubstr(extra_payload_json, 1);
      }
   }

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
   
   // Self-Healing 14-30 Day Sync Check
   EAE_WebSyncCheckAndPushHistory(g_em_magic_base, g_em_magic_base);
   
   // Sync to Supabase RPC (with auto-fallback)
   bool syncOk = EAE_WebSyncPerform(snap, force_now, extra_payload_json);
   if(syncOk && ArraySize(g_em_harvest_queue) > 0)
   {
      EM_ClearHarvestQueue();
   }
}

#endif // __EM_MONITOR_ADAPTER_MQH__
