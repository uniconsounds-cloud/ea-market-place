'use client';

import React, { useMemo } from 'react';
import { 
  Activity, 
  Terminal, 
  Cpu, 
  Shield, 
  Zap, 
  TrendingUp, 
  CircleDot
} from 'lucide-react';

interface SpaceshipDashboardProps {
  portNumber: string;
  stats: {
    balance: number;
    equity: number;
    floatingPnl: number;
    maxDrawdown: number;
    totalLots: number;
    buyCount: number;
    sellCount: number;
    buyPnl: number;
    sellPnl: number;
    todayProfit: number;
    serverTime?: Date;
  };
  accountType: string;
  assetType: string;
  systemCode?: string;
  eaVersion?: string;
  
  // --- New props for premium features & trials ---
  orders?: any[];
  recentlyClosed?: any[];
  licenseTier?: string;
  isTrialActive?: boolean;
  trialTimeLeft?: number;
  onActivateTrial?: () => Promise<void>;
  isActivatingTrial?: boolean;
  onSelectSkinPreview?: (skin: string) => void;
  activePreviewSkin?: string | null;
  previewTimeLeft?: number;
  isOffline?: boolean;
  currentPrice?: number;
  licenseCreatedAt?: string | null;
  dailyHistory?: any[];
  customName?: string | null;
  adminMessage?: string | null;
  dailyMaxDrawdown?: number;
  todayClosedLots?: number;
  isFirstSyncLoading?: boolean;
}

