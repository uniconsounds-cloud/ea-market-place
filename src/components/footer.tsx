import Link from 'next/link';

export function Footer() {
    return (
        <footer className="border-t border-border bg-card">
            <div className="container mx-auto px-4 py-8 md:py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold">EA Market</h3>
                        <p className="text-sm text-muted-foreground">
                            Premium Expert Advisors for professional traders.
                            Automate your trading with our verified algorithms.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-3">Products</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/" className="hover:text-foreground">Gold Scalper</Link></li>
                            <li><Link href="/" className="hover:text-foreground">Trend Hunter</Link></li>
                            <li><Link href="/" className="hover:text-foreground">Grid Master</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-3">Support</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-foreground">Documentation</Link></li>
                            <li><Link href="#" className="hover:text-foreground">Installation Guide</Link></li>
                            <li><Link href="#" className="hover:text-foreground">Contact Us</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-3">Legal</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-foreground">Terms of Service</Link></li>
                            <li><Link href="#" className="hover:text-foreground">Privacy Policy</Link></li>
                            <li><Link href="#" className="hover:text-foreground">Risk Warning</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} EA Market. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
