import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 0;

export default async function AdminDashboardPage() {
    // Fetch summary stats
    const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    // Fetch recent products
    const { data: recentProducts } = await supabase
        .from('products')
        .select('name, price_lifetime, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground">จัดการระบบหลังบ้าน</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">สินค้าทั้งหมด</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productCount ?? 0}</div>
                        <p className="text-xs text-muted-foreground">รายการ</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">สินค้าล่าสุด</h2>
                <div className="grid gap-4">
                    {recentProducts?.map((product: any, i: number) => (
                        <Card key={i} className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/10 p-2 rounded-full">
                                    <Package className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="font-medium">{product.name}</p>
                                    <p className="text-xs text-muted-foreground flex items-center">
                                        <Calendar className="mr-1 h-3 w-3" />
                                        {new Date(product.created_at).toLocaleDateString('th-TH')}
                                    </p>
                                </div>
                            </div>
                            <div className="font-bold">
                                ฿{product.price_lifetime.toLocaleString()}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
