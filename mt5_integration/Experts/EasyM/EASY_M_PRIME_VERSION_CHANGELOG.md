# EasyM Prime Version Changelog & Release Notes

เอกสารบันทึกประวัติการพัฒนาและฟีเจอร์ของ EA ตระกูล **EasyM Prime Universal (v2.00)** แต่ละเวอร์ชัน เพื่อใช้อ้างอิง เปรียบเทียบความแตกต่าง และเลือกเวอร์ชันใช้งานได้อย่างถูกต้อง รวดเร็ว โดยไม่ต้องย้อนอ่านโค้ดทั้งหมด

---

## สรุปภาพรวมเวอร์ชัน (Quick Reference)

| เวอร์ชัน | วันที่ปล่อย | วัตถุประสงค์หลัก / สถานะ | การสั่งการผ่านหน้าเว็บ (2-Way) | โค้ดหลัก |
| :--- | :--- | :--- | :--- | :--- |
| **v2.00-1014** | 2026-10-14 | **Multi-Tier Cascading Rescue & Anchor Handover Edition** | Standalone Local Engine | `EasyM_Prime_v200_B261014_1.mq5 / .ex5` |
| **v2.00-1008** | 2026-10-08 | **Stable Standalone Release (เวอร์ชันเสถียรหลักสำหรับลูกค้าทั่วไป)** | ❌ ปิด (ทำงานแบบ MT5 Standalone ไม่รับคำสั่งรีโมต) | `EASY_M_Prime_v200_1008.mq5 / .ex5` |
| **v2.00-1009** | 2026-10-09 | **2-Way Command & Control Edition (เวอร์ชันเชื่อมโยงสั่งงานหน้าเว็บฟาร์ม)** | ✅ เปิดเต็มระบบ (Web Priority + สวิตช์ F7 Authority) | `EASY_M_Prime_v200_1009.mq5 / .ex5` + `EM_WebControl.mqh` |
| **v2.00-1006** | 2026-10-06 | Cent Account Normalization & Relief Fund Budget Capping | ❌ ส่งข้อมูลขึ้นเว็บทางเดียว (One-Way Telemetry) | `EASY_M_Prime_v200_1006.mq5 / .ex5` |
| **v2.00-1001** | 2026-10-01 | Auto-Hedge Delta=0 & Multi-speed Port Modes (SLOW/FREEZE) | ❌ ส่งข้อมูลขึ้นเว็บทางเดียว (One-Way Telemetry) | `EASY_M_Prime_v200_1001.mq5 / .ex5` |
| **v2.00-0928** | 2026-09-28 | Prime Portfolio Core Architecture (20-23 Pairs) | ❌ ส่งข้อมูลขึ้นเว็บทางเดียว (One-Way Telemetry) | `EASY_M_Prime_v200_0928.mq5 / .ex5` |

---

## รายละเอียดการเปลี่ยนแปลงแต่ละเวอร์ชัน (Detailed Changelog)

### [v2.00-1014] - 2026-10-14 / [Build B261014.1] (Multi-Tier Cascading Rescue & Anchor Handover Edition)
> **สถานะ:** สถาปัตยกรรมกู้ภัยหลายระดับขั้นบันได (Multi-Tier Cascading) ผสานการส่งต่อไม้ถ่วงสมอราคา (Anchor Handover) ขจัดจุดบอดไม้กู้ภัยติดล็อก และสร้าง Cash Flow รายวันอย่างมั่นคง

