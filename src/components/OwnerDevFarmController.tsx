'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    GripHorizontal, 
    Sparkles, 
    Eye, 
    Lock, 
    X, 
    Send,
    RotateCcw,
    Zap,
    Sliders,
    ShieldAlert,
    ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export interface OwnerDevFarmControllerProps {
    isOwnerTestPort: boolean;
    portNumber: string;
    systemCode: string;
    previewMode: 'dev' | 'customer';
    onTogglePreviewMode: (mode: 'dev' | 'customer') => void;
    isGlobalPrimeReleased: boolean;
    onUpdateGlobalRelease: (released: boolean) => Promise<void>;
    isPhase2Released: boolean;
    onUpdatePhase2Release: (released: boolean) => Promise<void>;
    simulatedBuffer: number | null;
    onSetSimulatedBuffer: (val: number | null) => void;
    actualBufferPct: number;
    recommendedBuffer: number;
    actualRecommendedBuffer: number;
    simulatedThreshold: number | null;
    onSetSimulatedThreshold: (val: number | null) => void;
}

export default function OwnerDevFarmController({
    isOwnerTestPort,
    portNumber,
    systemCode,
    previewMode,
    onTogglePreviewMode,
    isGlobalPrimeReleased,
    onUpdateGlobalRelease,
    isPhase2Released,
    onUpdatePhase2Release,
    simulatedBuffer,
    onSetSimulatedBuffer,
    actualBufferPct,
    recommendedBuffer,
    actualRecommendedBuffer,
    simulatedThreshold,
    onSetSimulatedThreshold
}: OwnerDevFarmControllerProps) {
    // 🛡️ STRICT SAFETY GUARD: Never render anything for customers
    if (!isOwnerTestPort) return null;

    // Start collapsed as a small "Dev" circle by default to not obstruct mobile screen
    const [isOpen, setIsOpen] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'phase2' | 'global' | null>(null);

    // Draggable position state
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('owner_dev_controller_pos');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    return parsed;
                } catch (e) {}
            }
            return { x: Math.max(10, window.innerWidth - 65), y: 130 };
        }
        return { x: 20, y: 130 };
    });

    const isDraggingRef = useRef(false);
    const hasDraggedRef = useRef(false);
    const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
        mouseX: 0,
        mouseY: 0,
        startX: 0,
        startY: 0
    });

    // Handle Dragging via Mouse
    const handleMouseDown = (e: React.MouseEvent) => {
        hasDraggedRef.current = false;
        isDraggingRef.current = true;
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            startX: position.x,
            startY: position.y
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
            const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;

            if (Math.hypot(deltaX, deltaY) > 5) {
                hasDraggedRef.current = true;
            }

            const newX = Math.max(10, Math.min(window.innerWidth - 60, dragStartRef.current.startX + deltaX));
            const newY = Math.max(60, Math.min(window.innerHeight - 60, dragStartRef.current.startY + deltaY));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            localStorage.setItem('owner_dev_controller_pos', JSON.stringify(position));
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Touch support for mobile / tablet testing
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        hasDraggedRef.current = false;
        isDraggingRef.current = true;
        dragStartRef.current = {
            mouseX: touch.clientX,
            mouseY: touch.clientY,
            startX: position.x,
            startY: position.y
        };

        const handleTouchMove = (moveEvent: TouchEvent) => {
            if (!isDraggingRef.current || moveEvent.touches.length !== 1) return;
            const t = moveEvent.touches[0];
            const deltaX = t.clientX - dragStartRef.current.mouseX;
            const deltaY = t.clientY - dragStartRef.current.mouseY;

            if (Math.hypot(deltaX, deltaY) > 5) {
                hasDraggedRef.current = true;
            }

            const newX = Math.max(10, Math.min(window.innerWidth - 60, dragStartRef.current.startX + deltaX));
            const newY = Math.max(60, Math.min(window.innerHeight - 60, dragStartRef.current.startY + deltaY));

            setPosition({ x: newX, y: newY });
        };

        const handleTouchEnd = () => {
            isDraggingRef.current = false;
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            localStorage.setItem('owner_dev_controller_pos', JSON.stringify(position));
        };

        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);
    };

    const handleCircleClick = () => {
        // Only toggle if not dragged
        if (!hasDraggedRef.current) {
            setIsOpen(true);
        }
    };

    const handleConfirmToggleRelease = async () => {
        setIsPublishing(true);
        try {
            if (confirmAction === 'phase2') {
                const nextState = !isPhase2Released;
                await onUpdatePhase2Release(nextState);
                toast.success(
                    nextState 
                        ? '🚀 ปล่อยไซโลเสบียงแก้วและเขื่อนพลังงานให้ลูกค้าจริงเห็นแล้วเรียบร้อย!' 
                        : '🔒 ดึงไซโลและเขื่อนกลับเข้าสู่โหมดพัฒนาแล้ว (ลูกค้าเห็นเวอร์ชั่นก่อนหน้า)'
                );
            } else if (confirmAction === 'global') {
                const nextState = !isGlobalPrimeReleased;
                await onUpdateGlobalRelease(nextState);
                toast.success(
                    nextState 
                        ? '🚀 ปล่อยหน้าฟาร์ม Prime ให้ลูกค้าจริงเห็นแล้วเรียบร้อย!' 
                        : '🔒 ดึงกลับเข้าสู่โหมดส่วนตัวเรียบร้อยแล้ว (ลูกค้าเห็นหน้าคลาสสิกเดิม)'
                );
            }
            setConfirmAction(null);
        } catch (err: any) {
            toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'Error'));
        } finally {
            setIsPublishing(false);
        }
    };

    const currentBufferVal = simulatedBuffer !== null ? simulatedBuffer : actualBufferPct;
    const isCurrentBufferSafe = currentBufferVal >= recommendedBuffer;

    // Calculate clamped position for expanded modal to prevent overflowing viewport on mobile
    const panelWidth = typeof window !== 'undefined' ? Math.min(310, window.innerWidth - 20) : 310;
    const clampedX = typeof window !== 'undefined' 
        ? Math.max(10, Math.min(window.innerWidth - panelWidth - 10, position.x)) 
        : position.x;
    const clampedY = typeof window !== 'undefined' 
        ? Math.max(50, Math.min(window.innerHeight - 450, position.y)) 
        : position.y;

    return (
        <>
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🔴 STATE 1: COMPACT "Dev" CIRCLE (DEFAULT)                       */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {!isOpen && (
                <div 
                    style={{ left: `${position.x}px`, top: `${position.y}px` }}
                    className="fixed z-[999999] select-none pointer-events-auto"
                >
                    <button
                        type="button"
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        onClick={handleCircleClick}
                        className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/25 via-[#120f0a]/95 to-amber-950/90 border-2 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5),inset_0_0_10px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.8)] hover:scale-110 active:scale-95 transition-all duration-200 backdrop-blur-xl cursor-grab active:cursor-grabbing"
                        title="👑 Owner Dev Menu (คลิกเพื่อเปิดเมนู / ลากเพื่อย้ายที่)"
                    >
                        {/* Text "Dev" */}
                        <span className="font-mono font-black text-xs tracking-wider text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] group-hover:text-amber-100">
                            Dev
                        </span>

                        {/* Status Pulse Dot */}
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                            {simulatedBuffer !== null ? (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 border border-black/80" />
                                </>
                            ) : isPhase2Released ? (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-black/80" />
                                </>
                            ) : (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-black/80" />
                                </>
                            )}
                        </span>
                    </button>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🟢 STATE 2: EXPANDED DEV DOCK PANEL (OPENS ON CLICK)             */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {isOpen && (
                <div 
                    style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
                    className="fixed z-[999999] select-none transition-shadow animate-fade-in"
                >
                    <div className="relative w-[290px] sm:w-[315px] max-w-[calc(100vw-20px)] max-h-[85vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#14120e]/98 via-[#0d0c0a]/98 to-[#080705]/98 border-2 border-amber-500/80 shadow-[0_15px_40px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.35)] backdrop-blur-2xl text-amber-100 overflow-hidden font-sans">
                        
                        {/* Draggable Header */}
                        <div 
                            onMouseDown={handleMouseDown}
                            onTouchStart={handleTouchStart}
                            className="px-3 py-2 bg-gradient-to-r from-amber-500/25 via-amber-600/20 to-orange-500/25 border-b border-amber-500/40 flex items-center justify-between cursor-grab active:cursor-grabbing hover:bg-amber-500/30 transition-colors shrink-0"
                            title="คลิกค้างเพื่อลากย้ายตำแหน่ง"
                        >
                            <div className="flex items-center gap-2">
                                <GripHorizontal className="w-4 h-4 text-amber-400 opacity-80" />
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span className="text-[11px] font-black tracking-wider uppercase text-amber-200">
                                        OWNER DEV DOCK
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-[9px] font-mono font-bold text-amber-300">
                                    PORT {portNumber}
                                </span>
                                {/* Close button: Collapses back to "Dev" circle */}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-lg hover:bg-white/15 text-amber-300 hover:text-white transition-colors cursor-pointer"
                                    title="ย่อกลับเป็นปุ่มวงกลม Dev"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Controller Content */}
                        <div className="p-3 space-y-3 text-xs overflow-y-auto max-h-[calc(85vh-50px)] scrollbar-thin">
                            
                            {/* Section 1: Real-time View Switcher */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-bold text-amber-300/80 uppercase">
                                    <span>สลับมุมมองหน้าฟาร์ม (Preview)</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-1.5 bg-black/60 p-1 rounded-xl border border-amber-500/30">
                                    <button
                                        type="button"
                                        onClick={() => onTogglePreviewMode('dev')}
                                        className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                            previewMode === 'dev'
                                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] font-black'
                                                : 'text-amber-300/70 hover:text-amber-200 hover:bg-white/5'
                                        }`}
                                    >
                                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                        <span>โหมดพัฒนา (Dev)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onTogglePreviewMode('customer')}
                                        className={`py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                            previewMode === 'customer'
                                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)] font-black'
                                                : 'text-cyan-300/70 hover:text-cyan-200 hover:bg-white/5'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5 shrink-0" />
                                        <span>มุมมองลูกค้า</span>
                                    </button>
                                </div>

                                <p className="text-[10px] text-amber-200/70 leading-tight">
                                    {previewMode === 'dev' 
                                        ? '🧪 กำลังแสดงไซโล + เขื่อนพลังงาน + โดมตำแหน่งใหม่ เฉพาะคุณ'
                                        : '👁️ กำลังจำลองหน้าฟาร์มแบบที่ลูกค้าทั่วไปมองเห็น (เวอร์ชั่นก่อนหน้า)'
                                    }
                                </p>
                            </div>

                            {/* 🧪 Section 2: Buffer Aura Testing Slider (บาร์เลื่อนจำลองค่าบัฟเฟอร์ & แก้เกณฑ์ & ปุ่มยกเลิก) */}
                            <div className="pt-2 border-t border-amber-500/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Sliders className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="text-[10px] font-bold text-amber-300/80 uppercase">
                                            ทดสอบรัศมีบัฟเฟอร์ (Buffer Aura)
                                        </span>
                                    </div>
                                    {simulatedBuffer !== null || simulatedThreshold !== null ? (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[9px] font-mono font-black text-amber-300 animate-pulse flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            SIMULATED
                                        </span>
                                    ) : (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-mono font-bold text-emerald-300 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                            LIVE
                                        </span>
                                    )}
                                </div>

                                {/* Quick State Switcher (1-Tap Test Safe vs Low Buffer Alert) */}
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const targetSafe = Math.max(60, recommendedBuffer + 25);
                                            onSetSimulatedBuffer(targetSafe);
                                            toast.success(`จำลองสภาวะปลอดภัย: ${targetSafe}% (สูงกว่าเกณฑ์ ${recommendedBuffer}%)`);
                                        }}
                                        className={`py-1.5 px-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                            isCurrentBufferSafe
                                                ? 'bg-emerald-500/25 border-emerald-400/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                                                : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>🛡️ ทดสอบ: ปลอดภัย</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const targetAlert = Math.max(0, Math.min(8, Math.round(recommendedBuffer * 0.4)));
                                            onSetSimulatedBuffer(targetAlert);
                                            toast.warning(`จำลองสภาวะต่ำกว่าเกณฑ์: ${targetAlert}% (ต่ำกว่าเกณฑ์ ${recommendedBuffer}%)`);
                                        }}
                                        className={`py-1.5 px-2 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                                            !isCurrentBufferSafe
                                                ? 'bg-rose-500/30 border-rose-400/90 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.4)] animate-pulse'
                                                : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                                        <span>⚠️ ต่ำกว่าเกณฑ์เตือนภัย</span>
                                    </button>
                                </div>

                                {/* Slider & Control Box */}
                                <div className="p-2.5 rounded-xl bg-black/60 border border-amber-500/30 space-y-2.5">
                                    {/* Value & Status row */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-[9px] text-white/50 font-mono uppercase">
                                                {simulatedBuffer !== null ? 'ค่าบัฟเฟอร์จำลอง' : 'ค่าบัฟเฟอร์จริง'}
                                            </div>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className={`text-base font-black font-mono ${
                                                    isCurrentBufferSafe ? 'text-emerald-400' : 'text-rose-400'
                                                }`}>
                                                    {currentBufferVal >= 0 ? '+' : ''}{currentBufferVal.toFixed(1)}%
                                                </span>
                                                <span className="text-[10px] text-white/40 font-mono">
                                                    (เกณฑ์ ≥ {recommendedBuffer}%)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Aura Shield Status Pill */}
                                        <div className={`px-2 py-1 rounded-lg border text-[9px] font-bold flex items-center gap-1 ${
                                            isCurrentBufferSafe 
                                                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' 
                                                : (currentBufferVal <= 0
                                                    ? 'bg-black/95 border-red-600/90 text-red-400 shadow-[0_0_12px_rgba(220,38,38,0.5)] animate-pulse'
                                                    : 'bg-rose-950/70 border-rose-500/70 text-rose-300 animate-pulse')
                                        }`}>
                                            {isCurrentBufferSafe ? (
                                                <>
                                                    <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                                    <span>หนาฟู ปลอดภัย</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldAlert className={`w-3 h-3 shrink-0 ${currentBufferVal <= 0 ? 'text-red-500 animate-ping' : 'text-rose-400 animate-bounce'}`} />
                                                    <span>{currentBufferVal <= 0 ? 'หมดเกราะ วิกฤต' : 'บางเฉียบ เตือนภัย'}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Range Slider for Capital Buffer */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-amber-200/80">
                                            <span>เลื่อนปรับบัฟเฟอร์ (Capital Buffer %):</span>
                                            <span className="font-mono text-amber-300">{Math.round(currentBufferVal)}%</span>
                                        </div>
                                        <input 
                                            type="range"
                                            min="0"
                                            max="120"
                                            step="1"
                                            value={Math.round(currentBufferVal)}
                                            onChange={(e) => onSetSimulatedBuffer(Number(e.target.value))}
                                            className="w-full h-2 bg-gradient-to-r from-rose-600 via-amber-400 to-emerald-400 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300"
                                        />
                                        <div className="flex justify-between text-[8px] font-mono text-white/40 px-0.5">
                                            <span>0% (เกราะบางสุด)</span>
                                            <span className="text-amber-300/80 font-bold">เกณฑ์ {recommendedBuffer}%</span>
                                            <span>120% (หนาสุด)</span>
                                        </div>
                                    </div>

                                    {/* Quick Buffer Presets */}
                                    <div className="grid grid-cols-4 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onSetSimulatedBuffer(0)}
                                            className={`py-1 px-1 rounded text-[9px] font-mono font-bold text-center transition-all cursor-pointer ${
                                                currentBufferVal <= 0
                                                    ? 'bg-red-950/90 text-red-300 border-2 border-red-500 shadow-[0_0_12px_rgba(220,38,38,0.6)] ring-1 ring-red-400'
                                                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                                            }`}
                                            title="ทดสอบ 0% (บางสุด เตือนภัยวิกฤต)"
                                        >
                                            0% (วิกฤต)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onSetSimulatedBuffer(Math.max(2, Math.round(recommendedBuffer * 0.4)))}
                                            className={`py-1 px-1 rounded text-[9px] font-mono font-bold text-center transition-all cursor-pointer ${
                                                currentBufferVal > 0 && currentBufferVal < recommendedBuffer
                                                    ? 'bg-amber-500/30 text-amber-200 border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)] ring-1 ring-amber-300'
                                                    : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30'
                                            }`}
                                            title={`ทดสอบ ${Math.max(2, Math.round(recommendedBuffer * 0.4))}% (ต่ำกว่าเกณฑ์เตือนภัย)`}
                                        >
                                            {Math.max(2, Math.round(recommendedBuffer * 0.4))}% (เตือน)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onSetSimulatedBuffer(recommendedBuffer)}
                                            className={`py-1 px-1 rounded text-[9px] font-mono font-bold text-center transition-all cursor-pointer ${
                                                Math.round(currentBufferVal) === recommendedBuffer
                                                    ? 'bg-emerald-500/30 text-emerald-200 border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)] ring-1 ring-emerald-300'
                                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                                            }`}
                                            title={`ทดสอบ ${recommendedBuffer}% (พอดีเกณฑ์)`}
                                        >
                                            {recommendedBuffer}% (เกณฑ์)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onSetSimulatedBuffer(80)}
                                            className={`py-1 px-1 rounded text-[9px] font-mono font-bold text-center transition-all cursor-pointer ${
                                                currentBufferVal >= 80
                                                    ? 'bg-cyan-500/30 text-cyan-200 border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)] ring-1 ring-cyan-300'
                                                    : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30'
                                            }`}
                                            title="ทดสอบ 80% (หนาฟู ปลอดภัย)"
                                        >
                                            80% (หนาฟู)
                                        </button>
                                    </div>

                                    {/* 🎯 EDITABLE BUFFER THRESHOLD CONTROL (ให้แก้ค่าเกณฑ์ของบัฟเฟอร์ได้ด้วยในแบบจำลอง) */}
                                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                                        <div className="flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-1.5 text-white/80">
                                                <span className="font-bold">🎯 เกณฑ์บัฟเฟอร์ (Threshold):</span>
                                                <span className={`font-mono font-black ${
                                                    simulatedThreshold !== null ? 'text-amber-300' : 'text-emerald-300'
                                                }`}>
                                                    {recommendedBuffer}%
                                                </span>
                                                {simulatedThreshold !== null && (
                                                    <span className="text-[7px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-300 font-mono">
                                                        CUSTOM
                                                    </span>
                                                )}
                                            </div>
                                            {simulatedThreshold !== null && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSetSimulatedThreshold(null);
                                                        toast.info(`คืนค่าเกณฑ์อัตโนมัติแล้ว (${actualRecommendedBuffer}%)`);
                                                    }}
                                                    className="text-[9px] font-mono text-amber-400 hover:text-amber-200 underline cursor-pointer"
                                                    title="คืนค่าเกณฑ์อัตโนมัติที่คำนวณจาก DD"
                                                >
                                                    ↺ อัตโนมัติ ({actualRecommendedBuffer}%)
                                                </button>
                                            )}
                                        </div>

                                        <input 
                                            type="range"
                                            min="10"
                                            max="80"
                                            step="5"
                                            value={recommendedBuffer}
                                            onChange={(e) => onSetSimulatedThreshold(Number(e.target.value))}
                                            className="w-full h-1.5 bg-gradient-to-r from-emerald-600 via-amber-500 to-rose-600 rounded-lg appearance-none cursor-pointer accent-amber-400"
                                        />

                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] text-white/40 shrink-0">ลัดเกณฑ์:</span>
                                            {[15, 20, 30, 40, 50].map((th) => (
                                                <button
                                                    key={th}
                                                    type="button"
                                                    onClick={() => onSetSimulatedThreshold(th)}
                                                    className={`flex-1 py-0.5 rounded text-[8px] font-mono font-bold border transition-colors cursor-pointer ${
                                                        recommendedBuffer === th
                                                            ? 'bg-amber-500/30 border-amber-400 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.4)]'
                                                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                                                    }`}
                                                >
                                                    {th}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cancel All Simulations Button (ปุ่มยกเลิกค่าจำลองทั้งหมดเพื่อแสดงค่าจริงจากพอร์ต) */}
                                    {simulatedBuffer !== null || simulatedThreshold !== null ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSetSimulatedBuffer(null);
                                                onSetSimulatedThreshold(null);
                                                toast.info(`ยกเลิกค่าจำลองทั้งหมดแล้ว แสดงค่าจริงจากพอร์ต (${actualBufferPct.toFixed(1)}%, เกณฑ์: ${actualRecommendedBuffer}%)`);
                                            }}
                                            className="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-stone-800 to-stone-900 hover:from-amber-950 hover:to-stone-900 border border-amber-400/60 text-amber-300 hover:text-amber-100 font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer"
                                        >
                                            <RotateCcw className="w-3 h-3 text-amber-400" />
                                            <span>ยกเลิกค่าจำลองทั้งหมด (คืนค่าจริงจากพอร์ต)</span>
                                        </button>
                                    ) : (
                                        <div className="text-[9px] text-center text-emerald-400/80 font-mono py-0.5">
                                            ✓ กำลังแสดงค่าจริงจากพอร์ต (บัฟเฟอร์: {actualBufferPct.toFixed(1)}% / เกณฑ์: {actualRecommendedBuffer}%)
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 3: Phase 2 Release (ไซโลเสบียงแก้ว & เขื่อนพลังงาน) */}
                            <div className="pt-2 border-t border-amber-500/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-amber-300/80 uppercase">
                                        ไซโล & เขื่อนพลังงาน (Phase 2)
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                        isPhase2Released 
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' 
                                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                    }`}>
                                        {isPhase2Released ? (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                                PUBLIC LIVE
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-2.5 h-2.5" />
                                                DEV ONLY (เห็นคนเดียว)
                                            </>
                                        )}
                                    </span>
                                </div>

                                {/* Publish / Revert Button for Phase 2 */}
                                <button
                                    type="button"
                                    onClick={() => setConfirmAction('phase2')}
                                    disabled={isPublishing}
                                    className={`w-full py-2 px-3 rounded-xl font-black text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer active:scale-98 ${
                                        isPhase2Released
                                            ? 'bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 text-amber-300 border border-amber-500/40'
                                            : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                                    }`}
                                >
                                    {isPhase2Released ? (
                                        <>
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>ดึงไซโล & เขื่อนกลับเป็นโหมดพัฒนา</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>อัปเดตปล่อยไซโล & เขื่อนให้ลูกค้า</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Section 3: Master Gate (EasyM Prime รวม) */}
                            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white/60">Prime Master Gate:</span>
                                    <span className={`font-mono font-bold ${isGlobalPrimeReleased ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isGlobalPrimeReleased ? 'PUBLIC' : 'PRIVATE'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setConfirmAction('global')}
                                    className="text-[9px] font-bold text-amber-400 hover:text-amber-200 underline cursor-pointer"
                                >
                                    {isGlobalPrimeReleased ? 'ดึงกลับเป็นคลาสสิก' : 'เปิด Prime ทั้งระบบ'}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in pointer-events-auto">
                    <div className="relative w-full max-w-sm bg-gradient-to-b from-[#1c1206]/98 to-[#0a0602]/98 border-2 border-amber-500/90 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.4)] text-amber-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white">
                                    {confirmAction === 'phase2'
                                        ? (isPhase2Released ? 'ดึงไซโล & เขื่อนกลับเป็นโหมดพัฒนา' : 'ยืนยันปล่อยไซโล & เขื่อนให้ลูกค้า')
                                        : (isGlobalPrimeReleased ? 'ดึง Prime ทั้งระบบกลับสู่โหมดส่วนตัว' : 'ยืนยันปล่อย Prime ให้ลูกค้า')
                                    }
                                </h4>
                                <span className="text-[10px] text-amber-300/80 font-mono">
                                    {confirmAction === 'phase2' ? 'PHASE 2 RELEASE GATE' : 'MASTER RELEASE GATE'}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-amber-100/80 leading-relaxed mb-4">
                            {confirmAction === 'phase2' ? (
                                isPhase2Released
                                    ? 'คุณต้องการดึงไซโลและเขื่อนพลังงานกลับเข้าสู่โหมดพัฒนาหรือไม่? ลูกค้าจะกลับไปเห็นหน้าฟาร์มเวอร์ชั่นก่อนหน้า (ที่ไม่มีไซโล) ทันที'
                                    : 'คุณตรวจสอบการจัดวางไซโลและเขื่อนพลังงานบนมือถือและจอคอมพิวเตอร์จนพอใจแล้ว และต้องการปล่อยให้ลูกค้าจริงเห็นหน้าฟาร์มนี้พร้อมกันใช่หรือไม่?'
                            ) : (
                                isGlobalPrimeReleased
                                    ? 'คุณต้องการดึงหน้าฟาร์ม Prime ทั้งระบบกลับสู่โหมดส่วนตัวหรือไม่? ลูกค้าจริงจะกลับไปเห็นหน้าฟาร์มแบบคลาสสิกเดิมทันที'
                                    : 'คุณต้องการปล่อยหน้าฟาร์ม Prime ให้ลูกค้าจริงเห็นหน้าฟาร์มใหม่นี้พร้อมกันเลยใช่หรือไม่?'
                            )}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                className="py-2 rounded-xl bg-white/10 hover:bg-white/15 text-stone-300 font-bold text-xs transition-colors cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmToggleRelease}
                                disabled={isPublishing}
                                className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                                    (confirmAction === 'phase2' ? isPhase2Released : isGlobalPrimeReleased)
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                                }`}
                            >
                                {isPublishing ? 'กำลังบันทึก...' : ((confirmAction === 'phase2' ? isPhase2Released : isGlobalPrimeReleased) ? 'ดึงกลับทันที' : 'ยืนยันปล่อยใช้งาน')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
