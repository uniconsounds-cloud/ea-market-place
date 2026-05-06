//+------------------------------------------------------------------+
//| EAE_FileLogger.mqh                                               |
//| EA Easy monitoring file logger                                   |
//+------------------------------------------------------------------+
#ifndef __EAE_FILE_LOGGER_MQH__
#define __EAE_FILE_LOGGER_MQH__

#include "EAE_MonitorTypes.mqh"

// Write one line to CSV, create file if needed
bool EAE_AppendCsvLine(const string file_name, const string line)
{
   int handle = FileOpen(file_name,
                         FILE_READ | FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_SHARE_READ | FILE_SHARE_WRITE);

   if(handle == INVALID_HANDLE)
      return false;

   FileSeek(handle, 0, SEEK_END);
   FileWriteString(handle, line + "\r\n");
   FileClose(handle);
   return true;
}

// Check if file exists
bool EAE_FileExists(const string file_name)
{
   int handle = FileOpen(file_name, FILE_READ | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE)
      return false;

   FileClose(handle);
   return true;
}

// Write header if file does not exist yet
bool EAE_EnsureSnapshotHeader(const string file_name)
{
   if(EAE_FileExists(file_name))
      return true;

   string header =
      "timestamp,system_code,symbol,balance,equity,spread_points,"
      "buy_open_count,buy_open_lots,buy_floating_pnl,buy_age_sec,"
      "sell_open_count,sell_open_lots,sell_floating_pnl,sell_age_sec";
   return EAE_AppendCsvLine(file_name, header);
}

// Write header if file does not exist yet
bool EAE_EnsureCloseHeader(const string file_name)
{
   if(EAE_FileExists(file_name))
      return true;

   string header =
      "end_time,system_code,symbol,side,cycle_id,start_time,duration_sec,"
      "close_reason,closed_count,closed_lots,realized_pnl,max_open_count_cycle,max_open_lots_cycle";
   return EAE_AppendCsvLine(file_name, header);
}

// Write live snapshot file (overwrite with latest state only)
bool EAE_WriteSnapshotLiveCsv(const string file_name, const EAE_RealtimeSnapshot &snap)
{
   int handle = FileOpen(file_name,
                         FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_SHARE_READ | FILE_SHARE_WRITE);

   if(handle == INVALID_HANDLE)
      return false;

   string header =
      "timestamp,system_code,symbol,balance,equity,spread_points,"
      "buy_open_count,buy_open_lots,buy_floating_pnl,buy_age_sec,"
      "sell_open_count,sell_open_lots,sell_floating_pnl,sell_age_sec";

   string line = StringFormat(
      "%s,%s,%s,%.2f,%.2f,%.1f,%d,%.2f,%.2f,%d,%d,%.2f,%.2f,%d",
      TimeToString(snap.timestamp, TIME_DATE|TIME_SECONDS),
      snap.identity.system_code,
      snap.identity.symbol,
      snap.account.balance,
      snap.account.equity,
      snap.symbol_meta.spread_points,
      snap.buy_state.open_count,
      snap.buy_state.open_lots,
      snap.buy_state.floating_pnl,
      snap.buy_state.current_age_sec,
      snap.sell_state.open_count,
      snap.sell_state.open_lots,
      snap.sell_state.floating_pnl,
      snap.sell_state.current_age_sec
   );

   FileWriteString(handle, header + "\r\n");
   FileWriteString(handle, line + "\r\n");
   FileClose(handle);
   return true;
}

// Log realtime snapshot
bool EAE_LogSnapshotCsv(const string file_name, const EAE_RealtimeSnapshot &snap)
{
   if(!EAE_EnsureSnapshotHeader(file_name))
      return false;

   string line = StringFormat(
      "%s,%s,%s,%.2f,%.2f,%.1f,%d,%.2f,%.2f,%d,%d,%.2f,%.2f,%d",
      TimeToString(snap.timestamp, TIME_DATE|TIME_SECONDS),
      snap.identity.system_code,
      snap.identity.symbol,
      snap.account.balance,
      snap.account.equity,
      snap.symbol_meta.spread_points,
      snap.buy_state.open_count,
      snap.buy_state.open_lots,
      snap.buy_state.floating_pnl,
      snap.buy_state.current_age_sec,
      snap.sell_state.open_count,
      snap.sell_state.open_lots,
      snap.sell_state.floating_pnl,
      snap.sell_state.current_age_sec
   );

   return EAE_AppendCsvLine(file_name, line);
}

