
import React, { useMemo, useState } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie, 
    AreaChart, Area, ComposedChart, Legend 
} from 'recharts';
import { Transaction, Product, StoreSettings } from '../types';
import { 
    TrendingUp, DollarSign, Package, Award, 
    PieChart as PieIcon, BarChart3, Calendar, Filter, 
    Download, ArrowUpRight, ArrowDownRight, 
    Target, ShoppingBag, Users, Zap, Search,
    RefreshCw, ChevronRight, FileText, Activity,
    Banknote, Calculator, Percent, TrendingDown,
    Building2, Briefcase, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AnalyticsViewProps {
    transactions: Transaction[];
    products: Product[];
    settings: StoreSettings;
}

type TabMode = 'FINANCIAL_CENTER' | 'PRODUCT_MATRIZ' | 'TRENDS';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ transactions, products, settings }) => {
    const [activeTab, setActiveTab] = useState<TabMode>('FINANCIAL_CENTER');
    const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('MONTH');

    // --- MOTOR FINANCIERO AVANZADO ---
    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (dateFilter === 'TODAY') return transactions.filter(t => new Date(t.date) >= startOfDay && t.status !== 'CANCELED');
        if (dateFilter === 'WEEK') {
            const lastWeek = new Date(); lastWeek.setDate(now.getDate() - 7);
            return transactions.filter(t => new Date(t.date) >= lastWeek && t.status !== 'CANCELED');
        }
        if (dateFilter === 'MONTH') {
            const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return transactions.filter(t => new Date(t.date) >= startMonth && t.status !== 'CANCELED');
        }
        return transactions.filter(t => t.status !== 'CANCELED');
    }, [transactions, dateFilter]);

    const financialData = useMemo(() => {
        let totalRevenue = 0;
        let totalCostOfSales = 0;
        const dailyAgg: Record<string, { date: string, revenue: number, cost: number, profit: number }> = {};

        filteredTransactions.forEach(t => {
            let tCost = 0;
            const dateKey = new Date(t.date).toLocaleDateString();
            
            t.items.forEach(item => {
                const prod = products.find(p => p.id === item.id);
                const unitCost = prod?.cost || 0;
                tCost += (unitCost * item.quantity);
            });

            totalRevenue += t.total;
            totalCostOfSales += tCost;

            if (!dailyAgg[dateKey]) {
                dailyAgg[dateKey] = { date: dateKey, revenue: 0, cost: 0, profit: 0 };
            }
            dailyAgg[dateKey].revenue += t.total;
            dailyAgg[dateKey].cost += tCost;
            dailyAgg[dateKey].profit += (t.total - tCost);
        });

        const netProfit = totalRevenue - totalCostOfSales;
        const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
        const chartData = Object.values(dailyAgg).reverse();

        return { totalRevenue, totalCostOfSales, netProfit, marginPercent, chartData };
    }, [filteredTransactions, products]);

    const productMatriz = useMemo(() => {
        const perf: Record<string, { name: string, qty: number, revenue: number, cost: number, profit: number, margin: number, roi: number }> = {};
        
        filteredTransactions.forEach(t => {
            t.items.forEach(item => {
                if (!perf[item.id]) {
                    const prod = products.find(p => p.id === item.id);
                    perf[item.id] = { name: item.name, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0, roi: 0 };
                    (perf[item.id] as any).unitCost = prod?.cost || 0;
                }
                const p = perf[item.id];
                p.qty += item.quantity;
                p.revenue += (item.price * item.quantity);
                const costLine = (p as any).unitCost * item.quantity;
                p.cost += costLine;
                p.profit = p.revenue - p.cost;
                p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
                p.roi = p.cost > 0 ? (p.profit / p.cost) * 100 : 0;
            });
        });

        return Object.values(perf).sort((a, b) => b.profit - a.profit);
    }, [filteredTransactions, products]);

    // --- EXPORTACIÓN UNIFICADA PROFESIONAL ---
    const handleExportUnified = () => {
        // Estructura de datos para el reporte (AOA - Array of Arrays para mayor control)
        const headerRows = [
            [settings.name.toUpperCase()],
            ['INFORME MAESTRO DE RENTABILIDAD Y UTILIDADES'],
            [`Periodo: ${dateFilter === 'TODAY' ? 'Hoy' : dateFilter === 'WEEK' ? 'Últimos 7 días' : dateFilter === 'MONTH' ? 'Este Mes' : 'Todo el histórico'}`],
            [`Fecha de Generación: ${new Date().toLocaleString()}`],
            [''],
            ['--- RESUMEN EJECUTIVO FINANCIERO ---'],
            ['Métrica', 'Valor Acumulado'],
            ['Total Ingresos (Ventas)', `${settings.currency}${financialData.totalRevenue.toFixed(2)}`],
            ['Total Costos (Inversión)', `${settings.currency}${financialData.totalCostOfSales.toFixed(2)}`],
            ['UTILIDAD NETA (GANANCIA)', `${settings.currency}${financialData.netProfit.toFixed(2)}`],
            ['Margen de Ganancia Promedio', `${financialData.marginPercent.toFixed(2)}%`],
            [''],
            ['--- MATRIZ DETALLADA POR PRODUCTO ---'],
            ['Pos', 'Producto', 'Cant. Vendida', 'Ingreso Bruto', 'Costo de Venta', 'Utilidad Neta', 'Margen %', 'Retorno (ROI)']
        ];

        const dataRows = productMatriz.map((p, idx) => [
            idx + 1,
            p.name,
            p.qty,
            `${settings.currency}${p.revenue.toFixed(2)}`,
            `${settings.currency}${p.cost.toFixed(2)}`,
            `${settings.currency}${p.profit.toFixed(2)}`,
            `${p.margin.toFixed(1)}%`,
            `${p.roi.toFixed(1)}%`
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
        
        // Ajustar anchos de columna (Aproximado)
        worksheet['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Estado de Resultados");
        XLSX.writeFile(workbook, `Reporte_Financiero_PosGo_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto custom-scrollbar bg-[#f8fafc] pb-24 lg:pb-8">
            <div className="max-w-7xl mx-auto">
                
                {/* Header Institucional */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-slate-900 rounded-[2.2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100 transform -rotate-3">
                            <Briefcase className="w-10 h-10"/>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-1">Empresa: {settings.name}</p>
                            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Business Intelligence</h1>
                            <div className="flex items-center gap-2 mt-2 text-slate-400">
                                <Calendar className="w-4 h-4"/>
                                <span className="text-xs font-bold uppercase tracking-widest">{new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric', day: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map(f => (
                                <button key={f} onClick={() => setDateFilter(f)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${dateFilter === f ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                                    {f === 'TODAY' ? 'Hoy' : f === 'WEEK' ? '7 Días' : f === 'MONTH' ? 'Mes' : 'Histórico'}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleExportUnified} className="flex-1 md:flex-none px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl active:scale-95">
                            <Download className="w-5 h-5 text-emerald-400"/> Generar Reporte Maestro
                        </button>
                    </div>
                </div>

                {/* KPI BOARDS: RENTABILIDAD NETA PRIORIZADA */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="w-32 h-32"/></div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Ingreso Bruto</p>
                        <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{settings.currency}{financialData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                        <div className="mt-4 flex items-center gap-2 text-emerald-500 text-[10px] font-black">
                            <div className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center"><ArrowUpRight className="w-3 h-3"/></div>
                            FLUJO DE CAJA ENTRANTE
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><TrendingDown className="w-32 h-32"/></div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Costo de Ventas (COGS)</p>
                        <h3 className="text-4xl font-black text-rose-500 tracking-tighter">{settings.currency}{financialData.totalCostOfSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                        <div className="mt-4 flex items-center gap-2 text-slate-400 text-[10px] font-black">
                             INVERSIÓN EN MERCADERÍA
                        </div>
                    </div>

                    <div className="bg-emerald-500 p-8 rounded-[3.5rem] shadow-2xl shadow-emerald-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-125 transition-transform text-white"><Banknote className="w-32 h-32"/></div>
                        <p className="text-[11px] font-black text-emerald-100 uppercase tracking-[0.2em] mb-4">UTILIDAD NETA TOTAL</p>
                        <h3 className="text-5xl font-black text-white tracking-tighter">{settings.currency}{financialData.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                        <div className="mt-6 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-900 text-[11px] font-black uppercase">
                                <Percent className="w-4 h-4"/> Margen: {financialData.marginPercent.toFixed(1)}%
                            </div>
                            <div className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-black text-white uppercase tracking-widest">Estado: Saludable</div>
                        </div>
                    </div>
                </div>

                {/* TABS SELECTOR */}
                <div className="flex bg-slate-200/50 p-2 rounded-[2rem] w-fit mb-10">
                    {(['FINANCIAL_CENTER', 'PRODUCT_MATRIZ', 'TRENDS'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
                            {tab === 'FINANCIAL_CENTER' ? 'Sumatoria de Ganancias' : tab === 'PRODUCT_MATRIZ' ? 'Matriz de Rentabilidad' : 'Análisis de Tendencias'}
                        </button>
                    ))}
                </div>

                {/* CONTENIDO DINAMICO */}
                <div className="animate-fade-in space-y-10">
                    
                    {activeTab === 'FINANCIAL_CENTER' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             {/* Gráfico Maestra de Ganancia vs Costo */}
                             <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm h-[550px] flex flex-col">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Desempeño Financiero Diario</h3>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Comparativa Ingresos vs Utilidad</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500"></span> <span>Ventas</span></div>
                                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> <span>Utilidad</span></div>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={financialData.chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                            <XAxis dataKey="date" fontSize={9} stroke="#94a3b8" axisLine={false} tickLine={false} tickMargin={15}/>
                                            <YAxis fontSize={9} stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(v) => `${settings.currency}${v}`}/>
                                            <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px'}}/>
                                            <Area type="monotone" dataKey="revenue" fill="#6366f1" stroke="#6366f1" strokeWidth={0} fillOpacity={0.05} />
                                            <Bar dataKey="revenue" fill="#e0e7ff" radius={[10, 10, 0, 0]} barSize={25} />
                                            <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={5} dot={{r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff'}} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                             </div>

                             {/* Breakdown por categorías de rentabilidad */}
                             <div className="bg-slate-900 p-10 rounded-[4rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
                                 <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
                                 <div className="relative z-10">
                                     <h3 className="text-2xl font-black mb-1 tracking-tight">Análisis de Retorno</h3>
                                     <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-12">Cómo rinde tu capital</p>

                                     <div className="space-y-8">
                                         <div className="flex items-center gap-6">
                                             <div className="w-16 h-16 rounded-[1.8rem] bg-white/10 flex items-center justify-center text-emerald-400"><Calculator className="w-8 h-8"/></div>
                                             <div className="flex-1">
                                                 <div className="flex justify-between items-end mb-2">
                                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ROI Operativo</span>
                                                     <span className="text-2xl font-black">{financialData.totalCostOfSales > 0 ? ((financialData.netProfit / financialData.totalCostOfSales) * 100).toFixed(1) : 0}%</span>
                                                 </div>
                                                 <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                                     <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (financialData.netProfit / (financialData.totalCostOfSales || 1)) * 100)}%` }}></div>
                                                 </div>
                                             </div>
                                         </div>

                                         <div className="flex items-center gap-6">
                                             <div className="w-16 h-16 rounded-[1.8rem] bg-white/10 flex items-center justify-center text-indigo-400"><TrendingUp className="w-8 h-8"/></div>
                                             <div className="flex-1">
                                                 <div className="flex justify-between items-end mb-2">
                                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eficiencia Ventas</span>
                                                     <span className="text-2xl font-black">{financialData.marginPercent.toFixed(1)}%</span>
                                                 </div>
                                                 <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                                     <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${financialData.marginPercent}%` }}></div>
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="mt-12 p-6 bg-white/5 rounded-[2.5rem] border border-white/10">
                                     <div className="flex items-center gap-3 text-indigo-300 font-black text-[10px] uppercase mb-2">
                                         <Zap className="w-4 h-4 fill-current"/> Insight Estratégico
                                     </div>
                                     <p className="text-sm text-slate-400 leading-relaxed italic font-medium">
                                         "Por cada sol invertido en mercadería, el negocio está generando <span className="text-white font-bold">{settings.currency}{(financialData.netProfit / (financialData.totalCostOfSales || 1)).toFixed(2)}</span> de ganancia neta en este periodo."
                                     </p>
                                 </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'PRODUCT_MATRIZ' && (
                        <div className="bg-white rounded-[4rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Matriz de Rentabilidad Crítica</h3>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Ranking de utilidad real por producto</p>
                                </div>
                                <div className="flex gap-4">
                                     <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 font-black text-[10px] uppercase">
                                         <Award className="w-4 h-4"/> Top Rentabilidad
                                     </div>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                                        <tr>
                                            <th className="p-8">Ranking / Producto</th>
                                            <th className="p-8 text-center">Unidades</th>
                                            <th className="p-8 text-right">Venta (Total)</th>
                                            <th className="p-8 text-right">Costo (COGS)</th>
                                            <th className="p-8 text-right">Utilidad Neta</th>
                                            <th className="p-8 text-right">Margen %</th>
                                            <th className="p-8 text-right">ROI (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold text-sm">
                                        {productMatriz.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="p-8">
                                                    <div className="flex items-center gap-5">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all ${idx === 0 ? 'bg-amber-100 text-amber-600 shadow-lg shadow-amber-100' : 'bg-slate-100 text-slate-400'}`}>
                                                            {idx + 1}
                                                        </div>
                                                        <span className="text-slate-800 font-black truncate max-w-[220px]">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-8 text-center text-slate-400 font-black">{p.qty} items</td>
                                                <td className="p-8 text-right text-slate-900">{settings.currency}{p.revenue.toLocaleString()}</td>
                                                <td className="p-8 text-right text-slate-300">{settings.currency}{p.cost.toLocaleString()}</td>
                                                <td className="p-8 text-right">
                                                    <span className={`px-4 py-2 rounded-2xl font-black text-xs inline-block ${p.profit > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                        +{settings.currency}{p.profit.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="p-8 text-right font-black text-indigo-500">
                                                    {p.margin.toFixed(1)}%
                                                </td>
                                                <td className="p-8 text-right">
                                                    <div className="flex items-center justify-end gap-2 text-slate-700">
                                                        <span className="text-xs">{p.roi.toFixed(0)}%</span>
                                                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${Math.min(100, p.roi)}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {productMatriz.length === 0 && (
                                <div className="p-24 text-center text-slate-300 font-black">
                                    <ShoppingBag className="w-24 h-24 mx-auto mb-6 opacity-10"/>
                                    No se registran operaciones en este rango de fechas.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'TRENDS' && (
                        <div className="bg-white p-20 rounded-[4rem] border border-slate-100 shadow-sm text-center">
                             <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
                                 <RefreshCw className="w-12 h-12 animate-spin-slow"/>
                             </div>
                             <h3 className="text-3xl font-black text-slate-800 tracking-tight">Procesando Predictivo...</h3>
                             <p className="text-slate-400 max-w-lg mx-auto mt-4 font-bold text-sm uppercase tracking-widest leading-relaxed">
                                Estamos analizando patrones de consumo estacional para determinar tus próximos niveles de stock y rentabilidad proyectada.
                             </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
