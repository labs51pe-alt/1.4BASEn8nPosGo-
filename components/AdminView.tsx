
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Transaction, Product, CashShift, CashMovement, StoreSettings, PaymentMethod } from '../types';
import { TrendingUp, DollarSign, Package, Users, Award, Wallet, History, Eye, XCircle, RotateCcw, Clock, ArrowRightLeft, ShieldCheck, CheckCircle2, Smartphone, Zap, CreditCard, Banknote, ShoppingBag, RefreshCw, AlertTriangle, ArrowRight, Check, FileSpreadsheet, Info } from 'lucide-react';
import { StorageService } from '../services/storageService';
import * as XLSX from 'xlsx';

interface AdminViewProps {
    transactions?: Transaction[];
    products?: Product[];
    shifts?: CashShift[];
    movements?: CashMovement[];
    settings: StoreSettings;
    onRefresh?: () => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({ 
    transactions = [], 
    products = [], 
    shifts = [], 
    movements = [], 
    settings,
    onRefresh 
}) => {
    const [activeTab, setActiveTab] = useState<'KPI' | 'SHIFTS'>('KPI');
    const [selectedShift, setSelectedShift] = useState<CashShift | null>(null);
    const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null);
    const [refundMethod, setRefundMethod] = useState<PaymentMethod | 'original'>('original');
    const [isCanceling, setIsCanceling] = useState(false);
    const [cancelSuccess, setCancelSuccess] = useState(false);

    useEffect(() => {
        if (selectedShift) {
            const updated = shifts.find(s => s.id === selectedShift.id);
            if (updated) setSelectedShift(updated);
        }
    }, [shifts]);

    const validTransactions = useMemo(() => transactions.filter(t => t.status !== 'CANCELED'), [transactions]);
    const totalSales = validTransactions.reduce((acc, t) => acc + Number(t.total || 0), 0);
    const avgTicket = validTransactions.length > 0 ? totalSales / validTransactions.length : 0;
    const lowStockCount = products.filter(p => Number(p.stock || 0) < 10).length;

