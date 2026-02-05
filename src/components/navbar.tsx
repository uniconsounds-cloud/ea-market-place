'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShoppingCart, User, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Navbar() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                setIsAdmin(profile?.role === 'admin');
            }
        };
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
                setIsAdmin(profile?.role === 'admin');
            } else {
                setIsAdmin(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        router.push('/');
        router.refresh(); // Refresh to ensure server components update if needed
    };

    return (
        <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-blue-400 rounded-md flex items-center justify-center font-bold text-white">
                        EA
                    </div>
                    <Link href="/" className="text-xl font-bold tracking-tight">
                        EA Market
                    </Link>
                </div>

                <div className="hidden md:flex gap-6 items-center text-sm font-medium text-muted-foreground">
                    <Link href="/" className="hover:text-foreground transition-colors">ร้านค้า</Link>
                    <Link href="/dashboard" className="hover:text-foreground transition-colors">แดชบอร์ด</Link>
                    <Link href="#" className="hover:text-foreground transition-colors">ช่วยเหลือ</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon">
                        <ShoppingCart className="h-5 w-5" />
                    </Button>

                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50">
                                    <User className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>บัญชีผู้ใช้</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" /> แดชบอร์ด
                                </DropdownMenuItem>
                                {isAdmin && (
                                    <DropdownMenuItem onClick={() => router.push('/admin')}>
                                        <ShieldCheck className="mr-2 h-4 w-4 text-red-500" /> <span className="text-red-500 font-bold">Admin Panel</span>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-500">
                                    <LogOut className="mr-2 h-4 w-4" /> ออกจากระบบ
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <>
                            <Link href="/login">
                                <Button variant="outline" className="hidden sm:inline-flex">เข้าสู่ระบบ</Button>
                            </Link>
                            <Link href="/register">
                                <Button variant="gold">สมัครสมาชิก</Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
