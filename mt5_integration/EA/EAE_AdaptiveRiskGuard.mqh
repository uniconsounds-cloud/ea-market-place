//+------------------------------------------------------------------+
//| EAE_AdaptiveRiskGuard.mqh                                        |
//| Multi-stage Basket Protection & Tiered Gridding                  |
//+------------------------------------------------------------------+
#ifndef __EAE_ADAPTIVE_RISK_GUARD_MQH__
#define __EAE_ADAPTIVE_RISK_GUARD_MQH__

#include "EAE_MonitorTypes.mqh"

//------------------------------------------------------------------
// ABRG Configuration (Shared from main EA)
// No extern declarations here to avoid "already defined" errors
//------------------------------------------------------------------

//------------------------------------------------------------------
// Core Logic
//------------------------------------------------------------------

// Calculate danger score (0-5) for a specific side
int ABRG_CalculateScore(EAE_SideRuntimeState &state)
{
   if(state.rescue_count == 0) return 0;
   int score = 0;

   // 1. Density Score
   if(state.rescue_count >= 25) score += 1;
   if(state.rescue_count >= 35) score += 1;

   // 2. Order Speed (MT5 History Scan for last 10m)
   // We count how many deals with this side's magic happened in last 600s
   int speedCount = 0;
   if(HistorySelect(TimeCurrent() - 600, TimeCurrent()))
   {
      int total = HistoryDealsTotal();
      long myMagic = (state.side == EAE_SIDE_BUY ? (long)InpMagicStart+1 : (long)InpMagicStart+2);
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(HistoryDealGetInteger(ticket, DEAL_MAGIC) == myMagic)
         {
            long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
            if(entry == DEAL_ENTRY_IN || entry == DEAL_ENTRY_INOUT) speedCount++;
         }
      }
   }
   if(speedCount >= 8) score += 1;

   // 3. Price Velocity (M5 Check)
   double m5Open = iOpen(_Symbol, PERIOD_M5, 0);
   double vVal = (m5Open > 0 ? MathAbs(SymbolInfoDouble(_Symbol, SYMBOL_BID) - m5Open) / _Point : 0.0);
   if(vVal >= 1200) score += 1;

   // 4. BE Distance (Stress)
   double dist = (state.be_price > 0 ? MathAbs(SymbolInfoDouble(_Symbol, SYMBOL_BID) - state.be_price) / _Point : 0.0);
   if(dist >= 1500) score += 1;
   
   return (score > 5 ? 5 : score);
}

// Monitor state and handle Hibernation / Soft Exit
void ABRG_MonitorSide(EAE_SideRuntimeState &state)
{
   if(!InpEnableABRG) {
      state.abrg_risk_score = 0;
      state.abrg_is_hibernating = false;
      return;
   }
   
   double bePrice = state.be_price;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double price = (state.side == EAE_SIDE_BUY ? bid : ask);

   // Update Score
   state.abrg_risk_score = ABRG_CalculateScore(state);

   // --- [NEW] Auto-Reset Logic (V1.408) ---
   // 1. If basket is empty, always reset ABRG state
   if(state.rescue_count == 0)
   {
      state.abrg_is_hibernating = false;
      state.abrg_frozen_price   = 0.0;
      state.abrg_cluster_count  = 0;
      return;
   }

   // 2. If Score drops to very safe level (<= 1) and count is below limit, 
   // we can exit hibernation automatically.
   if(state.abrg_is_hibernating)
   {
      if(state.abrg_risk_score <= 1 && state.rescue_count < InpABRG_FreezeCount)
      {
         state.abrg_is_hibernating = false;
         PrintFormat("ABRG [%s]: EXITED HIBERNATION (Market Stabilized)", EAE_SideToString(state.side));
      }
   }

   // --- Hibernation Logic ---
   // Trigger Rule: Hard Count (30) OR Extreme Crisis (Score 3+)
   if(!state.abrg_is_hibernating)
   {
      if(state.rescue_count >= InpABRG_FreezeCount || state.abrg_risk_score >= 3)
      {
         state.abrg_is_hibernating = true;
         state.abrg_frozen_price   = price;
         state.abrg_cluster_count  = 0;
         PrintFormat("ABRG [%s]: ENTER HIBERNATION at RescueCount=%d Score=%d Price=%f", 
                     EAE_SideToString(state.side), state.rescue_count, state.abrg_risk_score, price);
      }
   }
   else
   {
      // Check if Gap is reached to allow a new cluster
      double gap = MathAbs(price - state.abrg_frozen_price) / _Point;
      if(gap >= InpABRG_GapPoints)
      {
         // We don't turn off hibernating, we just keep it true but allow 
         // the permission check to pass for N orders.
         // Or reset if price returns significantly?
         // For now: The "Gap" simply resets the reference point for the next cluster.
      }
   }

   // --- Soft Exit Logic ---
   // If in CRISIS and price nears BE, set a flag or just return true for exit.
   if(state.abrg_risk_score >= 3 && bePrice > 0)
   {
      double dist = MathAbs(price - bePrice) / _Point;
      if(dist <= InpABRG_BE_ExitBuffer)
      {
         // In the main EA, we will use this to trigger a close all at $0.
      }
   }
}

