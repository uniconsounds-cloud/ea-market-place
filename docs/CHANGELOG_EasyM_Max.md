# EasyM Max — Build & Version Changelog
บันทึกประวัติการพัฒนา ปรับปรุง และแก้ไขโค้ด EasyM Max ทุกเวอร์ชัน เพื่อใช้อ้างอิงทางเทคนิค

---

## 📌 สรุปแนวคิดทางสถาปัตยกรรม (Core Architecture)
- **ประเภทกลยุทธ์**: Correlation Grid Trading 10 คู่ขนาน (รวม 20 สัญลักษณ์)
- **เครื่องยนต์หลัก**: 1 Symbol = 1 Independent Engine (แยกรหัส Magic Number ตามสัญลักษณ์)
- **การจัดการความเสี่ยง**: Portfolio 3-Mode (`NORMAL` / `SLOW` / `FREEZE`) ร่วมกับ Worst-Symbol Throttle
- **ระบบออกไม้ปกติ**: Grid ระยะคงที่ 15 Pips (`InpGridDistancePips = 15`) + ตัวคูณล็อตแบบบันไดขั้นบันได (`LadderLot`)
- **การปิดทำกำไร**: Full Basket Exit ปิดรวบกำไรแยกฝั่ง Buy/Sell ตามเกณฑ์เป้าหมายเงิน
- **การเชื่อมต่อ**: Hybrid Direct-to-Supabase RPC (`sync_ea_data`) + Web Viewer Ping (20s/10m) + License Auth ทุก 12 ชม.
- **ระบบจัดเก็บสถิติ**: Basket Closure Telemetry ส่งข้อมูลการรวบปิดไม้แบบละเอียดเข้า Supabase ทุกรอบ

---

## 📋 ประวัติการแก้ไขราย Build (Build History)

### 🔹 [B261026.1] — EasyM Max v2.00 (Current Production)
- **ไฟล์ซอร์สโค้ด**: `EasyM_Max_v200_B261026_1.mq5`
- **วันที่ปล่อย**: 2026-10-26
- **รายละเอียดการปรับปรุง**:
  1. **Basket Closure Telemetry Integration**: เชื่อมต่อโมดูล `EM_TriggerBasketEvent` ในฟังก์ชัน `TryExit()` ทุกครั้งที่มีการรวบปิดไม้สำเร็จ
  2. **Rich Performance Tracking**: บันทึกข้อมูลการรวบไม้ส่งขึ้น Supabase ครบถ้วน:
     - `symbol` (คู่เงินที่ปิด)
     - `side` (ฝั่ง Buy หรือ Sell)
     - `exit_type` (`FULL_BASKET_TP`)
     - `orders_count` (จำนวนไม้ที่ถูกรวบปิดในชุดนั้น)
     - `total_lots` (ผลรวม Lot ทั้งหมดของชุด)
     - `profit` (กำไรสุทธิที่ทำได้)
     - `duration_sec` (ระยะเวลาถือครองตั้งแต่เปิดไม้แรกจนถึงปิดรวบ)
     - `max_dd_pct` (ระดับ Drawdown สูงสุดของคู่นั้นก่อนรวบปิด)
  3. **Immediate OnTimer Push**: สั่งบังคับซิงค์สถานะพอร์ตทันทีหลังรวบปิด (`EM_MonitorOnTimer("", true)`) ทำให้ตัวเลข Balance และ Equity บน Web Dashboard อัปเดตแบบเรียลไทม์โดยไม่ต้องรอจังหวะ Timer
  4. **Dual-Redundancy Caching**: แคชข้อมูลไม้รวบล่าสุด (`last_basket`) ไว้ในหน่วยความจำและแนบไปกับ Heartbeat Telemetry ป้องกันข้อมูลสถิติตกหล่นกรณีเกิด Network Timeout

---

