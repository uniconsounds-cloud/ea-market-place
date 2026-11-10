# GoldPrime — Build & Version Changelog
บันทึกแผนงานพัฒนา ประวัติการอัปเกรด และสถาปัตยกรรมของ **GoldPrime (EA สำหรับเทรดทองคำ XAUUSD บนไทม์เฟรม M1)** เพื่อใช้อ้างอิงการพัฒนาและการปรับแต่งอย่างเป็นระบบ

---

## 📌 สรุปสถาปัตยกรรมหลัก (Core Architecture Overview)

- **สินค้าเป้าหมาย**: XAUUSD (Gold) บนกราฟ M1
- **ประเภทกลยุทธ์**: High-Frequency Cascading Grid Recovery + Dual-Anchor Ladder Adoption + Toxic Trim
- **ระบบออกไม้ปกติ (Tier 1 Primary Basket)**:
  - เริ่มเปิดไม้แรกทันทีเมื่อเปิดใช้งาน EA (Immediate Entry - ค่าเริ่มต้นฝั่ง BUY)
  - ไม้แก้ในชุดออกห่างกันตามระยะกริด (`InpGridDistancePoints = 250` จุด หรือ $2.50 ในทองคำ)
  - จำนวนไม้ปกติในชุดหลัก: 3 ไม้ (`InpTier1Orders = 3`)
  - เป้าหมายกำไรปิดรวบชุดหลัก: `InpBasketTargetMoney = $3.00`
- **ระบบไม้กู้ภัย 3 ระดับ (3-Tier Cascading Recovery Grid)**:
  - **Tier 1 (ชุดหลัก)**: 3 ไม้ปกติ
  - **Tier 2 (ชุดกู้ภัยระดับ 1)**: เริ่มทำงานเมื่อ Drawdown ขยายตัว $\ge$ `Base DD Tier 1 + 4.0%`
  - **Tier 3 (ชุดกู้ภัยระดับ 2)**: เริ่มทำงานเมื่อ Drawdown ขยายตัว $\ge$ `Base DD Tier 2 + 4.0%`
- **กลไกการบันทึก Base DD (+4% Expansion Tracking)**:
  - บันทึก Base DD ณ จังหวะที่ **ไม้ที่ 3 (ไม้สุดท้ายปกติ)** ของชุดนั้นถูกส่งคำสั่งสำเร็จ (OrderOpen) ไม่ผูกกับไม้สมอ
  - เคลียร์ Base DD กลับเป็น `0.0` ทันทีที่ชุดนั้นปิดรวบเก็บกำไร Scalp ได้สำเร็จ เพื่อเตรียมพร้อมสำหรับการขยายตัวรอบถัดไป
- **ระบบวงจรชีวิตอิสระ (Decoupled Scalp Lifecycles)**:
  - ชุดที่ 2 และชุดที่ 3 มีตัวแปรติดตามราคาต่ำสุดแยกเฉพาะชุด (`t2LowestBuy`, `t3LowestBuy`)
  - เมื่อชุดปิดรวบ 3 ไม้ปกติของตัวเองได้สำเร็จ สามารถเปิดรอบใหม่ได้ทันทีโดย **ไม่ผูกติดหรือต้องรอให้ราคาหลุดต่ำกว่าไม้สมอเดิม**
