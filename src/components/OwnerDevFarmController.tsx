'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    GripHorizontal, 
    Sparkles, 
    Eye, 
    Layers, 
    Lock, 
    Unlock, 
    Check, 
    X, 
    ChevronDown, 
    ChevronUp,
    Send,
    RotateCcw,
    Zap,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

export interface OwnerDevFarmControllerProps {
    isOwnerTestPort: boolean;
    portNumber: string;
    systemCode: string;
    previewMode: 'dev' | 'customer';
    onTogglePreviewMode: (mode: 'dev' | 'customer') => void;
    isGlobalPrimeReleased: boolean;
    onUpdateGlobalRelease: (released: boolean) => Promise<void>;
}

export default function OwnerDevFarmController({
    isOwnerTestPort,
    portNumber,
    systemCode,
    previewMode,
    onTogglePreviewMode,
    isGlobalPrimeReleased,
    onUpdateGlobalRelease
}: OwnerDevFarmControllerProps) {
    // 🛡️ STRICT SAFETY GUARD: Never render anything for customers
    if (!isOwnerTestPort) return null;

    const [isMinimized, setIsMinimized] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

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
            // Default top-right position
            return { x: window.innerWidth - 320, y: 160 };
        }
        return { x: 20, y: 160 };
    });

    const isDraggingRef = useRef(false);
    const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
        mouseX: 0,
        mouseY: 0,
        startX: 0,
        startY: 0
    });

    // Handle Dragging
    const handleMouseDown = (e: React.MouseEvent) => {
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

            const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.startX + deltaX));
            const newY = Math.max(70, Math.min(window.innerHeight - 80, dragStartRef.current.startY + deltaY));

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

            const newX = Math.max(10, Math.min(window.innerWidth - 280, dragStartRef.current.startX + deltaX));
            const newY = Math.max(70, Math.min(window.innerHeight - 80, dragStartRef.current.startY + deltaY));

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

    const handleConfirmToggleRelease = async () => {
        setIsPublishing(true);
        try {
            const nextState = !isGlobalPrimeReleased;
            await onUpdateGlobalRelease(nextState);
            toast.success(
                nextState 
                    ? '🚀 ปล่อยหน้าฟาร์ม Prime ให้ลูกค้าจริงเห็นแล้วเรียบร้อย!' 
                    : '🔒 ดึงกลับเข้าสู่โหมดส่วนตัวเรียบร้อยแล้ว (ลูกค้าเห็นหน้าคลาสสิกเดิม)'
            );
            setShowConfirmModal(false);
        } catch (err: any) {
            toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'Error'));
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <>
            {/* Draggable Floating Controller Dock */}
            <div 
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
                className="fixed z-[999999] select-none transition-shadow"
            >
                <div className="relative w-[285px] sm:w-[310px] rounded-2xl bg-gradient-to-b from-[#14120e]/95 via-[#0d0c0a]/95 to-[#080705]/95 border-2 border-amber-500/80 shadow-[0_15px_40px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.35)] backdrop-blur-2xl text-amber-100 overflow-hidden font-sans">
                    
                    {/* Draggable Header Grip */}
                    <div 
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="px-3 py-2 bg-gradient-to-r from-amber-500/25 via-amber-600/20 to-orange-500/25 border-b border-amber-500/40 flex items-center justify-between cursor-grab active:cursor-grabbing hover:bg-amber-500/30 transition-colors"
                        title="คลิกค้างเพื่อลากย้ายตำแหน่งหน้าจอ"
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

                        <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-[9px] font-mono font-bold text-amber-300">
                                PORT {portNumber}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsMinimized(prev => !prev)}
                                className="p-1 rounded-lg hover:bg-white/10 text-amber-300 transition-colors cursor-pointer"
                                title={isMinimized ? "ขยายเมนู" : "ย่อเมนู"}
                            >
                                {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>

                    {/* Controller Content (Collapsible) */}
                    {!isMinimized && (
                        <div className="p-3 space-y-3 text-xs">
                            
                            {/* Section 1: Real-time View Switcher */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-bold text-amber-300/80 uppercase">
                                    <span>สลับมุมมองหน้าฟาร์ม (Real-time Preview)</span>
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
                                        ? '🧪 กำลังแสดง Prime Farm รุ่นพัฒนา (ลูกแก้ว 4 มิติ, โดมฟื้นฟู, ปรอท DD) ที่เห็นเฉพาะคุณ'
                                        : '👁️ กำลังจำลองหน้าฟาร์มแบบที่ลูกค้าทั่วไปกำลังมองเห็นอยู่ในขณะนี้'
                                    }
                                </p>
                            </div>

                            {/* Section 2: Release Status & Publish Action */}
                            <div className="pt-2 border-t border-amber-500/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-amber-300/80 uppercase">
                                        สถานะการปล่อยให้ลูกค้า
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                        isGlobalPrimeReleased 
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' 
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                                    }`}>
                                        {isGlobalPrimeReleased ? (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                                PUBLIC LIVE
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-2.5 h-2.5" />
                                                PRIVATE (เห็นคนเดียว)
                                            </>
                                        )}
                                    </span>
                                </div>

                                {/* Publish / Revert Button */}
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmModal(true)}
                                    disabled={isPublishing}
                                    className={`w-full py-2 px-3 rounded-xl font-black text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer active:scale-98 ${
                                        isGlobalPrimeReleased
                                            ? 'bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 text-rose-300 border border-rose-500/40'
                                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                                    }`}
                                >
                                    {isGlobalPrimeReleased ? (
                                        <>
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>ดึงกลับเป็นโหมดส่วนตัว (Revert)</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>อัปเดตปล่อยหน้าฟาร์มนี้ให้ลูกค้า</span>
                                        </>
                                    )}
                                </button>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in pointer-events-auto">
                    <div className="relative w-full max-w-sm bg-gradient-to-b from-[#1c1206]/98 to-[#0a0602]/98 border-2 border-amber-500/90 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(245,158,11,0.4)] text-amber-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center shrink-0">
                                <Zap className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white">
                                    {isGlobalPrimeReleased ? 'ยืนยันการดึงกลับสู่โหมดส่วนตัว' : 'ยืนยันการปล่อยหน้าฟาร์มให้ลูกค้า'}
                                </h4>
                                <span className="text-[10px] text-amber-300/80 font-mono">
                                    RELEASE GATE CONTROLLER
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-amber-100/80 leading-relaxed mb-4">
                            {isGlobalPrimeReleased
                                ? 'คุณต้องการดึงหน้าฟาร์ม Prime กลับเข้าสู่โหมดส่วนตัวหรือไม่? ลูกค้าจริงจะกลับไปเห็นหน้าฟาร์มแบบคลาสสิกเดิมทันที'
                                : 'คุณตรวจสอบหน้าฟาร์ม Prime ในโหมดพัฒนาจนพอใจแล้ว และต้องการปล่อยให้ลูกค้าจริงเห็นหน้าฟาร์มใหม่นี้พร้อมกันเลยใช่หรือไม่?'
                            }
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="py-2 rounded-xl bg-white/10 hover:bg-white/15 text-stone-300 font-bold text-xs transition-colors cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmToggleRelease}
                                disabled={isPublishing}
                                className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                                    isGlobalPrimeReleased
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                                }`}
                            >
                                {isPublishing ? 'กำลังบันทึก...' : (isGlobalPrimeReleased ? 'ดึงกลับทันที' : 'ยืนยันปล่อยใช้งาน')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
