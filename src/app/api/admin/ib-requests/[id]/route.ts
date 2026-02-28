import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if admin
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

        if (profile?.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();

        // Ensure action is explicitly "approve" or "reject"
        const { action, expiryDate } = body;

        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        // Build update payload
        const updates: any = {
            ib_status: newStatus
        };

        if (action === "approve") {
            if (!expiryDate) {
                return NextResponse.json({ error: "Expiry date is required for approval" }, { status: 400 });
            }
            updates.ib_expiry_date = expiryDate;
        }

        const { error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", id); // Note: Folder is [id], params.id maps to the user's profile ID

        if (error) {
            console.error(`Error updating IB request for user ${id}:`, error);
            return NextResponse.json({ error: "Failed to update IB request" }, { status: 500 });
        }

        return NextResponse.json({ success: true, status: newStatus }, { status: 200 });
    } catch (error) {
        console.error("Unexpected error updating IB request:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
