# 🏷️ EA Technical Build Registry & Edition Ledger
> **บันทึกประวัติการสร้างและเลข ID ย่อยของ EA (Internal Technical Editions)**
> เอกสารฉบับนี้จัดทำขึ้นเป็น Single Source of Truth สำหรับผู้ดูแลระบบ (Admin) เพื่อใช้อ้างอิงทางเทคนิคในการตรวจสอบว่า พอร์ตใดกำลังรัน EA Edition / Build ใดอยู่ โดยไม่ต้องเปิดอ่านโค้ดซ้ำ

---

## 📌 โครงสร้างรหัสประจำรุ่น (Build ID Convention)

* **รูปแบบ:** `B<YY><MM><DD>.<Revision>`
  * ตัวอย่าง: **`B261009.1`** = ปี 2026 / เดือน 10 / วันที่ 09 / การแก้ไขลำดับที่ 1 ของวัน
* **รูปแบบการส่งข้อมูลขึ้นระบบเว็บ (Telemetry Identity):**
  * `ea_version`: `v2.00-1008 [B261009.1]` หรือ `v2.00-1009 [B261009.1]`
  * แสดงผลบนหน้าปัด MT5 Dashboard Title: `=== EasyM Prime Universal v2.00 1008 [B261009.1] ===`
  * บันทึกใน Log เริ่มต้นของ MT5: `PrintFormat("=== %s | Edition Build: %s ===", ...)`

---

## 📊 ตารางบันทึกประวัติ Edition ย่อยทั้งหมด (Technical Ledger)

