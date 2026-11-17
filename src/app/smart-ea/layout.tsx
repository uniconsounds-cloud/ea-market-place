import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Smart EA Cockpit | EA Easy Shop',
    description: 'Smart Vortex Real-time Control and Telemetry Cockpit',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Smart EA',
    },
};

export default function SmartEALayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
