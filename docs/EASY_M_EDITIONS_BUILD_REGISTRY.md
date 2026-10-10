# EasyM Technical Editions & Build Registry (ระบบบันทึกรหัสย่อยและประวัติการพัฒนา)

เอกสารฉบับนี้จัดทำขึ้นเพื่อเป็น **แหล่งอ้างอิงทางเทคนิคระบบหลังบ้าน (Admin Technical Registry)** สำหรับติดตามและระบุรหัสย่อย (Build ID / Edition Code) ของ EA ในทุกๆ ครั้งที่มีการแก้ไขปรับปรุงโค้ด เพื่อให้ระบบหลังบ้านของแอดมิน, API Endpoint, และหน้าเว็บสามารถตรวจสอบและรู้จักเวอร์ชันย่อยของ EA แต่ละตัวได้อย่างถูกต้องและแม่นยำ 100% โดยไม่ต้องเข้าไปไล่เช็กในโค้ด

---

## 🏷️ โครงสร้างรหัสย่อย (Build ID Standard Syntax)

รหัสย่อยถูกออกแบบให้อิงตามปี เดือน วัน และลำดับการคอมไพล์ในวันนั้น:
$$\mathbf{B\langle YY\rangle\langle MM\rangle\langle DD\rangle.\langle Sequence\rangle}$$

* **ตัวอย่าง:**
  * `B261009.1` = ปี 2026, เดือน 10 (ตุลาคม), วันที่ 09, การปรับปรุงลำดับที่ 1
  * `B261009.2` = ปี 2026, เดือน 10 (ตุลาคม), วันที่ 09, การปรับปรุงลำดับที่ 2
* **การแสดงผลบน MT5 Dashboard:**
  * `=== EasyM Prime v2.00 [B261009.2] ===`
  * `=== EasyM Max v2.00 [B261009.1] ===`
* **การส่งข้อมูลผ่าน Web Telemetry (JSON Payload):**
  * EA จะแนบ `"build_id": "B261009.2"` ใน JSON string ทุกรอบการซิงค์ข้อมูล (`BuildPrimeTelemetryJson()`) ทำให้ฝั่งเซิร์ฟเวอร์อ่านค่าและบันทึกลงฐานข้อมูลได้ทันที

---

## 📋 ทะเบียนประวัติการแก้ไขและรหัสย่อย (Build Ledger)

### 🌟 EasyM Prime Series (`EZM-PRIME-V1`)

| Build ID | วันที่ / เวลา | ชื่อไฟล์ Source / Executable | รายละเอียดการปรับปรุงทางเทคนิค (Change Summary) | สถานะ |
| :---: | :---: | :--- | :--- | :---: |
| **B261009.2** | 09 ต.ค. 2026 | `EasyM_Prime_v200_B261009_2.mq5`<br>`EasyM_Prime_v200_B261009_2.ex5` | **Off-Market 24/7 Telemetry & Instant Boot Scan:**<br>1. ย้าย/เพิ่มคำสั่งสแกนพอร์ต (`UpdateSymbolPositions`, `CheckQuarantineAndHedge`, `UpdatePortfolioAutoMode`, `UpdateWorstSymbolsTopN`) เข้าไปใน **`OnInit()`** และ **`OnTimer()`**<br>2. แก้ปัญหาตลาดปิด (วันหยุด/นอกเวลา) ที่ `OnTick()` ไม่ทำงาน ให้ EA ตรวจจับคู่กักขัง DD $\ge 14\%$ และโหมดพอร์ตได้ทันทีที่ลากลงกราฟ<br>3. เพิ่มฟิลด์ `"build_id": "B261009.2"` ลงใน JSON Telemetry ส่งขึ้นเว็บโดยตรง<br>4. อัปเดตไตเติลบนชาร์ตเป็น `=== EasyM Prime v2.00 [B261009.2] ===` | 🟢 **Active Production** |
| **B261009.1** | 09 ต.ค. 2026 | `EasyM_Prime_v200_B261009_1.mq5`<br>`EasyM_Prime_v200_B261009_1.ex5` | **Step-by-Step Adaptive Quarantine & Dual Triggers:**<br>1. แยกตัวแปรห้องขัง: `InpQuarantineFloorPct = 10%` (เมื่อพอร์ต Slow/Freeze), `InpQuarantineSinglePairPct = 14%` (คู่เดียวทะลุเดี่ยว)<br>2. ลำดับการขังแบบทีละขั้น (Step-by-Step) ครั้งละ 1 คู่ สูงสุดไม่เกิน 3 ที่นั่ง (`InpMaxQuarantinedSymbols = 3`)<br>3. ปลดขังอิสระเฉพาะคู่นั้นเมื่อ DD ลดลง $4\%$ จากจุดที่เข้าขัง (`entryDD - 4.0%`) หรือแตะ floor<br>4. บูรณาการ Relief Fund 40% ตัดไม้บนสุดแบบคู่เงินคู่เดิมก่อน | 🟡 Superseded by B261009.2 |

