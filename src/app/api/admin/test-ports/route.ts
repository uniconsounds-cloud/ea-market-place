import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || session.user.email !== "juntarasate@gmail.com") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: ports, error } = await supabase
            .from("admin_test_ports")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching test ports:", error);
            return NextResponse.json({ error: "Failed to fetch test ports" }, { status: 500 });
        }

        return NextResponse.json({ ports });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || session.user.email !== "juntarasate@gmail.com") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { account_number } = body;

        if (!account_number) {
            return NextResponse.json({ error: "Account number is required" }, { status: 400 });
        }

        const { data: port, error } = await supabase
            .from("admin_test_ports")
            .insert({
                account_number,
                owner_email: session.user.email
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating test port:", error);
            return NextResponse.json({ error: "Failed to create test port" }, { status: 500 });
        }

        return NextResponse.json({ port }, { status: 201 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || session.user.email !== "juntarasate@gmail.com") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        const { error } = await supabase
            .from("admin_test_ports")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting test port:", error);
            return NextResponse.json({ error: "Failed to delete test port" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