- **ระบบไม้สมอคู่ (Dual-Anchor Ladder Protocol)**:
  - แต่ละชุดกู้ภัย (Tier 2 และ Tier 3) มีโควตาไม้สมอได้สูงสุด **2 ตัว** (สมอ 1.1, สมอ 1.2, สมอ 2.1, สมอ 2.2)
  - **กฎเหล็กของไม้สมอ**:
    1. ไม้สมอต้องเป็น **ไม้ลำดับที่ 4 ของรอบนั้นเสมอ** ไม่ออกต่อจากไม้สมอเดิมโดยตรง
    2. ไม้สมอตัวที่ 2 จะเกิดขึ้นได้ก็ต่อเมื่อ ชุดนั้นได้ทำการปิดรวบ 3 ไม้ปกติของรอบแรกไปแล้ว และเปิดรอบใหม่จนติดครบ 3 ไม้ปกติอีกครั้ง
    3. ราคาปัจจุบันต้องอยู่ต่ำกว่าราคาเปิดของไม้สมอตัวแรก $\ge$ `InpMinAnchorStepPoints` (ค่าเริ่มต้น 300 จุด)
    4. เมื่อชุดปิดรวบเฉพาะไม้ปกติ ไม้สมอจะไม่ถูกปิด โดยจะคงอยู่เพื่อส่งกำลังไปช่วยดึงจุดคุ้มทุน (BE) ของชุดที่ 1 ให้ปิดได้ไวขึ้น
- **ระบบตัดภาระหนี้เสีย (Toxic Trim Engine)**:
  - เมื่อชุดที่ 3 ปิดรวบเก็บกำไร Scalp สำเร็จ จะเจียดกำไรส่วนหนึ่ง (`InpTrimProfitSharePct = 50%`) ไปตัดปิดไม้แรกสุดที่ติดลบหนักที่สุดทิ้งทีละเสี้ยว (Partial Close) เพื่อคืนมาร์จิ้นและลด Exposure
- **ระบบป้องกันไม้วิ่งแรง (Anti-Falling Knife & Safety Circuits)**:
  - กรองแท่งเทียนก่อนออกไม้แก้: ปฏิเสธการเข้าออเดอร์หากเป็นแท่งทิ้งดิ่งทึบ (Solid Bearish Body > 75%) และต้องการให้มีไส้เทียนล่างปฏิเสธราคา (Exhaustion Lower Wick) $\ge 35\%$ หรือการบีบตัวของแท่งเทียน
  - วงจรเบรกเกอร์ฉุกเฉิน (Auto-Hedge Lock): เปิดออเดอร์ฝั่งตรงข้ามล็อก Delta = 0 ทันทีหาก Drawdown แตะเพดานวิกฤต (`InpHedgeTriggerDD_Pct = 25%`)
- **การคำนวณล็อตแบบไปป์ไลน์ล่วงหน้า (Pre-computed Lot Pipeline)**:
  - รองรับ 4 รูปแบบ: Fixed, Linear Step, Multiplier, และ Ladder Step (บันไดซ้ำ 2 ครั้งเพิ่ม 0.01 แบบ Prime) แคชล่วงหน้า 50 สล็อต

---

## 🗺️ แผนการพัฒนาในอนาคต (Future Roadmap)

| เฟส / หัวข้อ | รายละเอียดและเป้าหมาย | สถานะ |
| :--- | :--- | :---: |
| **Phase 1: Core Recovery Engine** | พัฒนาระบบ 3-Tier Cascading, Dual Anchors, Decoupled Lifecycle, Toxic Trim, Lot Pipeline บน M1 | ✅ **เสร็จสมบูรณ์** (B261109.2) |
| **Phase 2: Backtest & Optimization** | ทดสอบ Backtest บนข้อมูลจริง XAUUSD M1 ย้อนหลัง 1-2 ปี เพื่อปรับหาค่า Optimal Spacing, DD Expansion %, และ Step จุดสมอ | 🟡 **พร้อมเริ่มทดสอบ** |
| **Phase 3: Dynamic Volatility Grid** | เพิ่มตัวเลือกปรับระยะห่างกริดตามค่าความผันผวนจริง (ATR-based Grid Spacing) สำหรับสภาวะข่าวแรง | ⚪ รอผลทดสอบ Phase 2 |
| **Phase 4: Cloud Telemetry & Control** | ผสานระบบรายงานสดเข้าสู่ Web App Dashboard (Supabase Telemetry, Farm HUD, และ Remote Emergency Toggle) | ⚪ วางแผนไว้ในลำดับถัดไป |

