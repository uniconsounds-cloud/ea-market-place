import { Button } from '@/components/ui/button';
import { MOCK_PRODUCTS } from '@/lib/data';
import Link from 'next/link';

export default function Dashboard() {
    // Mock User Data
    const stats = {
        activeLicenses: 2,
        totalSpent: 450,
        nextBilling: 'Feb 28, 2026'
    };

    const myLicenses = [
        {
            id: 'lic_1',
            product: MOCK_PRODUCTS[0],
            account: '88192301',
            status: 'active',
            type: 'lifetime'
        },
        {
            id: 'lic_2',
            product: MOCK_PRODUCTS[1],
            account: 'PENDING',
            status: 'pending_setup',
            type: 'monthly'
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Manage your EAs and trading accounts</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="p-6 rounded-xl bg-card border border-border">
                    <h3 className="text-sm font-medium text-muted-foreground">Active Licenses</h3>
                    <div className="text-2xl font-bold mt-2">{stats.activeLicenses}</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border">
                    <h3 className="text-sm font-medium text-muted-foreground">Total Invested</h3>
                    <div className="text-2xl font-bold mt-2 text-primary">${stats.totalSpent}</div>
                </div>
                <div className="p-6 rounded-xl bg-card border border-border">
                    <h3 className="text-sm font-medium text-muted-foreground">Next Billing</h3>
                    <div className="text-2xl font-bold mt-2">{stats.nextBilling}</div>
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Recent Licenses</h2>
                    <Link href="/dashboard/licenses">
                        <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                </div>

                <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Product</th>
                                <th className="px-6 py-3">Account #</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {myLicenses.map((lic) => (
                                <tr key={lic.id} className="hover:bg-muted/10 transition-colors">
                                    <td className="px-6 py-4 font-medium">{lic.product.name}</td>
                                    <td className="px-6 py-4 font-mono">{lic.account}</td>
                                    <td className="px-6 py-4 capitalize">{lic.type}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${lic.status === 'active'
                                                ? 'bg-green-500/10 text-green-500'
                                                : 'bg-yellow-500/10 text-yellow-500'
                                            }`}>
                                            {lic.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Button size="sm" variant="outline">Manage</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
