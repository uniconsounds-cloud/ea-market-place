'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Assuming you have an Input component, otherwise use standard input
import { Laptop, AlertCircle, Save } from 'lucide-react';

const MOCK_LICENSES = [
    { id: 1, product: 'Gold Scalper Pro', type: 'Monthly', account: '88123456', expiry: '2026-02-28', status: 'active' },
    { id: 2, product: 'Trend Hunter EA', type: 'Lifetime', account: '', expiry: 'Lifetime', status: 'inactive' },
];

export default function LicensesPage() {
    const [licenses, setLicenses] = useState(MOCK_LICENSES);

    const handleUpdateAccount = (id: number, newAccount: string) => {
        setLicenses(licenses.map(l => l.id === id ? { ...l, account: newAccount, status: newAccount ? 'active' : 'inactive' } : l));
        alert(`บันทึกเลขพอร์ต ${newAccount} เรียบร้อยแล้ว`);
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">จัดการ License</h1>
                <p className="text-muted-foreground">ดูรายการ EA ที่คุณซื้อและผูกเลขบัญชี MT4/MT5</p>
            </div>

            <div className="grid gap-6">
                {licenses.map((license) => (
                    <div key={license.id} className="p-6 rounded-xl bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary">
                                <Laptop className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{license.product}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${license.type === 'Lifetime' ? 'bg-gold/10 text-gold' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {license.type === 'Lifetime' ? 'ถาวร' : 'รายเดือน'}
                                    </span>
                                    <span>• หมดอายุ: {license.expiry === 'Lifetime' ? 'ไม่มีวันหมดอายุ' : new Date(license.expiry).toLocaleDateString('th-TH')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-auto flex flex-col gap-2">
                            <label className="text-xs font-medium text-muted-foreground">เลขบัญชีเทรด (MT4/MT5 ID)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    defaultValue={license.account}
                                    placeholder="ระบุเลขพอร์ต..."
                                    className="bg-background border border-input rounded-md px-3 py-2 text-sm w-full md:w-48 focus:outline-none focus:ring-2 focus:ring-primary"
                                    onBlur={(e) => handleUpdateAccount(license.id, e.target.value)}
                                />
                                <Button size="sm" variant="outline" className="shrink-0">
                                    <Save className="w-4 h-4 mr-1" /> บันทึก
                                </Button>
                            </div>
                            {!license.account && (
                                <div className="text-xs text-amber-500 flex items-center mt-1">
                                    <AlertCircle className="w-3 h-3 mr-1" /> กรุณาระบุเลขพอร์ตเพื่อใช้งาน
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-900/50 text-sm text-blue-200">
                <strong>คำแนะนำ:</strong> คุณสามารถเปลี่ยนเลขบัญชี MT4/MT5 ได้ตลอดเวลา ระบบจะทำการอัปเดตสิทธิ์โดยทันที (ใช้เวลาไม่เกิน 5 นาที)
            </div>
        </div>
    );
}
