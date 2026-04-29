//+------------------------------------------------------------------+
//| EAE_DashboardBase.mqh                                            |
//| EA Easy dashboard base                                           |
//| Modified for V1.01 display-only changes                          |
//| Modified for V1.02 scale support using InpDashUserScale          |
//| Modified for V1.03 font support using InpDashFontSize            |
//+------------------------------------------------------------------+
#ifndef __EAE_DASHBOARD_BASE_MQH__
#define __EAE_DASHBOARD_BASE_MQH__

#include "EAE_MonitorTypes.mqh"
#include "EG_Farming_DashboardMap.mqh"

// -----------------------------
// Layout tuning (base values)
// -----------------------------
static const int EAE_MON_BASE_X0             = 40;
static const int EAE_MON_BASE_Y0             = 40;
static const int EAE_MON_PANEL_GAP0          = 10;

static const int EAE_MON_TITLE_H0            = 32;
static const int EAE_MON_PORT_ROW_H0         = 32;
static const int EAE_MON_PORT_ROWS           = 3;
static const int EAE_MON_PORT_COL1_W0        = 110;
static const int EAE_MON_PORT_COL2_W0        = 220;

static const int EAE_MON_SUM_ROW_H0          = 32;
static const int EAE_MON_SUM_ROWS            = 3; // header + 2 rows
static const int EAE_MON_SUM_COLS            = 9;
static const int EAE_MON_SUM_COL_W0[9]       = {76, 76, 76, 104, 76, 104, 104, 76, 76};

static const int EAE_MON_SECTION_TITLE_H0    = 32;
static const int EAE_MON_FONT_SIZE_SM_OFFSET = 2;
static const string EAE_MON_FONT_NAME        = "Tahoma";

// Colors
static const color EAE_MON_BG_PANEL          = (color)0x202020;
static const color EAE_MON_BG_HEADER         = (color)0x262626;
static const color EAE_MON_BG_CELL           = (color)0x202020;
static const color EAE_MON_BG_CELL_ALT       = (color)0x202020;
static const color EAE_MON_TEXT_COLOR        = clrWhite;
static const color EAE_MON_TEXT_HEADER       = clrWhite;

// -----------------------------
// Scale helpers
// -----------------------------
double EAE_Dash_GetScale()
{
   double s = InpDashUserScale;

   if(s < 0.50) s = 0.50;
   if(s > 3.00) s = 3.00;

   return s;
}

int EAE_Dash_ScaleI(const int v)
{
   return (int)MathMax(1, MathRound(v * EAE_Dash_GetScale()));
}

int EAE_MON_BASE_X()          { return EAE_Dash_ScaleI(EAE_MON_BASE_X0); }
int EAE_MON_BASE_Y()          { return EAE_Dash_ScaleI(EAE_MON_BASE_Y0); }
int EAE_MON_PANEL_GAP()       { return EAE_Dash_ScaleI(EAE_MON_PANEL_GAP0); }

int EAE_MON_TITLE_H()         { return EAE_Dash_ScaleI(EAE_MON_TITLE_H0); }
int EAE_MON_PORT_ROW_H()      { return EAE_Dash_ScaleI(EAE_MON_PORT_ROW_H0); }
int EAE_MON_PORT_COL1_W()     { return EAE_Dash_ScaleI(EAE_MON_PORT_COL1_W0); }
int EAE_MON_PORT_COL2_W()     { return EAE_Dash_ScaleI(EAE_MON_PORT_COL2_W0); }

int EAE_MON_SUM_ROW_H()       { return EAE_Dash_ScaleI(EAE_MON_SUM_ROW_H0); }
int EAE_MON_SECTION_TITLE_H() { return EAE_Dash_ScaleI(EAE_MON_SECTION_TITLE_H0); }

int EAE_MON_FONT_SIZE()
{
   int v = (int)MathMax(1, InpDashFontSize);
   return EAE_Dash_ScaleI(v);
}

int EAE_MON_FONT_SIZE_SM()
{
   int v = (int)MathMax(1, InpDashFontSize - EAE_MON_FONT_SIZE_SM_OFFSET);
   return EAE_Dash_ScaleI(v);
}

int EAE_MON_SUM_COL_W(const int i)
{
   return EAE_Dash_ScaleI(EAE_MON_SUM_COL_W0[i]);
}

