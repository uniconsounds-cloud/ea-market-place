'use client';

import React, { useMemo } from 'react';
import { 
  Activity, 
  Terminal, 
  Cpu, 
  Shield, 
  Zap, 
  TrendingUp, 
  Target, 
  Percent, 
  Layers,
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
  };
  accountType: string;
  assetType: string;
  systemCode?: string;
  eaVersion?: string;
}

export default function SpaceshipDashboard({ 
  portNumber, 
  stats, 
  accountType, 
  assetType,
  systemCode = "EAE_GENERIC",
  eaVersion = "V.01"
}: SpaceshipDashboardProps) {
  const isUSC = accountType === 'USC';
  const unit = isUSC ? 'USC' : 'USD';
  
  // Format numbers based on account type
  const formatValue = (val: number) => {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const drawdownColor = stats.maxDrawdown > 15 ? 'text-red-500' : stats.maxDrawdown > 5 ? 'text-yellow-500' : 'text-cyan-400';
  const pnlColor = stats.floatingPnl >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-6 font-mono relative overflow-hidden flex flex-col gap-6">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
      
      {/* Top Header */}
      <div className="flex items-center justify-between z-10 border-b border-slate-700/50 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-sm bg-cyan-600/20 border border-cyan-500/50 flex items-center justify-center animate-pulse">
            <Cpu className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-white uppercase">{systemCode.replace('_', ' ')} <span className="text-cyan-500">{eaVersion}</span></h1>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
              <span className="flex items-center gap-1"><CircleDot className="w-2 h-2 text-green-500" /> SYSTEM_ONLINE</span>
              <span className="border-l border-slate-700 pl-2">PORT_{portNumber}</span>
              <span className="border-l border-slate-700 pl-2">TYPE_{assetType}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-8">
            <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase">Latency</div>
                <div className="text-sm font-bold text-cyan-400">12ms</div>
            </div>
            <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase">Encryption</div>
                <div className="text-sm font-bold text-white">AES-256</div>
            </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6 z-10 flex-1">
        
        {/* Left Column: Core Stats */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Main Balance Card */}
          <div className="bg-[#0f172a]/80 border border-slate-800 rounded-lg p-6 relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <TrendingUp className="w-24 h-24" />
            </div>
            <div className="text-xs text-slate-500 uppercase mb-1 flex items-center gap-2">
                <Shield className="w-3 h-3" /> Net Liquidity
            </div>
            <div className="text-4xl font-black text-white tracking-tighter flex items-baseline gap-2">
              {formatValue(stats.balance)} <span className="text-xs text-slate-500">{unit}</span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
                <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500">EQUITY STABILITY</span>
                    <span className="text-white">{Math.round((stats.equity / stats.balance) * 100)}%</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" 
                        style={{ width: `${Math.min(100, (stats.equity / stats.balance) * 100)}%` }} 
                    />
                </div>
            </div>
          </div>

          {/* Floating P&L */}
          <div className={`bg-[#0f172a]/80 border ${stats.floatingPnl >= 0 ? 'border-green-900/50' : 'border-red-900/50'} rounded-lg p-6 relative`}>
            <div className="text-xs text-slate-500 uppercase mb-1">Live Floating Exposure</div>
            <div className={`text-4xl font-black tracking-tighter ${pnlColor} flex items-baseline gap-2`}>
              {stats.floatingPnl >= 0 ? '+' : ''}{formatValue(stats.floatingPnl)} <span className="text-xs opacity-50">{unit}</span>
            </div>
            <div className="mt-4 text-[10px] text-slate-500 flex justify-between uppercase">
                <span>Today Closed Profit</span>
                <span className={stats.todayProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{stats.todayProfit >= 0 ? '+' : ''}{formatValue(stats.todayProfit)}</span>
            </div>
          </div>

          {/* Drawdown Gauge */}
          <div className="bg-[#0f172a]/80 border border-slate-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="text-xs text-slate-500 uppercase">Crit_Drawdown</div>
                <Zap className={`w-4 h-4 ${drawdownColor} animate-pulse`} />
            </div>
            <div className="flex flex-col items-center">
                <div className={`text-6xl font-black tracking-tighter ${drawdownColor}`}>
                    {stats.maxDrawdown.toFixed(2)}%
                </div>
                <div className="h-2 w-full max-w-[200px] bg-slate-900 mt-4 border border-slate-800 p-[2px]">
                    <div 
                        className={`h-full ${stats.maxDrawdown > 15 ? 'bg-red-500' : 'bg-cyan-500'}`} 
                        style={{ width: `${Math.min(100, stats.maxDrawdown * 4)}%` }} 
                    />
                </div>
            </div>
          </div>
        </div>

        {/* Center Column: Visualization */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            <div className="bg-[#0f172a]/40 border border-slate-800 rounded-lg p-6 flex-1 flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 flex items-center justify-center">
                    <div className="w-[300px] h-[300px] rounded-full border-[20px] border-cyan-500 animate-[spin_20s_linear_infinite]" />
                </div>
                
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Activity className="w-3 h-3 text-cyan-500" /> Vector_Analysis
                    </h3>
                    <div className="text-[10px] px-2 py-0.5 bg-slate-800 rounded border border-slate-700">R_REALTIME</div>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-8 relative z-10">
                    {/* Buy vs Sell Bars */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] uppercase">
                                <span className="text-cyan-400">Long_Protocol</span>
                                <span>{stats.buyCount} Orders</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-6 flex-1 bg-slate-900 border border-slate-800">
                                    <div 
                                        className="h-full bg-cyan-600 transition-all duration-500" 
                                        style={{ width: `${(stats.buyCount / (stats.buyCount + stats.sellCount || 1)) * 100}%` }} 
                                    />
                                </div>
                                <div className="text-sm font-bold text-cyan-400 w-16 text-right">
                                    {stats.buyPnl >= 0 ? '+' : ''}{Math.round(stats.buyPnl)}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] uppercase">
                                <span className="text-rose-500">Short_Protocol</span>
                                <span>{stats.sellCount} Orders</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-6 flex-1 bg-slate-900 border border-slate-800">
                                    <div 
                                        className="h-full bg-rose-600 transition-all duration-500" 
                                        style={{ width: `${(stats.sellCount / (stats.buyCount + stats.sellCount || 1)) * 100}%` }} 
                                    />
                                </div>
                                <div className="text-sm font-bold text-rose-500 w-16 text-right">
                                    {stats.sellPnl >= 0 ? '+' : ''}{Math.round(stats.sellPnl)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-900/50 border border-slate-800 p-3">
                            <div className="text-[9px] text-slate-500 uppercase">Volume</div>
                            <div className="text-lg font-bold text-white tracking-widest">{stats.totalLots.toFixed(2)}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-3 text-cyan-500">
                            <div className="text-[9px] text-slate-500 uppercase">Avg_Spread</div>
                            <div className="text-lg font-bold tracking-widest">1.2</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-3">
                            <div className="text-[9px] text-slate-500 uppercase">Margin</div>
                            <div className="text-lg font-bold text-white tracking-widest">92%</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#0f172a]/80 border border-slate-800 rounded-lg p-6 grid grid-cols-2 gap-8">
                <div className="flex flex-col border-l-2 border-cyan-500 pl-4">
                    <span className="text-[10px] text-slate-500 uppercase">Account_ID</span>
                    <span className="text-lg font-bold text-white">{portNumber}</span>
                </div>
                <div className="flex flex-col border-l-2 border-slate-700 pl-4">
                    <span className="text-[10px] text-slate-500 uppercase">Core_Currency</span>
                    <span className="text-lg font-bold text-white">{unit}</span>
                </div>
            </div>
        </div>

        {/* Right Column: Logs / History */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
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
                    <div className="text-green-400 border-l border-green-500 pl-2 py-1 animate-pulse">
                        <span className="text-slate-600">[14:33:02]</span> ORDER_UPDATE: TKT_#32941_CLOSED
                    </div>
                    <div className="text-slate-400 border-l border-slate-700 pl-2 py-1">
                        <span className="text-slate-600">[14:33:05]</span> WAITING_FOR_TICK_SIGNAL...
                    </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center text-[10px] mb-2">
                        <span className="text-slate-500">SYNC_HEALTH</span>
                        <span className="text-green-500">OPTIMAL</span>
                    </div>
                    <div className="h-0.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 animate-[progress_3s_ease-in-out_infinite]" style={{ width: '85%' }} />
                    </div>
                </div>
            </div>

            <div className="bg-cyan-600 text-white rounded-lg p-6 flex items-center justify-between group cursor-help transition-transform hover:scale-[1.02]">
                <div>
                   <div className="text-[10px] uppercase font-bold opacity-80">Security Protocol</div>
                   <div className="text-lg font-black tracking-tighter">Bypass Active</div>
                </div>
                <Shield className="w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
      </div>
      
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
      `}</style>
    </div>
  );
}