---

### 🛡️ EasyM MAX Series (`EZM-MAX-V1`)

| Build ID | วันที่ / เวลา | ชื่อไฟล์ Source / Executable | รายละเอียดการปรับปรุงทางเทคนิค (Change Summary) | สถานะ |
| :---: | :---: | :--- | :--- | :---: |
| **B261009.1** | 09 ต.ค. 2026 | `EasyM_Max_v200_B261009_1.mq5`<br>`EasyM_Max_v200_B261009_1.ex5` | **Finalized Classic Basket & 3-Cluster Lock:**<br>1. ตรึงตะกร้าคลาสสิก 20 คู่เงินเดิม (`AUDCAD`, `EURCHF`, `GBPCHF`) ไม่มีคู่เงินใหม่ของ Prime<br>2. ไม่มีระบบห้องขัง (No Quarantine) เพื่อรักษาเอกลักษณ์ดั้งเดิม<br>3. ปรับ Currency Cluster Limiter: `InpMaxCurrencyCluster = 3`<br>4. ปิดช่องโหว่คู่ที่ 5 (5th-pair throttle blindspot) ใน Freeze mode<br>5. แดชบอร์ดแสดง `=== EasyM Max v2.00 [B261009.1] ===` | 🟢 **Final Stable Release** |

---

## 🔌 การเชื่อมโยงฝั่ง Web Backend (API & Admin Dashboard)

ในฝั่ง Next.js / Supabase API (`/api/sync-dashboard` หรือ `/api/mt5/sync`):
* Payload JSON จาก EA จะมีโครงสร้างดังนี้:
```json
{
  "build_id": "B261009.2",
  "mode": "NORMAL",
  "mode_dd": 14.20,
  "total_dd": 14.20,
  "worst": "EURJPY (DD 14.20%)",
  "relief_budget": 0.00,
  "quarantined": [
    {
      "symbol": "EURJPY",
      "dd": 14.20,
      "hedged": false,
      "orders": 12,
      "rescue": 0
    }
  ],
  "alert": "lock withdraws",
  "settings": {
    "quarantine_in": 14.0,
    "quarantine_floor": 10.0,
    "quarantine_out": 10.0,
    "max_quarantined": 3
  }
}
```

* **ประโยชน์สำหรับแอดมิน:**
  1. เมื่อเปิดดูหน้าฟาร์ม หรือหน้ารายการพอร์ตในระบบแอดมิน จะสามารถอ่านค่า `build_id` ได้ทันที
  2. รู้ได้ทันทีว่าลูกค้าพอร์ตนั้นกำลังใช้ Build ใดอยู่ ต้องอัปเกรดหรือไม่ โดยไม่ต้องสอบถามลูกค้าหรือขอ Remote เช็กใน MT5
