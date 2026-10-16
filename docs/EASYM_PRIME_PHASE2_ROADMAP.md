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

## 📊 เสาหลักที่ 4: การปรับแต่งแดชบอร์ดบนกราฟ MT5 (MT5 On-Chart HUD Upgrade)

### 4.1 ปรับมาตรฐานชื่อ EA บน Table C (Unified Branding)
* **ปัญหาเดิม:** บนแถบสถานะพอร์ต Table C ยังมีคำว่า `Universal` ปรากฏอยู่ เช่น `=== EasyM Prime Universal v2.00 1014 [B261014.1] ===` ซึ่งไม่ตรงกับชื่อเรียกอย่างเป็นทางการบนหน้าเว็บฟาร์มและระบบไลเซนส์
* **ข้อกำหนดใหม่:**
  * **ตัดคำว่า `Universal` ออกทั้งหมด** เพื่อให้ชื่อผลิตภัณฑ์เป็นเอกภาพ (Unified Name) ทั่วทั้งระบบ
  * รูปแบบมาตรฐานที่กำหนด: `EasyM Prime v2.00 [BuildID]` (เช่น `EasyM Prime v2.00 [B261014.1]` หรือ `EasyM Prime v2.00 1014 [B261014.1]`)
  * ปรับค่าคงที่ `#define EA_DASH_TITLE` และ `#property description` ในไฟล์โค้ด MQL5 ให้ตรงตามมาตรฐานนี้

### 4.2 เพิ่ม Table F: แถบแจ้งเตือนสถานะแยกเดี่ยวเต็มแถว (Dedicated Full-Width Alert Row)
* **ปัญหาเดิม:** ข้อมูลแจ้งเตือน (Alert / Quarantine Status / Rescue Info / `lock withdraws` / `system healthy`) ถูกยัดรวมไว้ใน Table E ช่องที่ 3 (`Col 2`) ร่วมกับค่า Buffer และ Relief Fund ทำให้พื้นที่จำกัด ข้อความยาวถูกตัดทอน หรือเบียดเสียดจนมองไม่เห็น
* **การปรับโครงสร้าง Table E & Table F:**
  * **Table E (Financial Metrics):** ปรับเหลือเฉพาะข้อมูลทางการเงินหลัก 2 ช่อง ได้แก่ Buffer (`BUF: +X.X% (X.Xx)`) และ Relief Fund (`FUND: ... (C:... | U:...)`) ทำให้ตัวเลขขยายกว้าง ชัดเจน อ่านง่าย ไม่แออัด
  * **Table F (Dedicated Alert Row):** ย้ายข้อความแจ้งเตือนทั้งหมดออกจาก Table E มาแสดงผลใน Table F แบบเต็มแถว 100% (`dW`) ความสูง 1 แถวมาตรฐาน (`rowH`)
  * **ลักษณะกรอบ:** สไตล์แถบ Sci-Fi HUD แบบกล่องข้อความเต็มแถวเดี่ยว ไม่มีเส้นคอลัมน์กั้นกลาง เพื่อให้อ่านข้อความยาวได้ต่อเนื่อง

### 4.3 การตรวจจับและแสดงสถานะคู่เงินค้างเก่าของ EasyM (Legacy Basket Monitoring)
* **ที่มา:** ลูกค้าที่อัปเกรดมาจาก EasyM MAX หรือเวอร์ชันก่อนหน้า อาจมีออเดอร์ของคู่เงินเก่าที่ไม่ได้อยู่ในกระดาน 20 คู่ปัจจุบัน (เช่น `GBPCHF` Magic 2012) ค้างอยู่ในพอร์ต แม้ระบบภายในจะคอยจัดการปิดรวบ Close-Only ให้อัตโนมัติ แต่ลูกค้ามองไม่เห็นบนแดชบอร์ด ทำให้เกิดความกังวล
* **ข้อกำหนด:**
  * เพิ่มฟังก์ชันสแกนหาตระกร้าออเดอร์ของ EasyM รุ่นเก่าที่ยังเปิดค้างอยู่ (`ScanLegacyBaskets()`)
  * หากพบออเดอร์ค้าง ให้แสดงสถานะใน Table F ชัดเจน เช่น:
    $$\text{[LEGACY BASKET: GBPCHF (3 Orders, P/L: -45.20) AWAITING CLOSE-ONLY TP]}$$
  * ทำให้ผู้ใช้มั่นใจได้ทันทีว่า Prime รับรู้และกำลังเฝ้ารอปิดรวบคู่นั้นให้อยู่จริง