export default function SpaceshipDashboard({ 
  portNumber, 
  stats, 
  accountType, 
  assetType,
  systemCode = "EAE_GENERIC",
  eaVersion = "V.01",
  orders = [],
  recentlyClosed = [],
  licenseTier = 'free',
  isTrialActive = false,
  trialTimeLeft = 0,
  onActivateTrial,
  isActivatingTrial = false,
  onSelectSkinPreview,
  activePreviewSkin = null,
  previewTimeLeft = 0,
  isOffline = false,
  currentPrice: initialCurrentPrice,
  licenseCreatedAt = null,
  dailyHistory = [],
  customName = null,
  adminMessage = null,
  dailyMaxDrawdown = 0,
  todayClosedLots = 0,
  isFirstSyncLoading = false
}: SpaceshipDashboardProps) {
  const [time, setTime] = React.useState<Date | null>(null);
  const [messageIndex, setMessageIndex] = React.useState(0);

  React.useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!adminMessage) return;
    const msgTimer = setInterval(() => {
      setMessageIndex(prev => (prev === 0 ? 1 : 0));
    }, 6000);
    return () => clearInterval(msgTimer);
  }, [adminMessage]);

  const seconds = time?.getSeconds() || 0;
  const minutes = time?.getMinutes() || 0;
  const hours = (time?.getHours() || 0) % 12;

  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = hours * 30 + minutes * 0.5;

  const isUSC = accountType === 'USC' || accountType === 'CENT';
  const unit = isUSC ? 'USC' : 'USD';
  const currencyPrefix = isUSC ? '' : '$';
  
  // Format numbers based on account type
  const formatValue = (val: number) => {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const drawdownColor = stats.maxDrawdown > 15 ? 'text-red-500' : stats.maxDrawdown > 5 ? 'text-yellow-500' : 'text-cyan-400';
  const pnlColor = stats.floatingPnl >= 0 ? 'text-green-400' : 'text-red-400';

  // Fluctuate simulated current price in real-time to make it alive
  const [currentPrice, setCurrentPrice] = React.useState(initialCurrentPrice || 2354.50);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    if (initialCurrentPrice && initialCurrentPrice > 0) {
      setCurrentPrice(initialCurrentPrice);
    }
  }, [initialCurrentPrice]);

  React.useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 0.18;
        return parseFloat((prev + change).toFixed(2));
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  // Calculate order entries relative to currentPrice & PnL
  const activeOrders = useMemo(() => orders.filter(o => o.status === 'OPEN'), [orders]);
  
  const orderPositions = useMemo(() => {
    return activeOrders.map(order => {
      const lots = (order.raw_lot_size || 20) / 100;
      const pnlUsd = accountType === 'USC' ? (order.current_pnl || 0) / 100 : (order.current_pnl || 0);
      // For XAUUSD: pnl = (close - open) * lots * 100
      const priceDiff = lots > 0 ? pnlUsd / (lots * 100) : 0;
      const entryPrice = order.type === 'BUY' ? currentPrice - priceDiff : currentPrice + priceDiff;
      return {
        ...order,
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        lots
      };
    });
  }, [activeOrders, currentPrice, accountType]);

  // Calculate Break-Even (BE) price
  const bePrice = useMemo(() => {
    if (orderPositions.length === 0) return currentPrice;
    const totalLotsDirectional = orderPositions.reduce((sum, o) => sum + o.lots * (o.type === 'BUY' ? 1 : -1), 0);
    const totalPnlUsd = orderPositions.reduce((sum, o) => sum + (accountType === 'USC' ? (o.current_pnl || 0) / 100 : (o.current_pnl || 0)), 0);
    
    if (Math.abs(totalLotsDirectional) > 0) {
      const val = totalLotsDirectional > 0
        ? currentPrice - (totalPnlUsd / (totalLotsDirectional * 100))
        : currentPrice + (totalPnlUsd / (Math.abs(totalLotsDirectional) * 100));
      return parseFloat(val.toFixed(2));
    }
    const totalLots = orderPositions.reduce((sum, o) => sum + o.lots, 0);
    if (totalLots > 0) {
      const avg = orderPositions.reduce((sum, o) => sum + o.entryPrice * o.lots, 0) / totalLots;
      return parseFloat(avg.toFixed(2));
    }
    return currentPrice;
  }, [orderPositions, currentPrice, accountType]);

  // Visualizer scale boundaries
  const scaleBounds = useMemo(() => {
    const prices = [currentPrice, bePrice, ...orderPositions.map(o => o.entryPrice)];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const padding = Math.max(0.5, range * 0.15);
    return {
      min: min - padding,
      max: max + padding
    };
  }, [currentPrice, bePrice, orderPositions]);

  const getPercent = (price: number) => {
    const denom = scaleBounds.max - scaleBounds.min;
    if (denom <= 0) return 50;
    return ((price - scaleBounds.min) / denom) * 100;
  };

  // Helper to check local limit counts
  const getCountToday = (key: string): number => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 0; // Show full limits on localhost for testing
    }
    if (typeof window === 'undefined') return 0;
    const today = new Date().toDateString();
    const stored = localStorage.getItem(key);
    if (!stored) return 0;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date !== today) return 0;
      return parsed.count;
    } catch {
      return 0;
    }
  };

  const drawdownBg = stats.maxDrawdown > 15 ? 'bg-red-500' : stats.maxDrawdown > 5 ? 'bg-yellow-500' : 'bg-cyan-500';

  const isMarketOpen = useMemo(() => {
    if (isOffline) return false;
    const d = stats.serverTime || new Date();
    const day = d.getDay();
    const hour = d.getHours();
    // Forex/Gold market is closed Friday 21:00 GMT (Sat 04:00 AM Bangkok) to Sunday 22:00 GMT (Mon 05:00 AM Bangkok)
    if (day === 6) return false; // Saturday
    if (day === 0) return false; // Sunday
    if (day === 5 && hour >= 21) return false; // Friday night
    if (day === 1 && hour < 5) return false; // Monday early morning
    return true;
  }, [stats.serverTime, isOffline]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const licenseText = useMemo(() => {
    if (isTrialActive) return `TRIAL ACTIVE (${formatTimeLeft(trialTimeLeft)})`;
    if (licenseTier === 'max') return 'ENTERPRISE MAX LICENSE';
    if (licenseTier === 'pro') return 'STANDARD PRO LICENSE';
    return 'FREE TRIAL LIMITS';
  }, [isTrialActive, trialTimeLeft, licenseTier]);

  const licenseDateText = useMemo(() => {
    if (!licenseCreatedAt) return 'NO ACTIVE DATE';
    try {
      const d = new Date(licenseCreatedAt);
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    } catch (e) {
      return 'INVALID DATE';
    }
  }, [licenseCreatedAt]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-6 font-mono relative overflow-hidden flex flex-col gap-6">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between z-10 border-b border-slate-700/50 pb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-sm bg-cyan-600/20 border border-cyan-500/50 flex items-center justify-center animate-pulse">
            <Cpu className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-white uppercase">
              {customName ? customName.toUpperCase() : (systemCode && systemCode !== 'EAE_GENERIC' ? systemCode.toUpperCase() : "EASYGOLD FARMING")}{" "}
              <span className="text-cyan-500">{eaVersion}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
              <span className="flex items-center gap-1">
                <CircleDot className={`w-2 h-2 ${isOffline ? 'text-red-500' : 'text-green-500'}`} /> 
                {isOffline ? 'SYSTEM_OFFLINE' : 'SYSTEM_ONLINE'}
              </span>
              <span className="border-l border-slate-700 pl-2">PORT_{portNumber}</span>
              <span className="border-l border-slate-700 pl-2">ASSET_{assetType}</span>
              {isUSC && <span className="border-l border-slate-700 pl-2 text-amber-500 font-bold">MODE_CENT</span>}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Sync Connection Radar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded">
            <div className="relative w-3.5 h-3.5 flex items-center justify-center">
              {!isOffline && (
                <span className={`absolute inset-0 rounded-full border border-cyan-500 opacity-75 ${
                  licenseTier === 'free' && !isTrialActive ? 'animate-[ping_3s_infinite]' : 'animate-[ping_1.2s_infinite]'
                }`} />
              )}
              <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-cyan-500 animate-pulse'}`} />
            </div>
            <div className="text-[10px] uppercase font-bold tracking-wider font-mono">
              {isOffline ? (
                <span className="text-red-500 font-extrabold">OFFLINE</span>
              ) : (
                <span className="text-cyan-400">
                  SYNC: {licenseTier === 'free' && !isTrialActive ? '30S (FREE)' : isTrialActive ? '20S (TRIAL)' : licenseTier === 'pro' ? '20S (PRO)' : '10S (MAX)'}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-6 text-right md:text-left">
            <div className="hidden sm:block">
              <div className="text-[10px] text-slate-500 uppercase">Latency</div>
              <div className="text-sm font-bold text-cyan-400">{isOffline ? '---' : '12ms'}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Encryption</div>
              <div className="text-sm font-bold text-white">AES-256</div>
            </div>
          </div>
        </div>
      </div>

      {/* Cockpit Diagnostics Header: Responsive grid layout */}
      <div className="grid grid-cols-2 md:grid-cols-12 gap-4 z-10 select-none">
        
        {/* Column 1: Analog/Radar Space Clock */}
        <div className="col-span-1 md:col-span-3 order-1 md:order-1 flex flex-col items-center justify-center p-4 bg-[#0f172a]/60 border border-slate-800/80 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.02)] min-h-[140px] sm:min-h-[180px]">
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full border border-cyan-500/30 bg-[#020617] flex items-center justify-center overflow-hidden">
            {/* Rotating Radar Line */}
            <div className="absolute inset-0 origin-center animate-[radar-sweep_4s_linear_infinite]" 
                 style={{
                   background: 'conic-gradient(from 0deg, rgba(6,182,212,0.2) 0deg, rgba(6,182,212,0) 120deg)'
                 }} 
            />
            
            {/* Radar Grid Concentric Circles */}
            <div className="absolute inset-2 rounded-full border border-cyan-500/10 pointer-events-none" />
            <div className="absolute inset-6 rounded-full border border-cyan-500/10 pointer-events-none" />
            <div className="absolute inset-10 rounded-full border border-cyan-500/5 pointer-events-none" />
            
            {/* Crosshairs */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-cyan-500/10" />
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyan-500/10" />
            
            {/* Clock ticks/dots */}
            <span className="absolute top-1 text-[6px] text-cyan-500/60 font-bold select-none">12</span>
            <span className="absolute bottom-1 text-[6px] text-cyan-500/60 font-bold select-none">6</span>
            <span className="absolute left-1 text-[6px] text-cyan-500/60 font-bold select-none">9</span>
            <span className="absolute right-1 text-[6px] text-cyan-500/60 font-bold select-none">3</span>

            {isFirstSyncLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617]/40 z-10">
                <span className="text-[7px] text-amber-500 font-bold tracking-widest animate-pulse uppercase">WARMING UP</span>
              </div>
            ) : isMounted && (
              <>
                {/* Hour hand */}
                <div className="absolute top-1/2 left-1/2 w-[2px] h-[25%] bg-amber-500/85 origin-bottom rounded-full" 
                     style={{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)`, filter: 'drop-shadow(0 0 3px rgba(245,158,11,0.5))' }} />
                {/* Minute hand */}
                <div className="absolute top-1/2 left-1/2 w-[1.5px] h-[35%] bg-cyan-400 origin-bottom rounded-full" 
                     style={{ transform: `translate(-50%, -100%) rotate(${minuteDeg}deg)`, filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.6))' }} />
                {/* Second hand */}
                <div className="absolute top-1/2 left-1/2 w-[0.5px] h-[42%] bg-rose-500 origin-bottom" 
                     style={{ transform: `translate(-50%, -100%) rotate(${secondDeg}deg)` }} />
                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full -translate-x-1/2 -translate-y-1/2 border border-white" />
              </>
            )}
          </div>
          
          <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-2 select-none">
            {isFirstSyncLoading ? (
              <span className="text-amber-500 animate-pulse">[ CALIBRATING ]</span>
            ) : (
              <span>CHRONO_RADAR</span>
            )}
          </div>
        </div>

        {/* Column 2: Reactor Diagnostics Core */}
        <div className="col-span-2 md:col-span-6 order-3 md:order-2 flex flex-col justify-center p-4 bg-[#0f172a]/60 border border-slate-800/80 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.02)] min-h-[140px] sm:min-h-[180px]">
          
          {/* Title Alternating Header */}
          <div className="flex justify-between items-start mb-2 relative min-h-[30px] overflow-hidden">
            <div className="flex-1 min-w-0 pr-4">
              {isFirstSyncLoading ? (
                <div className="text-[10px] sm:text-xs font-black text-amber-500 tracking-widest uppercase animate-pulse">
                  &gt;&gt; ESTABLISHING NEURAL LINK...
                </div>
              ) : (
                <div className="relative w-full h-5">
                  {/* Custom Name / Top Title */}
                  <div className={`absolute inset-x-0 top-0 transition-all duration-700 ease-in-out ${
                    !adminMessage || messageIndex === 0 ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
                  }`}>
                    <h2 className="text-[10px] sm:text-xs font-black text-[#cfa545] tracking-widest uppercase truncate">
                      {customName ? customName.toUpperCase() : `PORT_${portNumber}`}
                    </h2>
                  </div>
                  {/* Admin message / contact info */}
                  {adminMessage && (
                    <div className={`absolute inset-x-0 top-0 transition-all duration-700 ease-in-out ${
                      messageIndex === 1 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
                    }`}>
                      <h2 className="text-[9px] sm:text-[10px] font-bold text-green-400 tracking-wide truncate">
                        {adminMessage.replace('💬 ADMIN: ', '').replace('💬: ', '')}
                      </h2>
                    </div>
                  )}
                </div>
              )}
              
              {/* Equity Value */}
              <div className="text-xs sm:text-sm font-bold tracking-wider text-[#0ea5e9] flex items-center gap-1">
                <span className="text-[7px] sm:text-[8px] text-white/30 tracking-widest uppercase">EQUITY</span>
                {isFirstSyncLoading ? (
                  <span className="text-slate-600 animate-pulse">CONNECTING...</span>
                ) : (
                  <span>{currencyPrefix}{formatValue(stats.equity)}</span>
                )}
              </div>
            </div>
            
            {/* Balance & Floating PnL */}
            <div className="text-right flex flex-col items-end flex-shrink-0">
              <div className="flex gap-1 items-center mb-0.5">
                <span className="text-[7px] sm:text-[8px] text-white/30 tracking-widest uppercase">BALANCE</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-[#cfa545] tracking-wider">
                  {isFirstSyncLoading ? (
                    <span className="text-slate-600 animate-pulse">CONNECTING...</span>
                  ) : (
                    <span>{currencyPrefix}{formatValue(stats.balance)}</span>
                  )}
                </span>
              </div>
              
              {/* Floating PnL */}
              <div className={`text-[9px] sm:text-xs font-mono font-black tracking-tighter ${
                stats.floatingPnl >= 0 ? 'text-[#4de180]' : 'text-rose-500'
              }`}>
                {isFirstSyncLoading ? (
                  <span className="text-slate-600 animate-pulse">--.-- (--%)</span>
                ) : (
                  <span style={{ animation: 'pnlBreathe 3.5s ease-in-out infinite' }} className="inline-block">
                    {stats.floatingPnl >= 0 ? '+' : ''}{currencyPrefix}{formatValue(stats.floatingPnl)} ({((stats.floatingPnl / (stats.balance || 1)) * 100).toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Warp Core Relationship Progress Bar */}
          <div className="relative h-2.5 sm:h-3.5 w-full bg-slate-950 rounded-full border border-slate-800 p-0.5 overflow-hidden shadow-[inset_0_0_8px_rgba(0,0,0,0.8)] mb-3">
            {/* Anchor Line Balance at 75% */}
            <div className="absolute left-[75%] top-0 bottom-0 w-[1px] bg-slate-700/60 z-20" />
            
            {isFirstSyncLoading ? (
              /* Running Warmup Scan animation when loading */
              <div className="h-full w-full bg-gradient-to-r from-cyan-500/10 via-cyan-500/40 to-cyan-500/10 animate-[pulse_1.5s_ease-in-out_infinite]" />
            ) : stats.floatingPnl < 0 ? (
              <>
                {/* Drawdown: Blue bar ends before anchor, Red bar fills the gap */}
                <div 
                  className="h-full bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] rounded-l-full transition-all duration-1000 shadow-[0_0_8px_rgba(14,165,233,0.3)]"
                  style={{ width: `${Math.max(0, 75 + (stats.floatingPnl / (stats.balance || 1)) * 75)}%` }}
                />
                <div 
                  className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-rose-600/80 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] transition-all duration-1000"
                  style={{ 
                    left: `${Math.max(0, 75 + (stats.floatingPnl / (stats.balance || 1)) * 75)}%`, 
                    width: `${Math.min(75, Math.abs((stats.floatingPnl / (stats.balance || 1)) * 75))}%` 
                  }}
                />
              </>
            ) : (
              <>
                {/* Profit: Blue bar fills up to anchor, Green bar extends beyond */}
                <div 
                  className="h-full bg-gradient-to-r from-[#0284c7] to-[#38bdf8] rounded-l-full transition-all duration-1000 shadow-[0_0_8px_rgba(56,189,248,0.3)]"
                  style={{ width: '75%' }}
                />
                <div 
                  className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-[#4de180] to-emerald-400 shadow-[0_0_12px_rgba(77,225,128,0.6)] transition-all duration-1000"
                  style={{ 
                    left: '75%', 
                    width: `${Math.min(25, (stats.floatingPnl / (stats.balance || 1)) * 75)}%` 
                  }}
                />
              </>
            )}
            
            {/* Tip Marker Light */}
            {!isFirstSyncLoading && (
              <div 
                className={`absolute h-full w-1 blur-[1px] z-30 transition-all duration-1000 ${stats.floatingPnl >= 0 ? 'bg-[#38bdf8]' : 'bg-rose-400'}`}
                style={{ 
                  left: `${Math.min(100, 75 + (stats.floatingPnl / (stats.balance || 1)) * 75)}%`, 
                  opacity: 0.8
                }}
              />
            )}
          </div>

          {/* BUY/SELL Dual Plasma Core Reactors */}
          <div className="flex justify-between items-center gap-4 select-none">
            {/* BUY Reactor (Left) */}
            <div className="flex-1 flex items-center gap-2 bg-slate-950/40 border border-slate-900/60 rounded px-2.5 py-1">
              <div className="flex flex-col">
                <span className="text-[7px] text-slate-500 font-bold uppercase leading-none mb-0.5">BUY_GRID</span>
                <div className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 leading-none">
                  <span>QTY:</span>
                  <span>{isFirstSyncLoading ? '--' : stats.buyCount}</span>
                </div>
              </div>
              
              {/* Mini Reactor status progress */}
              <div className="flex-1 h-2 bg-black/60 border border-slate-900 rounded overflow-hidden relative">
                {isFirstSyncLoading ? (
                  <div className="h-full w-full bg-cyan-500/10 animate-pulse" />
                ) : (
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)] transition-all duration-1000"
                    style={{ width: `${(stats.buyCount / Math.max(1, stats.buyCount + stats.sellCount)) * 100}%` }}
                  />
                )}
              </div>

              <div className={`text-[9px] font-bold ${stats.buyPnl >= 0 ? 'text-cyan-400' : 'text-rose-500'} font-mono`}>
                {isFirstSyncLoading ? '--.--' : `${stats.buyPnl >= 0 ? '+' : ''}${stats.buyPnl.toFixed(2)}`}
              </div>
            </div>

            {/* SELL Reactor (Right) */}
            <div className="flex-1 flex items-center gap-2 bg-slate-950/40 border border-slate-900/60 rounded px-2.5 py-1">
              <div className="flex flex-col">
                <span className="text-[7px] text-slate-500 font-bold uppercase leading-none mb-0.5">SELL_GRID</span>
                <div className="flex items-center gap-1 text-[9px] font-bold text-orange-400 leading-none">
                  <span>QTY:</span>
                  <span>{isFirstSyncLoading ? '--' : stats.sellCount}</span>
                </div>
              </div>
              
              {/* Mini Reactor status progress */}
              <div className="flex-1 h-2 bg-black/60 border border-slate-900 rounded overflow-hidden relative">
                {isFirstSyncLoading ? (
                  <div className="h-full w-full bg-orange-500/10 animate-pulse" />
                ) : (
                  <div 
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.4)] transition-all duration-1000"
                    style={{ width: `${(stats.sellCount / Math.max(1, stats.buyCount + stats.sellCount)) * 100}%` }}
                  />
                )}
              </div>

              <div className={`text-[9px] font-bold ${stats.sellPnl >= 0 ? 'text-orange-400' : 'text-rose-500'} font-mono`}>
                {isFirstSyncLoading ? '--.--' : `${stats.sellPnl >= 0 ? '+' : ''}${stats.sellPnl.toFixed(2)}`}
              </div>
            </div>
          </div>

        </div>

        {/* Column 3: Warp Core Cargo / Today Result */}
        <div className="col-span-1 md:col-span-3 order-2 md:order-3 flex items-center justify-between gap-3 p-4 bg-[#0f172a]/60 border border-slate-800/80 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.02)] min-h-[140px] sm:min-h-[180px]">
          
          {/* Left: Text data */}
          <div className="flex flex-col justify-center select-none">
            <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">TODAY_RESULT</span>
            
            <div className={`text-base sm:text-xl font-bold tracking-tight ${
              stats.todayProfit >= 0 ? 'text-[#4de180]' : 'text-rose-500'
            } leading-none mb-2`}>
              {isFirstSyncLoading ? (
                <span className="text-slate-600 animate-pulse">CONNECTING...</span>
              ) : (
                <span>{stats.todayProfit >= 0 ? '+' : ''}{currencyPrefix}{formatValue(stats.todayProfit)}</span>
              )}
            </div>
            
            <div className="flex flex-col gap-0.5 text-[9px] text-slate-400 font-mono">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">MAX_DD:</span>
                <span className="text-rose-400 font-bold">
                  {isFirstSyncLoading ? '--.--' : `${currencyPrefix}${dailyMaxDrawdown.toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">LOTS:</span>
                <span className="text-cyan-400 font-bold">
                  {isFirstSyncLoading ? '--.--' : todayClosedLots.toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="text-[7px] text-slate-600 uppercase tracking-widest font-black mt-2">
              PORT: {portNumber}
            </div>
          </div>

          {/* Right: Quantum Battery Core */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-12 h-16 sm:w-16 sm:h-20 bg-slate-950 rounded border border-slate-800/80 p-1.5 flex flex-col justify-between items-center shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
              {/* Battery cap top */}
              <div className="absolute -top-1 w-4 h-1 bg-slate-800 rounded-t-sm" />
              
              {/* Inner Charge Bars */}
              {isFirstSyncLoading ? (
                /* Yellow warnings/loading animation */
                <>
                  <div className="w-full h-[22%] rounded-xs bg-amber-500/20 animate-pulse" />
                  <div className="w-full h-[22%] rounded-xs bg-amber-500/20 animate-pulse [animation-delay:0.3s]" />
                  <div className="w-full h-[22%] rounded-xs bg-amber-500/20 animate-pulse [animation-delay:0.6s]" />
                </>
              ) : stats.todayProfit > 0 ? (
                /* Profit: Green battery core */
                <>
                  <div className="w-full h-[22%] rounded-xs bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                  <div className="w-full h-[22%] rounded-xs bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse [animation-delay:0.2s]" />
                  <div className="w-full h-[22%] rounded-xs bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse [animation-delay:0.4s]" />
                </>
              ) : stats.todayProfit < 0 ? (
                /* Drawdown: Red battery core */
                <>
                  <div className="w-full h-[22%] rounded-xs bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
                  <div className="w-full h-[22%] rounded-xs bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse [animation-delay:0.2s]" />
                  <div className="w-full h-[22%] rounded-xs bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse [animation-delay:0.4s]" />
                </>
              ) : (
                /* Empty/flat state: Dim cyan bars */
                <>
                  <div className="w-full h-[22%] rounded-xs bg-cyan-950 border border-cyan-800/40" />
                  <div className="w-full h-[22%] rounded-xs bg-cyan-950 border border-cyan-800/40" />
                  <div className="w-full h-[22%] rounded-xs bg-cyan-950 border border-cyan-800/40" />
                </>
              )}
            </div>
            
            <div className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">
              {isFirstSyncLoading ? 'WARMING' : stats.todayProfit > 0 ? 'CHARGED' : stats.todayProfit < 0 ? 'ALERT' : 'STANDBY'}
            </div>
          </div>

        </div>

      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6 z-10 flex-1">
        
        {/* Left Side Column: Visualizer & Skins Panel */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          
          {/* Horizontal Order Price Visualizer */}
          <div className="bg-[#0f172a]/40 border border-slate-800 rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden min-h-[280px]">
            <div className="flex justify-between items-center relative z-10">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Activity className="w-3.5 h-3.5 text-cyan-500" /> Live Grid Order Visualizer
              </h3>
              <div className="flex items-center gap-2">
                {isTrialActive && (
                  <span className="text-[8px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-black animate-pulse">
                    PRO TRIAL ACTIVE: {formatTimeLeft(trialTimeLeft)}
                  </span>
                )}
                <div className="text-[9px] px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-bold">GRID_COORDINATES</div>
              </div>
            </div>

            {/* Visualizer Area */}
            <div className="relative border border-slate-800/60 bg-slate-950/60 p-4 rounded min-h-[200px] flex flex-col justify-between overflow-hidden">
              {/* 1. Scale Bar (top) */}
              <div className="flex justify-between text-[9px] text-slate-500 border-b border-slate-800/40 pb-1.5 font-mono select-none">
                <span>{scaleBounds.min.toFixed(2)}</span>
                <span>{((scaleBounds.min + scaleBounds.max) / 2).toFixed(2)}</span>
                <span>{scaleBounds.max.toFixed(2)}</span>
              </div>

              {/* Horizontal Coordinate Area */}
              <div className="relative flex-1 py-10 flex items-center select-none min-h-[120px]">
                {/* Center Line dividing top and bottom lanes */}
                <div className="absolute left-0 right-0 h-[1px] bg-slate-800/80 top-1/2 -translate-y-1/2 z-10" />
                <div className="absolute left-2 text-[7px] text-slate-600 top-[calc(50%-14px)] select-none uppercase font-bold tracking-widest font-mono">
                  Active Grid / ชุดล่าสุด
                </div>
                <div className="absolute left-2 text-[7px] text-slate-600 top-[calc(50%+6px)] select-none uppercase font-bold tracking-widest font-mono">
                  Recently Closed / ชุดรวบไม้แล้ว
                </div>

                {/* Active Grid Ticks (Top Lane: spans from center up) */}
                {orderPositions.map((o: any, idx: number) => {
                  const leftPct = getPercent(o.entryPrice);
                  const isBuy = o.type === 'BUY';
                  return (
                    <div 
                      key={`tick_${o.ticket_id}_${idx}`}
                      className="absolute top-0 bottom-1/2 w-[1px] group"
                      style={{ left: `${leftPct}%` }}
                    >
                      {/* Tick mark - thin clean line */}
                      <div className={`absolute bottom-0 top-2 w-[1px] ${isBuy ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]'}`} />
                      
                      {/* Hover Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-slate-750 text-[9px] text-white p-2 rounded shadow-2xl z-[100] whitespace-nowrap">
                        <div className={isBuy ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          {o.type} #{o.ticket_id}
                        </div>
                        <div>LOT: {o.lots}</div>
                        <div>ENTRY: {o.entryPrice}</div>
                        <div className={o.current_pnl >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          PNL: {o.current_pnl}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Closed Grid Ticks (Bottom Lane: spans from center down) */}
                {recentlyClosed.map((o: any, idx: number) => {
                  const leftPct = getPercent(o.entryPrice || currentPrice);
                  return (
                    <div 
                      key={`closed_tick_${o.ticket_id}_${idx}`}
                      className="absolute top-1/2 bottom-0 w-[1px] group"
                      style={{ left: `${leftPct}%` }}
                    >
                      {/* Faded dashed line */}
                      <div className={`absolute top-0 bottom-2 w-[1px] border-l border-dashed ${
                        o.isProfit ? 'border-green-500/40 group-hover:border-green-400' : 'border-red-500/40 group-hover:border-red-400'
                      }`} />
                      {/* Faded X at the bottom tip */}
                      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-black leading-none ${
                        o.isProfit ? 'text-green-500/50 group-hover:text-green-400' : 'text-red-500/50 group-hover:text-red-400'
                      }`}>
                        X
                      </div>
                      
                      {/* Hover Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-slate-750 text-[9px] text-white p-2 rounded shadow-2xl z-[100] whitespace-nowrap">
                        <div className="text-slate-400 font-bold uppercase">
                          CLOSED #{o.ticket_id}
                        </div>
                        <div>TYPE: {o.type}</div>
                        <div>LOT: {((o.raw_lot_size || 20) / 100).toFixed(2)}</div>
                        <div>ENTRY: {o.entryPrice || 'N/A'}</div>
                        <div className={o.pnl >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          PNL: {o.pnl >= 0 ? '+' : ''}{o.pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Break-Even (BE) line */}
                {orderPositions.length > 0 && (
                  <div 
                    className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-amber-500/85 z-20 group"
                    style={{ left: `${getPercent(bePrice)}%` }}
                  >
                    <div className="absolute top-[-22px] text-[8px] bg-amber-500/15 border border-amber-500/50 text-amber-400 px-1.5 py-0.5 rounded -translate-x-1/2 font-bold uppercase select-none whitespace-nowrap shadow-[0_0_8px_rgba(245,158,11,0.25)] z-30">
                      BE: {bePrice.toFixed(2)}
                    </div>
                  </div>
                )}

                {/* Current Price line */}
                <div 
                  className="absolute top-0 bottom-0 w-[1px] bg-cyan-500 z-30 group shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                  style={{ left: `${getPercent(currentPrice)}%` }}
                >
                  {/* Pulsing beacon */}
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white animate-ping" />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 border border-white" />
                  
                  <div className="absolute bottom-[-22px] text-[8px] bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 px-1.5 py-0.5 rounded -translate-x-1/2 font-bold uppercase select-none whitespace-nowrap shadow-[0_0_8px_rgba(6,182,212,0.25)] z-30">
                    PRICE: {currentPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Details */}
              <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1.5 border-t border-slate-800/40 font-mono">
                <span>GRID EXP: {(scaleBounds.max - scaleBounds.min).toFixed(2)} Pts</span>
                <span>POSITIONS: {orderPositions.length} ACTIVE / {recentlyClosed.length} CLOSED</span>
              </div>

              {/* Scanning Loader overlay when first sync is booting up */}
              {isFirstSyncLoading && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-45 flex flex-col items-center justify-center p-4 text-center font-mono">
                  {/* Glowing radar line scanning across */}
                  <div className="absolute inset-x-0 h-[2px] bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
                  <p className="text-[11px] text-cyan-200 font-black mb-3 tracking-widest max-w-[280px] uppercase">
                    [ SCANNING FOR GRID FREQUENCIES... ]
                  </p>
                  <p className="text-[8px] text-slate-500 uppercase tracking-wider animate-pulse max-w-[220px]">
                    กำลังเชื่อมต่อช่องสัญญาณข้อมูลออเดอร์กับ MT5 EA กรุณารอสักครู่
                  </p>
                </div>
              )}

              {/* Greyscale Lock overlay for Free Tiers */}
              {licenseTier === 'free' && !isTrialActive && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-40 flex flex-col items-center justify-center p-4 text-center font-mono">
                  <p className="text-[11px] text-amber-200/90 font-black mb-3.5 tracking-widest max-w-[280px]">
                    อัปเกรดเป็น Pro หรือ Max เพื่อเปิดการแสดงราคาออเดอร์แบบสีสันเรียลไทม์
                  </p>
                  <button
                    onClick={onActivateTrial}
                    disabled={isActivatingTrial}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-amber-800 disabled:to-amber-900 text-slate-950 font-black text-[10px] py-2 px-5 rounded tracking-widest uppercase shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isActivatingTrial ? 'WAKING UP EA...' : 'เปิดโหมดทดลองใช้ 30 นาที'}
                  </button>
                  <p className="text-[8px] text-slate-500 mt-2 uppercase tracking-wider">
                    สิทธิ์ทดลองเหลือวันนี้: {isMounted ? Math.max(0, 3 - getCountToday('eae_pro_trial_limit')) : 3}/3 ครั้ง
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Skin Selector Panel */}
          <div className="bg-[#0f172a]/40 border border-slate-800 rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden font-mono">
            <div className="flex justify-between items-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">HUD Interface Skin</div>
              {activePreviewSkin && (
                <div className="text-[9px] px-2.5 py-0.5 bg-amber-950/60 border border-amber-800 text-amber-400 rounded-full font-bold animate-pulse">
                  PREVIEW TIER ACTIVE: {previewTimeLeft}s
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              <button 
                className={`px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  !activePreviewSkin 
                    ? 'bg-cyan-600/20 border border-cyan-500/80 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                    : 'bg-slate-900 border border-slate-850 text-slate-500 hover:text-slate-300'
                }`}
                onClick={() => onSelectSkinPreview && onSelectSkinPreview('spaceship')}
              >
                Spaceship HUD (Free)
              </button>
              
              <button 
                className={`px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer relative group flex items-center gap-1.5 ${
                  activePreviewSkin === 'farm'
                    ? 'bg-amber-600/20 border border-amber-500/80 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                    : 'bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
                onClick={() => onSelectSkinPreview && onSelectSkinPreview('farm')}
              >
                <span>Pixel Farm 2.5D</span>
                {licenseTier === 'free' && !isTrialActive && (
                  <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1 py-0.2 rounded font-black border border-amber-500/30">
                    PREVIEW
                  </span>
                )}
              </button>
              
              <button 
                className="px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-850 bg-slate-900/40 text-slate-655 cursor-not-allowed flex items-center gap-1.5 group select-none"
                disabled
              >
                <span>F1 Cockpit</span>
                <span className="text-[7px] text-slate-600 border border-slate-800 px-1 py-0.2 rounded font-black uppercase">
                  Locked
                </span>
              </button>
              
              <button 
                className="px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-850 bg-slate-900/40 text-slate-655 cursor-not-allowed flex items-center gap-1.5 group select-none"
                disabled
              >
                <span>Fighter Jet</span>
                <span className="text-[7px] text-slate-600 border border-slate-800 px-1 py-0.2 rounded font-black uppercase">
                  Locked
                </span>
              </button>
            </div>
            
            {licenseTier === 'free' && !activePreviewSkin && (
              <p className="text-[9px] text-slate-500 uppercase leading-relaxed">
                * เลือกธีม Pixel Farm เพื่อเข้าทดลองใช้งานฟาร์มผลไม้ฟรี 1 นาที (สูงสุด 3 ครั้งต่อวัน)
              </p>
            )}
          </div>

        </div>

        {/* Right Side Column: Logs & Security bypass Card */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#0f172a]/80 border border-slate-800 rounded-lg p-4 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
              <Terminal className="w-3 h-3" /> System_Logs
            </h3>
            <div className="flex-1 space-y-3 overflow-hidden text-[10px] font-mono">
              <div className="text-slate-400 border-l border-cyan-500 pl-2 py-1">
                <span className="text-slate-600">[14:32:01]</span> INITIALIZING_SYNC_PROTOCOL...
              </div>
              <div className="text-slate-400 border-l border-cyan-500 pl-2 py-1">
                <span className="text-slate-600">[14:32:05]</span> CONNECTED_TO_MT5_GATEWAY
              </div>
              <div className="text-cyan-400 border-l border-cyan-500 pl-2 py-1 bg-cyan-500/5">
                <span className="text-slate-600">[14:32:10]</span> INCOMING_DATA_PACKET: STATUS_SYNC
              </div>
              <div className="text-slate-400 border-l border-slate-700 pl-2 py-1">
                <span className="text-slate-600">[14:32:45]</span> MONITORING_ACTIVE_POSITIONS
              </div>
              {orderPositions.length > 0 ? (
                <div className="text-green-400 border-l border-green-500 pl-2 py-1 animate-pulse">
                  <span className="text-slate-600">[14:33:02]</span> REAL_TIME_SYNCING: {orderPositions.length} GRID LEVELS ACTIVE
                </div>
              ) : (
                <div className="text-slate-500 border-l border-slate-700 pl-2 py-1">
                  <span className="text-slate-600">[14:33:02]</span> NO_ACTIVE_POSITIONS_DETECTED
                </div>
              )}
              <div className="text-slate-400 border-l border-slate-700 pl-2 py-1">
                <span className="text-slate-600">[14:33:05]</span> WAITING_FOR_TICK_SIGNAL...
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex justify-between items-center text-[10px] mb-2">
                <span className="text-slate-500">SYNC_HEALTH</span>
                <span className={isOffline ? "text-red-500" : "text-green-500"}>{isOffline ? "TIMEOUT" : "OPTIMAL"}</span>
              </div>
              <div className="h-0.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div className={`h-full ${isOffline ? "bg-red-500" : "bg-green-500 animate-[progress_3s_ease-in-out_infinite]"}`} style={{ width: isOffline ? '0%' : '85%' }} />
              </div>
            </div>
          </div>

          <div className="bg-[#0f172a]/80 border border-slate-850 text-white rounded-lg p-6 flex items-center justify-between group cursor-help transition-transform hover:scale-[1.02]">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Security Protocol</div>
              <div className="text-lg font-black tracking-tighter text-cyan-400">Bypass Active</div>
            </div>
            <Shield className="w-8 h-8 text-cyan-500 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

      </div>

      {/* Daily P&L History Capsules Row */}
      {dailyHistory && dailyHistory.length > 0 && (
        <div className="z-10 bg-[#0f172a]/60 border border-slate-800 rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-500" /> Daily Harvest History (30D)
            </h3>
            <div className="text-[9px] px-2 py-0.5 bg-slate-800 rounded border border-slate-700 font-bold uppercase">
              CAPSULES_ROW
            </div>
          </div>

          {/* Scrollable Row */}
          <div className="flex w-full overflow-x-auto gap-4 py-2 px-1 no-scrollbar items-center">
            {dailyHistory.map((item: any) => {
              const isProfit = item.pnl >= 0;
              return (
                <div 
                  key={item.id} 
                  className="flex-shrink-0 flex flex-col items-center gap-2 group"
                >
                  {/* Glowing Sci-Fi Capsule */}
                  <div className="w-12 h-24 rounded-full border border-slate-800/80 bg-slate-950/80 relative flex flex-col justify-between items-center py-2.5 overflow-hidden transition-all duration-300 hover:border-slate-700/80 hover:scale-105 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                    {/* Laser Scan Line */}
                    <div 
                      className={`absolute left-0 right-0 h-[2px] pointer-events-none z-20 ${
                        isProfit 
                          ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' 
                          : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                      }`}
                      style={{ animation: 'scan 2s ease-in-out infinite' }}
                    />

                    {/* Date at the Top */}
                    <span className="text-[7px] text-slate-500 font-bold tracking-tight uppercase font-mono z-10">
                      {item.date}
                    </span>

                    {/* Glowing Core */}
                    <div 
                      className={`w-2.5 h-10 rounded-full transition-all duration-500 z-10 ${
                        isProfit 
                          ? 'bg-green-500/80 shadow-[0_0_10px_rgba(74,222,128,0.6)] animate-pulse' 
                          : 'bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse'
                      }`}
                    />

                    {/* Status dot */}
                    <div 
                      className={`w-1 h-1 rounded-full z-10 ${isProfit ? 'bg-green-400' : 'bg-red-400'}`}
                    />
                  </div>

                  {/* P&L Text */}
                  <span className={`text-[10px] font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {isProfit ? '+' : ''}{item.pnl.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Bottom Bar */}
      <div className="mt-auto z-10 flex justify-between items-center text-[9px] text-slate-500 uppercase tracking-widest border-t border-slate-700/30 pt-4">
        <div>EAEZE_COMMAND_CENTER // DEV_ALPHA</div>
        <div className="flex gap-4">
          <span>© 2026 EAEZE SYSTEMS</span>
          <span className="text-cyan-500">INTERNAL_USE_ONLY</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes scan {
          0% { top: 12%; opacity: 0.3; }
          50% { top: 88%; opacity: 0.9; }
          100% { top: 12%; opacity: 0.3; }
        }
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pnlBreathe {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
