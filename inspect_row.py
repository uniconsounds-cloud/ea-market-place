import openpyxl
import os

file_path = "/Users/suphakorn/EA Market Place/MT5 EA Reports/ReportHistory-97053088-EasyM Max-Apr27-Aug08.xlsx"

wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb.active

# Let's inspect row 8 and row 7917
r8 = [cell.value for cell in sheet[8]]
r7917 = [cell.value for cell in sheet[7917]]

print("Row 8 length:", len(r8))
for i, val in enumerate(r8):
    print(f"Col {i}: {val} (type: {type(val).__name__})")

print("\nRow 7917 length:", len(r7917))
for i, val in enumerate(r7917):
    print(f"Col {i}: {val} (type: {type(val).__name__})")