### 4.4 การตรวจจับออเดอร์นอกระบบ / เทรดมือ / Magic Number อื่น (External & Manual Trades Detection)
* **ที่มา:** บ่อยครั้งที่ลูกค้าเปิดออเดอร์ด้วยมือเอง (Manual Trading) หรือใส่ EA ตัวอื่นเข้ามาช่วยเทรดในพอร์ตเดียวกัน ซึ่งออเดอร์เหล่านี้กิน Margin และส่งผลกระทบโดยตรงต่อ Equity/Drawdown ของระบบ Prime
* **ข้อกำหนด:**
  * เพิ่มฟังก์ชันสแกนพอร์ตหาออเดอร์ที่ไม่ใช่ของ Prime (`ScanExternalTrades()`):
    * ออเดอร์ที่ออกด้วยมือ: `OrderMagicNumber() == 0`
    * ออเดอร์จาก EA ตัวอื่น: `Magic != InpMagicPrime` และ `Magic != LegacyMagic`
    * คู่เงินแปลกปลอมที่อยู่นอก 20 คู่เงินของ Prime (เช่น XAUUSD, BTCUSD)
  * แสดงแจ้งเตือนเด่นชัดใน Table F (สลับเป็นสีส้มหรือแดง) เช่น:
    $$\text{[ALERT: 2 MANUAL ORDERS DETECTED (XAUUSD, EURUSD) - UNMANAGED RISK]}$$
    $$\text{[ALERT: EXTERNAL EA DETECTED (MAGIC: 88888, 3 ORDERS) - MARGIN IMPACT]}$$
  * ช่วยให้เจ้าของพอร์ตหรือแอดมินตรวจพบความผิดปกติได้ทันที ก่อนที่จะส่งผลให้พอร์ตติด Margin Call

### 4.5 ระบบจัดลำดับความสำคัญของข้อความแจ้งเตือน (Table F Alert Message Hierarchy)
ข้อความใน Table F จะแสดงผลตามลำดับความสำคัญสูงสุด (Priority Queue Engine):
1. 🚨 **ระดับวิกฤต (Critical - สีแดง):** มาร์จิ้นต่ำกว่าเกณฑ์ หรือเสี่ยง Stop Out เช่น `[CRITICAL: MARGIN LEVEL < 150% - SUSPENDING ENTRIES]`
2. ⚠️ **ระดับออเดอร์นอกระบบ / เทรดมือ (External Trades - สีส้ม):** `[ALERT: EXTERNAL ORDERS DETECTED (2 MANUAL) - RISK UNMANAGED]`
3. 📰 **ระดับข่าวสารและ Leverage Shield (News Shield - สีทอง/ส้ม):** `[NEWS SHIELD: USD HIGH IMPACT IN 08:32 - 1:100 LEVERAGE GUARD]`
4. 🛡️ **ระดับการกักขังและกู้ชีพ (Quarantine & Rescue - สีฟ้า/ทอง):** `[QUARANTINE: EURUSD HEDGED | RESCUE R2 ACTIVE (DD: 2.15%) | LOCK WITHDRAWS]`
5. 🔄 **ระดับคู่เงินเก่ารอปิดรวบ (Legacy Basket - สีฟ้าอ่อน):** `[LEGACY BASKET: GBPCHF (3 Orders, P/L: -45.20) AWAITING CLOSE-ONLY TP]`
6. ⛔ **ระดับการสั่งการจากระยะไกล (Remote Mode - สีส้ม):** `[REMOTE: 2 PAIRS SET TO CLOSE-ONLY BY DASHBOARD]`
7. 🟢 **ระดับปกติ (Healthy - สีเขียว):** `[SYSTEM HEALTHY - ALL 20 SYSTEMS NOMINAL | CPU OK]`

---

## 🎯 เสาหลักที่ 5: สถาปัตยกรรมกู้ภัยระดับสูง (Tier-3 Triggered Rescue Slicing & Hierarchical Trimming)

### 5.1 ปัญหาและข้อจำกัดของระบบเดิม
* ใน Prime v2.00 เดิม เมื่อไม้สไนเปอร์กู้ชีพสะสมกำไรครบ 3 รอบ (`rescueScalpCycles >= 3`) ฟังก์ชัน `TrimOneToxicTicket()` จะมุ่งเป้าไปตัดเฉพาะ **"ไม้ Regular Grid ปกติ"** ที่ขาดทุนหนักสุดเสมอ
* หากตลาดเกิดสภาวะ Super-Trend ลากยาวลงไปจนระบบต้องเปิดไม้กู้ภัยชุดถัดไป (Tier 2 หรือ Tier 3) ไม้กู้ภัยชุดแรกๆ (Tier 1) ที่เปิดไว้สูงจะกลายเป็น **"ไม้กู้ภัยติดดอย"** ทำให้พอร์ตต้องแบกรับล็อตสะสม (Accumulated Exposure)
* หากไม่ตัดไม้กู้ภัยชุดบนออกก่อน เมื่อเกิดสภาวะลากต่อ จะทำให้คู่เงินนั้นเสี่ยงวิ่งไปชนเกณฑ์ **Auto-Hedge รายคู่ที่ 40% (`InpHedgeTriggerPct = 40.0%`)**

