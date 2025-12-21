
import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, X, Banknote, Smartphone, Clock, Lock, Rocket, DollarSign, ArrowUpCircle, Store, History, CheckCircle2, Zap, Coins, CreditCard } from 'lucide-react';

export const CashControlModal = ({ isOpen, onClose, activeShift, movements, transactions, onCashAction, currency }: any) => {
  const [cashAmount, setCashAmount] = useState('');
  const [cashDescription, setCashDescription] = useState('');
  const [cashAction, setCashAction] = useState<'OPEN' | 'CLOSE' | 'IN' | 'OUT'>('OPEN');

  useEffect(() => {
      if (isOpen) {
          setCashAction(activeShift ? 'IN' : 'OPEN');
          setCashAmount('');
          setCashDescription('');
      }
  }, [isOpen, activeShift]);

  const totals = useMemo(() => {
    if (!activeShift) return { cash: 0, digital: 0, start: 0, salesCash: 0, yape: 0, plin: 0, card: 0, totalInCaja: 0, mainDigitalMethod: 'Digitales' };
    
    const start = Number(activeShift.startAmount || 0);
    const salesCash = Number(activeShift.totalSalesCash || 0);
    const salesDigital = Number(activeShift.totalSalesDigital || 0);
    const yape = Number(activeShift.totalSalesYape || 0);
    const plin = Number(activeShift.totalSalesPlin || 0);
    const card = Number(activeShift.totalSalesCard || 0);

    const shiftMoves = movements.filter((m: any) => m.shiftId === activeShift.id);
    let manualMovesNet = 0;
    shiftMoves.forEach((m: any) => {
        if (m.type === 'IN') manualMovesNet += Number(m.amount || 0);
        if (m.type === 'OUT') manualMovesNet -= Number(m.amount || 0);
    });

    const expectedPhysicalCash = start + salesCash + manualMovesNet;

    // Determinar el nombre dinámico para la tarjeta azul
    let mainDigitalMethod = 'Digitales';
    if (salesDigital > 0) {
        if (yape === salesDigital) mainDigitalMethod = 'Yape';
        else if (plin === salesDigital) mainDigitalMethod = 'Plin';
        else if (card === salesDigital) mainDigitalMethod = 'Tarjeta';
    }

    return { 
        cash: expectedPhysicalCash, 
        digital: salesDigital, 
        start,
        salesCash,
        yape,
        plin,
        card,
        totalInCaja: expectedPhysicalCash + salesDigital,
        mainDigitalMethod
    };
  }, [activeShift, movements]);

  const handleSubmit = () => {
      const amountVal = cashAmount === '' ? NaN : parseFloat(cashAmount);
      if (isNaN(amountVal) && cashAction !== 'CLOSE') {
          if (cashAction === 'OPEN' && cashAmount === '0') { /* Valid 0 */ } 
          else { alert('Por favor, ingresa un monto válido.'); return; }
      }
      const finalAmount = isNaN(amountVal) ? 0 : amountVal;
      onCashAction(cashAction, finalAmount, cashDescription);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
        <div className="bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] w-full max-w-md max-h-[92vh] flex flex-col animate-fade-in-up overflow-hidden border border-white/20">
            
            {/* Header */}
            <div className="p-5 sm:p-8 border-b border-slate-50 bg-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                    <Wallet className="w-5 h-5 sm:w-6 sm:h-6"/>
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Caja en Vivo</h2>
                    <p className="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Sesión de Control Profesional</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all text-slate-300">
                    <X className="w-6 h-6"/>
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 bg-white space-y-6 sm:space-y-8">
                {activeShift ? (
                    <div className="space-y-5 sm:space-y-6 animate-fade-in">
                        {/* Totales Principales */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 sm:p-5 rounded-[2rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
                                <div className="absolute right-[-10px] bottom-[-10px] opacity-20"><Banknote className="w-16 h-16 sm:w-20 sm:h-20"/></div>
                                <p className="text-[9px] font-black uppercase mb-1 tracking-widest opacity-80">Efectivo Físico</p>
                                <h3 className="text-xl sm:text-2xl font-black tracking-tighter">{currency}{totals.cash.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                            </div>
                            <div className="bg-indigo-600 p-4 sm:p-5 rounded-[2rem] text-white flex flex-col justify-center shadow-xl shadow-indigo-100 relative overflow-hidden group">
                                <div className="absolute right-[-10px] bottom-[-10px] opacity-20"><Smartphone className="w-16 h-16 sm:w-20 sm:h-20"/></div>
                                <p className="text-[9px] font-black uppercase mb-1 tracking-widest opacity-80">Ventas {totals.mainDigitalMethod}</p>
                                <h3 className="text-xl sm:text-2xl font-black tracking-tighter">{currency}{totals.digital.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                            </div>
                        </div>

                        {/* Desglose Detallado de Ventas Digitales */}
                        <div className="grid grid-cols-3 gap-2">
                             <div className={`p-2.5 rounded-2xl border transition-all text-center ${totals.yape > 0 ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                 <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1 ${totals.yape > 0 ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}><Smartphone className="w-3.5 h-3.5"/></div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">YAPE</p>
                                 <p className={`font-black text-[10px] ${totals.yape > 0 ? 'text-purple-700' : 'text-slate-400'}`}>{currency}{totals.yape.toFixed(2)}</p>
                             </div>
                             <div className={`p-2.5 rounded-2xl border transition-all text-center ${totals.plin > 0 ? 'bg-cyan-50 border-cyan-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                 <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1 ${totals.plin > 0 ? 'bg-cyan-100 text-cyan-600' : 'bg-slate-100 text-slate-400'}`}><Zap className="w-3.5 h-3.5 fill-current"/></div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">PLIN</p>
                                 <p className={`font-black text-[10px] ${totals.plin > 0 ? 'text-cyan-700' : 'text-slate-400'}`}>{currency}{totals.plin.toFixed(2)}</p>
                             </div>
                             <div className={`p-2.5 rounded-2xl border transition-all text-center ${totals.card > 0 ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                 <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1 ${totals.card > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}><CreditCard className="w-3.5 h-3.5"/></div>
                                 <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">CARD</p>
                                 <p className={`font-black text-[10px] ${totals.card > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{currency}{totals.card.toFixed(2)}</p>
                             </div>
                        </div>

                        {/* Resumen Informativo */}
                        <div className="bg-slate-50 rounded-3xl p-4 border border-slate-100 space-y-3 shadow-inner">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fondo Inicial</span>
                                <span className="font-black text-slate-700 text-xs">{currency}{totals.start.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ventas Efectivo</span>
                                </div>
                                <span className="font-black text-emerald-600 text-xs">+{currency}{totals.salesCash.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Selector de Acción */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl">
                            <button onClick={() => setCashAction('IN')} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] sm:text-xs transition-all tracking-wider ${cashAction === 'IN' ? 'bg-white text-emerald-600 shadow-sm scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}>INGRESO</button>
                            <button onClick={() => setCashAction('OUT')} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] sm:text-xs transition-all tracking-wider ${cashAction === 'OUT' ? 'bg-white text-rose-600 shadow-sm scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}>EGRESO</button>
                            <button onClick={() => setCashAction('CLOSE')} className={`flex-1 py-2.5 rounded-xl font-black text-[9px] sm:text-xs transition-all tracking-wider ${cashAction === 'CLOSE' ? 'bg-white text-slate-900 shadow-sm scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}>CERRAR</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4 sm:space-y-6 animate-fade-in py-6">
                        <div className="relative inline-block">
                             <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-300">
                                <Lock className="w-10 h-10"/>
                             </div>
                             <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-2 rounded-xl shadow-lg border-4 border-white">
                                <Zap className="w-4 h-4 fill-current text-amber-400"/>
                             </div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Abrir Nueva Caja</h3>
                            <p className="text-slate-400 font-medium text-sm mt-2 px-6 leading-snug">Establece el fondo inicial para comenzar a facturar hoy.</p>
                        </div>
                    </div>
                )}
                
                {/* Formulario de Entrada */}
                <div className="bg-slate-50/50 border-2 border-slate-100 rounded-[2.5rem] p-6 space-y-5 focus-within:border-indigo-200 transition-all shadow-inner">
                    <div className="flex items-center justify-between mb-1 px-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                             {cashAction === 'OPEN' ? <Rocket className="w-3.5 h-3.5 text-indigo-500"/> : <Coins className="w-3.5 h-3.5 text-emerald-500"/>}
                             {cashAction === 'OPEN' ? 'FONDO INICIAL' : cashAction === 'IN' ? 'INGRESO EXTRA' : cashAction === 'OUT' ? 'EGRESO' : 'MONTO DE CIERRE'}
                        </label>
                    </div>

                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 text-2xl font-black tracking-tighter">{currency}</span>
                        <input 
                            type="number" 
                            value={cashAmount} 
                            onChange={(e) => setCashAmount(e.target.value)} 
                            className="w-full pl-14 pr-6 py-4 sm:py-5 bg-white border-2 border-transparent rounded-[2rem] focus:border-indigo-500 outline-none font-black text-3xl sm:text-4xl text-slate-800 placeholder-slate-200 shadow-sm transition-all" 
                            placeholder="0.00" 
                        />
                    </div>

                    {cashAction !== 'OPEN' && (
                        <div className="pt-1">
                            <input 
                              type="text" 
                              value={cashDescription} 
                              onChange={(e) => setCashDescription(e.target.value)} 
                              className="w-full p-4 bg-white border-2 border-transparent rounded-2xl focus:border-indigo-400 outline-none font-bold text-xs text-slate-700 placeholder-slate-300 transition-all shadow-sm" 
                              placeholder={cashAction === 'CLOSE' ? 'Comentarios del cierre...' : '¿A qué se debe este movimiento?'}
                            />
                        </div>
                    )}

                    <button 
                        onClick={handleSubmit} 
                        className="w-full py-5 rounded-[2rem] font-black text-white shadow-2xl transition-all active:scale-95 bg-slate-900 hover:bg-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
                      {cashAction === 'OPEN' ? 'INICIAR JORNADA' : 'CONFIRMAR OPERACIÓN'}
                    </button>
                </div>
            </div>
            
            {/* Footer Informativo */}
            {activeShift && (
                <div className="p-4 bg-slate-900 text-slate-400 border-t border-white/5 flex justify-between items-center px-8 shrink-0">
                    <div className="flex items-center gap-3">
                        <Clock className="w-3.5 h-3.5 text-emerald-500"/>
                        <span className="text-[9px] font-black uppercase tracking-widest">Desde: {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase tracking-widest">CLOUD SYNC</span>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
