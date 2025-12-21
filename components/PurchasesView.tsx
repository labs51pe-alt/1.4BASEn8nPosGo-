
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Supplier, Purchase, StoreSettings, PurchaseStatus, PurchaseItem, PaymentMethod } from '../types';
import { 
    Search, Plus, Save, Trash2, Building2, 
    Truck, Calendar, Package, 
    X, FileText, Download, Filter, List, 
    LayoutGrid, Wallet, Clock, 
    CheckCircle2, AlertCircle, Inbox,
    CreditCard, Edit2, RotateCcw,
    RefreshCw, Eye, Check,
    Smartphone, Smartphone as YapeIcon, 
    Zap as PlinIcon, Timer, ChevronRight,
    ArrowUpRight, AlertTriangle, Coins, Banknote,
    UserPlus, ShieldCheck, Info, Tag, Percent,
    ChevronLeft, BarChart3, ShoppingBag, ArrowRight,
    History, ChevronDown, Hash, ScanBarcode, PlusCircle,
    ArrowDownCircle, Scale, Minus, User, UserPlus2,
    ChevronUp, Zap, CreditCard as CardIcon
} from 'lucide-react';

interface PurchasesViewProps {
    products: Product[];
    suppliers: Supplier[];
    purchases: Purchase[];
    onProcessPurchase: (purchase: Purchase, updatedProducts: Product[]) => Promise<void>;
    onConfirmReception: (purchase: Purchase) => Promise<void>;
    onRevertReception: (purchase: Purchase) => Promise<void>;
    onAddSupplier: (supplier: Supplier) => Promise<void>;
    onRequestNewProduct: (barcode?: string) => void;
    settings: StoreSettings;
    initialSearchTerm?: string;
    onClearInitialSearch?: () => void;
}

type SupplierModalView = 'LIST' | 'HISTORY' | 'CREATE';

