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

    // Fetch all profiles with IB status = 'pending', joined with their broker info
    // We use inner join to get only profiles that have a broker
    const { data: ibRequests, error } = await supabase
        .from("profiles")
        .select(`
            id,
            full_name,
            ib_status,
            ib_account_number,
            ib_broker_id,
            updated_at,
            brokers!profiles_ib_broker_id_fkey (
                name,
                ib_link
            )
        `)
        .eq("ib_status", "pending")
        .order("updated_at", { ascending: false });

    return <AdminIbRequestsClient initialRequests={ibRequests || []} />;
}
