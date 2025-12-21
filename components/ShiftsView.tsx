
import React, { useMemo, useState } from 'react';
import { CashShift, Transaction, Product, StoreSettings, CashMovement } from '../types';
import { 
    Wallet, History, Eye, XCircle, RotateCcw, Clock, 
    ShieldCheck, Smartphone, Zap, CreditCard, Banknote, 
    RefreshCw, AlertTriangle, ArrowRight, Check, FileSpreadsheet,
    DollarSign, TrendingUp, Package, Users, Plus
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

    // KPI Cálculos (Estilo Imagen solicitada)
    const totalSalesAllTime = useMemo(() => transactions.filter(t => t.status !== 'CANCELED').reduce((acc, t) => acc + t.total, 0), [transactions]);
    const avgTicket = useMemo(() => transactions.length > 0 ? totalSalesAllTime / transactions.length : 0, [transactions, totalSalesAllTime]);
    const lowStockCount = useMemo(() => products.filter(p => p.stock < 10).length, [products]);

    const handleExportShift = (s: CashShift) => {
        const data = transactions
            .filter(t => t.shiftId === s.id)
            .map(t => ({
                Ticket: t.id.slice(-6).toUpperCase(),
                Fecha: new Date(t.date).toLocaleString(),
                Total: t.total,
                Metodo: t.paymentMethod,
                Status: t.status || 'COMPLETED'
            }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Turno");
        XLSX.writeFile(wb, `Turno_${s.id.slice(-6)}.xlsx`);
    };

    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto custom-scrollbar bg-[#f8fafc] pb-24 lg:pb-8">
            {/* CABECERA KPI ESTILO IMAGEN */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit mb-3">
                        <DollarSign className="w-5 h-5"/>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                        {settings.currency}{totalSalesAllTime.toLocaleString('es-PE', { minimumFractionDigits: 1 })}
                    </h3>
                </div>

                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in animation-delay-100">
                    <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl w-fit mb-3">
                        <TrendingUp className="w-5 h-5"/>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                        {settings.currency}{avgTicket.toFixed(2)}
                    </h3>
                </div>

                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in animation-delay-200">
                    <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl w-fit mb-3">
                        <Package className="w-5 h-5"/>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Bajo</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                        {lowStockCount} items
                    </h3>
                </div>

                <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 animate-fade-in animation-delay-300">
                    <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl w-fit mb-3">
                        <Users className="w-5 h-5"/>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Turnos</p>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                        {shifts.length}
                    </h3>
                </div>
            </div>

            {/* ACCIONES Y TABLA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <Wallet className="w-6 h-6 text-indigo-600"/> Historial de Turnos
                    </h2>
                </div>
                <button onClick={onOpenCashControl} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5"/> Abrir / Cerrar Caja
                </button>
            </div>

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
                                    <button onClick={() => setSelectedShift(s)} className="p-2 text-slate-400 hover:text-indigo-600">
                                        <Eye className="w-5 h-5"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL DETALLE TURNO (AUDITORÍA) */}
            {selectedShift && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white w-full max-w-5xl h-[92vh] sm:h-[85vh] rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex w-12 h-12 bg-white/10 rounded-2xl items-center justify-center text-emerald-400"><ShieldCheck className="w-6 h-6"/></div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight leading-none mb-1">Arqueo de Turno #{selectedShift.id.slice(-6).toUpperCase()}</h2>
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{new Date(selectedShift.startTime).toLocaleString()}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedShift(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"><XCircle className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50">
                             <div className="w-full lg:w-80 p-6 sm:p-8 bg-white lg:border-r border-slate-200 lg:order-2 flex flex-col">
                                 <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-6 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500"/> Resumen de Caja</h4>
                                 <div className="space-y-3 flex-1">
                                     <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                         <div><p className="text-[8px] font-black text-slate-400 uppercase">Efectivo</p><p className="font-black text-lg text-emerald-600">S/{selectedShift.totalSalesCash.toFixed(2)}</p></div>
                                         <Banknote className="w-6 h-6 text-emerald-200"/>
                                     </div>
                                     <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                         <div><p className="text-[8px] font-black text-slate-400 uppercase">Digital</p><p className="font-black text-lg text-indigo-600">S/{selectedShift.totalSalesDigital.toFixed(2)}</p></div>
                                         <Smartphone className="w-6 h-6 text-indigo-200"/>
                                     </div>
                                     <div className="pt-4 border-t border-slate-100">
                                         <p className="text-[8px] font-black text-slate-400 uppercase text-center mb-1">Monto Total</p>
                                         <p className="text-3xl font-black text-slate-900 text-center tracking-tighter">S/{(selectedShift.totalSalesCash + selectedShift.totalSalesDigital).toFixed(2)}</p>
                                     </div>
                                 </div>
                                 <button onClick={() => handleExportShift(selectedShift)} className="w-full mt-6 py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95">
                                     <FileSpreadsheet className="w-4 h-4"/> Exportar Excel
                                 </button>
                             </div>
                             <div className="flex-1 flex flex-col lg:order-1 overflow-hidden">
                                 <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
                                     <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest flex items-center gap-2"><History className="w-4 h-4 text-indigo-500"/> Transacciones del Turno</h4>
                                 </div>
                                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
                                     {transactions.filter(t => t.shiftId === selectedShift.id).map(t => (
                                         <div key={t.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex justify-between items-center shadow-sm">
                                             <div>
                                                 <p className="font-black text-slate-800 text-xs">Tkt #{t.id.slice(-6).toUpperCase()} • {new Date(t.date).toLocaleTimeString()}</p>
                                                 <p className="text-[10px] text-slate-400 font-bold uppercase">{t.paymentMethod}</p>
                                             </div>
                                             <p className="font-black text-sm text-slate-900">S/{t.total.toFixed(2)}</p>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
