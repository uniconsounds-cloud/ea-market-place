'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Upload, Loader2, Save } from 'lucide-react';
import Link from 'next/link';

// Use 'new' as a special ID for creating
export default function ProductFormPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string; // useParams returns string | string[]
    const isNew = id === 'new';

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        product_key: '', // Added product_key
        description: '',
        price_monthly: '',
        price_quarterly: '', // Added price_quarterly
        price_lifetime: '',
        image_url: '',
        file_url: '', // Renamed from video_url to file_url for clarity, though backend might use either
        version: '1.0',
        is_active: true
    });

    useEffect(() => {
        if (!isNew && id) {
            fetchProduct();
        }
    }, [id]);

    const fetchProduct = async () => {
        const { data } = await supabase.from('products').select('*').eq('id', id).single();
        if (data) {
            setFormData({
                name: data.name,
                product_key: data.product_key || '', // Fetch product_key
                description: data.description || '',
                price_monthly: data.price_monthly,
                price_quarterly: data.price_quarterly || '',
                price_lifetime: data.price_lifetime,
                image_url: data.image_url || '',
                file_url: data.file_url || '',
                version: data.version || '1.0',
                is_active: data.is_active
            });
        }
    };

    // ... (handleChange and handleImageUpload remain the same) ...

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0) {
                return;
            }
            setUploading(true);
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('products').getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
            alert('อัพโหลดรูปภาพสำเร็จ!');
        } catch (error: any) {
            alert('Error uploading image: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0) {
                return;
            }
            setUploading(true);
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            // Keep original filename but prepend random string to avoid collisions
            const fileName = `${Date.now()}_${file.name}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage.from('ea_files').upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('ea_files').getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, file_url: data.publicUrl }));
            alert('อัพโหลดไฟล์ EA สำเร็จ!');
        } catch (error: any) {
            alert('Error uploading file: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                name: formData.name,
                product_key: formData.product_key || null, // Create payload
                description: formData.description,
                price_monthly: parseFloat(formData.price_monthly),
                price_quarterly: formData.price_quarterly ? parseFloat(formData.price_quarterly) : null,
                price_lifetime: parseFloat(formData.price_lifetime),
                image_url: formData.image_url,
                file_url: formData.file_url,
                version: formData.version,
                is_active: formData.is_active
            };

            let error;
            if (isNew) {
                const { error: insertError } = await supabase.from('products').insert([payload]);
                error = insertError;
            } else {
                const { error: updateError } = await supabase.from('products').update(payload).eq('id', id);
                error = updateError;
            }

            if (error) throw error;

            alert('บันทึกข้อมูลสำเร็จ!');
            router.push('/admin/products');
            router.refresh();
        } catch (error: any) {
            alert('Error saving product: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Same Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/products">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold">
                    {isNew ? 'เพิ่มสินค้าใหม่' : 'แก้ไขสินค้า'}
                </h1>
            </div>

            <div className="bg-card p-8 rounded-xl border border-border">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Image Upload Block (Unchanged) */}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">รูปภาพสินค้า</label>
                        <div className="flex items-center gap-4">
                            {/* ... (Image preview content) ... */}
                            <div className="h-32 w-32 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border border-dashed border-gray-600">
                                {formData.image_url ? (
                                    <img src={formData.image_url} alt="Preview" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-xs text-muted-foreground">No Image</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <input
                                    type="file"
                                    accept="image/*"
                                    id="image-upload"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                />
                                <label htmlFor="image-upload">
                                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 cursor-pointer">
                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดรูปภาพ'}
                                    </div>
                                </label>
                                <p className="text-xs text-muted-foreground mt-2">
                                    รองรับไฟล์ JPG, PNG (แนะนำขนาด 1280x1280px หรือรูปแนวนอน)
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* File Upload Block */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">ไฟล์ EA (.ex4, .ex5, .zip)</label>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Input
                                        value={formData.file_url}
                                        readOnly
                                        placeholder="URL ของไฟล์ (อัพโหลดหรือใส่เอง)"
                                        className="bg-muted"
                                    />
                                </div>
                                <input
                                    type="file"
                                    accept=".ex4,.ex5,.zip,.rar"
                                    id="file-upload"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                                <label htmlFor="file-upload">
                                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer w-full">
                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดไฟล์ EA'}
                                    </div>
                                </label>
                                <p className="text-xs text-muted-foreground mt-2">
                                    อัพโหลดไฟล์ EA ที่ลูกค้าจะได้รับเมื่อชำระเงิน
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ชื่อ EA</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Ex. Gold Scalper Pro"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Product Key (สำหรับ EA)</label>
                            <Input
                                name="product_key"
                                value={formData.product_key}
                                onChange={handleChange}
                                placeholder="Ex. GOLD-EA-V1"
                                className="font-mono"
                            />
                            <p className="text-[10px] text-muted-foreground">ใช้ใส่ในโค้ด EA (ถ้าว่างไว้จะใช้ UUID)</p>
                        </div>
                    </div>



                    <div className="space-y-2">
                        <label className="text-sm font-medium">รายละเอียด</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="รายละเอียดของระบบ..."
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ราคา (รายเดือน) ฿</label>
                            <Input
                                type="number"
                                name="price_monthly"
                                value={formData.price_monthly}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ราคา (3 เดือน) ฿</label>
                            <Input
                                type="number"
                                name="price_quarterly"
                                value={formData.price_quarterly}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ราคา (ถาวร) ฿</label>
                            <Input
                                type="number"
                                name="price_lifetime"
                                value={formData.price_lifetime}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Version</label>
                            <Input
                                name="version"
                                value={formData.version}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">สถานะ</label>
                            <div className="flex items-center gap-2 h-10">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                                    className="h-5 w-5"
                                />
                                <span className="text-sm">เปิดขาย</span>
                            </div>
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading || uploading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        บันทึกข้อมูล
                    </Button>
                </form>
            </div >
        </div >
    );
}
