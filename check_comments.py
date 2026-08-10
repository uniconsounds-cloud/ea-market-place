import openpyxl
import os

file_path = "/Users/suphakorn/EA Market Place/MT5 EA Reports/ReportHistory-97053088-EasyM Max-Apr27-Aug08.xlsx"

if not os.path.exists(file_path):
    print("Excel file not found!")
    exit(1)

wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb.active

comments = {}
symbols = {}

for r in range(8, sheet.max_row + 1):
    row_values = [cell.value for cell in sheet[r]]
    if len(row_values) < 14:
        continue
    
    symbol = row_values[2]
    comment = row_values[12] # 13th column is comment
    
    if comment is not None:
        comments[comment] = comments.get(comment, 0) + 1
    if symbol is not None:
        symbols[symbol] = symbols.get(symbol, 0) + 1

print("--- Comment Counts ---")
for c, count in sorted(comments.items(), key=lambda x: x[1], reverse=True):
    print(f"Comment: '{c}' -> {count} trades")

print("\n--- Symbol Counts ---")
for s, count in sorted(symbols.items(), key=lambda x: x[1], reverse=True):
    print(f"Symbol: '{s}' -> {count} trades")
