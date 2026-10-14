# 🏷️ EA Technical Build Registry & Edition Ledger
> **บันทึกประวัติการสร้างและเลข ID ย่อยของ EA (Internal Technical Editions)**
> เอกสารฉบับนี้จัดทำขึ้นเป็น Single Source of Truth สำหรับผู้ดูแลระบบ (Admin) เพื่อใช้อ้างอิงทางเทคนิคในการตรวจสอบว่า พอร์ตใดกำลังรัน EA Edition / Build ใดอยู่ โดยไม่ต้องเปิดอ่านโค้ดซ้ำ

> [!CAUTION]
> **กฎเหล็กเด็ดขาด (MANDATORY RULE):** ทุกครั้งที่มีการแก้ไขปรับปรุงโค้ด EA (ไม่ว่าจะเป็นเรื่องเล็กหรือใหญ่) **จะต้องสร้างเป็น Build ใหม่เสมอทุกครั้ง!**
> 1. ห้ามแก้ไขทับใน Build เดิมเด็ดขาด
> 2. ต้องรันเลข Revision ใหม่ (เช่น `B261011.2` $\rightarrow$ `B261011.3`) หรือวันใหม่ทันที
> 3. สร้างไฟล์ `.mq5` และคอมไพล์เป็น `.ex5` ชื่อใหม่ตาม Build ID
> 4. คัดลอกไปยังโฟลเดอร์ MT5, Repo, และ Release
> 5. บันทึกรายละเอียดลงในตารางนี้ทันทีทุกครั้ง!

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

