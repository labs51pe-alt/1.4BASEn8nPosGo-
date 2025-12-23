import React, { useState, useMemo, useEffect } from 'react';
import { Product, Supplier, Purchase, StoreSettings, PurchaseStatus, PaymentMethod } from '../types';
import { 
    Search, Plus, Trash2, Building2, 
    Truck, Calendar, Package, 
    X, FileText, List, 
    LayoutGrid, Wallet, 
    CheckCircle2, RefreshCw, 
    Smartphone, Zap, ChevronRight,
    ArrowUpRight, Coins, Banknote,
    PlusCircle, Landmark, CreditCard,
    TrendingUp, CalendarClock, History as HistoryIcon,
    CreditCard as DebtIcon, ChevronLeft, Receipt,
    Box, Sparkles, Edit2
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
    onEditProduct?: (product: Product) => void; // Prop para editar producto existente
    settings: StoreSettings;
    initialSearchTerm?: string;
    onClearInitialSearch?: () => void;
}

type SupplierModalView = 'LIST' | 'HISTORY' | 'CREATE';
type QuickFilter = 'ALL' | 'PENDING_PAY' | 'PENDING_RECEIVE' | 'MONTH';
type DisplayMode = 'KANBAN' | 'LIST';

export const PurchasesView: React.FC<PurchasesViewProps> = ({ 
    products, suppliers, purchases = [], onProcessPurchase, onConfirmReception, onAddSupplier, 
    onRequestNewProduct, onEditProduct, settings, initialSearchTerm 
}) => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('KANBAN');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
    const [supModalView, setSupModalView] = useState<SupplierModalView>('LIST');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [supSearch, setSupSearch] = useState('');
    const [newSup, setNewSup] = useState({ name: '', contact: '', phone: '' });

    const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);

    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [items, setItems] = useState<any[]>([]);
    const [supplierId, setSupplierId] = useState('');
    const [invoice, setInvoice] = useState('');
    const [docType, setDocType] = useState<'FACTURA' | 'BOLETA' | 'GUIA' | 'OTRO'>('FACTURA');
    const [condition, setCondition] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
    const [amountPaid, setAmountPaid] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [payFromCash, setPayFromCash] = useState(false); 
    const [taxIncluded, setTaxIncluded] = useState(true);
    const [prodSearch, setProdSearch] = useState('');

    useEffect(() => {
        if (pendingSelectionId) {
            const found = suppliers.find(s => s.id === pendingSelectionId);
            if (found) {
                setSupplierId(pendingSelectionId);
                setPendingSelectionId(null);
            }
        }
    }, [suppliers, pendingSelectionId]);

    const metrics = useMemo(() => {
        const totalOrders = purchases.length;
        const globalInvestment = purchases.reduce((acc, p) => acc + p.total, 0);
        const now = new Date();
        const thisMonthPurchases = purchases.filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const thisMonth = thisMonthPurchases.reduce((acc, p) => acc + p.total, 0);
        const accountsPayable = purchases.reduce((acc, p) => acc + (p.total - (p.amountPaid || 0)), 0);
        return { totalOrders, globalInvestment, thisMonth, accountsPayable };
    }, [purchases]);

    const openCreate = () => {
        setEditingPurchase(null); setItems([]); setSupplierId(''); setInvoice(''); setDocType('FACTURA'); setCondition('CONTADO');
        setAmountPaid(''); setDueDate(''); setPaymentMethod('cash'); setPayFromCash(true); setTaxIncluded(true); setIsModalOpen(true);
    };

    const openEdit = (p: Purchase) => {
        setEditingPurchase(p);
        setItems(p.items.map(i => {
            const product = products.find(prod => prod.id === i.productId);
            const cost = Number(i.cost);
            const sellPrice = Number(i.newSellPrice || i.currentPrice || product?.price || 0);
            const margin = cost > 0 ? ((sellPrice / cost) - 1) * 100 : 0;
            return { 
                ...i, 
                id: i.productId, 
                name: i.productName || product?.name || 'Producto',
                variantId: i.variantId,
                variantName: i.variantName,
                currentPrice: product?.price || 0,
                newSellPrice: sellPrice,
                margin: margin.toFixed(2),
                category: product?.category || 'General'
            };
        }));
        setSupplierId(p.supplierId); setInvoice(p.invoiceNumber || ''); setDocType(p.docType || 'FACTURA'); setCondition(p.paymentCondition);
        setAmountPaid((p.amountPaid ?? 0).toString()); setDueDate(p.dueDate || ''); setPaymentMethod((p.paymentMethod as PaymentMethod) || 'cash');
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

    const filteredPurchases = useMemo(() => {
        return purchases.filter(p => {
            const supName = suppliers.find(s => s.id === p.supplierId)?.name || '';
            const matchesSearch = supName.toLowerCase().includes(searchTerm.toLowerCase()) || p.reference.toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchesSearch) return false;
            if (quickFilter === 'PENDING_PAY') return (p.total - (p.amountPaid || 0)) > 0.01;
            if (quickFilter === 'PENDING_RECEIVE') return p.received === 'NO' && p.status !== 'CANCELADO';
            if (quickFilter === 'MONTH') {
                const now = new Date(); const d = new Date(p.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }
            return true;
        });
    }, [purchases, searchTerm, quickFilter, suppliers]);

    const handleAddSup = async () => {
        if (!newSup.name) return;
        setIsSaving(true);
        try {
            const newId = crypto.randomUUID();
            const payload: Supplier = { id: newId, name: newSup.name.trim(), contact: newSup.contact.trim(), phone: newSup.phone.trim() };
            await onAddSupplier(payload);
            setPendingSelectionId(newId);
            setNewSup({ name: '', contact: '', phone: '' });
            setSupModalView('LIST');
        } catch (e: any) { 
            alert("❌ Error al crear proveedor: " + e.message); 
        } finally { setIsSaving(false); }
    };

    const handleSave = async (status: PurchaseStatus) => {
        if (!supplierId || items.length === 0) return alert("Selecciona un Proveedor y añade productos.");
        setIsSaving(true);
        try {
            const purchase: Purchase = {
                id: editingPurchase?.id || crypto.randomUUID(), 
                reference: editingPurchase?.reference || `C-${Date.now().toString().slice(-6)}`,
                date: editingPurchase?.date || new Date().toISOString(), 
                dueDate: condition === 'CREDITO' ? dueDate : undefined,
                supplierId, invoiceNumber: invoice, docType, paymentCondition: condition,
                subtotal: totals.subtotal, tax: totals.tax, total: totals.total, 
                amountPaid: condition === 'CONTADO' ? totals.total : Number(amountPaid || 0),
                paymentMethod, payFromCash, taxIncluded, 
                status: editingPurchase?.status || status, received: editingPurchase?.received || 'NO',
                items: items.map(i => ({ 
                    productId: i.id, productName: i.name, variantId: i.variantId, variantName: i.variantName,
                    quantity: Number(i.quantity), cost: Number(i.cost), isBonus: false, newSellPrice: Number(i.newSellPrice || 0) 
                }))
            };
            await onProcessPurchase(purchase, []); 
            setIsModalOpen(false); 
        } catch (e: any) { alert("Error al guardar la compra."); } finally { setIsSaving(false); }
    };

    const addItemToList = (p: Product, v?: any) => {
        if (editingPurchase?.received === 'YES') return;
        const costBase = p.cost || 0;
        const sellBase = v ? v.price : p.price;
        setItems([...items, { 
            id: p.id, name: p.name, variantId: v?.id, variantName: v?.name,
            quantity: 1, cost: costBase, currentPrice: sellBase, newSellPrice: sellBase, 
            margin: costBase ? (((sellBase / costBase) - 1) * 100).toFixed(2) : 0, category: p.category 
        }]);
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

    const setQuickDueDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        setDueDate(d.toISOString().split('T')[0]);
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden pb-24 lg:pb-8 font-sans">
            {/* CABECERA PRINCIPAL */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 shrink-0 shadow-sm z-10">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                         <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><Truck className="w-7 h-7"/></div>
                         <div>
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Mis Compras</h1>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-0.5">Suministros y Logística</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setSupModalView('LIST'); setIsSuppliersModalOpen(true); }} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm group">
                            <Building2 className="w-5 h-5 group-hover:scale-110 transition-transform"/>
                        </button>
                        <button onClick={openCreate} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 tracking-widest">
                            <Plus className="w-4 h-4"/> NUEVA ORDEN
                        </button>
                    </div>
                </div>
            </div>

            {/* MÉTRICAS INTERACTIVAS */}
            <div className="px-8 pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                <button onClick={() => setQuickFilter('ALL')} className={`bg-white p-7 rounded-[2.5rem] border-2 shadow-sm relative group text-left transition-all duration-300 transform active:scale-95 ${quickFilter === 'ALL' ? 'border-indigo-500 ring-8 ring-indigo-50' : 'border-indigo-100 hover:border-indigo-400 hover:shadow-xl'}`}>
                    <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 shadow-inner group-hover:rotate-6 transition-transform"><HistoryIcon className="w-6 h-6"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Órdenes Totales</p>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{metrics.totalOrders}</h3>
                </button>

                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group transition-all duration-500 hover:shadow-2xl">
                    <div className="absolute bottom-[-15px] right-[-15px] opacity-10 group-hover:scale-125 transition-transform duration-700 text-indigo-600"><TrendingUp className="w-32 h-32"/></div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4 shadow-inner group-hover:scale-110 transition-transform"><Coins className="w-6 h-6"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Inversión Global</p>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{settings.currency}{metrics.globalInvestment.toLocaleString()}</h3>
                </div>

                <button onClick={() => setQuickFilter('MONTH')} className={`bg-white p-7 rounded-[2.5rem] border shadow-sm group text-left transition-all duration-300 transform active:scale-95 ${quickFilter === 'MONTH' ? 'border-purple-500 ring-8 ring-purple-50 shadow-purple-100' : 'border-slate-100 hover:border-purple-300 hover:shadow-xl'}`}>
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-4 shadow-inner group-hover:animate-bounce"><Calendar className="w-6 h-6"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Este Mes</p>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{settings.currency}{metrics.thisMonth.toLocaleString()}</h3>
                </button>

                <button onClick={() => setQuickFilter('PENDING_PAY')} className={`bg-white p-7 rounded-[2.5rem] border shadow-sm relative group text-left transition-all duration-300 transform active:scale-95 ${quickFilter === 'PENDING_PAY' ? 'border-rose-500 ring-8 ring-rose-50 shadow-rose-100' : 'border-slate-100 hover:border-rose-300 hover:shadow-xl'}`}>
                    <div className="absolute top-4 right-4 px-2 py-0.5 bg-rose-500 text-white rounded-[6px] text-[8px] font-black uppercase tracking-widest shadow-lg animate-pulse">DEUDA</div>
                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-4 shadow-inner group-hover:rotate-[-12deg] transition-transform"><DebtIcon className="w-6 h-6"/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cuentas x Pagar</p>
                    <h3 className="text-4xl font-black text-rose-600 tracking-tighter leading-none">{settings.currency}{metrics.accountsPayable.toLocaleString()}</h3>
                </button>
            </div>

            {/* BÚSQUEDA Y LISTADO */}
            <div className="px-8 py-6 flex flex-col sm:flex-row gap-4 items-center shrink-0">
                <div className="flex-1 relative w-full group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                    <input className="w-full pl-14 pr-4 py-4 bg-white border-2 border-slate-100 rounded-[2rem] font-bold outline-none focus:border-indigo-400 shadow-xl shadow-slate-100/30 text-lg" placeholder="Buscar por referencia o proveedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        <button onClick={() => setDisplayMode('KANBAN')} className={`p-2.5 rounded-xl transition-all ${displayMode === 'KANBAN' ? 'bg-white shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-4 h-4"/></button>
                        <button onClick={() => setDisplayMode('LIST')} className={`p-2.5 rounded-xl transition-all ${displayMode === 'LIST' ? 'bg-white shadow-md text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-4 h-4"/></button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                {displayMode === 'KANBAN' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredPurchases.map(p => {
                            const paid = Number(p.amountPaid || 0);
                            const total = Number(p.total || 0);
                            const pending = Math.max(0, total - paid);
                            const percent = total > 0 ? (paid / total) * 100 : 0;
                            return (
                                <div key={p.id} onClick={() => openEdit(p)} className="bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer animate-fade-in-up flex flex-col border border-slate-100 group">
                                    <div className="p-6 pb-4">
                                        <div className={`px-3 py-1 rounded-xl text-[8px] font-black uppercase flex items-center gap-1.5 border w-fit mb-4 ${p.received === 'YES' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            {p.received === 'YES' ? '✅ EN STOCK' : '📦 ESPERA'}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-300 tracking-wider block mb-0.5 uppercase">#{p.reference}</span>
                                        <h3 className="font-black text-slate-800 text-xl leading-tight mb-1 truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                            {suppliers.find(s => s.id === p.supplierId)?.name || 'Proveedor'}
                                        </h3>
                                        <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1.5 mb-5 uppercase tracking-widest"><Calendar className="w-3 h-3"/> {new Date(p.date).toLocaleDateString()}</p>
                                        <div className="bg-[#0f172a] rounded-[2rem] p-6 text-white shadow-2xl relative overflow-hidden mb-5 group-hover:shadow-indigo-500/20 transition-all">
                                            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-3">Balance Financiero</p>
                                            <div className="flex justify-between items-end mb-4">
                                                <div><p className="text-2xl font-black tracking-tighter leading-none mb-1">S/{paid.toFixed(1)}</p><p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">ABONADO</p></div>
                                                <div className="text-right"><p className={`text-2xl font-black tracking-tighter leading-none mb-1 ${pending > 0 ? 'text-[#fca5a5]' : 'text-[#00d68f]'}`}>S/{pending.toFixed(1)}</p><p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">DEUDA</p></div>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                                                <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-auto px-6 pb-6">
                                        {p.received === 'YES' ? (
                                            <div className="w-full py-4 bg-slate-50 rounded-[1.8rem] flex items-center justify-center gap-3 border border-slate-100/50 shadow-inner"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EN INVENTARIO</span></div>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); onConfirmReception(p); }} className="w-full py-4.5 bg-slate-900 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 shadow-xl hover:bg-black active:scale-95 transition-all"><Package className="w-4 h-4 text-amber-400 animate-pulse"/> CARGAR STOCK</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                <tr><th className="p-6">Doc / Ref</th><th className="p-6">Fecha</th><th className="p-6">Proveedor</th><th className="p-6 text-center">Estado</th><th className="p-6 text-right">Inversión</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold text-sm">
                                {filteredPurchases.map(p => (
                                    <tr key={p.id} onClick={() => openEdit(p)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                        <td className="p-6 text-slate-400 font-mono">#{p.reference}</td>
                                        <td className="p-6 text-slate-800">{new Date(p.date).toLocaleDateString()}</td>
                                        <td className="p-6 font-black text-slate-800">{suppliers.find(s => s.id === p.supplierId)?.name || 'N/A'}</td>
                                        <td className="p-6 text-center"><span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase ${p.received === 'YES' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{p.received === 'YES' ? 'Recibido' : 'Pendiente'}</span></td>
                                        <td className="p-6 text-right font-black text-slate-900">S/{p.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL ORDEN DE COMPRA */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white w-full max-w-6xl h-[95vh] sm:h-[90vh] rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg"><Truck className="w-5 h-5"/></div>
                                <div><h2 className="text-xl font-black text-slate-800 tracking-tight">Orden de Compra</h2><p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Módulo de Suministros</p></div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"><X className="w-6 h-6"/></button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                            {/* Panel Lateral: Datos */}
                            <div className="w-full lg:w-[350px] p-8 border-r border-slate-100 bg-slate-50/30 overflow-y-auto custom-scrollbar shrink-0 space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                                        <span>Proveedor Seleccionado</span>
                                        {editingPurchase?.received !== 'YES' && (
                                            <button onClick={() => setSupModalView('CREATE')} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-black transition-transform active:scale-90"><PlusCircle className="w-3.5 h-3.5"/> NUEVO</button>
                                        )}
                                    </label>
                                    <select disabled={editingPurchase?.received === 'YES'} className="w-full p-4 bg-white border-2 border-slate-100 focus:border-indigo-400 rounded-2xl font-bold text-xs outline-none shadow-sm transition-all" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                                        <option value="">-- Seleccionar Proveedor --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                
                                {/* NUEVOS CAMPOS: DATOS DEL COMPROBANTE */}
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo de Documento</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['FACTURA', 'BOLETA', 'GUIA', 'OTRO'].map(type => (
                                                <button key={type} onClick={() => editingPurchase?.received !== 'YES' && setDocType(type as any)} className={`py-2 px-1 rounded-lg border font-black text-[9px] transition-all ${docType === type ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-400'}`}>{type}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Número de Comprobante</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4"/>
                                            <input disabled={editingPurchase?.received === 'YES'} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-transparent focus:border-indigo-400 rounded-xl font-bold text-xs outline-none" placeholder="Ej: F001-001234" value={invoice} onChange={e => setInvoice(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condición de Pago</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => editingPurchase?.received !== 'YES' && setCondition('CONTADO')} className={`p-4 rounded-2xl border-2 font-black text-[10px] flex flex-col items-center gap-2 ${condition === 'CONTADO' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}><Banknote className="w-5 h-5"/> CONTADO</button>
                                        <button onClick={() => editingPurchase?.received !== 'YES' && setCondition('CREDITO')} className={`p-4 rounded-2xl border-2 font-black text-[10px] flex flex-col items-center gap-2 ${condition === 'CREDITO' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-white border-slate-100 text-slate-400'}`}><Calendar className="w-5 h-5"/> CRÉDITO</button>
                                    </div>
                                    
                                    {condition === 'CONTADO' && (
                                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-4 animate-fade-in">
                                            <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Canal de Pago</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[{ id: 'cash', icon: Banknote, label: 'EFECT' }, { id: 'yape', icon: Smartphone, label: 'YAPE' }, { id: 'plin', icon: Zap, label: 'PLIN' }, { id: 'transfer', icon: Landmark, label: 'TRANSF' }, { id: 'card', icon: CreditCard, label: 'TARJ' }].map(m => (
                                                    <button key={m.id} onClick={() => setPaymentMethod(m.id as any)} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === m.id ? 'bg-white border-emerald-500 text-emerald-700 shadow-sm' : 'bg-transparent border-emerald-200/50 text-emerald-400'}`}><m.icon className="w-4 h-4"/><span className="text-[7px] font-black">{m.label}</span></button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {condition === 'CREDITO' && (
                                        <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4 animate-fade-in">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block">Plazos Rápidos</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {[15, 30, 45, 60].map(days => (
                                                        <button key={days} onClick={() => setQuickDueDate(days)} className="py-2 bg-white border border-indigo-100 rounded-lg text-[9px] font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">+{days} DÍAS</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block">Fecha Límite Pago</label>
                                                <input type="date" className="w-full p-3 bg-white rounded-xl font-black text-xs outline-none shadow-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Panel Central: Productos */}
                            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                                {editingPurchase?.received !== 'YES' && (
                                    <div className="p-6 border-b border-slate-100 bg-white">
                                        <div className="relative group flex gap-3">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-all w-5 h-5" />
                                                <input className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-[2rem] font-bold outline-none text-base shadow-inner transition-all" placeholder="Buscar producto o variantes..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                                            </div>
                                            <button onClick={() => onRequestNewProduct()} className="bg-slate-900 text-white p-5 rounded-[2rem] hover:bg-black transition-transform active:scale-90 shadow-lg" title="Nuevo Producto"><Plus className="w-6 h-6"/></button>
                                            
                                            {prodSearch.length > 1 && (
                                                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl z-50 mt-4 max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
                                                    {products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).map(p => (
                                                        <div key={p.id} className="mb-3 border-b border-slate-50 last:border-0 pb-3">
                                                            <div className="flex items-center justify-between p-2">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black">{p.name.charAt(0)}</div>
                                                                    <div>
                                                                        <p className="text-slate-800 text-sm font-black">{p.name}</p>
                                                                        <p className="text-[9px] text-slate-400 uppercase font-bold">{p.category}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    {onEditProduct && (
                                                                        <button onClick={() => onEditProduct(p)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors" title="Editar / Añadir Variantes"><Edit2 className="w-4 h-4"/></button>
                                                                    )}
                                                                    {!p.hasVariants && <button onClick={() => { addItemToList(p); setProdSearch(''); }} className="bg-indigo-600 text-white text-[9px] font-black px-4 py-2 rounded-xl shadow-sm hover:scale-105 transition-transform">+ AÑADIR</button>}
                                                                </div>
                                                            </div>
                                                            {p.hasVariants && p.variants && (
                                                                <div className="grid grid-cols-2 gap-2 px-14">
                                                                    {p.variants.map(v => (
                                                                        <button key={v.id} onClick={() => { addItemToList(p, v); setProdSearch(''); }} className="bg-slate-50 hover:bg-indigo-50 border border-slate-100 p-3 rounded-xl text-left transition-all group">
                                                                            <p className="text-[10px] font-black text-slate-700 group-hover:text-indigo-700">{v.name}</p>
                                                                            <p className="text-[8px] font-bold text-slate-400">Stock actual: {v.stock} un.</p>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/30">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col animate-fade-in-up">
                                            <div className="flex justify-between items-start mb-5">
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">{item.category}</span>
                                                    <h4 className="font-black text-base text-slate-800 truncate pr-6">{item.name} {item.variantName && <span className="text-indigo-600">({item.variantName})</span>}</h4>
                                                </div>
                                                {editingPurchase?.received !== 'YES' && (
                                                    <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end bg-slate-50/80 p-5 rounded-[1.8rem]">
                                                <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Cant.</label><input disabled={editingPurchase?.received === 'YES'} type="number" className="w-full p-2.5 bg-white border border-slate-100 rounded-xl font-black text-sm text-center shadow-sm" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))} /></div>
                                                <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Costo</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-black">S/</span><input disabled={editingPurchase?.received === 'YES'} type="number" className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-100 rounded-xl font-black text-sm shadow-sm" value={item.cost} onChange={e => handleUpdateItem(idx, 'cost', Number(e.target.value))} /></div></div>
                                                <div className="space-y-1"><label className="text-[8px] font-black text-indigo-400 uppercase ml-1">Margen %</label><input disabled={editingPurchase?.received === 'YES'} type="number" className="w-full p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-center font-black text-sm text-indigo-700 outline-none" value={item.margin} onChange={e => handleUpdateItem(idx, 'margin', Number(e.target.value))} /></div>
                                                <div className="space-y-1"><label className="text-[8px] font-black text-emerald-400 uppercase ml-1">Pv. Sug.</label><input disabled={editingPurchase?.received === 'YES'} type="number" className="w-full p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center font-black text-sm text-emerald-600 outline-none" value={Number(item.newSellPrice).toFixed(2)} onChange={e => handleUpdateItem(idx, 'newSellPrice', Number(e.target.value))} /></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0 shadow-2xl z-30">
                             <div><p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">Total Inversión</p><p className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{settings.currency}{totals.total.toFixed(2)}</p></div>
                             <div className="flex gap-4 w-full sm:w-auto">
                                <button onClick={() => handleSave('BORRADOR')} disabled={isSaving || items.length === 0} className="flex-1 sm:px-10 py-5 bg-slate-50 text-slate-400 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">BORRADOR</button>
                                <button onClick={() => handleSave('CONFIRMADO')} disabled={isSaving || items.length === 0 || !supplierId} className="flex-[2] sm:px-14 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                                    {isSaving ? <RefreshCw className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5 text-emerald-400"/>} {editingPurchase?.received === 'YES' ? 'ACTUALIZAR DATOS' : 'CONFIRMAR COMPRA'}
                                </button>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REGISTRO DE PROVEEDOR */}
            {supModalView === 'CREATE' && (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[600] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-10 shadow-2xl animate-fade-in-up border border-white/20">
                        <div className="flex justify-between items-center mb-8">
                             <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><Building2 className="w-7 h-7"/></div>
                                <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Nuevo Registro</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Directo a la Nube</p></div>
                             </div>
                            <button onClick={() => setSupModalView('LIST')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400"/></button>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre de la Empresa</label><input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-[2.2rem] font-bold text-base outline-none shadow-inner transition-all" value={newSup.name} onChange={e => setNewSup({...newSup, name: e.target.value})} placeholder="Ej: Alicorp S.A.A" /></div>
                            <div className="space-y-2.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Contacto</label><input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-[2.2rem] font-bold text-base outline-none shadow-inner transition-all" value={newSup.contact} onChange={e => setNewSup({...newSup, contact: e.target.value})} placeholder="Ej: Jorge Bazán" /></div>
                            <div className="space-y-2.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">WhatsApp / Teléfono</label><input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-[2.2rem] font-bold text-base outline-none shadow-inner transition-all" value={newSup.phone} onChange={e => setNewSup({...newSup, phone: e.target.value})} placeholder="Ej: 999 000 111" /></div>
                            <button onClick={handleAddSup} disabled={!newSup.name || isSaving} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-black shadow-2xl transition-all flex items-center justify-center gap-4 mt-4">
                                {isSaving ? <RefreshCw className="w-6 h-6 animate-spin"/> : <CheckCircle2 className="w-6 h-6 text-emerald-400"/>} REGISTRAR Y SELECCIONAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AGENDA DE PROVEEDORES */}
            {isSuppliersModalOpen && supModalView !== 'CREATE' && (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[400] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[3.5rem] shadow-2xl animate-fade-in-up border border-slate-100 flex flex-col overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white shrink-0">
                             <div className="flex items-center gap-4">
                                {supModalView !== 'LIST' && <button onClick={() => setSupModalView('LIST')} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"><ChevronLeft className="w-6 h-6"/></button>}
                                <div><h3 className="font-black text-2xl text-slate-800 tracking-tight">{supModalView === 'LIST' ? 'Agenda de Proveedores' : 'Historial de Compras'}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base de Datos Centralizada</p></div>
                             </div>
                             <button onClick={() => setIsSuppliersModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 shadow-sm"><X className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white">
                            {supModalView === 'LIST' && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
                                        <div className="flex-1 relative w-full group"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" /><input className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-[2rem] font-bold text-sm outline-none transition-all shadow-inner" placeholder="Filtrar proveedor por nombre..." value={supSearch} onChange={e => setSupSearch(e.target.value)} /></div>
                                        <button onClick={() => setSupModalView('CREATE')} className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-black transition-all">AÑADIR REGISTRO</button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {suppliers.filter(s => s.name.toLowerCase().includes(supSearch.toLowerCase())).map(s => (
                                            <div key={s.id} onClick={() => { setSelectedSupplier(s); setSupModalView('HISTORY'); }} className="p-7 bg-white border border-slate-100 rounded-[2.5rem] flex justify-between items-center group hover:border-indigo-200 transition-all cursor-pointer">
                                                <div className="flex items-center gap-6"><div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600"><Building2 className="w-7 h-7"/></div><div><p className="font-black text-slate-800 text-xl leading-tight">{s.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5">{s.contact || 'S/V'}</p></div></div>
                                                <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-indigo-400 transition-transform group-hover:translate-x-1"/>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {supModalView === 'HISTORY' && selectedSupplier && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-6"><div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white"><Building2 className="w-10 h-10"/></div><div><h4 className="text-4xl font-black text-slate-800 tracking-tighter">{selectedSupplier.name}</h4><p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-widest">{selectedSupplier.contact}</p></div></div>
                                        <div className="bg-emerald-50 px-8 py-4 rounded-[1.8rem] border border-emerald-100 text-center"><p className="text-[10px] font-black text-emerald-600 mb-1">TOTAL INVERTIDO</p><p className="text-2xl font-black text-emerald-700">{settings.currency}{purchases.filter(p => p.supplierId === selectedSupplier.id).reduce((acc, p) => acc + p.total, 0).toFixed(2)}</p></div>
                                    </div>
                                    <div className="space-y-4">
                                        {purchases.filter(p => p.supplierId === selectedSupplier.id).map(p => (
                                            <div key={p.id} className="p-6 bg-white border border-slate-100 rounded-[2.5rem] flex justify-between items-center group hover:border-indigo-100 transition-all">
                                                <div className="flex items-center gap-6"><div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-indigo-600"><Receipt className="w-6 h-6"/></div><div><p className="font-black text-slate-800">Orden #{p.reference}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(p.date).toLocaleDateString()}</p></div></div>
                                                <div className="text-right"><p className="font-black text-slate-900 text-lg">{settings.currency}{p.total.toFixed(2)}</p><button onClick={() => {openEdit(p); setIsSuppliersModalOpen(false);}} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline mt-1">Ver Detalles</button></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};