# EasyM Prime Version Changelog & Release Notes

เอกสารบันทึกประวัติการพัฒนาและฟีเจอร์ของ EA ตระกูล **EasyM Prime Universal (v2.00)** แต่ละเวอร์ชัน เพื่อใช้อ้างอิง เปรียบเทียบความแตกต่าง และเลือกเวอร์ชันใช้งานได้อย่างถูกต้อง รวดเร็ว โดยไม่ต้องย้อนอ่านโค้ดทั้งหมด

---

## สรุปภาพรวมเวอร์ชัน (Quick Reference)

| เวอร์ชัน | วันที่ปล่อย | วัตถุประสงค์หลัก / สถานะ | การสั่งการผ่านหน้าเว็บ (2-Way) | โค้ดหลัก |
| :--- | :--- | :--- | :--- | :--- |
| **v2.00-1008** | 2026-10-08 | **Stable Standalone Release (เวอร์ชันเสถียรหลักสำหรับลูกค้าทั่วไป)** | ❌ ปิด (ทำงานแบบ MT5 Standalone ไม่รับคำสั่งรีโมต) | `EASY_M_Prime_v200_1008.mq5 / .ex5` |
| **v2.00-1009** | 2026-10-09 | **2-Way Command & Control Edition (เวอร์ชันเชื่อมโยงสั่งงานหน้าเว็บฟาร์ม)** | ✅ เปิดเต็มระบบ (Web Priority + สวิตช์ F7 Authority) | `EASY_M_Prime_v200_1009.mq5 / .ex5` + `EM_WebControl.mqh` |
| **v2.00-1006** | 2026-10-06 | Cent Account Normalization & Relief Fund Budget Capping | ❌ ส่งข้อมูลขึ้นเว็บทางเดียว (One-Way Telemetry) | `EASY_M_Prime_v200_1006.mq5 / .ex5` |
| **v2.00-1001** | 2026-10-01 | Auto-Hedge Delta=0 & Multi-speed Port Modes (SLOW/FREEZE) | ❌ ส่งข้อมูลขึ้นเว็บทางเดียว (One-Way Telemetry) | `EASY_M_Prime_v200_1001.mq5 / .ex5` |
| **v2.00-0928** | 2026-09-28 | Prime Portfolio Core Architecture (20-23 Pairs) | ❌ ส่งข้อมูลขึ้นเว็บทางเดียว (One-Way Telemetry) | `EASY_M_Prime_v200_0928.mq5 / .ex5` |

---

## รายละเอียดการเปลี่ยนแปลงแต่ละเวอร์ชัน (Detailed Changelog)

### [v2.00-1009] - 2026-10-09 (2-Way Command & Control Edition)
> **สถานะ:** ฟีเจอร์สั่งงาน 2 ทิศทางเต็มรูปแบบ สำหรับทดสอบฟาร์มและควบคุมระยะไกลผ่านเว็บ

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

---

### [v2.00-1008] - 2026-10-08 (Stable Standalone Release)
> **สถานะ:** เวอร์ชันเสถียรหลักสำหรับส่งมอบลูกค้าปัจจุบัน ทำงานแบบ Standalone 100% ไม่พึ่งพาระบบสั่งงานจากเว็บ

* **การปรับปรุงและแก้ไข (Improvements & Bug Fixes):**
  1. **Daily Max Drawdown Recalibration:**
     * ปรับจูนสูตรคำนวณ Daily Drawdown ให้ตรงกับหน้าเว็บพอร์ตฟาร์ม ป้องกันค่า DD คลาดเคลื่อน
  2. **HUD Worst Pair DD Focus:**
     * หน้าปัด Dashboard MT5 แสดงเฉพาะค่า DD ของคู่เงินที่ติดลบหนักที่สุดในกลุ่มคู่ที่ถูกขัง (Quarantined Worst Pair) เพื่อให้ผู้ใช้งานมองเห็นจุดเสี่ยงสำคัญที่สุดทันที
  3. **Manual Chart Button Click:**
     * รองรับการคลิกปุ่มเปิด-ปิดคู่เงิน (เขียว = ทำงาน, แดง = ปิดรอบแล้วหยุด Close-Only) บนกราฟ MT5 โดยตรง พร้อมบันทึกสถานะลง GlobalVariables ป้องกันการรีเซ็ต
  4. **ความปลอดภัยสูง (Isolated Logic):**
     * ไม่มีการอ่านหรือรับคำสั่งจากภายนอกเข้ามาทับการตัดสินใจของ EA ป้องกันเหตุขัดข้องจากการเชื่อมต่ออินเทอร์เน็ต
  5. **Quarantine Quota & Risk Control Synchronization:**
     * ปรับโควตากักขังสูงสุด `InpMaxQuarantinedSymbols` จาก 2 เป็น **3 คู่เงิน** เพื่อให้สอดคล้องกับพอร์ต 20 คู่เงิน
     * ล็อกเกณฑ์ความปลอดภัยมาตรฐาน: Portfolio DD (Slow 18% / Freeze 28% / Resume 12%), Worst Throttle (Slow 5% / Freeze 8% / Resume 4%), Quarantine (In 18% / Out 12% / Max 3 คู่), Rescue Grid (25% / 3 ไม้), Auto-Hedge (40% / Delta=0), และ Currency Cluster (3 คู่)

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
