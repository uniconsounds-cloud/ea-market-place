import openpyxl
from datetime import datetime
import os
import json

file_path = "/Users/suphakorn/EA Market Place/MT5 EA Reports/ReportHistory-97053088-EasyM Max-Apr27-Aug08.xlsx"

if not os.path.exists(file_path):
    print("Excel file not found!")
    exit(1)

wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb.active

# Let's find where the headers are.
# Header row is Row 7: ['Time', 'Position', 'Symbol', 'Type', 'Volume', 'Price', 'S / L', 'T / P', 'Time', 'Price', 'Commission', 'Swap', 'Profit']
# Let's print header columns to verify index.
headers = [cell.value for cell in sheet[7]]
print("Headers:", headers)

# We want:
# Column 8 (0-indexed): Close Time
# Column 10 (0-indexed): Commission
# Column 11 (0-indexed): Swap
# Column 12 (0-indexed): Profit

excel_daily = {}

for r in range(8, sheet.max_row + 1):
    row_values = [cell.value for cell in sheet[r]]
    if len(row_values) < 13:
        continue
    
    close_time_str = row_values[8] # 9th column (index 8)
    commission = row_values[10] # 11th column
    swap = row_values[11]       # 12th column
    profit = row_values[12]     # 13th column
    
    if close_time_str is None or profit is None:
        continue
        
    try:
        # close_time_str is like '2026.04.28 06:04:03'
        close_date = datetime.strptime(close_time_str.split()[0], '%Y.%m.%d').strftime('%Y-%m-%d')
        
        comm_val = float(commission) if commission is not None else 0.0
        swap_val = float(swap) if swap is not None else 0.0
        prof_val = float(profit) if profit is not None else 0.0
        
        # In EAE_WebSync.mqh:
        # total_profit += profit + commission + swap
        net_profit = prof_val + comm_val + swap_val
        
        if close_date not in excel_daily:
            excel_daily[close_date] = {'profit': 0.0, 'lots': 0.0}
            
        excel_daily[close_date]['profit'] += net_profit
        excel_daily[close_date]['lots'] += float(row_values[4]) if row_values[4] is not None else 0.0
    except Exception as e:
        # Print error if it's not a summary row or empty row
        if any(v is not None for v in row_values[:5]):
            print(f"Error parsing row {r}: {e}, values: {row_values}")

print("\n--- Excel Daily Totals ---")
for date in sorted(excel_daily.keys()):
    p = excel_daily[date]['profit']
    l = excel_daily[date]['lots']
    print(f"{date}: Profit={p:.2f}, Lots={l:.1f}")

# Now let's fetch DB history to compare
import subprocess
try:
    print("\n--- Comparing with DB ---")
    # We run check_db_history.js and parse its stdout
    res = subprocess.run(["node", "check_db_history.js"], capture_output=True, text=True)
    db_lines = res.stdout.split('\n')
    db_daily = {}
    for line in db_lines:
        # Line format: "2026-04-09: Profit=0, MaxDD=4.67, Lots=0"
        if ': Profit=' in line:
            parts = line.split(': Profit=')
            date = parts[0].strip()
            rest = parts[1].split(', MaxDD=')
            profit = float(rest[0])
            lots = float(rest[1].split(', Lots=')[1])
            db_daily[date] = {'profit': profit, 'lots': lots}
            
    # Print differences
    all_dates = sorted(list(set(excel_daily.keys()) | set(db_daily.keys())))
    print(f"\nDiff analysis (Total dates count: {len(all_dates)}):")
    print(f"{'Date':<12} | {'Excel Profit':<12} | {'DB Profit':<12} | {'Diff':<12} | {'Lots Ex':<8} | {'Lots DB':<8}")
    print("-" * 75)
    for date in all_dates:
        ex = excel_daily.get(date, {'profit': 0.0, 'lots': 0.0})
        db = db_daily.get(date, {'profit': 0.0, 'lots': 0.0})
        
        diff = abs(ex['profit'] - db['profit'])
        lots_diff = abs(ex['lots'] - db['lots'])
        
        if diff > 0.01 or lots_diff > 0.01:
            print(f"{date:<12} | {ex['profit']:12.2f} | {db['profit']:12.2f} | {ex['profit'] - db['profit']:12.2f} | {ex['lots']:8.1f} | {db['lots']:8.1f}")
            
except Exception as e:
    print("Error comparing with DB:", e)
