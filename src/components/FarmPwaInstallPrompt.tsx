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

    // Compute dynamic App Name: e.g. Farm3088, Farm2434, FarmDemo
    const cleanPort = String(portNumber || '').trim();
    const isDemo = !cleanPort || cleanPort.toLowerCase() === 'demo';
    const last4 = !isDemo ? (cleanPort.length > 4 ? cleanPort.slice(-4) : cleanPort) : 'Demo';
    const appName = `Farm${last4}`;

    useEffect(() => {
        setMounted(true);

        // Update document title, apple-mobile-web-app-title and manifest link dynamically
        if (typeof document !== 'undefined') {
            document.title = appName;

            let metaApple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (!metaApple) {
                metaApple = document.createElement('meta');
                metaApple.setAttribute('name', 'apple-mobile-web-app-title');
                document.head.appendChild(metaApple);
            }
            metaApple.setAttribute('content', appName);

            let metaApp = document.querySelector('meta[name="application-name"]');
            if (!metaApp) {
                metaApp = document.createElement('meta');
                metaApp.setAttribute('name', 'application-name');
                document.head.appendChild(metaApp);
            }
            metaApp.setAttribute('content', appName);

            let linkApple = document.querySelector('link[rel="apple-touch-icon"]');
            if (!linkApple) {
                linkApple = document.createElement('link');
                linkApple.setAttribute('rel', 'apple-touch-icon');
                document.head.appendChild(linkApple);
            }
            linkApple.setAttribute('href', '/farm/farm_apple_touch_icon.png');

            let linkManifest = document.querySelector('link[rel="manifest"]');
            const manifestUrl = `/api/farm-manifest?port=${cleanPort || 'demo'}`;
            if (!linkManifest) {
                linkManifest = document.createElement('link');
                linkManifest.setAttribute('rel', 'manifest');
                document.head.appendChild(linkManifest);
            }
            linkManifest.setAttribute('href', manifestUrl);
        }

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
            if (cleanPort) {
                localStorage.removeItem(`dismiss_farm_pwa_install_${cleanPort}`);
            }

            const searchParams = new URLSearchParams(window.location.search);
            const forceShow = searchParams.has('install') || searchParams.has('pwa');

            const storageKey = `dismiss_farm_pwa_install_${cleanPort || 'default'}`;
            const isSessionDismissed = sessionStorage.getItem(storageKey);
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
    }, [appName, cleanPort]);

    const handleDismiss = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsDismissed(true);
        try {
            const storageKey = `dismiss_farm_pwa_install_${cleanPort || 'default'}`;
            sessionStorage.setItem(storageKey, 'true');
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

            {/* 📲 PWA Installation Guide Modal: Floating in center/upper area, compact, not full width */}
            {isModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="w-[90vw] max-w-[340px] bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 border border-amber-500/40 rounded-2xl p-4 text-stone-100 shadow-[0_10px_35px_rgba(0,0,0,0.9)] relative animate-in zoom-in-95 duration-200 select-none"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-3 right-3 p-1 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* App Icon & Title */}
                        <div className="flex items-center gap-3 mb-3.5 pr-6">
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden ring-1 ring-amber-400/50 shadow-md bg-stone-950 shrink-0">
                                <Image
                                    src="/farm/farm_icon_192.png"
                                    alt={appName}
                                    fill
                                    className="object-contain p-0.5"
                                    unoptimized
                                />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="font-extrabold text-sm sm:text-base text-amber-200">
                                        {appName}
                                    </h3>
                                    {!isDemo && (
                                        <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1 rounded">
                                            #{cleanPort}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">
                                    สร้างทางลัดเข้าฟาร์มบนหน้าจอมือถือ
                                </p>
                            </div>
                        </div>

                        {/* In-App Browser Warning (LINE, TikTok, Facebook) */}
                        {isInApp && (
                            <div className="mb-2.5 p-2 rounded-lg bg-orange-950/40 border border-orange-500/30 text-[10px] text-orange-200 flex items-start gap-2">
                                <Smartphone className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-orange-300">เปิดอยู่ในแอป (LINE/TikTok)</p>
                                    <p className="text-[9.5px] text-orange-200/80">
                                        แตะ [⋯] แล้วเลือก "เปิดด้วยเบราว์เซอร์เริ่มต้น" ก่อนครับ
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step by Step Instructions */}
                        {isIOS ? (
                            /* iOS (iPhone / Safari) Guide */
                            <div className="space-y-2 mb-3.5 text-[11px] text-stone-200">
                                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                        1
                                    </div>
                                    <div className="flex-1 flex items-center justify-between">
                                        <span>แตะปุ่มแชร์ที่แถบล่าง Safari</span>
                                        <Share2 className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />
                                    </div>
                                </div>

                                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                        2
                                    </div>
                                    <div className="flex-1 flex items-center justify-between">
                                        <span>เลือก <strong className="text-amber-300">"เพิ่มไปยังหน้าจอโฮม"</strong></span>
                                        <PlusSquare className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                                    </div>
                                </div>

                                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                        3
                                    </div>
                                    <div className="flex-1">
                                        <span>แตะ <strong className="text-emerald-400 font-bold">"เพิ่ม" (Add)</strong> มุมบนขวา</span>
                                        <span className="block text-[9.5px] text-amber-300/80 font-mono mt-0.5">ชื่อแอป: {appName}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Android (Chrome) / Others Guide */
                            <div className="space-y-2 mb-3.5 text-[11px] text-stone-200">
                                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                        1
                                    </div>
                                    <div className="flex-1 flex items-center justify-between">
                                        <span>แตะจุด 3 จุด [⋮] มุมบนขวา</span>
                                        <MoreVertical className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />
                                    </div>
                                </div>

                                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                                        2
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span>เลือก <strong className="text-amber-300">"เพิ่มลงในหน้าจอหลัก"</strong></span>
                                            <Download className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                                        </div>
                                        <span className="block text-[9.5px] text-amber-300/80 font-mono mt-0.5">ชื่อแอป: {appName}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Confirmation Button */}
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-bold text-xs tracking-wide shadow-md shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>เข้าใจแล้ว (ปิดหน้าต่าง)</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