### 5.2 กลยุทธ์การตัดไม้ตามระดับชุดกู้ภัย (State-Driven / Tier-Based Rescue Slicing)
ยกเลิกการใช้เกณฑ์ตัวเลข % DD แบบตายตัว (เพราะการเข้าห้องขังมีทั้งแบบ 10% เมื่อพอร์ตตึง และ 14% เมื่อเป็นเดี่ยว) แล้วเปลี่ยนมาใช้ **"สถานะของชุดกู้ภัย (Rescue Tier)"** เป็นเกณฑ์ชี้ขาด:

```mermaid
flowchart TD
    A["สไนเปอร์กู้ชีพทำกำไรครบ 3 รอบ (rescueScalpCycles >= 3)"] --> B{"ตรวจสอบระดับ Tier ของคู่นั้น (st.rescueTier)"}
    B -- "Tier 1 หรือ Tier 2 (ด่านหน้าและด่านกลาง)" --> C["โหมดเร่งคืนทุน: มุ่งตัด 'ไม้ Regular Grid' ที่เน่าที่สุด"]
    C --> D["ดึง TP ตะกร้าใหญ่เข้ามาใกล้ราคาปัจจุบัน และกำจัดตัวกิน Swap"]
    B -- "Tier 3 (ชุดสุดท้ายถูกงัดมาใช้งานแล้ว)" --> E["โหมดเซฟตี้ลดล็อต: สลับมาตัด 'ไม้กู้ภัยชุดที่ 1 ที่ติดดอย' ทันที!"]
    E --> F["กางร่มชูชีพเบรกล็อตส่วนเกินออก ป้องกันไม่ให้คู่เงินหลุดไปชน 40% Auto-Hedge"]
    F --> G{"ไม้กู้ภัยชุดบนถูกเคลียร์หมดแล้วหรือไม่?"}
    G -- "หมดแล้ว" --> H["กลับมาตัดไม้ Regular Grid ปกติ หรือส่งกำไรเข้า Relief Fund"]
    G -- "ยังมีค้างอยู่" --> I["ตัดไม้กู้ภัยชุดบนตัวถัดไปในรอบ 3 ถัดไป"]
```

1. **ช่วง Tier 1 & Tier 2 กำลังทำงาน (Fighting Mode):**
   * กู้ภัยชุด 1 และ 2 ยังอยู่ใกล้ราคา มีโอกาสสูงมากที่จะกลับมาปิดรวบกำไรได้เอง
   * กำไร 3 รอบจึงมุ่งเป้าไปที่ **"ตัดไม้ Regular Grid ดอยแรกสุด"** เพื่อดึง TP เฉลี่ยของกริดหลักลงมาหาตลาด
2. **ช่วง Tier 3 ถูกเปิดใช้งาน (Emergency De-leverage Mode):**
   * ทันทีที่ระบบต้องงัดชุดสุดท้าย (Tier 3) ออกมาใช้ เป็นสัญญาณชัดเจนว่าแนวรับ 2 ชั้นแรกต้านไม่อยู่
   * **สลับเป้าหมายทันที:** กำไร 3 รอบของชุดที่ 3 จะนำไป **ตัดไม้กู้ภัยชุดที่ 1 ที่ติดดอยทิ้งเป็นอันดับแรก** เพื่อสลัดล็อตส่วนเกินออก ป้องกันไม่ให้คู่นี้ถูกลากไปชน 40% Auto-Hedge!
3. **เมื่อเคลียร์ขยะกู้ภัยชุดบนหมดแล้ว:**
   * สิทธิ์ตัดไม้จะกลับมาตัดไม้ Regular Grid ปกติ หรือส่งเงินเข้าสู่กองทุนกลาง (Relief Fund) ตามลำดับ

---

## 📋 แผนงานและขั้นตอนการลงมือพัฒนา (Implementation Checklist)

- [ ] **ขั้นตอนที่ 1: ฝั่ง Database & API**
  - [ ] สร้างตาราง `farm_remote_commands` ใน Supabase (รองรับ `port_number`, `command_type`, `payload`, `status`, `created_at`, `executed_at`)
  - [ ] สร้าง API Route `/api/farm/command/send` สำหรับรับคำสั่งจากเว็บ
  - [ ] สร้าง API Route `/api/farm/command/poll` สำหรับให้ EA ดึงคำสั่งไปรัน
