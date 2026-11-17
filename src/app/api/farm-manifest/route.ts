import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const portParam = searchParams.get('port') || '';
    const cleanPort = portParam.trim();

    let appName = 'FarmDemo';
    if (cleanPort) {
        if (cleanPort.toLowerCase() === 'demo') {
            appName = 'FarmDemo';
        } else {
            const last4 = cleanPort.length > 4 ? cleanPort.slice(-4) : cleanPort;
            appName = `Farm${last4}`;
        }
    }

    const startUrl = cleanPort && cleanPort.toLowerCase() !== 'demo' ? `/farm/${cleanPort}` : '/farm/demo';

    const manifest = {
        name: appName,
        short_name: appName,
        description: `EasyM Live Farm & Portfolio Tracker (${appName})`,
        start_url: startUrl,
        scope: '/farm',
        display: 'standalone',
        background_color: '#0c0a09',
        theme_color: '#0c0a09',
        orientation: 'any',
        icons: [
            {
                src: '/farm/farm_icon_192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
            },
            {
                src: '/farm/farm_icon_512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
            },
            {
                src: '/farm/farm_icon_maskable_512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
            }
        ]
    };

    return NextResponse.json(manifest, {
        headers: {
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
