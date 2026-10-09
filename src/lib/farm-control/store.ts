import fs from 'fs';
import path from 'path';

export interface PortSymbolConfig {
    enabled?: boolean;       // true = active, false = disabled (close-only)
    close_only?: boolean;    // true = close-only (equivalent to enabled: false)
    quarantined?: boolean;   // true = quarantined
}

export interface PortControlConfig {
    port_number: string;
    control_mode: 'web' | 'manual';
    port_mode?: 'NORMAL' | 'SLOW' | 'FREEZE';
    pause_new_orders?: boolean;
    symbols?: Record<string, PortSymbolConfig>;
    max_dd_limit?: number;
    updated_at: number; // Unix timestamp in seconds
}

// Global in-memory cache for ultra-fast response
const memoryCache: Record<string, PortControlConfig> = {};

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

export function updatePortControl(
    portNumber: string, 
    partial: Partial<PortControlConfig>
): PortControlConfig {
    const cleanPort = String(portNumber).trim();
    const current = getPortControl(cleanPort);

    const updated: PortControlConfig = {
        ...current,
        ...partial,
        port_number: cleanPort,
        symbols: {
            ...(current.symbols || {}),
            ...(partial.symbols || {})
        },
        updated_at: Math.floor(Date.now() / 1000)
    };

    memoryCache[cleanPort] = updated;

    const all = loadAllFromDisk();
    all[cleanPort] = updated;
    saveAllToDisk(all);

    return updated;
}
