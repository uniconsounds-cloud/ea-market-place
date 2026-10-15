# 🚀 แผนพัฒนา EasyM PRIME (เฟส 2): Two-Way Command & News Leverage Shield

> **เอกสารบันทึกแผนงานและสถาปัตยกรรมทางเทคนิค (Phase 2 Technical Roadmap & Architecture Specification)**  
> **เป้าหมาย:** สรุปฟังก์ชันหลักสำหรับพัฒนา EasyM Prime เวอร์ชันถัดไป (v2.10+) เพื่อเป็นคู่มือและข้อกำหนดเตือนความจำเมื่อเริ่มลงมือเขียนโค้ด  
> **วันที่มีผลบันทึก:** 15 ตุลาคม 2026  
> **สถานะ:** บันทึกข้อกำหนดและพร้อมนำไปปฏิบัติการในรอบพัฒนาเฟส 2

---

## 📌 สรุปภาพรวมของเฟส 2 (Executive Summary)

ใน EasyM Prime เฟสแรก เราได้ทำการวางโครงสร้างหน้าฟาร์มแบบใหม่ (กระดาน 20 คู่เงิน, โดมกักขังและฟื้นฟู, ปรอทวัด Drawdown, และระบบ Telemetry ถ่ายทอดสด) ซึ่งแสดงผลแบบ Read-Only และควบคุมการเผยแพร่ด้วยระบบ Release Gate ให้ลูกค้าเรียบร้อยแล้ว

ใน **เฟสที่ 2** จะเป็นการยกระดับตัว EA (ฝั่ง MQL5) และระบบคลาวด์หลังบ้าน (Next.js / Supabase API) ให้ทำงานสอดประสานกันอย่างสมบูรณ์แบบ โดยมี **2 เสาหลักสำคัญ** ได้แก่:
1. **ระบบการสื่อสารสองทาง (Two-Way Interactive Remote Control):** สั่งเปิด-ปิดคู่เงิน (Active vs Close-Only) หรือสั่งหยุดฉุกเฉินได้โดยตรงจากหน้าเว็บฟาร์ม
2. **ระบบป้องกันข่าวกล่องแดงและการปรับลด Leverage ของโบรกเกอร์ (News Filter & Leverage Drop Shield):** ป้องกันความเสี่ยงจากการที่โบรกเกอร์ (เช่น FISG) ปรับลด Leverage เหลือ 1:100 ช่วงข่าวแรง จนส่งผลให้มาร์จิ้นไม่พอออกไม้แก้ (`Order Rejected`) หรือโดน Stop Out

---

## 🛰️ เสาหลักที่ 1: ระบบการสื่อสารสองทาง (Two-Way Remote Command)

### 1.1 วัตถุประสงค์และการทำงาน
อนุญาตให้ผู้ใช้/แอดมินสามารถคลิกสั่งการคู่เงินแต่ละคู่บนหน้าเว็บฟาร์ม (เช่น ลูกแก้วที่ 2 หรือ Cockpit Matrix) แล้วคำสั่งเดินทางไปถึง EA บน MT5 ในเครื่องลูกข่ายได้อย่างปลอดภัยและเสถียร

```mermaid
sequenceDiagram
    autonumber
    actor User as ผู้ใช้ / แอดมิน (Web UI)
    participant Web as Web Dashboard (Next.js)
    participant DB as Supabase DB (Queue & Status)
    participant EA as EasyM Prime EA (MT5 Terminal)
    participant Broker as MT5 Trade Server

    User->>Web: คลิกสลับสถานะคู่เงิน (เช่น EURUSD -> CLOSE-ONLY)
    Web->>DB: บันทึกคำสั่งลงตาราง `farm_remote_commands` (Status: PENDING)
    loop ทุกๆ 2-5 วินาที (Heartbeat Poll)
        EA->>DB: ยิง WebRequest ดึงคำสั่งที่รออยู่ (Polling Pending Commands)
        DB-->>EA: ส่งคำสั่ง JSON (action: 'SET_PAIR_MODE', sym: 'EURUSD', mode: 'CLOSE_ONLY')
    end
    EA->>EA: ตรวจสอบ Token & Nonce ป้องกันคำสั่งซ้ำ/ปลอมแปลง
    EA->>EA: ปรับการทำงานภายใน (บล็อกเปิดไม้แรก แต่ยังคุม Basket TP เดิม)
    EA->>DB: อัปเดตสถานะคำสั่งเป็น EXECUTED พร้อมส่ง Telemetry ล่าสุด
    DB-->>Web: Realtime Push สะท้อนสถานะกลับมาที่หน้าเว็บเป็น ⛔ CLOSE-ONLY
```

