# 📊 ตารางข้อกำหนดและบันทึกการเปลี่ยนแปลง EasyM ทุกรุ่น (EasyM Specification & Version Matrix)

> **เอกสารอ้างอิงหลักทางเทคนิค (Master Reference Document)**  
> **ระบบ:** EasyM Version 2.00 Series  
> **สถาปัตยกรรมเครือข่าย:** Single WebRequest Architecture (`https://eaeze.com` เพียง URL เดียว 100%)  
> **ปรับปรุงล่าสุด:** ตุลาคม 2026  

---

## 📌 สรุปหลักการโครงสร้างเครือข่าย (Single WebRequest 100%)

ทุกผลิตภัณฑ์ในตระกูล **EasyM v2.00** ได้รับการปรับปรุงให้รองรับ **Single WebRequest** อย่างสมบูรณ์แบบ:
* ในหน้าต่างตั้งค่า MT5: **Tools > Options > Expert Advisors** ➔ **Allow WebRequest for listed URL:**
* ใส่เพียง **บรรทัดเดียวเท่านั้น**:
  ```text
  https://eaeze.com
  ```
* ❌ **ไม่ต้องใส่** `https://mfrspvzxmpksqnzcrysz.supabase.co` อีกต่อไป
* ทุกคำสั่งทั้งการตรวจสิทธิ์ (License Verification), การอัปเดตสถานะพอร์ต (Fleet Status), และการสตรีมหน้าฟาร์ม (Farm Live Stream) จะวิ่งผ่าน Gateway กลางของ `https://eaeze.com` ทั้งหมด

---

## 🧭 ตารางเปรียบเทียบสเปกของแต่ละรุ่น (Product Specification Matrix)

| คุณสมบัติ / รายละเอียด | 🟢 EasyM mini | 🌾 EasyM Farm | 🔵 EasyM MAX | 👑 EasyM PRIME |
| :--- | :---: | :---: | :---: | :---: |
| **Product ID (Macro)** | `EZM-MIN-V1` | `EZM-FARM-V1` | `EZM-MAX-V1` | `EZM-PRIME-V1` |
| **เวอร์ชันล่าสุด** | `v2.00-0928` | `v2.00-0928` | **`v2.00 [B261009.1]`** | **`v2.00 [B261009.1]`** |
| **จำนวนคู่เงินที่เทรด** | **10 คู่เงิน** | **10 คู่เงิน** (5 พอร์ต) | **20 คู่เงิน** | **20 คู่เงิน** + Adaptive Filter |
| **วัตถุประสงค์หลัก** | เทรดพอร์ตเล็ก / รัน VPS เอง | ฟาร์ม 5 พอร์ตกระจายเสี่ยง | กระดาน 20 คู่ กระจายความเสี่ยง | รุ่นเรือธง สั่งการ & ควบคุม 100% |
| **MT5 WebRequest ที่ต้องใส่** | `https://eaeze.com` | `https://eaeze.com` | `https://eaeze.com` | `https://eaeze.com` |
| **การตรวจสิทธิ์ (License Check)** | ทุก 12 ชม. + ตอนเปิด EA | ทุก 12 ชม. + ตอนเปิด EA | ทุก 12 ชม. + ตอนเปิด EA | ทุก 12 ชม. + ตอนเปิด EA |
| **Endpoint ตรวจสิทธิ์** | `/api/verify-license` | `/api/verify-license` | `/api/verify-license` | `/api/verify-license` |
| **ส่งยอด Balance/Equity** | ส่งผ่าน Verify Payload | ส่งผ่าน Verify Payload | ส่งผ่าน Verify + Farm Sync | ส่งผ่าน Verify + Farm Sync |
| **การแสดงผล Farm UI** | ❌ **ไม่มี Farm UI** | ❌ **ไม่มี Farm UI** | ✅ **Standard Farm UI** | ✅ **Next-Gen Cyber Farm UI** |
| **ความถี่การส่ง Live Telemetry** | ❌ **ไม่ส่ง (Bypass 100%)** | ❌ **ไม่ส่ง (Bypass 100%)** | ส่งทุก 20 วิ (เฉพาะตอนดูเว็บ) | ส่งทุก 20 วิ (เฉพาะตอนดูเว็บ) |
| **Endpoint ซิงค์ฟาร์ม** | — | — | `/api/sync-dashboard` | `/api/sync-dashboard` |
| **ระบบสั่งการ 2 ทาง (Remote)** | ❌ ไม่มี | ❌ ไม่มี | ❌ ไม่มี | ✅ **Close-Only & Quarantine รายคู่** |
| **Safe Liquidation Protocol** | ❌ ไม่มี (หยุดเมื่อหมดอายุ) | ❌ ไม่มี (หยุดเมื่อหมดอายุ) | ❌ ไม่มี (หยุดเมื่อหมดอายุ) | ✅ **ปิดรวบเคลียร์พอร์ต แล้วถอดตัวเอง** |
| **เกราะป้องกัน Auto-Hedge** | ❌ ไม่มี | ❌ ไม่มี | ❌ ไม่มี | ✅ **มี (Single Worst 40% DD, Delta=0)** |
| **ห้องขังเดี่ยว (Quarantine)** | ❌ ไม่มี | ❌ ไม่มี | ❌ ไม่มี | ✅ **มี (18% DD, ขังสูงสุด 3 คู่, ปลดขัง 12%)** |
| **กองทุนตัดขาดทุน (Relief Fund)**| ❌ ไม่มี | ❌ ไม่มี | ❌ ไม่มี | ✅ **มี (Cross-Pair Vault 40%, Cap 5%)** |
| **สไนเปอร์กู้ภัย (Rescue Grid)**| ❌ ไม่มี | ❌ ไม่มี | ❌ ไม่มี | ✅ **มี (25% DD, 3 ไม้สไนเปอร์ R1-R3)** |
| **Currency Cluster Limit** | สูงสุด 2 คู่เงิน | สูงสุด 2 คู่เงิน | สูงสุด 2 คู่เงิน | ✅ **สูงสุด 3 คู่เงิน (เพิ่ม Cash Flow)** |
| **3-Tier Portfolio DD** | 18% Slow / 28% Freeze | 18% Slow / 28% Freeze | 18% Slow / 28% Freeze | ✅ **18% Slow / 28% Freeze / 12% Resume** |