| **`B261014.1`** | **EasyM Prime** (`v2.00-1014`) | 2026-10-14 | **Universal Edition:** Multi-Tier Cascading Rescue & Anchor Handover | • **Multi-Tier Cascading Rescue Grid (Tier 1 -> Tier 2 -> Tier 3):** กู้ภัย 3 สเตจ (สูงสุดไม่เกิน 9 ไม้) โดย Tier 1 (ไม้ 1-3) เริ่มทำงานที่ Entry DD + 4.0% พร้อม Distance Gate (1.0 ATR / 80-100 pips), หากลากต่อจน DD เพิ่มอีก +4% จะยกระดับสู่ Tier 2 (ไม้ 4-6) และลากต่ออีก +4% สู่ Tier 3 (ไม้ 7-9) ล็อตต่อเนื่องตามขั้นบันไดและควบคุมเพดานสูงสุดไม่เกิน 1.10 lot<br>• **100% Price Action Exhaustion บนทุกไม้:** ตรวจสอบไส้เทียนปฏิเสธราคา ($\\ge 35\\%$), แท่งกลับตัวแรก, หรือกรอบบีบแคบ และบล็อกมีดร่วง Waterfall/Rocket Spike บนไม้กู้ภัยทุกไม้ (R1 ถึง R9)<br>• **Independent Rescue Basket Profit Taking:** ปลดล็อกเงื่อนไข `count < 3` ให้ชุดกู้ภัยสามารถปิดรวบทำกำไรได้อย่างอิสระเมื่อ PnL $\\ge 20$ cent โดยปิดได้ตั้งแต่ 1, 2, หรือ 3 ไม้ แบ่งกำไร 60% เข้า Balance และ 40% เข้า Relief Fund<br>• **Anchor Handover at 12% DD:** เมื่อ DD คู่เงินลดลงมาแตะ $\\le 12.0\\%$ ระบบจะหยุด Scalp ชุดกู้ภัย และสงวนไม้กู้ภัยที่ได้เปรียบราคาที่สุด 1 ไม้ (Anchor Order: ไม้ Buy ต่ำสุด หรือไม้ Sell สูงสุด) ทิ้งไว้เพื่อดึงจุด TP/BE ของตระกร้าหลักให้ปิดรวบได้เร็วยิ่งขึ้น<br>• **3-to-1 Profit-to-Trim Rule:** บังคับให้ชุดกู้ภัยทำกำไรครบ 3 รอบก่อน จึงจะดึงเงิน Relief Fund ไปตัดปิดไม้ติดลบของตระกร้าปกติ 1 ไม้ (ไม้ที่ดอยลึกที่สุด) รับประกันพอร์ตมี Cash Flow บวกแน่นอน<br>• **Dual-Mode Quarantine Release:** ปลดปล่อยคู่เงินจากห้องขังที่ $\\le 12.0\\%$ ในสภาวะพอร์ตปกติ (NORMAL) และเพดานปลอดภัย $\\le 8.0\\%$ เมื่อพอร์ตติด SLOW/FREEZE ขจัดปัญหาอาการเด้งเข้าออกห้องขัง (Oscillation Trap) 100%<br>• **Cold-Boot State Persistence:** บันทึกและดึงค่าจุดขังเดิม `g_quarantineEntryDD` ผ่าน MT5 GlobalVariables (`EMP_Q_ENTRY_<login>_<sym>`) ทำงานต่อเนื่องทันทีแม้เครื่องรีสตาร์ต |
| **`B261013.1`** | **EasyM Prime** (`v2.00-1013`) | 2026-10-13 | **Prime:** Direct-to-Supabase RPC + Auto-Fallback (`eaeze.com`) | • **Smart 3 Rescue (`[R1-R3]`, Magic `st.magic + 2000`):**<br>&nbsp;&nbsp;- **ขนาดล็อตต่อเนื่อง (Continuous Ladder Lot):** ใช้ `LadderLot(regularCount + rescueCount + 1)` ต่อเนื่องจากชุดไม้ปกติ<br>&nbsp;&nbsp;- **การปิดรวบ 2 ไม้บน (`TryCloseTopTwoRescueOrders`):** หากเปิดเพียง 1–2 ไม้ (`R1` หรือ `R1+R2`) จะไม่ปิดแยกเดี่ยว (ปล่อยช่วยดึงจุดคุ้มทุนรวบทั้งตระกร้า) แต่เมื่อออกครบ 3 ไม้ (`R1, R2, R3`) และผลรวมกำไร `PnL(R1) + PnL(R2) >= InpRescueTargetMoney` ระบบจะสั่งปิดเฉพาะ `R1` และ `R2` ส่งกำไรเข้ากองทุนกู้ภัย (`Relief Fund`) ทันที พร้อมเลื่อน `R3` ขึ้นมาเป็น `R2` ของรอบใหม่<br>&nbsp;&nbsp;- **การจำจุดเข้า `R2` เดิมเพื่อออก `R1` รอบใหม่ (`repositionR1Target`):** จำราคาเปิดของ `R2` เดิมไว้ เมื่อราคาย่อตัวกลับลงมาถึงจุดดังกล่าวและผ่านเงื่อนไขกรองแท่งเทียน จะเปิดไม้ `R1` ใหม่ทันทีเพื่อเก็บกำไรจากการสวิงสั้นซ้ำได้ต่อเนื่อง<br>&nbsp;&nbsp;- **กรณีเปิดเครื่องใหม่ / รีเซ็ต VPS (Cold-Boot Fallback):** ไม่ต้องจำจุดเข้าเดิม หากเปิดมาเจอไม้กู้ภัย 1 ไม้ถือเป็น `R1` ทันที, เจอ 2 ไม้ถือเป็น `R1, R2`, เจอ 3 ไม้ถือเป็น `R1, R2, R3`<br>• **Finalized Hybrid Communication Architecture (Zero Vercel CPU Burn):**<br>&nbsp;&nbsp;- ส่งข้อมูลตรงเข้า **Supabase RPC (`sync_ea_data` / `sync_ea_history_batch`)** เป็นหลัก พร้อมระบบ **Auto-Fallback** สลับกลับไป `https://eaeze.com/api/sync-dashboard` อัตโนมัติหากพอร์ตไม่ได้ใส่ URL ที่ 2<br>&nbsp;&nbsp;- **Unified Single-Sync Loop:** ยุบรวมลูปส่งข้อมูลเหลือจุดเดียวที่ `OnTimer()` (`EM_MonitorOnTimer`) ตัดปัญหาการยิงซ้ำซ้อนจาก `OnTick()`<br>&nbsp;&nbsp;- **Smart Standby 10 นาที (`600s`) / Active `20s`:** เมื่อไม่มีคนเปิดดูหน้าเว็บฟาร์มจะส่ง Heartbeat ทุก 10 นาที (`ping_only: false`, `orders: []`) และสลับเป็นทุก 20 วินาทีทันทีที่มีผู้ชมเปิดดู |
| **`B261011.2`** | **EasyM Prime** (`v2.00-1011`) | 2026-10-11 | **Prime:** Standalone (1008) / 2-Way (1011) | • **Version String Update:** ปรับ `EA_VERSION_STR` เป็น `v2.00-1011` ตามรอบการปรับปรุง<br>• **Default Initial Capital 1,000 USD:** ปรับค่าเริ่มต้น `InpInitialCapital` ในหน้าตั้งค่า EA F7 ให้เป็น `CAP_1000_USD` (1,000 เหรียญ)<br>• **Quarantine Floor Recalibration (Item 4):** เมื่อเปิด EA ครั้งแรกแล้วพบคู่ที่ DD เกินเกณฑ์ (เช่น 22%) ล็อคฐานอ้างอิง `g_quarantineEntryDD` ไว้ที่ 14.0% ทันที ส่งผลให้เกณฑ์กู้ภัยคำนวณได้ที่ $14\% + 8\% = 22\%$ พร้อมตรวจสอบตัวกรองกราฟ (Rejection Wick / RSI Exhaustion) และระยะห่าง 100 pips ก่อนออกไม้แก้<br>• **Rescue Orders Telemetry:** เพิ่ม `rescue_orders` ใน `quarantined_json` และ `pairs_json` เพื่อส่งสถานะจำนวนไม้กู้ภัยขึ้นสู่เว็บฟาร์มแบบเรียลไทม์<br>• **Farm Web Alignment:** ปรับ DD ใต้ Balance ให้ตรงกับ Red Orb 1, เปลี่ยน DD ใกล้ลังไม้เป็น `MaxDD: -xx.xx%`, ปรับสัดส่วนต้นไม้เหี่ยวเฉากลางแจ้งให้อิงตาม Active DD, และแสดงดอกไม้พร้อมสถานะ `tree_aura` บนต้นไม้ที่ถูกขังในโดมเมื่อเริ่มออกไม้กู้ภัย |
| **`B261011.1`** | **EasyM Prime** (`v2.00`) | 2026-10-11 | **Prime:** Standalone (1008) / 2-Way (1009) | • **Full 20-Pair Telemetry Stream:** ปรับปรุง `BuildPrimeTelemetryJson()` ใน Prime ให้ส่งโครงสร้าง `pairs` ครบถ้วนทั้ง 20 คู่เงิน (`side`, `count`, `lot`, `pnl`, `dd_pct`, `enabled`, `buy_count`, `sell_count`) ขึ้นสู่ Web Farm Dashboard แบบเรียลไทม์<br>• **Symbol Inclusion in Web Orders:** อัปเดต `EAE_WebSync.mqh` ให้ใส่ `"symbol"` ในคำสั่ง JSON เพื่อให้คำสั่งออเดอร์ทุกคู่เงินแมปเข้ากับ UI ได้ 100%<br>• **Cockpit Orb 2 Direct Integration:** รองรับ UI ห้องควบคุมลูกแก้วที่ 2 ของ Prime Farm หน้าปัด 20 คู่เงิน 2 คอลัมน์ 10 แถว พร้อมมิเตอร์ VU และคานศูนย์ P/L Balance Bar |
| **`B261011.1`** | **EasyM Max** (`v2.00`) | 2026-10-11 | Standalone Local MT5 (1-Way Telemetry) | • **100% English Experts Tab Logs:** ปรับข้อความรายงานการทำงานในแท็บ Experts ของ MT5 ทั้งหมดให้เป็นภาษาอังกฤษ 100% (แปลสถานะโหมด Farm Viewer Active/Standby Mode ใน EAE_WebSync.mqh ให้เป็น English ปราศจากภาษาไทย)<br>• **Standardized Initialization Print:** ปรับแต่ง Log เริ่มต้นของ EA ในฟังก์ชัน `OnInit()` ให้ระบุ Build ID ชัดเจน `=== EasyM Max v2.00 [B261011.1] initialized | Symbols=20, MagicBase=... ===`<br>• **Full Architecture Verification:** ตรวจสอบความถูกต้องของตระกูล Max 20 คู่เงินดั้งเดิม, Currency Cluster Limiter (`InpMaxCurrencyCluster = 3`), 100% Symbol Freeze Coverage (`InpWorstFreezeOnLossPct = 8.0%`) และคอมไพล์ .ex5 ผ่านสมบูรณ์ 0 errors, 0 warnings |
| **`B261009.1`** | **EasyM Prime** (`v2.00`)<br>**EasyM Max** (`v2.00`) | 2026-10-09 | **Prime:** Standalone (1008) / 2-Way (1009)<br>**Max:** Standalone Local MT5 (1-Way Telemetry) | • **EasyM MAX Final Stable Release:** คงตะกร้า 20 คู่เงินคลาสสิกดั้งเดิม 100%, ปิดจุดบอดคู่ที่ 5 (100% Symbol Freeze Coverage ทุกคู่เงินแตะ 8.0%), ติดตั้ง Currency Cluster Limiter (`InpMaxCurrencyCluster = 3`), ไม่มีระบบ Quarantine/Rescue/Hedge/Relief (เพื่อความเสถียรและแยกเป็นผลิตภัณฑ์คลาสสิก), ชื่อแดชบอร์ด `=== EasyM Max v2.00 [B261009.1] ===`<br>• **EasyM PRIME:** Step-by-Step Cascade Adaptive Quarantine, Separate F7 Inputs (10% Floor / 14% Single-Pair), Anti-Falling Knife Smart Rescue (Rejection Wick $\ge 35\%$), 100% Symbol Freeze Coverage |
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
