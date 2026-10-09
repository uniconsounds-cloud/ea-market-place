# 🏷️ EA Technical Build Registry & Edition Ledger
> **บันทึกประวัติการสร้างและเลข ID ย่อยของ EA (Internal Technical Editions)**
> เอกสารฉบับนี้จัดทำขึ้นเป็น Single Source of Truth สำหรับผู้ดูแลระบบ (Admin) เพื่อใช้อ้างอิงทางเทคนิคในการตรวจสอบว่า พอร์ตใดกำลังรัน EA Edition / Build ใดอยู่ โดยไม่ต้องเปิดอ่านโค้ดซ้ำ

---

## 📌 โครงสร้างรหัสประจำรุ่น (Build ID Convention)

* **รูปแบบ:** `B<YY><MM><DD>.<Revision>`
  * ตัวอย่าง: **`B261009.1`** = ปี 2026 / เดือน 10 / วันที่ 09 / การแก้ไขลำดับที่ 1 ของวัน
* **รูปแบบการส่งข้อมูลขึ้นระบบเว็บ (Telemetry Identity):**
  * `ea_version`: `v2.00-1008 [B261009.1]` หรือ `v2.00-1009 [B261009.1]`
  * แสดงผลบนหน้าปัด MT5 Dashboard Title: `=== EasyM Prime Universal v2.00 1008 [B261009.1] ===`
  * บันทึกใน Log เริ่มต้นของ MT5: `PrintFormat("=== %s | Edition Build: %s ===", ...)`

---

## 📊 ตารางบันทึกประวัติ Edition ย่อยทั้งหมด (Technical Ledger)

| Build ID | เวอร์ชันหลัก | วันที่ / เวลา | สถานะระบบสั่งการ (2-Way) | วัตถุประสงค์และการเปลี่ยนแปลงสำคัญ (Technical Highlights) |
| :--- | :---: | :---: | :---: | :--- |
| **`B261009.1`** | **EasyM Prime** (`v2.00`)<br>**EasyM Max** (`v2.00`) | 2026-10-09 | **Prime:** Standalone (1008) / 2-Way (1009)<br>**Max:** Standalone Local MT5 (1-Way Telemetry) | • **EasyM MAX Final Stable Release:** คงตะกร้า 20 คู่เงินคลาสสิกดั้งเดิม 100%, ปิดจุดบอดคู่ที่ 5 (100% Symbol Freeze Coverage ทุกคู่เงินแตะ 8.0%), ติดตั้ง Currency Cluster Limiter (`InpMaxCurrencyCluster = 3`), ไม่มีระบบ Quarantine/Rescue/Hedge/Relief (เพื่อความเสถียรและแยกเป็นผลิตภัณฑ์คลาสสิก), ชื่อแดชบอร์ด `=== EasyM Max v2.00 [B261009.1] ===`<br>• **EasyM PRIME:** Step-by-Step Cascade Adaptive Quarantine, Separate F7 Inputs (10% Floor / 14% Single-Pair), Anti-Falling Knife Smart Rescue (Rejection Wick $\ge 35\%$), 100% Symbol Freeze Coverage |
| **`B261008.1`** | **v2.00-1008** | 2026-10-08 | Standalone (ปิด) | • Stable Standalone Release สำหรับส่งมอบลูกค้าทั่วไป<br>• Daily Drawdown Recalibration ให้ตรงกับเว็บฟาร์ม<br>• Quarantine Quota ปรับเป็น 3 คู่เงิน |
| **`B261006.1`** | **v2.00-1006** | 2026-10-06 | One-Way Telemetry | • Cent Account Auto-Normalization<br>• Relief Fund Budget Cap 5% ของยอด Balance<br>• Max Currency Cluster ปรับจาก 2 เป็น 3 คู่ |
| **`B261001.1`** | **v2.00-1001** | 2026-10-01 | One-Way Telemetry | • Auto-Hedge Delta=0 สำหรับคู่ที่แย่ที่สุดตัวเดียว<br>• 20-Pair Rebalancing (นำ AUDNZD, CADCHF, NZDCAD เข้ามาแทนคู่ผันผวนสูง) |

---

## 🔍 รายละเอียดเชิงลึกเฉพาะรุ่น `B261009.1` (Architecture Deep Dive)

### 1. การทำงานของ Step-by-Step Cascade Adaptive Quarantine
```text
[พอร์ตแตะ FREEZE >= 28%]
       │
       ▼
[ขังคู่แย่สุดตัวที่ 1 (DD >= 10% Floor)] ───► พอร์ตคลายตัวเหลือ DD=24.42%
       │
       ▼
[พอร์ตยังติด SLOW >= 18% ?]
   ├── YES ──► มีโควตาว่าง? ──► [ขังคู่แย่สุดตัวที่ 2 (DD >= 10% Floor)] ──► พอร์ตคลายตัวเหลือ DD=10.42%
   └── NO                                                                             │
        │                                                                             ▼
        └───────────────────────────────► [พอร์ตกลับสู่ NORMAL ทันที!] ◄───────────────┘
                                                       │
                                                       ▼
                                         [หยุดขังเพิ่ม! ไม่เปลืองโควตา]
```

### 2. เกณฑ์ดักจับคู่หลุดเดี่ยว (Standalone Runaway)
* แม้พอร์ตโดยรวมจะอยู่ในสภาวะปกติ (NORMAL เช่น DD รวมพอร์ตเพิ่งแตะ 3-5%)
* หากมีคู่เงินใดเกิดเหตุการณ์กระชากเดี่ยวจนแตะ **$\text{DD} \ge 14.0\%$** (`InpQuarantineSinglePairPct`)
* ระบบจะดึงคู่นั้นเข้าห้องขังเดี่ยวทันที เพื่อตัดไฟแต่ต้นลม ไม่ให้ลุกลามมาฉุดพอร์ตหลัก

### 3. พารามิเตอร์ Input F7 สำหรับรุ่น `B261009.1`
```mql5
input group "------- 🛡️ QUARANTINE & RESCUE DEFENSE"
input bool   InpEnableQuarantine          = true;  // Quarantine Mode ON/OFF
input double InpQuarantineFloorPct        = 10.0;  // Adaptive Quarantine Floor DD% (When SLOW/FREEZE)
input double InpQuarantineSinglePairPct   = 14.0;  // Single-Pair Runaway DD% -> QUARANTINE (Standalone)
input double InpQuarantineResumePct       = 8.0;   // Quarantine Safe Release Floor DD%
input int    InpMaxQuarantinedSymbols     = 3;     // Max Quarantined Pairs before FREEZE ALL
```