| Build ID | เวอร์ชันหลัก | วันที่ / เวลา | สถานะระบบสั่งการ | วัตถุประสงค์และการเปลี่ยนแปลงสำคัญ (Technical Highlights) |
| :--- | :---: | :---: | :---: | :--- |
| **`B26102X`**<br>*(Phase 2)* | **EasyM Prime v2.10+**<br>*(แผนงานพัฒนา Phase 2)* | *Q4 2026 (อยู่ระหว่างพัฒนา)* | Two-Way Remote Command<br>+ Dynamic Cluster Shield | • **[แผนงาน Phase 2 - อยู่ระหว่างพัฒนา] Dynamic Currency Cluster Shield:** ปลดล็อก Cluster Limit ในโหมด NORMAL (< 18% Active DD) เพื่อให้พอร์ตสร้างกระแสเงินสดเสรีเหมือน MAX และเปิดใช้งานเกราะ `Cluster Limit = 3` อัตโนมัติเมื่อเข้าสู่โหมด SLOW/FREEZE (DD >= 18%)<br>• **3-Tier Cascading Rescue with Smart Exhaustion & Falling Knife Gate:**<br>&nbsp;&nbsp;1. *Tier 1 (R1-R3):* ไม่รอ +4% DD! ดักชาร์จก้นเหวแรกทันทีด้วย Price Action Exhaustion + Dynamic ATR Gap (30-40 pips) บล็อกแท่งมีดร่วง 100%<br>&nbsp;&nbsp;2. *Tier 2 (R4-R6):* เว้นช่วงห่างปลอดภัย +4.0% DD + ด่านตรวจมีดร่วง<br>&nbsp;&nbsp;3. *Tier 3 (R7-R9):* เว้นช่วงอีก +4.0% DD + สลับเป้าหมายกำไรไปตัดไม้กู้ภัย Tier 1 ทิ้ง เพื่อสลัดล็อตสะสมฉุกเฉิน ป้องกัน 40% Auto-Hedge<br>• **Table A Split Column (60/40):** แยกคอลัมน์ `TODAY P/L` (กำไรปกติ) และ `RESCUE` (ยอดตัดไม้ดอย สีทอง No Red Principle) พร้อมป้ายชัยชนะ Table F<br>• **EasyM Pure Data Integrity:** คำนวณ Isolated Equity & Isolated DD แยกขาดจากการเทรดมือ 100% |
| **`B261014.1`**<br>*(เวอร์ชันใช้งานจริงปัจจุบัน)* | **EasyM Prime** (`v2.00-1014`) | 2026-10-14 | **Universal Edition:** Multi-Tier Cascading Rescue & Anchor Handover | • **[เวอร์ชันปัจจุบันที่รันอยู่จริง] Multi-Tier Cascading Rescue Grid (Tier 1 -> Tier 2 -> Tier 3):** กู้ภัย 3 สเตจ (สูงสุดไม่เกิน 9 ไม้) โดย Tier 1 (ไม้ 1-3) เริ่มทำงานที่ Entry DD + 4.0% พร้อม Distance Gate (1.0 ATR / 80-100 pips), หากลากต่อจน DD เพิ่มอีก +4% จะยกระดับสู่ Tier 2 (ไม้ 4-6) และลากต่ออีก +4% สู่ Tier 3 (ไม้ 7-9) ล็อตต่อเนื่องตามขั้นบันไดและควบคุมเพดานสูงสุดไม่เกิน 1.10 lot<br>• **100% Price Action Exhaustion บนทุกไม้:** ตรวจสอบไส้เทียนปฏิเสธราคา ($\\ge 35\\%$), แท่งกลับตัวแรก, หรือกรอบบีบแคบ และบล็อกมีดร่วง Waterfall/Rocket Spike บนไม้กู้ภัยทุกไม้ (R1 ถึง R9)<br>• **Independent Rescue Basket Profit Taking:** ปลดล็อกเงื่อนไข `count < 3` ให้ชุดกู้ภัยสามารถปิดรวบทำกำไรได้อย่างอิสระเมื่อ PnL $\\ge 20$ cent โดยปิดได้ตั้งแต่ 1, 2, หรือ 3 ไม้ แบ่งกำไร 60% เข้า Balance และ 40% เข้า Relief Fund<br>• **Anchor Handover at 12% DD:** เมื่อ DD คู่เงินลดลงมาแตะ $\\le 12.0\\%$ ระบบจะหยุด Scalp ชุดกู้ภัย และสงวนไม้กู้ภัยที่ได้เปรียบราคาที่สุด 1 ไม้ (Anchor Order: ไม้ Buy ต่ำสุด หรือไม้ Sell สูงสุด) ทิ้งไว้เพื่อดึงจุด TP/BE ของตระกร้าหลักให้ปิดรวบได้เร็วยิ่งขึ้น<br>• **3-to-1 Profit-to-Trim Rule:** บังคับให้ชุดกู้ภัยทำกำไรครบ 3 รอบก่อน จึงจะดึงเงิน Relief Fund ไปตัดปิดไม้ติดลบของตระกร้าปกติ 1 ไม้ (ไม้ที่ดอยลึกที่สุด) รับประกันพอร์ตมี Cash Flow บวกแน่นอน<br>• **Dual-Mode Quarantine Release:** ปลดปล่อยคู่เงินจากห้องขังที่ $\\le 12.0\\%$ ในสภาวะพอร์ตปกติ (NORMAL) และเพดานปลอดภัย $\\le 8.0\\%$ เมื่อพอร์ตติด SLOW/FREEZE ขจัดปัญหาอาการเด้งเข้าออกห้องขัง (Oscillation Trap) 100%<br>• **Cold-Boot State Persistence:** บันทึกและดึงค่าจุดขังเดิม `g_quarantineEntryDD` ผ่าน MT5 GlobalVariables (`EMP_Q_ENTRY_<login>_<sym>`) ทำงานต่อเนื่องทันทีแม้เครื่องรีสตาร์ต |
| **`B261013.2`** | **EasyM Prime v2.00-1013**<br>(`EasyM_Prime_v200_B261013_2`) | 2026-10-13 | One-Way Telemetry<br>(Direct-to-Supabase + 10m Fallback) | • **Auto-Fallback 10m Standby-Only (`FALLBACK_1URL`):** หากไม่ได้ใส่ URL ที่ 2 (`supabase.co`) ใน MT5 Options ระบบจะสลับส่งเฉพาะข้อมูลสรุปพอร์ตทุก 10 นาที (`600s`) ผ่าน `eaeze.com` และล็อกไม่ให้ส่งสตรีมสด 20 วินาที พร้อมแสดงป้ายแจ้งเตือนกลางจอฟาร์ม + กระพริบช้า + ซ่อนค่าสดเป็น `**.**`<br>• **Smart 3 Rescue First-Entry Filter Only:** กรองสัญญาณแท่งเทียน (`IsRescueExhaustionConfirmed`) **เฉพาะตอนเปิดไม้กู้ภัยไม้แรก (`R1`) เท่านั้น** เมื่อมี `R1` แล้ว ไม้ `R2`, `R3` และการวาง `R1` ซ้ำ (`repositionR1Target`) จะออกตามระยะ 45 Pips หรือราคาที่จำไว้ทันทีโดยไม่กรองซ้ำ เพื่อรักษาระยะโครงสร้างกริด<br>• **MT5 Comment Prefix Fix:** เปลี่ยนคำนำหน้า Comment ใน MT5 จาก `EMP18:` เป็น `EMP:` ทั้งหมด (`EMP:<SYM>:B#`, `EMP:<SYM>:S#`, `EMP:<SYM>:HDG`, `EMP:<SYM>:R#`) |
| **`B261013.1`** | **EasyM MAX v2.00-1013**<br>(`EasyM_Max_v200_B261013_1`) | 2026-10-13 | One-Way Telemetry<br>(Direct-to-Supabase + 10m Fallback) | • **Upgraded Communication Architecture for EasyM MAX:** ยกระดับระบบส่งข้อมูลของ EasyM MAX ให้ใช้ Direct-to-Supabase RPC + Unified Single-Loop `OnTimer()` + Auto-Fallback 10m Standby-Only (`FALLBACK_1URL`) เหมือนรุ่น Prime 100%<br>• **Preserved Classic MAX Trading Logic:** คงลอจิกการเทรด 20 คู่เงินดั้งเดิมของ EasyM MAX ไว้ 100% (ไม่มี Quarantine และไม่มี Smart 3 Rescue) |
| **`B261013.1`** | **EasyM Prime v2.00-1013**<br>(`EasyM_Prime_v200_B261013_1`) | 2026-10-13 | One-Way Telemetry | • **Direct-to-Supabase RPC Architecture:** ส่งข้อมูลตรงเข้า Supabase PostgREST RPC (`sync_ea_dashboard`) ลดภาระ Vercel<br>• **Unified Single-Loop Sync:** รวมศูนย์การส่งข้อมูลไว้ที่ `EM_MonitorOnTimer()` จุดเดียว ป้องกันการยิง WebRequest ซ้อน |
| **`B261011.2`** | **EasyM Prime v2.00-1011**<br>(`EasyM_Prime_v200_B261011_2`) | 2026-10-11 | One-Way Telemetry | • **Smart 3 Rescue Anchor Memory (`repositionR1Target`):** จดจำราคาเปิดของ `R1` เมื่อถูกรวบปิดทำกำไรคู่กับไม้ปลาย เพื่อกลับมาเปิด `R1` ซ้ำ ณ จุดเดิมเมื่อราคาย้อนกลับ |
| **`B261011.1`** | **EasyM Prime v2.00-1011**<br>(`EasyM_Prime_v200_B261011_1`) | 2026-10-11 | One-Way Telemetry | • **Clean Naming & Telemetry Sync:** มาตรฐานชื่อไฟล์ `EasyM_Prime_v200_B<YYMMDD>_<Rev>` และซิงค์ข้อมูลคู่กักกัน/กู้ภัยขึ้นหน้าฟาร์ม |
| **`B261009.1`** | **v2.00-1008**<br>**v2.00-1009** | 2026-10-09 | 1008: Standalone (ปิด)<br>1009: Full 2-Way (เปิด) | • **Step-by-Step Cascade Adaptive Quarantine:** ทำงานทีละขั้นเมื่อพอร์ตติด FREEZE ($\ge 28\%$) หรือ SLOW ($\ge 18\%$) โดยทยอยดึงคู่ DD สูงสุดที่ $\ge 10\%$ เข้าขังทีละคู่จนพอร์ตคลายสู่ NORMAL<br>• **Separate F7 Inputs:** แยกตัวแปร `InpQuarantineFloorPct = 10.0` (เมื่อพอร์ตมีปัญหา) และ `InpQuarantineSinglePairPct = 14.0` (ดักคู่หลุดเดี่ยวแม้พอร์ต NORMAL)<br>• **Anti-Falling Knife Smart Rescue:** ฟิลเตอร์ Exhaustion (Rejection Wick $\ge 35\%$, Reversal Candle, Consolidation) ก่อนยิงไม้กู้ภัย R1-R3<br>• **100% Symbol Freeze Coverage:** ปิดจุดบอดคู่ที่ 5 ตรวจสอบสถานะ Freeze ทุกคู่ในพอร์ต |
| **`B261008.1`** | **v2.00-1008** | 2026-10-08 | Standalone (ปิด) | • Stable Standalone Release สำหรับส่งมอบลูกค้าทั่วไป<br>• Daily Drawdown Recalibration ให้ตรงกับเว็บฟาร์ม<br>• Quarantine Quota ปรับเป็น 3 คู่เงิน |
| **`B261006.1`** | **v2.00-1006** | 2026-10-06 | One-Way Telemetry | • Cent Account Auto-Normalization<br>• Relief Fund Budget Cap 5% ของยอด Balance<br>• Max Currency Cluster ปรับจาก 2 เป็น 3 คู่ |
| **`B261001.1`** | **v2.00-1001** | 2026-10-01 | One-Way Telemetry | • Auto-Hedge Delta=0 สำหรับคู่ที่แย่ที่สุดตัวเดียว<br>• 20-Pair Rebalancing (นำ AUDNZD, CADCHF, NZDCAD เข้ามาแทนคู่ผันผวนสูง) |

