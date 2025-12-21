
import React, { useState, useMemo, useRef } from 'react';
import { Product, StoreSettings, Transaction, Purchase } from '../types';
/* Added XCircle to the imports from lucide-react */
import { Search, Plus, Edit, Trash2, Tag, Archive, Eye, AlertTriangle, FileDown, FileUp, Flame, ArrowRight, History, Package, Box, RefreshCw, LayoutGrid, List, ChevronRight, Layers, Zap, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface InventoryProps {
    products: Product[];
    settings: StoreSettings;
    transactions: Transaction[];
    purchases?: Purchase[];
    onNewProduct: () => void;
    onEditProduct: (p: Product) => void;
    onDeleteProduct: (id: string) => void;
    onGoToPurchase?: (productName: string) => void;
}

export const InventoryView: React.FC<InventoryProps> = ({ 
    products, 
    settings, 
    transactions, 
    purchases = [], 
    onNewProduct, 
    onEditProduct, 
    onDeleteProduct,
    onGoToPurchase 
}) => {
    const [activeTab, setActiveTab] = useState<'ALL' | 'REPLENISH'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [kardexProduct, setKardexProduct] = useState<Product | null>(null);

    const filteredProducts = useMemo(() => {
        return products.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (p.barcode && p.barcode.includes(searchTerm))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchTerm]);

    const replenishmentData = useMemo(() => {
        return products
            .filter(p => p.stock <= 5)
            .map(p => {
                const velocity = transactions.reduce((acc, t) => {
                    const item = t.items.find(i => i.id === p.id);
                    return acc + (item ? item.quantity : 0);
                }, 0);
                return { ...p, velocity };
            })
            .sort((a, b) => b.velocity - a.velocity);
    }, [products, transactions]);

    const getKardex = (productId: string) => {
        const sales = transactions.flatMap(t => 
            t.items.filter(i => i.id === productId).map(i => ({
                date: t.date, type: 'SALE', quantity: i.quantity, unitVal: i.price, doc: `Tkt #${t.id.slice(-4).toUpperCase()}`
            }))
        );
        const entries = purchases.flatMap(p => 
            p.items.filter(i => i.productId === productId).map(i => ({
                date: p.date, type: 'PURCHASE', quantity: i.quantity, unitVal: i.cost, doc: 'Cpra Almacén'
            }))
        );
        return [...sales, ...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const handleExportExcel = () => {
        const data = products.map(p => ({ Nombre: p.name, Categoria: p.category, Precio: p.price, Stock: p.stock }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Inventario");
        XLSX.writeFile(wb, "PosGo_Stock.xlsx");
    };

    return (
        <div className="p-4 sm:p-8 h-full flex flex-col bg-[#f8fafc] pb-24 lg:pb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-1">Control Stock</h1>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm uppercase tracking-wider">Gestión Integral de Almacén</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={handleExportExcel} className="flex-1 sm:flex-none px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-2"><FileDown className="w-4 h-4"/> Exportar</button>
                    <button onClick={onNewProduct} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2 active:scale-95 uppercase tracking-wider"><Plus className="w-5 h-5"/> Nuevo Producto</button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => setActiveTab('ALL')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 ${activeTab === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>Inventario Total</button>
                <button onClick={() => setActiveTab('REPLENISH')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 flex items-center gap-2 ${activeTab === 'REPLENISH' ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}><AlertTriangle className="w-4 h-4"/> Alerta Reposición {replenishmentData.length > 0 && <span className="bg-orange-500 text-white text-[9px] px-2 py-0.5 rounded-full">{replenishmentData.length}</span>}</button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="relative mb-6 shrink-0 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                    <input className="w-full pl-14 pr-6 py-4.5 bg-white border-2 border-slate-100 rounded-[1.8rem] focus:border-indigo-400 focus:ring-8 focus:ring-indigo-50 outline-none font-bold text-slate-700 transition-all shadow-lg shadow-slate-100/50 text-lg" placeholder="Filtrar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {activeTab === 'ALL' ? (
                        <>
                            {/* Desktop View Table */}
                            <div className="hidden lg:block bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 sticky top-0 z-10">
                                        <tr><th className="p-6">Producto</th><th className="p-6">Detalles</th><th className="p-6 text-right">Precio</th><th className="p-6 text-center">Stock</th><th className="p-6 text-right">Acciones</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold text-sm">
                                        {filteredProducts.map(p => (
                                            <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-6"><div className="flex items-center gap-4">{p.images?.[0] ? <img src={p.images[0]} className="w-10 h-10 rounded-xl object-cover border border-slate-200"/> : <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">{p.name.charAt(0)}</div>}<div><p className="text-slate-800">{p.name}</p><p className="text-[9px] text-slate-300 font-mono">#{p.barcode || p.id.slice(-6)}</p></div></div></td>
                                                <td className="p-6"><span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[9px] font-black uppercase">{p.category}</span></td>
                                                <td className="p-6 text-right text-slate-800">S/{p.price.toFixed(2)}</td>
                                                <td className="p-6 text-center"><span className={`px-3 py-1.5 rounded-xl font-black text-xs border ${p.stock <= 5 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{p.stock} un.</span></td>
                                                <td className="p-6 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => setKardexProduct(p)} className="p-2 text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4"/></button><button onClick={() => onEditProduct(p)} className="p-2 text-slate-400 hover:text-slate-800"><Edit className="w-4 h-4"/></button><button onClick={() => onDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View Cards */}
                            <div className="lg:hidden space-y-4">
                                {filteredProducts.map(p => (
                                    <div key={p.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden active:scale-95 transition-all">
                                        {p.stock <= 5 && <div className="absolute top-0 right-0 bg-rose-500 text-white p-2 rounded-bl-2xl shadow-lg"><AlertTriangle className="w-4 h-4"/></div>}
                                        <div className="flex gap-4 mb-4">
                                            {p.images?.[0] ? <img src={p.images[0]} className="w-16 h-16 rounded-2xl object-cover border border-slate-100"/> : <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 font-black text-xl">{p.name.charAt(0).toUpperCase()}</div>}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-slate-800 text-base leading-tight truncate">{p.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{p.category} • #{p.barcode || 'S/C'}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`px-3 py-1 rounded-xl font-black text-[10px] border ${p.stock <= 5 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{p.stock} en stock</span>
                                                    <span className="font-black text-slate-900 text-sm">S/{p.price.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
                                            <button onClick={() => setKardexProduct(p)} className="flex flex-col items-center gap-1 p-2 bg-slate-50 rounded-2xl text-slate-400 active:bg-indigo-50 active:text-indigo-600"><History className="w-4 h-4"/><span className="text-[8px] font-black uppercase">Kardex</span></button>
                                            <button onClick={() => onEditProduct(p)} className="flex flex-col items-center gap-1 p-2 bg-slate-50 rounded-2xl text-slate-400 active:bg-emerald-50 active:text-emerald-600"><Edit className="w-4 h-4"/><span className="text-[8px] font-black uppercase">Editar</span></button>
                                            <button onClick={() => onDeleteProduct(p.id)} className="flex flex-col items-center gap-1 p-2 bg-slate-50 rounded-2xl text-slate-400 active:bg-rose-50 active:text-rose-600"><Trash2 className="w-4 h-4"/><span className="text-[8px] font-black uppercase">Borrar</span></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {replenishmentData.map(p => (
                                <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-orange-100 shadow-xl shadow-orange-100/20 relative">
                                    <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-[9px] font-black absolute top-4 right-4 uppercase">Crítico</div>
                                    <h3 className="font-black text-slate-800 text-lg leading-tight mb-4 pr-10">{p.name}</h3>
                                    <div className="flex justify-between items-end mb-6">
                                        <div><p className="text-[10px] font-black text-slate-400 uppercase">En Mano</p><p className="text-4xl font-black text-rose-500 tracking-tighter">{p.stock}</p></div>
                                        <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Velocidad</p><p className="text-xl font-black text-slate-800">+{p.velocity} un.</p></div>
                                    </div>
                                    <button onClick={() => onGoToPurchase?.(p.name)} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-orange-200 active:scale-95 flex items-center justify-center gap-2">Reponer Ahora <ArrowRight className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* KARDEX MODAL - RESPONSIVO */}
            {kardexProduct && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-2xl h-[92vh] sm:h-[80vh] flex flex-col shadow-2xl animate-fade-in-up">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div><h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><History className="w-6 h-6 text-indigo-600"/> Kardex Digital</h3><p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">{kardexProduct.name}</p></div>
                            <button onClick={() => setKardexProduct(null)} className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400"><XCircle className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="space-y-3">
                                {getKardex(kardexProduct.id).map((k, i) => (
                                    <div key={i} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                                        <div><p className="text-xs font-black text-slate-800">{new Date(k.date).toLocaleDateString()}</p><p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{k.doc}</p></div>
                                        <div className="text-right">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${k.type === 'SALE' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{k.type === 'SALE' ? 'Salida' : 'Entrada'}</span>
                                            <p className="font-black text-slate-800 mt-1">{k.type === 'SALE' ? '-' : '+'}{k.quantity} un.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
