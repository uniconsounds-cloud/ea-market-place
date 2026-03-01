'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, ArrowUpDown, Edit, Calendar, User, Package, Key } from 'lucide-react';

export default function AdminLicensesClient({ initialLicenses }: { initialLicenses: any[] }) {
    const [licenses, setLicenses] = useState(initialLicenses);

    // Filtering States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterEaName, setFilterEaName] = useState('all');
    const [filterEaGroup, setFilterEaGroup] = useState('all');
    const [filterPlan, setFilterPlan] = useState('all');

    // Quick Filters
    const [showActiveOnly, setShowActiveOnly] = useState(false);
    const [showExpiringSoon, setShowExpiringSoon] = useState(false);
    const [showIbCustomers, setShowIbCustomers] = useState(false);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Modal State
    const [editingLicense, setEditingLicense] = useState<any>(null);
    const [editExpiryDate, setEditExpiryDate] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    // Extract unique options for dropdowns
    const eaNames = useMemo(() => Array.from(new Set(licenses.map(l => l.products?.name).filter(Boolean))), [licenses]);
    const eaGroups = useMemo(() => Array.from(new Set(licenses.map(l => l.products?.asset_class || l.products?.platform).filter(Boolean))), [licenses]);

    // Derived Data
    const filteredLicenses = useMemo(() => {
        let filtered = [...licenses];

        // 1. Text Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(l =>
                l.account_number.toLowerCase().includes(query) ||
                l.profiles?.full_name?.toLowerCase().includes(query) ||
                l.profiles?.email?.toLowerCase().includes(query)
            );
        }

        // 2. Dropdown Filters
        if (filterEaName !== 'all') {
            filtered = filtered.filter(l => l.products?.name === filterEaName);
        }
        if (filterEaGroup !== 'all') {
            filtered = filtered.filter(l => l.products?.asset_class === filterEaGroup || l.products?.platform === filterEaGroup);
        }
        if (filterPlan !== 'all') {
            filtered = filtered.filter(l => l.type === filterPlan);
        }

        // 3. Quick Filters
        if (showActiveOnly) {
            filtered = filtered.filter(l => l.is_active);
        }
        if (showExpiringSoon) {
            const now = new Date();
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
            filtered = filtered.filter(l => {
                if (l.type === 'lifetime' || !l.expiry_date) return false;
                const expiry = new Date(l.expiry_date);
                return expiry >= now && expiry <= sevenDaysFromNow;
            });
        }
        if (showIbCustomers) {
            filtered = filtered.filter(l =>
                l.profiles?.ib_account_number && l.profiles?.ib_account_number === l.account_number
            );
        }

        // 4. Sorting
        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                let aValue, bValue;

                if (sortConfig.key === 'expiry_date') {
                    if (a.type === 'lifetime') return sortConfig.direction === 'asc' ? 1 : -1;
                    if (b.type === 'lifetime') return sortConfig.direction === 'asc' ? -1 : 1;
                    aValue = new Date(a.expiry_date || 0).getTime();
                    bValue = new Date(b.expiry_date || 0).getTime();
                } else if (sortConfig.key === 'created_at') {
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                } else if (sortConfig.key === 'customer_name') {
                    aValue = a.profiles?.full_name || '';
                    bValue = b.profiles?.full_name || '';
                } else {
                    return 0; // Default
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [licenses, searchQuery, filterEaName, filterEaGroup, filterPlan, showActiveOnly, showExpiringSoon, showIbCustomers, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleEditClick = (license: any) => {
        setEditingLicense(license);
        // Format datetime-local string (YYYY-MM-DDTHH:mm)
        if (license.expiry_date) {
            const d = new Date(license.expiry_date);
            // Handle timezone offset simply
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            setEditExpiryDate(d.toISOString().slice(0, 16));
        } else {
            setEditExpiryDate('');
        }
        setEditIsActive(license.is_active);
    };

    const handleSaveLicense = async () => {
        if (!editingLicense) return;
        setSaving(true);
        try {
            const updates: any = {
                is_active: editIsActive,
            };

            if (editingLicense.type !== 'lifetime') {
                if (!editExpiryDate) {
                    alert('กรุณาระบุวันหมดอายุ');
                    setSaving(false);
                    return;
                }
                updates.expiry_date = new Date(editExpiryDate).toISOString();
            }

            const { error } = await supabase
                .from('licenses')
                .update(updates)
                .eq('id', editingLicense.id);

            if (error) throw error;

            // Update local state
            setLicenses(licenses.map(l =>
                l.id === editingLicense.id
                    ? { ...l, ...updates }
                    : l
            ));

            setEditingLicense(null);
            alert('บันทึกข้อมูลสำเร็จ');
        } catch (error: any) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">จัดการลิขสิทธิ์ EA (License Management)</h1>

            {/* Filters Section */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="w-5 h-5" /> ตัวกรองข้อมูล
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>ค้นหา (ชื่อ/อีเมล/เลขพอร์ต)</Label>
                            <Input
                                placeholder="พิมพ์ข้อความค้นหา..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>ชื่อ EA</Label>
                            <Select value={filterEaName} onValueChange={setFilterEaName}>
                                <SelectTrigger><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทั้งหมด</SelectItem>
                                    {eaNames.map((name: any) => (
                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>กลุ่ม EA (แพลตฟอร์ม/สินทรัพย์)</Label>
                            <Select value={filterEaGroup} onValueChange={setFilterEaGroup}>
                                <SelectTrigger><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทั้งหมด</SelectItem>
                                    {eaGroups.map((group: any) => (
                                        <SelectItem key={group} value={group}>{group}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>แพ็กเกจ (Plan)</Label>
                            <Select value={filterPlan} onValueChange={setFilterPlan}>
                                <SelectTrigger><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทั้งหมด</SelectItem>
                                    <SelectItem value="monthly">รายเดือน</SelectItem>
                                    <SelectItem value="quarterly">ราย 3 เดือน</SelectItem>
                                    <SelectItem value="lifetime">ตลอดชีพ (Lifetime)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-2 border-t">
                        <span className="text-sm font-medium items-center flex">ตัวกรองด่วน:</span>
                        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border text-sm cursor-pointer hover:bg-muted" onClick={() => setShowActiveOnly(!showActiveOnly)}>
                            <Switch checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
                            <span>เฉพาะที่กำลังใช้งาน (Active)</span>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border text-sm cursor-pointer hover:bg-muted" onClick={() => setShowExpiringSoon(!showExpiringSoon)}>
                            <Switch checked={showExpiringSoon} onCheckedChange={setShowExpiringSoon} />
                            <span>ใกล้หมดอายุ (ภายใน 7 วัน)</span>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border text-sm cursor-pointer hover:bg-muted" onClick={() => setShowIbCustomers(!showIbCustomers)}>
                            <Switch checked={showIbCustomers} onCheckedChange={setShowIbCustomers} />
                            <span>เฉพาะลูกค้า IB</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table Section */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                            <tr>
                                <th className="px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={() => requestSort('created_at')}>
                                    <div className="flex items-center gap-1">วันที่สร้าง <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={() => requestSort('customer_name')}>
                                    <div className="flex items-center gap-1">ลูกค้า (Customer) <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-3">สินค้า EA</th>
                                <th className="px-4 py-3">แพ็กเกจ</th>
                                <th className="px-4 py-3">เลขพอร์ต</th>
                                <th className="px-4 py-3 text-center">สถานะ</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={() => requestSort('expiry_date')}>
                                    <div className="flex items-center justify-end gap-1">วันหมดอายุ <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-4 py-3 text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLicenses.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูลสิทธิ์ใช้งาน</td>
                                </tr>
                            ) : (
                                filteredLicenses.map((license) => {
                                    const isIB = license.profiles?.ib_account_number && license.profiles?.ib_account_number === license.account_number;
                                    const isExpired = license.type !== 'lifetime' && new Date(license.expiry_date) < new Date();

                                    return (
                                        <tr key={license.id} className="border-b hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                                {formatDate(license.created_at)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold">{license.profiles?.full_name || 'ผู้ใช้ทั่วไป'}</div>
                                                <div className="text-xs text-muted-foreground">{license.profiles?.email}</div>
                                                {isIB && <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded">IB Customer</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{license.products?.name}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{license.products?.asset_class || license.products?.platform}</div>
                                            </td>
                                            <td className="px-4 py-3 capitalize">
                                                {license.type === 'lifetime' ? (
                                                    <span className="text-orange-600 bg-orange-100 px-2 py-0.5 rounded text-xs font-bold">Lifetime</span>
                                                ) : license.type}
                                            </td>
                                            <td className="px-4 py-3 font-mono font-medium">{license.account_number}</td>
                                            <td className="px-4 py-3 text-center">
                                                {license.is_active ? (
                                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1"></span>
                                                ) : (
                                                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1"></span>
                                                )}
                                                {license.is_active ? 'Active' : 'Inactive'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {license.type === 'lifetime' ? (
                                                    <span className="text-muted-foreground">ตลอดชีพ</span>
                                                ) : (
                                                    <span className={`${isExpired ? 'text-red-500 font-bold' : ''}`}>
                                                        {formatDate(license.expiry_date)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button variant="ghost" size="sm" onClick={() => handleEditClick(license)}>
                                                    <Edit className="w-4 h-4 text-blue-500" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Edit Modal */}
            <Dialog open={!!editingLicense} onOpenChange={(open) => !open && setEditingLicense(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-primary" /> จัดการสิทธิ์การใช้งาน
                        </DialogTitle>
                    </DialogHeader>

                    {editingLicense && (
                        <div className="space-y-6 my-4">
                            {/* Read-only Data */}
                            <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
                                <div className="flex gap-2 items-start">
                                    <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                                    <div>
                                        <div className="font-bold">{editingLicense.profiles?.full_name}</div>
                                        <div className="text-muted-foreground">{editingLicense.profiles?.email}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div>
                                        <strong>{editingLicense.products?.name}</strong>
                                        <span className="text-muted-foreground ml-2">({editingLicense.type})</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div>
                                        พอร์ตหมายเลข: <strong className="font-mono">{editingLicense.account_number}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <div className="space-y-0.5">
                                        <Label>สถานะการใช้งาน (Active Target)</Label>
                                        <p className="text-xs text-muted-foreground">เปิด/ปิด สิทธิ์การใช้ EA พอร์ตนี้</p>
                                    </div>
                                    <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                                </div>

                                {editingLicense.type !== 'lifetime' && (
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> วันหมดอายุ (Expiry Date)
                                        </Label>
                                        <Input
                                            type="datetime-local"
                                            value={editExpiryDate}
                                            onChange={(e) => setEditExpiryDate(e.target.value)}
                                        />
                                    </div>
                                )}
                                {editingLicense.type === 'lifetime' && (
                                    <div className="text-center p-3 border border-orange-200 bg-orange-50 text-orange-800 rounded-lg text-sm">
                                        สิทธิ์การใช้งานแบบตลอดชีพ ไม่ต้องตั้งวันหมดอายุ
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingLicense(null)}>ยกเลิก</Button>
                        <Button onClick={handleSaveLicense} disabled={saving}>
                            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
