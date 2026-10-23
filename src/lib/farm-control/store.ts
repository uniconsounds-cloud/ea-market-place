import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabaseClient';

export interface PortSymbolConfig {
    enabled?: boolean;       // true = active, false = disabled (close-only)
    close_only?: boolean;    // true = close-only (equivalent to enabled: false)
    quarantined?: boolean;   // true = quarantined
}

export interface LiveOrder {
    ticket: number;
    symbol: string;
    type: 'BUY' | 'SELL';
    lots: number;
    open_price: number;
    current_price: number;
    sl: number;
    tp: number;
    profit: number;
    comment: string;
    magic: number;
    open_time?: string;
}

export interface PortControlConfig {
    port_number: string;
    control_mode: 'web' | 'manual';
    port_mode?: 'NORMAL' | 'SLOW' | 'FREEZE';
    pause_new_orders?: boolean;
    symbols?: Record<string, PortSymbolConfig>;
    max_dd_limit?: number;
    command_seq?: number;
    updated_at: number; // Unix timestamp in seconds
}

// Global in-memory cache for ultra-fast response
const memoryCache: Record<string, PortControlConfig> = {};
const memoryLiveOrders: Record<string, { orders: LiveOrder[]; updated_at: number }> = {};
const memoryViewerPings: Record<string, number> = {};

const DATA_DIR = path.join(process.cwd(), '.farm_data');
const DATA_FILE = path.join(DATA_DIR, 'port_controls.json');

function ensureDataFile() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
        }
    } catch (e) {
        console.warn('[FarmControl] Failed to ensure data file:', e);
    }
}

function loadAllFromDisk(): Record<string, PortControlConfig> {
    try {
        ensureDataFile();
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[FarmControl] Failed to load data file:', e);
    }
    return {};
}

function saveAllToDisk(all: Record<string, PortControlConfig>) {
    try {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[FarmControl] Failed to write data file:', e);
    }
}

export function getPortControl(portNumber: string): PortControlConfig {
    const cleanPort = String(portNumber).trim();
    if (memoryCache[cleanPort]) {
        return memoryCache[cleanPort];
    }
    const all = loadAllFromDisk();
    if (all[cleanPort]) {
        memoryCache[cleanPort] = all[cleanPort];
        return all[cleanPort];
    }

    // Default configuration for EasyM Prime
    const defaultConfig: PortControlConfig = {
        port_number: cleanPort,
        control_mode: 'web',
        port_mode: 'NORMAL',
        pause_new_orders: false,
        symbols: {},
        updated_at: Math.floor(Date.now() / 1000)
    };
    memoryCache[cleanPort] = defaultConfig;
    return defaultConfig;
}

export async function getPortControlAsync(portNumber: string): Promise<PortControlConfig> {
    const cleanPort = String(portNumber).trim();
    if (memoryCache[cleanPort] && (Date.now() / 1000 - memoryCache[cleanPort].updated_at < 5)) {
        return memoryCache[cleanPort];
    }

    try {
        const { data } = await supabase
            .from('farm_port_status')
            .select('system_code')
            .eq('port_number', `cmd_${cleanPort}`)
            .maybeSingle();

        if (data?.system_code) {
            try {
                const parsed = JSON.parse(data.system_code);
                if (parsed && typeof parsed === 'object') {
                    memoryCache[cleanPort] = {
                        ...getPortControl(cleanPort),
                        ...parsed,
                        port_number: cleanPort
                    };
                    return memoryCache[cleanPort];
                }
            } catch (err) {
                console.warn('[FarmControl] Failed to parse cmd JSON:', err);
            }
        }
    } catch (e) {
        console.warn('[FarmControl] Supabase load error:', e);
    }

    return getPortControl(cleanPort);
}

export function updatePortControl(
    portNumber: string, 
    partial: Partial<PortControlConfig>
): PortControlConfig {
    const cleanPort = String(portNumber).trim();
    const current = getPortControl(cleanPort);

    const nextSeq = partial.command_seq !== undefined ? partial.command_seq : ((current.command_seq || 0) + 1);
    const updated: PortControlConfig = {
        ...current,
        ...partial,
        port_number: cleanPort,
        symbols: {
            ...(current.symbols || {}),
            ...(partial.symbols || {})
        },
        command_seq: nextSeq,
        updated_at: partial.updated_at !== undefined ? partial.updated_at : Math.floor(Date.now() / 1000)
    };

    memoryCache[cleanPort] = updated;

    const all = loadAllFromDisk();
    all[cleanPort] = updated;
    saveAllToDisk(all);

    return updated;
}

export async function updatePortControlAsync(
    portNumber: string,
    partial: Partial<PortControlConfig>
): Promise<PortControlConfig> {
    const cleanPort = String(portNumber).trim();
    const updated = updatePortControl(cleanPort, partial);

    try {
        await supabase
            .from('farm_port_status')
            .upsert({
                port_number: `cmd_${cleanPort}`,
                system_code: JSON.stringify(updated),
                updated_at: new Date().toISOString()
            }, { onConflict: 'port_number' });
    } catch (e) {
        console.warn('[FarmControl] Failed to persist cmd to Supabase:', e);
    }

    return updated;
}

// ==========================================
// 📡 ON-DEMAND LIVE ORDERS STREAMING STORE
// ==========================================

export function saveLiveOrders(portNumber: string, orders: LiveOrder[]) {
    const cleanPort = String(portNumber).trim();
    const payload = {
        orders: Array.isArray(orders) ? orders : [],
        updated_at: Math.floor(Date.now() / 1000)
    };
    memoryLiveOrders[cleanPort] = payload;

    // Optional disk backup for persistence between server reloads
    try {
        ensureDataFile();
        const liveFile = path.join(DATA_DIR, `live_orders_${cleanPort}.json`);
        fs.writeFileSync(liveFile, JSON.stringify(payload), 'utf-8');
    } catch (e) {
        // Non-blocking disk write
    }
}

export function getLiveOrders(portNumber: string): { orders: LiveOrder[]; updated_at: number } {
    const cleanPort = String(portNumber).trim();
    if (memoryLiveOrders[cleanPort]) {
        return memoryLiveOrders[cleanPort];
    }
    try {
        const liveFile = path.join(DATA_DIR, `live_orders_${cleanPort}.json`);
        if (fs.existsSync(liveFile)) {
            const raw = fs.readFileSync(liveFile, 'utf-8');
            const parsed = JSON.parse(raw);
            memoryLiveOrders[cleanPort] = parsed;
            return parsed;
        }
    } catch (e) {
        // Fallback
    }
    return { orders: [], updated_at: 0 };
}

// ==========================================
// 👁️ VIEWER PRESENCE TRACKING
// ==========================================

export function recordViewerPing(portNumber: string) {
    const cleanPort = String(portNumber).trim();
    memoryViewerPings[cleanPort] = Date.now();
}

export function isViewerActiveForPort(portNumber: string, maxInactiveMs: number = 120000): boolean {
    const cleanPort = String(portNumber).trim();
    const lastPing = memoryViewerPings[cleanPort] || 0;
    return (Date.now() - lastPing) < maxInactiveMs;
}
