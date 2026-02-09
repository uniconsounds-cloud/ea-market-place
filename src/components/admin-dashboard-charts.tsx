'use client';

import { useState, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AdminDashboardChartsProps {
    orders: any[];
    products: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function AdminDashboardCharts({ orders, products }: AdminDashboardChartsProps) {
    const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, all

    // 1. Process Sales Trend Data
    const salesTrendData = useMemo(() => {
        const data: Record<string, number> = {};
        const now = new Date();
        const daysToSubtract = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;

        // Initialize dates with 0
        for (let i = daysToSubtract; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            data[dateStr] = 0;
        }

        orders.forEach(order => {
            if (order.status !== 'completed') return;
            const date = new Date(order.created_at);

            // Filter by time range
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > daysToSubtract) return;

            const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            if (data[dateStr] !== undefined) {
                data[dateStr] += (order.amount || 0);
            }
        });

        return Object.entries(data).map(([date, amount]) => ({
            date,
            amount
        }));
    }, [orders, timeRange]);

    // 2. Process Top Products Data
    const topProductsData = useMemo(() => {
        const productSales: Record<string, number> = {};

        orders.forEach(order => {
            if (order.status !== 'completed') return;
            const product = products.find(p => p.id === order.product_id);
            const productName = product?.name || 'Unknown Product';
            productSales[productName] = (productSales[productName] || 0) + (order.amount || 0);
        });

        return Object.entries(productSales)
            .map(([name, sales]) => ({ name, sales }))
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5); // Top 5
    }, [orders, products]);

    // 3. Process Sales by Category
    const salesByCategoryData = useMemo(() => {
        const categorySales: Record<string, number> = {};

        orders.forEach(order => {
            if (order.status !== 'completed') return;
            // Assume products have a 'category' field, or default to 'EA'
            // Since we might not have category in orders->products join easily without strict typing,
            // we'll try to find the product in the passed 'products' array to get category.
            const product = products.find(p => p.id === order.product_id);
            // Use category or asset_class (platform is also an option but asset_class is better for grouping)
            const category = product?.category || product?.asset_class || 'EA';

            categorySales[category] = (categorySales[category] || 0) + (order.amount || 0);
        });

        return Object.entries(categorySales).map(([name, value]) => ({ name, value }));
    }, [orders, products]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Main Chart: Sales Trend */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-medium">ยอดขายรวม (Sales Trend)</CardTitle>
                    <div className="flex bg-muted rounded-lg p-1">
                        {['7d', '30d', 'all'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${timeRange === range
                                    ? 'bg-background shadow-sm text-foreground font-medium'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {range === '7d' ? '7 วันล่าสุด' : range === '30d' ? '30 วันล่าสุด' : 'ทั้งหมด'}
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `฿${value}`}
                                />

                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Secondary Chart: Top Products */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-medium">สินค้าขายดี (Top Products)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `฿${val}`} />
                                    <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip
                                        cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        formatter={(value: any) => [`฿${(value || 0).toLocaleString()}`, 'Sales']}
                                    />
                                    <Bar dataKey="sales" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Secondary Chart: Sales by Category */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-medium">สัดส่วนยอดขาย (By Category)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={salesByCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {salesByCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        formatter={(value: any) => [`฿${(value || 0).toLocaleString()}`, 'Revenue']}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
