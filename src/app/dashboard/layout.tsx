'use client';

import { Navbar } from '@/components/navbar';
import { Sidebar, SidebarContent } from '@/components/sidebar';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Menu, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar />

            {/* Mobile Sub-Header */}
            <div className="md:hidden border-b border-border bg-card px-4 py-2 flex items-center gap-2">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Menu className="h-4 w-4" />
                            เมนูแดชบอร์ด
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64">
                        <SheetTitle className="sr-only">Dashboard Navigation</SheetTitle>
                        <SidebarContent mobile onClose={() => setIsSheetOpen(false)} />
                    </SheetContent>
                </Sheet>
                <div className="text-sm font-medium text-muted-foreground ml-auto flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