### 1.2 คำสั่งที่รองรับในระบบสองทาง
1. **`SET_PAIR_MODE` (ควบคุมรายคู่เงิน):**
   * `ACTIVE`: เปิดรับสัญญาณเทรดและเข้าออเดอร์ปกติ
   * `CLOSE-ONLY`: ไม่เปิดไม้แรกของรอบใหม่ แต่ปล่อยให้ไม้ที่ค้างอยู่เคลียร์ตัวเองจนชน Take Profit เมื่อออเดอร์หมดจะไม่เข้าเทรดคู่นั้นอีก
2. **`PAUSE_ALL_NEW` (หยุดเปิดคู่ใหม่ทั้งหมด):** สลับทุกคู่เป็น Close-Only ทันทีเมื่อสภาวะตลาดผันผวน
3. **`RESUME_ALL` (คืนค่าการทำงานทั้งหมด):** ปลดล็อคให้ทุกคู่เงินกลับมา Active ตามค่า Settings เดิม
4. **`EMERGENCY_LOCK_PAIR` (สั่งกักขังฉุกเฉิน):** ย้ายคู่เงินเข้าสู่โซน Quarantine ทันทีด้วยตนเอง

### 1.3 กลไกความปลอดภัยและความต่อเนื่องของสัญญาณ (Fail-Safe)
* **Watchdog Fallback:** หากเกิดเหตุอินเทอร์เน็ตขาดหาย หรือ MT5 ไม่สามารถเชื่อมต่อ API เว็บไซต์ได้เกิน 60 วินาที EA จะรักษาโหมดความปลอดภัยล่าสุดไว้ และจะไม่อนุญาตให้คำสั่งเก่าที่ค้างส่งผลย้อนหลัง (Discard commands older than 3 minutes)
* **Single Authority:** การตัดสินใจเปิดไม้แก้ (Martingale / Rescue Grid) ยังคงรันบนตรรกะภายในเครื่อง MT5 เป็นหลัก เพื่อป้องกันความหน่วง (Latency) ของอินเทอร์เน็ต

---

## 🛡️ เสาหลักที่ 2: ระบบเกราะป้องกันข่าวและ Leverage (News & Leverage Shield)

### 2.1 ปัญหาและที่มา (Case Study: โบรกเกอร์ FISG)
* **นโยบายโบรกเกอร์:** โบรกเกอร์ FISG ปรับลด Leverage สำหรับ Forex และทองคำเหลือ **1:100** ในช่วงข่าวกล่องแดง (ForexFactory Red Folder) ตั้งแต่ **4 นาทีก่อนข่าว จนถึง 1 นาทีหลังข่าว**
* **ความเสี่ยงต่อระบบ Grid / Martingale:**
  * ออเดอร์ใหม่ที่เปิดช่วง 5 นาทีนี้ ต้องใช้เงินวางมาร์จิ้นสูงขึ้น **5 ถึง 10 เท่า** (จาก 1:500 หรือ 1:1000)
  * หากกราฟกระชากแรงแล้ว EA มีเงื่อนไขต้องเข้าเปิดไม้แก้ (Averaging / Rescue) มาร์จิ้นจะไม่พอ ส่งผลให้ MT5 ปฏิเสธคำสั่ง (`10019: TRADE_RETCODE_NO_MONEY`)
  * สเปรดที่ถ่างกว้าง (Spread Widening) ในช่วงข่าวจะยิ่งกดให้ Floating Drawdown ลึกขึ้นชั่วคราว เสี่ยงต่อการโดนบังคับปิดพอร์ต (Stop Out)

