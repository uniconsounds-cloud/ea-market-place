import { createSupabaseServerClient } from '@/lib/supabase-server';
import { AdminDashboardClient } from '@/components/admin-dashboard-client';

export const revalidate = 0;

export default async function AdminDashboardPage() {
    const supabase = await createSupabaseServerClient();

    // Parallel Data Fetching
    const [productsResult, ordersResult, licensesResult] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('id, amount, status, product_id').eq('status', 'completed'),
        supabase.from('licenses').select('id, product_id, is_active').eq('is_active', true)
    ]);

    const products = productsResult.data || [];
    const orders = ordersResult.data || [];
    const licenses = licensesResult.data || [];

    // Calculate Global Stats
    const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const totalOrders = orders.length; // Completed orders
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
    orders.forEach(o => {
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
        />
    );
}