---

## 🔍 รายละเอียดเชิงลึกเฉพาะรุ่น `B261009.1` (Architecture Deep Dive)

### 1. การทำงานของ Step-by-Step Cascade Adaptive Quarantine
```text
[พอร์ตแตะ FREEZE >= 28%]
       │
       ▼
[ขังคู่แย่สุดตัวที่ 1 (DD >= 10% Floor)] ───► พอร์ตคลายตัวเหลือ DD=24.42%
       │
       ▼
[พอร์ตยังติด SLOW >= 18% ?]
   ├── YES ──► มีโควตาว่าง? ──► [ขังคู่แย่สุดตัวที่ 2 (DD >= 10% Floor)] ──► พอร์ตคลายตัวเหลือ DD=10.42%
   └── NO                                                                             │
        │                                                                             ▼
        └───────────────────────────────► [พอร์ตกลับสู่ NORMAL ทันที!] ◄───────────────┘
                                                       │
                                                       ▼
                                         [หยุดขังเพิ่ม! ไม่เปลืองโควตา]
```

### 2. เกณฑ์ดักจับคู่หลุดเดี่ยว (Standalone Runaway)
* แม้พอร์ตโดยรวมจะอยู่ในสภาวะปกติ (NORMAL เช่น DD รวมพอร์ตเพิ่งแตะ 3-5%)
* หากมีคู่เงินใดเกิดเหตุการณ์กระชากเดี่ยวจนแตะ **$\text{DD} \ge 14.0\%$** (`InpQuarantineSinglePairPct`)
* ระบบจะดึงคู่นั้นเข้าห้องขังเดี่ยวทันที เพื่อตัดไฟแต่ต้นลม ไม่ให้ลุกลามมาฉุดพอร์ตหลัก