---

## 📋 ประวัติการแก้ไขราย Build (Build Changelog)

### 🔹 [B261109.7] — GoldPrime v1.00 (Hybrid Volatility Exhaustion & Momentum Cooling) (Current Production)
- **ไฟล์ซอร์สโค้ด**: [`GoldPrime_v100_B261109_7.mq5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_7.mq5) / [`GoldPrime_v100_B261109_7.ex5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_7.ex5)
- **วันที่ปล่อย**: 2026-11-09
- **สถานะ**: คอมไพล์ผ่านสมบูรณ์ (0 Errors, 0 Warnings)
- **ปัญหาเดิม**:
  - การใช้ระยะ Point Gap คงที่เพียงอย่างเดียว ในสภาวะข่าวแรงหรือ Flash Crash บนกราฟ M1 อาจทำให้ EA เข้าไม้แรกของชุดกู้ภัยกลางอากาศขณะที่แท่งเทียนทิ้งดิ่งเป็นน้ำตก (Falling Knife)
- **รายละเอียดการอัปเกรดระบบ Hybrid Dynamic Entry**:
  1. **ผสานระบบ Hybrid (ระยะขั้นต่ำ + สัญญาณราคาหยุดวิ่งแรง)**:
     - เมื่อราคาลงมาถึงระยะ Floor Gap (เช่น 500 จุด) แล้ว EA จะยังไม่รีบออกไม้ทันที แต่จะเข้าสู่โหมด Standby เพื่อรอการยืนยันว่า **"ความผันผวนลดลงและโมเมนตัมหยุดวิ่งแรงแล้ว"** บนไทม์เฟรม M1
  2. **Multi-Factor Volatility Cooling Engine**:
     - **Falling Knife Blocker:** สกัดกั้นการออกไม้สวนทันทีหากแท่ง M1 ล่าสุดเป็นแท่งเทียนทึบตัน (Bearish Body > 75% และไส้ล่าง < 20%)
     - **Consecutive Low Failure (`InpConsecutiveLowBars = 2`):** ตรวจสอบว่าแท่ง M1 ได้หยุดทำ New Low ติดต่อกันอย่างน้อย 2 แท่งแล้ว แสดงว่าก้นเริ่มนิ่ง
     - **Buyer Absorption Wick (`InpRejectionWickMinPct = 35%`):** ตรวจจับไส้เทียนล่างยาว มีแรงช้อนซื้อกลับอย่างมีนัยสำคัญ
     - **Range Contraction (`InpContractionRatioPct = 50%`):** ตรวจจับการบีบตัวของแท่งเทียน โดยขนาดแท่ง M1 หดตัวลง $\le 50\%$ ของค่าเฉลี่ย 3 แท่งก่อนหน้า บ่งชี้ว่าแรงเทขายเริ่มแผ่วลงและเข้าสู่การพักตัว
     - **Optional Fast EMA Reclaim (`InpRequireFastEmaReclaim`):** ตัวเลือกเสริมรอให้แท่ง M1 ปิดยืนเหนือ Fast EMA (เช่น EMA 5)
  3. **On-Chart HUD Real-time Status**:
     - แสดงสถานะตัวกรอง `Vol Cooling: ACTIVE 🛡️` พร้อมพารามิเตอร์ตรวจจับแบบ Real-time บนกราฟ

