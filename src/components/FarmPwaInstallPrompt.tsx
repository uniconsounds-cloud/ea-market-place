'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, X, Share2, PlusSquare, MoreVertical, Smartphone, Check } from 'lucide-react';

interface FarmPwaInstallPromptProps {
    portNumber?: string;
}

export default function FarmPwaInstallPrompt({ portNumber }: FarmPwaInstallPromptProps) {
    const [mounted, setMounted] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isDismissed, setIsDismissed] = useState(true); // default true until checked
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInApp, setIsInApp] = useState(false);

    useEffect(() => {
        setMounted(true);

        // 1. Check if running in standalone mode (already installed PWA)
        const checkStandalone = 
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true ||
            document.referrer.includes('android-app://');

        setIsStandalone(checkStandalone);
        if (checkStandalone) return;

        // 2. Check dismissal (session-only so user can test and re-open anytime)
        try {
            // Clear legacy 7-day localStorage key if present
            localStorage.removeItem('dismiss_farm_pwa_install');

            const searchParams = new URLSearchParams(window.location.search);
            const forceShow = searchParams.has('install') || searchParams.has('pwa');

            const isSessionDismissed = sessionStorage.getItem('dismiss_farm_pwa_install');
            if (!forceShow && isSessionDismissed) {
                setIsDismissed(true);
            } else {
                setIsDismissed(false);
            }
        } catch {
            setIsDismissed(false);
        }

        // 3. Detect iOS and In-App browsers
        const ua = window.navigator.userAgent || '';
        const iosCheck = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        const inAppCheck = /Line|FBAN|FBAV|Instagram|TikTok|MicroMessenger/i.test(ua);

        setIsIOS(iosCheck);
        setIsInApp(inAppCheck);

        // 4. Capture beforeinstallprompt for Android / Chrome
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsDismissed(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleDismiss = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsDismissed(true);
        try {
            sessionStorage.setItem('dismiss_farm_pwa_install', 'true');
        } catch {}
    };

    const handleInstallClick = async () => {
        // If Android with native install prompt ready
        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    setIsDismissed(true);
                    setDeferredPrompt(null);
                    return;
                }
            } catch (err) {
                console.warn('Install prompt error:', err);
            }
        }

        // Otherwise (iOS, or Android without prompt, or in-app browser), open visual guide modal
        setIsModalOpen(true);
    };

    if (!mounted || isStandalone || isDismissed) {
        return null;
    }

    return (
        <>
            {/* 🌟 Floating Pill Button: Positioned at top between Port HUD and Farm Canvas */}
            <div className="fixed top-[188px] sm:top-[146px] left-1/2 -translate-x-1/2 z-40 select-none animate-in fade-in slide-in-from-top-4 duration-500 max-w-[92vw]">
                <div 
                    onClick={handleInstallClick}
                    className="flex items-center gap-2.5 px-3.5 py-1.5 sm:py-2 rounded-full bg-stone-950/90 hover:bg-stone-900 active:scale-95 transition-all duration-200 border border-amber-500/50 shadow-[0_4px_20px_rgba(0,0,0,0.85)] shadow-amber-950/30 backdrop-blur-md cursor-pointer group"
                    title="สร้างทางลัดแอปฟาร์มลงหน้าจอมือถือ"
                >
                    {/* 3D Floating Island Icon */}
                    <div className="relative w-6 h-6 shrink-0 rounded-md overflow-hidden ring-1 ring-amber-400/50 shadow-sm bg-stone-900 flex items-center justify-center">
                        <Image 
                            src="/farm/farm_icon_192.png" 
                            alt="EasyM Farm Icon" 
                            width={24} 
                            height={24}
                            className="object-contain group-hover:scale-110 transition-transform" 
                            unoptimized 
                        />
                    </div>

                    {/* Button Text */}
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-xs sm:text-sm font-bold text-amber-200 group-hover:text-amber-100 flex items-center gap-1">
                            <span>📲</span>
                            <span>ติดตั้งแอปฟาร์ม</span>
                        </span>
                        <span className="text-[10px] text-amber-400/60 hidden sm:inline font-normal">
                            (ลงหน้าจอมือถือ)
                        </span>
                    </div>

                    {/* Close / Dismiss 'X' Button */}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="ml-1 p-1 rounded-full text-stone-400 hover:text-stone-200 hover:bg-white/10 active:scale-90 transition-colors"
                        title="ซ่อนปุ่มนี้"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* 📲 PWA Installation Guide Modal (Especially for iOS Safari & In-App browsers) */}
            {isModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="w-full sm:max-w-md bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 text-stone-100 shadow-2xl relative animate-in slide-in-from-bottom-8 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header bar indicator for mobile bottom sheet */}
                        <div className="w-12 h-1 bg-stone-700 rounded-full mx-auto mb-4 sm:hidden" />

                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* App Icon & Title */}
                        <div className="flex items-center gap-3.5 mb-5">
                            <div className="relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/40 bg-stone-950 shrink-0">
                                <Image
                                    src="/farm/farm_icon_512.png"
                                    alt="EasyM Farm"
                                    fill
                                    className="object-contain p-1"
                                    unoptimized
                                />
                            </div>
                            <div>
                                <h3 className="font-bold text-base sm:text-lg text-amber-200 flex items-center gap-1.5">
                                    <span>EasyM Farm</span>
                                    {portNumber && (
                                        <span className="text-xs font-mono text-amber-400/80 font-normal">
                                            #{portNumber}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    สร้างทางลัดเข้าดูฟาร์มแบบเต็มจอ (เหมือนแอปจริง)
                                </p>
                            </div>
                        </div>

                        {/* In-App Browser Warning (LINE, TikTok, Facebook) */}
                        {isInApp && (
                            <div className="mb-4 p-3 rounded-xl bg-orange-950/40 border border-orange-500/30 text-xs text-orange-200 flex items-start gap-2.5">
                                <Smartphone className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-orange-300">เปิดอยู่ในแอปภายนอก (เช่น LINE / TikTok)</p>
                                    <p className="text-[11px] text-orange-200/80 mt-0.5">
                                        กรุณาแตะปุ่มจุดสามจุด <span className="font-mono font-bold">[⋯]</span> แล้วเลือก <span className="font-bold underline">"เปิดด้วยเบราว์เซอร์เริ่มต้น" (Open in Safari/Chrome)</span> ก่อน จึงจะสามารถเพิ่มลงหน้าจอโฮมได้ครับ
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step by Step Instructions */}
                        {isIOS ? (
                            /* iOS (iPhone / Safari) Guide */
                            <div className="space-y-3 mb-6 text-xs text-stone-200">
                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0">
                                        1
                                    </div>
                                    <div className="flex-1">
                                        <p>แตะปุ่มแชร์ที่แถบล่างของ Safari</p>
                                        <div className="flex items-center gap-1.5 text-sky-300 font-semibold mt-0.5">
                                            <Share2 className="w-3.5 h-3.5" />
                                            <span>ปุ่มแชร์รูปสี่เหลี่ยมลูกศรชี้ขึ้น</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                                        2
                                    </div>
                                    <div className="flex-1">
                                        <p>เลื่อนลงมาและแตะเมนู</p>
                                        <div className="flex items-center gap-1.5 text-amber-300 font-semibold mt-0.5">
                                            <PlusSquare className="w-3.5 h-3.5" />
                                            <span>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                                        3
                                    </div>
                                    <div className="flex-1">
                                        <p>แตะปุ่ม <strong className="text-emerald-400 font-bold">"เพิ่ม" (Add)</strong> ที่มุมบนขวา</p>
                                        <span className="text-[11px] text-muted-foreground">ไอคอนเกาะฟาร์มจะไปปรากฏบนหน้าจอ iPhone ทันที</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Android (Chrome) / Others Guide */
                            <div className="space-y-3 mb-6 text-xs text-stone-200">
                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0">
                                        1
                                    </div>
                                    <div className="flex-1">
                                        <p>แตะจุด 3 จุดที่มุมบนขวาของ Chrome</p>
                                        <div className="flex items-center gap-1.5 text-sky-300 font-semibold mt-0.5">
                                            <MoreVertical className="w-3.5 h-3.5" />
                                            <span>เมนูการตั้งค่าเบราว์เซอร์</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                                        2
                                    </div>
                                    <div className="flex-1">
                                        <p>เลือกเมนู</p>
                                        <div className="flex items-center gap-1.5 text-amber-300 font-semibold mt-0.5">
                                            <Download className="w-3.5 h-3.5" />
                                            <span>"ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Confirmation Button */}
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            <span>เข้าใจแล้ว (ปิดหน้าต่าง)</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