---

## 🔍 เจาะลึกรายละเอียดพฤติกรรมของแต่ละรุ่น

### 1. EasyM mini (`EZM-MIN-V1`)
* **ไฟล์หลัก:** `EASY_M_mini_v200_0928.mq5` / `.ex5`
* **กลยุทธ์:** Multi-Currency 10 คู่เงิน
* **พฤติกรรมเครือข่าย:** 
  * ยิงเฉพาะ `/api/verify-license` ทุก 12 ชั่วโมงเพื่อตรวจความถูกต้องของสิทธิ์และเช็คยอด Balance ขั้นต่ำ
  * **ไม่มีการส่ง Telemetry ซ้ำซ้อนขึ้นหน้าฟาร์ม:** ลดภาระเน็ต VPS และ CPU ลง 95% เหมาะสำหรับลูกค้าที่นำไปรันบน VPS ส่วนตัว

### 2. EasyM Farm (`EZM-FARM-V1`)
* **ไฟล์หลัก:** `EASY_M_Farm_v200_0928.mq5` / `.ex5`
* **กลยุทธ์:** Multi-Currency 10 คู่เงิน (เหมือน mini แต่จัดชุดสำหรับรัน 5 พอร์ตพร้อมกันเพื่อกระจายความเสี่ยง)
* **พฤติกรรมเครือข่าย:** 
  * ทำงานแบบเดียวกับ mini คือ **ตรวจสิทธิ์อย่างเดียว** ผ่าน `/api/verify-license`
  * **ตัดการส่ง Live Stream หน้าฟาร์มออกทั้งหมด** เพื่อให้ VPS ขนาดเล็ก (1-2 vCPU) สามารถรันพร้อมกัน 5 MT5 Terminals ได้อย่างลื่นไหล ไม่มีหน่วงหรือเน็ตตัน

