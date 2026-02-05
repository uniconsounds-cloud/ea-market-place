import { Button } from '@/components/ui/button';
import { CreditCard, QrCode } from 'lucide-react';

export default function BillingPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">การชำระเงิน</h1>
                <p className="text-muted-foreground">จัดการวิธีการชำระเงินและดูประวัติการสั่งซื้อ</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                    <div className="p-6 rounded-xl bg-card border border-border">
                        <h2 className="text-xl font-bold mb-4">ช่องทางชำระเงิน</h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <QrCode className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">สแกนจ่าย Thai QR</div>
                                        <div className="text-xs text-muted-foreground">PromptPay</div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">เริ่มต้น</Button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">บัตรเครดิต / เดบิต</div>
                                        <div className="text-xs text-muted-foreground">Visa, Mastercard</div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm">จัดการ</Button>
                            </div>
                        </div>

                        <Button className="w-full mt-6" variant="default">เพิ่มวิธีการชำระเงิน</Button>
                    </div>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border">
                    <h2 className="text-xl font-bold mb-4">ประวัติการชำระเงิน</h2>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex justify-between items-center py-3 border-b border-border/50 last:border-0">
                                <div>
                                    <div className="font-medium">Gold Scalper Pro (รายเดือน)</div>
                                    <div className="text-xs text-muted-foreground">{29 - i} มกราคม 2569</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">฿990.00</div>
                                    <div className="text-xs text-green-500">ชำระแล้ว</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