// --- [NEW] V1.500: Multi-Cluster Dynamic Magic Number Allocation ---
// Calculates which Magic Number a new order should get based on its index.
// It ensures:
// 1. First cluster (1-30) gets BaseMagic.
// 2. Middle clusters (31-50, 51-70...) get BaseMagic + (chunkIndex * 2).
// 3. Final cluster (the remainder up to MaxOrderLoss) gets BaseMagic again (Merged).
int ABRG_GetClusterMagicNumber(const int rescue_count, const int base_magic, const int max_order_loss)
{
   // 1. If we haven't reached the first cluster limit, use base magic (Global)
   if(rescue_count < InpABRG_FreezeCount)
      return base_magic;
      
   // 2. Calculate remaining orders allowed
   int remaining_total = max_order_loss - InpABRG_FreezeCount;
   if(remaining_total <= 0) return base_magic; // Safety
   
   // 3. Calculate which chunk we are currently in (0-indexed after FreezeCount)
   int order_over_freeze = rescue_count - InpABRG_FreezeCount;
   int current_chunk_idx = order_over_freeze / InpABRG_ClusterSize;
   
   // 4. Calculate total number of full chunks possible
   int total_chunks = remaining_total / InpABRG_ClusterSize;
   
   // 5. If we are in the FINAL possible chunk (or beyond), it MUST be the Global Anchor
   if(current_chunk_idx >= total_chunks)
      return base_magic;
      
   // 6. Otherwise, it is an independent middle cluster! 
   // Offset by 2 for each chunk to avoid colliding Buy/Sell (Buy=Odd, Sell=Even)
   // Chunk 0 => +2, Chunk 1 => +4, etc.
   int magic_offset = (current_chunk_idx + 1) * 2;
   return base_magic + magic_offset;
}

// Permission check: Returns true if trading is allowed
bool ABRG_IsAllowed(EAE_SideRuntimeState &state)
{
   if(!InpEnableABRG) return true;
   if(state.open_count == 0) return true; // Initial entry always allowed

   if(state.abrg_is_hibernating)
   {
      double price = (state.side == EAE_SIDE_BUY ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK));
      double gap = MathAbs(price - state.abrg_frozen_price) / _Point;

      // If we haven't reached the gap yet, blocking.
      if(gap < InpABRG_GapPoints) return false;

      // If we reached the gap but already used up the cluster, blocking.
      // (Cluster tracking happens in the main EA upon successful trade)
      if(state.abrg_cluster_count >= InpABRG_ClusterSize) return false;
   }

   return true;
}

#endif // __EAE_ADAPTIVE_RISK_GUARD_MQH__
