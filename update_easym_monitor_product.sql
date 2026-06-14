-- ===================================================================
-- Run this in your Supabase SQL Editor to activate the Monitor product
-- ===================================================================

UPDATE public.products 
SET is_active = true, 
    platform = 'mt5', 
    currency = 'USD', 
    min_balance = 0,
    description = 'Easy Universal Monitor คือสะพานเชื่อมข้อมูลพอร์ต MT5 ของคุณไปแสดงผลแบบเรียลไทม์บนหน้าเว็บ แดชบอร์ดมีให้เลือกทั้งแบบยานอวกาศ (Spaceship) และแบบเกมปลูกผัก (2.5D Pixel Farm) ช่วยให้คุณเฝ้าพอร์ตและวิเคราะห์ข้อมูลได้อย่างอัจฉริยะในทุกที่ทุกเวลา'
WHERE product_key = 'EA-UNIMON-01';
