# EasyM Prime — Build & Version Changelog
บันทึกประวัติการพัฒนา ปรับปรุง และแก้ไขโค้ด EasyM Prime ทุกเวอร์ชัน เพื่อใช้อ้างอิงทางเทคนิค

---

## 📌 สรุปแนวคิดทางสถาปัตยกรรม (Core Architecture)
- **ประเภทกลยุทธ์**: Correlation Grid Trading + Multi-Tier Dynamic Rescue Grid + Quarantine Dome
- **ระบบออกไม้ปกติ**: Grid ระยะคงที่ 15 Pips (`InpGridDistancePips = 15`) + ขั้นบันไดล็อตแบบคงที่เหมือน EasyM Max
- **ระบบความปลอดภัยเมื่อวิกฤต**:
  - **Quarantine Dome**: กักขังเดี่ยวเมื่อคู่เงิน Drawdown $\ge$ 10% (หยุดออกไม้ปกติทันที และตัดคู่นี้ออกจาก DD คำนวณภาพรวม)
  - **Cascading Rescue Grid**: ระบบไม้กู้ภัย 3 ระดับ (Tier 1-3) ระยะห่าง 45 pips / 1.0 ATR และสเต็ป 35 pips พร้อม Price Action Candle Exhaustion
  - **Anchor Handover**: หาก DD ลดลงต่ำกว่าเกณฑ์ จะคงไม้กู้ภัยที่ดีที่สุดไว้ 1 ไม้ (Anchor) เพื่อดึงจุดคุ้มทุนทั้งพวงเข้าใกล้ราคาปัจจุบัน
  - **Relief Fund**: เจียดกำไรจากคู่ที่รันปกติมาช่วยปิดไม้ภาระ (Trim toxic orders) แบบ 3-to-1
  - **Single-Pair Auto-Hedge**: ล็อกความเสี่ยงขั้นสูงสุดเมื่อขาดทุนเกินพิกัด
- **การเชื่อมต่อ**: 2-Way Remote Web Control (`EM_WebControl.mqh`) + Hybrid Direct-to-Supabase RPC (`sync_ea_data`) + Active Viewer Polling
- **ระบบจัดเก็บสถิติ**: Basket Closure Telemetry ส่งข้อมูลการรวบปิดไม้ทุกระดับ (Full Exit, Rescue Scalp, Relief Trim) เข้า Supabase

---

## 📋 ประวัติการแก้ไขราย Build (Build History)