* **ฟีเจอร์และการปรับปรุงใหม่ (New Features & Architecture Enhancements):**
  1. **สถาปัตยกรรมกู้ภัย 3 ระดับขั้นบันได (Multi-Tier Cascading Rescue Grid):**
     * แบ่งการกู้ภัยออกเป็น 3 ระดับอย่างเป็นระบบ (Tier 1: ไม้ 1–3, Tier 2: ไม้ 4–6, Tier 3: ไม้ 7–9) รวมสูงสุดไม่เกิน 9 ไม้ (Hard Cap)
     * ยกระดับเมื่อราคาไหลต่อเนื่องโดย DD เพิ่มขึ้นทีละ $+4.0%$ จากจุดเปิดของ Tier ก่อนหน้า
     * คำนวณขนาดล็อตต่อเนื่องตามสูตร Ladder Lot และมีเพดานกำกับเด็ดขาดไม่เกิน 1.10 lot
  2. **จุดออกไม้แรกยืดหยุ่นสัมพันธ์กับจุดเข้าขัง (Dynamic Rescue Trigger & Distance Gate):**
     * ออกไม้กู้ภัยเมื่อ DD แตะ `Quarantine Entry DD + 4.0%` (เช่น ขังเดี่ยว 14% -> เริ่มกู้ภัย 18%, ขังพอร์ต 10% -> เริ่มกู้ภัย 14%)
     * ติดตั้ง Distance Gate ต้องห่างจากไม้ปกติไม้สุดท้ายอย่างน้อย $1.0\text{ ATR (Daily)}$ หรือ 80–100 pips ป้องกันการออกไม้ถี่
  3. **ตรวจสอบพฤติกรรมแท่งเทียน 100% บนทุกไม้กู้ภัย (Price Action Exhaustion on All Rescue Orders):**
     * บังคับใช้ `IsRescueExhaustionConfirmed()` กับไม้กู้ภัยทุกไม้ (R1 ถึง R9) เพื่อดักจับ Rejection Wick $\ge 35\%$, Reversal Bar, หรือการชะลอตัวของราคา (Consolidation Box)
     * บล็อกการรับมีดร่วง (Anti-Falling Knife) เด็ดขาดหากแท่งเทียนเป็น Waterfall / Rocket Spike
  4. **ปิดรวบชุดกู้ภัยทำกำไรอิสระ (Independent Rescue Basket Profit Taking):**
     * ปลดล็อกเงื่อนไขเดิมที่เคยติดล็อก `count < 3` สามารถปิดรวบทำกำไรได้ทันทีเมื่อกำไรของชุดกู้ภัย $\ge 20\text{ Cent}$ ไม่ว่าจะมี 1, 2 หรือ 3 ไม้ก็ตาม
     * กำไร $60\%$ นำเข้า Balance เป็น Cash Flow ทันที และ $40\%$ เข้ากองทุน Relief Fund
  5. **ระบบส่งต่อไม้ถ่วงสมอ (Anchor Handover at 12% DD):**
     * เมื่อผลรวม DD ของคู่เงินลดลงมาแตะ $\le 12.0\%$ ระบบจะหยุดการ Scalp ปิดทิ้งชุดกู้ภัย
     * สงวนไม้กู้ภัยที่ได้เปรียบราคาที่สุด 1 ไม้ (Anchor Order: Buy ต่ำสุด หรือ Sell สูงสุด) ทิ้งไว้เพื่อดึงจุด TP/BE ของตระกร้าหลักทั้งหมดให้รวบได้เร็วยิ่งขึ้น
  6. **กฎตัดไม้ติดลบ 3 ต่อ 1 (3-to-1 Profit-to-Trim Rule):**
     * บังคับให้ชุดกู้ภัยทำกำไรสำเร็จครบ 3 รอบก่อน จึงจะดึงเงิน Relief Fund ไปตัดปิดไม้ติดลบของตระกร้าปกติ 1 ไม้ (ไม้ที่ดอยลึกที่สุด)
     * ช่วยให้พอร์ตมีกำไรสุทธิสม่ำเสมอและไม่กินทุน
  7. **ปลดปล่อยคู่เงินสองโหมด (Dual-Mode Quarantine Release):**
     * ปลดปล่อยที่ $\le 12.0\%$ เมื่อพอร์ตอยู่ในโหมด NORMAL
     * ปรับเพดานปลอดภัยลงมาเป็น $\le 8.0\%$ เมื่อพอร์ตติด SLOW หรือ FREEZE ขจัดปัญหาการเด้งเข้าออกห้องขัง (Oscillation Trap)
  8. **บันทึกสถานะจุดเข้าขังลง GlobalVariables (Cold-Boot State Persistence):**
     * เก็บค่า `g_quarantineEntryDD` ลงใน MT5 GlobalVariable (`EMP_Q_ENTRY_<login>_<sym>`) ทำให้ระบบจำสถานะเดิมได้ 100% แม้เครื่อง VPS จะถูกรีสตาร์ต

---