```mermaid
flowchart TD
    A["ForexFactory Calendar / MT5 Calendar API"] --> B{"ตรวจพบข่าวกล่องแดง (High Impact News)"}
    B -- "เหลือเวลาอีก 5-10 นาทีก่อนข่าว" --> C["เปิดใช้งาน News Shield Mode"]
    C --> D["1. ระงับการเปิดไม้แรกของคู่เงินที่เกี่ยวข้อง (Lock New Entries)"]
    C --> E["2. ระงับการขยายไม้กริดชั่วคราว (Freeze Grid Expansion)"]
    C --> F["3. แสดงป้ายเตือน [NEWS FREEZE 1:100] บน Farm HUD และหน้าชาร์ต"]
    B -- "พ้นช่วงข่าวไปแล้ว 5-10 นาที และสเปรดกลับสู่ปกติ" --> G["ปลดล็อค News Shield Mode"]
    G --> H["กลับสู่สถานะเทรดปกติ (Normal Trading Mode)"]
```

### 2.2 ข้อกำหนดฟังก์ชันสำหรับตัว EA (MQL5 Implementation Spec)
1. **ระบบอ่านปฏิทินข่าว (News Calendar Provider):**
   * **ทางเลือก A (Built-in Calendar):** ใช้ฟังก์ชันมาตรฐาน `CalendarValueHistory()` ใน MQL5 ดึงข้อมูลข่าวระดับ High Impact (Importance == 3) โดยตรงจาก Server ของ MT5 ไม่ต้องพึ่งพา WebRequest ภายนอก
   * **ทางเลือก B (Cloud News Sync API):** ฝั่ง Server Web ดึงปฏิทิน ForexFactory แล้วส่งตารางข่าวประจำวันแนบไปกับ Heartbeat Telemetry ให้ EA อ่านแบบเบาเครื่อง
2. **การตั้งค่าพารามิเตอร์ของ EA (EA Input Parameters):**
   * `InpNewsFilterEnabled` = `true` (เปิด/ปิดระบบกรองข่าว)
   * `InpNewsImportance` = `HIGH_IMPACT_ONLY` (เฉพาะข่าวกล่องแดง)
   * `InpMinsBeforeNews` = `10` (หยุดเปิดไม้ใหม่ก่อนข่าว 10 นาที — ครอบคลุมกฎ 4 นาทีของโบรกเกอร์อย่างปลอดภัย)
   * `InpMinsAfterNews` = `10` (รอให้สเปรดหดกลับสู่ปกติหลังข่าว 10 นาที — ครอบคลุมกฎ 1 นาทีของโบรกเกอร์)
   * `InpMaxAllowedSpread` = `35` (ตรวจสอบสเปรด หากสเปรดยังถ่างเกินกำหนดจะไม่เปิดไม้เด็ดขาด)
3. **การจับคู่สกุลเงินของข่าว (Currency Matching Engine):**
   * ข่าวของสกุลเงินใด จะหยุดการออกไม้เฉพาะคู่เงินที่มีสกุลนั้นประกอบอยู่เท่านั้น เช่น:
     * ข่าว **USD** (Non-Farm, CPI, FOMC) -> สั่งหยุดเฉพาะคู่ที่มี USD (`EURUSD`, `GBPUSD`, `USDJPY`, ฯลฯ)
     * คู่เงินที่ไม่เกี่ยวกับข่าว เช่น `EURJPY`, `AUDCAD` สามารถทำงานต่อไปได้ตามปกติ ช่วยให้ไม่เสียโอกาสทำกำไร

---

## 🖥️ เสาหลักที่ 3: การแสดงผลบน Web Dashboard & Farm HUD