### 🔹 [B261027.1] — EasyM Prime v2.10 (Multi-Zone Safety & Carousel Alert Ticker) (Current Production)
- **ไฟล์ซอร์สโค้ด**: `EasyM_Prime_v210_B261027_1.mq5` / `EasyM_Prime_v210_B261027_1.ex5`
- **วันที่ปล่อย**: 2026-10-27
- **รายละเอียดการปรับปรุง**:
  1. **Portfolio Multi-Zone Safety Engine**: ปรับโครงสร้างเกณฑ์ความปลอดภัยตาม DD รวมของพอร์ต 4 โซน เพื่อให้พอร์ตไม่ค้างและกู้ภัยต่อเนื่องได้อย่างราบรื่น:
     - **Zone 1 [DD รวม < 60%]**: *Full Multi-Rescue* ปล่อยกู้ภัยอิสระทุกคู่ในห้องขัง ทำงานเต็มกำลัง 100%
     - **Zone 2 [DD รวม 60% - 70%]**: *Staggered Queue* จำกัดกู้ภัยทีละ 1 คู่ (เลือกคู่ DD ต่ำสุดก่อนเพื่อให้จบเร็ว) พร้อมแจ้งเตือน Buffer ระดับ 1
     - **Zone 3 [DD รวม 70% - 80%]**: *Safety Rescue Pause* หยุดออกไม้กู้ภัยใหม่ทุกคู่ชั่วคราว (แต่รอสแคปปิดกำไรไม้เดิมตามปกติ) พร้อมแจ้งเตือน Buffer ระดับ 2
     - **Zone 4 [DD รวม > 82%]**: *Emergency Auto-Hedge Lock* ล็อกความเสี่ยงพอร์ต 100% (Delta = 0) ป้องกันพอร์ตแตก
  2. **Two-Tier Auto-Hedge Architecture (กลไกล็อกความเสี่ยง 2 ชั้น)**:
     - **Tier 1: Single-Pair Auto-Hedge (40%) [เบรกรายล้อ]**: ทำงานเมื่อคู่เงินเดี่ยวในห้องขังขาดทุนแตะ `DD >= 40.0%` ระบบจะส่งคำสั่งสวนทาง 1 ไม้เพื่อให้ Delta = 0 แช่แข็งผลขาดทุนของคู่นั้นทันที ไม่ให้ลามไปฉุดคู่อื่น แม้พอร์ตรวมจะยังอยู่ที่ 40-50%
     - **Tier 2: Portfolio Emergency Hedge (Zone 4: 82%) [เบรกมือฉุกเฉินระดับพอร์ต]**: ป้องกันกรณีวิกฤตพร้อมกันหลายคู่ (เช่น 3 คู่ติดลบคู่ละ 25-30% รวมเป็น 83% แต่ไม่มีคู่ใดถึง 40% เดี่ยวๆ) ระบบจะตรวจพบว่า DD รวมพอร์ตแตะ 82% และสั่งล็อกคู่ที่แย่ที่สุดทันที พร้อมสั่ง **Freeze หยุดออกไม้ใหม่ทุกชนิดทั้งพอร์ต 100%** เพื่อรักษาชีวิตพอร์ตไว้
     - **กลไกการปลดไม้ Hedge**:
       1. *Dynamic Relief Trim*: กองทุน Relief Fund ทยอยนำกำไรของคู่อื่นมาตัดปิดไม้ Toxic ทิ้งทีละไม้ พร้อมลดขนาดไม้ Hedge ตามลงไปทันที (`TrimMatchingHedgeLot`) จนหมดพวง
       2. *Buffer Inflow*: เมื่อผู้ใช้เติมเงินทุนสำรองตามคำแนะนำ DD รวมจะลดต่ำกว่า Zone 4 ทันที
       3. *Close Basket*: ปลดรวบทั้งชุดเมื่อตลาด Rebound กลับมาจุดคุ้มทุน หรือสั่งผ่าน Remote Web Control
  3. **Single-Pair Safety Ceiling (30%)**: ตรวจสอบเกราะป้องกันพอร์ตแตกเฉพาะคู่เงินเดี่ยวที่ `DD >= 30.0%` โดยไม่นำ DD รวมพอร์ตมาบล็อกการกู้ภัย
  4. **Table F Executive Carousel Alert Ticker**: ปรับปรุงหน้าจอแถบล่างสุด (Table F) ให้หมุนวนสลับข้อความอัตโนมัติทุกๆ 4 วินาที คัดเลือกเฉพาะ 3 แกนสำคัญที่สั้น กระชับ เข้าใจง่าย:
     - **Port Status**: แสดงสถานะพอร์ตหลัก ต่อด้วยสถานะกู้ภัย เช่น `Port Status : Normal | Rescue Active`
     - **Buffer Advice**: แนะนำการเติมทุนสำรองเพื่อปรับระดับ DD เช่น `Buffer Advice : Add $187 to 35%DD (Comfort) | Add $682 to 25%DD (Safe)` (หรือแสดง `Buffer : Safe (DD 4.1%) | Cushion : $209 USD to 25%DD` เมื่อ DD < 25%)
     - **Margin Radar**: สรุปสถานะเลเวอเรจแบบเข้าใจง่าย เช่น `Margin : Normal 1,203% | Free Margin : $625 USD`
     - **Outside Trades**: ตรวจจับและแจ้งเตือนทันทีเมื่อมีไม้กดมือนอกระบบ หรือไม้ทองคำ XAUUSD มารบกวน Margin
  5. **Full Backward Compatibility**: รองรับการนำไปติดตั้งทับพอร์ตเดิมที่กำลังรันอยู่ได้ทันที สามารถแยกแยะไม้กู้ภัยค้างเดิม (เช่น 4 ไม้) และรวบปิดไม้ล่าสุดเมื่อมีกำไรได้อย่างแม่นยำ 100%