export const PurchasesView: React.FC<PurchasesViewProps> = ({ 
    products, suppliers, purchases = [], onProcessPurchase, onConfirmReception, onRevertReception, onAddSupplier, 
    onRequestNewProduct, settings, initialSearchTerm 
}) => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Suppliers UI State
    const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
    const [supModalView, setSupModalView] = useState<SupplierModalView>('LIST');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [supSearch, setSupSearch] = useState('');
    const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
    const [newSup, setNewSup] = useState({ name: '', contact: '', phone: '' });

    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Purchase Form State
    const [items, setItems] = useState<any[]>([]);
    const [supplierId, setSupplierId] = useState('');
    const [invoice, setInvoice] = useState('');
    const [docType, setDocType] = useState<'FACTURA' | 'BOLETA' | 'GUIA' | 'OTRO'>('FACTURA');
    const [condition, setCondition] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
    const [creditDays, setCreditDays] = useState('30');
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [payFromCash, setPayFromCash] = useState(false); 
    const [taxIncluded, setTaxIncluded] = useState(true);
    const [prodSearch, setProdSearch] = useState('');

    const openCreate = () => {
        setEditingPurchase(null); setItems([]); setSupplierId(''); setInvoice(''); setDocType('FACTURA'); setCondition('CONTADO');
        setAmountPaid(''); setPaymentMethod('cash'); setPayFromCash(true); setTaxIncluded(true); setIsModalOpen(true);
    };

    const openEdit = (p: Purchase) => {
        setEditingPurchase(p);
        setItems(p.items.map(i => {
            const product = products.find(prod => prod.id === i.productId);
            const cost = Number(i.cost);
            const sellPrice = Number(i.newSellPrice || product?.price || 0);
            const margin = cost > 0 ? ((sellPrice / cost) - 1) * 100 : 0;
            return { 
                ...i, 
                id: i.productId, 
                name: i.productName || product?.name || 'Producto',
                currentPrice: product?.price || 0,
                newSellPrice: sellPrice,
                margin: margin.toFixed(2),
                category: product?.category || 'General'
            };
        }));
        setSupplierId(p.supplierId); setInvoice(p.invoiceNumber || ''); setDocType(p.docType || 'FACTURA'); setCondition(p.paymentCondition);
        setAmountPaid((p.amountPaid ?? 0).toString()); setPaymentMethod((p.paymentMethod as PaymentMethod) || 'cash');
        setPayFromCash(p.payFromCash); setTaxIncluded(p.taxIncluded); 
        setIsModalOpen(true);
        setIsSuppliersModalOpen(false);
    };

    const totals = useMemo(() => {
        const subtotalRaw = items.reduce((s, i) => s + (Number(i.cost || 0) * Number(i.quantity || 0)), 0);
        let tax = taxIncluded ? subtotalRaw - (subtotalRaw / (1 + settings.taxRate)) : subtotalRaw * settings.taxRate;
        let total = taxIncluded ? subtotalRaw : subtotalRaw + tax;
        return { subtotal: taxIncluded ? subtotalRaw - tax : subtotalRaw, tax, total };
    }, [items, taxIncluded, settings.taxRate]);

    // Define isFullyPaid to fix errors at line 346 and 437
    const isFullyPaid = useMemo(() => {
        if (condition === 'CONTADO') return true;
        const paid = parseFloat(amountPaid) || 0;
        return paid >= (totals.total - 0.01);
    }, [condition, amountPaid, totals.total]);

    // Helpers para cálculos rápidos en tarjeta
    const getBalanceInfo = (p: Purchase) => {
        const paid = Number(p.amountPaid || 0);
        const total = Number(p.total || 0);
        const pending = Math.max(0, total - paid);
        const percent = total > 0 ? (paid / total) * 100 : 0;
        return { paid, pending, percent };
    };

    const handleAddSup = async () => {
        if (!newSup.name) return;
        setIsSaving(true);
        try {
            await onAddSupplier({ id: crypto.randomUUID(), name: newSup.name, contact: newSup.contact, phone: newSup.phone });
            setNewSup({ name: '', contact: '', phone: '' });
            setSupModalView('LIST');
        } catch (e) { alert("Error"); } finally { setIsSaving(false); }
    };

    const handleSave = async (status: PurchaseStatus) => {
        if (!supplierId || items.length === 0) return alert("Selecciona un Proveedor y añade productos.");
        setIsSaving(true);
        try {
            const purchase: Purchase = {
                id: editingPurchase?.id || crypto.randomUUID(), 
                reference: editingPurchase?.reference || `C-${Date.now().toString().slice(-6)}`,
                date: editingPurchase?.date || new Date().toISOString(), 
                supplierId, invoiceNumber: invoice, docType, paymentCondition: condition,
                subtotal: totals.subtotal, tax: totals.tax, total: totals.total, 
                amountPaid: condition === 'CONTADO' ? totals.total : Number(amountPaid || 0),
                paymentMethod, payFromCash, taxIncluded, 
                status: editingPurchase?.status || status, received: editingPurchase?.received || 'NO',
                items: items.map(i => ({ productId: i.id, productName: i.name, quantity: Number(i.quantity), cost: Number(i.cost), isBonus: false, newSellPrice: Number(i.newSellPrice || 0) }))
            };
            await onProcessPurchase(purchase, []); 
            setIsModalOpen(false); 
        } catch (e: any) { alert("Error al guardar"); } finally { setIsSaving(false); }
    };

    const getSupplierStats = (sId: string) => {
        const sPurchases = purchases.filter(p => p.supplierId === sId);
        const totalInvested = sPurchases.reduce((acc, p) => acc + p.total, 0);
        return { count: sPurchases.length, total: totalInvested };
    };

    const addItemToList = (p: Product) => {
        if (editingPurchase?.received === 'YES') return;
        if (!items.find(i => i.id === p.id)) {
            setItems([...items, { 
                id: p.id, name: p.name, quantity: 1, cost: p.cost || 0, 
                currentPrice: p.price, newSellPrice: p.price, 
                margin: p.cost ? (((p.price / p.cost) - 1) * 100).toFixed(2) : 0, 
                category: p.category 
            }]);
        }
    };

    const handleUpdateItem = (idx: number, field: string, value: any) => {
        if (editingPurchase?.received === 'YES') return;
        setItems(prev => prev.map((it, i) => {
            if (i !== idx) return it;
            const updated = { ...it, [field]: value };
            if (field === 'cost' || field === 'margin') {
                updated.newSellPrice = Number(updated.cost) * (1 + Number(updated.margin) / 100);
            } else if (field === 'newSellPrice') {
                updated.margin = Number(updated.cost) > 0 ? (((Number(updated.newSellPrice) / Number(updated.cost)) - 1) * 100).toFixed(2) : 0;
            }
            return updated;
        }));
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden pb-24 lg:pb-8 font-sans">
            {/* CABECERA COMPRAS */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-sm z-10">
                <div className="flex justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                            <Truck className="w-6 h-6 text-indigo-600"/> Mis Compras
                        </h1>
                        <p className="hidden sm:block text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Gestión de Proveedores y Stock</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setSupModalView('LIST'); setIsSuppliersModalOpen(true); }} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm">
                            <Building2 className="w-5 h-5"/>
                        </button>
                        <button onClick={openCreate} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                            <Plus className="w-4 h-4"/> <span className="hidden sm:inline">Nueva Orden</span><span className="sm:hidden">Nueva</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* BÚSQUEDA ORDENES */}
            <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                    <input className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-transparent rounded-[1.5rem] font-bold outline-none focus:border-indigo-400 shadow-sm text-sm" placeholder="Filtrar órdenes por ref. o proveedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* LISTADO KANBAN CON BALANCE INTEGRADO */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {purchases.filter(p => {
                        const supName = suppliers.find(s => s.id === p.supplierId)?.name || '';
                        return supName.toLowerCase().includes(searchTerm.toLowerCase()) || p.reference.toLowerCase().includes(searchTerm.toLowerCase());
                    }).map(p => {
                        const { paid, pending, percent } = getBalanceInfo(p);
                        const isPaid = paid >= p.total - 0.01;
                        const isPartial = !isPaid && paid > 0;
                        
                        return (
                            <div key={p.id} onClick={() => openEdit(p)} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all cursor-pointer group animate-fade-in-up relative overflow-hidden flex flex-col h-[420px]">
                                {/* Estado Almacén (Chip) */}
                                <div className="absolute top-4 left-4 z-20">
                                    <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1.5 border shadow-sm ${p.received === 'YES' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                        {p.received === 'YES' ? '✅ EN STOCK' : '📦 POR RECIBIR'}
                                    </div>
                                </div>

                                {/* Ribbon de Estado Pago */}
                                <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none z-20">
                                    <div className={`absolute top-0 right-0 py-1.5 px-10 transform rotate-45 translate-x-10 translate-y-4 shadow-lg text-[9px] font-black text-center text-white w-full uppercase tracking-widest ${isPaid ? 'bg-emerald-500' : isPartial ? 'bg-indigo-500' : 'bg-rose-500'}`}>
                                        {isPaid ? '✅ PAGADO' : isPartial ? '⏳ PARCIAL' : '💰 PENDIENTE'}
                                    </div>
                                </div>
                                
                                <div className="p-7 pt-12 flex-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">#{p.reference}</span>
                                    <h3 className="font-black text-slate-800 text-lg leading-tight truncate pr-14 mb-1">{suppliers.find(s => s.id === p.supplierId)?.name || 'Proveedor'}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 mb-6"><Calendar className="w-3 h-3"/> {new Date(p.date).toLocaleDateString()}</p>
                                    
                                    {/* BALANCE FINANCIERO INTEGRADO (Image Request) */}
                                    <div className="bg-slate-900 rounded-[1.8rem] p-5 text-white shadow-xl relative overflow-hidden mb-6">
                                        <div className="absolute top-0 right-0 p-4 opacity-5"><Banknote className="w-16 h-16"/></div>
                                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Balance Financiero</p>
                                        <div className="flex justify-between items-end mb-3">
                                            <div>
                                                <p className="text-xl font-black tracking-tighter">S/{paid.toFixed(2)}</p>
                                                <p className="text-[7px] font-bold text-slate-500 uppercase">ABONADO</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-black tracking-tighter text-rose-400">S/{pending.toFixed(2)}</p>
                                                <p className="text-[7px] font-bold text-slate-500 uppercase">PENDIENTE</p>
                                            </div>
                                        </div>
                                        {/* Barra de progreso */}
                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${percent}%` }}></div>
                                        </div>
                                        <p className="text-[7px] font-black text-center mt-2 text-slate-500 uppercase tracking-widest">{percent.toFixed(0)}% DEL TOTAL CUBIERTO</p>
                                    </div>

                                    <div className="flex justify-between items-center px-2">
                                        <div><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Inversión Total</p><p className="text-lg font-black text-slate-900">{settings.currency}{p.total.toFixed(2)}</p></div>
                                        <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Artículos</p><p className="text-sm font-black text-slate-600">{p.items.length} un.</p></div>
                                    </div>
                                </div>
                                
                                <div className="p-6 pt-0 mt-auto">
                                     {p.received === 'NO' && p.status !== 'CANCELADO' ? (
                                        <button onClick={(e) => { e.stopPropagation(); onConfirmReception(p); }} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-emerald-100">
                                            <Package className="w-4 h-4"/> CARGAR STOCK
                                        </button>
                                     ) : (
                                        <div className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-slate-100 cursor-default">
                                            <ShieldCheck className="w-4 h-4 text-emerald-500"/> MERCADERÍA EN ALMACÉN
                                        </div>
                                     )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MODAL MAESTRO DE COMPRA */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white w-full max-w-6xl h-[95vh] sm:h-[90vh] rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white"><Truck className="w-5 h-5"/></div>
                                <div><h2 className="text-lg font-black text-slate-800 leading-none mb-1">Orden de Compra</h2><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trazabilidad de Mercadería</p></div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"><X className="w-5 h-5"/></button>
                        </div>

                        {/* Línea de Tiempo de Proceso */}
                        <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-center items-center gap-4 shrink-0">
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${supplierId ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Registro</span>
                            </div>
                            <div className="w-12 h-0.5 bg-slate-200"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${amountPaid ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Pago</span>
                            </div>
                            <div className="w-12 h-0.5 bg-slate-200"></div>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${editingPurchase?.received === 'YES' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Recepción</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                            {/* Panel Configuración Lateral */}
                            <div className="w-full lg:w-[320px] p-6 border-r border-slate-100 bg-white overflow-y-auto custom-scrollbar shrink-0">
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Proveedor</label>
                                        <select disabled={editingPurchase?.received === 'YES'} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl font-bold text-xs outline-none transition-all shadow-sm" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                                            <option value="">Seleccionar...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Documento</label>
                                            <select disabled={editingPurchase?.received === 'YES'} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs border border-slate-100" value={docType} onChange={e => setDocType(e.target.value as any)}>
                                                <option value="FACTURA">Factura</option><option value="BOLETA">Boleta</option><option value="GUIA">Guía</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">N° Doc</label>
                                            <input disabled={editingPurchase?.received === 'YES'} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none border border-slate-100" placeholder="F001-..." value={invoice} onChange={e => setInvoice(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pago</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => editingPurchase?.received !== 'YES' && setCondition('CONTADO')} className={`p-4 rounded-2xl border-2 font-black text-[10px] transition-all ${condition === 'CONTADO' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}>CONTADO</button>
                                            <button onClick={() => editingPurchase?.received !== 'YES' && setCondition('CREDITO')} className={`p-4 rounded-2xl border-2 font-black text-[10px] transition-all ${condition === 'CREDITO' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white border-slate-100 text-slate-400'}`}>CRÉDITO</button>
                                        </div>
                                    </div>
                                    {condition === 'CREDITO' && (
                                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                                            <div>
                                                <label className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1 block">Monto Abonado</label>
                                                <input disabled={editingPurchase?.received === 'YES' && isFullyPaid} type="number" className="w-full p-3 bg-white rounded-xl font-black text-sm outline-none shadow-sm" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1 block">Días de Plazo</label>
                                                <select disabled={editingPurchase?.received === 'YES'} className="w-full p-2 bg-white rounded-lg font-black text-xs border border-slate-100" value={creditDays} onChange={e => setCreditDays(e.target.value)}>
                                                    <option value="7">7 días</option><option value="15">15 días</option><option value="30">30 días</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Panel Ítems Central */}
                            <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
                                {editingPurchase?.received !== 'YES' && (
                                    <div className="p-4 bg-white border-b border-slate-100 flex gap-3 shadow-sm z-10">
                                        <div className="flex-1 relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input className="w-full pl-10 pr-4 py-3.5 bg-slate-50 rounded-2xl font-bold outline-none text-sm border border-slate-100" placeholder="Añadir productos a la orden..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                                            {prodSearch.length > 1 && (
                                                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 mt-2 max-h-[250px] overflow-y-auto p-2">
                                                    {products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).map(p => (
                                                        <button key={p.id} onClick={() => { addItemToList(p); setProdSearch(''); }} className="w-full p-3 hover:bg-indigo-50 text-left rounded-xl flex justify-between items-center transition-colors">
                                                            <div><p className="text-slate-800 text-xs font-black">{p.name}</p><p className="text-[8px] text-slate-400 uppercase">{p.category}</p></div>
                                                            <span className="bg-indigo-100 text-indigo-600 text-[8px] font-black px-2 py-1 rounded-lg">+ AÑADIR</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => onRequestNewProduct()} className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg hover:bg-black transition-all active:scale-90"><PlusCircle className="w-6 h-6"/></button>
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                    {editingPurchase?.received === 'YES' && (
                                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-[1.8rem] flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white"><ShieldCheck className="w-7 h-7"/></div>
                                            <div><p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Documento Protegido</p><p className="text-[8px] text-emerald-600 font-bold uppercase">La mercadería ya se encuentra en el inventario global.</p></div>
                                        </div>
                                    )}
                                    {items.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center opacity-10 space-y-4"><ShoppingBag className="w-24 h-24"/><p className="text-xl font-black uppercase tracking-widest">Sin artículos</p></div>
                                    ) : items.map((item, idx) => (
                                        <div key={idx} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm flex flex-col animate-fade-in-up">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">{item.category}</span>
                                                    <h4 className="font-black text-sm text-slate-800 truncate pr-6">{item.name}</h4>
                                                </div>
                                                {editingPurchase?.received !== 'YES' && (
                                                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end bg-slate-50/50 p-4 rounded-[1.5rem]">
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 ml-1">Cantidad</label>
                                                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-100">
                                                        <button disabled={editingPurchase?.received === 'YES'} onClick={() => handleUpdateItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="w-7 h-7 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center"><Minus className="w-3 h-3"/></button>
                                                        <input disabled={editingPurchase?.received === 'YES'} type="number" className="w-10 bg-transparent text-center font-black text-xs outline-none" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))} />
                                                        <button disabled={editingPurchase?.received === 'YES'} onClick={() => handleUpdateItem(idx, 'quantity', item.quantity + 1)} className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center"><Plus className="w-3 h-3"/></button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 ml-1">Costo Unit</label>
                                                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[10px]">S/</span><input disabled={editingPurchase?.received === 'YES'} type="number" className="w-full pl-5 p-2 bg-white border border-slate-100 rounded-xl font-black text-xs outline-none" value={item.cost} onChange={e => handleUpdateItem(idx, 'cost', Number(e.target.value))} /></div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-indigo-400 uppercase mb-1 ml-1">Margen %</label>
                                                    <input disabled={editingPurchase?.received === 'YES'} type="number" className="w-full p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-center font-black text-xs outline-none text-indigo-700" value={item.margin} onChange={e => handleUpdateItem(idx, 'margin', Number(e.target.value))} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-emerald-400 uppercase mb-1 ml-1">Pv. Sugerido</label>
                                                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-300 font-black text-[10px]">S/</span><input disabled={editingPurchase?.received === 'YES'} type="number" className="w-full pl-5 p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-center font-black text-xs outline-none text-emerald-600" value={Number(item.newSellPrice).toFixed(2)} onChange={e => handleUpdateItem(idx, 'newSellPrice', Number(e.target.value))} /></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Totales */}
                        <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 shadow-2xl z-30">
                             <div className="flex justify-between sm:justify-start w-full sm:w-auto items-center gap-8 px-4">
                                <div><p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-1">Inversión Final</p><p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">S/{totals.total.toFixed(2)}</p></div>
                                {editingPurchase?.received === 'YES' && <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500"/><span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">En Almacén</span></div>}
                             </div>
                             <div className="flex gap-3 w-full sm:w-auto">
                                {editingPurchase?.received !== 'YES' && <button onClick={() => handleSave('BORRADOR')} disabled={isSaving} className="flex-1 sm:px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">BORRADOR</button>}
                                <button onClick={() => handleSave('CONFIRMADO')} disabled={isSaving || items.length === 0 || !supplierId || (editingPurchase?.received === 'YES' && isFullyPaid)} className={`flex-[2] sm:px-12 py-4 rounded-[1.8rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${editingPurchase?.received === 'YES' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
                                    {isSaving ? <RefreshCw className="w-5 h-5 animate-spin"/> : (editingPurchase?.received === 'YES' ? 'ACTUALIZAR ABONO' : 'CONFIRMAR COMPRA')}
                                </button>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AGENDA DE PROVEEDORES */}
            {isSuppliersModalOpen && (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[400] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[3rem] shadow-2xl animate-fade-in-up border border-slate-100 flex flex-col overflow-hidden">
                        
                        {/* Header Dinámico */}
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                             <div className="flex items-center gap-4">
                                {supModalView !== 'LIST' && <button onClick={() => setSupModalView('LIST')} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"><ChevronLeft className="w-6 h-6"/></button>}
                                <div>
                                    <h3 className="font-black text-2xl text-slate-800 tracking-tight">
                                        {supModalView === 'LIST' ? 'Agenda de Proveedores' : supModalView === 'HISTORY' ? 'Historial de Compras' : 'Nuevo Registro'}
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BASE DE DATOS MAESTRA</p>
                                </div>
                             </div>
                             <button onClick={() => setIsSuppliersModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 shadow-sm"><X className="w-6 h-6"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white">
                            
                            {/* VISTA 1: LISTADO DE PROVEEDORES */}
                            {supModalView === 'LIST' && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
                                        <div className="flex-1 relative w-full">
                                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                                            <input className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-[2rem] font-bold text-sm outline-none transition-all shadow-inner" placeholder="Filtrar por nombre o contacto..." value={supSearch} onChange={e => setSupSearch(e.target.value)} />
                                        </div>
                                        <button onClick={() => setSupModalView('CREATE')} className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200">
                                            <UserPlus2 className="w-4 h-4"/> AÑADIR REGISTRO
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {suppliers.filter(s => s.name.toLowerCase().includes(supSearch.toLowerCase())).map(s => {
                                            const stats = getSupplierStats(s.id);
                                            return (
                                                <div key={s.id} onClick={() => { setSelectedSupplier(s); setSupModalView('HISTORY'); }} className="p-7 bg-white border border-slate-100 rounded-[2.5rem] flex justify-between items-center group hover:border-indigo-200 hover:shadow-2xl transition-all cursor-pointer animate-fade-in-up">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 transition-all group-hover:bg-indigo-600 group-hover:text-white shadow-sm">
                                                            <Building2 className="w-7 h-7"/>
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-800 text-xl leading-tight">{s.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-widest">{s.contact || 'SIN VENDEDOR ASIGNADO'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-5">
                                                        <div className="text-right pr-5 border-r border-slate-50">
                                                            <div className="flex items-center gap-2 justify-end">
                                                                <span className="font-black text-indigo-600 text-xl">{stats.count}</span>
                                                                <ShoppingBag className="w-4 h-4 text-indigo-300"/>
                                                            </div>
                                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Órdenes</p>
                                                        </div>
                                                        <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"/>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* VISTA 2: HISTORIAL DE PROVEEDOR */}
                            {supModalView === 'HISTORY' && selectedSupplier && (
                                <div className="space-y-12 animate-fade-in">
                                    {/* Header Info Proveedor */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-slate-50/50 p-8 rounded-[3rem] border border-slate-100">
                                        <div className="flex items-center gap-8">
                                            <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-slate-300 rotate-3 transition-transform hover:rotate-0">
                                                <Building2 className="w-12 h-12"/>
                                            </div>
                                            <div>
                                                <h4 className="text-5xl font-black text-slate-800 tracking-tighter">{selectedSupplier.name}</h4>
                                                <div className="flex flex-wrap items-center gap-5 mt-2">
                                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-2"><User className="w-4 h-4 text-indigo-400"/> {selectedSupplier.contact || 'S/C'}</span>
                                                    {selectedSupplier.phone && <span className="text-xs font-bold text-slate-400 flex items-center gap-2"><Smartphone className="w-4 h-4 text-indigo-400"/> {selectedSupplier.phone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 w-full md:w-auto">
                                            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2.2rem] flex flex-col justify-center items-center px-10 shadow-sm">
                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 opacity-60">TOTAL INVERTIDO</p>
                                                <p className="text-3xl font-black text-emerald-700 leading-none">{settings.currency}{getSupplierStats(selectedSupplier.id).total.toFixed(2)}</p>
                                            </div>
                                            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2.2rem] flex flex-col justify-center items-center px-10 shadow-sm">
                                                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 opacity-60">ÓRDENES OK</p>
                                                <p className="text-3xl font-black text-indigo-700 leading-none">{getSupplierStats(selectedSupplier.id).count}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lista de Registros */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-5">
                                            <History className="w-6 h-6 text-slate-400"/>
                                            <h5 className="font-black text-slate-400 text-sm uppercase tracking-widest">REGISTRO HISTÓRICO</h5>
                                        </div>

                                        <div className="space-y-6">
                                            {purchases.filter(p => p.supplierId === selectedSupplier.id).map(p => (
                                                <div key={p.id} className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden transition-all hover:border-indigo-100 group">
                                                    <div 
                                                        onClick={() => setExpandedPurchaseId(expandedPurchaseId === p.id ? null : p.id)}
                                                        className="p-8 flex flex-col sm:flex-row justify-between items-center gap-6 cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-6">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${expandedPurchaseId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                                {expandedPurchaseId === p.id ? <ChevronUp className="w-6 h-6"/> : <ChevronDown className="w-6 h-6"/>}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-4">
                                                                    <p className="font-black text-slate-800 text-xl tracking-tight">Ref: #{p.reference}</p>
                                                                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase shadow-sm ${p.amountPaid >= p.total - 0.01 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                                        {p.amountPaid >= p.total - 0.01 ? 'PAGADO' : 'PENDIENTE'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{new Date(p.date).toLocaleDateString()} • {p.items.length} ARTÍCULOS EN ORDEN</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-10">
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 opacity-50">COMPROBANTE</p>
                                                                <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">DOC: {p.invoiceNumber || 'S/N'}</span>
                                                            </div>
                                                            <div className="text-right min-w-[120px]">
                                                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 opacity-50">MONTO TOTAL</p>
                                                                <p className="font-black text-slate-900 text-2xl tracking-tighter">{settings.currency}{p.total.toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Desglose Expandible */}
                                                    {expandedPurchaseId === p.id && (
                                                        <div className="px-10 pb-10 pt-2 animate-fade-in border-t border-slate-50 bg-slate-50/30">
                                                            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-inner mt-4">
                                                                <table className="w-full text-left">
                                                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                        <tr>
                                                                            <th className="p-6">PRODUCTO</th>
                                                                            <th className="p-6 text-center">CANT</th>
                                                                            <th className="p-6 text-center">COSTO UNIT.</th>
                                                                            <th className="p-6 text-right">SUBTOTAL</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-50 font-bold text-sm">
                                                                        {p.items.map((it, idx) => (
                                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                                <td className="p-6 text-slate-700">{it.productName || 'Producto'}</td>
                                                                                <td className="p-6 text-center text-slate-900">{it.quantity} un.</td>
                                                                                <td className="p-6 text-center text-indigo-500 font-black">{settings.currency}{it.cost.toFixed(2)}</td>
                                                                                <td className="p-6 text-right text-slate-900 font-black">{settings.currency}{(it.cost * it.quantity).toFixed(2)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            <div className="flex justify-between items-center mt-8 px-4">
                                                                <div className="flex gap-6">
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-400"/> VENCIMIENTO: {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A'}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><CardIcon className="w-4 h-4 text-indigo-400"/> MÉTODO: {p.paymentCondition}</p>
                                                                </div>
                                                                <button onClick={() => openEdit(p)} className="px-8 py-3.5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 shadow-xl hover:bg-black transition-all active:scale-95">
                                                                    <Eye className="w-4 h-4 text-emerald-400"/> VER DOCUMENTO COMPLETO
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* VISTA 3: CREAR PROVEEDOR */}
                            {supModalView === 'CREATE' && (
                                <div className="max-w-2xl mx-auto space-y-8 animate-fade-in py-10">
                                    <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 mx-auto mb-6 shadow-sm border border-indigo-100">
                                        <UserPlus2 className="w-12 h-12"/>
                                    </div>
                                    <div className="space-y-5">
                                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Nombre de la Empresa / Comercial</label><input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-[2rem] font-bold text-base outline-none transition-all shadow-inner" value={newSup.name} onChange={e => setNewSup({...newSup, name: e.target.value})} placeholder="Ej: Corporación Alicorp S.A.A" /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Representante / Vendedor</label><input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-[2rem] font-bold text-base outline-none transition-all shadow-inner" value={newSup.contact} onChange={e => setNewSup({...newSup, contact: e.target.value})} placeholder="Nombre de tu contacto..." /></div>
                                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">WhatsApp de Pedidos</label><input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-[2rem] font-bold text-base outline-none transition-all shadow-inner" value={newSup.phone} onChange={e => setNewSup({...newSup, phone: e.target.value})} placeholder="999..." /></div>
                                    </div>
                                    <button onClick={handleAddSup} disabled={!newSup.name || isSaving} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-black shadow-2xl transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50">
                                        {isSaving ? <RefreshCw className="w-6 h-6 animate-spin"/> : <><ShieldCheck className="w-6 h-6 text-emerald-400"/> GUARDAR EN BASE DE DATOS</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