### 🔹 [B261109.6] — GoldPrime v1.00 (Dynamic Lowest-Price Single Anchor Engine)
- **ไฟล์ซอร์สโค้ด**: [`GoldPrime_v100_B261109_6.mq5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_6.mq5) / [`GoldPrime_v100_B261109_6.ex5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_6.ex5)
- **วันที่ปล่อย**: 2026-11-09
- **สถานะ**: คอมไพล์ผ่านสมบูรณ์ (0 Errors, 0 Warnings)
- **รายละเอียดการยกเครื่องระบบไม้สมอ**:
  1. **Continuous Lot Pipeline (ขนาดล็อตต่อเนื่อง 3 ชุด ไม่รวมสมอ)**:
     - เรียงลำดับสล็อตล็อตสำหรับ 3 ชุดอย่างต่อเนื่อง (Tier 1 $\rightarrow$ Tier 2 $\rightarrow$ Tier 3)
     - ไม้สมอจะใช้ขนาดล็อต **เท่ากับไม้สุดท้ายของชุดนั้น** ไม่ต้องกันสล็อตแยก
  2. **Single Anchor at Absolute Lowest Price (มีสมอเพียงไม้เดียวและอยู่ที่ราคาต่ำสุดเสมอ)**:
     - ในพอร์ตจะคงสถานะไม้สมอเพียง **1 ไม้ถ้วน** เสมอ
     - ไม้สมอเริ่มต้นที่ชุดที่ 2 หลังจากออกไม้ปกติครบแล้วและราคายังลงต่อ
  3. **Dynamic Anchor Swap & Absorption (สลับตำแหน่งสมอ & ดูดกลับเข้าชุด)**:
     - เมื่อชุดที่ 2 หรือ 3 ปิดรวบเก็บกำไร (Scalp TP) จะปิดเฉพาะไม้ปกติของชุดนั้น **และคงไม้สมอเดี่ยวไว้ช่วยถ่วงชุดที่ 1**
     - หากราคาลงต่อและชุดเริ่มเปิดไม้ในรอบใหม่:
       - **ถ้าไม้ใหม่เปิดต่ำกว่าราคาไม้สมอเดิม:** ไม้ใหม่จะได้รับการสถาปนาขึ้นเป็น **⚓ ไม้สมอตัวใหม่ทันที**
       - **ไม้สมอเดิมจะถูกดูดกลับเข้ามาเป็นส่วนหนึ่งของชุดปกติ** เพื่อรอจังหวะปิดรวบไปกับรอบใหม่ต่อไป
     - ส่งผลให้ไม้สมอเลื่อนลงไปเกาะที่ราคาต่ำสุดของเหวเสมอ ดึงจุด Break-Even ของชุดที่ 1 ให้ขยับต่ำลงตามราคาตลาดได้เต็มประสิทธิภาพ
  4. **Any-Order-Count Take Profit (ปิดรวบได้ทุกจำนวนไม้)**:
     - ทุกชุด (Tier 1, Tier 2, Tier 3) ปิดรวบทำกำไรได้ตลอดเวลาเมื่อผลกำไรรวมถึงเป้าหมาย (`snap.tXCount > 0`) ไม่ต้องรอให้ออกครบจำนวนไม้

### 🔹 [B261109.5] — GoldPrime v1.00 (Independent Tier Point-Gaps Engine)
- **ไฟล์ซอร์สโค้ด**: [`GoldPrime_v100_B261109_5.mq5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_5.mq5) / [`GoldPrime_v100_B261109_5.ex5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_5.ex5)
- **วันที่ปล่อย**: 2026-11-09
- **สถานะ**: คอมไพล์ผ่านสมบูรณ์ (0 Errors, 0 Warnings)
- **เหตุผลในการปรับปรุง**:
  - การใช้เงื่อนไข Drawdown % (เช่น +4% DD) ในชั้นลึก เมื่อมีจำนวนล็อตสะสมสะสมมากขึ้น (เช่น 7 ไม้ รวม 0.28 lot) กราฟขยับเพียงนิดเดียว Drawdown ก็พุ่งแตะ 4% ได้อย่างรวดเร็ว ทำให้ระยะราคาจริงแคบเกินไป ไม่สมเหตุสมผลกับพฤติกรรมราคาทองคำ
