'use client';

import { useMemo } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminInsightChartsProps {
    ibMemberships: any[];
    portStatuses: any[];
    profiles: any[];
    selectedAdmin: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE'];

export function AdminInsightCharts({ ibMemberships, portStatuses, profiles, selectedAdmin }: AdminInsightChartsProps) {
    // 1. IB Application Trend
    const ibTrendData = useMemo(() => {
        const data: Record<string, number> = {};
        const now = new Date();
        
        // Last 30 days
        for (let i = 30; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            data[dateStr] = 0;
        }

        ibMemberships.forEach(ib => {
            const date = new Date(ib.created_at);
            const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            if (data[dateStr] !== undefined) {
                data[dateStr]++;
            }
        });

        return Object.entries(data).map(([date, count]) => ({
            date,
            count
        }));
    }, [ibMemberships]);

    // 2. User Type Distribution (IB vs Regular)
    const userDistData = useMemo(() => {
        const ibCount = ibMemberships.filter(m => m.status === 'approved').length;
        const total = profiles.length;
        return [
            { name: 'IB Members', value: ibCount },
            { name: 'Regular Users', value: Math.max(0, total - ibCount) }
        ];
    }, [ibMemberships, profiles]);

    // 3. Port Financials (Top 5 Ports by Equity)
    const topPortsData = useMemo(() => {
        return [...portStatuses]
            .sort((a, b) => (b.equity || 0) - (a.equity || 0))
            .slice(0, 5)
            .map(p => ({
                name: `Port ${p.port_number}`,
                equity: p.equity || 0,
                balance: p.balance || 0
            }));
    }, [portStatuses]);

    return (
        <div className="space-y-6">
            <Card className="border-border/50 bg-card/30 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg">แนวโน้มการสมัคร IB (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={ibTrendData}>
                                <defs>
                                    <linearGradient id="colorIb" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#8884d8" fillOpacity={1} fill="url(#colorIb)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">สัดส่วนประเภทผู้ใช้งาน</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={userDistData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {userDistData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">TOP 5 พอร์ตขนาดใหญ่ (Equity vs Balance)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topPortsData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `฿${val/1000}k`} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="equity" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="balance" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