// Log basket close record
bool EAE_LogCloseRecordCsv(const string file_name,
                           const EAE_SystemIdentity &id,
                           const EAE_BasketCloseRecord &rec)
{
   if(!EAE_EnsureCloseHeader(file_name))
      return false;

   string line = StringFormat(
      "%s,%s,%s,%s,%I64d,%s,%d,%d,%d,%.2f,%.2f,%d,%.2f",
      TimeToString(rec.end_time, TIME_DATE|TIME_SECONDS),
      id.system_code,
      rec.symbol,
      EAE_SideToString(rec.side),
      rec.cycle_id,
      TimeToString(rec.start_time, TIME_DATE|TIME_SECONDS),
      rec.duration_sec,
      rec.close_reason,
      rec.closed_count,
      rec.closed_lots,
      rec.realized_pnl,
      rec.max_open_count_cycle,
      rec.max_open_lots_cycle
   );

   return EAE_AppendCsvLine(file_name, line);
}

// Save summary state to one small CSV file (overwrite)
bool EAE_SaveSummaryStateCsv(const string file_name,
                             const EAE_SystemIdentity &id,
                             const EAE_BasketStatsSummary &buy_sum,
                             const EAE_BasketStatsSummary &sell_sum)
{
   int handle = FileOpen(file_name,
                         FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_SHARE_READ | FILE_SHARE_WRITE);

   if(handle == INVALID_HANDLE)
      return false;

   string header =
      "system_code,symbol,side,total_cycles,total_forced_cycles,"
      "last_duration_sec,min_duration_sec,max_duration_sec,sum_duration_sec,avg_duration_sec,"
      "last_closed_count,min_closed_count,max_closed_count,sum_closed_count,avg_closed_count,"
      "last_closed_lots,min_closed_lots,max_closed_lots,sum_closed_lots,avg_closed_lots,"
      "total_closed_orders,total_closed_lots,total_realized_pnl,last_close_time";

   FileWriteString(handle, header + "\r\n");

   string buy_line = StringFormat(
      "%s,%s,BUY,%d,%d,%d,%d,%d,%I64d,%.6f,%d,%d,%d,%I64d,%.6f,%.6f,%.6f,%.6f,%.6f,%.6f,%I64d,%.6f,%.6f,%s",
      id.system_code,
      id.symbol,
      buy_sum.total_cycles,
      buy_sum.total_forced_cycles,
      buy_sum.last_duration_sec,
      buy_sum.min_duration_sec,
      buy_sum.max_duration_sec,
      buy_sum.sum_duration_sec,
      buy_sum.avg_duration_sec,
      buy_sum.last_closed_count,
      buy_sum.min_closed_count,
      buy_sum.max_closed_count,
      buy_sum.sum_closed_count,
      buy_sum.avg_closed_count,
      buy_sum.last_closed_lots,
      buy_sum.min_closed_lots,
      buy_sum.max_closed_lots,
      buy_sum.sum_closed_lots,
      buy_sum.avg_closed_lots,
      buy_sum.total_closed_orders,
      buy_sum.total_closed_lots,
      buy_sum.total_realized_pnl,
      TimeToString(buy_sum.last_close_time, TIME_DATE|TIME_SECONDS)
   );

   string sell_line = StringFormat(
      "%s,%s,SELL,%d,%d,%d,%d,%d,%I64d,%.6f,%d,%d,%d,%I64d,%.6f,%.6f,%.6f,%.6f,%.6f,%.6f,%I64d,%.6f,%.6f,%s",
      id.system_code,
      id.symbol,
      sell_sum.total_cycles,
      sell_sum.total_forced_cycles,
      sell_sum.last_duration_sec,
      sell_sum.min_duration_sec,
      sell_sum.max_duration_sec,
      sell_sum.sum_duration_sec,
      sell_sum.avg_duration_sec,
      sell_sum.last_closed_count,
      sell_sum.min_closed_count,
      sell_sum.max_closed_count,
      sell_sum.sum_closed_count,
      sell_sum.avg_closed_count,
      sell_sum.last_closed_lots,
      sell_sum.min_closed_lots,
      sell_sum.max_closed_lots,
      sell_sum.sum_closed_lots,
      sell_sum.avg_closed_lots,
      sell_sum.total_closed_orders,
      sell_sum.total_closed_lots,
      sell_sum.total_realized_pnl,
      TimeToString(sell_sum.last_close_time, TIME_DATE|TIME_SECONDS)
   );

   FileWriteString(handle, buy_line + "\r\n");
   FileWriteString(handle, sell_line + "\r\n");

   FileClose(handle);
   return true;
}

