'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        const { data } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setProducts(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ยืนยันที่จะลบสินค้านี้?')) return;

        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) {
            fetchProducts();
        } else {
            alert('ลบไม่สำเร็จ: ' + error.message);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">จัดการสินค้า</h1>
                    <p className="text-muted-foreground">รายการ EA ทั้งหมด ({products.length})</p>
                </div>
                <Link href="/admin/products/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> เพิ่มสินค้าใหม่
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div>กำลังโหลด...</div>
            ) : (
                <div className="grid gap-4">
                    {products.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                            <CardContent className="p-0 flex items-center justify-between">
                                <div className="flex items-center gap-4 p-4">
                                    <div className="h-16 w-16 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-gray-500">No Image</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{product.name}</h3>
                                        <div className="text-sm text-muted-foreground flex gap-4">
                                            <span>รายเดือน: ฿{product.price_monthly}</span>
                                            <span>ถาวร: ฿{product.price_lifetime}</span>
                                            <span className={product.is_active ? 'text-green-500' : 'text-red-500'}>
                                                {product.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-4">
                                    <Link href={`/admin/products/${product.id}`}>
                                        <Button variant="outline" size="icon">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(product.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {products.length === 0 && (
                        <div className="text-center py-12 border rounded-lg bg-card/50">
                            <p className="text-muted-foreground">ยังไม่มีสินค้าในระบบ</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