### 3.1 การแสดงผลบนกระดาน 20 คู่เงิน (Orb 2 Matrix)
* **ป้ายสถานะข่าว (News Badge):** หากคู่เงินใดกำลังอยู่ในช่วง News Shield จะแสดงป้ายกะพริบสีส้ม `📰 NEWS (1:100)` และมีเวลานับถอยหลัง (Countdown Timer) เช่น `RESUME IN 07:42`
* **ปุ่มควบคุม 2 ทิศทาง:** เมื่อสลับโหมดเป็นเวอร์ชัน 2 ปุ่ม `ACTIVE` และ `CLOSE-ONLY` จะสามารถกดเพื่อส่งคำสั่งได้จริง พร้อมแสดงสถานะ `Syncing...` และ `Confirmed`

### 3.2 การรักษาความปลอดภัยด้านการพัฒนา (Development Guard)
* **Feature Gating (`isOwnerDevUser`):** ในระหว่างที่เขียนโค้ดเฟส 2 ฟังก์ชันส่งคำสั่งและตัวกรองข่าวจะเปิดให้ทดสอบเฉพาะใน **โหมดพัฒนา (Dev)** ของเจ้าของระบบเท่านั้น
* **Customer Protection:** ลูกค้าทั่วไปจะยังคงมองเห็นหน้าฟาร์มเป็นเวอร์ชันนิ่งที่เสถียร (Display-Only) จนกว่าเจ้าของระบบจะทดสอบจนสมบูรณ์และกดปุ่ม **"อัปเดตปล่อยหน้าฟาร์มนี้ให้ลูกค้า"** ผ่านระบบ Release Gate อีกครั้ง

---

## 📋 แผนงานและขั้นตอนการลงมือพัฒนา (Implementation Checklist)

- [ ] **ขั้นตอนที่ 1: ฝั่ง Database & API**
  - [ ] สร้างตาราง `farm_remote_commands` ใน Supabase (รองรับ `port_number`, `command_type`, `payload`, `status`, `created_at`, `executed_at`)
  - [ ] สร้าง API Route `/api/farm/command/send` สำหรับรับคำสั่งจากเว็บ
  - [ ] สร้าง API Route `/api/farm/command/poll` สำหรับให้ EA ดึงคำสั่งไปรัน
- [ ] **ขั้นตอนที่ 2: ฝั่ง EA (MQL5 Prime Codebase)**
  - [ ] เพิ่มฟังก์ชันประมวลผลคำสั่งระยะไกล `ProcessRemoteWebCommands()`
  - [ ] เพิ่มโมดูลตรวจสอบข่าว `NewsFilterModule.mqh` (อ่านค่าข่าวและสกุลเงินที่ได้รับผลกระทบ)
  - [ ] ตรวจสอบ Leverage และ Margin ก่อนส่ง OrderSend ทุกครั้ง หากพบว่า Leverage ถูกลดเหลือ 1:100 และเงินไม่พอ ให้เข้าโหมด Safe Delay
- [ ] **ขั้นตอนที่ 3: ฝั่ง Frontend (Farm Client & Dev Dock)**
  - [ ] เปิดสวิตช์ปุ่ม interactive ใน Orb 2 ให้ส่งคำสั่งเข้า API เมื่ออยู่ในโหมด Dev
  - [ ] เพิ่ม News Indicator แสดงไอคอนข่าวกล่องแดงบนคู่เงินในหน้าฟาร์ม
  - [ ] ทดสอบการทำงาน End-to-End บนพอร์ตทดสอบของเจ้าของระบบ
- [ ] **ขั้นตอนที่ 4: ปล่อยใช้งานจริง (Production Deployment)**
  - [ ] ประกาศอัปเดต EasyM Prime v2.10 ให้ลูกค้าดาวน์โหลดไฟล์ `.ex5` ใหม่
  - [ ] ปลดล็อคระบบ Two-Way สู่โหมดสาธารณะผ่าน Dev Controller

---
*บันทึกโดย: Antigravity AI Pair Programmer & System Architect*  
*ไฟล์อ้างอิงหลัก: `docs/EASYM_PRIME_PHASE2_ROADMAP.md`*
