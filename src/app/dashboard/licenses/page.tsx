'use client';

import { Button } from '@/components/ui/button';
import { MOCK_PRODUCTS } from '@/lib/data';
import { useState } from 'react';

export default function LicensesPage() {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [accountInput, setAccountInput] = useState('');

    // Mock Licenses State
    const [licenses, setLicenses] = useState([
        {
            id: 'lic_1',
            product: MOCK_PRODUCTS[0],
            account: '88192301',
            status: 'active',
            type: 'lifetime',
            expiry: 'Lifetime'
        },
        {
            id: 'lic_2',
            product: MOCK_PRODUCTS[1],
            account: '',
            status: 'pending_setup',
            type: 'monthly',
            expiry: '2026-03-28'
        }
    ]);

    const handleUpdateAccount = (id: string) => {
        // Here we would call API/Supabase to update account_number
        console.log('Update license', id, 'to account', accountInput);

        // Optimistic UI update
        setLicenses(licenses.map(l => l.id === id ? { ...l, account: accountInput, status: 'active' } : l));
        setEditingId(null);
        setAccountInput('');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">My Licenses</h1>
                <p className="text-muted-foreground">Manage your trading accounts and subscriptions</p>
            </div>

            <div className="grid gap-6">
                {licenses.map((lic) => (
                    <div key={lic.id} className="p-6 rounded-xl bg-glass-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-lg">
                                {lic.product.name.substring(0, 2)}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{lic.product.name}</h3>
                                <div className="flex gap-2 text-sm text-muted-foreground">
                                    <span>{lic.type === 'lifetime' ? 'Lifetime License' : 'Monthly Subscription'}</span>
                                    <span>•</span>
                                    <span>Expires: {lic.expiry}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-2">
                            <div className="text-sm font-medium">Trading Account</div>

                            {editingId === lic.id ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        className="bg-background border border-input rounded-md px-3 py-1 text-sm w-32"
                                        placeholder="Account #"
                                        value={accountInput}
                                        onChange={(e) => setAccountInput(e.target.value)}
                                    />
                                    <Button size="sm" onClick={() => handleUpdateAccount(lic.id)}>Save</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="font-mono bg-muted/50 px-3 py-1 rounded text-sm">
                                        {lic.account || 'Not Set'}
                                    </span>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        setEditingId(lic.id);
                                        setAccountInput(lic.account);
                                    }}>
                                        Change
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
