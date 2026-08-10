import openpyxl
import os

file_path = "/Users/suphakorn/EA Market Place/MT5 EA Reports/ReportHistory-97053088-EasyM Max-Apr27-Aug08.xlsx"

if not os.path.exists(file_path):
    print("Excel file not found!")
    exit(1)

try:
    wb = openpyxl.load_workbook(file_path, read_only=True)
    sheet = wb.active
    print("Sheet name:", sheet.title)
    
    # Print the first 30 rows
    for r in range(1, 40):
        row_values = [cell.value for cell in sheet[r]]
        # Filter out rows that are entirely empty to save space
        if any(v is not None for v in row_values):
            print(f"Row {r}: {row_values[:10]}")
            
except Exception as e:
    print("Error reading excel:", e)
