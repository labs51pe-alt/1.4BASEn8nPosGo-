
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
    Smartphone as YapeIcon, 
    Zap as PlinIcon, Timer, ChevronRight,
    ArrowUpRight, AlertTriangle, Coins, Banknote,
    UserPlus, ShieldCheck, Info, Tag, Percent,
    ChevronLeft, BarChart3, ShoppingBag, ArrowRight,
    History, ChevronDown, Hash, ScanBarcode, PlusCircle
} from 'lucide-react';

interface PurchasesViewProps {
    products: Product[];
    suppliers: Supplier[];
    purchases: Purchase[];
    onProcessPurchase: (purchase: Purchase, updatedProducts: Product[]) => Promise<void>;
    onConfirmReception: (purchase: Purchase) => Promise<void>;
    onRevertReception: (purchase: Purchase) => Promise<void>;
    onAddSupplier: (supplier: Supplier) => void;
    onRequestNewProduct: (barcode?: string) => void;
    settings: StoreSettings;
    initialSearchTerm?: string;
    onClearInitialSearch?: () => void;
}

type ViewMode = 'KANBAN' | 'LIST';
type SupplierModalView = 'LIST' | 'DETAIL' | 'CREATE';

export const PurchasesView: React.FC<PurchasesViewProps> = ({ 
    products, suppliers, purchases = [], onProcessPurchase, onConfirmReception, onRevertReception, onAddSupplier, 
    onRequestNewProduct, settings, initialSearchTerm 
}) => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [viewMode, setViewMode] = useState<ViewMode>('KANBAN');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Suppliers State
    const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
    const [supModalView, setSupModalView] = useState<SupplierModalView>('LIST');
    const [selectedSupForHistory, setSelectedSupForHistory] = useState<Supplier | null>(null);
    const [supSearchTerm, setSupSearchTerm] = useState('');
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

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
    const [barcodeSearch, setBarcodeSearch] = useState('');

    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // New Supplier State
    const [newSupName, setNewSupName] = useState('');
    const [newSupContact, setNewSupContact] = useState('');
    const [newSupPhone, setNewSupPhone] = useState('');

    const openCreate = () => {
        setEditingPurchase(null); setItems([]); setSupplierId(''); setInvoice(''); setDocType('FACTURA'); setCondition('CONTADO');
        setAmountPaid(''); setPaymentMethod('cash'); setPayFromCash(true); setTaxIncluded(true); setIsModalOpen(true);
        setCreditDays('30');
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
        setSupplierId(p.supplierId); 
        setInvoice(p.invoiceNumber || ''); 
        setDocType(p.docType || 'FACTURA');
        setCondition(p.paymentCondition);
        setAmountPaid((p.amountPaid ?? 0).toString()); 
        setPaymentMethod((p.paymentMethod as PaymentMethod) || 'cash');
        setPayFromCash(p.payFromCash); setTaxIncluded(p.taxIncluded); setIsModalOpen(true);
        
        if (p.paymentCondition === 'CREDITO' && p.dueDate) {
            const diffTime = Math.abs(new Date(p.dueDate).getTime() - new Date(p.date).getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setCreditDays(diffDays.toString());
        }
    };

    const isReadOnly = editingPurchase?.status === 'RECIBIDO';

    const totals = useMemo(() => {
        const subtotalRaw = items.reduce((s, i) => s + (Number(i.cost || 0) * Number(i.quantity || 0)), 0);
        let tax = taxIncluded ? subtotalRaw - (subtotalRaw / (1 + settings.taxRate)) : subtotalRaw * settings.taxRate;
        let total = taxIncluded ? subtotalRaw : subtotalRaw + tax;
        return { subtotal: taxIncluded ? subtotalRaw - tax : subtotalRaw, tax, total };
    }, [items, taxIncluded, settings.taxRate]);

    const calculatedDueDate = useMemo(() => {
        if (condition !== 'CREDITO') return undefined;
        const date = new Date();
        date.setDate(date.getDate() + parseInt(creditDays || '0'));
        return date.toISOString();
    }, [condition, creditDays]);

    const getFinanceStatus = (p: Purchase) => {
        const paid = Number(p.amountPaid || 0);
        const total = Number(p.total || 0);
        if (p.status === 'CANCELADO') return { label: 'ANULADO', color: 'bg-rose-600', ribbon: 'ANULADO' };
        if (paid >= total && total > 0) return { label: 'PAGADO', color: 'bg-emerald-500', ribbon: 'PAGADO' };
        if (paid > 0) return { label: 'PARCIAL', color: 'bg-indigo-600', ribbon: 'PARCIAL' };
        return { label: 'PENDIENTE', color: 'bg-slate-400', ribbon: 'PENDIENTE' };
    };

    const handleUpdateItem = (idx: number, field: string, value: any) => {
        setItems(prev => prev.map((it, i) => {
            if (i !== idx) return it;
            const updated = { ...it, [field]: value };
            
            const cost = Number(updated.cost || 0);
            if (field === 'cost' || field === 'margin') {
                const marginVal = Number(updated.margin || 0);
                updated.newSellPrice = cost * (1 + marginVal / 100);
            } else if (field === 'newSellPrice') {
                const priceVal = Number(updated.newSellPrice || 0);
                updated.margin = cost > 0 ? (((priceVal / cost) - 1) * 100).toFixed(2) : 0;
            }
            
            return updated;
        }));
    };

    const addItemToList = (p: Product) => {
        if (!items.find(i => i.id === p.id)) {
            setItems([...items, { 
                id: p.id, 
                name: p.name, 
                quantity: 1, 
                cost: p.cost || 0, 
                currentPrice: p.price, 
                newSellPrice: p.price, 
                margin: p.cost ? (((p.price / p.cost) - 1) * 100).toFixed(2) : 0, 
                category: p.category 
            }]);
        }
    };

    const handleBarcodeSearch = (code: string) => {
        setBarcodeSearch(code);
        if (code.length >= 4) {
            const prod = products.find(p => p.barcode === code);
            if (prod) {
                addItemToList(prod);
                setBarcodeSearch('');
            }
        }
    };

    const filteredPurchases = useMemo(() => {
        return (purchases || []).filter(p => {
            const supName = suppliers.find(s => s.id === p.supplierId)?.name || '';
            return supName.toLowerCase().includes(searchTerm.toLowerCase()) || p.reference.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [purchases, searchTerm, suppliers]);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => 
            s.name.toLowerCase().includes(supSearchTerm.toLowerCase()) ||
            (s.contact && s.contact.toLowerCase().includes(supSearchTerm.toLowerCase()))
        );
    }, [suppliers, supSearchTerm]);

    const supplierStats = useMemo(() => {
        if (!selectedSupForHistory) return { count: 0, total: 0 };
        const supPurchases = purchases.filter(p => p.supplierId === selectedSupForHistory.id && p.status !== 'CANCELADO');
        return {
            count: supPurchases.length,
            total: supPurchases.reduce((acc, p) => acc + p.total, 0)
        };
    }, [selectedSupForHistory, purchases]);

    const handleSave = async (status: PurchaseStatus) => {
        if (!supplierId || items.length === 0) return alert("Completa los datos mínimos (Proveedor y Artículos)");
        
        setIsSaving(true);
        try {
            const purchase: Purchase = {
                id: editingPurchase?.id || crypto.randomUUID(), 
                reference: editingPurchase?.reference || `C-${Date.now().toString().slice(-6)}`,
                date: editingPurchase?.date || new Date().toISOString(), 
                dueDate: condition === 'CREDITO' ? calculatedDueDate : undefined,
                supplierId, 
                invoiceNumber: invoice, 
                docType,
                paymentCondition: condition,
                subtotal: totals.subtotal, 
                tax: totals.tax, 
                total: totals.total, 
                amountPaid: condition === 'CONTADO' ? totals.total : Number(amountPaid || 0),
                paymentMethod, 
                payFromCash, 
                taxIncluded, 
                status, 
                received: editingPurchase?.received || 'NO',
                items: items.map(i => ({ 
                    productId: i.id, 
                    productName: i.name, 
                    quantity: Number(i.quantity), 
                    cost: Number(i.cost), 
                    isBonus: false, 
                    newSellPrice: Number(i.newSellPrice || 0) 
                }))
            };
            
            await onProcessPurchase(purchase, []); 
            setIsModalOpen(false); 
        } catch (e: any) { 
            console.error("Error al guardar compra:", e);
            const errorMsg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
            alert("Error al sincronizar: " + errorMsg); 
        } finally { 
            setIsSaving(false); 
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden pb-24 lg:pb-8">
            {/* CABECERA */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 sm:px-8 shrink-0 shadow-sm z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                            <Truck className="w-7 h-7 text-indigo-600"/> Mis Compras
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Control de Stock e Inventario Entrante</p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner shrink-0">
                            <button onClick={() => setViewMode('KANBAN')} className={`p-2 rounded-xl transition-all ${viewMode === 'KANBAN' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-5 h-5"/></button>
                            <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-xl transition-all ${viewMode === 'LIST' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5"/></button>
                        </div>
                        <button onClick={() => { setSupModalView('LIST'); setIsSuppliersModalOpen(true); }} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-50 transition-all shadow-sm"><Building2 className="w-4 h-4"/> Proveedores</button>
                        <button onClick={openCreate} className="flex-1 md:flex-none bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-100 active:scale-95 transition-all hover:bg-indigo-700 flex items-center justify-center gap-2">
                            <Plus className="w-5 h-5"/> Nueva Orden
                        </button>
                    </div>
                </div>
            </div>

            {/* FILTROS Y BÚSQUEDA */}
            <div className="px-6 py-4 sm:px-8 bg-slate-50/50 border-b border-slate-100 flex gap-4 items-center">
                <div className="flex-1 relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                    <input className="w-full pl-14 pr-6 py-3.5 bg-white border-2 border-transparent rounded-[1.5rem] font-bold outline-none focus:border-indigo-400 shadow-sm text-sm" placeholder="Buscar por referencia, factura o proveedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
                {filteredPurchases.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                        <Inbox className="w-20 h-20 opacity-20"/>
                        <p className="font-black text-xl">Sin registros de compra</p>
                    </div>
                ) : viewMode === 'KANBAN' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredPurchases.map(p => {
                            const fin = getFinanceStatus(p);
                            const isOverdue = p.dueDate && new Date(p.dueDate) < new Date() && p.amountPaid < p.total;
                            return (
                                <div key={p.id} onClick={() => openEdit(p)} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 transition-all cursor-pointer group animate-fade-in-up relative overflow-hidden flex flex-col min-h-[340px]">
                                    
                                    <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none z-20">
                                        <div className={`absolute top-0 right-0 py-1.5 px-10 transform rotate-45 translate-x-10 translate-y-4 shadow-lg text-[10px] font-black text-center text-white w-full uppercase tracking-widest ${fin.color}`}>
                                            {fin.ribbon}
                                        </div>
                                    </div>

                                    {isOverdue && <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 animate-pulse"></div>}
                                    
                                    <div className="p-7 pb-0">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="min-w-0 pr-12">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">#{p.reference}</span>
                                                <h3 className="font-black text-slate-800 text-lg leading-tight truncate">{suppliers.find(s => s.id === p.supplierId)?.name || 'Proveedor N/A'}</h3>
                                                <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1 flex items-center gap-1.5"><Calendar className="w-3 h-3"/> {new Date(p.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 mb-6">
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border ${p.received === 'YES' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                    {p.received === 'YES' ? <CheckCircle2 className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                                                    {p.received === 'YES' ? 'INGRESO PRODUCTOS' : 'ORDEN CONFIRMADA'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold italic line-clamp-1">
                                                {p.docType || 'DOC'}: {p.invoiceNumber || 'S/N'}
                                            </p>
                                        </div>

                                        <div className="bg-slate-50/80 rounded-3xl p-5 mb-6 border border-slate-100 group-hover:bg-indigo-50/30 transition-colors mt-auto shadow-inner">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Compra</p>
                                                    <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">S/{p.total.toFixed(2)}</p>
                                                </div>
                                                <div className="text-right">
                                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Abonado</p>
                                                     <p className="text-sm font-black text-slate-600">S/{p.amountPaid.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-7 pt-0 mt-auto flex gap-3">
                                        {p.received === 'NO' ? (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onConfirmReception(p); }} 
                                                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 shadow-xl shadow-emerald-100 active:scale-95 transition-all"
                                            >
                                                <Package className="w-4 h-4"/> CARGAR STOCK
                                            </button>
                                        ) : (
                                            <div className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 border border-slate-200 cursor-default">
                                                <ShieldCheck className="w-4 h-4 text-emerald-500"/> INVENTARIO OK
                                            </div>
                                        )}
                                        <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100"><Eye className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                <tr>
                                    <th className="p-6">Referencia / Fecha</th>
                                    <th className="p-6">Proveedor</th>
                                    <th className="p-6 text-center">Estado Almacén</th>
                                    <th className="p-6 text-center">Finanzas</th>
                                    <th className="p-6 text-right">Total</th>
                                    <th className="p-6 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold text-sm">
                                {filteredPurchases.map(p => {
                                    const fin = getFinanceStatus(p);
                                    return (
                                        <tr key={p.id} onClick={() => openEdit(p)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                            <td className="p-6">
                                                <p className="text-slate-800 font-black">#{p.reference}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{new Date(p.date).toLocaleDateString()}</p>
                                            </td>
                                            <td className="p-6">
                                                <p className="text-slate-700">{suppliers.find(s => s.id === p.supplierId)?.name || 'N/A'}</p>
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${p.received === 'YES' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                    {p.received === 'YES' ? 'INGRESADO' : 'PENDIENTE'}
                                                </span>
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase text-white ${fin.color}`}>{fin.ribbon}</span>
                                            </td>
                                            <td className="p-6 text-right text-slate-900">S/{p.total.toFixed(2)}</td>
                                            <td className="p-6 text-right">
                                                <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"><ChevronRight className="w-5 h-5"/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DETALLES Y CREACIÓN - AJUSTADO Z-INDEX A 300 PARA QUEDAR POR ENCIMA DEL HISTORIAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white w-full max-w-6xl h-[92vh] sm:h-[90vh] rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border border-white/20">
                        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl">
                                    <Truck className="w-4 h-4 sm:w-5 sm:h-5"/>
                                </div>
                                <div>
                                    <h2 className="text-sm sm:text-lg font-black text-slate-800 tracking-tight leading-tight">Gestión de Orden</h2>
                                    <p className="text-slate-400 text-[7px] sm:text-[8px] font-bold uppercase tracking-widest mt-0.5">Control de Trazabilidad y Pagos</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50/30">
                            {/* Panel Izquierdo */}
                            <div className="w-full lg:w-[320px] p-4 sm:p-5 border-r border-slate-100 bg-white overflow-y-auto custom-scrollbar space-y-4 sm:space-y-5">
                                <div className="space-y-4 pt-1">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex justify-between">
                                            <span>Proveedor Oficial</span>
                                            <button onClick={() => { setSupModalView('CREATE'); setIsSuppliersModalOpen(true); }} className="text-indigo-600 hover:underline">Nuevo +</button>
                                        </label>
                                        <select disabled={isReadOnly} className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-xl font-bold text-xs outline-none transition-all shadow-inner" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                                            <option value="">Seleccionar Proveedor...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Tipo Doc.</label>
                                            <select disabled={isReadOnly} className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-xl font-bold text-xs outline-none transition-all" value={docType} onChange={e => setDocType(e.target.value as any)}>
                                                <option value="FACTURA">Factura</option>
                                                <option value="BOLETA">Boleta</option>
                                                <option value="GUIA">Guía</option>
                                                <option value="OTRO">Otro</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">N° Documento</label>
                                            <input disabled={isReadOnly} className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-xl font-bold text-xs outline-none transition-all shadow-inner" placeholder="Ejem: F001-0001" value={invoice} onChange={e => setInvoice(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Condición</label>
                                            <select disabled={isReadOnly} className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-xl font-bold text-xs outline-none transition-all" value={condition} onChange={e => setCondition(e.target.value as any)}>
                                                <option value="CONTADO">Contado</option>
                                                <option value="CREDITO">Crédito</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Medio Pago</label>
                                            <select disabled={isReadOnly} className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-xl font-bold text-xs outline-none transition-all" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                                                <option value="cash">Efectivo</option>
                                                <option value="transfer">Transferencia</option>
                                                <option value="yape">Yape</option>
                                                <option value="plin">Plin</option>
                                                <option value="card">Tarjeta</option>
                                            </select>
                                        </div>
                                    </div>

                                    {condition === 'CREDITO' ? (
                                        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-3 animate-fade-in shadow-sm">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                    <Timer className="w-3 h-3"/> Plazo Venc.
                                                </label>
                                                <select disabled={isReadOnly} className="w-full p-2.5 bg-white border-2 border-rose-200 focus:border-rose-400 rounded-lg font-black text-slate-800 outline-none transition-all text-[10px]" value={creditDays} onChange={e => setCreditDays(e.target.value)}>
                                                    <option value="7">7 Días</option>
                                                    <option value="15">15 Días</option>
                                                    <option value="30">30 Días</option>
                                                    <option value="60">60 Días</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest ml-1">Pago Hoy</label>
                                                <input disabled={isReadOnly} type="number" className="w-full p-2.5 bg-white border-2 border-rose-200 focus:border-rose-400 rounded-lg font-black text-slate-800 text-sm outline-none" placeholder="0.00" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                                            </div>
                                            <div className="pt-2 border-t border-rose-200/50 flex justify-between items-center px-1">
                                                <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Fecha Límite:</span>
                                                <span className="text-[10px] font-black text-rose-600 underline decoration-1">{new Date(calculatedDueDate || '').toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3 animate-fade-in shadow-sm">
                                            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 shadow-inner"><Check className="w-3 h-3 stroke-[4px]"/></div>
                                            <div>
                                                <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-0.5">Liquidación Contado</p>
                                                <p className="text-[7px] text-emerald-500 font-bold uppercase">Pago Completo Registrado</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                                         <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all group">
                                            <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${payFromCash ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                {payFromCash && <Check className="w-2.5 h-2.5 text-white stroke-[4px]"/>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={payFromCash} onChange={e => setPayFromCash(e.target.checked)} />
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-700 transition-colors">Descontar de Caja</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Panel Derecho */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="p-3 sm:p-4 border-b border-slate-100 bg-white shadow-sm z-10 flex flex-col sm:flex-row gap-3">
                                    <div className="relative group flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                                        <input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl font-bold outline-none transition-all text-xs shadow-inner" placeholder="Busca productos por nombre..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                                        {prodSearch.length > 1 && (
                                            <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-[1.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.1)] z-[310] mt-2 max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                                                {products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).length === 0 ? (
                                                    <button onClick={() => { onRequestNewProduct(); setProdSearch(''); }} className="w-full p-4 text-center text-indigo-600 font-black text-xs hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-center gap-2">
                                                        <PlusCircle className="w-4 h-4"/> El producto no existe. ¿Deseas crearlo?
                                                    </button>
                                                ) : (
                                                    products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).map(p => (
                                                        <button key={p.id} onClick={() => { addItemToList(p); setProdSearch(''); }} className="w-full p-3 hover:bg-indigo-50 text-left text-xs font-bold border-b border-slate-50 last:border-0 rounded-xl flex justify-between items-center group transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors text-xs font-black">{p.name.charAt(0)}</div>
                                                                <div>
                                                                    <p className="text-slate-800 text-xs">{p.name}</p>
                                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{p.category}</p>
                                                                </div>
                                                            </div>
                                                            <span className="text-[8px] font-black bg-indigo-50 text-indigo-400 px-2.5 py-1 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">+ ADD</span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative group flex-1">
                                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4" />
                                        <input 
                                            ref={barcodeInputRef}
                                            className="w-full pl-10 pr-4 py-2.5 bg-emerald-50/50 border-2 border-transparent focus:border-emerald-400 rounded-2xl font-bold outline-none transition-all text-xs shadow-inner" 
                                            placeholder="Escanear Código de Barras..." 
                                            value={barcodeSearch} 
                                            onChange={e => handleBarcodeSearch(e.target.value)} 
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && barcodeSearch) {
                                                    const prod = products.find(p => p.barcode === barcodeSearch);
                                                    if (!prod) {
                                                        if (window.confirm("Producto no registrado. ¿Deseas crearlo ahora?")) {
                                                            onRequestNewProduct(barcodeSearch);
                                                            setBarcodeSearch('');
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    <button 
                                        onClick={() => onRequestNewProduct()}
                                        className="px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-[10px] uppercase hover:bg-indigo-100 transition-all flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <PlusCircle className="w-4 h-4"/> Nuevo Producto
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar space-y-3">
                                    {items.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-4">
                                            <Package className="w-16 h-16 sm:w-20 sm:h-20"/>
                                            <p className="font-black text-lg sm:text-xl tracking-tight">El pedido está vacío</p>
                                        </div>
                                    ) : items.map((item, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col animate-fade-in-up hover:border-indigo-200 transition-all group overflow-hidden">
                                            <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-4 mb-3">
                                                <div className="flex-1 min-w-0 text-center md:text-left w-full">
                                                    <p className="text-[7px] sm:text-[8px] font-black text-indigo-500 uppercase mb-0.5 tracking-[0.2em]">{item.category}</p>
                                                    <h4 className="font-black text-sm sm:text-base text-slate-800 leading-tight truncate">{item.name}</h4>
                                                </div>
                                                <div className="flex gap-3">
                                                     <div className="flex flex-col items-center bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                        <span className="text-[7px] font-black text-slate-400 uppercase mb-0.5 whitespace-nowrap">Venta Actual</span>
                                                        <span className="text-[10px] font-black text-slate-600">{settings.currency}{Number(item.currentPrice).toFixed(2)}</span>
                                                     </div>
                                                     {!isReadOnly && (
                                                        <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="w-8 h-8 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center shrink-0">
                                                            <Trash2 className="w-4 h-4"/>
                                                        </button>
                                                     )}
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2.5 bg-slate-50/50 rounded-xl border border-slate-50">
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 ml-1">Cant. Compra</label>
                                                    <input disabled={isReadOnly} type="number" className="w-full p-2 bg-white border border-slate-200 focus:border-indigo-400 rounded-lg text-center font-black text-xs outline-none shadow-sm" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-slate-400 uppercase mb-1 ml-1">Costo Unit.</label>
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 font-black text-[9px]">S/</span>
                                                        <input disabled={isReadOnly} type="number" className="w-full pl-5 pr-2 p-2 bg-white border border-slate-200 focus:border-indigo-400 rounded-lg text-right font-black text-xs outline-none shadow-sm" value={item.cost} onChange={e => handleUpdateItem(idx, 'cost', Number(e.target.value))} />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-indigo-600 uppercase mb-1 ml-1 flex items-center gap-1"><Percent className="w-2 h-2"/> Margen %</label>
                                                    <div className="relative">
                                                        <input disabled={isReadOnly} type="number" className="w-full pr-5 pl-2 p-2 bg-indigo-50/50 border border-indigo-100 focus:border-indigo-400 rounded-lg text-center font-black text-xs outline-none text-indigo-700 shadow-sm" value={item.margin} onChange={e => handleUpdateItem(idx, 'margin', Number(e.target.value))} />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-300 font-black text-[9px]">%</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[7px] font-black text-emerald-600 uppercase mb-1 ml-1 flex items-center gap-1"><Tag className="w-2 h-2"/> Nuevo Venta</label>
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-300 font-black text-[9px]">S/</span>
                                                        <input disabled={isReadOnly} type="number" className="w-full pl-5 pr-2 p-2 bg-emerald-50/50 border border-emerald-100 focus:border-emerald-400 rounded-lg text-right font-black text-xs outline-none text-emerald-700 shadow-sm" value={Number(item.newSellPrice).toFixed(2)} onChange={e => handleUpdateItem(idx, 'newSellPrice', Number(e.target.value))} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer: Totales Globales */}
                        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
                             <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 w-full sm:w-auto">
                                <div className="hidden sm:block">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Base Imponible</p>
                                    <p className="font-bold text-slate-600 text-xs tracking-tight leading-none">S/{totals.subtotal.toFixed(2)}</p>
                                </div>
                                <div className="hidden lg:block">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Impuestos ({settings.taxRate*100}%)</p>
                                    <p className="font-bold text-slate-600 text-xs tracking-tight leading-none">S/{totals.tax.toFixed(2)}</p>
                                </div>
                                <div className="col-span-2 lg:col-span-1">
                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-0.5 flex items-center gap-1.5 leading-none"><ArrowUpRight className="w-3 h-3"/> Inversión Final</p>
                                    <p className="text-xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none">S/{totals.total.toFixed(2)}</p>
                                </div>
                             </div>

                             {!isReadOnly && (
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button onClick={() => handleSave('BORRADOR')} disabled={isSaving} className="flex-1 sm:flex-none px-5 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Borrador</button>
                                    <button 
                                        onClick={() => handleSave('CONFIRMADO')} 
                                        disabled={isSaving || items.length === 0 || !supplierId}
                                        className="flex-[2] sm:flex-none px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2.5"
                                    >
                                        {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <><CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[3px]"/> Finalizar Orden</>}
                                    </button>
                                </div>
                             )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PROVEEDORES REDISEÑADO */}
            {isSuppliersModalOpen && (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[250] flex items-center justify-center p-4 sm:p-6">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-[3rem] shadow-2xl animate-fade-in-up border border-slate-100 flex flex-col overflow-hidden">
                        
                        {/* Header con Navegación */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                             <div className="flex items-center gap-4">
                                {supModalView !== 'LIST' && (
                                    <button onClick={() => setSupModalView('LIST')} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"><ChevronLeft className="w-6 h-6"/></button>
                                )}
                                <div>
                                    <h3 className="font-black text-2xl text-slate-800 tracking-tighter">
                                        {supModalView === 'LIST' ? 'Gestión de Proveedores' : 
                                         supModalView === 'DETAIL' ? 'Historial de Compras' : 'Nuevo Proveedor'}
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base de Datos Maestra</p>
                                </div>
                             </div>
                             <button onClick={() => setIsSuppliersModalOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-rose-50 transition-colors"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                            
                            {/* VISTA LISTA */}
                            {supModalView === 'LIST' && (
                                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                                    <div className="flex flex-col sm:flex-row gap-4 mb-6 shrink-0">
                                        <div className="flex-1 relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl font-bold text-sm outline-none transition-all" 
                                                placeholder="Filtrar por nombre o contacto..." 
                                                value={supSearchTerm}
                                                onChange={e => setSupSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <button 
                                            onClick={() => setSupModalView('CREATE')}
                                            className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                                        >
                                            <UserPlus className="w-4 h-4"/> Añadir Registro
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                        {filteredSuppliers.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                                                <Building2 className="w-20 h-20 mb-4"/>
                                                <p className="font-black text-xl">Sin coincidencias</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {filteredSuppliers.map(s => {
                                                    const orderCount = purchases.filter(p => p.supplierId === s.id && p.status !== 'CANCELADO').length;
                                                    return (
                                                        <div 
                                                            key={s.id} 
                                                            onClick={() => { setSelectedSupForHistory(s); setSupModalView('DETAIL'); }}
                                                            className="p-5 bg-white border border-slate-100 rounded-[2rem] flex justify-between items-center hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/30 transition-all cursor-pointer group"
                                                        >
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                                    <Building2 className="w-6 h-6"/>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-black text-slate-800 text-lg leading-tight truncate">{s.name}</p>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{s.contact || 'SIN VENDEDOR'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="flex items-center gap-1.5 text-indigo-500 font-black text-xs justify-end">
                                                                    {orderCount} <ShoppingBag className="w-3 h-3"/>
                                                                </div>
                                                                <ChevronRight className="w-5 h-5 text-slate-200 mt-1 group-hover:translate-x-1 transition-transform"/>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* VISTA DETALLE / HISTORIAL MEJORADA CON PRODUCTOS Y FACTURAS */}
                            {supModalView === 'DETAIL' && selectedSupForHistory && (
                                <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden animate-fade-in">
                                    <div className="flex flex-col md:flex-row gap-6 mb-8 items-start md:items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl">
                                                <Building2 className="w-8 h-8"/>
                                            </div>
                                            <div>
                                                <h4 className="text-2xl font-black text-slate-800">{selectedSupForHistory.name}</h4>
                                                <div className="flex flex-wrap gap-3 mt-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserPlus className="w-3 h-3"/> {selectedSupForHistory.contact || 'S/C'}</span>
                                                    {selectedSupForHistory.phone && <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1"><PlinIcon className="w-3 h-3"/> {selectedSupForHistory.phone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 w-full md:w-auto">
                                            <div className="flex-1 md:flex-none p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                                                <p className="text-[8px] font-black text-emerald-600 uppercase mb-0.5">Total Invertido</p>
                                                <p className="text-xl font-black text-emerald-700 leading-none">{settings.currency}{supplierStats.total.toFixed(2)}</p>
                                            </div>
                                            <div className="flex-1 md:flex-none p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-center">
                                                <p className="text-[8px] font-black text-indigo-600 uppercase mb-0.5">Órdenes Ok</p>
                                                <p className="text-xl font-black text-indigo-700 leading-none">{supplierStats.count}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
                                        <div className="p-5 border-b border-slate-100 bg-white flex justify-between items-center">
                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><History className="w-4 h-4"/> Registro Histórico</h5>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5">
                                            <div className="space-y-4">
                                                {purchases.filter(p => p.supplierId === selectedSupForHistory.id).length === 0 ? (
                                                    <div className="py-20 text-center text-slate-300 font-black">No hay transacciones registradas</div>
                                                ) : (
                                                    purchases.filter(p => p.supplierId === selectedSupForHistory.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => {
                                                        const fin = getFinanceStatus(p);
                                                        const isExpanded = expandedHistoryId === p.id;
                                                        return (
                                                            <div key={p.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
                                                                <div 
                                                                    onClick={() => setExpandedHistoryId(isExpanded ? null : p.id)}
                                                                    className={`p-5 flex flex-col sm:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : ''}`}
                                                                >
                                                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.status === 'CANCELADO' ? 'bg-rose-50 text-rose-400' : 'bg-slate-50 text-slate-400'}`}>
                                                                            {isExpanded ? <ChevronDown className="w-5 h-5"/> : <ShoppingBag className="w-5 h-5"/>}
                                                                        </div>
                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <p className="font-black text-slate-800 text-sm">Ref: #{p.reference}</p>
                                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase text-white ${fin.color}`}>{fin.ribbon}</span>
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(p.date).toLocaleDateString()} • {p.items.length} Artículos</p>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                                                        <div className="text-right">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">DOCUMENTO</p>
                                                                            <p className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{p.docType || 'DOC'}: {p.invoiceNumber || 'S/N'}</p>
                                                                        </div>
                                                                        <div className="text-right border-l border-slate-100 pl-4">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">TOTAL</p>
                                                                            <p className="text-sm font-black text-slate-900 leading-none">{settings.currency}{p.total.toFixed(2)}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* DETALLE EXPANDIDO: PRODUCTOS Y COSTOS */}
                                                                {isExpanded && (
                                                                    <div className="p-5 bg-slate-50/30 animate-fade-in">
                                                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-inner overflow-hidden">
                                                                            <table className="w-full text-left text-[11px]">
                                                                                <thead className="bg-slate-100/50 text-[8px] font-black uppercase text-slate-400 tracking-widest">
                                                                                    <tr>
                                                                                        <th className="p-3">Producto</th>
                                                                                        <th className="p-3 text-center">Cant</th>
                                                                                        <th className="p-3 text-right">Costo Unit</th>
                                                                                        <th className="p-3 text-right">Subtotal</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-50 font-bold">
                                                                                    {p.items.map((item, idx) => (
                                                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                                            <td className="p-3 text-slate-700">{item.productName || 'Producto'}</td>
                                                                                            <td className="p-3 text-center text-slate-900 font-black">{item.quantity}</td>
                                                                                            <td className="p-3 text-right text-indigo-600">{settings.currency}{item.cost.toFixed(2)}</td>
                                                                                            <td className="p-3 text-right text-slate-900">{settings.currency}{(item.quantity * item.cost).toFixed(2)}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3 px-2">
                                                                             <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                                 <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3"/> Vence: {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'N/A'}</span>
                                                                                 <span className="flex items-center gap-1.5"><CreditCard className="w-3 h-3"/> Pago: {p.paymentCondition}</span>
                                                                             </div>
                                                                             <button 
                                                                                onClick={() => openEdit(p)}
                                                                                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all active:scale-95"
                                                                             >
                                                                                <Eye className="w-3.5 h-3.5"/> Ver Documento Completo
                                                                             </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* VISTA CREAR */}
                            {supModalView === 'CREATE' && (
                                <div className="flex-1 p-8 animate-fade-in flex flex-col items-center justify-center max-w-2xl mx-auto">
                                    <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mb-8 shadow-inner">
                                        <UserPlus className="w-10 h-10"/>
                                    </div>
                                    <div className="w-full space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nombre de la Empresa / Negocio</label>
                                                <input 
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-inner" 
                                                    placeholder="Ej. Corporación Alicorp SAA" 
                                                    value={newSupName} 
                                                    onChange={e => setNewSupName(e.target.value)} 
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Persona de Contacto</label>
                                                    <input 
                                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-inner" 
                                                        placeholder="Ej. Juan Pérez" 
                                                        value={newSupContact} 
                                                        onChange={e => setNewSupContact(e.target.value)} 
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Celular / WhatsApp</label>
                                                    <input 
                                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-inner" 
                                                        placeholder="Ej. 987 654 321" 
                                                        value={newSupPhone} 
                                                        onChange={e => setNewSupPhone(e.target.value)} 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => { 
                                                if(!newSupName) return alert("El nombre es obligatorio"); 
                                                onAddSupplier({ id: crypto.randomUUID(), name: newSupName, contact: newSupContact, phone: newSupPhone }); 
                                                setNewSupName(''); setNewSupContact(''); setNewSupPhone('');
                                                setSupModalView('LIST');
                                            }} 
                                            className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-100 active:scale-95 transition-all hover:bg-black flex items-center justify-center gap-3"
                                        >
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400"/> Sincronizar Nuevo Proveedor
                                        </button>
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
