import { createSupabaseServerClient } from '@/lib/supabase-server';
import { AdminDashboardClient } from '@/components/admin-dashboard-client';

export const revalidate = 0;

export default async function AdminDashboardPage() {
    const supabase = await createSupabaseServerClient();

    // Diagnostic: Check User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[AdminPage] Current User:', user?.id, 'Auth Error:', authError);

    const [productsResult, ordersResult, licensesResult] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('id, amount, status, product_id').order('created_at', { ascending: false }),
        supabase.from('licenses').select('id, product_id, is_active').eq('is_active', true)
    ]);

    if (productsResult.error) console.error('[AdminPage] Products Error:', productsResult.error);
    if (ordersResult.error) console.error('[AdminPage] Orders Error:', ordersResult.error);
    if (licensesResult.error) console.error('[AdminPage] Licenses Error:', licensesResult.error);

    const products = productsResult.data || [];
    const allOrders = ordersResult.data || [];
    const licenses = licensesResult.data || [];

    // Debug output for Client Access (if needed)
    const debugInfo = {
        userId: user?.id,
        productsCount: products.length,
        ordersCount: allOrders.length,
        licensesCount: licenses.length,
        ordersError: ordersResult.error,
        authError
    };

    // Filter completed orders (Case Insensitive)
    const completedOrders = allOrders.filter(o => o.status?.toLowerCase() === 'completed');

    // Calculate Global Stats
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const totalOrders = completedOrders.length;
    const activeLicenses = licenses.length;

    const stats = {
        totalProducts: products.length,
        totalOrders,
        totalRevenue,
        activeLicenses
    };

    // Calculate Per-Product Metrics
    const productMetrics: Record<string, { productId: string; salesCount: number; revenue: number; activeLicenses: number }> = {};

    // Initialize metrics
    products.forEach(p => {
        productMetrics[p.id] = {
            productId: p.id,
            salesCount: 0,
            revenue: 0,
            activeLicenses: 0
        };
    });

    // Aggregate Orders
    completedOrders.forEach(o => {
        if (productMetrics[o.product_id]) {
            productMetrics[o.product_id].salesCount++;
            productMetrics[o.product_id].revenue += (o.amount || 0);
        }
    });

    // Aggregate Licenses
    licenses.forEach(l => {
        if (productMetrics[l.product_id]) {
            productMetrics[l.product_id].activeLicenses++;
        }
    });

    return (
        <AdminDashboardClient
            products={products}
            stats={stats}
            productMetrics={productMetrics}
            debugInfo={debugInfo}
        />
    );
}
