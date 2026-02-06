'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { LayoutDashboard, Package, LogOut, Loader2, FileText, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

// Sidebar Component extracted to avoid re-creation on every render
const SidebarContent = ({
    mobile = false,
    onClose
}: {
    mobile?: boolean;
    onClose?: () => void;
}) => (
    <div className="flex flex-col h-full bg-card">
        <div className="h-16 flex items-center px-6 border-b border-border">
            <Link href="/admin" className="font-bold text-xl flex items-center gap-2" onClick={onClose}>
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">ADMIN</span>
                Panel
            </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
            <Link href="/admin" onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    ภาพรวม
                </Button>
            </Link>

            <Link href="/admin/products" onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start">
                    <Package className="mr-2 h-4 w-4" />
                    จัดการสินค้า
                </Button>
            </Link>
            <Link href="/admin/orders" onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    รายการสั่งซื้อ
                </Button>
            </Link>
        </nav>
        <div className="p-4 border-t border-border">
            <Link href="/" onClick={onClose}>
                <Button variant="outline" className="w-full">
                    <LogOut className="mr-2 h-4 w-4" /> กลับหน้าร้านค้า
                </Button>
            </Link>
        </div>
    </div>
);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
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
            {/* Desktop Sidebar */}
            <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col fixed h-full z-50">
                <SidebarContent />
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-card flex items-center px-4 z-50 justify-between">
                <div className="font-bold text-lg flex items-center gap-2">
                    <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded">ADMIN</span>
                    Panel
                </div>
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64">
                        <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
                        <SidebarContent mobile onClose={() => setIsSheetOpen(false)} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Main Content */}
            <div className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 w-full">
                {children}
            </div>
        </div >
    );
}