### 3. EasyM MAX (`EZM-MAX-V1`)
* **ไฟล์หลัก:** `EasyM_Max_v200_B261009_1.mq5` / `.ex5` (เวอร์ชันเสถียรหลัก Build B261009.1)
* **กลยุทธ์:** Multi-Currency 20 คู่เงิน กระจายความเสี่ยงเต็มแผง พร้อม Currency Cluster Limiter (`InpMaxCurrencyCluster = 2`) และ 100% Symbol Freeze Coverage (ปิดจุดบอดคู่ที่ 5)
* **พฤติกรรมเครือข่าย:**
  * ตรวจสิทธิ์ผ่าน `/api/verify-license`
  * ส่งข้อมูลสถานะและรายการออเดอร์ (Tickets, Lots, PnL) ขึ้น Standard Farm UI ผ่าน `https://eaeze.com/api/sync-dashboard`
  * มีระบบ **Smart Sleep/Wake:** ส่ง Heartbeat ทุก 3 นาทีเมื่อไม่มีคนดูเว็บ และสลับมาส่งทุก 20 วินาทีอัตโนมัติเฉพาะตอนลูกค้าเปิดดูหน้าฟาร์ม

### 4. EasyM PRIME (`EZM-PRIME-V1`)
* **ไฟล์หลัก:** `EASY_M_Prime_v200_1006.mq5` / `.ex5`
* **กลยุทธ์:** Multi-Currency 20 คู่เงิน + Adaptive Filter + Sniper Rescue Grid + Cross-Pair Relief Fund
* **พฤติกรรมเครือข่าย:**
  * ใช้ **Single WebRequest: `https://eaeze.com`** 100%
  * ซิงค์ข้อมูลละเอียดสูง (Full Telemetry + Prime Telemetry) ไปที่ `/api/sync-dashboard`
  * **Two-Way Remote Interactive:** รับคำสั่งจากหน้าเว็บเพื่อสั่งเปิด-ปิดโหมด `Close-Only` และ `Force Quarantine` รายคู่เงิน
  * **20-Pair Mean-Reversion Basket Rebalancing:**
    * ปรับตะกร้า 20 คู่เงินใหม่: เพิ่ม **`AUDNZD`**, **`CADCHF`**, **`NZDCAD`** แทนที่ **`AUDCAD`**, **`EURCHF`**, **`GBPCHF`**
    * **Graceful Shutdown & Auto-Collapse:** คู่ที่นำออกถูกตั้งเป็น Close-Only อัตโนมัติเพื่อเคลียร์ออเดอร์เก่า และเมื่อออเดอร์หมด แถวบนแดชบอร์ด MT5 จะยุบตัวหายไปเองทันที
  * **Interactive 3D On-Chart Controls:** ปุ่มกดเปิด-ปิดการทำงานรายคู่เงินแบบ 3 มิติ (ปุ่มนูน/ยุบ) บนกราฟ MT5
  * **Safe Liquidation Protocol (เอกสิทธิ์เฉพาะ PRIME):**
    * เมื่อสิทธิ์ License สิ้นสุดลงหรือถูกเพิกถอน EA จะไม่ทิ้งพอร์ตให้เคว้งคว้าง
    * บล็อกการเปิดไม้แรกและไม้แก้ใหม่ 100%
    * เฝ้าบริหารเส้น Take Profit รวมเพื่อปิดรวบออเดอร์เดิมที่ค้างอยู่อย่างปลอดภัย
    * เมื่อตรวจสอบว่าออเดอร์ในพอร์ตลดเหลือ 0 (`OrdersTotal() == 0`) ตัว EA จะสั่ง `ExpertRemove()` ถอดตัวเองออกจากกราฟทันที ป้องกันการนำไปรันต่อฟรี

---

## 📝 บันทึกประวัติเวอร์ชัน (Changelog History)

