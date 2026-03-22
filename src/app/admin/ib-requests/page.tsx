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
            user_id,
            profiles (
                full_name,
                email
            ),
            brokers!inner (
                name,
                ib_link,
                owner_id
            )
        `)
        .in("status", ["pending", "approved"])
        .order("status", { ascending: false }) // Sort pending first
        .order("updated_at", { ascending: false });

    // Fetch all profiles for upline tracing
    const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, referred_by");

    const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));

    const getUplineAdmin = (userId: string) => {
        let current = profileMap.get(userId);
        let visited = new Set();
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.role === "admin") return current;
            if (!current.referred_by) break;
            current = profileMap.get(current.referred_by);
        }
        return null;
    };

    const enrichedRequests = (ibRequests || []).map((req: any) => ({
        ...req,
        root_admin: getUplineAdmin(req.user_id)
    }));
    
    // Extract unique admins for the filter dropdown
    const uniqueAdmins = Array.from(
        new Set((allProfiles || []).filter(u => u.role === 'admin' && u.email).map(u => u.email))
    );

    return <AdminIbRequestsClient initialRequests={enrichedRequests} uniqueAdmins={uniqueAdmins as string[]} />;
}
