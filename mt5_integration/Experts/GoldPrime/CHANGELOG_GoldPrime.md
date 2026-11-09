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