### 🔹 [B261026.2] — EasyM Prime v2.10 (Current Production)
- **ไฟล์ซอร์สโค้ด**:  / 
- **วันที่ปล่อย**: 2026-10-26
- **รายละเอียดการปรับปรุง**:
  1. **Relative Dynamic Tier Escalation**: ปรับเกณฑ์การยกระดับ Tier กู้ภัย (Tier 1 $
ightarrow$ Tier 2 $
ightarrow$ Tier 3) ให้คำนวณแบบ Relative จากระดับ DD ที่เกิดขึ้นจริง ณ ไม้สุดท้ายของ Tier ก่อนหน้า (+3.0% ถึง +4.0%) แทนการฟิกซ์ตัวเลขตายตัว (10/14/18%) แก้ปัญหาพอร์ตที่เปิดใช้งานครั้งแรกแล้วมีคู่เงินติดลบสูงอยู่แล้ว (เช่น 20%) ให้ระบบกู้ภัยทำงานได้อย่างถูกต้องแม่นยำ
  2. **Dynamic Rescue Scalp Re-Entry**: แก้ปัญหาหยุดนิ่งหลังปิดรวบสแคปชุดไม้กู้ภัยสำเร็จ (เช่น หลังปิด Tier 2) โดยบันทึกระดับราคาปิดเป็น Anchor ชั่วคราว เมื่อกราฟ Sideway และย่อตัวลงมา 15 Pips (หรือ 0.5 ATR) ร่วมกับแท่งเทียนชะลอตัว ระบบจะสามารถเริ่มรอบสแคปกู้ภัยชุดใหม่ในโซนราคาปัจจุบันได้ทันที
  3. **Safety Margin Ceiling**: เพิ่มระบบความปลอดภัยล็อกการออกไม้กู้ภัยใหม่เมื่อ DD เดี่ยวของคู่เงินแตะ 30.0% (ตัดเงื่อนไข DD รวมพอร์ตออก เพื่อไม่ให้ปิดกั้นโอกาสกู้ภัยเมื่อพอร์ตมีคู่เงินอื่นติดลบร่วม) เพื่อปกป้อง Margin ไม่ให้พอร์ตเสี่ยงเกินพิกัด

### 🔹 [B261026.2] — EasyM Prime v2.10 (Current Production)
- **ไฟล์ซอร์สโค้ด**: `EasyM_Prime_v210_B261026_2.mq5` / `EasyM_Prime_v210_B261026_2.ex5`
- **วันที่ปล่อย**: 2026-10-26
- **รายละเอียดการปรับปรุง**:
  1. **Relative Dynamic Tier Escalation**: ปรับเกณฑ์การยกระดับ Tier กู้ภัย (Tier 1 -> Tier 2 -> Tier 3) ให้คำนวณแบบ Relative จากระดับ DD ที่เกิดขึ้นจริง ณ ไม้สุดท้ายของ Tier ก่อนหน้า (+3.0% ถึง +4.0%) แทนการฟิกซ์ตัวเลขตายตัว (10/14/18%) แก้ปัญหาพอร์ตที่เปิดใช้งานครั้งแรกแล้วมีคู่เงินติดลบสูงอยู่แล้ว (เช่น 20%) ให้ระบบกู้ภัยทำงานได้อย่างถูกต้องแม่นยำ
  2. **Dynamic Rescue Scalp Re-Entry**: แก้ปัญหาหยุดนิ่งหลังปิดรวบสแคปชุดไม้กู้ภัยสำเร็จ (เช่น หลังปิด Tier 2) โดยบันทึกระดับราคาปิดเป็น Anchor ชั่วคราว เมื่อกราฟ Sideway และย่อตัวลงมา 15 Pips (หรือ 0.5 ATR) ร่วมกับแท่งเทียนชะลอตัว ระบบจะสามารถเริ่มรอบสแคปกู้ภัยชุดใหม่ในโซนราคาปัจจุบันได้ทันที
  3. **Safety Margin Ceiling**: เพิ่มระบบความปลอดภัยล็อกการออกไม้กู้ภัยใหม่เมื่อ DD เดี่ยวของคู่เงินแตะ 30.0% (ตัดเงื่อนไข DD รวมพอร์ตออก เพื่อไม่ให้ปิดกั้นโอกาสกู้ภัยเมื่อพอร์ตมีคู่เงินอื่นติดลบร่วม) เพื่อปกป้อง Margin ไม่ให้พอร์ตเสี่ยงเกินพิกัด