### 📌 Version 2.00-1009 / 1008 (9 ตุลาคม 2026)
* **Risk Management & 2-Way Command Synchronization:**
  * **Event-Driven Adaptive Quarantine [QT]:**
    * ปรับกลไกกักขังให้ตอบสนองทันทีเมื่อพอร์ตเข้าโหมด Freeze (`DD >= 28.0%`) โดยจะเลือกคู่ที่ติดลบสูงสุดที่แตะ Safety Floor (`DD >= 10.0%`) เข้าห้องขังเดี่ยวทันที พร้อม Failsafe ลากหลุดเดี่ยวที่ 25.0%
    * ปลดปล่อยเมื่อ DD ลดลงอย่างน้อย 4.0% จากจุดเข้าขัง และต้องผ่านเกณฑ์ Safe Ceiling Floor (`DD <= 8.0%`) ขังได้สูงสุด 3 คู่เงิน
  * **Hybrid Smart Rescue Grid Sniping [R1–R3]:**
    * จุดเข้าไม้กู้ภัยยืดหยุ่นตามจุดเข้าขังจริง (`Entry DD + 8.0%` ขั้นต่ำ 18.0%)
    * ติดตั้งฟิลเตอร์ `IsRescueExhaustionConfirmed()` สกัดกั้นอาการรับมีดร่วง (Anti-Falling Knife) ดักรอ Rejection Wick (>=35%), Reversal Candle หรือการพักตัวแบบ Range Contraction ก่อนยิงไม้กู้ภัย สูงสุด 3 ไม้
  * **100% Symbol Freeze Coverage (ปิดจุดบอดคู่ที่ 5):**
    * บล็อกการออกไม้กริดเพิ่มทันทีเมื่อคู่เงินใดก็ตามแตะ Freeze 8.0% ครอบคลุม 100% ทุกคู่ในพอร์ต
  * **เกราะความปลอดภัยมาตรฐานครบวงจร:**
    * Portfolio DD: Slow 18% / Freeze 28% / Resume 12%
    * Symbol Worst Throttle: Slow 5% / Freeze 8% / Resume 4% (ตรวจสอบครบ 100% ทุกคู่)
    * Quarantine Defense: ขังสูงสุด 3 คู่เงิน (Adaptive + Failsafe 25%)
    * Rescue Grid Sniping: สูงสุด 3 ไม้ (R1-R3) / ห่าง 100 pips / ก้าว 45 pips / เป้า 15 cent ตัดไม้ดอย
    * Auto-Hedge Lock: 40% DD (Single Worst, Net Delta = 0)
    * Currency Cluster: ถือสกุลเงินซ้ำได้สูงสุด 3 คู่ (`InpMaxCurrencyCluster = 3`)
    * Relief Fund: ปันผล 40% จากคู่ที่ปิดกำไร / เพดาน 5% ของ Balance
  * **แยกเวอร์ชันชัดเจน:** `v2.00-1008` (Stable Standalone ปิดระบบรีโมต) และ `v2.00-1009` (เปิด 2-Way Web Control)

### 📌 Version 2.00-1006 (6 ตุลาคม 2026)
* **Cash Flow Optimization & Telemetry Web Sync Upgrade:**
  * ปรับค่าพารามิเตอร์คลัสเตอร์สกุลเงิน `InpMaxCurrencyCluster` จาก **`2` เป็น `3`**
    * **เหตุผล:** ในพอร์ต 20 คู่เงิน มีสกุลเงินร่วมกันหนาแน่น (เช่น USD มีถึง 7 คู่, NZD 6 คู่, JPY 5 คู่) การจำกัดไว้ที่ 2 คู่เดิมทำให้พอร์ตถูกตัดโอกาสสร้างกระแสเงินสดมากเกินไป (บล็อกคู่ USD อื่นๆ ถึง 5 คู่เมื่อถืออยู่แล้ว 2 คู่)
    * การปรับเป็น 3 คู่ทำให้พอร์ตเก็บรอบกำไรสร้าง Cash Flow ได้ต่อเนื่องและเต็มประสิทธิภาพ ขณะที่ความเสี่ยงยังถูกควบคุมอย่างรัดกุมผ่านเกราะป้องกัน 5 ชั้นของ Prime (Quarantine 18% DD ขังสูงสุด 3 คู่, Sniper Rescue R1-R3 25% DD, กองทุน Relief Fund 40%, Portfolio Safety Slow 18%/Freeze 28%, และ Safe Liquidation Delta=0 Hedge 40%)
  * **Full Telemetry Web Integration (`https://eaeze.com`):**
    * ปรับปรุงหน้าเว็บ `admin/easym-prime-farm` ให้ดึงค่า Real Telemetry จาก MT5 และคำนวณสถานะพอร์ตแบบ Dynamic 100%
    * ซิงค์ค่า Port Mode (`NORMAL`, `SLOW`, `FREEZE`), Drawdown Amount/Percent, Relief Fund Balance (40% ของกำไรวัน), Worst Pair และ Quarantine Pairs อัตโนมัติ
  * คอมไพล์ไฟล์โปรดักชัน `EASY_M_Prime_v200_1006.ex5` (0 errors, 0 warnings) เรียบร้อยสมบูรณ์

