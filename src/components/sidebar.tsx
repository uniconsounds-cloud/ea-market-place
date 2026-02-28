'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Key, CreditCard, Settings, LogOut, LayoutDashboard, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const sidebarItems = [
    { href: '/dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
    // { href: '/dashboard/licenses', label: 'License ของฉัน', icon: Key }, // Removed as per request
    { href: '/dashboard/billing', label: 'การชำระเงิน', icon: CreditCard },
    { href: '/dashboard/affiliate', label: 'แนะนำเพื่อน (Affiliate)', icon: Users },
    { href: '/dashboard/settings', label: 'ตั้งค่าบัญชี', icon: Settings },
];

export function SidebarContent({
    mobile = false,
    onClose
}: {
    mobile?: boolean;
    onClose?: () => void;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
        if (onClose) onClose();
    };

    return (
        <div className="flex flex-col h-full bg-card">
            <div className="h-16 flex items-center px-6 border-b border-border">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl" onClick={onClose}>
                    <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-blue-400 rounded-md flex items-center justify-center text-xs text-white">
                        EZE
                    </div>
                    EA Easy Shop
                </Link>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link key={item.href} href={item.href} onClick={onClose}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 mb-1",
                                    isActive && "bg-accent/10 text-accent hover:bg-accent/15 hover:text-accent"
                                )}
                            >
                                <Icon className={cn("h-4 w-4", isActive ? "text-accent" : "text-muted-foreground")} />
                                {item.label}
                            </Button>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border space-y-2">
                <Link href="/" onClick={onClose}>
                    <Button variant="outline" className="w-full justify-start gap-3">
                        <Home className="h-4 w-4" />
                        กลับหน้าหลัก
                    </Button>
                </Link>
                <Button variant="ghost" className="w-full justify-start gap-3 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    ออกจากระบบ
                </Button>
            </div>
        </div>
    );
}

export function Sidebar() {
    return (
        <aside className="w-64 border-r border-border bg-card h-screen sticky top-0 hidden md:flex flex-col">
            <SidebarContent />
        </aside>
    );
}