### 3. พารามิเตอร์ Input F7 สำหรับรุ่น `B261009.1`
```mql5
input group "------- 🛡️ QUARANTINE & RESCUE DEFENSE"
input bool   InpEnableQuarantine          = true;  // Quarantine Mode ON/OFF
input double InpQuarantineFloorPct        = 10.0;  // Adaptive Quarantine Floor DD% (When SLOW/FREEZE)
input double InpQuarantineSinglePairPct   = 14.0;  // Single-Pair Runaway DD% -> QUARANTINE (Standalone)
input double InpQuarantineResumePct       = 8.0;   // Quarantine Safe Release Floor DD%
input int    InpMaxQuarantinedSymbols     = 3;     // Max Quarantined Pairs before FREEZE ALL
```

---

## 📑 นโยบายการเข้าถึงหน้าฟาร์ม และความเข้ากันได้ของทุกเวอร์ชัน
* ดูรายละเอียดนโยบายฉบับสมบูรณ์ได้ที่: [EASYM_FARM_ACCESS_AND_VERSION_POLICY.md](file:///Users/suphakorn/EA%20Market%20Place/EasyM%20Marketing/EASYM_FARM_ACCESS_AND_VERSION_POLICY.md)
* ครอบคลุม: การเปิดปุ่มดูฟาร์มในแดชบอร์ด, สิทธิ์ของ Prime vs MAX, การแสดงผลหน้าฟาร์ม Classic vs Prime, และพฤติกรรมการซิงค์ข้อมูลของ EA ทุกเจเนอเรชัน

