import Link from 'next/link';
import { Home, Key, Settings, CreditCard, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Sidebar() {
    return (
        <div className="w-64 h-full border-r border-border bg-card/50 backdrop-blur-sm hidden md:flex flex-col">
            <div className="p-6 border-b border-border/50">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                    Trader Hub
                </h2>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                <Link href="/dashboard">
                    <Button variant="ghost" className="w-full justify-start">
                        <Home className="mr-2 h-4 w-4" />
                        Overview
                    </Button>
                </Link>
                <Link href="/dashboard/licenses">
                    <Button variant="ghost" className="w-full justify-start">
                        <Key className="mr-2 h-4 w-4" />
                        My Licenses
                    </Button>
                </Link>
                <Link href="/dashboard/billing">
                    <Button variant="ghost" className="w-full justify-start">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Billing
                    </Button>
                </Link>
                <Link href="/dashboard/settings">
                    <Button variant="ghost" className="w-full justify-start">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Button>
                </Link>
            </nav>

            <div className="p-4 border-t border-border/50">
                <Button variant="outline" className="w-full justify-start text-red-400 hover:text-red-500 hover:bg-red-950/20 border-red-900/20">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
    );
}
