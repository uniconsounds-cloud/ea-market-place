import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminIbRequestsClient from "./admin-ib-requests-client";

export const metadata = {
    title: "IB Requests | Admin Dashboard",
    description: "Manage and approve user IB requests.",
};

export default async function AdminIbRequestsPage() {
    const supabase = await createSupabaseServerClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect("/login");
    }

    // Check if user is admin
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

    if (profile?.role !== "admin") {
        redirect("/");
    }

    // Fetch all pending ib_memberships, joined with profiles and brokers
    const { data: ibRequests, error } = await supabase
        .from("ib_memberships")
        .select(`
            id,
            verification_data,
            status,
            updated_at,
            profiles (
                full_name,
                email
            ),
            brokers (
                name,
                ib_link
            )
        `)
        .eq("status", "pending")
        .order("updated_at", { ascending: false });

    return <AdminIbRequestsClient initialRequests={ibRequests || []} />;
}
