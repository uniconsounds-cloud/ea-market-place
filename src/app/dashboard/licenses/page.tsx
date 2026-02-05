'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Laptop, AlertCircle, Save, Loader2 } from 'lucide-react';

export default function LicensesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [licenses, setLicenses] = useState<any[]>([]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        fetchLicenses();
    }, []);

    const fetchLicenses = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.replace('/login');
            return;
        }

        const { data } = await supabase
            .from('licenses')
            .select(`
                *,
                products (
                    name
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) setLicenses(data);
        setLoading(false);
    };

    const handleUpdateAccount = async (id: string, newAccount: string) => {
        setUpdatingId(id);
        const { error } = await supabase
            .from('licenses')
            .update({
                account_number: newAccount,
                // If account number is set, ensure status matches validity logic (simplified here)
                // In real app, might need more check. For now, just update the field.
            })
            .eq('id', id);

        if (error) {
            alert('บันทึกไม่สำเร็จ: ' + error.message);
        } else {
            // Optimistic update or refetch
            setLicenses(prev => prev.map(l => l.id === id ? { ...l, account_number: newAccount } : l));
            alert(`บันทึกเลขพอร์ต ${newAccount} เรียบร้อยแล้ว`);
        }
        setUpdatingId(null);
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">จัดการ License</h1>
                <p className="text-muted-foreground">ดูรายการ EA ที่คุณซื้อและผูกเลขบัญชี MT4/MT5</p>
            </div>

            <div className="grid gap-6">
                {licenses.length > 0 ? (
                    licenses.map((license) => (
                        <div key={license.id} className="p-6 rounded-xl bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary">
                                    <Laptop className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{license.products?.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${license.type === 'lifetime' ? 'bg-gold/10 text-gold' : 'bg-blue-500/10 text-blue-500'}`}>
                                            {license.type === 'lifetime' ? 'ถาวร' : 'รายเดือน'}
                                        </span>
                                        <span>• หมดอายุ: {license.type === 'lifetime' ? 'ตลอดชีพ' : new Date(license.expiry_date).toLocaleDateString('th-TH')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full md:w-auto flex flex-col gap-2">
                                <label className="text-xs font-medium text-muted-foreground">เลขบัญชีเทรด (MT4/MT5 ID)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        defaultValue={license.account_number}
                                        placeholder="ระบุเลขพอร์ต..."
                                        className="bg-background border border-input rounded-md px-3 py-2 text-sm w-full md:w-48 focus:outline-none focus:ring-2 focus:ring-primary"
                                        onBlur={(e) => handleUpdateAccount(license.id, e.target.value)}
                                        disabled={updatingId === license.id}
                                    />
                                    <Button size="sm" variant="outline" className="shrink-0" disabled={updatingId === license.id}>
                                        {updatingId === license.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                        บันทึก
                                    </Button>
                                </div>
                                {!license.account_number && (
                                    <div className="text-xs text-amber-500 flex items-center mt-1">
                                        <AlertCircle className="w-3 h-3 mr-1" /> กรุณาระบุเลขพอร์ตเพื่อใช้งาน
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 border rounded-lg bg-card/50">
                        <p className="text-muted-foreground">คุณยังไม่มี License สินค้า</p>
                    </div>
                )}
            </div>

            <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-900/50 text-sm text-blue-200">
                <strong>คำแนะนำ:</strong> คุณสามารถเปลี่ยนเลขบัญชี MT4/MT5 ได้ตลอดเวลา ระบบจะทำการอัปเดตสิทธิ์โดยทันที (ใช้เวลาไม่เกิน 5 นาที)
            </div>
        </div>
    );
}
