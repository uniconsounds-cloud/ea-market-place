'use client';

import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, 
    ShieldAlert, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle, 
    Wifi, 
    WifiOff, 
    Clock, 
    Database, 
    Server, 
    ExternalLink, 
    RefreshCw, 
    ChevronDown, 
    ChevronUp,
    Info,
    HelpCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface AdminFarmDiagnosticOverlayProps {
    isSuperAdmin?: boolean;
    portNumber: string;
    portStatus?: any;
    ordersCount: number;
    licenseInfo?: {
        isActive: boolean;
        productName: string;
        productKey: string;
        minBalance: number;
        currency: string;
        createdAt?: string | null;
    } | null;
}

export default function AdminFarmDiagnosticOverlay({
    isSuperAdmin = false,
    portNumber,
    portStatus,
    ordersCount,
    licenseInfo
}: AdminFarmDiagnosticOverlayProps) {
    // Strictly restrict to juntarasate@gmail.com
    if (!isSuperAdmin) return null;

    const [isExpanded, setIsExpanded] = useState(false);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
        return () => clearInterval(timer);
    }, []);

    // 1. Telemetry Timing Calculations
    const pingTime = portStatus?.last_ping ? new Date(portStatus.last_ping).getTime() : 0;
    const updTime = portStatus?.updated_at ? new Date(portStatus.updated_at).getTime() : 0;
    const lastActiveMs = Math.max(pingTime, updTime);
    const secondsAgo = lastActiveMs > 0 ? Math.floor((currentTime - lastActiveMs) / 1000) : 999999;
    
    let relativeTimeStr = 'ไม่เคยซิงค์ข้อมูล';
    if (lastActiveMs > 0) {
        if (secondsAgo < 60) relativeTimeStr = `${secondsAgo} วินาทีที่แล้ว`;
        else if (secondsAgo < 3600) relativeTimeStr = `${Math.floor(secondsAgo / 60)} นาทีที่แล้ว`;
        else if (secondsAgo < 86400) relativeTimeStr = `${Math.floor(secondsAgo / 3600)} ชั่วโมงที่แล้ว`;
        else relativeTimeStr = `${Math.floor(secondsAgo / 86400)} วันที่แล้ว`;
    }

    const isLive = secondsAgo <= 1800; // Under 30 minutes
    const isOffline48h = secondsAgo > 48 * 3600;

    // 2. Second WebRequest Check (Telemetry & Active Orders Sync)
    // WebRequest 1: https://eaeze.com/api/verify-license (License ping & Balance)
    // WebRequest 2: https://mfrspvzxmpksqnzcrysz.supabase.co or https://eaeze.com/api/farm/sync (Orders & Depth telemetry)
    const hasActiveOrders = ordersCount > 0;
    const hasMarginInfo = Number(portStatus?.margin_level) > 0;
    const hasDepthCounts = (Number(portStatus?.buy_count) > 0 || Number(portStatus?.sell_count) > 0);
    const hasServerTime = !!portStatus?.server_time;

    const hasWebRequest2 = hasActiveOrders || hasMarginInfo || hasDepthCounts || hasServerTime;

    // 3. Balance & Min Capital Check
    const rawBal = Number(portStatus?.balance) || 0;
    const isUSD = portStatus?.account_type === 'USD';
    const balUSC = isUSD ? rawBal * 100 : rawBal;

    const prodKey = (licenseInfo?.productKey || '').toUpperCase();
    const prodName = (licenseInfo?.productName || '').toUpperCase();
    let requiredBalanceUSC = 30000;
    if (prodKey.includes('MAX') || prodName.includes('MAX')) requiredBalanceUSC = 100000;
    else if (prodKey.includes('MIN') || prodName.includes('MINI')) requiredBalanceUSC = 50000;
    else if (prodKey.includes('10P') || prodName.includes('10PAIR')) requiredBalanceUSC = 20000;
    else if (licenseInfo?.minBalance && licenseInfo.minBalance > 0) {
        requiredBalanceUSC = licenseInfo.currency === 'USD' ? licenseInfo.minBalance * 100 : licenseInfo.minBalance;
    }

    const hasEnoughCapital = balUSC >= requiredBalanceUSC;
    const isLicenseActive = licenseInfo?.isActive !== false;

    // 3.5 EA / Product Mismatch Check (e.g. Registered EasyM but MT5 running Gold EA like 97072259)
    const isEasyMLicense = prodKey.includes('EZM') || prodName.includes('EASYM') || prodName.includes('EASY M');
    const isGoldTelemetry = (portNumber === '97072259') || 
                           (portStatus?.system_code?.toLowerCase().includes('gold') || portStatus?.system_code === 'EG_FARMING');
    const isEAMismatch = isEasyMLicense && isGoldTelemetry;

    // 4. Comprehensive Farm Health Evaluation
    type HealthGrade = 'perfect' | 'partial' | 'warning' | 'critical';
    let healthGrade: HealthGrade = 'perfect';
    let healthTitle = 'ข้อมูลหน้าฟาร์มสมบูรณ์ถูกต้อง 100%';
    let healthDescription = 'พอร์ตเชื่อมต่อ WebRequest ครบทั้ง 2 ตัว ส่งข้อมูลออเดอร์สดและสถานะทุนผ่านเกณฑ์ครบถ้วน กราฟิกฟาร์มและต้นไม้จะแสดงผลได้ถูกต้อง';

    if (!isLicenseActive) {
        healthGrade = 'critical';
        healthTitle = 'สิทธิ์ License ไม่พร้อมใช้งาน (Inactive)';
        healthDescription = 'พอร์ตนี้ไม่มีใบอนุญาตที่เปิดใช้งาน หรือสิทธิ์ถูกปิดกั้นในระบบ ทำให้ระบบจำกัดการรัน';
    } else if (isOffline48h) {
        healthGrade = 'critical';
        healthTitle = 'พอร์ตขาดการติดต่อนานกว่า 48 ชั่วโมง';
        healthDescription = 'ไม่มีสัญญาณการเชื่อมต่อจาก MT5 เกิน 48 ชม. อาจเกิดจากปิด MT5, ถอดบอทออก หรือเซิร์ฟเวอร์ VPS ดับ';
    } else if (isEAMismatch) {
        healthGrade = 'warning';
        healthTitle = 'ตรวจพบรัน EA ทองคำ (EA Mismatch)';
        healthDescription = `พอร์ตนี้ขอสิทธิ์เป็น ${licenseInfo?.productName || 'EasyM'} (คู่เงิน Forex) แต่บน MT5 กำลังรัน EA ทองคำ (${portStatus?.asset_type || 'GOLD'} / ${portStatus?.system_code || 'EasyGold'}) หน้าฟาร์มจึงแสดงภาพเป็นฟาร์มทองคำตามข้อมูลจริงที่ MT5 ส่งมา`;
    } else if (!hasEnoughCapital) {
        healthGrade = 'warning';
        healthTitle = 'ทุนต่ำกว่าเกณฑ์ขั้นต่ำของบอท';
        healthDescription = `ทุนปัจจุบัน ${balUSC.toLocaleString()} USC ขาดอีก ${(requiredBalanceUSC - balUSC).toLocaleString()} USC จากเกณฑ์ ${requiredBalanceUSC.toLocaleString()} USC (${licenseInfo?.productName || 'บอท'})`;
    } else if (!hasWebRequest2) {
        healthGrade = 'partial';
        healthTitle = 'ยังไม่ได้ตั้งค่า WebRequest ตัวที่ 2 ใน MT5';
        healthDescription = 'บอทส่งสัญญาณตรวจสิทธิ์ปกติ (URL ที่ 1) แต่ขาด URL ตัวที่ 2 (https://mfrspvzxmpksqnzcrysz.supabase.co) ทำให้หน้าฟาร์มไม่สามารถแสดงต้นไม้และคำสั่งซื้อขายสดได้';
    } else if (!isLive) {
        healthGrade = 'warning';
        healthTitle = 'สัญญาณเริ่มล่าช้า (Offline ชั่วคราว)';
        healthDescription = `สัญญาณล่าสุดส่งมาเมื่อ ${relativeTimeStr} (เกิน 30 นาที) แนะนำให้ตรวจสอบว่า MT5 ยังเชื่อมต่ออินเทอร์เน็ตปกติหรือไม่`;
    }

    const handleRefresh = () => {
        setIsRefreshing(true);
        window.location.reload();
    };

    return (
        <aside 
            aria-label="Admin Farm Diagnostic Overlay"
            className="fixed bottom-4 right-4 z-[9999] font-sans select-none max-w-[95vw] sm:max-w-md"
        >
            {!isExpanded ? (
                /* Collapsed Floating Pill */
                <button
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center gap-2 bg-[#120c06]/95 hover:bg-[#1a1209] border border-amber-500/50 hover:border-amber-400 text-amber-200 px-3.5 py-2 rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-300 group cursor-pointer hover:scale-[1.02]"
                >
                    <div className="relative">
                        <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                            healthGrade === 'perfect' ? 'bg-emerald-400 animate-ping' : 
                            healthGrade === 'partial' ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
                        }`} />
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-300">
                        Admin Inspector (#{portNumber})
                    </span>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${
                        healthGrade === 'perfect' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                        healthGrade === 'partial' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                        'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}>
                        {healthGrade === 'perfect' ? '🟢 100% สมบูรณ์' :
                         healthGrade === 'partial' ? '🟡 ขาด WebReq #2' :
                         healthGrade === 'warning' ? '⚠️ ทุน/สัญญาณเตือน' : '🔴 มีปัญหา'}
                    </Badge>
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-300 transition-colors" />
                </button>
            ) : (
                /* Expanded Diagnostic Card */
                <div className="bg-[#120b05]/95 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-[0_8px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl space-y-3.5 text-amber-100 text-xs animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-amber-400" />
                            <div>
                                <h4 className="text-sm font-bold text-amber-200 flex items-center gap-1.5">
                                    <span>EAeze SuperAdmin Farm Inspector</span>
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono">
                                        เฉพาะคุณโจ้
                                    </span>
                                </h4>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                    พอร์ต: #{portNumber} • บอท: {licenseInfo?.productName || 'EasyM'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10"
                                title="รีเฟรชข้อมูล"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsExpanded(false)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10"
                                title="ย่อหน้าต่าง"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* 1. Overall Health Banner */}
                    <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        healthGrade === 'perfect' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' :
                        healthGrade === 'partial' ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' :
                        healthGrade === 'warning' ? 'bg-amber-950/50 border-amber-500/50 text-amber-200' :
                        'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}>
                        {healthGrade === 'perfect' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : healthGrade === 'partial' ? (
                            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                            <div className="font-bold text-xs">{healthTitle}</div>
                            <div className="text-[11px] leading-relaxed opacity-90">{healthDescription}</div>
                        </div>
                    </div>

                    {/* EA Mismatch Alert Box */}
                    {isEAMismatch && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-amber-300">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>เหตุผลที่หน้าฟาร์มแสดงผลเป็นทองคำ (EasyGold):</span>
                            </div>
                            <p className="text-muted-foreground text-[11px] leading-relaxed">
                                พอร์ตนี้ในระบบขอใช้เป็น <strong className="text-amber-200">{licenseInfo?.productName}</strong> (คู่เงิน Forex) แต่บน MT5 ผู้ใช้ได้เปิดรันบอททองคำ <strong className="text-amber-200">({portStatus?.asset_type || 'GOLD'} - {portStatus?.system_code || 'EasyGold'} {portStatus?.ea_version})</strong>
                            </p>
                            <p className="text-[10px] text-amber-400/90 pt-1 border-t border-amber-500/20">
                                💡 ระบบหน้าฟาร์มจะแสดงภาพฟาร์มเป็นทองคำตามข้อมูลจริงที่ MT5 ส่งมา และแดชบอร์ด EasyM ได้แยกพอร์ตนี้ออกจากผลรวมกำไรคู่เงินเรียบร้อยแล้ว
                            </p>
                        </div>
                    )}

                    {/* 2. Detailed Diagnostic Matrix */}
                    <div className="space-y-2 bg-black/40 border border-amber-500/15 rounded-xl p-3">
                        {/* Check 1: Telemetry Sync Time */}
                        <div className="flex items-center justify-between py-1 border-b border-white/5">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>ซิงค์ข้อมูลล่าสุด:</span>
                            </span>
                            <span className="font-mono text-right">
                                {lastActiveMs > 0 ? (
                                    <span className={isLive ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                                        {relativeTimeStr} {isLive ? '(สด)' : '(เริ่มล่าช้า)'}
                                    </span>
                                ) : (
                                    <span className="text-rose-400">ยังไม่เคยมีสัญญาณ</span>
                                )}
                            </span>
                        </div>

                        {/* Check 2: WebRequest 2 Status */}
                        <div className="flex items-center justify-between py-1 border-b border-white/5">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                                <Server className="w-3.5 h-3.5 text-amber-400" />
                                <span>ตั้งค่า WebRequest ที่ 2:</span>
                            </span>
                            <span className="font-mono font-medium">
                                {hasWebRequest2 ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] px-1.5 py-0 h-4">
                                        ✅ ตั้งค่าแล้ว (Active)
                                    </Badge>
                                ) : (
                                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] px-1.5 py-0 h-4">
                                        ⚠️ ยังไม่ได้ตั้งค่า (Missing)
                                    </Badge>
                                )}
                            </span>
                        </div>

                        {/* Check 3: Active Orders in System */}
                        <div className="flex items-center justify-between py-1 border-b border-white/5">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-amber-400" />
                                <span>คำสั่งซื้อขายสด (Orders):</span>
                            </span>
                            <span className="font-mono font-semibold">
                                {ordersCount > 0 ? (
                                    <span className="text-emerald-400">{ordersCount} ไม้ (พร้อมวาดต้นไม้)</span>
                                ) : (
                                    <span className="text-muted-foreground">0 ไม้ (ไม่มีออเดอร์ค้าง)</span>
                                )}
                            </span>
                        </div>

                        {/* Check 4: Capital Requirement */}
                        <div className="flex items-center justify-between py-1 border-b border-white/5">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                                <span className="text-amber-400 font-bold">$</span>
                                <span>ทุนขั้นต่ำบอท ({requiredBalanceUSC.toLocaleString()} USC):</span>
                            </span>
                            <span className="font-mono font-semibold">
                                {hasEnoughCapital ? (
                                    <span className="text-emerald-400">
                                        ✅ {balUSC.toLocaleString()} USC (ผ่าน)
                                    </span>
                                ) : (
                                    <span className="text-rose-400">
                                        ❌ {balUSC.toLocaleString()} USC (ขาด {(requiredBalanceUSC - balUSC).toLocaleString()})
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Check 5: License Authorization */}
                        <div className="flex items-center justify-between py-1">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                <span>สถานะสิทธิ์ (License):</span>
                            </span>
                            <span className="font-mono font-medium">
                                {isLicenseActive ? (
                                    <span className="text-emerald-400">✅ ได้รับอนุญาต (Active)</span>
                                ) : (
                                    <span className="text-rose-400">❌ ระงับสิทธิ์ (Inactive)</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* WebRequest 2 Guide Box (if missing) */}
                    {!hasWebRequest2 && (
                        <div className="bg-black/60 border border-amber-500/30 rounded-lg p-2.5 text-[11px] text-amber-200/90 space-y-1">
                            <div className="font-bold flex items-center gap-1 text-amber-300">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                                <span>วิธีแก้ให้หน้าฟาร์มแสดงผลครบ:</span>
                            </div>
                            <p className="leading-relaxed">
                                เพิ่ม URL ที่ 2 ใน MT5 ของลูกค้ารายนี้:
                                <code className="block my-1 px-1.5 py-0.5 bg-black rounded text-[10px] text-emerald-300 select-all font-mono">
                                    https://mfrspvzxmpksqnzcrysz.supabase.co
                                </code>
                                เมนู: Tools &gt; Options &gt; Expert Advisors &gt; เพิ่มใน Allow WebRequest
                            </p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                        <span>เวลา MT5: {portStatus?.server_time || '-'}</span>
                        <span className="font-mono">EA Ver: {portStatus?.ea_version || 'v1.16'}</span>
                    </div>
                </div>
            )}
        </aside>
    );
}