    const shiftTransactions = useMemo(() => {
        if (!selectedShift || !selectedShift.id) return [];
        return transactions
            .filter(t => (t.shiftId || (t as any).shift_id || '').toString() === selectedShift.id.toString())
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [selectedShift, transactions]);

    const handleExportShiftExcel = () => {
        if (!selectedShift || !selectedShift.id) return;
        const currency = settings.currency;
        const shiftMoves = movements.filter(m => m.shiftId === selectedShift.id);
        const manualIn = shiftMoves.filter(m => m.type === 'IN').reduce((s, m) => s + m.amount, 0);
        const manualOut = shiftMoves.filter(m => m.type === 'OUT').reduce((s, m) => s + m.amount, 0);
        const expectedCashInCaja = selectedShift.startAmount + selectedShift.totalSalesCash + manualIn - manualOut;

        const summaryData = [
            { "REPORTE": "--- GENERAL ---", "VALOR": "" },
            { "REPORTE": "ID Turno", "VALOR": selectedShift.id.slice(-6).toUpperCase() },
            { "REPORTE": "Apertura", "VALOR": new Date(selectedShift.startTime).toLocaleString() },
            { "REPORTE": "", "VALOR": "" },
            { "REPORTE": "--- EFECTIVO ---", "VALOR": "" },
            { "REPORTE": "Fondo Inicial", "VALOR": `${currency} ${selectedShift.startAmount.toFixed(2)}` },
            { "REPORTE": "Ventas Efectivo", "VALOR": `${currency} ${selectedShift.totalSalesCash.toFixed(2)}` },
            { "REPORTE": "Entradas/Salidas", "VALOR": `${currency} ${(manualIn - manualOut).toFixed(2)}` },
            { "REPORTE": "TOTAL EN CAJA", "VALOR": `${currency} ${expectedCashInCaja.toFixed(2)}` },
            { "REPORTE": "", "VALOR": "" },
            { "REPORTE": "--- DIGITAL ---", "VALOR": "" },
            { "REPORTE": "Yape", "VALOR": `${currency} ${selectedShift.totalSalesYape.toFixed(2)}` },
            { "REPORTE": "Plin", "VALOR": `${currency} ${selectedShift.totalSalesPlin.toFixed(2)}` },
            { "REPORTE": "Tarjeta", "VALOR": `${currency} ${selectedShift.totalSalesCard.toFixed(2)}` },
            { "REPORTE": "TOTAL VENTAS", "VALOR": `${currency} ${(selectedShift.totalSalesCash + selectedShift.totalSalesDigital).toFixed(2)}` }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumen");
        XLSX.writeFile(wb, `Reporte_Turno_${selectedShift.id.slice(-6)}.xlsx`);
    };

    const executeCancellation = async () => {
        if (!transactionToCancel || !selectedShift) return;
        setIsCanceling(true);
        try {
            await StorageService.cancelTransaction(transactionToCancel, selectedShift, refundMethod);
            if (onRefresh) await onRefresh();
            setCancelSuccess(true);
            setTimeout(() => {
                setTransactionToCancel(null);
                setCancelSuccess(false);
                setIsCanceling(false);
            }, 1500);
        } catch (e: any) { alert(e.message); setIsCanceling(false); }
    };

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto custom-scrollbar bg-[#f8fafc] pb-24 lg:pb-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mb-1">Administración</h1>
                        <p className="text-slate-500 font-medium text-xs sm:text-sm uppercase tracking-wider">Historial y Auditoría Cloud</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full sm:w-auto">
                        <button onClick={() => setActiveTab('KPI')} className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'KPI' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Estadísticas</button>
                        <button onClick={() => setActiveTab('SHIFTS')} className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${activeTab === 'SHIFTS' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Turnos</button>
                    </div>
                </div>

                {activeTab === 'KPI' ? (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Ventas', val: `S/${totalSales.toLocaleString()}`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                { label: 'Ticket', val: `S/${avgTicket.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Stock Bajo', val: `${lowStockCount} items`, icon: Package, color: 'text-pink-500', bg: 'bg-pink-50' },
                                { label: 'Turnos', val: shifts.length, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' }
                            ].map((k, i) => (
                                <div key={i} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                                    <div className={`p-2.5 ${k.bg} ${k.color} rounded-xl w-fit mb-3`}><k.icon className="w-5 h-5"/></div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-800">{k.val}</h3>
                                </div>
                            ))}
                        </div>
                        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-[350px]">
                             <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-500"/> Flujo de Ventas</h3>
                             <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={validTransactions.slice(0, 15).reverse().map(t => ({ t: new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), v: Number(t.total) }))}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="t" fontSize={9} stroke="#94a3b8" hide={window.innerWidth < 640}/>
                                    <YAxis fontSize={9} stroke="#94a3b8"/>
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}}/>
                                    <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={3} dot={false}/>
                                </LineChart>
                             </ResponsiveContainer>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        {/* Vista Desktop - Tabla */}
                        <div className="hidden lg:block bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <tr>
                                        <th className="p-6">ID / Apertura</th>
                                        <th className="p-6">Estado</th>
                                        <th className="p-6 text-right">Efectivo</th>
                                        <th className="p-6 text-center">Yape</th>
                                        <th className="p-6 text-center">Plin</th>
                                        <th className="p-6 text-center">Tarjeta</th>
                                        <th className="p-6 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-bold text-sm">
                                    {shifts.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-6">
                                                <p className="text-slate-800">#{s.id.slice(-6).toUpperCase()}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{new Date(s.startTime).toLocaleString()}</p>
                                            </td>
                                            <td className="p-6">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                                            </td>
                                            <td className="p-6 text-right text-emerald-600">S/{s.totalSalesCash.toFixed(2)}</td>
                                            <td className="p-6 text-center text-purple-600">S/{s.totalSalesYape.toFixed(2)}</td>
                                            <td className="p-6 text-center text-cyan-600">S/{s.totalSalesPlin.toFixed(2)}</td>
                                            <td className="p-6 text-center text-slate-500">S/{s.totalSalesCard.toFixed(2)}</td>
                                            <td className="p-6 text-right"><button onClick={() => setSelectedShift(s)} className="p-2 text-slate-400 hover:text-indigo-600"><Eye className="w-5 h-5"/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Vista Móvil - Tarjetas */}
                        <div className="lg:hidden space-y-4">
                            {shifts.map(s => (
                                <div key={s.id} onClick={() => setSelectedShift(s)} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm active:scale-95 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-black text-slate-800">Turno #{s.id.slice(-6).toUpperCase()}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(s.startTime).toLocaleDateString()} {new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-50">
                                        <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Efectivo</p><p className="text-xs font-black text-emerald-600">S/{s.totalSalesCash.toFixed(1)}</p></div>
                                        <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Yape</p><p className="text-xs font-black text-purple-600">S/{s.totalSalesYape.toFixed(1)}</p></div>
                                        <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Plin</p><p className="text-xs font-black text-cyan-600">S/{s.totalSalesPlin.toFixed(1)}</p></div>
                                    </div>
                                    <button className="w-full mt-2 py-2 bg-slate-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2">Ver Detalle Auditoría <ArrowRight className="w-3 h-3"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL AUDITORÍA - ADAPTADO A MÓVIL */}
            {selectedShift && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white w-full max-w-5xl h-[92vh] sm:h-[85vh] rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex w-12 h-12 bg-white/10 rounded-2xl items-center justify-center text-emerald-400"><ShieldCheck className="w-6 h-6"/></div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight leading-none mb-1">Corte de Turno #{selectedShift.id.slice(-6).toUpperCase()}</h2>
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{new Date(selectedShift.startTime).toLocaleString()}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedShift(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"><XCircle className="w-6 h-6"/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row bg-slate-50">
                             {/* Columna Izquierda: Finanzas (Prioridad en móvil) */}
                             <div className="w-full lg:w-80 p-6 sm:p-8 bg-white lg:border-r border-slate-200 lg:order-2">
                                 <div className="flex justify-between items-center mb-6">
                                     <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500"/> Cuadre Caja</h4>
                                     <button onClick={handleExportShiftExcel} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg lg:hidden"><FileSpreadsheet className="w-5 h-5"/></button>
                                 </div>
                                 <div className="space-y-3">
                                     <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                         <div><p className="text-[8px] font-black text-slate-400 uppercase">Efectivo</p><p className="font-black text-lg text-emerald-600">S/{selectedShift.totalSalesCash.toFixed(2)}</p></div>
                                         <Banknote className="w-6 h-6 text-emerald-200"/>
                                     </div>
                                     <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                         <div><p className="text-[8px] font-black text-slate-400 uppercase">Digital (Apps)</p><p className="font-black text-lg text-indigo-600">S/{selectedShift.totalSalesDigital.toFixed(2)}</p></div>
                                         <Smartphone className="w-6 h-6 text-indigo-200"/>
                                     </div>
                                     <div className="pt-4 border-t border-slate-100">
                                         <p className="text-[8px] font-black text-slate-400 uppercase text-center mb-1">Total del Turno</p>
                                         <p className="text-3xl font-black text-slate-900 text-center tracking-tighter">S/{(selectedShift.totalSalesCash + selectedShift.totalSalesDigital).toFixed(2)}</p>
                                     </div>
                                     <button onClick={handleExportShiftExcel} className="hidden lg:flex w-full mt-6 py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95">
                                         <FileSpreadsheet className="w-4 h-4"/> Exportar Reporte
                                     </button>
                                 </div>
                             </div>

                             {/* Columna Derecha: Transacciones */}
                             <div className="flex-1 flex flex-col lg:order-1 overflow-hidden">
                                 <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                                     <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest flex items-center gap-2"><History className="w-4 h-4 text-indigo-500"/> Transacciones ({shiftTransactions.length})</h4>
                                 </div>
                                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
                                     {shiftTransactions.map(t => (
                                         <div key={t.id} className={`bg-white rounded-2xl p-4 border flex justify-between items-center shadow-sm ${t.status === 'CANCELED' ? 'opacity-40 grayscale border-rose-100 bg-rose-50/20' : 'border-slate-100 hover:border-indigo-100 transition-all'}`}>
                                             <div className="min-w-0 pr-3">
                                                 <p className="font-black text-slate-800 text-xs truncate">Tkt #{t.id.slice(-6).toUpperCase()} • {new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                                 <div className="flex gap-1 mt-1 flex-wrap">
                                                     {t.items.map((i, idx) => <span key={idx} className="bg-slate-100 text-[8px] font-bold px-1.5 py-0.5 rounded text-slate-500 uppercase">{i.quantity}x {i.name.slice(0,10)}..</span>)}
                                                 </div>
                                             </div>
                                             <div className="flex items-center gap-3 shrink-0">
                                                 <p className={`font-black text-sm tracking-tight ${t.status === 'CANCELED' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>S/{t.total.toFixed(2)}</p>
                                                 {t.status !== 'CANCELED' && (
                                                     <button onClick={() => setTransactionToCancel(t)} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 hover:bg-rose-500 hover:text-white rounded-lg transition-all"><RotateCcw className="w-4 h-4"/></button>
                                                 )}
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ANULACION */}
            {transactionToCancel && (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-fade-in-up">
                         {cancelSuccess ? (
                            <div className="p-12 text-center space-y-4">
                                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto animate-bounce text-white"><Check className="w-10 h-10 stroke-[4px]"/></div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Venta Anulada</h2>
                                <p className="text-slate-400 font-bold text-sm">Balances y Stock sincronizados.</p>
                            </div>
                         ) : (
                            <>
                                <div className="p-8 bg-rose-600 text-white text-center">
                                    <RotateCcw className="w-10 h-10 mx-auto mb-4 opacity-50"/>
                                    <h3 className="text-xl font-black">Confirmar Reembolso</h3>
                                    <p className="text-rose-100 text-[10px] font-bold uppercase mt-1 tracking-widest">TICKET #{transactionToCancel.id.slice(-8).toUpperCase()} • S/{transactionToCancel.total.toFixed(2)}</p>
                                </div>
                                <div className="p-8 space-y-6">
                                     <div className="grid grid-cols-2 gap-2">
                                         {['original', 'cash', 'yape', 'plin'].map(m => (
                                             <button key={m} onClick={() => setRefundMethod(m as any)} className={`p-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all ${refundMethod === m ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm scale-[1.05]' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                                 {m === 'original' ? `Original (${transactionToCancel.paymentMethod})` : m}
                                             </button>
                                         ))}
                                     </div>
                                     <div className="flex gap-3 pt-4">
                                         <button onClick={() => setTransactionToCancel(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase">Salir</button>
                                         <button onClick={executeCancellation} disabled={isCanceling} className="flex-[1.5] py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-95 disabled:opacity-50">
                                             {isCanceling ? 'Sincronizando...' : 'Sí, Anular Venta'}
                                         </button>
                                     </div>
                                </div>
                            </>
                         )}
                    </div>
                </div>
            )}
        </div>
    );
};
