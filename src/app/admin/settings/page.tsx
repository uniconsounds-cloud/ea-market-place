'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Upload, QrCode, CreditCard } from 'lucide-react';
import Image from 'next/image';

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState<string | null>(null);

    // Form State
    const [bankName, setBankName] = useState('');
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [qrImageUrl, setQrImageUrl] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('payment_settings')
                .select('*')
                .limit(1)
                .single();

            if (data) {
                setSettingsId(data.id);
                setBankName(data.bank_name || '');
                setAccountName(data.account_name || '');
                setAccountNumber(data.account_number || '');
                setQrImageUrl(data.qr_image_url || '');
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `qr-code-${Date.now()}.${fileExt}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('payment_qr')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('payment_qr')
                .getPublicUrl(fileName);

            setQrImageUrl(publicUrl);
        } catch (error: any) {
            alert('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                bank_name: bankName,
                account_name: accountName,
                account_number: accountNumber,
                qr_image_url: qrImageUrl,
                updated_at: new Date().toISOString(),
            };

            if (settingsId) {
                const { error } = await supabase
                    .from('payment_settings')
                    .update(payload)
                    .eq('id', settingsId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('payment_settings')
                    .insert([payload]);
                if (error) throw error;
                // Re-fetch to get ID
                fetchSettings();
            }

            alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
        } catch (error: any) {
            alert('Error saving settings: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div>
                <h1 className="text-3xl font-bold">ตั้งค่าการชำระเงิน</h1>
                <p className="text-muted-foreground">จัดการข้อมูลบัญชีธนาคารและ QR Code สำหรับการโอนเงิน</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Bank Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            ข้อมูลบัญชีธนาคาร
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>ชื่อธนาคาร</Label>
                            <Input
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                placeholder="เช่น ธนาคารกสิกรไทย"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ชื่อบัญชี</Label>
                            <Input
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="ชื่อบริษัท หรือ เจ้าของบัญชี"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>เลขที่บัญชี</Label>
                            <Input
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                placeholder="xxx-x-xxxxx-x"
                                className="font-mono text-lg"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* QR Code Upload */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <QrCode className="h-5 w-5" />
                            QR Code รับเงิน
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 min-h-[200px]">
                            {qrImageUrl ? (
                                <div className="relative w-48 h-48">
                                    <img
                                        src={qrImageUrl}
                                        alt="QR Code"
                                        className="object-contain w-full h-full rounded-md"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                        onClick={() => setQrImageUrl('')}
                                    >
                                        ×
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <Icons.UploadCloud className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">อัปโหลดรูป QR Code จากแอปธนาคาร</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="qr-upload">เปลี่ยนรูป QR Code</Label>
                            <Input
                                id="qr-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploading}
                            />
                            {uploading && <p className="text-xs text-blue-500 animate-pulse">กำลังอัปโหลด...</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end">
                <Button size="lg" onClick={handleSave} disabled={saving}>
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" /> บันทึกการตั้งค่า
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

const Icons = {
    UploadCloud: ({ className }: { className?: string }) => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m16 16-4-4-4 4" />
        </svg>
    )
};
