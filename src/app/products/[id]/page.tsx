import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Check, ShieldCheck, Zap } from 'lucide-react';
import { MOCK_PRODUCTS } from '@/lib/data';

export default function ProductPage({ params }: { params: { id: string } }) {
    const product = MOCK_PRODUCTS.find((p) => p.id === params.id);

    if (!product) {
        notFound();
    }

    return (
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />

            <div className="flex-1 container mx-auto px-4 py-12">
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block">
                    &larr; Back to Marketplace
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Left: Image/Visual */}
                    <div className="space-y-6">
                        <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl border border-border/50 flex items-center justify-center relative overflow-hidden shadow-2xl">
                            <div className="text-6xl font-bold text-white/10">{product.name.substring(0, 2)}</div>
                            {/* If specific image exists */}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                        </div>

                        <div className="bg-card p-6 rounded-xl border border-border/50">
                            <h3 className="font-semibold mb-4 flex items-center">
                                <ShieldCheck className="w-5 h-5 mr-2 text-primary" />
                                Verification Guarantee
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                This EA has been verified on live accounts for over 6 months.
                                Includes 24/7 support and free updates.
                            </p>
                        </div>
                    </div>

                    {/* Right: Info & Purchase */}
                    <div>
                        <div className="mb-6">
                            <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full">v{product.version}</span>
                                <span className="text-muted-foreground">Updated recently</span>
                            </div>
                        </div>

                        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                            {product.description}
                        </p>

                        <div className="mb-8">
                            <h3 className="font-semibold mb-3">Key Features</h3>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {product.features?.map((feature, i) => (
                                    <li key={i} className="flex items-center text-sm">
                                        <Check className="w-4 h-4 mr-2 text-accent" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="p-6 rounded-xl bg-gradient-to-br from-card to-background border border-border shadow-lg">
                            <h3 className="text-lg font-bold mb-4">Choose License</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                {/* Monthly Option */}
                                <div className="relative border border-border rounded-lg p-4 hover:border-primary/50 cursor-pointer transition-colors bg-background/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold">Monthly</span>
                                        <Zap className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div className="text-2xl font-bold">${product.price_monthly}</div>
                                    <p className="text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
                                </div>

                                {/* Lifetime Option */}
                                <div className="relative border-2 border-accent/50 rounded-lg p-4 bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors">
                                    <div className="absolute -top-3 right-4 bg-accent text-black text-xs font-bold px-2 py-0.5 rounded-full">
                                        BEST VALUE
                                    </div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-accent">Lifetime</span>
                                        <Zap className="w-4 h-4 text-accent" />
                                    </div>
                                    <div className="text-2xl font-bold text-accent gold-glow">${product.price_lifetime}</div>
                                    <p className="text-xs text-muted-foreground">One-time payment. Forever access.</p>
                                </div>
                            </div>

                            <Button size="lg" className="w-full text-base font-semibold shadow-xl shadow-blue-900/20">
                                Buy License Now
                            </Button>
                            <p className="text-center text-xs text-muted-foreground mt-3">
                                Secure payment via Stripe / QR Code. Instant delivery.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}

// Generate static params for these mock products to avoid 404 on static export if needed
export function generateStaticParams() {
    return MOCK_PRODUCTS.map((p) => ({
        id: p.id,
    }));
}
