import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// Allowed directories for local EA files (strictly bounded to prevent traversal)
const LOCAL_EA_DIRS = [
    path.join(process.cwd(), "mt5_integration/Experts/EasyM"),
    path.join(process.cwd(), "mt5_integration/Experts/TradingGameMaster"),
    path.resolve(process.cwd(), "..", "Finishing EAeze Products"),
];

export async function GET(request: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || user.email !== "juntarasate@gmail.com") {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const fileParam = searchParams.get("file");

        // 1. If file download is requested
        if (fileParam) {
            const cleanName = path.basename(fileParam.trim());
            if (!cleanName || cleanName.includes("..")) {
                return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
            }

            // Search local directories
            for (const dir of LOCAL_EA_DIRS) {
                if (fs.existsSync(dir)) {
                    const candidate = path.join(dir, cleanName);
                    if (fs.existsSync(candidate)) {
                        const fileBuffer = fs.readFileSync(candidate);
                        const isMq5 = cleanName.endsWith(".mq5");
                        const contentType = isMq5 ? "text/plain; charset=utf-16le" : "application/octet-stream";

                        return new NextResponse(fileBuffer, {
                            status: 200,
                            headers: {
                                "Content-Type": contentType,
                                "Content-Disposition": `attachment; filename="${encodeURIComponent(cleanName)}"`,
                                "Content-Length": fileBuffer.length.toString(),
                            },
                        });
                    }
                }
            }

            // If not found locally, check if it matches a product's file_url in DB
            const { data: product } = await supabase
                .from("products")
                .select("file_url, name, product_key")
                .or(`id.eq.${cleanName},product_key.eq.${cleanName}`)
                .single();

            if (product && product.file_url) {
                return NextResponse.redirect(product.file_url);
            }

            return NextResponse.json({ error: "File not found on server" }, { status: 404 });
        }

        // 2. Default: Return unified list of ALL downloadable EAs
        const { data: dbProducts, error: dbErr } = await supabase
            .from("products")
            .select("id, name, description, product_key, file_url, min_balance, currency, asset_class, strategy, version, is_active")
            .order("name", { ascending: true });

        if (dbErr) {
            console.error("Error fetching products:", dbErr);
        }

        interface DownloadableEA {
            id: string;
            name: string;
            product_key: string;
            category: "easym" | "gold" | "semiauto" | "v2_suite" | "other";
            category_label: string;
            version: string;
            min_balance: number;
            currency: string;
            file_type: ".ex5" | ".mq5";
            file_name: string;
            download_url: string;
            is_local: boolean;
            is_active_product: boolean;
            description?: string;
        }

        const eaList: DownloadableEA[] = [];

        // A. Add latest EasyM Universal v2.00 Suite (MQ5 Sources & EX5s)
        const v2Suite = [
            {
                name: "EasyM Prime Universal (v2.00 0928)",
                key: "EZM-PRIME-V1",
                file: "EASY_M_Prime_v200_0928.mq5",
                type: ".mq5" as const,
                desc: "10 Pairs Universal + Rescue & Resilience Suite (Source Code MQ5)",
                minBal: 1000,
                cur: "USD",
                cat: "v2_suite" as const,
                catLabel: "⚡ EasyM v2.00 Suite"
            },
            {
                name: "EasyM Prime Universal (v1.18 0924 EX5)",
                key: "EZM-PRIME-V1",
                file: "EASY_M Prime v1.18 0924.ex5",
                type: ".ex5" as const,
                desc: "10 Pairs Universal + Rescue & Resilience Suite (Compiled EX5)",
                minBal: 1000,
                cur: "USD",
                cat: "v2_suite" as const,
                catLabel: "⚡ EasyM v2.00 Suite"
            },
            {
                name: "EasyM MAX Universal (v2.00 0928)",
                key: "EZM-MAX-V1",
                file: "EASY_M_Max_v200_0928.mq5",
                type: ".mq5" as const,
                desc: "10 Pairs Universal (Source Code MQ5)",
                minBal: 1000,
                cur: "USD",
                cat: "v2_suite" as const,
                catLabel: "⚡ EasyM v2.00 Suite"
            },
            {
                name: "EasyM mini Universal (v2.00 0928)",
                key: "EZM-MIN-V1",
                file: "EASY_M_mini_v200_0928.mq5",
                type: ".mq5" as const,
                desc: "5 Pairs Universal + Rescue Edition (Source Code MQ5)",
                minBal: 500,
                cur: "USD",
                cat: "v2_suite" as const,
                catLabel: "⚡ EasyM v2.00 Suite"
            },
            {
                name: "EasyM Farm Universal (v2.00 0928)",
                key: "EZM-FARM-V1",
                file: "EASY_M_Farm_v200_0928.mq5",
                type: ".mq5" as const,
                desc: "5 Pairs Universal ทุน $300 (Source Code MQ5)",
                minBal: 300,
                cur: "USD",
                cat: "v2_suite" as const,
                catLabel: "⚡ EasyM v2.00 Suite"
            },
            {
                name: "Easy Universal Monitor (EX5)",
                key: "EA-UNIMON-01",
                file: "EAE_Monitor v1.16 0904.ex5",
                type: ".ex5" as const,
                desc: "EA เสริมรายงาน Telemetry ข้อมูลพอร์ตขึ้นเว็บ eaeze.com",
                minBal: 0,
                cur: "USD",
                cat: "easym" as const,
                catLabel: "EasyM Family"
            }
        ];

        v2Suite.forEach(item => {
            eaList.push({
                id: `local-${item.file}`,
                name: item.name,
                product_key: item.key,
                category: item.cat,
                category_label: item.catLabel,
                version: "2.00",
                min_balance: item.minBal,
                currency: item.cur,
                file_type: item.type,
                file_name: item.file,
                download_url: `/api/admin/ea-download?file=${encodeURIComponent(item.file)}`,
                is_local: true,
                is_active_product: true,
                description: item.desc
            });
        });

        // B. Add all database products
        (dbProducts || []).forEach(prod => {
            const pKey = (prod.product_key || "").toUpperCase();
            const pName = (prod.name || "").toLowerCase();

            let category: "easym" | "gold" | "semiauto" | "other" = "other";
            let categoryLabel = "สินค้าอื่นๆ";

            if (pKey.includes("EZM") || pName.includes("easym") || pName.includes("easy m") || pKey.includes("UNIMON")) {
                category = "easym";
                categoryLabel = "ตระกูล EasyM";
            } else if (pKey.includes("GOLD") || pKey.includes("EZG") || pName.includes("gold") || prod.asset_class === "gold") {
                category = "gold";
                categoryLabel = "ตระกูล EASYGOLD";
            } else if (pKey.includes("SEMI") || pName.includes("semi auto")) {
                category = "semiauto";
                categoryLabel = "ตระกูล Semi Auto";
            }

            const fileName = prod.file_url ? path.basename(new URL(prod.file_url).pathname) : `${prod.name}.ex5`;

            eaList.push({
                id: prod.id,
                name: prod.name,
                product_key: prod.product_key,
                category,
                category_label: categoryLabel,
                version: prod.version || "1.0",
                min_balance: Number(prod.min_balance) || 0,
                currency: prod.currency || "USD",
                file_type: ".ex5",
                file_name: fileName,
                download_url: prod.file_url || `/api/admin/ea-download?file=${encodeURIComponent(fileName)}`,
                is_local: !prod.file_url,
                is_active_product: !!prod.is_active,
                description: prod.description || ""
            });
        });

        return NextResponse.json({
            total: eaList.length,
            eas: eaList
        });
    } catch (error) {
        console.error("EA download API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
