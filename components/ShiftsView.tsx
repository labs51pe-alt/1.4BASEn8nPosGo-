
import React, { useMemo, useState } from 'react';
import { CashShift, Transaction, Product, StoreSettings, CashMovement, PaymentMethod } from '../types';
import { 
    Wallet, History, Eye, XCircle, RotateCcw, Clock, 
    ShieldCheck, Smartphone, Zap, CreditCard, Banknote, 
    RefreshCw, AlertTriangle, ArrowRight, Check, FileSpreadsheet,
    DollarSign, TrendingUp, Package, Users, Plus, CheckCircle2,
    X, ArrowUpRight, Receipt, Box
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ShiftsViewProps {
    shifts: CashShift[];
    transactions: Transaction[];
    products: Product[];
    movements: CashMovement[];
    settings: StoreSettings;
    onOpenCashControl: () => void;
    onRefresh: () => Promise<void>;
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({
    shifts, transactions, products, movements, settings, onOpenCashControl, onRefresh
}) => {
    const [selectedShift, setSelectedShift] = useState<CashShift | null>(null);

    const totalSalesAllTime = useMemo(() => transactions.filter(t => t.status !== 'CANCELED').reduce((acc, t) => acc + t.total, 0), [transactions]);
    const avgTicket = useMemo(() => transactions.length > 0 ? totalSalesAllTime / transactions.length : 0, [transactions, totalSalesAllTime]);
    const lowStockCount = useMemo(() => products.filter(p => p.stock < 10).length, [products]);

    // Función auxiliar para formatear los métodos de pago para Excel
    const formatPaymentMethods = (t: Transaction) => {
        if (t.payments && t.payments.length > 0) {
            return t.payments.map(p => `${p.method.toUpperCase()} (S/${p.amount.toFixed(2)})`).join(' + ');
        }
        return (t.paymentMethod || 'OTROS').toUpperCase();
    };

    const handleExportShift = (s: CashShift) => {
        const shiftTrans = transactions.filter(t => t.shiftId === s.id);
        const data = shiftTrans.flatMap(t => t.items.map(i => ({
            Ticket: t.id.slice(-6).toUpperCase(),
            Fecha: new Date(t.date).toLocaleString(),
            Producto: i.name,
            Cantidad: i.quantity,
            Precio_Unit: i.price,
            Total_Linea: i.price * i.quantity,
            Metodo_Pago: formatPaymentMethods(t), // Lógica corregida para mostrar métodos reales
            Status: t.status || 'COMPLETED'
        })));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Detalle Turno");
        XLSX.writeFile(wb, `Arqueo_Turno_${s.id.slice(-6).toUpperCase()}.xlsx`);
    };

    const shiftTransactions = useMemo(() => {
        if (!selectedShift) return [];
        return transactions.filter(t => t.shiftId === selectedShift.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [selectedShift, transactions]);

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto custom-scrollbar bg-[#f8fafc] pb-24 lg:pb-8">
            {/* KPI BOARD */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit mb-3"><DollarSign className="w-5 h-5"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">{settings.currency}{totalSalesAllTime.toLocaleString('es-PE', { minimumFractionDigits: 1 })}</h3>
                </div>
                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in animation-delay-100">
                    <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl w-fit mb-3"><TrendingUp className="w-5 h-5"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">{settings.currency}{avgTicket.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in animation-delay-200">
                    <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl w-fit mb-3"><Package className="w-5 h-5"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Bajo</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">{lowStockCount} items</h3>
                </div>
                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in animation-delay-300">
                    <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl w-fit mb-3"><Users className="w-5 h-5"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Turnos</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">{shifts.length}</h3>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Wallet className="w-6 h-6 text-indigo-600"/> Historial de Turnos</h2>
                <button onClick={onOpenCashControl} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><Plus className="w-5 h-5"/> Abrir / Cerrar Caja</button>
            </div>

            {/* TABLA DE TURNOS */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
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
                                <td className="p-6 text-right">
                                    <button onClick={() => setSelectedShift(s)} className="p-2 text-slate-400 hover:text-indigo-600"><Eye className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL ARQUEO DE TURNO */}
            {selectedShift && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-6">
                    <div className="bg-white w-full max-w-6xl h-[92vh] sm:h-[85vh] rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border border-white/20">
                        
                        <div className="p-6 sm:p-8 border-b border-white/5 bg-[#0f172a] text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner"><CheckCircle2 className="w-6 h-6"/></div>
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-none mb-1.5">Arqueo de Turno #{selectedShift.id.slice(-6).toUpperCase()}</h2>
                                    <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">{new Date(selectedShift.startTime).toLocaleString()}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedShift(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"><X className="w-6 h-6"/></button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-[#f8fafc]">
                             
                             <div className="flex-1 flex flex-col overflow-hidden">
                                 <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-white">
                                     <History className="w-5 h-5 text-indigo-500"/>
                                     <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Transacciones del Turno</h4>
                                     <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px] font-black ml-auto">{shiftTransactions.length} Operaciones</span>
                                 </div>
                                 <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 custom-scrollbar">
                                     {shiftTransactions.map(t => (
                                         <div key={t.id} className={`bg-white rounded-3xl p-5 border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm hover:shadow-md transition-all ${t.status === 'CANCELED' ? 'opacity-40 grayscale' : ''}`}>
                                             <div className="flex-1 min-w-0 pr-4">
                                                 <div className="flex items-center gap-3 mb-2">
                                                     <p className="font-black text-slate-800 text-sm">Tkt #{t.id.slice(-6).toUpperCase()}</p>
                                                     <span className="text-slate-300">•</span>
                                                     <p className="text-[10px] font-bold text-slate-400">{new Date(t.date).toLocaleTimeString()}</p>
                                                 </div>
                                                 <div className="flex flex-wrap gap-1.5">
                                                     {t.items.map((item, idx) => (
                                                         <span key={idx} className="bg-slate-50 text-[9px] font-bold text-slate-500 px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5">
                                                             <Box className="w-2.5 h-2.5 opacity-50"/> {item.quantity}x {item.name}
                                                         </span>
                                                     ))}
                                                 </div>
                                             </div>
                                             <div className="flex flex-col items-end shrink-0">
                                                 <p className="font-black text-lg text-slate-900 mb-1">{settings.currency}{t.total.toFixed(2)}</p>
                                                 
                                                 {/* DESGLOSE DE MÉTODOS VISUAL POR TICKET */}
                                                 <div className="flex flex-wrap justify-end gap-2">
                                                     {(t.payments || []).length > 0 ? t.payments?.map((p, pIdx) => (
                                                         <div key={pIdx} className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                                                             {p.method === 'cash' && <Banknote className="w-2.5 h-2.5 text-emerald-500"/>}
                                                             {p.method === 'yape' && <Smartphone className="w-2.5 h-2.5 text-purple-500"/>}
                                                             {p.method === 'plin' && <Zap className="w-2.5 h-2.5 text-cyan-500 fill-current"/>}
                                                             {p.method === 'card' && <CreditCard className="w-2.5 h-2.5 text-slate-400"/>}
                                                             <span className="text-[8px] font-black text-slate-500 uppercase">{p.method}</span>
                                                         </div>
                                                     )) : (
                                                         <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                                                             {t.paymentMethod === 'cash' ? <Banknote className="w-2.5 h-2.5 text-emerald-500"/> : <Smartphone className="w-2.5 h-2.5 text-indigo-500"/>}
                                                             <span className="text-[8px] font-black text-slate-500 uppercase">{t.paymentMethod}</span>
                                                         </div>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>

                             <div className="w-full lg:w-[350px] p-6 sm:p-8 bg-white border-l border-slate-100 flex flex-col shadow-sm">
                                 <div className="flex items-center gap-3 mb-8">
                                     <Wallet className="w-5 h-5 text-emerald-500"/>
                                     <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Resumen de Caja</h4>
                                 </div>

                                 <div className="space-y-4 flex-1">
                                     <div className="p-6 bg-[#f8fafc] rounded-[2rem] border border-slate-100 flex justify-between items-center relative overflow-hidden group">
                                         <div className="relative z-10">
                                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">EFECTIVO</p>
                                             <p className="text-2xl font-black text-emerald-600 tracking-tighter">{settings.currency}{selectedShift.totalSalesCash.toFixed(2)}</p>
                                         </div>
                                         <div className="p-3 bg-white rounded-xl shadow-sm"><Banknote className="w-5 h-5 text-emerald-400"/></div>
                                     </div>
                                     <div className="p-6 bg-[#f8fafc] rounded-[2rem] border border-slate-100 flex justify-between items-center relative overflow-hidden group">
                                         <div className="relative z-10">
                                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">YAPE</p>
                                             <p className="text-2xl font-black text-purple-600 tracking-tighter">{settings.currency}{selectedShift.totalSalesYape.toFixed(2)}</p>
                                         </div>
                                         <div className="p-3 bg-white rounded-xl shadow-sm"><Smartphone className="w-5 h-5 text-purple-400"/></div>
                                     </div>
                                     <div className="p-6 bg-[#f8fafc] rounded-[2rem] border border-slate-100 flex justify-between items-center relative overflow-hidden group">
                                         <div className="relative z-10">
                                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">PLIN</p>
                                             <p className="text-2xl font-black text-cyan-600 tracking-tighter">{settings.currency}{selectedShift.totalSalesPlin.toFixed(2)}</p>
                                         </div>
                                         <div className="p-3 bg-white rounded-xl shadow-sm"><Zap className="w-5 h-5 text-cyan-400 fill-current"/></div>
                                     </div>

                                     <div className="pt-10 pb-6 text-center">
                                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">MONTO TOTAL</p>
                                         <p className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-1">
                                             {settings.currency}{(selectedShift.totalSalesCash + selectedShift.totalSalesDigital).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                         </p>
                                     </div>
                                 </div>

                                 <button 
                                     onClick={() => handleExportShift(selectedShift)} 
                                     className="w-full mt-6 py-5 bg-gradient-to-r from-[#00d68f] to-[#00b87a] text-white rounded-3xl font-black text-xs uppercase tracking-widest items-center justify-center gap-3 shadow-xl hover:scale-[1.02] transition-all flex"
                                 >
                                     <FileSpreadsheet className="w-5 h-5"/> EXPORTAR EXCEL
                                 </button>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