- **รายละเอียดการแก้ไข**:
  1. **เปลี่ยนรอยต่อจาก DD% เป็นระยะราคาจริง (Point-Gaps)**:
     - ยกเลิกการอิง `InpTierDeltaDD_Pct` เปลี่ยนมาใช้ระยะห่างราคา (Points) จากไม้สุดท้ายของชุดก่อนหน้าโดยตรง
  2. **แยกการตั้งค่ารอยต่ออย่างอิสระ 2 ระดับ**:
     - `InpGapT1ToT2Points`: ระยะห่างจากไม้สุดท้ายของ Tier 1 สู่ไม้แรกของ Tier 2 (ค่าเริ่มต้น 500 จุด)
     - `InpGapT2ToT3Points`: ระยะห่างจากไม้สุดท้ายปกติของ Tier 2 สู่ไม้แรกของ Tier 3 (ค่าเริ่มต้น 500 จุด)
  3. **การบันทึกราคาอ้างอิง ณ จุดเปิดไม้ (OrderOpen Price Reference)**:
     - บันทึกราคาเปิดจริงของไม้สุดท้ายปกติของแต่ละชุด (ไม่คิดจากไม้สมอ) เป็นจุดเริ่มต้นวัดระยะห่าง
     - เมื่อชุดนั้นปิดรวบเก็บกำไร (Scalp Exit) ค่าราคาอ้างอิงจะถูกรีเซ็ตเพื่อความพร้อมในรอบใหม่
  4. **อัปเกรดหน้าจอ HUD Dashboard**:
     - แสดงค่าระยะ Gap 1->2 และ Gap 2->3 ให้เห็นแบบ Real-time บนกราฟพร้อมราคาอ้างอิงล่าสุด

### 🔹 [B261109.4] — GoldPrime v1.00 (Scalp TP Condition Fix for Any Order Count)
- **ไฟล์ซอร์สโค้ด**: [`GoldPrime_v100_B261109_4.mq5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_4.mq5) / [`GoldPrime_v100_B261109_4.ex5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_4.ex5)
- **วันที่ปล่อย**: 2026-11-09
- **สถานะ**: คอมไพล์ผ่านสมบูรณ์ (0 Errors, 0 Warnings)
- **สาเหตุของปัญหา**:
  - จากภาพทดสอบใน Strategy Tester ชุดที่ 2 ออกไป 2 ไม้ (`T2:#1` 0.08 lot กำไร +$121.04, `T2:#2` 0.09 lot กำไร +$164.16 รวมเป็นกำไร +$285.20) แต่ **ไม่ยอมปิดรวบ**
  - เกิดจากเงื่อนไขในโค้ดเดิมเขียนไว้ว่า `snap.t2Count >= InpTier2Orders && snap.t2Profit >= InpTierScalpTargetMoney` ซึ่งไปบังคับว่าต้องออกครบ 3 ไม้ก่อนเท่านั้น (`snap.t2Count >= 3`) ถึงจะยอมปิดรวบ ทำให้ตอนที่มีแค่ 1 ไม้ หรือ 2 ไม้ แม้กำไรจะพุ่งเกินเป้าไปมหาศาล ระบบก็ปฏิเสธที่จะปิดรวบเก็บกำไร
- **รายละเอียดการแก้ไข**:
  1. **ปลดล็อกจำนวนไม้ออกของชุดที่ 2 และ 3**:
     - เปลี่ยนเงื่อนไขเป็น `snap.t2Count > 0 && snap.t2Profit >= InpTierScalpTargetMoney` (และ `snap.t3Count > 0`)
     - ส่งผลให้ **ไม่ว่าจะออกเพียง 1 ไม้, 2 ไม้ หรือครบ 3 ไม้** หากผลรวมกำไรของชุดถึงเป้าหมาย (`InpTierScalpTargetMoney` เช่น $5.00) ระบบจะ **ปิดรวบทำกำไร (Scalp TP) ทันที** ไม่ต้องรอให้ติดครบ 3 ไม้
  2. **รีเซ็ตสถานะและเตรียมพร้อมรอบถัดไป**:
     - เมื่อปิดรวบชุดที่ 2 ไม่ว่าจะปิดกี่ไม้ ระบบจะบันทึกกำไรเข้าพอร์ต และรีเซ็ต `Base DD Tier 2` กลับเป็น `0.0` ทันทีเพื่อพร้อมเปิดรอบใหม่