### [v2.00-1009] - 2026-10-09 (2-Way Command & Control Edition)
> **สถานะ:** ฟีเจอร์สั่งงาน 2 ทิศทางเต็มรูปแบบ พร้อมเกราะบริหารความเสี่ยง Adaptive Quarantine และ Smart Rescue Sniping สำหรับทดสอบฟาร์มและควบคุมระยะไกลผ่านเว็บ

* **ฟีเจอร์ใหม่ (New Features):**
  1. **สถาปัตยกรรมสั่งการสองทาง (2-Way Command & Control):**
     * สามารถกดสลับ **Close-Only / Active** และ **Quarantine / Unquarantine** รายคู่เงินจากหน้าเว็บ Admin Farm (`/admin/easym-prime-farm`)
     * รองรับการสั่งเปลี่ยนโหมดพอร์ต (**NORMAL / SLOW / FREEZE**) และสั่งหยุดรับออเดอร์ใหม่ (**Pause New Orders**) จากหน้าเว็บ
     * ข้อมูลคำสั่งถูกจัดเก็บแบบ Persistence ที่ Server (`.farm_data/port_controls.json`) และแนบกลับมากับ Heartbeat WebSync ทุกรอบ
  2. **แก้ปัญหา F7 Parameters Reset ด้วย Solution 1 + Solution 2:**
     * **Solution 2 (สวิตช์ F7 Authority):** เพิ่มตัวเลือกที่ด้านบนสุดของหน้าต่าง F7:
       * `CONTROL_MODE_WEB_SYNC` (Web Controlled - ค่าเริ่มต้น): สิทธิ์คำสั่งจากเว็บเป็นใหญ่
       * `CONTROL_MODE_MANUAL` (Manual MT5): บังคับใช้ค่าติ๊กเปิด-ปิดจาก F7 หน้าจอ MT5 เท่านั้น
     * **Solution 1 (Web Priority Persistence):** เมื่อผู้ใช้เปิด F7 แล้วกด OK (`REASON_PARAMETERS`) ระบบ `OnInit()` จะโหลดค่าจาก GlobalVariables มาทับค่า F7 เสมอ ทำให้คำสั่งที่สั่งไว้บนเว็บไม่สูญหาย
  3. **แยกโมดูล `EM_WebControl.mqh` เป็นเอกเทศ:**
     * ดึงโค้ด JSON parser และการควบคุมทั้งหมดแยกออกเป็นไฟล์ Include ต่างหาก
     * ใช้พรีโปรเซสเซอร์ `#ifdef ENABLE_EM_WEB_CONTROL` เพื่อความปลอดภัย ไม่กระทบกับเวอร์ชันเก่าหรือ EA ตระกูลอื่น
  4. **Web Remote Pause Switch:**
     * เช็กสถานะ `EMP18_<login>_PAUSE` ในฟังก์ชัน `TryEntry()` เพื่อหยุดการเปิด Cycle ไม้แรกของทุกคู่เงินทันทีที่สั่ง Pause จากเว็บ
  5. **HUD Authority Status Badge:**
     * แสดงป้ายกำกับบนหัวตารางกราฟ MT5 ชัดเจน: `=== EasyM Prime Universal v2.00 1009 ===  [🌐 WEB CONTROL]` หรือ `[💻 MANUAL]`
  6. **เกราะบริหารความเสี่ยงขั้นสูง (Unified Risk Management - Sync กับ 1008 / Build B261009.1):**
     * **Step-by-Step Cascade Adaptive Quarantine:** ทำงานเป็นขั้นเป็นตอน เมื่อพอร์ตติด FREEZE (28%) หรือยังติด SLOW (18%) ต่อเนื่อง จะดึงคู่ที่แย่สุดที่มี DD $\ge 10.0\%$ (`InpQuarantineFloorPct`) เข้าขังทีละคู่จนกว่าพอร์ตจะคลายตัวสู่ NORMAL (ขังสูงสุด 3 คู่)
     * **Standalone Runaway Trigger (14.0%):** ดักจับคู่ที่ลากหลุดเดี่ยวแตะ $\text{DD} \ge 14.0\%$ (`InpQuarantineSinglePairPct`) เข้าห้องขังเดี่ยวทันที แม้พอร์ตโดยรวมยังอยู่โหมดปกติ NORMAL
     * **ปิดจุดบอดคู่ที่ 5 (100% Symbol Freeze Coverage):** ตรวจสอบ `ST_FREEZE` (8.0%) ทุกคู่เงินในพอร์ต 100% ใน `WorstGridAllowedNow()`
     * **Hybrid Smart Rescue Grid Sniping:** คำนวณจุดกู้ภัยแบบยืดหยุ่น `Entry DD + 8.0%` พร้อมฟิลเตอร์พฤติกรรมราคา `IsRescueExhaustionConfirmed()` ป้องกันปัญหารับมีดร่วง (Anti-Falling Knife) ดักรอแท่งเทียนพักตัวหรือเกิดไส้ปฏิเสธราคา >= 35% ก่อนยิงไม้กู้ภัย
     * **Technical Build ID (`B261009.1`):** กำหนดรหัสรุ่นย่อยระบุในโค้ด ส่งขึ้น Web Telemetry และแสดงผลบน MT5 Title และ Experts Log ชัดเจน

