# 🏛️ SYSTEM ARCHITECTURE RULES & CORE PROTOCOLS
> **กฎเหล็กสถาปัตยกรรมระบบ EA & Farm Web (ห้ามละเมิดเด็ดขาด)**
> เอกสารนี้เป็น Single Source of Truth สำหรับนักพัฒนาและ AI Assistant ทุกโมเดล เพื่อป้องกันข้อผิดพลาดซ้ำเดิม

---

## 1. กฎการสื่อสารและการเชื่อมต่อเครือข่าย (Communication Protocol)

### 1.1 รอบเวลาการรับ-ส่งข้อมูล (Interval Specifications for v2.00+)
ระบบสื่อสารระหว่าง MT5 EA กับ Server (`https://eaeze.com/api/sync-dashboard`) แบ่งออกเป็น 3 ระดับอย่างเคร่งครัด:

| โหมด / เหตุการณ์ | ความถี่ (Interval) | พารามิเตอร์ในโค้ด | คำอธิบายการทำงาน |
| :--- | :--- | :--- | :--- |
| **👀 1. Live Farm Viewing (ตื่น)** | **20 วินาที** | `SMART_PING_INTERVAL_LIVE = 20` | เมื่อมีผู้ใช้เปิดหน้าเว็บฟาร์มดูอยู่ (`last_viewed_at` < 2 นาที) MT5 จะส่งข้อมูล Snapshot และคำสั่ง 2-Way ทุก 20 วิ |
| **💤 2. Standby / Sleep Mode (หลับ)** | **3 นาที (180 วินาที)** | `SMART_PING_INTERVAL_SLEEP = 180` | เมื่อไม่มีคนเปิดดูหน้าเว็บฟาร์มเกิน 2 นาที MT5 จะเข้าสู่โหมดประหยัดทรัพยากร ส่ง Heartbeat เบาๆ ทุก 3 นาที |
| **🔐 3. License Verification** | **12 ชั่วโมง (43,200 วินาที)** | `LICENSE_REFRESH_INTERVAL = 43200` | ตรวจสอบสิทธิ์ใบอนุญาตกับระบบหลักทุก 12 ชม. (มี Grace Period สำรอง 48 ชม. กรณีเน็ตหลุด) |

> ⚠️ **ข้อควรระวัง:** ห้ามแก้รอบเวลา Live เป็น 10 วินาที หรือแก้รอบ Sleep เป็นค่าอื่นโดยพลการ เพราะรอบ 20s / 180s เป็นเกณฑ์ที่ผ่านการคำนวณภาระโหลดของ Vercel & Supabase และลดภาระ CPU ของ MT5 แล้ว

---

### 1.2 กฎการป้องกัน Error 1003 (`ERR_NETSOCKET_TIMEOUT`)
* **สาเหตุเดิม:** MQL5 `WebRequest` ถูกตั้ง Timeout ไว้สั้นเกินไป (3,000 ms) ทำให้เกิด Timeout บ่อยครั้งเมื่อเซิร์ฟเวอร์ตอบสนองช้าเล็กน้อย
* **กฎบังคับใช้ (Mandatory Rule):**
  1. ค่า Timeout ของฟังก์ชัน `WebRequest()` ในทุกไฟล์ `.mqh` และ `.mq5` **ต้องตั้งไม่ต่ำกว่า 10,000 ms (10 วินาที)** เสมอ:
     ```mql5
     int res = WebRequest("POST", g_eae_api_url, headers, 10000, data, result, result_headers);
     ```
  2. รหัสตอบกลับ `res == 1003` ถือเป็น **Transient Network Jitter (อาการเน็ตสะดุดชั่วคราว)** ที่ฟื้นตัวได้เองในรอบถัดไป **ห้ามพ่น Print Error สีแดงตกใจลงแท็บ Experts** ให้ดักจับและเปลี่ยนสถานะเป็น `RETRYING` แทน:
     ```mql5
     if(res == 1003) {
         g_eae_sync_status = "RETRYING";
         g_eae_sync_message = "Network Timeout (Auto-recovering)";
         return false;
     }
     ```

