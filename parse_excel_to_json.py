import openpyxl
from datetime import datetime
import os
import json

file_path = "/Users/suphakorn/EA Market Place/MT5 EA Reports/ReportHistory-97053088-EasyM Max-Apr27-Aug08.xlsx"
out_json_path = "/Users/suphakorn/EA Market Place/ea-market-place/history_data.json"

if not os.path.exists(file_path):
    print("Excel file not found!")
    exit(1)

wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb.active

headers = [cell.value for cell in sheet[7]]
print("Headers:", headers)

excel_daily = {}

for r in range(8, sheet.max_row + 1):
    row_values = [cell.value for cell in sheet[r]]
    if len(row_values) < 13:
        continue
    
    close_time_str = row_values[8] # Close Time
    commission = row_values[10] # Commission
    swap = row_values[11]       # Swap
    profit = row_values[12]     # Profit
    lots = row_values[4]        # Volume/Lots
    
    if close_time_str is None or profit is None:
        continue
        
    try:
        # close_time_str is like '2026.04.28 06:04:03' or could be datetime object
        if isinstance(close_time_str, datetime):
            close_date = close_time_str.strftime('%Y-%m-%d')
        else:
            close_date = datetime.strptime(str(close_time_str).split()[0], '%Y.%m.%d').strftime('%Y-%m-%d')
        
        comm_val = float(commission) if commission is not None else 0.0
        swap_val = float(swap) if swap is not None else 0.0
        prof_val = float(profit) if profit is not None else 0.0
        lots_val = float(lots) if lots is not None else 0.0
        
        net_profit = prof_val + comm_val + swap_val
        
        if close_date not in excel_daily:
            excel_daily[close_date] = {'profit': 0.0, 'lots': 0.0}
            
        excel_daily[close_date]['profit'] += net_profit
        excel_daily[close_date]['lots'] += lots_val
    except Exception as e:
        if any(v is not None for v in row_values[:5]):
            print(f"Error parsing row {r}: {e}, values: {row_values}")

# Convert dict to a list of dicts for JSON
output_data = []
for date, data in sorted(excel_daily.items()):
    output_data.append({
        'date': date,
        'profit': round(data['profit'], 2),
        'lots': round(data['lots'], 2)
    })

with open(out_json_path, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print(f"Successfully wrote {len(output_data)} daily records to {out_json_path}")
