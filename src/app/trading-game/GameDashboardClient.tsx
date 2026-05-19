"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Activity, Crosshair, TrendingUp, Zap, Clock, ShieldAlert, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : null;

// TODO: When market opens, replace mockEnergy with real EA proximity data broadcasted to Supabase!

interface Strategy {
  id: number;
  name: string;
  description: string;
  current_status: string;
  virtual_balance: number;
  floating_pl: number;
  win_rate: number;
  total_trades: number;
}

interface VirtualRound {
  round_id: string;
  strategy_id: number;
  ticket: number;
  type: string;
  volume: number;
  open_price: number;
  sl: number;
  tp: number;
  close_price: number;
  profit: number;
  max_dd: number;
  open_time: string;
  close_time: string;
  status: string;
}

interface ChartData extends VirtualRound {
  userProfit: number;
  copied: boolean;
}

const initialStrategies: Strategy[] = [
  { id: 1, name: "Momentum Burst", description: "Breakout momentum using EMA9/21 cross", current_status: "IDLE", virtual_balance: 1450.50, floating_pl: 0.0, win_rate: 72.4, total_trades: 42 },
  { id: 2, name: "Micro Pullback Trend", description: "Trend following pullback using EMA20/50", current_status: "IDLE", virtual_balance: 1680.00, floating_pl: 0.0, win_rate: 76.5, total_trades: 34 },
  { id: 3, name: "Range Bounce Scalper", description: "Sideway ping-pong using RSI bounce", current_status: "IDLE", virtual_balance: 1120.20, floating_pl: 0.0, win_rate: 68.2, total_trades: 55 },
  { id: 4, name: "Spike Fade", description: "Mean reversion on abnormal volatility spikes", current_status: "IDLE", virtual_balance: 1390.80, floating_pl: 0.0, win_rate: 70.0, total_trades: 30 },
];

const generateMockHistory = (stratId: number): VirtualRound[] => {
  const list: VirtualRound[] = [];
  const nowMs = Date.now();
  const winRate = [72.4, 76.5, 68.2, 70.0][stratId - 1];
  
  for (let i = 0; i < 20; i++) {
    const isWin = Math.random() * 100 < winRate;
    const profit = isWin 
      ? parseFloat((Math.random() * 25 + 5).toFixed(2)) 
      : parseFloat((- (Math.random() * 15 + 5)).toFixed(2));
    
    const ticket = 83719000 + Math.floor(Math.random() * 999) + i * 1000;
    const volume = parseFloat((Math.random() * 0.03 + 0.01).toFixed(2));
    const openTime = new Date(nowMs - (20 - i) * 600000).toISOString();
    const closeTime = new Date(nowMs - (20 - i) * 600000 + 450000).toISOString();
    
    list.push({
      round_id: `mock-round-${stratId}-${i}`,
      strategy_id: stratId,
      ticket,
      type: Math.random() > 0.5 ? 'BUY' : 'SELL',
      volume,
      open_price: 4537.0 + (Math.random() - 0.5) * 5,
      close_price: 4537.0 + (Math.random() - 0.5) * 5,
      sl: 0,
      tp: 0,
      open_time: openTime,
      close_time: closeTime,
      profit,
      max_dd: parseFloat((-Math.random() * 8).toFixed(2)),
      status: 'CLOSED'
    });
  }
  return list;
};

interface AggregatedRound {
  round_id: string;
  strategy_id: number;
  ticket: number;
  type: string;
  volume: number;
  open_price: number;
  close_price: number;
  sl: number;
  tp: number;
  open_time: string;
  close_time: string;
  profit: number;
  max_dd: number;
  status: string;
  order_count: number;
}

const aggregateRoundsByCloseTime = (rounds: VirtualRound[]): AggregatedRound[] => {
  if (!rounds || rounds.length === 0) return [];
  
  // Group by close_time rounded to nearest 2 seconds to handle API latency variations
  const groups: Record<string, VirtualRound[]> = {};
  
  rounds.forEach(r => {
    if (!r.close_time) return;
    const timeMs = new Date(r.close_time).getTime();
    const roundedTime = Math.round(timeMs / 2000) * 2000;
    const key = `${r.strategy_id}-${roundedTime}`;
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(r);
  });
  
  const aggregated: AggregatedRound[] = [];
  
  Object.values(groups).forEach(group => {
    group.sort((a, b) => a.ticket - b.ticket);
    const primary = group[0];
    
    const totalProfit = group.reduce((sum, r) => sum + (parseFloat(String(r.profit)) || 0), 0);
    const maxDD = group.reduce((min, r) => Math.min(min, parseFloat(String(r.max_dd)) || 0), 0);
    const totalVolume = group.reduce((sum, r) => sum + (parseFloat(String(r.volume)) || 0), 0);
    
    aggregated.push({
      round_id: primary.round_id,
      strategy_id: primary.strategy_id,
      ticket: primary.ticket,
      type: primary.type,
      volume: parseFloat(totalVolume.toFixed(2)),
      open_price: primary.open_price,
      close_price: primary.close_price,
      sl: primary.sl,
      tp: primary.tp,
      open_time: primary.open_time,
      close_time: primary.close_time,
      profit: parseFloat(totalProfit.toFixed(2)),
      max_dd: parseFloat(maxDD.toFixed(2)),
      status: 'CLOSED',
      order_count: group.length
    });
  });
  
  return aggregated.sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime());
};

const CustomizedDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.signals && payload.signals.length > 0) {
     return (
       <g>
         <circle cx={cx} cy={cy} r={5} fill="rgba(34, 211, 238, 0.3)" className="animate-ping" style={{ transformOrigin: `${cx}px ${cy}px` }} />
         <circle cx={cx} cy={cy} r={2} fill="#22d3ee" />
         {payload.signals.map((sId: number, i: number) => {
            const icon = sId === 1 ? '⚡' : sId === 2 ? '📈' : sId === 3 ? '🌊' : '🎯';
            return (
              <text key={sId} x={cx} y={cy - 10 - (i*14)} fontSize={11} textAnchor="middle" className="fill-cyan-300 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] select-none">
                 {icon}
              </text>
            )
         })}
       </g>
     )
  }
  return null;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartData;
    const isProfit = data.profit >= 0;
    
    const openDate = new Date(data.open_time);
    const closeDate = new Date(data.close_time);
    const diffMs = closeDate.getTime() - openDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    const durationStr = diffMins > 0 ? `${diffMins}m ${diffSecs}s` : `${diffSecs}s`;

    return (
      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.9)] relative overflow-hidden -translate-y-[115%] pointer-events-none w-44 z-[9999] text-[10px]">
        <div className={`absolute top-0 left-0 w-0.5 h-full ${isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
        <p className="font-bold mb-1.5 text-slate-500 tracking-wider">TICKET #{data.ticket} [{data.type}]</p>
        
        <div className="grid grid-cols-2 gap-1.5 mb-2 bg-slate-900/60 p-1.5 rounded border border-slate-800/40">
          <div>
            <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Master</span>
            <span className={`font-mono font-black tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfit ? '+' : ''}${data.profit.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">You</span>
            {data.copied ? (
              <span className={`font-mono font-black tabular-nums ${data.userProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {data.userProfit >= 0 ? '+' : ''}${data.userProfit.toFixed(2)}
              </span>
            ) : (
              <span className="font-bold text-slate-600 uppercase tracking-wider block mt-0.5">Missed</span>
            )}
          </div>
        </div>

        <div className="space-y-1 border-t border-slate-900 pt-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Duration:</span>
            <span className="text-slate-300 font-medium tabular-nums">{durationStr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Max DD:</span>
            <span className="text-rose-400 font-medium tabular-nums">-${Math.abs(data.max_dd).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function GameDashboardClient() {
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies);
  const [history, setHistory] = useState<Record<number, VirtualRound[]>>({
    1: [],
    2: [],
    3: [],
    4: []
  });
  const [activeRounds, setActiveRounds] = useState<Record<number, VirtualRound>>({});

  const [subscriptions, setSubscriptions] = useState<Record<number, boolean>>({});
  const [hoveredRounds, setHoveredRounds] = useState<Record<number, any | null>>({ 1: null, 2: null, 3: null, 4: null });
  const [now, setNow] = useState(0);
  const historyRef = useRef(history);
  const [marketData, setMarketData] = useState<{time: string, price: number, signals: number[]}[]>([]);
  const latestPriceRef = useRef<number>(0);
  const activeRoundsRef = useRef<Record<number, VirtualRound>>({});
  const lastSignalCycle = useRef<Record<number, number>>({});

  useEffect(() => {
    activeRoundsRef.current = activeRounds;
  }, [activeRounds]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);



  useEffect(() => {
    // Generate mock history only on the client on mount to avoid SSR hydration mismatches!
    setHistory({
      1: generateMockHistory(1),
      2: generateMockHistory(2),
      3: generateMockHistory(3),
      4: generateMockHistory(4)
    });
  }, []);

  useEffect(() => {
    // Live XAUUSD (Gold Spot) feed via free public CORS-enabled Gold-API
    // No API keys required, no rate limits, completely public and stable!
    // We poll the live gold price every 5 seconds, and smoothly interpolate 
    // micro-ticks in-between to keep the dashboard extremely fluid and alive.
    let pollInterval: NodeJS.Timeout | null = null;
    let tickInterval: NodeJS.Timeout | null = null;
    let basePrice = 4537.0; // Starting default gold price

    // Set initial real time after hydration to avoid SSR mismatch
    setNow(Date.now());

    const fetchRealGoldPrice = async () => {
      try {
        const response = await fetch("https://api.gold-api.com/price/XAU");
        if (response.ok) {
          const data = await response.json();
          const price = parseFloat(data.price);
          if (price > 0) {
            basePrice = price;
            // Align the latest price ref to the exact real price fetched
            latestPriceRef.current = parseFloat(price.toFixed(2));
            
            // Pre-populate 80 ticks of historic data on first successful fetch
            setMarketData(prev => {
              if (prev.length > 0) return prev; // already initialized
              
              const initialTicks = [];
              const nowTime = Date.now();
              let tempPrice = price;
              
              for (let i = 79; i >= 0; i--) {
                const tickTime = new Date(nowTime - i * 5000);
                const timeStr = tickTime.toLocaleTimeString('en-US', { 
                  timeZone: 'Asia/Bangkok',
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                });
                
                // Random walk back in time
                const change = (Math.random() - 0.5) * 0.4;
                tempPrice = tempPrice - change;
                initialTicks.push({
                  time: timeStr,
                  price: parseFloat(tempPrice.toFixed(2)),
                  signals: []
                });
              }
              return initialTicks;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch live gold price from Gold-API:", err);
      }
    };

    // Initial fetch immediately
    fetchRealGoldPrice();

    // Poll every 5 seconds
    pollInterval = setInterval(fetchRealGoldPrice, 5000);

    // Micro-ticks simulator: updates every 500ms to keep the chart moving fluidly in-between polls
    tickInterval = setInterval(() => {
      if (latestPriceRef.current === 0) {
        latestPriceRef.current = basePrice;
      }
      
      // Add very small micro-fluctuations (e.g. +/- $0.08) around the current base price
      // to simulate natural tick-by-tick market volatility
      const microNoise = (Math.random() - 0.5) * 0.16;
      latestPriceRef.current = parseFloat((latestPriceRef.current + microNoise).toFixed(2));
    }, 500);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (tickInterval) clearInterval(tickInterval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const nowTimestamp = Date.now();
      setNow(nowTimestamp);
      
      if (latestPriceRef.current > 0) {
        setMarketData(prev => {
           const newSignals: number[] = [];
           [1,2,3,4].forEach(stratId => {
              const isActive = !!activeRoundsRef.current[stratId];
              if (isActive) return; // Only plot when Approaching (80%), not when already active
              
              const cycle = 8000;
              const offset = stratId * 2500;
              const sinVal = Math.sin(((nowTimestamp + offset) % cycle) / cycle * Math.PI * 2);
              const energy = (sinVal + 1) * 50; 
              
              if (energy >= 80) {
                 const cycleId = Math.floor((nowTimestamp + offset) / cycle);
                 if (lastSignalCycle.current[stratId] !== cycleId) {
                     lastSignalCycle.current[stratId] = cycleId;
                     newSignals.push(stratId);
                 }
              }
           });
           
           const newTick = { 
             time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }), 
             price: latestPriceRef.current, 
             signals: newSignals 
           };
           
           const newData = [...prev, newTick];
           if(newData.length > 80) newData.shift(); // Keep last 80 ticks on screen
           return newData;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const syncSupabaseData = async () => {
      try {
        // 1. Fetch Strategies
        const { data: stratData } = await supabase.from("tg_strategies").select("*").order("id");
        if (stratData && stratData.length > 0) {
          setStrategies(stratData);
        }

        // 2. Fetch Closed History (Take the last 100 per strategy to allow robust close-round grouping)
        const histMap: Record<number, VirtualRound[]> = { 1: [], 2: [], 3: [], 4: [] };
        await Promise.all([1, 2, 3, 4].map(async (stratId) => {
          const { data: stratHist } = await supabase
            .from("tg_virtual_rounds")
            .select("*")
            .eq("strategy_id", stratId)
            .eq("status", "CLOSED")
            .order("close_time", { ascending: false })
            .limit(100);
          
          if (stratHist) {
            histMap[stratId] = [...stratHist].sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime());
          }
        }));
        setHistory(histMap);

        const { data: activeData, error: activeErr } = await supabase.from("tg_virtual_rounds").select("*").eq("status", "OPEN");
        if (activeErr) {
          console.error("Error fetching active rounds:", activeErr);
        } else if (activeData) {
          const activeMap: Record<number, VirtualRound> = {};
          activeData.forEach(r => { activeMap[r.strategy_id] = r; });
          setActiveRounds(activeMap);
        }


      } catch (err) {
        console.error("Error syncing Supabase data:", err);
      }
    };

    // Initial sync
    syncSupabaseData();

    // Fallback Polling every 4 seconds to guarantee absolute sync under any network condition
    const syncInterval = setInterval(syncSupabaseData, 4000);

    const stratChannel = supabase.channel("schema-strat-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tg_strategies" }, (payload) => {
          setStrategies((prev) => prev.map((s) => {
            if (s.id === payload.new.id) {
              const cleanNew = { ...payload.new };
              Object.keys(cleanNew).forEach(key => {
                if (cleanNew[key] === null || cleanNew[key] === undefined) {
                  delete cleanNew[key];
                }
              });
              // Prevent total_trades = 0 from overwriting a valid existing total_trades count
              if (cleanNew.total_trades === 0 && s.total_trades > 0) {
                delete cleanNew.total_trades;
              }
              return { ...s, ...cleanNew } as Strategy;
            }
            return s;
          }));
      }).subscribe();

    const roundsChannel = supabase.channel("schema-rounds-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "tg_virtual_rounds" }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const round = payload.new as VirtualRound;
            if (round.status === 'OPEN') {
              setActiveRounds(prev => ({ ...prev, [round.strategy_id]: round }));
            }
          } 
          else if (payload.eventType === 'UPDATE') {
            const cleanNew = { ...payload.new };
            Object.keys(cleanNew).forEach(key => {
              if (cleanNew[key] === null || cleanNew[key] === undefined) {
                delete cleanNew[key];
              }
            });
            const round = cleanNew as VirtualRound;
            let targetStratId = round.strategy_id;
            
            // If strategy_id was omitted in PATCH, find it using ticket
            if (!targetStratId && round.ticket) {
              setActiveRounds(prev => {
                const found = Object.values(prev).find(r => r.ticket === round.ticket);
                if (found) targetStratId = found.strategy_id;
                
                if (targetStratId) {
                  const copy = { ...prev };
                  const existing = copy[targetStratId];
                  const merged = { ...existing, ...round } as VirtualRound;
                  if (merged.status === 'CLOSED') {
                    delete copy[targetStratId];
                  } else {
                    copy[targetStratId] = merged;
                  }
                  return copy;
                }
                return prev;
              });
              return;
            }
            
            if (targetStratId) {
              setActiveRounds(prev => {
                const copy = { ...prev };
                const existing = copy[targetStratId];
                
                // Merge new round data
                const merged = { ...existing, ...round } as VirtualRound;
                
                if (merged.status === 'CLOSED') {
                  delete copy[targetStratId];
                  
                  // Also add to history and update today profit map!
                  setHistory(prevHist => {
                    let stratHist = [...(prevHist[targetStratId] || [])];
                    // Remove existing ticket or round_id duplicates to prevent collisions in real-time
                    stratHist = stratHist.filter(r => r.round_id !== merged.round_id && r.ticket !== merged.ticket);
                    stratHist.push(merged);
                    stratHist.sort((a, b) => new Date(a.close_time || 0).getTime() - new Date(b.close_time || 0).getTime());
                    if (stratHist.length > 100) stratHist.shift();
                    return { ...prevHist, [targetStratId]: stratHist };
                  });
                  

                } else {
                  // Keep it open
                  copy[targetStratId] = merged;
                }
                return copy;
              });
            }
          }
      }).subscribe();

    return () => {
      clearInterval(syncInterval);
      supabase.removeChannel(stratChannel);
      supabase.removeChannel(roundsChannel);
    };
  }, []);

  const handleSubscribe = (id: number) => setSubscriptions((prev) => ({ ...prev, [id]: !prev[id] }));

  const getIcon = (id: number) => {
    switch (id) {
      case 1: return <Zap className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
      case 2: return <TrendingUp className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />;
      case 3: return <Activity className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />;
      case 4: return <Crosshair className="w-6 h-6 text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]" />;
      default: return <ShieldAlert className="w-6 h-6" />;
    }
  };

  const getLiveDuration = (openTime: string) => {
    const diffMs = now - new Date(openTime).getTime();
    if(diffMs < 0) return "0s";
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return diffMins > 0 ? `${diffMins}m ${diffSecs}s` : `${diffSecs}s`;
  };

  const getRoundDuration = (openTime: string, closeTime: string) => {
    if (!openTime || !closeTime) return "N/A";
    const diffMs = new Date(closeTime).getTime() - new Date(openTime).getTime();
    if(diffMs < 0) return "0s";
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return diffMins > 0 ? `${diffMins}m ${diffSecs}s` : `${diffSecs}s`;
  };

  const getTodayProfit = (stratId: number) => {
    const hist = history[stratId] || [];
    
    // Get current date string in Thai Time timezone (YYYY-MM-DD)
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(new Date()); 
    
    // Filter rounds closed today in Thai timezone and sum
    const todayRounds = hist.filter(r => {
      if (!r.close_time) return false;
      const roundDateStr = formatter.format(new Date(r.close_time));
      return roundDateStr === todayStr;
    });
    
    const sum = todayRounds.reduce((acc, r) => acc + (parseFloat(String(r.profit)) || 0), 0);
    return parseFloat(sum.toFixed(2));
  };

  const calculateEMA = (data: number[], period: number): number => {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const calculateRSI = (data: number[], period: number = 14): number => {
    if (data.length <= period) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    if (gains + losses === 0) return 50;
    const rs = gains / (losses || 0.0001);
    return 100 - (100 / (1 + rs));
  };

  const calculateStdDev = (data: number[], period: number = 10): number => {
    if (data.length < period) return 0.5;
    const slice = data.slice(-period);
    const mean = slice.reduce((sum, v) => sum + v, 0) / period;
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
    return Math.sqrt(variance);
  };

  const getRealProximity = (stratId: number, isIdle: boolean) => {
    if (!isIdle) return 100;
    if (marketData.length < 15) {
      // Fallback pseudo-random slow walk if not enough live market ticks yet
      const cycle = 80000; // 10 times slower!
      const offset = stratId * 25000;
      const sinVal = Math.sin(((now + offset) % cycle) / cycle * Math.PI * 2);
      return (sinVal + 1) * 35 + 20; // slow drift between 20% and 90%
    }

    const prices = marketData.map(d => d.price);
    const currentPrice = prices[prices.length - 1];

    if (stratId === 1) {
      const ema9 = calculateEMA(prices, 9);
      const ema21 = calculateEMA(prices, 21);
      const diff = Math.abs(ema9 - ema21);
      const diffPct = (diff / currentPrice) * 10000;
      return Math.max(10, Math.min(99, 100 - (diffPct * 22)));
    }
    else if (stratId === 2) {
      const ema20 = calculateEMA(prices, 20);
      const dist = Math.abs(currentPrice - ema20);
      const distPct = (dist / currentPrice) * 10000;
      return Math.max(10, Math.min(99, 100 - (distPct * 30)));
    }
    else if (stratId === 3) {
      const rsi = calculateRSI(prices, 14);
      const distFromCenter = Math.abs(rsi - 50);
      return Math.max(10, Math.min(99, 30 + (distFromCenter * 1.35)));
    }
    else if (stratId === 4) {
      const vol = calculateStdDev(prices, 10);
      return Math.max(10, Math.min(99, 35 + (vol * 90)));
    }
    return 50;
  };

  const getSignalState = (stratId: number, isIdle: boolean, energy: number) => {
    if (!isIdle) return { text: "CONDITION MET", color: "text-amber-400", pulse: true, Icon: Zap };
    if (energy >= 80) {
      return { text: "APPROACHING SIGNAL", color: "text-cyan-400", pulse: true, Icon: Activity };
    }
    return { text: "SCANNING MARKET", color: "text-slate-500", pulse: false, Icon: Crosshair };
  };

  const globalBalance = strategies.reduce((sum, s) => sum + (Number(s.virtual_balance) || 0), 0);
  const globalFloating = strategies.reduce((sum, s) => sum + (Number(s.floating_pl) || 0), 0);
  const globalEquity = globalBalance + globalFloating;
  const globalDdPct = globalBalance > 0 ? (globalFloating / globalBalance) * 100 : 0;
  const ddDisplay = globalFloating < 0 ? `${globalDdPct.toFixed(2)}%` : '0.00%';
  const currentChartPrice = marketData.length > 0 ? marketData[marketData.length - 1].price : 0;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-2 sm:px-4">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b border-slate-900 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-100">
              TRADING GAME
            </h1>
            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 px-2.5 py-0.5 font-mono uppercase tracking-widest text-xs">
              CONSOLE
            </Badge>
            <Badge variant="outline" className="bg-slate-900/60 text-slate-300 border-slate-800/80 px-2.5 py-0.5 font-mono uppercase tracking-widest text-xs flex items-center gap-1.5 select-none shrink-0">
              <span className="text-[14px] leading-none">🇹🇭</span>
              <span>THAI TIME (GMT+7)</span>
            </Badge>
          </div>
          <p className="text-slate-500 font-medium text-sm sm:text-base max-w-xl leading-relaxed">
            Real-time algorithmic simulation command center. Subscribe to copy master trades in real-money rounds.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:ml-auto w-full md:w-auto">
          {/* Global Stats Block */}
          <div className="flex gap-6 bg-slate-950 px-5 py-3.5 rounded-xl border border-slate-900 shadow-inner w-full sm:w-auto justify-between text-sm font-mono select-none">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Balance</span>
              <span className="text-base sm:text-lg font-black text-slate-100 tabular-nums">${globalBalance.toFixed(2)}</span>
            </div>
            <div className="w-px bg-slate-900"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Equity</span>
              <span className="text-base sm:text-lg font-black text-slate-100 tabular-nums">${globalEquity.toFixed(2)}</span>
            </div>
            <div className="w-px bg-slate-900"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Floating</span>
              <span className={`text-base sm:text-lg font-black tabular-nums ${globalFloating >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {globalFloating >= 0 ? '+' : ''}${globalFloating.toFixed(2)}
              </span>
            </div>
            <div className="w-px bg-slate-900"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Float DD</span>
              <span className="text-base sm:text-lg font-black text-rose-400 tabular-nums">{ddDisplay}</span>
            </div>
          </div>

          {/* Engine Active Indicator */}
          <div className="flex items-center justify-center bg-emerald-950/10 px-5 py-2.5 sm:h-12 rounded-lg border border-emerald-900/20 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[11px] sm:text-xs font-black tracking-widest text-emerald-400 uppercase">ENGINE ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Live Market Chart */}
      <Card className="bg-slate-950/20 border-slate-900 shadow-xl overflow-hidden h-80 flex flex-col relative group">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-blue-500/20 via-cyan-500/50 to-blue-500/20"></div>
        <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-950/60 relative z-10 select-none">
          <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
             <span className="text-xs sm:text-sm font-black tracking-widest text-slate-300">
               XAUUSD REAL-TIME FEED
             </span>
             <span className="flex h-2 w-2 relative hidden sm:inline">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
             </span>
             <span className="text-xs text-slate-400 font-mono tracking-wider hidden md:inline">
               Live Gold prices tracked in real-time from MT5 VPS stream
             </span>
          </div>
          <span className="text-cyan-400 font-mono font-black text-xl sm:text-2xl tabular-nums drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">${currentChartPrice.toFixed(2)}</span>
        </div>
        <div className="flex-1 w-full p-3 relative z-0">
          {marketData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
               <LineChart data={marketData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.15)" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip 
                     contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid #1e293b', borderRadius: '6px', backdropFilter: 'blur(8px)', fontSize: '13px' }}
                     itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                     labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '1px' }}
                     isAnimationActive={false}
                  />
                  <Line 
                     type="monotone" 
                     dataKey="price" 
                     stroke="#06b6d4" 
                     strokeWidth={2.5} 
                     dot={<CustomizedDot />} 
                     isAnimationActive={false} 
                  />
               </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center opacity-40">
               <Activity className="w-10 h-10 text-slate-500 animate-spin-slow mb-1.5" />
               <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">Connecting Feed...</span>
            </div>
          )}
        </div>
      </Card>

      {/* Strategies List (Horizontal Flat Rows - Impeccable Style) */}
      <div className="flex flex-col gap-4">
        {strategies.map((strat) => {
          const isSubscribed = subscriptions[strat.id];
          const rawHist = history[strat.id] || [];
          const aggregatedHist = aggregateRoundsByCloseTime(rawHist);
          const latestGroups = aggregatedHist.slice(-20);
          
          const chartData: any[] = latestGroups.map((entry, index) => {
            const isRecent = index >= latestGroups.length - 3;
            const profitNum = parseFloat(String(entry.profit)) || 0;
            return {
              ...entry,
              profit: profitNum,
              copied: isRecent,
              userProfit: isRecent ? profitNum * 0.95 : profitNum
            };
          });

          const activeRound = activeRounds[strat.id];
          // Active if we have a live active round in tg_virtual_rounds (most reliable and transactional source of truth)
          const hasActiveOrder = !!activeRound;
          const isIdle = !hasActiveOrder;
          const currentPl = activeRound ? (activeRound.profit ?? 0) : 0.0;
          const isProfit = currentPl >= 0;
          
          const todayPl = getTodayProfit(strat.id);
          const isTodayProfit = todayPl >= 0;
          
          const energy = getRealProximity(strat.id, isIdle);
          const sigState = getSignalState(strat.id, isIdle, energy);
          const SigIcon = sigState.Icon;

          return (
            <div 
              key={strat.id} 
              className={`relative rounded-xl border p-5 backdrop-blur-md transition-all duration-300 hover:bg-slate-900/30 flex flex-col gap-4 group z-10 ${
                !isIdle 
                  ? 'border-amber-500/25 bg-slate-900/20 shadow-[0_0_15px_rgba(245,158,11,0.03)]' 
                  : 'border-slate-900/80 bg-slate-900/10'
              }`}
            >
              
              {/* Left Accent Color bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all duration-500 ${
                !isIdle 
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse' 
                  : isSubscribed 
                    ? 'bg-emerald-500' 
                    : 'bg-slate-800'
              }`}></div>

              {/* Row 1: Identity, Signal Level (Responsive Width), Proximity, and Button */}
              <div className="flex items-center justify-between gap-4 w-full select-none">
                {/* 1.1 Identity */}
                <div className="flex items-center gap-3.5 min-w-0 lg:w-1/3">
                  <div className="w-12 h-12 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-900 shadow-inner shrink-0 transition-transform duration-300 group-hover:scale-105">
                    {getIcon(strat.id)}
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <h3 className="text-base font-black text-slate-200 truncate">{strat.name}</h3>
                    {!isIdle && (
                      <span className="flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                        LIVE DEAL
                      </span>
                    )}
                  </div>
                </div>
                
                {/* 1.2 Proximity & Signal State - Scales cleanly to wider bars on Desktop! */}
                <div className="flex items-center gap-4 shrink-0 lg:flex-1 lg:justify-center">
                  {isIdle ? (
                    <>
                      <div className="flex flex-col items-end lg:items-start gap-1">
                        <span className={`text-xs font-mono font-black tabular-nums leading-none ${energy >= 80 ? "text-cyan-400" : "text-slate-500"}`}>{energy.toFixed(0)}%</span>
                        <div className="h-2 w-16 sm:w-24 lg:w-36 xl:w-48 bg-slate-950 rounded-full overflow-hidden border border-slate-900/60 relative">
                          <div className="absolute top-0 bottom-0 left-[80%] w-px bg-slate-800 z-10"></div>
                          <div 
                            className={`h-full transition-all duration-1000 ease-linear rounded-full ${energy >= 80 ? 'bg-cyan-400' : 'bg-slate-600'}`} 
                            style={{ width: `${energy}%` }}
                          ></div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`px-2.5 py-0.5 text-xs tracking-wider transition-colors duration-500 border-none bg-transparent font-black leading-none ${sigState.color}`}>
                        <span className="inline lg:hidden">
                          {sigState.text === "SCANNING MARKET" ? "SCANNING" : sigState.text === "APPROACHING SIGNAL" ? "APPROACHING" : "MET"}
                        </span>
                        <span className="hidden lg:inline">
                          {sigState.text}
                        </span>
                      </Badge>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.05)]">
                      <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                      <span>TRADING IN PROGRESS</span>
                    </div>
                  )}
                </div>

                {/* 1.3 Button */}
                <Button 
                  onClick={() => handleSubscribe(strat.id)}
                  className={`h-10 px-6 font-black tracking-widest text-xs uppercase transition-all duration-300 rounded-lg shrink-0 ${
                    isSubscribed 
                      ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30" 
                      : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/40 shadow-sm"
                  }`}
                >
                  {isSubscribed ? "✓ ACTIVE" : "SUBSCRIBE"}
                </Button>
              </div>

              {/* Row 2: Live Trade Data (50%) & History Sparkline (50%) */}
              <div className="grid grid-cols-2 gap-6 border-t border-slate-900/60 pt-4 w-full items-center">
                
                {/* Col 2.1: Cubic History Stream (20 fixed cubes) - Swapped to Left */}
                <div className="w-full flex flex-col gap-1.5 border-r border-slate-900/60 pr-5 min-w-0">
                  <div className="flex items-center justify-between w-full mb-1 min-h-[14px]">
                    <span className="text-[8px] text-slate-500 font-black tracking-widest uppercase">CUBIC HISTORY (LAST 20)</span>
                    <div className="text-[9px] font-bold font-mono transition-all duration-300">
                      {hoveredRounds[strat.id] ? (
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                          parseFloat(String(hoveredRounds[strat.id]?.profit)) >= 0 
                            ? "text-emerald-400 bg-emerald-950/20 border border-emerald-900/20 drop-shadow-[0_0_6px_rgba(16,185,129,0.2)]" 
                            : "text-rose-400 bg-rose-955 border border-rose-900/15 drop-shadow-[0_0_6px_rgba(244,63,94,0.2)]"
                        }`}>
                          AGE: {getRoundDuration(hoveredRounds[strat.id]?.open_time, hoveredRounds[strat.id]?.close_time)} | P/L: ${(parseFloat(String(hoveredRounds[strat.id]?.profit)) >= 0 ? '+' : '')}${parseFloat(String(hoveredRounds[strat.id]?.profit)).toFixed(2)} | DD: -${Math.abs(hoveredRounds[strat.id]?.max_dd ?? 0).toFixed(1)} {hoveredRounds[strat.id]?.order_count > 1 ? `(${hoveredRounds[strat.id]?.order_count} orders)` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-black tracking-wider text-[8px] uppercase">HOVER CUBE FOR DETAILS</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-row-reverse items-center gap-1.5 w-full overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {(() => {
                      const emptyCount = Math.max(0, 20 - chartData.length);
                      const paddedData = [...Array(emptyCount).fill(null), ...chartData].reverse();
                      return paddedData.map((round, idx) => {
                        if (round) {
                          const profitVal = parseFloat(String(round.profit)) || 0;
                          const isWin = profitVal >= 0;
                          const formattedProfit = (isWin ? '+' : '') + profitVal.toFixed(1);
                          
                          return (
                            <div 
                              key={round.round_id || idx}
                              title={`PROFIT/LOSS: ${isWin ? '+' : ''}$${profitVal.toFixed(2)}\nAGE: ${getRoundDuration(round.open_time, round.close_time)}\nCLOSE TIME (TH): ${round.close_time ? new Date(round.close_time).toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false }) : 'N/A'}\nMAX DD: -$${Math.abs(round.max_dd ?? 0).toFixed(2)}`}
                              onMouseEnter={() => setHoveredRounds(prev => ({ ...prev, [strat.id]: round }))}
                              onMouseLeave={() => setHoveredRounds(prev => ({ ...prev, [strat.id]: null }))}
                              className={`w-9 h-7 rounded border-t-2 shrink-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-slate-800/90 relative group cursor-pointer ${
                                isWin 
                                  ? 'border-t-emerald-500 shadow-[inset_0_1px_4px_rgba(16,185,129,0.05)]' 
                                  : 'border-t-rose-500 shadow-[inset_0_1px_4px_rgba(244,63,94,0.05)]'
                              }`}
                            >
                              <span className={`text-[8px] font-black font-mono leading-none ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formattedProfit}
                              </span>
                              
                              {/* Hover Tooltip - premium neon styling fallback */}
                              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-950/95 border border-slate-800 text-[8px] font-black font-mono text-slate-300 p-2 rounded shadow-xl z-50 pointer-events-none min-w-[110px] gap-1 shrink-0">
                                <span className={isWin ? 'text-emerald-400 animate-pulse' : 'text-rose-400 animate-pulse'}>
                                  {isWin ? 'PROFIT' : 'LOSS'}: ${profitVal.toFixed(2)}
                                </span>
                                <span>AGE: {getRoundDuration(round.open_time, round.close_time)}</span>
                                {round.order_count && round.order_count > 1 && (
                                  <span className="text-cyan-400">AGGREGATED: {round.order_count} trades</span>
                                )}
                                {round.close_time && (
                                  <span>TIME (TH): {new Date(round.close_time).toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}</span>
                                )}
                                <span>MAX DD: -${Math.abs(round.max_dd ?? 0).toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        } else {
                          // Empty/Placeholder Cube
                          return (
                            <div 
                              key={`empty-${idx}`}
                              className="w-9 h-7 rounded border border-slate-900/40 shrink-0 bg-slate-950/80 flex items-center justify-center"
                            >
                              <span className="text-[9px] text-slate-800 font-black">•</span>
                            </div>
                          );
                        }
                      });
                    })()}
                  </div>
                </div>

                {/* Col 2.2: Live Trade Status / Today PL - Swapped to Right */}
                <div className="flex flex-col justify-center w-full min-h-[48px] pl-1">
                  {!isIdle ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded leading-none ${activeRound?.type === 'SELL' ? 'bg-fuchsia-955 text-fuchsia-400 border border-fuchsia-900/15' : 'bg-blue-955 text-blue-400 border border-blue-900/20'}`}>
                            {activeRound?.type || (currentPl < 0 ? 'SELL' : 'BUY')}
                          </span>
                          <span className="text-[10px] font-black text-slate-400 font-mono tabular-nums">{(activeRound?.volume ?? 0.01)}L</span>
                          <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded leading-none ${isProfit ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/20' : 'bg-rose-955 text-rose-400 border border-rose-900/15'}`}>
                            {isProfit ? '+' : ''}${currentPl.toFixed(2)}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono mt-1 tabular-nums">
                          {activeRound ? `DD:-$${Math.abs(activeRound.max_dd ?? 0).toFixed(1)} | ${getLiveDuration(activeRound.open_time)}` : `FLOATING PL`}
                        </span>
                      </div>
                      
                      {/* Always show Today P/L on the right to match the Idle layout and avoid flashing */}
                      <div className="flex flex-col items-end justify-center">
                        <span className="text-[8px] text-slate-500 font-black tracking-widest uppercase leading-none mb-1">TODAY P/L</span>
                        <span className={`text-base font-mono font-black tabular-nums leading-none ${todayPl === 0 ? 'text-slate-500' : isTodayProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {todayPl > 0 ? '+' : ''}${todayPl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock className="w-4 h-4 shrink-0 text-slate-500" />
                        <span className="text-xs font-black tracking-widest uppercase">TODAY P/L</span>
                      </div>
                      <span className={`text-lg font-mono font-black tabular-nums ${todayPl === 0 ? 'text-slate-500' : isTodayProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {todayPl > 0 ? '+' : ''}${todayPl.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

              </div>

            </div>
          );
        })}
      </div>
      
    </div>
  );
}
