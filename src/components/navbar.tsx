'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Receipt, User, LogOut, LayoutDashboard, ShieldCheck, Menu } from 'lucide-react';
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"

export function Navbar() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isIbRole, setIsIbRole] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Consolidated function to fetch user and role
        const fetchUserData = async (sessionUser: any) => {
            if (sessionUser) {
                setUser(sessionUser);
                const { data: profile } = await supabase.from('profiles').select('role, ib_account_number').eq('id', sessionUser.id).single();
                setIsAdmin(profile?.role === 'admin');

                // Check if they are an active IB (either legacy property or active membership)
                let ibStatus = !!profile?.ib_account_number;
                if (!ibStatus) {
                    const { count } = await supabase.from('ib_memberships')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', sessionUser.id)
                        .eq('status', 'approved');
                    ibStatus = (count ?? 0) > 0;
                }
                setIsIbRole(ibStatus);
            } else {
                setUser(null);
                setIsAdmin(false);
                setIsIbRole(false);
            }
            setLoading(false);
        };

        // Check initial session
        const initSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            fetchUserData(session?.user ?? null);
        };
        initSession();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                setUser(null);
                setIsAdmin(false);
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                fetchUserData(session?.user ?? null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        // 1. Immediate UI update
        setUser(null);
        setIsAdmin(false);
        setIsIbRole(false);

        // 2. Perform actua logout
        await supabase.auth.signOut();

        // 3. Redirect and refresh
        router.replace('/');
        router.refresh();
    };

    return (
        <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <Image
                        src="/logo.png"
                        alt="EAEZE Logo"
                        width={120}
                        height={120}
                        className="h-10 w-auto object-contain"
                        priority
                    />
                    <Link href="/" className="text-xl font-bold tracking-tight whitespace-nowrap hidden sm:block">
                        EA Easy Shop
                    </Link>
                </div>

                <div className="hidden md:flex gap-6 items-center text-sm font-medium text-muted-foreground mr-auto ml-10">
                    <Link href="/" className="hover:text-foreground transition-colors">ร้านค้า</Link>
                    <Link href="/dashboard" className="hover:text-foreground transition-colors">แดชบอร์ด</Link>
                    <Link href="#" className="hover:text-foreground transition-colors">ช่วยเหลือ</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Link href="/dashboard/billing">
                        <Button variant="ghost" size="icon" title="ประวัติการสั่งซื้อ">
                            <Receipt className="h-5 w-5" />
                        </Button>
                    </Link>

                    {loading ? (
                        <div className="h-10 w-20 bg-muted/20 animate-pulse rounded-md"></div>
                    ) : user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 relative">
                                    <User className="h-5 w-5" />
                                    {isIbRole && (
                                        <span className="absolute -top-1 -right-1 bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md border border-background">
                                            IB
                                        </span>
                                    )}
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
                                <Button variant="gold" className="whitespace-nowrap">สมัครสมาชิก</Button>
                            </Link>
                        </>
                    )}

                    {/* Mobile Menu */}
                    <div className="md:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-6 w-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[280px] bg-background/95 backdrop-blur">
                                <SheetHeader className="text-left pb-6 border-b border-border/50">
                                    <SheetTitle className="text-xl font-bold tracking-tight">เมนู</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 py-8">
                                    <Link href="/" className="text-lg font-medium px-4 py-2 rounded-lg hover:bg-secondary transition-colors">ร้านค้า</Link>
                                    <Link href="/dashboard" className="text-lg font-medium px-4 py-2 rounded-lg hover:bg-secondary transition-colors">แดชบอร์ด</Link>
                                    <Link href="#" className="text-lg font-medium px-4 py-2 rounded-lg hover:bg-secondary transition-colors">ช่วยเหลือ</Link>
                                    <div className="pt-4 mt-4 border-t border-border/50 flex flex-col gap-3">
                                        {!user ? (
                                            <>
                                                <Link href="/login" className="w-full">
                                                    <Button variant="outline" className="w-full justify-start py-6 text-base">เข้าสู่ระบบ</Button>
                                                </Link>
                                                <Link href="/register" className="w-full">
                                                    <Button variant="gold" className="w-full justify-start py-6 text-base">สมัครสมาชิก</Button>
                                                </Link>
                                            </>
                                        ) : (
                                            <Button variant="outline" onClick={handleLogout} className="w-full justify-start py-6 text-base text-red-500 hover:text-red-600">
                                                <LogOut className="mr-2 h-5 w-5" /> ออกจากระบบ
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </nav>
    );
}