---

### [v2.00-1008] - 2026-10-08 / [B261009.1] (Stable Standalone Release)
> **สถานะ:** เวอร์ชันเสถียรหลักสำหรับส่งมอบลูกค้าปัจจุบัน ทำงานแบบ Standalone 100% ไม่พึ่งพาระบบสั่งงานจากเว็บ พร้อมระบบความเสี่ยง Step-by-Step Cascade Adaptive Quarantine (Build B261009.1)

* **การปรับปรุงและแก้ไข (Improvements & Bug Fixes):**
  1. **Step-by-Step Cascade Adaptive Quarantine [QT] (Build B261009.1):**
     * พัฒนาระบบกักขังแบบตอบสนองทีละขั้น เมื่อพอร์ตเข้าสู่โหมด `FREEZE` (28%) หรือยังติด `SLOW` (18%) จะนำคู่เงินที่ติดลบสูงสุดที่แตะ `InpQuarantineFloorPct` (10.0%) เข้ากักขังทีละคู่ จนกว่าพอร์ตจะคลายตัวกลับมา NORMAL แล้วหยุดขังทันที
     * เพิ่มตัวแปร `InpQuarantineSinglePairPct` (14.0%) ดักจับคู่ที่ลากหลุดเดี่ยวฉุกเฉินแม้พอร์ต NORMAL
     * ปลดปล่อยจากการกักขังเมื่อ DD ลดลงอย่างน้อย 4.0% จากจุดเข้าขัง และต้องลดลงมาต่ำกว่าเพดาน `InpQuarantineResumePct` (8.0%)
  2. **Hybrid Smart Rescue Grid Sniping [R1–R3]:**
     * ปรับจุดเข้าไม้กู้ภัยให้ยืดหยุ่นตามจุดเข้าขังจริง (`Entry DD + 8.0%` ขั้นต่ำ 18.0%)
     * เพิ่มฟิลเตอร์ `IsRescueExhaustionConfirmed()` ตรวจจับ Rejection Wick (>=35%), Reversal Candle หรือ Range Contraction เพื่อความแม่นยำสูงสุดก่อนออกไม้กู้ภัย
  3. **ปิดจุดบอดคู่ที่ 5 (100% Symbol Throttle Coverage):**
     * เช็กสถานะ `g_symThrottle[idx] == ST_FREEZE` (DD >= 8.0%) ทุกคู่เงินในพอร์ต ป้องกันคู่เงินนอกกลุ่ม Top 4 แอบออกไม้เพิ่ม
  4. **Technical Build Identification:**
     * กำหนดรหัสรุ่นย่อย `B261009.1` บันทึกใน Log และแดชบอร์ด MT5 เพื่อง่ายต่อการตรวจสอบของแอดมิน
     * ปรับจูนสูตรคำนวณ Daily Drawdown ให้ตรงกับหน้าเว็บพอร์ตฟาร์ม ป้องกันค่า DD คลาดเคลื่อน
  5. **HUD Worst Pair DD Focus:**
     * หน้าปัด Dashboard MT5 แสดงเฉพาะค่า DD ของคู่เงินที่ติดลบหนักที่สุดในกลุ่มคู่ที่ถูกขัง (Quarantined Worst Pair) เพื่อให้ผู้ใช้งานมองเห็นจุดเสี่ยงสำคัญที่สุดทันที
  6. **Manual Chart Button Click:**
     * รองรับการคลิกปุ่มเปิด-ปิดคู่เงิน (เขียว = ทำงาน, แดง = ปิดรอบแล้วหยุด Close-Only) บนกราฟ MT5 โดยตรง พร้อมบันทึกสถานะลง GlobalVariables ป้องกันการรีเซ็ต
  7. **ความปลอดภัยสูง (Isolated Logic):**
     * ไม่มีการอ่านหรือรับคำสั่งจากภายนอกเข้ามาทับการตัดสินใจของ EA ป้องกันเหตุขัดข้องจากการเชื่อมต่ออินเทอร์เน็ต
  8. **Quarantine Quota & Risk Control Synchronization:**
     * ล็อกเกณฑ์ความปลอดภัยมาตรฐาน: Portfolio DD (Slow 18% / Freeze 28% / Resume 12%), Worst Throttle (Slow 5% / Freeze 8% / Resume 4%), Quarantine (Max 3 คู่), Rescue Grid (3 ไม้), Auto-Hedge (40% / Delta=0), และ Currency Cluster (3 คู่)

