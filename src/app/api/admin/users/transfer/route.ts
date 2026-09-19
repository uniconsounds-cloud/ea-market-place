import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if admin
        const { data: profile } = await supabase
            .from("profiles")
            .select("role, email")
            .eq("id", session.user.id)
            .single();

        const isRootAdmin = profile?.email === "juntarasate@gmail.com" || profile?.email === "bctutor123@gmail.com";
        if (profile?.role !== "admin" && !isRootAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { customerId, targetAdminId } = body;

        if (!customerId || !targetAdminId) {
            return NextResponse.json({ error: "customerId and targetAdminId are required" }, { status: 400 });
        }

        const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
            ? createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.SUPABASE_SERVICE_ROLE_KEY
            )
            : supabase;

        const { error: updateError } = await dbClient
            .from("profiles")
            .update({
                referred_by: targetAdminId
            })
            .eq("id", customerId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Update demo_challenges if exists
        await dbClient
            .from("demo_challenges")
            .update({ referrer_id: targetAdminId })
            .eq("user_id", customerId);

        // Auto-approve and complete any pending admin_transfer_requests for this customer
        try {
            await dbClient
                .from("admin_transfer_requests")
                .update({
                    source_approved: true,
                    target_approved: true,
                    status: 'completed'
                })
                .eq("customer_id", customerId)
                .eq("status", "pending");
        } catch (_) {
            // Ignore if error
        }

        return NextResponse.json({ success: true, message: "User transfer successful" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