### 🔹 [B261013.1] — EasyM Max v2.00
- **ไฟล์ซอร์สโค้ด**: `EasyM_Max_v200_B261013_1.mq5` / `EasyM_Max_v200_B261013_1.ex5`
- **วันที่ปล่อย**: 2026-10-13
- **รายละเอียดการปรับปรุง**:
  1. **Hybrid Direct-to-Supabase RPC**: ปรับการส่งข้อมูล Telemetry ไปยังฐานข้อมูล Supabase โดยตรงผ่านฟังก์ชัน RPC `sync_ea_data` เพื่อลดภาระเซิร์ฟเวอร์เว็บ
  2. **10-Minute Auto-Fallback (`FALLBACK_1URL`)**: หากการเชื่อมต่อ Supabase ล้มเหลวหรือติดขัด จะสลับไปส่งข้อมูลผ่าน URL สำรอง `https://eaeze.com/api/sync-dashboard` โดยอัตโนมัติ
  3. **Unified Single-Loop OnTimer**: รวมลูปเวลาให้ทำงานอัจฉริยะ ปรับ Polling Rate เป็น 20 วินาทีเมื่อมีผู้ใช้งานกำลังดูสดบนหน้าเว็บแดชบอร์ด และสแตนด์บาย 10 นาที (600 วินาที) เมื่อไม่มีคนดู
  4. **EAE_Licensing Integration**: ตรวจสอบความถูกต้องของสิทธิ์การใช้งานผ่าน `EaezeCheckLicensePeriodic` ทุกๆ 12 ชั่วโมงอย่างแม่นยำ
  5. **Pure Max Preservation**: คงตรรกะการเทรดแบบคลาสสิกของ Max ไว้ 100% (ไม่มีระบบ Quarantine และไม่มีไม้กู้ภัย เพื่อความเบาและเสถียรสูงสุด)

---

### 🔹 [v2.00 0928] — EasyM Max Universal
- **ไฟล์ซอร์สโค้ด**: `EASY_M_Max_v200_0928.mq5` / `EASY_M_Max_v200_0928.ex5`
- **วันที่ปล่อย**: 2026-09-28
- **รายละเอียดการปรับปรุง**:
  1. รวมฟังก์ชัน Universal Auto-Detection สำหรับตรวจจับ Suffix ของคู่เงินโบรกเกอร์อัตโนมัติ (เช่น `.m`, `_i`, `c`)
  2. ปรับแต่ง Dashboard แบบ Flat solid bars ป้องกันปัญหาเส้นขอบสีส้มกวนตาสายตา
  3. รองรับการทำงานร่วมกับระบบ Farm UI โครงสร้างใหม่

---

### 🔹 [v1.16 0904] — Basket Exit Lockout Fix
- **วันที่ปล่อย**: 2026-09-04
- **รายละเอียดการปรับปรุง**:
  1. ปลดล็อกและตัดพารามิเตอร์ `InpAvoidMultiExitBar` ออก เพื่อให้ระบบสามารถปิดรวบไม้ทั้งพวง (Full Basket Close) ได้ทันทีเมื่อแตะเป้ากำไร โดยไม่ติดหน่วงแท่งเทียน
  2. ปรับปรุงระบบตรวจจับ Broker Order Filling Mode ในจังหวะปิดออเดอร์ให้เข้ากันได้กับทุกโบรกเกอร์

---

### 🔹 [v1.14 - v1.15 0810-0820] — Sync & Staggered Boot Optimization
- **วันที่ปล่อย**: 2026-08-10 ถึง 2026-08-20
- **รายละเอียดการปรับปรุง**:
  1. เพิ่ม Staggered Boot Delay (หน่วงเวลาสุ่ม 0–120 วินาทีตอนเปิดพอร์ตพร้อมกันหลายพอร์ต) เพื่อกระจายโหลดไม่ให้ยิง Request พร้อมกัน
  2. เพิ่ม Day-Change Staggered Auto History Sync ซิงค์ประวัติย้อนหลัง 7 วันอัตโนมัติเมื่อขึ้นวันใหม่เพื่อซ่อมแซมข้อมูลที่อาจตกหล่น

---

### 🔹 [v1.0 e1.1 - 0530 Universal] — Early Development Baseline
- **ไฟล์ซอร์สโค้ด**: `EASY_M Max 0322_license.mq5`, `EASY_M Max 0324_license.mq5`
- **รายละเอียดการปรับปรุง**:
  1. พัฒนาสถาปัตยกรรม 10 Pairs Correlation (20 Symbols)
  2. ระบบความปลอดภัย Portfolio 3-Mode (`NORMAL`/`SLOW`/`FREEZE`)
  3. ระบบ Worst-Symbol Throttle หยุดออกไม้เพิ่มในคู่ที่ผลงานแย่ที่สุด
  4. Licensing Guard V2 ระบบตรวจสอบสิทธิ์ผ่านแคชและผ่อนผัน Grace Period