---

### [v2.00-1006] - 2026-10-06
> **สถานะ:** อัปเกรดความเข้ากันได้กับบัญชี Cent และระบบควบคุมงบกองทุนฟื้นฟู

* **การปรับปรุงและแก้ไข (Improvements & Bug Fixes):**
  1. **Relief Fund Budget Cap:**
     * จำกัดงบประมาณกองทุนบรรเทาความเสียหาย (Relief Fund) สูงสุดไม่เกิน 5% ของ Balance เพื่อความปลอดภัยของทุนสำรอง
  2. **Cent Account Auto-Normalization:**
     * ตรวจจับประเภทบัญชี Standard / Cent อัตโนมัติ ปรับหน่วยเงินและการคำนวณกำไร/DD ให้อยู่ในสเกลที่ถูกต้อง
  3. **Smart Licensing Heartbeat Sync:**
     * เชื่อมต่อ License ตรวจสอบวันหมดอายุ และส่งค่า Telemetry กลับมาที่ `https://eaeze.com/api/sync-dashboard`

---

### [v2.00-1001] - 2026-10-01
> **สถานะ:** ระบบป้องกันความเสี่ยงขั้นสูงและการล็อกความเสี่ยง Delta = 0

* **ฟีเจอร์สำคัญ (Core Features):**
  1. **Auto-Hedge Delta = 0:**
     * ล็อกผลรวม Lot สุทธิของคู่เงินที่แย่ที่สุดตัวเดียว (Single Worst Pair) เป็น 0 ทันที เพื่อหยุด Drawdown ไม่ให้ขยายตัว
  2. **Dynamic 3-Speed Portfolio Modes:**
     * โหมดพอร์ตปรับอัตโนมัติตามระดับ Drawdown: `NORMAL`, `SLOW`, `FREEZE` พร้อมระบบ Hysteresis ไม่ให้โหมดแกว่งไปมา
  3. **Rescue Grid:**
     * ยิงไม้แก้วิกฤต (Sniper Rescue Orders) สูงสุด 3 ไม้ เพื่อช่วยเก็บกำไรสั้นและเคลียร์ไม้ที่ติดอยู่ออกไปทีละส่วน

---

### [v2.00-0928] - 2026-09-28
> **สถานะ:** แกนกลางสถาปัตยกรรม Prime Multi-Currency

* **ฟีเจอร์พื้นฐาน (Foundation):**
  1. กระจายความเสี่ยง 20-23 คู่เงิน (Basket Trading)
  2. Dynamic Grid Spacing และเป้ากำไรรายชุด (Basket Target Money)
  3. Currency Cluster Protection (จำกัดคู่เงินที่แชร์สกุลเดียวกันพร้อมกันไม่เกิน 3 คู่)
  4. Time Bailout Protocol (ปิดคุ้มทุน/กำไรขั้นต่ำ หากถือออเดอร์ค้างนานเกิน 21 วัน)
