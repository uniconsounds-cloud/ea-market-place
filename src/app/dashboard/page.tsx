import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CreditCard, Key, ShoppingCart } from 'lucide-react';

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">ภาพรวมบัญชี</h1>
                <p className="text-muted-foreground">ยินดีต้อนรับกลับมา, นี่คือสถานะล่าสุดของคุณ</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">License ที่ใช้งาน</CardTitle>
                        <Key className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">3</div>
                        <p className="text-xs text-muted-foreground">+1 จากเดือนที่แล้ว</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">ยอดลงทุนรวม</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿15,200</div>
                        <p className="text-xs text-muted-foreground">+20% จากเดือนที่แล้ว</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">สถานะ Account</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">Active</div>
                        <p className="text-xs text-muted-foreground">เชื่อมต่อปกติ</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">สินค้าทั้งหมด</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground">มีสินค้าใหม่ 2 รายการ</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-full">
                    <CardHeader>
                        <CardTitle>License ล่าสุดของคุณ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {[
                                { name: 'Gold Scalper Pro', type: 'รายเดือน', status: 'Active', expiry: '29 ก.พ. 2026' },
                                { name: 'Trend Hunter EA', type: 'ถาวร', status: 'Active', expiry: 'ตลอดชีพ' },
                                { name: 'Grid Master', type: 'รายเดือน', status: 'Expired', expiry: '15 ม.ค. 2026' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center">
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">{item.type}</p>
                                    </div>
                                    <div className="ml-auto font-medium text-sm">
                                        {item.status === 'Active' ? (
                                            <span className="text-green-500">ใช้งานได้</span>
                                        ) : (
                                            <span className="text-red-500">หมดอายุ</span>
                                        )}
                                    </div>
                                    <div className="ml-8 text-sm text-muted-foreground w-24 text-right">
                                        {item.expiry}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
