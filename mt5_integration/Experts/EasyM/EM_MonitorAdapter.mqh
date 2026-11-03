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

   // Direct-to-Supabase RPC primary endpoint (Dev ports 97053088 & 21692434 route to eaeze.com for two-way web control)
   if(login == 97053088 || login == 21692434)
   {
      EAE_WebSyncInit("https://eaeze.com/api/sync-dashboard", 5);
      g_eae_supabase_sync_url = "https://eaeze.com/api/sync-dashboard";
      g_eae_supabase_history_url = "https://eaeze.com/api/sync-dashboard";
      Print("EAE WebSync: [DEV PORT " + IntegerToString(login) + "] Two-Way Remote Command Channel Active via eaeze.com");
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

   // Reconstruct today's harvest events directly from MT5 deals history
   EM_ReconstructTodayHarvestFromDeals(magicBase);

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

// Helper to extract JSON value without external dependencies
string EM_ExtractJsonStringValue(const string json, const string key)
{
   int keyPos = StringFind(json, "\"" + key + "\":");
   if(keyPos < 0) return "";
   int start = keyPos + StringLen("\"" + key + "\":");
   while(start < StringLen(json) && (json[start] == ' ' || json[start] == '\"')) start++;
   int end = start;
   while(end < StringLen(json) && json[end] != '\"' && json[end] != ',' && json[end] != '}') end++;
   if(end > start)
   {
      string val = StringSubstr(json, start, end - start);
      StringTrimLeft(val);
      StringTrimRight(val);
      return val;
   }
   return "";
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
      item.event_id     = EM_ExtractJsonStringValue(objStr, "event_id");
      item.symbol       = EM_ExtractJsonStringValue(objStr, "symbol");
      item.side         = EM_ExtractJsonStringValue(objStr, "side");
      item.exit_type    = EM_ExtractJsonStringValue(objStr, "exit_type");
      item.orders       = (int)StringToInteger(EM_ExtractJsonStringValue(objStr, "orders"));
      item.lots         = StringToDouble(EM_ExtractJsonStringValue(objStr, "lots"));
      item.profit       = StringToDouble(EM_ExtractJsonStringValue(objStr, "profit"));
      item.duration_sec = (int)StringToInteger(EM_ExtractJsonStringValue(objStr, "duration_sec"));
      item.max_dd       = StringToDouble(EM_ExtractJsonStringValue(objStr, "max_dd"));
      item.closed_at    = (datetime)StringToInteger(EM_ExtractJsonStringValue(objStr, "closed_at"));

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

   int startIdx = 0;
   if(count > 60) startIdx = count - 60; // Cap at newest 60 events for fast network telemetry

   string json = "[";
   bool first = true;
   for(int i = startIdx; i < count; i++)
   {
      if(!first) json += ",";
      first = false;
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

// Global state for non-EA manual trades telemetry
double g_em_manual_profit = 0.0;
double g_em_manual_lots   = 0.0;
int    g_em_manual_orders = 0;

// Day Rollover check: prunes events older than 7 days instead of wiping
void EM_CheckHarvestDayRollover()
{
   datetime now = TimeCurrent();
   datetime current_day = (now / 86400) * 86400;
   static datetime last_harvest_day = 0;
   
   if(last_harvest_day == 0)
   {
      last_harvest_day = current_day;
      return;
   }
   
   if(current_day != last_harvest_day)
   {
      last_harvest_day = current_day;
      g_em_manual_profit = 0.0;
      g_em_manual_lots   = 0.0;
      g_em_manual_orders = 0;

      // Prune events older than 7 days to retain weekly harvest history across days
      datetime cutoff = now - 7 * 86400;
      EAE_HarvestEventItem tempQueue[];
      int keepCount = 0;
      int curSz = ArraySize(g_em_harvest_queue);
      for(int i = 0; i < curSz; i++)
      {
         if(g_em_harvest_queue[i].closed_at >= cutoff)
         {
            ArrayResize(tempQueue, keepCount + 1);
            tempQueue[keepCount] = g_em_harvest_queue[i];
            keepCount++;
         }
      }
      ArrayResize(g_em_harvest_queue, keepCount);
      for(int i = 0; i < keepCount; i++)
         g_em_harvest_queue[i] = tempQueue[i];

      EM_SaveHarvestQueueToDisk();
   }
}

struct EAE_TempDealItem
{
   ulong    ticket;
   datetime time;
   string   symbol;
   long     deal_type;
   double   lots;
   double   profit;
   string   comment;
   long     magic;
   bool     is_manual;
};

//+------------------------------------------------------------------+
//| Reconstruct Today's Basket Closures from MT5 History Deals       |
//| Ensures 100% resilient recovery after restart / power loss        |
//+------------------------------------------------------------------+
void EM_ReconstructTodayHarvestFromDeals(long magicBase)
{
   datetime now = TimeCurrent();
   MqlDateTime dt;
   TimeToStruct(now, dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   datetime startOfDay = StructToTime(dt);
   datetime scanStart = startOfDay - 7 * 86400; // Retain past 7 trading days of harvest history

   if(!HistorySelect(scanStart, now)) return;

   int totalDeals = HistoryDealsTotal();
   if(totalDeals == 0) return;

   // Pre-fetch all deal tickets into an array to prevent loop corruption
   ulong dealTickets[];
   ArrayResize(dealTickets, totalDeals);
   for(int k = 0; k < totalDeals; k++)
      dealTickets[k] = HistoryDealGetTicket(k);

   EAE_TempDealItem closedDeals[];
   int closedCount = 0;

   g_em_manual_profit = 0.0;
   g_em_manual_lots   = 0.0;
   g_em_manual_orders = 0;

   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = dealTickets[i];
      if(ticket <= 0) continue;
      if(!HistoryDealSelect(ticket)) continue;

      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT) continue;

      long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      string comment = HistoryDealGetString(ticket, DEAL_COMMENT);
      ENUM_DEAL_REASON deal_reason = (ENUM_DEAL_REASON)HistoryDealGetInteger(ticket, DEAL_REASON);

      bool is_our_deal = (magicBase <= 0) ||
                         EAE_IsPortfolioMagic(magic, magicBase) ||
                         (magic >= 2000 && magic < 5000) ||
                         (StringFind(comment, "EMP:") >= 0) ||
                         (StringFind(comment, "EasyM") >= 0) ||
                         (StringFind(comment, "RescueCut") >= 0);

      datetime dealTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      long dealType     = HistoryDealGetInteger(ticket, DEAL_TYPE);
      double dealProfit = HistoryDealGetDouble(ticket, DEAL_PROFIT) + HistoryDealGetDouble(ticket, DEAL_COMMISSION) + HistoryDealGetDouble(ticket, DEAL_SWAP);
      double dealLots   = HistoryDealGetDouble(ticket, DEAL_VOLUME);

      if(!is_our_deal)
      {
         // Accumulate manual non-EA trades ONLY if closed TODAY and are buy/sell deals
         if(dealTime >= startOfDay && (dealType == DEAL_TYPE_BUY || dealType == DEAL_TYPE_SELL))
         {
            g_em_manual_profit += dealProfit;
            g_em_manual_lots   += dealLots;
            g_em_manual_orders++;
         }
         continue;
      }

      ArrayResize(closedDeals, closedCount + 1);
      closedDeals[closedCount].ticket    = ticket;
      closedDeals[closedCount].time      = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      closedDeals[closedCount].symbol    = HistoryDealGetString(ticket, DEAL_SYMBOL);
      closedDeals[closedCount].deal_type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      closedDeals[closedCount].lots      = dealLots;
      closedDeals[closedCount].profit    = dealProfit;
      closedDeals[closedCount].comment   = comment;
      closedDeals[closedCount].magic     = magic;
      closedDeals[closedCount].is_manual = (deal_reason == DEAL_REASON_CLIENT || deal_reason == DEAL_REASON_MOBILE || deal_reason == DEAL_REASON_WEB);
      closedCount++;
   }

   if(closedCount == 0) return;

   // Reconstruct fresh today's harvest queue directly from actual closed deals
   ArrayResize(g_em_harvest_queue, 0);

   // Group closed deals into Baskets by (symbol + time window <= 3 seconds)
   bool processed[];
   ArrayResize(processed, closedCount);
   ArrayInitialize(processed, false);

   long login = AccountInfoInteger(ACCOUNT_LOGIN);

   for(int i = 0; i < closedCount; i++)
   {
      if(processed[i]) continue;

      string sym = closedDeals[i].symbol;
      datetime baseTime = closedDeals[i].time;
      long baseDealType = closedDeals[i].deal_type;
      string side = (baseDealType == DEAL_TYPE_SELL ? "BUY" : "SELL"); // Exit deal type is opposite of position side

      int basketOrders = 0;
      double basketLots = 0.0;
      double basketProfit = 0.0;
      string exitComment = closedDeals[i].comment;
      bool isManualExit = false;

      for(int j = i; j < closedCount; j++)
      {
         if(!processed[j] && closedDeals[j].symbol == sym && MathAbs((long)closedDeals[j].time - (long)baseTime) <= 3)
         {
            processed[j] = true;
            basketOrders++;
            basketLots += closedDeals[j].lots;
            basketProfit += closedDeals[j].profit;
            if(StringLen(closedDeals[j].comment) > 0) exitComment = closedDeals[j].comment;
            if(closedDeals[j].is_manual) isManualExit = true;
         }
      }

      // Determine exit_type from deal comment & closure reason
      string exitType = "FULL_BASKET_TP";
      if(isManualExit)
         exitType = "MANUAL_CLOSE_EA";
      else if(StringFind(exitComment, "T1_OUT") >= 0 || StringFind(exitComment, "T1") >= 0)
         exitType = "RESCUE_T1_SCALP_TP";
      else if(StringFind(exitComment, "T2_OUT") >= 0 || StringFind(exitComment, "T2") >= 0)
         exitType = "RESCUE_T2_SCALP_TP";
      else if(StringFind(exitComment, "T3_OUT") >= 0 || StringFind(exitComment, "T3") >= 0)
         exitType = "RESCUE_ALL_SCALP_TP";
      else if(StringFind(exitComment, "CUT") >= 0 || StringFind(exitComment, "TRIM") >= 0)
         exitType = "RELIEF_TRIM";
      else if(StringFind(exitComment, "QUAR") >= 0)
         exitType = "QUARANTINE_FULL_EXIT";

      int profitCents = (int)MathRound(basketProfit * 100.0);
      string event_id = StringFormat("%I64d_%s_%I64d_%d_%d", login, sym, (long)baseTime, basketOrders, profitCents);

      int qSz = ArraySize(g_em_harvest_queue);
      ArrayResize(g_em_harvest_queue, qSz + 1);

      g_em_harvest_queue[qSz].event_id     = event_id;
      g_em_harvest_queue[qSz].symbol       = sym;
      g_em_harvest_queue[qSz].side         = side;
      g_em_harvest_queue[qSz].exit_type    = exitType;
      g_em_harvest_queue[qSz].orders       = basketOrders;
      g_em_harvest_queue[qSz].lots         = basketLots;
      g_em_harvest_queue[qSz].profit       = basketProfit;
      g_em_harvest_queue[qSz].duration_sec = 0;
      g_em_harvest_queue[qSz].max_dd       = 0.0;
      g_em_harvest_queue[qSz].closed_at    = baseTime;

      // Update g_em_last_basket_json with the latest basket
      g_em_last_basket_json = StringFormat("{\"event_id\":\"%s\",\"symbol\":\"%s\",\"side\":\"%s\",\"exit_type\":\"%s\",\"orders\":%d,\"lots\":%.2f,\"profit\":%.2f,\"duration_sec\":%d,\"max_dd\":%.2f,\"closed_at\":%I64d}",
                                           event_id, sym, side, exitType, basketOrders, basketLots, basketProfit, 0, 0.0, (long)baseTime);
   }

   EM_SaveHarvestQueueToDisk();
}

// Prune acknowledged events after successful sync (Kept for legacy compatibility, but rollover handles reset)
void EM_ClearHarvestQueue()
{
   EM_CheckHarvestDayRollover();
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

   // Embed non-EA manual trades telemetry if recorded today
   if(g_em_manual_orders > 0 || MathAbs(g_em_manual_profit) > 0.001)
   {
      string manualEmbed = StringFormat("\"manual_trades\":{\"profit\":%.2f,\"lots\":%.2f,\"orders\":%d}", g_em_manual_profit, g_em_manual_lots, g_em_manual_orders);
      if(StringLen(telemetryEmbed) > 0)
         telemetryEmbed += "," + manualEmbed;
      else
         telemetryEmbed = manualEmbed;
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
   // Retain harvest events for the entire trading day (cleared only upon date rollover)
   EM_CheckHarvestDayRollover();
}

#endif // __EM_MONITOR_ADAPTER_MQH__