### 📌 Version 2.00-1001 (ตุลาคม 2026)
* **Prime Architecture Upgrade:**
  * อัปเกรดไฟล์หลักเป็น `EASY_M_Prime_v200_1001.mq5`
  * **20-Pair Currency Basket Rebalancing:**
    * นำ 3 คู่เสี่ยงสูงออก: `AUDCAD` (ลากเทรนด์น้ำมัน), `EURCHF` (Range แคบ เสี่ยงแทรกแซงค่าเงิน), `GBPCHF` (Tail-risk กระชากรุนแรง)
    * เพิ่ม 3 คู่พฤติกรรม Mean-Reversion สูง: `AUDNZD` (#1 Grid pair), `CADCHF` (สวิงสมดุล), `NZDCAD` (รอบนุ่มนวล)
    * รองรับ Graceful Shutdown & Auto-Collapse แถวบนแดชบอร์ด MT5 เมื่อเคลียร์ไม้เก่าหมด
  * **Interactive 3D On-Chart Deck:** ปุ่มกด 3 มิตินูน/ยุบ สั่งเปิด-ปิดคู่เงินบนกราฟ MT5
  * ผนวกระบบความปลอดภัย **Safe Liquidation Protocol** (`ExpertRemove()` เมื่อเคลียร์ออเดอร์หมด)
  * รองรับหน้าฟาร์มไซไฟโฮโลแกรม Next-Gen Cyber Farm UI (4 Floating Orbs & 4 Glassmorphic HUD Overlays)
  * สลับการส่ง Farm Sync เข้า `https://eaeze.com/api/sync-dashboard` เป็น Single WebRequest 100%

### 📌 Version 2.00-0928 (กันยายน 2026)
* **Unified Engine Release:**
  * รวมสถาปัตยกรรมของ mini, Farm, MAX และ PRIME เข้าเป็นตระกูล v2.00
  * ปรับคู่เงินใหม่ 3 คู่ (นำ AUDNZD, CADCHF, NZDCAD เข้ามาแทนคู่ที่ผันผวนผิดปกติ)
  * เพิ่มระบบ Cross-Pair Profit Slicing (เฉือนกำไร 40% ไปช่วยตัดไม้ติดหล่ม)
  * เพิ่มระบบ Currency Cluster Limiter (จำกัดไม่ให้ถือคู่เงินตระกูลเดียวกันเกิน 2 คู่)
  * วางรากฐานระบบ Single WebRequest Whitelist เพื่อแก้ปัญหา Error 4060

---

## 🛠️ รายการไฟล์ที่เกี่ยวข้องในโปรเจกต์ (Codebase Map)

1. **ฝั่ง MQL5 Source Files (`Finishing EAeze Products/`):**
   * `EASY_M_mini_v200_0928.mq5` (mini)
   * `EASY_M_Farm_v200_0928.mq5` (Farm 5 พอร์ต)
   * `EASY_M_Max_v200_0928.mq5` (MAX)
   * `EASY_M_Prime_v200_1006.mq5` (PRIME ตัวท็อปล่าสุด)
   * `EM_MonitorAdapter.mqh` (ตัวคุมการซิงค์ข้อมูล — ชี้ไปที่ `https://eaeze.com/api/sync-dashboard` และ bypass ให้ mini/Farm)
2. **ฝั่ง Include Library (`ea-market-place/mt5_integration/Include/`):**
   * `EAE_Licensing.mqh` (ตัวตรวจสิทธิ์หลัก — ชี้ไปที่ `https://eaeze.com/api/verify-license` และ `https://eaeze.com/api/sync-dashboard`)
   * `EAE_WebSync.mqh` (โมดูลซิงค์ — ตั้งค่า default URL เป็น `https://eaeze.com/api/sync-dashboard`)
3. **ฝั่ง Web Backend Endpoints (`ea-market-place/src/app/api/`):**
   * `/api/verify-license` (ตรวจสิทธิ์ & รับ Balance/Equity)
   * `/api/sync-dashboard` (รับ Live Farm Telemetry & สั่งการรีโมต)
   * `/api/mt5/sync` (Universal modular fallback sync)