- [ ] **ขั้นตอนที่ 2: ฝั่ง EA (MQL5 Prime Codebase)**
  - [ ] ปรับชื่อใน `#define EA_DASH_TITLE` และ `#property description` เป็น `EasyM Prime v2.00 [BuildID]` (ตัดคำว่า Universal ออก)
  - [ ] ปรับแก้ **Table E**: ตัดช่อง Col 2 เดิมออก ขยายพื้นที่แสดงเฉพาะ Buffer % และ Relief Fund ให้คมชัดสวยงาม
  - [ ] เพิ่มโครงสร้าง **Table F** ในฟังก์ชัน `DashboardBuild()` (สร้าง Rect กรอบเดี่ยวเต็มความกว้าง `dW` และ Text Object `F_MSG`)
  - [ ] ย้ายข้อความแจ้งเตือนทั้งหมด (`lock withdraws`, `rescue active`, `margin warning`, `system healthy`) มาประมวลผลที่ Table F
  - [ ] พัฒนาฟังก์ชัน `ScanLegacyBaskets()` ตรวจจับคู่เงินเก่าของ EasyM ที่อยู่นอกกระดาน 20 คู่ เพื่อรายงานสถานะรอปิดรวบขึ้น Table F
  - [ ] พัฒนาฟังก์ชัน `ScanExternalTrades()` ตรวจจับออเดอร์เทรดมือ (`Magic == 0`) หรือ EA อื่น และรายงานเตือนขึ้น Table F
  - [ ] สร้างระบบ Priority Message Queue ใน `DashboardUpdate()` เพื่อเลือกข้อความสำคัญที่สุดขึ้นแสดงใน Table F พร้อมสลับสีตามระดับความสำคัญ
  - [ ] **พัฒนาระบบ Tier-3 Triggered Rescue Slicing ในฟังก์ชัน `TrimOneToxicTicket()`:**
    - [ ] ตรวจสอบ `st.rescueTier >= 3` หากมีไม้กู้ภัยชุด 1 ติดลบค้างอยู่ ให้ตัดไม้กู้ภัย (`Magic + 2000`) ก่อน
    - [ ] หาก `st.rescueTier < 3` หรือไม่มีไม้กู้ภัยค้าง ให้ตัดไม้ Regular Grid ปกติ (`Magic`)
  - [ ] เพิ่มฟังก์ชันประมวลผลคำสั่งระยะไกล `ProcessRemoteWebCommands()`
  - [ ] เพิ่มโมดูลตรวจสอบข่าว `NewsFilterModule.mqh` (อ่านค่าข่าวและสกุลเงินที่ได้รับผลกระทบ)
  - [ ] ตรวจสอบ Leverage และ Margin ก่อนส่ง OrderSend ทุกครั้ง หากพบว่า Leverage ถูกลดเหลือ 1:100 และเงินไม่พอ ให้เข้าโหมด Safe Delay
- [ ] **ขั้นตอนที่ 3: ฝั่ง Frontend (Farm Client & Dev Dock)**
  - [ ] เปิดสวิตช์ปุ่ม interactive ใน Orb 2 ให้ส่งคำสั่งเข้า API เมื่ออยู่ในโหมด Dev
  - [ ] เพิ่ม News Indicator แสดงไอคอนข่าวกล่องแดงบนคู่เงินในหน้าฟาร์ม
  - [ ] เพิ่มการแสดงผล Legacy Baskets & External Orders Warning ใน Telemetry Payload ของหน้าฟาร์ม
  - [ ] พัฒนา **ไซโลเสบียงแก้วทองคำ (Golden Silo / Relief Fund)** และ **เขื่อนพลังงานกั้นพายุ (Bio-Shield Gauge / Buffer Data Group)** บนหน้าฟาร์ม
  - [ ] ทดสอบการทำงาน End-to-End บนพอร์ตทดสอบของเจ้าของระบบ
- [ ] **ขั้นตอนที่ 4: ปล่อยใช้งานจริง (Production Deployment)**
  - [ ] ตรวจสอบความถูกต้องของแดชบอร์ดบนกราฟ MT5 (Table C ชื่อตรง, Table E สะอาด, Table F รายงานข้อความแจ้งเตือนครบถ้วน)
  - [ ] ประกาศอัปเดต EasyM Prime v2.10 ให้ลูกค้าดาวน์โหลดไฟล์ `.ex5` ใหม่
  - [ ] ปลดล็อคระบบ Two-Way สู่โหมดสาธารณะผ่าน Dev Controller

---
*บันทึกโดย: Antigravity AI Pair Programmer & System Architect*  
*ไฟล์อ้างอิงหลัก: `docs/EASYM_PRIME_PHASE2_ROADMAP.md`*


