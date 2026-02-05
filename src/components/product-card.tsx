import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_lifetime: number;
    image_url: string;
    features?: string[];
}

export function ProductCard({ product }: { product: Product }) {
    return (
        <div className="glass-card rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300 group flex flex-col h-full border-t border-white/5">
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
                    <div className="flex items-center justify-between border-t border-border/50 pt-4">
                        <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Monthly</span>
                            <span className="text-lg font-bold text-white">${product.price_monthly}</span>
                        </div>
                        <div className="h-8 w-[1px] bg-border/50" />
                        <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Lifetime</span>
                            <span className="text-lg font-bold text-accent gold-glow">${product.price_lifetime}</span>
                        </div>
                    </div>

                    <Link href={`/products/${product.id}`} className="block">
                        <Button className="w-full group" variant="default">
                            View Details
                            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