### 🔹 [B261109.3] — GoldPrime v1.00 (Immediate Execution & Broker Compatibility Fix)
- **ไฟล์ซอร์สโค้ด**: [`GoldPrime_v100_B261109_3.mq5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_3.mq5) / [`GoldPrime_v100_B261109_3.ex5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_3.ex5)
- **วันที่ปล่อย**: 2026-11-09
- **สถานะ**: คอมไพล์ผ่านสมบูรณ์ (0 Errors, 0 Warnings)
- **รายละเอียดการแก้ไข**:
  1. **Dynamic Filling Mode Auto-Detection (แก้ปัญหา Error 10030 บนโบรกเกอร์ทองคำ)**:
     - ปลดการล็อก `ORDER_FILLING_FOK` แบบ Hardcode ซึ่งเป็นสาเหตุหลักที่โบรกเกอร์ Forex/Gold (Exness, XM, IC Markets) ปฏิเสธคำสั่งเปิดออเดอร์
     - ตรวจสอบ `SYMBOL_FILLING_MODE` ของโบรกเกอร์อัตโนมัติ พร้อมระบบ Fallback Retry วนลอง `IOC` และ `RETURN` ทันทีหากโบรกเกอร์ปฏิเสธ ทำให้ส่งคำสั่งติด 100% ทุกโบรกเกอร์
  2. **Spread Filter Default Adjustment for Gold (แก้ปัญหาสเปรดบล็อกการออกไม้)**:
     - ปรับค่าเริ่มต้น `InpMaxSpreadPoints = 0` (Disabled Filter) เพื่อไม่ให้สเปรดปกติของทองคำ (ซึ่งอยู่ที่ 150-350 จุดบนบัญชี Standard) ไปบล็อกคำสั่งแรกไม่ให้ทำงาน
  3. **Real-time Diagnostic HUD & Safety Alert**:
     - เพิ่มบรรทัดสถานะ `Status:` บนหน้าจอ HUD เพื่อแจ้งเตือนแบบ Real-time หากผู้ใช้ลืมกดปุ่ม "Algo Trading" บน MT5 หรือสเปรดสูงเกินค่าที่ตั้งไว้
  4. **Immediate Clean Basket Execution**:
     - เสริมระบบตรวจสอบราคา Tick สด (`SymbolInfoTick`) และ Normalize Lot Size ให้เข้ากับกฎของโบรกเกอร์เป๊ะ เพื่อให้เปิดไม้แรกได้ทันทีที่กราฟกระดิก 1 Tick

