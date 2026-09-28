import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || user.email !== "juntarasate@gmail.com") {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        // Fetch all products directly from database (both active and inactive)
        const { data: dbProducts, error: dbErr } = await supabase
            .from("products")
            .select("id, name, description, product_key, file_url, min_balance, currency, asset_class, strategy, platform, version, is_active")
            .order("name", { ascending: true });

        if (dbErr) {
            console.error("Error fetching products:", dbErr);
            return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
        }

        interface DownloadableProduct {
            id: string;
            name: string;
            product_key: string;
            category: "easym" | "gold" | "semiauto" | "silver" | "other";
            category_label: string;
            version: string;
            min_balance: number;
            currency: string;
            platform: string;
            strategy?: string;
            file_url: string | null;
            file_name: string;
            has_file: boolean;
            is_active: boolean;
            description?: string;
        }

        const products: DownloadableProduct[] = (dbProducts || []).map((prod) => {
            const pKey = (prod.product_key || "").toUpperCase();
            const pName = (prod.name || "").toLowerCase();
            const assetClass = (prod.asset_class || "").toLowerCase();

            let category: "easym" | "gold" | "semiauto" | "silver" | "other" = "other";
            let category_label = "สินค้าทั่วไป";

            if (pKey.includes("EZM") || pName.includes("easym") || pName.includes("easy m") || pKey.includes("UNIMON") || assetClass === "currency") {
                category = "easym";
                category_label = "ตระกูล EasyM";
            } else if (pKey.includes("SEMI") || pName.includes("semi auto")) {
                category = "semiauto";
                category_label = "ตระกูล Semi Auto";
            } else if (assetClass === "silver" || pKey.includes("SILVER") || pName.includes("silver")) {
                category = "silver";
                category_label = "ตระกูล Easy Silver";
            } else if (pKey.includes("GOLD") || pKey.includes("EZG") || pName.includes("gold") || assetClass === "gold") {
                category = "gold";
                category_label = "ตระกูล EASYGOLD";
            }

            let fileName = "ยังไม่มีไฟล์บนระบบ";
            if (prod.file_url) {
                try {
                    const rawName = prod.file_url.split("/").pop() || "";
                    fileName = decodeURIComponent(rawName);
                } catch {
                    fileName = `${prod.name}.ex5`;
                }
            }

            return {
                id: prod.id,
                name: prod.name,
                product_key: prod.product_key || "-",
                category,
                category_label,
                version: prod.version || "1.0",
                min_balance: Number(prod.min_balance) || 0,
                currency: prod.currency || "USD",
                platform: (prod.platform || "MT5").toUpperCase(),
                strategy: prod.strategy,
                file_url: prod.file_url || null,
                file_name: fileName,
                has_file: !!prod.file_url,
                is_active: !!prod.is_active,
                description: prod.description || ""
            };
        });

        return NextResponse.json({
            total: products.length,
            products
        });
    } catch (error) {
        console.error("EA download API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
