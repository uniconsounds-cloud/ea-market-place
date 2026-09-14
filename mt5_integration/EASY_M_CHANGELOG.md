# 📜 บันทึกประวัติการพัฒนาและการอัปเดตเวอร์ชัน EasyM (Changelog)

เอกสารนี้ใช้บันทึกประวัติการเปลี่ยนแปลง รายละเอียดการแก้ไขบั๊ก และฟีเจอร์ใหม่ของ **EasyM MAX Universal**, **EasyM mini Universal** และ **EAE_Monitor** ในทุกๆ เวอร์ชัน เพื่อใช้อ้างอิงและตรวจสอบย้อนหลังได้อย่างรวดเร็ว

---

## 📌 สารบัญเวอร์ชัน (Version Index)
- [🚀 แผนการปรับปรุงในเวอร์ชันถัดไป (Upcoming Roadmap - v1.17)](#-แผนการปรับปรุงในเวอร์ชันถัดไป-upcoming-roadmap---v117) : สวิตช์เปิด-ปิด 20 คู่เงิน, คัดกรองคู่เงิน Drawdown สูง, ปรับปรุงการแก้ไม้
- [v1.16 (0904) - 2026-09-04](#v116-0904---2026-09-04) : ปรับปรุงระบบปิดทำกำไร (Continuous Basket Exit & Trade Filling)
- [v1.15 (0820) - 2026-08-20](#v115-0820---2026-08-20) : ซิงค์ประวัติรายวันอัตโนมัติเมื่อขึ้นวันใหม่ (Anti-Spike History Sync)
- [v1.14 (0810) - 2026-08-10](#v114-0810---2026-08-10) : ระบบ Staggered Boot Delay & Auto Self-Healing 7 วัน
- [v1.13 (0609) - 2026-06-09](#v113-0609---2026-06-09) : จัดการ WebRequest Warning และเพิ่มความเสถียรของ Licensing Grace Period
- [v1.12.8.L2 (0526 / 0530) - 2026-05-30](#v1128l2-0526--0530---2026-05-30) : Universal Dynamic Suffix & Auto Filling Mode
- [v1.0 (0123 / 0304) - 2026-03-04](#v10-0123--0304---2026-03-04) : Multi-Symbol MVP (10 Correlation Pairs = 20 Symbols) & Portfolio Safety

---

## 🚀 แผนการปรับปรุงในเวอร์ชันถัดไป (Upcoming Roadmap - v1.17)
> **สถานะ**: จัดทำแบบพิมพ์เขียว (Blueprint) และเก็บสถิติเรียบร้อยแล้ว — **พร้อมดำเนินการโค้ดทันทีเมื่อสั่งเริ่มงาน**  
> **เอกสารสถิติอ้างอิง**: ดูรายละเอียดการคำนวณ Drawdown ทั้ง 20 คู่เงินได้ที่ [EASY_M_DRAWDOWN_ANALYSIS.md](file:///Users/suphakorn/EA%20Market%20Place/ea-market-place/mt5_integration/EASY_M_DRAWDOWN_ANALYSIS.md)

### 📌 หัวข้อที่ 1: ระบบสวิตช์เปิด-ปิดคู่เงินอิสระ (Symbol On/Off Switches)
* **เป้าหมาย**: ให้ผู้ใช้งานและ Admin สามารถเลือกเปิดหรือปิดคู่เงินแต่ละตัวได้เองจากหน้าต่าง Inputs ของ EA โดยไม่ต้องแก้ไขโค้ด
* **พิมพ์เขียวการทำงาน (Logic Blueprint)**:
  1. เพิ่ม Input Parameters แบบ `bool` ครบทั้ง 20 คู่เงิน:
     ```mql5
     input group "==== 🌐 SYMBOL ACTIVATION SWITCHES (เปิด-ปิดรายคู่เงิน) ===="
     input bool InpEnable_EURUSD = true;  // EURUSD (Active)
     input bool InpEnable_GBPUSD = true;  // GBPUSD (Active)
     input bool InpEnable_USDJPY = true;  // USDJPY (Active)
     input bool InpEnable_USDCHF = true;  // USDCHF (Active)
     input bool InpEnable_EURJPY = true;  // EURJPY (High Profit/High Risk)
     input bool InpEnable_GBPJPY = true;  // GBPJPY (High Profit/High Risk)
     input bool InpEnable_AUDCAD = false; // AUDCAD (Default OFF: High DD Drag)
     input bool InpEnable_EURCHF = false; // EURCHF (Default OFF: 100% Hold Drag)
     input bool InpEnable_GBPCHF = false; // GBPCHF (Default OFF: Low Profit)
     // ... ครบทั้ง 20 คู่
     ```
  2. ใน `OnInit()`: นำค่า Input มากำหนดให้ `g_state[i].enabled`
  3. **ระบบ Close-Only Graceful Shutdown**:
     * หากสวิตช์เป็น `false` และ **ยังไม่มีไม้ค้าง**: บอทจะไม่ส่งคำสั่งเปิดไม้แรกเด็ดขาด
     * หากสวิตช์เป็น `false` แต่ **มีไม้เดิมค้างอยู่แล้ว**: บอทยังคงดูแลแก้ไม้และรวบ TP ให้จนจบวัฏจักรนั้นอย่างปลอดภัย เมื่อปิดรอบเสร็จแล้วจะไม่เปิดรอบใหม่อีก

---

### 📌 หัวข้อที่ 2: การปรับคัดกรองคู่เงิน (Pair Replacement & Optimization)
* **เป้าหมาย**: ตัด 3 คู่เงินที่เป็นตัวถ่วงพอร์ต (กำไรน้อยแต่ Drawdown สูง/ติดนาน) และนำ 3 คู่เงินที่มีคุณสมบัติ Mean-Reversion ดีกว่าเข้ามาทดแทน
* **คู่เงินที่เสนอตัดออก**:
  1. `AUDCAD` (ติดแก้ไม้บ่อยสุดในพอร์ต 61.5% - 100% แต่กำไรเพียง 968 USC)
  2. `EURCHF` (ติดลากข้ามวัน 100% กราฟแคบดองเงินนาน 38 วัน แต่กำไรเพียง 1,081 USC)
  3. `GBPCHF` (กำไรต่ำที่สุดในพอร์ต เพียง 332 USC)
* **คู่เงินที่เสนอทดแทนให้ครบ 20 คู่**:
  1. `AUDNZD` (คู่อันดับ 1 สำหรับระบบ Grid ทั่วโลก กราฟมีคุณสมบัติ Mean-Reversion สูงมาก แทบไม่มี Super Trend ทางเดียว)
  2. `CADJPY` (เสริมทัพกลุ่ม JPY ที่สร้างกำไรหลักให้พอร์ต แต่ความผันผวนคุมง่ายกว่า GBPJPY)
  3. `CADCHF` (สวิงในกรอบกว้างและชนรอบ TP ได้เร็วกว่า EURCHF)

---

### 📌 หัวข้อที่ 3: ระบบ Breakeven / Time-Based Bailout (ปลดล็อกไม้ดอง)
* **เป้าหมาย**: แก้ปัญหาคู่เงินที่ติดลากข้ามเดือน (เช่น EURUSD 79 วัน, AUDUSD 67 วัน, EURJPY 84 วัน)
* **ตรรกะการทำงาน**:
  * หากรอบใดมีระยะเวลาถือครองเกินกว่าเกณฑ์ที่กำหนด (เช่น $> 21$ วัน หรือ $> 30$ วัน) ให้ระบบปรับลดเป้าหมายกำไร (`InpBasketTargetMoney`) ลงมาเป็น **Breakeven (เท่าทุน + ครอบคลุมค่า Swap/Commission)**
  * เพื่อให้สามารถปิดรวบเคลียร์พอร์ตได้ทันทีเมื่อมีจังหวะย่อตัวเล็กน้อย คืน Margin ให้พอร์ตพร้อมรับรอบใหม่

---

## [v1.16 0904] - 2026-09-04
### 🎯 เป้าหมาย: แก้ปัญหาบางคู่เงินกำไรทะลุเป้าหมายแล้วไม่ยอมปิด (Basket Profit Stuck)
* **ปัญหาเดิม**:
  1. ในฟังก์ชัน `TryExit()` มีตัวแปร `InpAvoidMultiExitBar` ล็อกเวลาไว้ ทำให้เมื่อคำสั่งปิดสะดุดในเสี้ยววินาที ระบบจะจำเวลาแท่งเทียน H1 นั้นไว้ และ **ไม่ยอมกลับมาเช็คปิดกำไรซ้ำอีกเลยตลอดทั้งแท่ง H1 (นานถึง 60 นาที)**
  2. ฟังก์ชันเดิม `CloseProfitables()` เลือกปิดเฉพาะไม้ที่มีกำไรรายตัว (`net > 0`) ไม่ได้ปิดยกชุดทั้งตะกร้า
  3. ก่อนส่งคำสั่งปิด ไม่ได้เรียก `ConfigureTradeFilling()` ทำให้โบรกเกอร์บางแห่ง (เช่น InterStellar) ปฏิเสธคำสั่งปิดด้วยข้อผิดพลาด Unsupported filling mode
* **การแก้ไข & ปรับปรุง**:
  1. **ปลดล็อกแท่งเทียนในการปิดกำไร (`TryExit`)**: เปลี่ยนมาเป็นการตรวจเช็คทุกๆ Tick (Continuous Tick Check) หากกำไรรวมของตะกร้าฝั่ง Buy หรือ Sell `>= InpBasketTargetMoney` จะส่งคำสั่งปิดซ้ำอย่างต่อเนื่องจนกว่าออเดอร์จะถูกปิดสำเร็จหมดเกลี้ยง 100%
  2. **สร้างระบบปิดยกชุดแบบสมบูรณ์ (`CloseAllPositionsBySide`)**: ปิดออเดอร์ทั้งหมดของฝั่งนั้นพร้อมกัน ทั้งไม้บวกและไม้ลบ เพื่อเก็บกำไรสุทธิรวมตามเป้าหมาย
  3. **Auto Trade Filling on Exit**: ใส่คำสั่ง `ConfigureTradeFilling(sym)` ตรวจจับ FOK / IOC / RETURN อัตโนมัติก่อนส่งคำสั่งปิดทุกไม้
  4. **อัปเดตแถบสีน้ำเงินบน Dashboard**: แสดงข้อความ `=== EasyM MAX Universal v1.16 0904 ===` และ `=== EasyM mini Universal v1.16 0904 ===`
* **ไฟล์ที่เกี่ยวข้อง**:
  - `EASY_M Max Universal v1.16 0904.mq5` / `.ex5`
  - `EASY_M mini Universal v1.16 0904.mq5` / `.ex5`
  - `EAE_Monitor v1.16 0904.mq5` / `.ex5`

---

## [v1.15 0820] - 2026-08-20
### 🎯 เป้าหมาย: แก้ปัญหายอดประวัติกำไรบางวันขาดหาย และป้องกันเซิร์ฟเวอร์โหลดหนักตอนเที่ยงคืน
* **ปัญหาเดิม**:
  - หากไม่ได้เปิดหน้าฟาร์มหรือเปิด MT5 ทิ้งไว้ข้ามวัน ยอดกำไรของเมื่อวานอาจไม่ถูกส่งเข้าฐานข้อมูล หรือส่งขึ้นพร้อมกันทุกพอร์ตตอน 00:00 น. จนเซิร์ฟเวอร์หนาแน่น
  - แถบสีน้ำเงินบน Dashboard ติดค้างอยู่ที่เลขเวอร์ชันเก่า `v1.13 0609`
* **การแก้ไข & ปรับปรุง**:
  1. **Day-Change Rollover Detection**: เพิ่มระบบตรวจจับการขึ้นวันใหม่ใน `EAE_WebSync.mqh` และ `EAE_Licensing.mqh`
  2. **Staggered Anti-Spike Jitter**: ใส่ระบบสุ่มหน่วงเวลา 0–300 วินาที (อิงจาก Hash เลขพอร์ต) ในช่วงรอยต่อวัน เพื่อกระจายการส่งข้อมูลไม่ให้พันพอร์ตยิงขึ้น Supabase พร้อมกัน
  3. **Auto 7-Day History Batch Sync**: ส่งชุดข้อมูลประวัติย้อนหลัง 7 วัน (`sync_ea_history_batch`) อัตโนมัติเมื่อขึ้นวันใหม่ เพื่อซ่อมแซมและเติมเต็มวันหยุด/วันก่อนหน้าที่ตกหล่นให้สมบูรณ์
  4. **แก้ข้อความ Dashboard Blue Bar**: ปรับให้แสดง `v1.15 0820` ตรงกับชื่อไฟล์
  5. **เพิ่ม Timeout ตรวจสิทธิ์เป็น 10 วินาที**: ป้องกัน VPS ต่างประเทศติด Error `1003 (Timeout)` ในช่วง Cold Start
* **ไฟล์ที่เกี่ยวข้อง**:
  - `EAE_WebSync.mqh`
  - `EAE_Licensing.mqh`
  - `EASY_M Max Universal v1.15 0820.mq5` / `.ex5`
  - `EASY_M mini Universal v1.15 0820.mq5` / `.ex5`
  - `EAE_Monitor v1.15 0820.mq5` / `.ex5`

---

## [v1.14 0810] - 2026-08-10
### 🎯 เป้าหมาย: ป้องกันเซิร์ฟเวอร์ล่มตอนรีสตาร์ต VPS พร้อมกัน และซิงค์ประวัติย้อนหลังตอนเริ่มรัน
* **การแก้ไข & ปรับปรุง**:
  1. **Staggered Boot Delay (0–120s)**: สุ่มหน่วงเวลาก่อนเริ่มซิงค์ข้อมูลรอบแรกตอนเปิดบอท เพื่อป้องกันไม่ให้ทุกพอร์ตยิง Request เข้าเซิร์ฟเวอร์พร้อมกันเวลาเปิดเครื่อง
  2. **Initial 7-Day History Auto Sync**: สั่งซิงค์ประวัติ 7 วันทันทีหลังจาก Boot Delay ผ่าน เพื่อกู้คืนข้อมูลวันที่ขาดหายโดยอัตโนมัติ
* **ไฟล์ที่เกี่ยวข้อง**:
  - `EASY_M Max Universal v1.14 0810.mq5` / `.ex5`
  - `EASY_M mini Universal v1.14 0810.mq5` / `.ex5`

---

## [v1.13 0609] - 2026-06-09
### 🎯 เป้าหมาย: จัดการแจ้งเตือน WebRequest และเพิ่มความเสถียรของระบบตรวจสิทธิ์
* **การแก้ไข & ปรับปรุง**:
  1. ซ่อนข้อความแจ้งเตือน WebRequest 4014 / 4060 ไม่ให้พ่นข้อความซ้ำรัวๆ ในแท็บ Experts โดยแจ้งเพียงครั้งเดียวอย่างสุภาพ
  2. ปรับปรุงระบบ **Licensing Grace Period 48 ชั่วโมง**: หากเน็ตหลุดหรือเซิร์ฟเวอร์ขัดข้องชั่วคราว บอทจะยังคงทำงานต่อได้ด้วย Local Cached Signature โดยไม่ตัดการทำงาน
* **ไฟล์ที่เกี่ยวข้อง**:
  - `EASY_M Max Universal v1.13 0609.mq5` / `.ex5`
  - `EASY_M mini Universal v1.13 0609.mq5` / `.ex5`

---

## [v1.12.8.L2 (0526 / 0530)] - 2026-05-30
### 🎯 เป้าหมาย: รองรับทุกโบรกเกอร์ทั่วโลกแบบ Universal (Auto Suffix & Auto Filling)
* **การแก้ไข & ปรับปรุง**:
  1. **Dynamic Suffix Auto-Detection**: ระบบตรวจจับ Suffix ของโบรกเกอร์อัตโนมัติ (เช่น `.v`, `m`, `c`, `_i`) ทำให้ลากบอทลงบนกราฟใดก็ได้ แล้วบอทจะแมปชื่อคู่เงินทั้ง 20 ตัวให้อัตโนมัติ 100%
  2. **Auto Filling Mode Detection**: ตรวจจับประเภทการส่งคำสั่งของโบรกเกอร์ (`ORDER_FILLING_FOK`, `ORDER_FILLING_IOC`, `ORDER_FILLING_RETURN`) อัตโนมัติ
  3. **Licensing V2 Integration**: เชื่อมต่อระบบเช็คสิทธิ์แบบ FNV-1a Checksum ป้องกันการแก้ไขหน่วยความจำ (Anti-Tampering)
* **ไฟล์ที่เกี่ยวข้อง**:
  - `EASY_M Max 0505_Core.mq5` / `8573_EASY_M_Max_0526_FarmUI.ex5`
  - `EASY_M mini 0505_Core.mq5`

---

## [v1.0 (0123 / 0304)] - 2026-03-04
### 🎯 เป้าหมาย: โครงสร้างหลัก Multi-Symbol Correlation Grid (10 Correlation Pairs = 20 Symbols)
* **โครงสร้างหลัก**:
  1. เทรด 10 คู่ Correlation รวม 20 สัญลักษณ์คู่เงิน (Multi-Currency Grid)
  2. แยก Magic Number อิสระ 1 Symbol = 1 Engine
  3. ระบบป้องกันพอร์ต 3 ระดับ (**Portfolio Safety 3 Mode**):
     - `NORMAL`: เทรดปกติ
     - `SLOW`: ชะลอการออกไม้และลดการเปิดคู่ใหม่
     - `FREEZE`: หยุดเปิดไม้ใหม่ คุมเฉพาะการแก้พอร์ต
  4. ระบบ **Worst-Symbol Throttle**: คุมความเสี่ยงคู่เงินที่ติดลบเยอะที่สุดในพอร์ตแบบไดนามิก
  5. หน้า Dashboard แสดงผลแบบ Sci-Fi แสดงสถานะ VU Bars, RSI, ไส้เทียน (Wick) และ Drawdown แบบเรียลไทม์