---

## 2. กฎการตัดรอบวันและเวลาเปิดตลาด (Market Trading Day Rollover)

### 2.1 นิยามเวลาตัดรอบวัน (Rollover Time)
* **Forex Market Daily Rollover:** ยึดตามเวลาปิดตลาดนิวยอร์ก 17:00 NY Time ซึ่งตรงกับ **05:00 น. เช้าประเทศไทย (Bangkok GMT+7)** ในช่วงฤดูร้อน (DST) หรือ **06:00 น.** ในช่วงฤดูหนาว
* **Broker Server Time (MT5):** โบรกเกอร์ส่วนใหญ่ (XM, Exness, Vantage) ใช้เวลา GMT+2 / GMT+3 แท่งเทียนรายวัน (D1 Bar) จะเริ่มต้นใหม่ที่ `00:00:00` เวลาเซิร์ฟเวอร์โบรกเกอร์

### 2.2 การคำนวณและรีเซ็ตกำไรรายวัน (`today_pnl` & `TodayClosedProfit`)
* เมื่อก้าวเข้าสู่วันใหม่ใน MT5 (`TimeCurrent()` ข้ามเที่ยงคืนเซิร์ฟเวอร์):
  * `TodayClosedProfit()` ของ MT5 จะรีเซ็ตกลับเป็น `0.00`
  * ในการซิงค์ `sync-dashboard`: ต้องส่งและบันทึก `server_time` ลงตาราง `farm_port_status` เสมอ
* **บนหน้าเว็บฟาร์ม (`FarmClient.tsx` / `DemoFarmClient.tsx`):**
  * วันที่ของหน้าฟาร์ม (`brokerDateStr`) ยึดตาม `getMarketTradingDate()` (ตัดรอบ 05:00 น. เวลาไทย)
  * เมื่อขึ้นวันใหม่ หรือเมื่อพบว่าวันนี้ยังไม่มีออเดอร์ปิด (`today_closed_lots === 0 && currentPnl === 0`) **กล่องกำไรด้านบนต้องแสดง `+0.00` ทันที** ห้ามให้ฟังก์ชันกรองสัญญาณรบกวนขัดขวางการรีเซ็ตเป็น 0

---

## 3. กฎการแยกเวอร์ชัน EasyM Prime (Versioning Strategy)

| เวอร์ชัน | วัตถุประสงค์ | ระบบรับคำสั่งจากเว็บ (2-Way) |
| :--- | :--- | :--- |
| **`v2.00-1008`** | **Stable Standalone Release (ส่งมอบลูกค้าปัจจุบัน)** | ❌ ปิดสมบูรณ์ (ไม่รับคำสั่งรีโมต ทำงานหน้าจอ MT5 เท่านั้น) |
| **`v2.00-1009`** | **2-Way Command & Control Edition (สำหรับพอร์ตฟาร์ม/ทดสอบ)** | ✅ เปิดเต็มระบบ ควบคุมผ่านหน้าเว็บ `/admin/easym-prime-farm` |

* โค้ดสั่งงาน 2 ทิศทางทั้งหมดต้องแยกไว้ในโมดูล `EM_WebControl.mqh`
* ใน `EAE_WebSync.mqh` ต้องครอบฟังก์ชันสั่งงานด้วย `#ifdef ENABLE_EM_WEB_CONTROL` เพื่อไม่ให้กระทบเวอร์ชัน 1008
* สิทธิ์การควบคุมในเวอร์ชัน 1009 ต้องมีสวิตช์ F7 Authority (`CONTROL_MODE_WEB_SYNC` vs `CONTROL_MODE_MANUAL`) และมีระบบ Web Priority ป้องกัน F7 ทับค่าจากเว็บเสมอ

---

## 4. บันทึกประวัติการพัฒนา (Changelog Pointer)
รายละเอียดการแก้ไขและการเพิ่มฟีเจอร์ของ EA แต่ละรุ่น บันทึกไว้อย่างเป็นทางการที่:
📄 `mt5_integration/Experts/EasyM/EASY_M_PRIME_VERSION_CHANGELOG.md`