### 🔹 [B261026.1] — EasyM Prime v2.10 (Baseline Telemetry) (Baseline Telemetry) (Current Production)
- **ไฟล์ซอร์สโค้ด**: `EasyM_Prime_v210_B261026_1.mq5`
- **วันที่ปล่อย**: 2026-10-26
- **รายละเอียดการปรับปรุง**:
  1. **Comprehensive Basket Telemetry Integration**: เชื่อมต่อโมดูล `EM_TriggerBasketEvent` ในทุกรูปแบบการปิดทำกำไร:
     - **Full Basket Exit**: แยกประเภทเป็น `FULL_BASKET_TP` (พอร์ตปกติ) หรือ `QUARANTINE_FULL_EXIT` (ชุดที่หลุดพ้นจากโดมกักขัง)
     - **Independent Rescue Scalp Exit**: บันทึกสถิติเมื่อชุดไม้กู้ภัยปิดสแคปรวบกำไรอิสระ (`RESCUE_TIER_SCALP_TP` หรือ `RESCUE_ALL_SCALP_TP`) พร้อมจำนวนไม้และล็อตกู้ภัยที่ปิด
     - **Relief Fund Trim**: บันทึกสถิติทุกครั้งที่มีการใช้กำไรกองทุนตัดปิดไม้ภาระ (`RELIEF_TRIM`)
  2. **Rich Metric Attributes**: บันทึกรายละเอียดครบถ้วน: `symbol`, `side`, `exit_type`, `orders_count`, `total_lots`, `profit`, `duration_sec`, `max_dd_pct`
  3. **Immediate OnTimer Push**: สั่งบังคับซิงค์สถานะพอร์ตทันทีหลังรวบปิด (`EM_MonitorOnTimer(BuildPrimeTelemetryJson(), true)`) เพื่อให้ Web Dashboard อัปเดต Margin และสถิติแบบเรียลไทม์
  4. **Dual-Redundancy Caching**: แคชข้อมูลไม้รวบล่าสุด (`last_basket`) ไว้ในหน่วยความจำและแนบไปกับ Heartbeat Telemetry ป้องกันข้อมูลสถิติตกหล่นกรณีเกิด Network Timeout

---

### 🔹 [B261025.1] — EasyM Prime v2.10 Release Candidate
- **ไฟล์ซอร์สโค้ด**: `EasyM_Prime_v210_B261025_1.mq5` / `EasyM_Prime_v210_B261025_1.ex5`
- **วันที่ปล่อย**: 2026-10-25
- **รายละเอียดการปรับปรุง**:
  1. **Production Freeze & Release**: รวบรวมฟังก์ชันความเสถียรทั้งหมดจากซีรีส์ B261023 เป็นเวอร์ชันพร้อมใช้งานจริง
  2. ปรับปรุงเวอร์ชันสตริงเป็น `v2.10-1025` รหัส Build `B261025.1`

---

### 🔹 [B261023.1 – B261023.10] — Phase 2 Overhaul: 2-Way Web Control & Pure DD Isolation
- **ไฟล์ซอร์สโค้ด**: `EasyM_Prime_v210_B261023_1.mq5` ถึง `EasyM_Prime_v210_B261023_10.mq5`
- **วันที่ปล่อย**: 2026-10-23 ถึง 2026-10-24
- **รายละเอียดการปรับปรุงแต่ละ Build ย่อย**:
  - **B261023.1**: ปรับเกณฑ์ตัวเลขให้รัดกุม: `InpQuarantineSinglePairPct = 10.0%`, `InpAnchorGatePct = 9.0%`, `InpQuarantineResumePct = 8.0%`, ระยะ Gap กู้ภัยแรก 45 pips / 1.0 ATR, สเต็ป 35 pips
  - **B261023.2**: เพิ่มระบบตรวจจับการเทรดภายนอก/การเทรดมือ (`Scan External / Manual Trades`) เพื่อเตรียมแยกความบริสุทธิ์ของ Drawdown
  - **B261023.3**: เพิ่มระบบ Stamped Exit Comment ลงในประวัติ MT5 Deal OUT เช่น `RescueCut:SYM:#Ticket` และปรับปรุง Magic Number ก่อนปิดไม้
  - **B261023.4 – B261023.6**: ผนวกรวมโมดูล **2-Way Web Control** (`EM_WebControl.mqh`) รองรับการสั่งงานรีโมตจาก Web Dashboard เช่น สั่ง Pause/Resume, สั่งปิดไม้ หรือเปลี่ยนโหมดแบบเกือบเรียลไทม์
  - **B261023.7 – B261023.9**: ปรับปรุง Event การคลิกสลับปุ่มบนชาร์ตให้ยิงส่งสถานะอัปเดตขึ้น Supabase ทันที (`EM_MonitorOnTimer(..., true)`) โดยไม่ต้องรอจังหวะครบรอบ Timer
  - **B261023.10**: **Strict Isolation Engine**: คัดกรองออเดอร์ภายนอกอย่างเด็ดขาด (เช่น ไม้ทองคำ XAUUSD, คริปโต หรือไม้กดมือ) ไม่ให้นำมาคำนวณปะปนกับ DD ของ EasyM Prime เพื่อให้ระบบตัดสินใจเข้าโหมดกู้ภัยได้อย่างแม่นยำ 100%

