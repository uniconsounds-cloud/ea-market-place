import { createSupabaseServerClient } from "@/lib/supabase-server";
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

        // Get target admin's referral code
        const { data: targetAdmin } = await supabase
            .from("profiles")
            .select("id, referral_code")
            .eq("id", targetAdminId)
            .single();

        const { error: updateError } = await supabase
            .from("profiles")
            .update({
                referred_by: targetAdminId,
                referred_by_code: targetAdmin?.referral_code || null
            })
            .eq("id", customerId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Update demo_challenges if exists
        await supabase
            .from("demo_challenges")
            .update({ referrer_id: targetAdminId })
            .eq("user_id", customerId);

        return NextResponse.json({ success: true, message: "User transfer successful" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
