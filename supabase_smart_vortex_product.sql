-- Insert or Update Smart Vortex product into Supabase `products` table (Smart EA group)
-- Run this in Supabase SQL Editor.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.products WHERE product_key = 'SMART-VORTEX-01') THEN
        UPDATE public.products
        SET
            name = 'Smart Vortex',
            description = 'Anchored Expanding Stop Grid EA รุ่นใหม่ในกลุ่ม Smart EA แยกโครงสร้างโมดูลชัดเจน พร้อมระบบเชื่อมต่อ 2-Way Real-Time ผ่านหน้าเว็บ eaeze.com/smart-ea สั่งปรับระยะ Grid, Lot, Target Profit และ Pause/Freeze ได้ทันทีจากมือถือและคอมพิวเตอร์โดยไม่ต้องกรอก API Key',
            price_monthly = 0,
            price_quarterly = 0,
            price_lifetime = 0,
            version = '1.00',
            is_active = true,
            platform = 'mt5',
            asset_class = 'gold',
            strategy = 'Smart EA',
            min_balance = 100,
            currency = 'USD',
            allow_rent = false,
            allow_ib = false,
            is_multi_port = false,
            port_count = 1
        WHERE product_key = 'SMART-VORTEX-01';
    ELSE
        INSERT INTO public.products (
            product_key,
            name,
            description,
            price_monthly,
            price_quarterly,
            price_lifetime,
            image_url,
            version,
            is_active,
            platform,
            asset_class,
            strategy,
            min_balance,
            currency,
            allow_rent,
            allow_ib,
            is_multi_port,
            port_count
        )
        VALUES (
            'SMART-VORTEX-01',
            'Smart Vortex',
            'Anchored Expanding Stop Grid EA รุ่นใหม่ในกลุ่ม Smart EA แยกโครงสร้างโมดูลชัดเจน พร้อมระบบเชื่อมต่อ 2-Way Real-Time ผ่านหน้าเว็บ eaeze.com/smart-ea สั่งปรับระยะ Grid, Lot, Target Profit และ Pause/Freeze ได้ทันทีจากมือถือและคอมพิวเตอร์โดยไม่ต้องกรอก API Key',
            0,
            0,
            0,
            '/assets/easym_max_box.png',
            '1.00',
            true,
            'mt5',
            'gold',
            'Smart EA',
            100,
            'USD',
            false,
            false,
            false,
            1
        );
    END IF;
END $$;
