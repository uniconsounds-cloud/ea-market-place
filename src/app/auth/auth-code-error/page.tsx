'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const errorDescription = searchParams.get('error_description') || searchParams.get('error') || 'ลิงก์การยืนยันตัวตนหมดอายุหรือไม่ถูกต้อง';

    return (
        <div className="glass-card w-full max-w-md p-8 rounded-xl border border-border text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-bold mb-2">ลิงก์หมดอายุหรือไม่ถูกต้อง</h1>
            <p className="text-muted-foreground text-sm mb-6">
                ลิงก์สำหรับยืนยันตัวตนหรือตั้งรหัสผ่านใหม่นี้หมดอายุ หรือถูกใช้งานไปแล้ว กรุณากดขอลิงก์ใหม่อีกครั้ง
            </p>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-500 mb-6 font-mono break-all text-left">
                {errorDescription}
            </div>

            <div className="space-y-3">
                <Link href="/forgot-password" className="block w-full">
                    <Button className="w-full">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        ขอลิงก์ตั้งรหัสผ่านใหม่
                    </Button>
                </Link>

                <Link href="/login" className="block w-full">
                    <Button variant="outline" className="w-full">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        กลับไปหน้าเข้าสู่ระบบ
                    </Button>
                </Link>
            </div>
        </div>
    );
}

export default function AuthCodeErrorPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-4">
                <Suspense fallback={
                    <div className="glass-card w-full max-w-md p-8 rounded-xl border border-border text-center">
                        <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
                    </div>
                }>
                    <AuthErrorContent />
                </Suspense>
            </div>
            <Footer />
        </div>
    );
}
