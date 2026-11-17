import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'EasyM Farm - พอร์ตฟาร์มผลผลิตสด',
    description: 'EasyM Live Farm & Portfolio Tracker',
    manifest: '/farm-manifest.json',
    icons: {
        icon: [
            { url: '/farm/farm_icon_32.png', sizes: '32x32', type: 'image/png' },
            { url: '/farm/farm_icon_48.png', sizes: '48x48', type: 'image/png' },
            { url: '/farm/farm_icon_192.png', sizes: '192x192', type: 'image/png' },
            { url: '/farm/farm_icon_512.png', sizes: '512x512', type: 'image/png' },
        ],
        shortcut: '/farm/farm_icon_48.png',
        apple: [
            { url: '/farm/farm_apple_touch_icon.png', sizes: '180x180', type: 'image/png' },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'EasyM Farm',
    },
};

export default function FarmLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
