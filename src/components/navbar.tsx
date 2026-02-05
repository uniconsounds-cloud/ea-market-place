import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

export function Navbar() {
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
                    <Link href="/" className="hover:text-foreground transition-colors">Marketplace</Link>
                    <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
                    <Link href="#" className="hover:text-foreground transition-colors">Support</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon">
                        <ShoppingCart className="h-5 w-5" />
                    </Button>
                    <Link href="/login">
                        <Button variant="outline" className="hidden sm:inline-flex">Sign In</Button>
                    </Link>
                    <Link href="/register">
                        <Button variant="gold">Get Started</Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
