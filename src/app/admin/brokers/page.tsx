import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminBrokersClient from "./admin-brokers-client";

export const metadata = {
    title: "Manage Brokers | Admin Dashboard",
    description: "Manage your partner brokers and IB links.",
};

export default async function AdminBrokersPage() {
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

    // Fetch brokers
    const { data: brokers, error } = await supabase
        .from("brokers")
        .select("*")
        .order("created_at", { ascending: false });

    return <AdminBrokersClient initialBrokers={brokers || []} />;
}