---

### 🔹 [B261014.1] — Multi-Tier Cascading Rescue & Anchor Handover Upgrade
- **ไฟล์ซอร์สโค้ด**: `EasyM_Prime_v200_B261014_1.mq5` / `EasyM_Prime_v200_B261014_1.ex5`
- **วันที่ปล่อย**: 2026-10-14
- **รายละเอียดการปรับปรุง**:
  1. **Multi-Tier Cascading Rescue Grid**: แบ่งชั้นการกู้ภัยเป็น 3 Tiers (Tier 1 $\rightarrow$ Tier 2 $\rightarrow$ Tier 3) สูงสุด Tier ละ 3 ไม้ รวมไม่เกิน 9 ไม้กู้ภัย
  2. **100% Price Action Exhaustion Confirmation**: กรองการออกไม้กู้ภัยทุกไม้ด้วยการชะลอตัวของราคา (Candle Exhaustion) + ระยะ ATR ป้องกันการสวนเทรนด์แรง
  3. **Independent Rescue Basket Profit Taking**: ให้สิทธิ์ชุดไม้กู้ภัยปิดรวบเก็บกำไรวงสั้นแบบอิสระเมื่อกำไรแตะเป้าเงิน (`InpRescueTargetMoney`)
  4. **Anchor Handover Protocol**: เมื่อ DD ลดลงมาจนแตะระดับปลอดภัย จะคงไม้กู้ภัยชั้นยอดไว้ 1 ไม้เพื่อทำหน้าที่เป็น "สมอ (Anchor)" ช่วยลากจุด Take Profit ของไม้ปกติทั้งพวงให้ขยับลงมาปิดได้ง่ายขึ้น
  5. **3-to-1 Profit-to-Trim Rule**: บังคับให้ชุดกู้ภัยทำกำไรสแคปให้สำเร็จอย่างน้อย 3 รอบก่อน จึงจะอนุญาตให้นำงบกำไรไปตัดปิดไม้เก่าที่มีภาระ 1 ไม้
  6. **Cold-Boot State Persistence**: บันทึกและกู้คืนสถานะการกู้ภัยผ่าน MT5 GlobalVariables กรณีเทอร์มินัลรีสตาร์ต

---

### 🔹 [B261011.1 – B261013.2] — Prime Fleet & Smart 3 Rescue
- **ไฟล์ซอร์สโค้ด**: `EasyM_Prime_v200_B261011_1.mq5` ถึง `EasyM_Prime_v200_B261013_2.mq5`
- **วันที่ปล่อย**: 2026-10-11 ถึง 2026-10-13
- **รายละเอียดการปรับปรุง**:
  1. กำหนด Magic Number เฉพาะสำหรับไม้กู้ภัย (`InpMagicBase + 2000`)
  2. จัดโครงสร้าง Comment ออเดอร์ตามมาตรฐานสากล: `EMP:SYM:B1`, `EMP:SYM:S1`, `EMP:SYM:R1`, `EMP:SYM:HDG`
  3. ติดตั้งช่องทางการสื่อสาร Direct-to-Supabase RPC ร่วมกับ Fallback 1-URL

---

### 🔹 [v1.17 0922 – 1008] — The Resilience & Rescue Foundation
- **ไฟล์ซอร์สโค้ด**: `EASY_M_Prime_v200_0928.mq5` ถึง `EASY_M_Prime_v200_1008.mq5`
- **วันที่ปล่อย**: 2026-09-22 ถึง 2026-10-08
- **รายละเอียดการปรับปรุง**:
  1. ถือกำเนิดคอนเซปต์ **Quarantine Symbol Mode** (ระบบโดมแยกขังคู่เงินเดี่ยวเมื่อ DD แตะ 10%)
  2. ติดตั้ง **Currency Cluster Limiter** (จำกัดไม่ให้มีคู่เงินในสกุลเดียวกันทำงานพร้อมกันเกินโควตา เช่น สกุล JPY ไม่เกิน 3 คู่)
  3. ติดตั้งระบบตัดไม้ขาดทุนด้วยกำไรของคู่ที่แข็งแรง (**Cross-Pair Profit Slicing**)
  4. ปรับเปลี่ยนคู่เงินที่ทรงตัวไม่ดี 3 คู่ โดยนำ AUDNZD, CADCHF, NZDCAD เข้ามาทดแทน