// Helper: parse one summary CSV row into struct
bool EAE_ParseSummaryCsvRow(const string row,
                            EAE_BasketStatsSummary &out_sum,
                            string &out_side)
{
   string parts[];
   int n = StringSplit(row, ',', parts);
   if(n < 24)
      return false;

   out_side = parts[2];

   out_sum.total_cycles        = (int)StringToInteger(parts[3]);
   out_sum.total_forced_cycles = (int)StringToInteger(parts[4]);

   out_sum.last_duration_sec   = (int)StringToInteger(parts[5]);
   out_sum.min_duration_sec    = (int)StringToInteger(parts[6]);
   out_sum.max_duration_sec    = (int)StringToInteger(parts[7]);
   out_sum.sum_duration_sec    = (long)StringToInteger(parts[8]);
   out_sum.avg_duration_sec    = StringToDouble(parts[9]);

   out_sum.last_closed_count   = (int)StringToInteger(parts[10]);
   out_sum.min_closed_count    = (int)StringToInteger(parts[11]);
   out_sum.max_closed_count    = (int)StringToInteger(parts[12]);
   out_sum.sum_closed_count    = (long)StringToInteger(parts[13]);
   out_sum.avg_closed_count    = StringToDouble(parts[14]);

   out_sum.last_closed_lots    = StringToDouble(parts[15]);
   out_sum.min_closed_lots     = StringToDouble(parts[16]);
   out_sum.max_closed_lots     = StringToDouble(parts[17]);
   out_sum.sum_closed_lots     = StringToDouble(parts[18]);
   out_sum.avg_closed_lots     = StringToDouble(parts[19]);

   out_sum.total_closed_orders = (long)StringToInteger(parts[20]);
   out_sum.total_closed_lots   = StringToDouble(parts[21]);
   out_sum.total_realized_pnl  = StringToDouble(parts[22]);
   out_sum.last_close_time     = StringToTime(parts[23]);

   return true;
}

// Load summary state from CSV file
bool EAE_LoadSummaryStateCsv(const string file_name,
                             EAE_BasketStatsSummary &buy_sum,
                             EAE_BasketStatsSummary &sell_sum)
{
   int handle = FileOpen(file_name,
                         FILE_READ | FILE_TXT | FILE_ANSI | FILE_SHARE_READ | FILE_SHARE_WRITE);

   if(handle == INVALID_HANDLE)
      return false;

   // Skip header
   string header = FileReadString(handle);
   if(FileIsEnding(handle))
   {
      FileClose(handle);
      return false;
   }

   while(!FileIsEnding(handle))
   {
      string row = FileReadString(handle);
      if(StringLen(row) == 0)
         continue;

      EAE_BasketStatsSummary tmp;
      string side = "";

      if(!EAE_ParseSummaryCsvRow(row, tmp, side))
         continue;

      if(side == "BUY")
      {
         tmp.side = EAE_SIDE_BUY;
         buy_sum = tmp;
      }
      else if(side == "SELL")
      {
         tmp.side = EAE_SIDE_SELL;
         sell_sum = tmp;
      }
   }

   FileClose(handle);
   return true;
}

#endif // __EAE_FILE_LOGGER_MQH__