### 🔹 [B261109.2] — GoldPrime v1.00 (Decoupled Lifecycles & Dual-Anchor Engine)
- **ไฟล์ซอร์สโค้ด**: [`GoldPrime_v100_B261109_2.mq5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_2.mq5) / [`GoldPrime_v100_B261109_2.ex5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_2.ex5)
- **วันที่ปล่อย**: 2026-11-09
- **สถานะ**: คอมไพล์ผ่านสมบูรณ์ (0 Errors, 0 Warnings)
- **รายละเอียดการปรับปรุง**:
  1. **Decoupled Tier Lifecycles (ปลดล็อกชุด 2 และ 3 ให้เป็นอิสระจากไม้สมอ)**:
     - แก้ไขปัญหาเดิมที่ชุด 2 ไม่ยอมออกไม้รอบใหม่หลังปิดรวบเนื่องจากราคาต่ำสุดของพอร์ตไปผูกกับไม้สมอ 1
     - แยกตัวแปรเช็คราคาต่ำสุดเฉพาะชุด (`snap.t2LowestBuy`, `snap.t3LowestBuy`) ทำให้เมื่อปิดรวบ 3 ไม้ปกติแล้ว สามารถเริ่มเปิดไม้แรกของรอบใหม่ได้ทันที
  2. **OrderOpen Base DD Capture**:
     - เปลี่ยนจุดบันทึก Base DD ของแต่ละชุดให้บันทึกทันทีเมื่อส่งคำสั่ง **ไม้ที่ 3 (ไม้สุดท้ายปกติ)** สำเร็จ ไม่คิดจากไม้สมอ
  3. **Auto Base DD Reset on Scalp Exit**:
     - เมื่อชุดที่ 2 หรือชุดที่ 3 ปิดรวบ 3 ไม้ปกติสำเร็จ ระบบจะเคลียร์ Base DD ของชุดนั้นกลับเป็น `0.0` ทันที (`InpResetBaseDDOnScalpExit = true`) เพื่อพร้อมนับรอบขยายตัวใหม่
  4. **Dual Anchors per Recovery Tier (ระบบไม้สมอคู่)**:
     - อนุญาตให้ชุดที่ 2 และชุดที่ 3 มีไม้สมอได้สูงสุด 2 ตัว (`InpMaxAnchorsPerTier = 2`)
     - กำหนด Magic Numbers แยกชัดเจน: `Anchor 1.1`, `Anchor 1.2`, `Anchor 2.1`, `Anchor 2.2`
  5. **Strict Anchor #2 Sequencing (กฎเหล็กไม้สมอตัวที่ 2)**:
     - ไม้สมอตัวที่ 2 **ไม่ออกต่อจากไม้สมอแรกโดยตรง** แต่ต้องผ่านการปิดรวบ 3 ไม้ปกติ และเปิดรอบใหม่จนครบ 3 ไม้ปกติอีกครั้งก่อนเสมอ (เป็นไม้ที่ 4 ของรอบใหม่)
     - ต้องอยู่ต่ำกว่าราคาเปิดของไม้สมอตัวแรก $\ge$ `InpMinAnchorStepPoints` (ค่าเริ่มต้น 300 จุด)
  6. **HUD Dashboard Update**:
     - ปรับหน้าจอ Comment Dashboard ให้แสดงสถานะไม้สมอแบบแยกคู่ `[A1.1:⚓, A1.2:⚓]` และ `[A2.1:⚓, A2.2:⚓]` พร้อม Base DD ของแต่ละ Tier Real-time

---

### 🔹 [B261109.1] — GoldPrime v1.00 (Initial Architecture Release)
- **ไฟล์ซอร์สโค้ด**: [`GoldPrime_v100_B261109_1.mq5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_1.mq5) / [`GoldPrime_v100_B261109_1.ex5`](file:///Users/suphakorn/EA%20Market%20Place/Finishing%20EAeze%20Products/GoldPrime_v100_B261109_1.ex5)
- **วันที่ปล่อย**: 2026-11-09
- **รายละเอียด**:
  - วางโครงสร้างสถาปัตยกรรมหลัก ถอดแบบเอนจินแก้ไม้จาก EasyM Prime สำหรับ XAUUSD M1
  - ระบบบันได Lot Pipeline แคชล่วงหน้า 50 สล็อต
  - ระบบ 3-Tier Cascading Recovery + เว้นระยะ DD ขยายตัว 4%
  - ระบบไม้สมอเดี่ยว (Single Anchor per Tier)
  - ระบบตัดปิดไม้แรกสุดทีละเสี้ยว (Toxic Trim Partial Close)
  - ตัวกรอง Anti-Falling Knife (Exhaustion Lower Wick $\ge 35\%$)
