'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Check, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface ProductPurchaseSectionProps {
    product: any;
}

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Checkbox } from '@/components/ui/checkbox';

export function ProductPurchaseSection({ product }: ProductPurchaseSectionProps) {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<'monthly' | 'quarterly' | 'lifetime'>('lifetime');
    const portCount = product.is_multi_port ? (product.port_count || 1) : 1;
    const [accountNumbers, setAccountNumbers] = useState<string[]>(Array(portCount).fill(''));
    const [riskAccepted, setRiskAccepted] = useState(false);
    const [loading, setLoading] = useState(false);

    const [portValidationMsg, setPortValidationMsg] = useState<{ text: string, type: 'error' | 'success' | 'checking' } | null>(null);

    // New State for active licenses and pending orders
    const [userId, setUserId] = useState<string | null>(null);
    const [userLicenses, setUserLicenses] = useState<any[]>([]);
    const [userOrders, setUserOrders] = useState<any[]>([]);
    const [isRenewal, setIsRenewal] = useState(false);

    // IB Status
    const [ibStatus, setIbStatus] = useState<'none' | 'pending' | 'approved'>('none');
    const [useIbQuota, setUseIbQuota] = useState(true);
    const [ibAccounts, setIbAccounts] = useState<Record<string, string>>({});
    const [approvedBrokersList, setApprovedBrokersList] = useState<string[]>([]);
    const [selectedIbBroker, setSelectedIbBroker] = useState<string>('');

    // Fetch user licenses and orders on mount
    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                // 1. Fetch All Licenses (Active & Expired) to allow easy renewal
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id);

                if (licenses) setUserLicenses(licenses);

                // 2. Fetch Pending Orders
                const { data: orders } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('status', 'pending');

                if (orders) setUserOrders(orders);

                // 3. Fetch IB Memberships
                const { data: memberships } = await supabase
                    .from('ib_memberships')
                    .select('status, broker_id, verification_data, brokers(name)')
                    .eq('user_id', user.id);

                let fetchedIbAccounts: Record<string, string> = {};

                if (memberships && memberships.length > 0) {
                    const approvedList = Array.from(new Set(memberships.filter(m => m.status === 'approved').map(m => Array.isArray((m as any).brokers) ? (m as any).brokers[0]?.name : (m as any).brokers?.name || 'Customer'))).filter(Boolean);
                    setApprovedBrokersList(approvedList as string[]);
                    if (approvedList.length > 0) {
                        setSelectedIbBroker(approvedList[0] as string);
                    }

                    memberships.forEach(m => {
                        if (m.verification_data) {
                            fetchedIbAccounts[m.verification_data] = Array.isArray((m as any).brokers) ? (m as any).brokers[0]?.name : (m as any).brokers?.name || 'Customer';
                        }
                    });

                    const hasApproved = memberships.some(m => m.status === 'approved');
                    if (hasApproved) {
                        setIbStatus('approved');
                    } else if (memberships.some(m => m.status === 'pending')) {
                        setIbStatus('pending');
                    } else {
                        setIbStatus('none');
                    }
                }

                // 4. Fetch Legacy Fallback explicitly just in case they haven't been mapped
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('ib_account_number, ib_status')
                    .eq('id', user.id)
                    .single();

                if (profile?.ib_account_number && !fetchedIbAccounts[profile.ib_account_number]) {
                    fetchedIbAccounts[profile.ib_account_number] = 'Customer';
                }

                // If there were no approved new memberships, fallback to legacy profile status
                if (!memberships || memberships.length === 0 || !memberships.some(m => m.status === 'approved')) {
                    if (profile?.ib_status === 'approved') {
                        setIbStatus('approved');
                    } else if (profile?.ib_status === 'pending') {
                        setIbStatus('pending');
                    }
                }

                setIbAccounts(fetchedIbAccounts);
            }
        };
        fetchData();
    }, [product.id]);

    useEffect(() => {
        if (product.allow_ib === false) {
            setUseIbQuota(false);
        } else if (product.allow_rent === false) {
            setUseIbQuota(true);
        }
    }, [product.allow_ib, product.allow_rent]);

    // Helper for date formatting
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const calculateNewExpiry = (currentExpiry: string, type: 'monthly' | 'quarterly' | 'lifetime') => {
        if (type === 'lifetime') return 'ตลอดชีพ';

        let startDate = new Date();
        const expiryDate = new Date(currentExpiry);

        // If current expiry is in the future, start from there
        if (expiryDate > startDate) {
            startDate = expiryDate;
        }

        const newDate = new Date(startDate);
        if (type === 'monthly') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else if (type === 'quarterly') {
            newDate.setMonth(newDate.getMonth() + 3);
        }

        return formatDate(newDate.toISOString());
    };

    // Check if entered account number matches an existing license / Validations
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            const filledPorts = accountNumbers.map(p => p.trim()).filter(Boolean);
            if (filledPorts.length === 0) {
                setPortValidationMsg(null);
                setIsRenewal(false);
                return;
            }

            const uniquePorts = new Set(filledPorts);
            if (uniquePorts.size !== filledPorts.length) {
                setPortValidationMsg({ text: 'พอร์ตซ้ำกันในช่องกรอก', type: 'error' });
                setIsRenewal(false);
                return;
            }

            setPortValidationMsg({ text: 'กำลังตรวจสอบพอร์ต...', type: 'checking' });

            let hasError = false;
            let isAnyRenewal = false;

            for (const port of filledPorts) {
                const existingUserLicense = userLicenses.find(l => l.account_number === port);
                if (existingUserLicense) {
                    const isIbPort = existingUserLicense.type === 'ib' || !!existingUserLicense.ib_broker_name || !!ibAccounts[port];
                    if (ibStatus === 'approved' && useIbQuota) {
                        if (!isIbPort) {
                            setPortValidationMsg({ text: `พอร์ต ${port} เป็นพอร์ตปกติ ไม่สามารถขอแบบ IB ได้`, type: 'error' });
                            hasError = true;
                            break;
                        } else {
                            isAnyRenewal = true;
                        }
                    } else {
                        if (isIbPort) {
                            setPortValidationMsg({ text: `พอร์ต ${port} เป็นโควต้า IB ไม่สามารถต่อแบบปกติได้`, type: 'error' });
                            hasError = true;
                            break;
                        } else {
                            isAnyRenewal = true;
                        }
                    }
                }
            }
            if (hasError) {
                setIsRenewal(false);
                return;
            }

            const pendingOrders = userOrders.filter(o => o.account_number && o.account_number.split(',').some((p: string) => filledPorts.includes(p)));
            if (pendingOrders.length > 0) {
                setPortValidationMsg({ text: 'คุณมีคำสั่งซื้อที่รอตรวจสอบแพ็คเกจหน้านี้สำหรับพอร์ตที่กรอกอยู่แล้ว', type: 'error' });
                setIsRenewal(false);
                return;
            }

            const { data: globalLicenses } = await supabase
                .from('licenses')
                .select('account_number, user_id')
                .in('account_number', filledPorts);

            if (globalLicenses && globalLicenses.length > 0) {
                const conflicts = globalLicenses.filter(l => l.user_id !== userId);
                if (conflicts.length > 0) {
                    setPortValidationMsg({ text: `หมายเลขพอร์ต ${conflicts[0].account_number} มีการใช้งานในระบบแล้วโดยผู้ใช้อื่น ไม่สามารถใช้ซ้ำได้`, type: 'error' });
                    setIsRenewal(false);
                    return;
                }
            }

            if (isAnyRenewal) {
                setIsRenewal(true);
                setPortValidationMsg({ text: 'ต่ออายุ License เดิม', type: 'success' });
            } else {
                setIsRenewal(false);
                setPortValidationMsg({ text: filledPorts.length === accountNumbers.length ? 'สามารถใช้พอร์ตเหล่านี้ได้' : 'กำลังรอเลขพอร์ตให้ครบ...', type: 'success' });
            }

        }, 500);

        return () => clearTimeout(timeoutId);
    }, [accountNumbers, userLicenses, userOrders, ibStatus, useIbQuota, userId]);


    const handlePurchase = async () => {
        const filledPorts = accountNumbers.map(p => p.trim()).filter(Boolean);
        if (filledPorts.length < accountNumbers.length) {
            alert(`กรุณากรอกหมายเลขพอร์ตให้ครบทั้ง ${accountNumbers.length} ช่อง`);
            return;
        }

        const uniquePorts = new Set(filledPorts);
        if (uniquePorts.size !== filledPorts.length) {
            alert('คุณกรอกหมายเลขพอร์ตซ้ำกัน กรุณาตรวจสอบอีกครั้ง');
            return;
        }

        if (!riskAccepted) {
            alert('กรุณายอมรับความเสี่ยงและข้อตกลงก่อนดำเนินการต่อ');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 0. Check for duplicate License GLOBAL (Prevent hijacking active ports)
            if (portValidationMsg?.type === 'error') {
                alert(portValidationMsg.text);
                setLoading(false);
                return;
            }

            const queryParams = new URLSearchParams({
                plan: selectedType,
                accountNumber: filledPorts.join(',')
            });

            if (ibStatus === 'approved' && useIbQuota) {
                queryParams.append('isIbRequest', 'true');
                if (selectedIbBroker) queryParams.append('ibBrokerName', selectedIbBroker);
            }

            if (!user) {
                // Not logged in
                // Encode return URL
                const returnUrl = encodeURIComponent(`/products/${product.id}?${queryParams.toString()}`);
                router.push(`/login?returnUrl=${returnUrl}`);
                return;
            }

            // Redirect to Checkout Page with params
            router.push(`/checkout/${product.id}?${queryParams.toString()}`);

        } catch (error) {
            console.error(error);
            alert('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    // Helper for progress bar
    const calculateDaysRemaining = (expiryDate: string, type: string, isIbPort: boolean = false) => {
        // If it's a normal lifetime port, or an IB port missing an explicit date, return 999
        if ((!isIbPort && type === 'lifetime') || (isIbPort && !expiryDate)) return 999;
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Get current license details for display
    const currentLicense = userLicenses.find(l => accountNumbers.some(p => p.trim() === l.account_number));

    // Compute unique brokers and filtered ports
    const uniqueBrokers = Array.from(new Set(Object.values(ibAccounts))).filter(Boolean);

    // Filter ports for display to avoid rendering empty sections and drop empty port strings
    const displayLicenses = userLicenses.filter(license => license.account_number && ((ibStatus === 'approved' && useIbQuota) ? (!!license.ib_broker_name || !!ibAccounts[license.account_number]) : !(!!license.ib_broker_name || !!ibAccounts[license.account_number])));
    const displayOrders = userOrders.filter(order => order.account_number && ((ibStatus === 'approved' && useIbQuota) ? order.is_ib_request : !order.is_ib_request));

    if (product.allow_rent === false && ibStatus !== 'approved') {
        return (
            <div className="p-8 rounded-xl bg-gradient-to-br from-card to-background border border-border shadow-lg text-center">
                <div className="bg-blue-500/10 p-4 rounded-full inline-flex items-center justify-center text-blue-500 mb-4">
                    <Zap className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">สงวนสิทธิ์เฉพาะลูกค้า IB</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    สินค้ารายการนี้เปิดให้ใช้งานฟรีสำหรับลูกค้าภายใต้สายงาน IB ของ EA Easy Shop เท่านั้น
                    หากคุณยังไม่มีสิทธิ์ กรุณากดปุ่ม <b className="text-primary">"ขอใช้ EA ฟรี"</b> ที่แบนเนอร์ด้านบนเพื่อทำการสมัครเป็นพาร์ทเนอร์
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 rounded-xl bg-gradient-to-br from-card to-background border border-border shadow-lg space-y-6">

            {product.min_balance > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-500 p-4 rounded-lg flex items-start gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="w-full">
                        <div className="font-semibold text-base mb-1">
                            {(ibStatus === 'approved' && useIbQuota) ? 'บังคับทุนขั้นต่ำ' : 'ทุนแนะนำขั้นต่ำ'}:
                            {product.is_multi_port ? (
                                <div className="mt-2 text-sm bg-yellow-500/10 px-3 py-2.5 rounded-md border border-yellow-500/20">
                                    <div className="grid grid-cols-[130px_1fr] gap-1">
                                        <span className="font-medium text-yellow-700 dark:text-yellow-500">ขั้นต่ำต่อพอร์ต:</span>
                                        <span className="font-bold">${Number(product.min_balance).toLocaleString()}</span>
                                        
                                        <span className="font-medium text-yellow-700 dark:text-yellow-500">จำนวนพอร์ตที่ใช้:</span>
                                        <span className="font-bold">{product.port_count} พอร์ต</span>
                                        
                                        <span className="font-bold text-yellow-800 dark:text-yellow-400 mt-1 pt-1 border-t border-yellow-500/20">รวมทั้งหมด:</span>
                                        <span className="font-bold text-yellow-800 dark:text-yellow-400 mt-1 pt-1 border-t border-yellow-500/20">${(Number(product.min_balance) * Number(product.port_count)).toLocaleString()}</span>
                                    </div>
                                </div>
                            ) : (
                                <span className="font-bold ml-1">${Number(product.min_balance).toLocaleString()}</span>
                            )}
                        </div>
                        <p className="text-xs text-yellow-600/80 dark:text-yellow-500/80 mt-1.5">
                            {ibStatus === 'approved' && useIbQuota
                                ? (product.is_multi_port ? 'หากพอร์ตใดพอร์ตหนึ่งทุนไม่ถึงเกณฑ์ที่กำหนด ระบบจะไม่อนุญาตให้รัน EA เพื่อความปลอดภัยครับ' : 'หากทุนไม่ถึงเกณฑ์ที่กำหนด ระบบจะไม่อนุญาตให้รัน EA เพื่อความปลอดภัยครับ')
                                : (product.is_multi_port ? 'ระบบขอแนะนำให้มีทุนตามเกณฑ์นี้ เพื่อประสิทธิภาพสูงสุดในการเทรดของแต่ละพอร์ตครับ' : 'ระบบขอแนะนำให้มีทุนตามเกณฑ์นี้ เพื่อประสิทธิภาพสูงสุดในการเทรดครับ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Active & Pending Ports Display */}
            {(displayLicenses.length > 0 || displayOrders.length > 0) && (
                <div className="space-y-3 mb-6 p-4 bg-muted/30 rounded-lg border border-border">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        สถานะพอร์ตของคุณ
                    </h4>
                    <div className="space-y-2">
                        {/* Active Licenses */}
                        {displayLicenses.map((license) => {
                            const isIbPort = !!license.ib_broker_name || !!ibAccounts[license.account_number];
                            const brokerName = license.ib_broker_name || ibAccounts[license.account_number];
                            const days = calculateDaysRemaining(license.expiry_date, license.type, isIbPort);
                            const isExpired = !license.is_active || (license.type !== 'lifetime' && days <= 0) || (isIbPort && license.expiry_date && days <= 0);

                            return (
                                <div
                                    key={`license-${license.id}`}
                                    className={`text-sm p-3 rounded-md border cursor-pointer transition-colors flex justify-between items-center ${accountNumbers.map(a => a.trim()).includes(license.account_number) ? 'border-primary bg-primary/10' : isExpired ? 'border-border bg-muted/30 opacity-70 hover:opacity-100 hover:bg-muted/50' : 'border-border bg-background hover:bg-muted'}`}
                                    onClick={() => {
                                        const newAccs = [...accountNumbers];
                                        const existIdx = newAccs.findIndex(a => a.trim() === license.account_number);
                                        if (existIdx >= 0) {
                                            newAccs[existIdx] = '';
                                        } else {
                                            const emptyIdx = newAccs.findIndex(a => a.trim() === '');
                                            if (emptyIdx >= 0) {
                                                newAccs[emptyIdx] = license.account_number;
                                            } else if (!product.is_multi_port) {
                                                newAccs[0] = license.account_number;
                                            } else {
                                                alert(`คุณใส่พอร์ตเต็มโควต้า (${accountNumbers.length} พอร์ต) แล้ว ปลดอันเก่าออกก่อนครับ`);
                                                return;
                                            }
                                        }
                                        setAccountNumbers(newAccs);
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${isExpired ? 'bg-gray-500/10' : 'bg-green-500/10'}`}>
                                            <Check className={`w-3 h-3 ${isExpired ? 'text-gray-500' : 'text-green-600'}`} />
                                        </div>
                                        <div>
                                            <div className="font-mono font-bold text-base">{license.account_number}</div>
                                            <div className="flex items-center gap-2 mt-0.5 relative w-full overflow-hidden flex-wrap">
                                                {isExpired ? (
                                                    <span className="text-[10px] text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">หมดอายุ / ไม่พร้อมใช้งาน</span>
                                                ) : (
                                                    <span className="text-[10px] text-green-600 font-medium bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">ใช้งานได้ (Active)</span>
                                                )}

                                                {isIbPort && (
                                                    <span className="text-[9px] text-blue-500 font-bold bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        IB {brokerName}
                                                    </span>
                                                )}

                                                {((!isIbPort && license.type !== 'lifetime') || (isIbPort && license.expiry_date)) && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isExpired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 font-bold' : days <= 7 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 font-bold' : 'bg-gray-100 text-gray-600 dark:bg-gray-800'}`}>
                                                        {isExpired ? 'หมดอายุแล้ว' : `เหลือ ${days} วัน`}
                                                    </span>
                                                )}
                                                {(!isIbPort && license.type === 'lifetime') && <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Lifetime</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {accountNumbers.map(a => a.trim()).includes(license.account_number) && <Check className="w-4 h-4 text-primary" />}
                                </div>
                            );
                        })}

                        {/* Pending Orders */}
                        {displayOrders.map((order) => {
                            const isIbPort = order.is_ib_request;
                            const orderBrokerName = order.ib_broker_name || ibAccounts[order.account_number];
                            return (
                                <div
                                    key={`order-${order.id}`}
                                    className="text-sm p-3 rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/10 flex justify-between items-center opacity-80"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-yellow-500/10 p-1.5 rounded-full">
                                            <Loader2 className="w-3 h-3 text-yellow-600 animate-spin" />
                                        </div>
                                        <div>
                                            <div className="font-mono font-bold text-base">{order.account_number}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-yellow-700 dark:text-yellow-500 font-medium bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded">รอตรวจสอบ (Pending)</span>

                                                {isIbPort && (
                                                    <span className="text-[9px] text-blue-500 font-bold bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        IB {orderBrokerName || 'Customer'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* IB User Options */}
            {ibStatus === 'approved' && product.allow_ib !== false && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3 mb-2">
                    <h4 className="font-semibold text-primary flex items-center gap-2">
                        <Zap className="w-4 h-4" /> สิทธิพิเศษ IB ของคุณ
                    </h4>
                    <div className="flex flex-col gap-2 text-sm">
                        {product.allow_rent !== false ? (
                            <>
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors border border-transparent has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                                    <input
                                        type="radio"
                                        name="ib_choice"
                                        checked={useIbQuota}
                                        onChange={() => {
                                            setUseIbQuota(true);
                                        }}
                                        className="accent-primary"
                                    />
                                    <span>ขอสิทธิ์ใช้งานฟรีด้วยโควต้า IB{approvedBrokersList.length === 1 && ` ${approvedBrokersList[0]}`}</span>
                                </label>
                                {useIbQuota && approvedBrokersList.length > 1 && (
                                    <div className="pl-6 pb-2">
                                        <label className="text-xs text-muted-foreground block mb-2">โปรดเลือกโบรกเกอร์ IB ที่ต้องการใช้สิทธิ์:</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {approvedBrokersList.map(broker => (
                                            <label key={broker} className={`flex items-center gap-2 cursor-pointer p-2.5 text-xs rounded border transition-colors ${selectedIbBroker === broker ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-border bg-background hover:bg-muted'}`}>
                                                <input type="radio" name="ib_broker_choice" checked={selectedIbBroker === broker} onChange={() => setSelectedIbBroker(broker)} className="accent-primary" />
                                                <span>{broker}</span>
                                            </label> 
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors border border-transparent has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                                    <input
                                        type="radio"
                                        name="ib_choice"
                                        checked={!useIbQuota}
                                        onChange={() => {
                                            setUseIbQuota(false);
                                        }}
                                        className="accent-primary"
                                    />
                                    <span>เช่า/ซื้อ ปกติ</span>
                                </label>
                            </>
                        ) : (
                            <>
                                {approvedBrokersList.length > 1 ? (
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-2">โปรดเลือกโบรกเกอร์ IB ที่ต้องการใช้สิทธิ์:</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {approvedBrokersList.map(broker => (
                                            <label key={broker} className={`flex items-center gap-2 cursor-pointer p-2.5 text-xs rounded border transition-colors ${selectedIbBroker === broker ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-border bg-background hover:bg-muted'}`}>
                                                <input type="radio" name="ib_broker_choice_only" checked={selectedIbBroker === broker} onChange={() => setSelectedIbBroker(broker)} className="accent-primary" />
                                                <span>{broker}</span>
                                            </label> 
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground">ระบบจะใช้โควต้า IB ของคุณ{approvedBrokersList.length === 1 && ` (${approvedBrokersList[0]})`} สำหรับสินค้านี้โดยอัตโนมัติ</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Account Number Input */}
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-base font-semibold">
                        หมายเลขพอร์ต (Account Number) <span className="text-red-500">*</span>
                    </Label>
                    {product.is_multi_port && (
                        <p className="text-xs text-muted-foreground">สินค้านี้เป็นแบบ Multi-Port กรุณากรอกเลขพอร์ตให้ครบทั้ง {accountNumbers.length} ช่อง</p>
                    )}
                </div>

                <div className={`${product.is_multi_port ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2"}`}>
                    {accountNumbers.map((acc, index) => {
                        const isThisPortRenewing = isRenewal && userLicenses.some(l => l.account_number === acc.trim());
                        return (
                            <div key={index} className="relative">
                                {product.is_multi_port && (
                                    <Label className="text-xs mb-1.5 block text-muted-foreground">พอร์ตที่ {index + 1}</Label>
                                )}
                                <Input
                                    placeholder={product.is_multi_port ? `Ex. ${12345678 + index}` : "Ex. 12345678"}
                                    value={acc}
                                    onChange={(e) => {
                                        const newAccs = [...accountNumbers];
                                        newAccs[index] = e.target.value;
                                        setAccountNumbers(newAccs);
                                    }}
                                    className={`bg-background/50 border-input font-mono text-lg ${isThisPortRenewing ? 'border-green-500 ring-1 ring-green-500/50' : ''}`}
                                />
                                {isThisPortRenewing && (
                                    <div className={`absolute right-3 ${product.is_multi_port ? "top-8" : "top-1/2 -translate-y-1/2"} text-xs text-green-500 font-medium flex items-center gap-1 bg-background px-2`}>
                                        <Check className="w-3 h-3" /> ต่ออายุ
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {portValidationMsg && (
                    <div className={`text-xs mt-1.5 flex items-center gap-1 ${portValidationMsg.type === 'error' ? 'text-red-500' : portValidationMsg.type === 'success' ? 'text-green-500' : 'text-blue-500'}`}>
                        {portValidationMsg.type === 'checking' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {portValidationMsg.type === 'success' && <Check className="w-3 h-3" />}
                        {portValidationMsg.type === 'error' && <AlertCircle className="w-3 h-3" />}
                        {portValidationMsg.text}
                    </div>
                )}

                {/* Renewal Info Display */}
                {isRenewal && currentLicense && (
                    <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-muted/40 rounded-lg border border-dashed border-border text-xs">
                        <div>
                            <span className="text-muted-foreground block mb-0.5">วันหมดอายุปัจจุบัน:</span>
                            <span className="font-semibold text-foreground">
                                {(!ibAccounts[currentLicense.account_number] && currentLicense.type === 'lifetime') ? 'ตลอดชีพ' : formatDate(currentLicense.expiry_date)}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-muted-foreground block mb-0.5">ส่วนขยายอายุการใช้งาน:</span>
                            <span className="font-bold text-green-600 dark:text-green-500">
                                {ibStatus === 'approved' && useIbQuota ? 'รอแอดมินอนุมัติวันเพิ่มให้' : calculateNewExpiry(currentLicense.expiry_date, selectedType)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* License Type Selection (Hidden if using IB Quota or Rent Disabled) */}
            {!(ibStatus === 'approved' && useIbQuota) && product.allow_rent !== false && (
                <div>
                    <h3 className="text-lg font-bold mb-4">เลือกรูปแบบลิขสิทธิ์</h3>
                    <div className="grid grid-cols-1 gap-3 mb-6">
                        {/* Monthly Option */}
                        <div
                            className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'monthly' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background/50 hover:border-primary/50'}`}
                            onClick={() => setSelectedType('monthly')}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedType === 'monthly' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                                        {selectedType === 'monthly' && <div className="w-2 h-2 bg-black rounded-full" />}
                                    </div>
                                    <div>
                                        <span className={`font-semibold block ${selectedType === 'monthly' ? 'text-primary' : ''}`}>รายเดือน (1 Month)</span>
                                        <span className="text-xs text-muted-foreground">เหมาะสำหรับทดลองใช้</span>
                                    </div>
                                </div>
                                <div className="text-xl font-bold">฿{product.price_monthly?.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Quarterly Option */}
                        {product.price_quarterly && (
                            <div
                                className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'quarterly' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background/50 hover:border-primary/50'}`}
                                onClick={() => setSelectedType('quarterly')}
                            >
                                {/* Best Value Tag for Quarterly if needed */}
                                <div className="absolute -top-2 right-4 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    แนะนำ
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedType === 'quarterly' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                                            {selectedType === 'quarterly' && <div className="w-2 h-2 bg-black rounded-full" />}
                                        </div>
                                        <div>
                                            <span className={`font-semibold block ${selectedType === 'quarterly' ? 'text-primary' : ''}`}>ราย 3 เดือน (Quarterly)</span>
                                            <span className="text-xs text-muted-foreground">ประหยัดกว่ารายเดือน</span>
                                        </div>
                                    </div>
                                    <div className="text-xl font-bold">฿{product.price_quarterly?.toLocaleString()}</div>
                                </div>
                            </div>
                        )}

                        {/* Lifetime Option */}
                        <div
                            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'lifetime' ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-accent/30 bg-accent/5 hover:bg-accent/10'}`}
                            onClick={() => setSelectedType('lifetime')}
                        >
                            <div className="absolute -top-3 right-4 bg-accent text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-yellow-500/20">
                                คุ้มค่าที่สุด
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedType === 'lifetime' ? 'border-accent bg-accent' : 'border-muted-foreground'}`}>
                                        {selectedType === 'lifetime' && <div className="w-2 h-2 bg-black rounded-full" />}
                                    </div>
                                    <div>
                                        <span className={`font-semibold block ${selectedType === 'lifetime' ? 'text-accent' : 'text-accent/80'}`}>ถาวร (Lifetime)</span>
                                        <span className="text-xs text-muted-foreground">จ่ายครั้งเดียว ใช้ได้ตลอดชีพ</span>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-accent gold-glow">฿{product.price_lifetime?.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Risk Disclosure Section */}
            <div className="space-y-4 pt-4 border-t border-border">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 h-32 overflow-y-auto text-xs text-muted-foreground">
                    <h4 className="font-bold text-destructive mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> คำเตือนความเสี่ยง (Risk Disclosure)
                    </h4>
                    <p className="mb-2">
                        การลงทุนในตลาด Forex และการใช้งาน Expert Advisor (EA) มีความเสี่ยงสูง ผู้ลงทุนอาจสูญเสียเงินลงทุนทั้งหมด ผลการดำเนินงานในอดีตมิได้เป็นสิ่งยืนยันถึงผลการดำเนินงานในอนาคต
                    </p>
                    <p className="mb-2">
                        ผู้ใช้งานควรทำความเข้าใจลักษณะสินค้า เงื่อนไขผลตอบแทน และความเสี่ยงก่อนตัดสินใจลงทุน
                        ทาง EA Easy Shop ไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดขึ้นจากการใช้งานซอฟต์แวร์นี้ การตัดสินใจลงทุนเป็นความรับผิดชอบของผู้ใช้งานแต่เพียงผู้เดียว
                    </p>
                    <p>
                        การซื้อ License เป็นการซื้อสิทธิ์การใช้งานซอฟต์แวร์เท่านั้น ไม่ใช่การระดมทุนหรือการการันตีผลกำไร
                    </p>
                </div>

                <div className="flex items-start space-x-3 p-2">
                    <Checkbox
                        id="risk-agreement"
                        checked={riskAccepted}
                        onCheckedChange={(checked) => setRiskAccepted(checked as boolean)}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label
                            htmlFor="risk-agreement"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                            ข้าพเจ้าได้อ่านและยอมรับความเสี่ยง รวมถึงข้อตกลงในการใช้งาน
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            คุณต้องยอมรับข้อตกลงก่อนดำเนินการต่อ
                        </p>
                    </div>
                </div>
            </div>

            <Button
                size="lg"
                className={`w-full text-base font-semibold shadow-xl transition-all duration-300 ${isRenewal && !useIbQuota ? 'bg-green-600 hover:bg-green-700 shadow-green-900/20' : isRenewal && useIbQuota ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20' : ibStatus === 'approved' && useIbQuota ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20' : 'shadow-blue-900/20'}`}
                onClick={handlePurchase}
                disabled={loading}
            >
                {loading ? 'กำลังดำเนินการ...' : isRenewal ? (useIbQuota ? 'ยื่นคำร้องต่ออายุโควต้า IB' : 'ต่ออายุ License (Renew)') : ibStatus === 'approved' && useIbQuota ? 'ขอรับสิทธิ์ใช้งานฟรี (0 ฿)' : 'ดำเนินการต่อ'}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                ชำระเงินปลอดภัยผ่าน QR Code รับสินค้าทันที
            </p>
        </div>
    );
}
