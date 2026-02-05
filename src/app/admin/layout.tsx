'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { LayoutDashboard, Package, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (error || profile?.role !== 'admin') {
                alert('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (Admin Only), Your role: ' + (profile?.role || 'unknown'));
                router.push('/');
                return;
            }

            setIsAdmin(true);
            setLoading(false);
        };

        checkAdmin();
    }, [router]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className="flex min-h-screen bg-background">
            {/* Admin Sidebar */}
            <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col fixed h-full">
                <div className="h-16 flex items-center px-6 border-b border-border">
                    <Link href="/admin" className="font-bold text-xl flex items-center gap-2">
                        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">ADMIN</span>
                        Panel
                    </Link>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Link href="/admin">
                        <Button variant="ghost" className="w-full justify-start">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            ภาพรวม
                        </Button>
                    </Link>
                    <Link href="/admin/products">
                        <Button variant="ghost" className="w-full justify-start">
                            <Package className="mr-2 h-4 w-4" />
                            จัดการสินค้า
                        </Button>
                    </Link>
                </nav>
                <div className="p-4 border-t border-border">
                    <Link href="/">
                        <Button variant="outline" className="w-full">
                            <LogOut className="mr-2 h-4 w-4" /> กลับหน้าร้านค้า
                        </Button>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 md:ml-64 p-8">
                {children}
            </div>
        </div>
    );
}
