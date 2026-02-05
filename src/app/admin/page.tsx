import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

export default function AdminDashboardPage() {
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
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">สินค้าในระบบ</p>
                    </CardContent>
                </Card>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200">
                ยินดีต้อนรับกลับครับแอดมิน! เลือกเมนู <strong>"จัดการสินค้า"</strong> ด้านซ้ายเพื่อเริ่มเพิ่ม/แก้ไข EA ได้เลยครับ
            </div>
        </div>
    );
}