// -----------------------------
// Helpers
// -----------------------------
int EAE_Dash_TotalSummaryWidth()
{
   int w = 0;
   for(int i = 0; i < EAE_MON_SUM_COLS; i++)
      w += EAE_MON_SUM_COL_W(i);

   // Include 1px gaps between summary columns.
   w += (EAE_MON_SUM_COLS - 1);

   return w;
}

int EAE_Dash_TotalPortWidth()
{
   return (EAE_MON_PORT_COL1_W() + EAE_MON_PORT_COL2_W());
}

int EAE_Dash_TotalPanelWidth()
{
   int a = EAE_Dash_TotalPortWidth();
   int b = EAE_Dash_TotalSummaryWidth();
   return (a > b ? a : b);
}

string EAE_Dash_Name(const string prefix, const string key)
{
   return prefix + "_" + key;
}

void EAE_Dash_DeleteByPrefix(const long chart_id, const string prefix)
{
   // [OPTIMIZED] High-speed native MT5 deletion 
   // Replaces slow manual loop that scans every object on the chart
   ObjectsDeleteAll(chart_id, prefix);
}

bool EAE_Dash_EnsureRect(const long chart_id,
                         const string name,
                         const int x,
                         const int y,
                         const int w,
                         const int h,
                         const color bg)
{
   if(ObjectFind(chart_id, name) < 0)
   {
      if(!ObjectCreate(chart_id, name, OBJ_RECTANGLE_LABEL, 0, 0, 0))
         return false;
   }

   ObjectSetInteger(chart_id, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(chart_id, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(chart_id, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(chart_id, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(chart_id, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(chart_id, name, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(chart_id, name, OBJPROP_COLOR, bg);
   ObjectSetInteger(chart_id, name, OBJPROP_BACK, false);
   ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(chart_id, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(chart_id, name, OBJPROP_ZORDER, 0);
   return true;
}

bool EAE_Dash_EnsureLabel(const long chart_id,
                          const string name,
                          const int x,
                          const int y,
                          const string text,
                          const color txt_color,
                          const int font_size,
                          const ENUM_ALIGN_MODE align_mode = ALIGN_LEFT)
{
   if(ObjectFind(chart_id, name) < 0)
   {
      if(!ObjectCreate(chart_id, name, OBJ_LABEL, 0, 0, 0))
         return false;
   }

   ObjectSetInteger(chart_id, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(chart_id, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(chart_id, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(chart_id, name, OBJPROP_COLOR, txt_color);
   ObjectSetInteger(chart_id, name, OBJPROP_FONTSIZE, font_size);
   ObjectSetInteger(chart_id, name, OBJPROP_ALIGN, align_mode);
   ObjectSetInteger(chart_id, name, OBJPROP_BACK, false);
   ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(chart_id, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(chart_id, name, OBJPROP_ZORDER, 1);
   ObjectSetString(chart_id, name, OBJPROP_FONT, EAE_MON_FONT_NAME);
   ObjectSetString(chart_id, name, OBJPROP_TEXT, text);
   return true;
}

string EAE_Dash_Dbl2(const double v)
{
   return DoubleToString(v, 2);
}

string EAE_Dash_DiffText(const double balance, const double equity)
{
   // Show balance-equity difference and percentage in one cell.
   double diff = equity - balance;
   double pct  = 0.0;
   if(balance != 0.0)
      pct = (diff / balance) * 100.0;

   string diff_txt = DoubleToString(diff, 2);
   string pct_txt  = DoubleToString(pct, 2);

   return diff_txt + " (" + pct_txt + "%)";
}

// -----------------------------
// Draw blocks
// -----------------------------
void EAE_Dash_DrawTitle(const long chart_id,
                        const string prefix,
                        const int x,
                        const int y,
                        const string title)
{
   int w = EAE_Dash_TotalPanelWidth();

   EAE_Dash_EnsureRect(chart_id,
                       EAE_Dash_Name(prefix, "TITLE_BG"),
                       x, y, w, EAE_MON_TITLE_H(), EAE_MON_BG_HEADER);

   EAE_Dash_EnsureLabel(chart_id,
                        EAE_Dash_Name(prefix, "TITLE_TXT"),
                        x + EAE_Dash_ScaleI(6),
                        y + EAE_Dash_ScaleI(6),
                        title,
                        EAE_MON_TEXT_HEADER,
                        EAE_MON_FONT_SIZE());
}

void EAE_Dash_DrawPortInfo(const long chart_id,
                           const string prefix,
                           const int x,
                           const int y,
                           const EAE_RealtimeSnapshot &snap)
{
   string labels[3];
   string values[3];

   labels[0] = "Equity";   values[0] = EAE_Dash_Dbl2(snap.account.equity);
   labels[1] = "Balance";  values[1] = EAE_Dash_Dbl2(snap.account.balance);
   labels[2] = "Diff";     values[2] = EAE_Dash_DiffText(snap.account.balance, snap.account.equity);

   int total_w = EAE_Dash_TotalPanelWidth();

   EAE_Dash_EnsureRect(chart_id,
                       EAE_Dash_Name(prefix, "PORT_SECTION_BG"),
                       x, y, total_w, EAE_MON_SECTION_TITLE_H(), EAE_MON_BG_HEADER);

   EAE_Dash_EnsureLabel(chart_id,
                        EAE_Dash_Name(prefix, "PORT_SECTION_TXT"),
                        x + EAE_Dash_ScaleI(6),
                        y + EAE_Dash_ScaleI(6),
                        "PORT INFO : " + EG_Farming_GetDashboardGateStatus(),
                        EAE_MON_TEXT_HEADER,
                        EAE_MON_FONT_SIZE());

   int top = y + EAE_MON_SECTION_TITLE_H() + EAE_Dash_ScaleI(2);

   for(int r = 0; r < EAE_MON_PORT_ROWS; r++)
   {
      color row_bg = EAE_MON_BG_CELL;

      int row_y = top + (r * EAE_MON_PORT_ROW_H());

      EAE_Dash_EnsureRect(chart_id,
                          EAE_Dash_Name(prefix, StringFormat("PORT_L_BG_%d", r)),
                          x,
                          row_y,
                          EAE_MON_PORT_COL1_W(),
                          EAE_MON_PORT_ROW_H() - 1,
                          row_bg);

      EAE_Dash_EnsureRect(chart_id,
                          EAE_Dash_Name(prefix, StringFormat("PORT_R_BG_%d", r)),
                          x + EAE_MON_PORT_COL1_W() + 1,
                          row_y,
                          EAE_MON_PORT_COL2_W(),
                          EAE_MON_PORT_ROW_H() - 1,
                          row_bg);

      EAE_Dash_EnsureLabel(chart_id,
                           EAE_Dash_Name(prefix, StringFormat("PORT_L_TXT_%d", r)),
                           x + EAE_Dash_ScaleI(6),
                           row_y + EAE_Dash_ScaleI(7),
                           labels[r],
                           EAE_MON_TEXT_COLOR,
                           EAE_MON_FONT_SIZE_SM());

      EAE_Dash_EnsureLabel(chart_id,
                           EAE_Dash_Name(prefix, StringFormat("PORT_R_TXT_%d", r)),
                           x + EAE_MON_PORT_COL1_W() + EAE_Dash_ScaleI(8),
                           row_y + EAE_Dash_ScaleI(7),
                           values[r],
                           EAE_MON_TEXT_COLOR,
                           EAE_MON_FONT_SIZE_SM());
   }
}

void EAE_Dash_DrawSummaryTable(const long chart_id,
                               const string prefix,
                               const int x,
                               const int y,
                               const EAE_RealtimeSnapshot &snap)
{
   int total_w = EAE_Dash_TotalSummaryWidth();

   EAE_Dash_EnsureRect(chart_id,
                       EAE_Dash_Name(prefix, "SUM_SECTION_BG"),
                       x, y, total_w, EAE_MON_SECTION_TITLE_H(), EAE_MON_BG_HEADER);

   EAE_Dash_EnsureLabel(chart_id,
                        EAE_Dash_Name(prefix, "SUM_SECTION_TXT"),
                        x + EAE_Dash_ScaleI(6),
                        y + EAE_Dash_ScaleI(6),
                        "MONITOR SUMMARY",
                        EAE_MON_TEXT_HEADER,
                        EAE_MON_FONT_SIZE());

   int top = y + EAE_MON_SECTION_TITLE_H() + EAE_Dash_ScaleI(2);

   int cur_x = x;
   for(int c = 0; c < EAE_MON_SUM_COLS; c++)
   {
      string head = EG_Farming_GetBasketColumnName(c);

      EAE_Dash_EnsureRect(chart_id,
                          EAE_Dash_Name(prefix, StringFormat("SUM_H_BG_%d", c)),
                          cur_x,
                          top,
                          EAE_MON_SUM_COL_W(c),
                          EAE_MON_SUM_ROW_H() - 1,
                          EAE_MON_BG_HEADER);

      EAE_Dash_EnsureLabel(chart_id,
                           EAE_Dash_Name(prefix, StringFormat("SUM_H_TXT_%d", c)),
                           cur_x + EAE_Dash_ScaleI(4),
                           top + EAE_Dash_ScaleI(7),
                           head,
                           EAE_MON_TEXT_HEADER,
                           EAE_MON_FONT_SIZE_SM());

      cur_x += EAE_MON_SUM_COL_W(c) + 1;
   }

   for(int r = 0; r < 2; r++)
   {
      int row_side = (r == 0 ? EAE_SIDE_BUY : EAE_SIDE_SELL);
      int row_y = top + EAE_MON_SUM_ROW_H() + 1 + (r * EAE_MON_SUM_ROW_H());
      color row_bg = EAE_MON_BG_CELL;

      cur_x = x;
      for(int c = 0; c < EAE_MON_SUM_COLS; c++)
      {
         string val = EG_Farming_GetBasketCellValue(row_side, c, snap);

         EAE_Dash_EnsureRect(chart_id,
                             EAE_Dash_Name(prefix, StringFormat("SUM_D_BG_%d_%d", r, c)),
                             cur_x,
                             row_y,
                             EAE_MON_SUM_COL_W(c),
                             EAE_MON_SUM_ROW_H() - 1,
                             row_bg);

         EAE_Dash_EnsureLabel(chart_id,
                              EAE_Dash_Name(prefix, StringFormat("SUM_D_TXT_%d_%d", r, c)),
                              cur_x + EAE_Dash_ScaleI(4),
                              row_y + EAE_Dash_ScaleI(7),
                              val,
                              EAE_MON_TEXT_COLOR,
                              EAE_MON_FONT_SIZE_SM());

         cur_x += EAE_MON_SUM_COL_W(c) + 1;
      }
   }
}

// -----------------------------
// Public API
// -----------------------------
void EAE_DashboardInit(const long chart_id, const string prefix)
{
   // [OPTIMIZED] Skip full-chart wipe on startup to avoid 43s hang.
   // Dashboard objects will be instantly updated/overwritten by name instead.
   // EAE_Dash_DeleteByPrefix(chart_id, prefix);
}

void EAE_DashboardDeinit(const long chart_id, const string prefix)
{
   EAE_Dash_DeleteByPrefix(chart_id, prefix);
}

void EAE_DashboardRender(const EAE_RealtimeSnapshot &snap)
{
   string prefix = "EGF_MON";

   int base_x = EAE_MON_BASE_X();
   int base_y = EAE_MON_BASE_Y();

   int panel_w = EAE_Dash_TotalPanelWidth();

   int port_block_h = EAE_MON_SECTION_TITLE_H() + EAE_Dash_ScaleI(2) + (EAE_MON_PORT_ROWS * EAE_MON_PORT_ROW_H());
   int sum_block_h  = EAE_MON_SECTION_TITLE_H() + EAE_Dash_ScaleI(2) + (EAE_MON_SUM_ROWS * EAE_MON_SUM_ROW_H());

   int total_h = EAE_MON_TITLE_H() + EAE_MON_PANEL_GAP() + port_block_h + EAE_MON_PANEL_GAP() + sum_block_h + EAE_Dash_ScaleI(8);

   EAE_Dash_EnsureRect(ChartID(),
                       EAE_Dash_Name(prefix, "OUTER_BG"),
                       base_x - EAE_Dash_ScaleI(2),
                       base_y - EAE_Dash_ScaleI(2),
                       panel_w + EAE_Dash_ScaleI(6),
                       total_h,
                       EAE_MON_BG_PANEL);

   EAE_Dash_DrawTitle(ChartID(), prefix, base_x, base_y, EG_Farming_GetDashboardTitle());

   int port_y = base_y + EAE_MON_TITLE_H() + EAE_MON_PANEL_GAP();
   EAE_Dash_DrawPortInfo(ChartID(), prefix, base_x, port_y, snap);

   // Summary table
   int sum_y = port_y + port_block_h + EAE_MON_PANEL_GAP();
   EAE_Dash_DrawSummaryTable(ChartID(), prefix, base_x, sum_y, snap);
}

#endif // __EAE_DASHBOARD_BASE_MQH__