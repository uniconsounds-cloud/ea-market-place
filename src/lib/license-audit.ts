import { SupabaseClient } from '@supabase/supabase-js';

export const STOREFRONT_VISIBILITY_CONFIG_KEY = 'storefront_visibility_config';
export const LICENSE_AUDIT_CONFIG_KEY = 'license_audit_log_config';

export interface StorefrontVisibilityMap {
    // key: product.id or product.product_key -> boolean (true = show on storefront, false = hide from storefront)
    byProductId: Record<string, boolean>;
    byProductKey: Record<string, boolean>;
    updatedAt?: string;
}

export interface LicenseAuditEntry {
    updatedAt: string;
    updatedBy: 'admin' | 'auto';
    actorLabel?: string; // e.g. 'แอดมิน' | 'อัตโนมัติ'
    reason?: string;     // e.g. 'หมดอายุอัตโนมัติ' | 'อนุมัติออเดอร์' | 'แก้ไขสิทธิ์โดยแอดมิน'
}

export type LicenseAuditMap = Record<string, LicenseAuditEntry>;

/**
 * Reads the storefront visibility map from farm_port_status (port_number = 'storefront_visibility_config').
 */
export async function fetchStorefrontVisibilityConfig(supabase: SupabaseClient): Promise<StorefrontVisibilityMap> {
    const defaultMap: StorefrontVisibilityMap = {
        byProductId: {},
        byProductKey: {
            'EZM-PRIME-V1': false, // Prime defaults to hidden on public storefront while Active in system
        }
    };

    try {
        const { data } = await supabase
            .from('farm_port_status')
            .select('system_code')
            .eq('port_number', STOREFRONT_VISIBILITY_CONFIG_KEY)
            .maybeSingle();

        if (data?.system_code) {
            const parsed = JSON.parse(data.system_code);
            return {
                byProductId: parsed.byProductId || {},
                byProductKey: {
                    'EZM-PRIME-V1': false,
                    ...(parsed.byProductKey || {})
                },
                updatedAt: parsed.updatedAt
            };
        }
    } catch (e) {
        // Fallback to default map
    }

    return defaultMap;
}

/**
 * Saves storefront visibility for a specific product (by ID and optional product_key).
 */
export async function saveProductStorefrontVisibility(
    supabase: SupabaseClient,
    productId: string,
    productKey: string | null | undefined,
    showOnStore: boolean
): Promise<void> {
    try {
        const current = await fetchStorefrontVisibilityConfig(supabase);
        if (productId) {
            current.byProductId[productId] = showOnStore;
        }
        if (productKey) {
            current.byProductKey[productKey] = showOnStore;
        }
        current.updatedAt = new Date().toISOString();

        await supabase
            .from('farm_port_status')
            .upsert({
                port_number: STOREFRONT_VISIBILITY_CONFIG_KEY,
                system_code: JSON.stringify(current),
                is_online: false,
                updated_at: current.updatedAt
            }, { onConflict: 'port_number' });
    } catch (e) {
        console.error('Error saving storefront visibility config:', e);
    }
}

/**
 * Determines whether a product should be shown on the public storefront (/ and /products).
 */
export function isProductShownOnStore(product: any, config: StorefrontVisibilityMap): boolean {
    if (!product) return false;
    // If product has native show_on_store boolean column set, respect config first or column
    if (product.id && typeof config.byProductId[product.id] === 'boolean') {
        return config.byProductId[product.id];
    }
    if (product.product_key && typeof config.byProductKey[product.product_key] === 'boolean') {
        return config.byProductKey[product.product_key];
    }
    if (typeof product.show_on_store === 'boolean') {
        return product.show_on_store;
    }
    // Default for EasyM Prime is hidden from storefront unless toggled ON
    if (product.product_key === 'EZM-PRIME-V1') {
        return false;
    }
    return Boolean(product.is_active);
}

/**
 * Reads the license audit log map from farm_port_status (port_number = 'license_audit_log_config').
 */
export async function fetchLicenseAuditMap(supabase: SupabaseClient): Promise<LicenseAuditMap> {
    try {
        const { data } = await supabase
            .from('farm_port_status')
            .select('system_code')
            .eq('port_number', LICENSE_AUDIT_CONFIG_KEY)
            .maybeSingle();

        if (data?.system_code) {
            const parsed = JSON.parse(data.system_code);
            if (parsed && typeof parsed === 'object') {
                return parsed as LicenseAuditMap;
            }
        }
    } catch (e) {
        // Ignore parse/read error
    }
    return {};
}

/**
 * Records audit metadata (updatedAt & updatedBy: 'admin' | 'auto') for one or more license IDs.
 */
