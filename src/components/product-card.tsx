'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Product {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_quarterly?: number;
    price_lifetime: number;
    image_url: string;
    features?: string[];
}

interface PortStatus {
    port: string;
    status: 'active' | 'pending' | 'rejected';
}

export function ProductCard({ product }: { product: Product }) {
    const [portStatuses, setPortStatuses] = useState<PortStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setLoading(false);
                    return;
                }

                // Fetch Active Licenses
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('account_number')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('is_active', true);

                // Fetch Pending Orders
                const { data: orders } = await supabase
                    .from('orders')
                    .select('account_number, status')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('status', 'pending');

                const statuses: PortStatus[] = [];

                licenses?.forEach((l: any) => {
                    if (l.account_number) {
                        statuses.push({ port: l.account_number, status: 'active' });
                    }
                });

                orders?.forEach((o: any) => {
                    if (o.account_number) {
                        // Avoid duplicates if license already exists (though duplicate-check logic prevents this mostly)
                        const exists = statuses.some(s => s.port === o.account_number && s.status === 'active');
                        if (!exists) {
                            statuses.push({ port: o.account_number, status: 'pending' });
                        }
                    }
                });

                setPortStatuses(statuses);

            } catch (error) {
                console.error("Error fetching status:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [product.id]);

    return (
        <div className="glass-card rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300 group flex flex-col h-full border-t border-white/5 relative">

            <div className="relative h-48 w-full overflow-hidden bg-gray-900">
                {/* Placeholder for Image - in real app use Next/Image */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-black text-white/20 text-4xl font-bold">
                    {product.name.substring(0, 2)}
                </div>
                {product.image_url && (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Status Badges Overlay */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                    {portStatuses.map((item, idx) => (
                        <div key={idx} className={`
                            flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono font-bold shadow-lg backdrop-blur-md border uppercase tracking-wider
                            ${item.status === 'active' ? 'bg-green-500/20 border-green-500/50 text-green-400' : ''}
                            ${item.status === 'pending' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : ''}
                        `}>
                            {item.status === 'active' && <CheckCircle2 className="w-3 h-3" />}
                            {item.status === 'pending' && <Loader2 className="w-3 h-3 animate-spin" />}
                            Port: {item.port}
                        </div>
                    ))}
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{product.name}</h3>
                </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2 h-10">
                    {product.description}
                </p>

                <div className="space-y-2 mb-6 flex-1">
                    {product.features?.slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-center text-xs text-gray-400">
                            <Check className="h-3 w-3 mr-2 text-accent" />
                            {feature}
                        </div>
                    ))}
                </div>

                <div className="mt-auto space-y-4">
                    {product.price_quarterly ? (
                        <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-4 text-center">
                            <div>
                                <span className="text-[10px] text-muted-foreground block">รายเดือน</span>
                                <span className="text-sm font-bold text-white">฿{product.price_monthly.toLocaleString()}</span>
                            </div>
                            <div className="border-l border-border/50 pl-2">
                                <span className="text-[10px] text-muted-foreground block">3 เดือน</span>
                                <span className="text-sm font-bold text-white">฿{product.price_quarterly.toLocaleString()}</span>
                            </div>
                            <div className="border-l border-border/50 pl-2">
                                <span className="text-[10px] text-muted-foreground block">ถาวร</span>
                                <span className="text-sm font-bold text-accent gold-glow">฿{product.price_lifetime.toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between border-t border-border/50 pt-4">
                            <div className="text-center">
                                <span className="text-xs text-muted-foreground block">รายเดือน</span>
                                <span className="text-lg font-bold text-white">฿{product.price_monthly.toLocaleString()}</span>
                            </div>
                            <div className="h-8 w-[1px] bg-border/50" />
                            <div className="text-center">
                                <span className="text-xs text-muted-foreground block">ถาวร (Lifetime)</span>
                                <span className="text-lg font-bold text-accent gold-glow">฿{product.price_lifetime.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <Link href={`/products/${product.id}`} className="block">
                        <Button className="w-full group" variant="default">
                            ดูรายละเอียด
                            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
