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
            .select("role")
            .eq("id", session.user.id)
            .single();

        if (profile?.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { name, ibLink } = body;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const { data: broker, error } = await supabase
            .from("brokers")
            .insert({
                name,
                ib_link: ibLink || null,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating broker:", error);
            return NextResponse.json({ error: "Failed to create broker" }, { status: 500 });
        }

        return NextResponse.json({ broker }, { status: 201 });
    } catch (error) {
        console.error("Unexpected error creating broker:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