export async function recordLicenseAudit(
    supabase: SupabaseClient,
    licenseIds: string[],
    updatedBy: 'admin' | 'auto',
    reason?: string,
    customTimestamp?: string
): Promise<LicenseAuditMap> {
    if (!licenseIds || licenseIds.length === 0) return {};
    const nowIso = customTimestamp || new Date().toISOString();

    try {
        const currentMap = await fetchLicenseAuditMap(supabase);
        for (const id of licenseIds) {
            if (!id) continue;
            currentMap[id] = {
                updatedAt: nowIso,
                updatedBy,
                actorLabel: updatedBy === 'admin' ? 'แอดมิน' : 'อัตโนมัติ',
                reason: reason || (updatedBy === 'admin' ? 'แก้ไขโดยแอดมิน' : 'หมดอายุอัตโนมัติ')
            };
        }

        // Keep map compact (at most 2500 most recent entries if it ever grows large)
        const keys = Object.keys(currentMap);
        if (keys.length > 2500) {
            const sortedKeys = keys.sort((a, b) => {
                const tA = new Date(currentMap[a]?.updatedAt || 0).getTime();
                const tB = new Date(currentMap[b]?.updatedAt || 0).getTime();
                return tB - tA;
            });
            const trimmed: LicenseAuditMap = {};
            for (const k of sortedKeys.slice(0, 2500)) {
                trimmed[k] = currentMap[k];
            }
            await supabase
                .from('farm_port_status')
                .upsert({
                    port_number: LICENSE_AUDIT_CONFIG_KEY,
                    system_code: JSON.stringify(trimmed),
                    is_online: false,
                    updated_at: nowIso
                }, { onConflict: 'port_number' });
            return trimmed;
        }

        await supabase
            .from('farm_port_status')
            .upsert({
                port_number: LICENSE_AUDIT_CONFIG_KEY,
                system_code: JSON.stringify(currentMap),
                is_online: false,
                updated_at: nowIso
            }, { onConflict: 'port_number' });

        return currentMap;
    } catch (e) {
        console.error('Error recording license audit:', e);
        return {};
    }
}

/**
 * Sweeps all currently active licenses whose expiry_date has passed,
 * automatically sets `is_active: false`, and logs `updatedBy: 'auto'` (อัตโนมัติ) with the timestamp.
 */
export async function sweepAndDeactivateExpiredLicenses(supabase: SupabaseClient): Promise<string[]> {
    const now = new Date();
    const nowIso = now.toISOString();

    try {
        const { data: candidates, error } = await supabase
            .from('licenses')
            .select('id, type, expiry_date, is_ib_request, ib_broker_name, is_active')
            .eq('is_active', true)
            .not('expiry_date', 'is', null)
            .lt('expiry_date', nowIso);

        if (error || !candidates || candidates.length === 0) {
            return [];
        }

        // Filter out pure non-IB lifetime licenses (in case any lifetime license had a legacy expiry_date)
        const expiredLicenses = candidates.filter((l: any) => {
            const isIb = l.type === 'ib' || Boolean(l.is_ib_request) || Boolean(l.ib_broker_name);
            if (!isIb && l.type === 'lifetime') {
                return false;
            }
            return true;
        });

        if (expiredLicenses.length === 0) {
            return [];
        }

        const expiredIds = expiredLicenses.map((l: any) => l.id);

        const { error: updateErr } = await supabase
            .from('licenses')
            .update({ is_active: false })
            .in('id', expiredIds);

        if (updateErr) {
            console.error('Error auto-deactivating expired licenses:', updateErr);
            return [];
        }

        await recordLicenseAudit(
            supabase,
            expiredIds,
            'auto',
            'ระบบปิดการใช้งานอัตโนมัติ (ครบกำหนดวันหมดอายุ)',
            nowIso
        );

        return expiredIds;
    } catch (e) {
        console.error('Exception in sweepAndDeactivateExpiredLicenses:', e);
        return [];
    }
}

/**
 * Resolves the display metadata (updatedAt & updatedBy) for a license row,
 * combining explicit audit log entries with intelligent fallback for existing rows.
 */
export function resolveLicenseAuditInfo(
    license: any,
    auditMap: LicenseAuditMap
): { updatedAt: string | null; updatedBy: 'admin' | 'auto'; label: string; reason: string } {
    const entry = license?.id ? auditMap[license.id] : undefined;
    if (entry) {
        return {
            updatedAt: entry.updatedAt,
            updatedBy: entry.updatedBy,
            label: entry.updatedBy === 'auto' ? 'อัตโนมัติ' : 'แอดมิน',
            reason: entry.reason || (entry.updatedBy === 'auto' ? 'หมดอายุอัตโนมัติ' : 'แก้ไขโดยแอดมิน')
        };
    }

    // Fallback if native columns exist on the license row
    if (license?.updated_by || license?.updated_at) {
        const isAuto = String(license.updated_by || '').toLowerCase().includes('auto') || license.updated_by === 'อัตโนมัติ';
        return {
            updatedAt: license.updated_at || license.created_at || null,
            updatedBy: isAuto ? 'auto' : 'admin',
            label: isAuto ? 'อัตโนมัติ' : 'แอดมิน',
            reason: isAuto ? 'หมดอายุอัตโนมัติ' : 'จัดการโดยแอดมิน'
        };
    }

    // Intelligent fallback for historical records:
    // If license is currently Inactive and its expiry_date is in the past, it was deactivated due to expiration
    const isIb = license?.is_ib || license?.type === 'ib' || Boolean(license?.is_ib_request) || Boolean(license?.ib_broker_name);
    const isExpired = (!isIb && license?.type === 'lifetime')
        ? false
        : Boolean(license?.expiry_date && new Date(license.expiry_date) < new Date());

    if (!license?.is_active && isExpired) {
        return {
            updatedAt: license.expiry_date || license.created_at || null,
            updatedBy: 'auto',
            label: 'อัตโนมัติ',
            reason: 'ครบกำหนดวันหมดอายุ'
        };
    }

    return {
        updatedAt: license?.created_at || null,
        updatedBy: 'admin',
        label: 'แอดมิน',
        reason: 'อนุมัติ/ตั้งค่าโดยแอดมิน'
    };
}
