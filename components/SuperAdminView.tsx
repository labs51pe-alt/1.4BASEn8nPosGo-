
import React, { useState, useEffect } from 'react';
import { Lead, Store, Product } from '../types';
import { StorageService } from '../services/storageService';
import { 
    Users, Building2, Trash2, RefreshCw, ShieldAlert, 
    Package, Plus, Edit, X, ImageIcon, Terminal, 
    Layers, Zap, Wallet, Copy, Check
} from 'lucide-react';

interface SuperAdminProps {
    onEditProduct?: (product: Product) => void;
    onNewProduct?: () => void;
    lastUpdated?: number;
}

export const SuperAdminView: React.FC<SuperAdminProps> = ({ onEditProduct, onNewProduct, lastUpdated }) => {
    const [activeTab, setActiveTab] = useState<'LEADS' | 'STORES' | 'DEMO_PRODUCTS'>('DEMO_PRODUCTS'); 
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [demoProducts, setDemoProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSqlHelp, setShowSqlHelp] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchData = async (force = false) => {
        setLoading(true);
        try {
            const [l, s, demo] = await Promise.all([
                StorageService.getLeads(),
                StorageService.getAllStores(),
                StorageService.getDemoTemplate() 
            ]);
            setLeads(l);
            setStores(s);
            setDemoProducts(demo);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [lastUpdated]);

    const handleCopySql = () => {
        const sqlToCopy = SQL_CODE.trim();
        navigator.clipboard.writeText(sqlToCopy)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
            })
            .catch(err => alert("Error al copiar: " + err));
    };

    const handleDeleteDemoProduct = async (id: string) => {
        if (window.confirm('¿Eliminar producto de la plantilla demo en la nube?')) {
            await StorageService.deleteDemoProduct(id);
            fetchData(true);
        }
    };

    const SQL_CODE = `-- 🚀 REPARACIÓN INTEGRAL POSGO V2
-- 1. TABLA TRANSACCIONES
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'COMPLETED';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payments jsonb DEFAULT '[]';

-- 2. TABLA TURNOS
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_sales_cash numeric DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_sales_digital numeric DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_sales_yape numeric DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_sales_plin numeric DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_sales_card numeric DEFAULT 0;

-- 3. TABLA PRODUCTOS
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_pack boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pack_items jsonb DEFAULT '[]';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;

-- 4. TABLA COMPRAS (REPARACIÓN DE COLUMNAS)
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS doc_type text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_condition text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS pay_from_cash boolean DEFAULT false;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS tax_included boolean DEFAULT true;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier_id uuid;

-- 5. MOVIMIENTOS DE CAJA
CREATE TABLE IF NOT EXISTS public.movements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id uuid,
    type text,
    amount numeric,
    description text,
    timestamp timestamptz DEFAULT now(),
    store_id uuid
);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso Universal" ON public.movements;
CREATE POLICY "Acceso Universal" ON public.movements FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';`;

    return (
        <div className="p-8 h-full bg-[#f8fafc] flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-600"/> Super Admin
                    </h1>
                    <p className="text-slate-500 font-medium">Gestión Avanzada Cloud</p>
                </div>
                <button onClick={() => fetchData(true)} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm group">
                    <RefreshCw className={`w-5 h-5 text-slate-500 group-hover:text-indigo-600 ${loading ? 'animate-spin' : ''}`}/>
                </button>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
                <button onClick={() => setActiveTab('LEADS')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'LEADS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}><Users className="w-4 h-4"/> Leads</button>
                <button onClick={() => setActiveTab('STORES')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'STORES' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}><Building2 className="w-4 h-4"/> Tiendas</button>
                <button onClick={() => setActiveTab('DEMO_PRODUCTS')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'DEMO_PRODUCTS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}><Package className="w-4 h-4"/> Plantilla Cloud</button>
            </div>

            <div className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                {activeTab === 'DEMO_PRODUCTS' && (
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-amber-600">
                             <ImageIcon className="w-4 h-4"/>
                             <span className="text-xs font-bold uppercase tracking-wider">Productos Globales</span>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setShowSqlHelp(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-black"><Terminal className="w-4 h-4"/> REPARAR DB (SQL)</button>
                             <button onClick={onNewProduct} className="bg-emerald-50 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-emerald-600"><Plus className="w-4 h-4"/> Nuevo Global</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400 sticky top-0 z-10">
                            <tr>
                                {activeTab === 'DEMO_PRODUCTS' && (
                                    <>
                                        <th className="p-6">Img</th>
                                        <th className="p-6">Nombre del Producto</th>
                                        <th className="p-6">Categoría / Tipo</th>
                                        <th className="p-6 text-right">Precio</th>
                                        <th className="p-6 text-right">Acciones</th>
                                    </>
                                )}
                                {activeTab === 'LEADS' && (
                                    <>
                                        <th className="p-6">Nombre</th>
                                        <th className="p-6">Negocio</th>
                                        <th className="p-6">Teléfono</th>
                                        <th className="p-6">Fecha</th>
                                        <th className="p-6">Status</th>
                                    </>
                                )}
                                {activeTab === 'STORES' && (
                                    <>
                                        <th className="p-6">Store ID</th>
                                        <th className="p-6">Nombre</th>
                                        <th className="p-6">Creada</th>
                                        <th className="p-6">Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {activeTab === 'DEMO_PRODUCTS' && demoProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/50 group">
                                    <td className="p-6">
                                        {p.images && p.images.length > 0 ? (
                                            <img src={p.images[0]} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm" alt=""/>
                                        ) : (
                                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 font-bold text-xs italic">N/A</div>
                                        )}
                                    </td>
                                    <td className="p-6 font-bold text-slate-800">{p.name}</td>
                                    <td className="p-6">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-md font-bold uppercase">{p.category}</span>
                                            {p.hasVariants && (
                                                <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-1 rounded-md font-bold uppercase flex items-center gap-1">
                                                    <Layers className="w-3 h-3"/> Variantes
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right font-black text-slate-700">S/{p.price.toFixed(2)}</td>
                                    <td className="p-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => onEditProduct && onEditProduct(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteDemoProduct(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'LEADS' && leads.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50/50">
                                    <td className="p-6 font-bold text-slate-800">{l.name}</td>
                                    <td className="p-6 font-medium text-slate-600">{l.business_name}</td>
                                    <td className="p-6 font-mono text-emerald-600">+{l.phone}</td>
                                    <td className="p-6 text-xs text-slate-400">{new Date(l.created_at).toLocaleDateString()}</td>
                                    <td className="p-6"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black">{l.status || 'NEW'}</span></td>
                                </tr>
                            ))}
                            {activeTab === 'STORES' && stores.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/50">
                                    <td className="p-6 font-mono text-[10px] text-slate-400">{s.id}</td>
                                    <td className="p-6 font-bold text-slate-800">{s.settings?.name || 'Store'}</td>
                                    <td className="p-6 text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</td>
                                    <td className="p-6"><span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">ACTIVE</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showSqlHelp && (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl p-10 shadow-2xl animate-fade-in-up border border-white/20">
                        <div className="flex justify-between items-center mb-8">
                             <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><Terminal className="w-8 h-8"/></div>
                                <div>
                                    <h3 className="font-black text-2xl text-slate-800">Reparar Estructura Cloud</h3>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sincronización Maestra</p>
                                </div>
                             </div>
                             <button onClick={() => setShowSqlHelp(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X className="w-8 h-8 text-slate-400"/></button>
                        </div>
                        
                        <div className="relative group">
                            <div className="absolute -top-12 right-0">
                                <button 
                                    onClick={handleCopySql}
                                    className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 transition-all shadow-lg active:scale-95 ${copied ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white hover:bg-black shadow-slate-200'}`}
                                >
                                    {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                                    {copied ? 'CÓDIGO COPIADO' : 'COPIAR CÓDIGO SQL'}
                                </button>
                            </div>
                            <pre className="bg-slate-900 text-emerald-400 p-8 rounded-[2rem] text-[11px] overflow-x-auto mb-8 custom-scrollbar leading-relaxed font-mono max-h-[35vh] border border-white/10">
                                {SQL_CODE}
                            </pre>
                        </div>

                        <button onClick={() => setShowSqlHelp(false)} className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-sm uppercase hover:bg-slate-200 transition-colors">Cerrar Ayuda</button>
                    </div>
                </div>
            )}
        </div>
    );
};
