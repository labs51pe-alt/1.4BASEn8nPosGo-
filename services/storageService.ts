
import { UserProfile, Product, Transaction, Purchase, StoreSettings, Customer, Supplier, CashShift, CashMovement, Lead, Store, PaymentMethod, PurchaseItem } from '../types';
import { supabase } from './supabase';
import { DEFAULT_SETTINGS } from '../constants';

const KEYS = {
  SESSION: 'posgo_session',
  ACTIVE_SHIFT_ID: 'posgo_active_shift'
};

const DEMO_TEMPLATE_ID = '00000000-0000-0000-0000-000000000000'; 

const isDemo = () => {
    const session = localStorage.getItem(KEYS.SESSION);
    if (!session) return true;
    try {
        const user = JSON.parse(session);
        return user.id === 'test-user-demo' || user.email?.endsWith('@demo.posgo') || user.role === 'super_admin' || user.id === 'god-mode';
    } catch { return true; }
};

let cachedStoreId: string | null = null;

const getStoreId = async (): Promise<string> => {
    if (isDemo()) return DEMO_TEMPLATE_ID;
    if (cachedStoreId) return cachedStoreId;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return DEMO_TEMPLATE_ID;
        const { data } = await supabase.from('profiles').select('store_id').eq('id', user.id).maybeSingle();
        if (data && data.store_id) {
            cachedStoreId = data.store_id;
            return data.store_id;
        }
    } catch (e) { console.warn("Error getting store_id:", e); }
    return DEMO_TEMPLATE_ID;
};

export const StorageService = {
  saveSession: (user: UserProfile) => {
      localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
      cachedStoreId = null; 
  },
  getSession: (): UserProfile | null => {
    const s = localStorage.getItem(KEYS.SESSION);
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  },
  clearSession: async () => {
    localStorage.removeItem(KEYS.SESSION);
    localStorage.removeItem(KEYS.ACTIVE_SHIFT_ID);
    cachedStoreId = null;
    await supabase.auth.signOut();
  },

  getProducts: async (): Promise<Product[]> => {
    const storeId = await getStoreId();
    const { data: productsData, error: prodErr } = await supabase.from('products').select('*').eq('store_id', storeId).order('name', { ascending: true });
    if (prodErr) console.error("Error fetching products:", prodErr);
    if (!productsData || productsData.length === 0) {
        if (storeId === DEMO_TEMPLATE_ID) return [];
        return await StorageService.getDemoTemplate();
    }
    const { data: imagesData } = await supabase.from('product_images').select('*').eq('store_id', storeId);
    return productsData.map((p: any) => ({ 
        id: p.id, name: p.name, price: Number(p.price), category: p.category, 
        stock: Number(p.stock), barcode: p.barcode, 
        hasVariants: p.has_variants,
        variants: Array.isArray(p.variants) ? p.variants : [], 
        images: imagesData ? imagesData.filter((img: any) => img.product_id === p.id).map((img: any) => img.image_data) : [], 
        cost: Number(p.cost || 0), 
        isPack: p.is_pack, 
        packItems: Array.isArray(p.pack_items) ? p.pack_items : []
    }));
  },
  
  saveProducts: async (products: Product[]) => {
      const storeId = await getStoreId();
      for (const p of products) {
          // Fix: Accessing p.packItems instead of incorrect p.pack_items (which doesn't exist on Product interface)
          await supabase.from('products').upsert({ 
              id: p.id, name: p.name, price: p.price, stock: p.stock, 
              category: p.category, barcode: p.barcode, variants: p.variants || [], 
              cost: p.cost || 0, store_id: storeId, has_variants: p.hasVariants,
              is_pack: p.isPack, pack_items: p.packItems || []
          });
      }
  },

  saveProductWithImages: async (p: Product) => {
    const storeId = await getStoreId();
    await supabase.from('products').upsert({ 
        id: p.id, name: p.name, price: p.price, stock: p.stock, 
        category: p.category, barcode: p.barcode, variants: p.variants || [], 
        cost: p.cost || 0, store_id: storeId, has_variants: p.hasVariants,
        is_pack: p.isPack, pack_items: p.packItems || []
    });
    if (p.images) {
        await supabase.from('product_images').delete().eq('product_id', p.id).eq('store_id', storeId);
        const imageInserts = p.images.map(img => ({ product_id: p.id, image_data: img, store_id: storeId }));
        if (imageInserts.length > 0) await supabase.from('product_images').insert(imageInserts);
    }
  },

  saveTransaction: async (t: Transaction) => {
    const storeId = await getStoreId();
    const dbTransaction = {
        id: t.id,
        date: t.date,
        items: JSON.stringify(t.items),
        payments: JSON.stringify(t.payments),
        subtotal: t.subtotal,
        tax: t.tax,
        discount: t.discount,
        total: t.total,
        payment_method: t.paymentMethod,
        profit: t.profit,
        shift_id: t.shiftId, 
        store_id: storeId,
        status: t.status || 'COMPLETED'
    };
    const { error } = await supabase.from('transactions').insert(dbTransaction);
    if (error) throw new Error(error.message || "Error al guardar transacción");
  },

  cancelTransaction: async (t: Transaction, localShift: CashShift, refundMethodChoice?: PaymentMethod | 'original') => {
      const storeId = await getStoreId();
      
      const { data: currentTrans } = await supabase.from('transactions').select('status').eq('id', t.id).maybeSingle();
      if (currentTrans?.status === 'CANCELED') throw new Error("Venta ya anulada.");

      const { data: dbShift } = await supabase.from('shifts').select('*').eq('id', localShift.id).maybeSingle();
      if (!dbShift) throw new Error("Error obteniendo datos del turno.");

      const items = Array.isArray(t.items) ? t.items : JSON.parse(t.items as any);
      for (const item of items) {
          const { data: p } = await supabase.from('products').select('*').eq('id', item.id).eq('store_id', storeId).maybeSingle();
          if (p) {
              const returnQty = Number(item.quantity) || 0;
              let variants = Array.isArray(p.variants) ? p.variants : (typeof p.variants === 'string' ? JSON.parse(p.variants) : []);
              if (item.selectedVariantId && variants.length > 0) {
                  variants = variants.map((v: any) => v.id === item.selectedVariantId ? { ...v, stock: (Number(v.stock) || 0) + returnQty } : v);
              }
              await supabase.from('products').update({ stock: (Number(p.stock) || 0) + returnQty, variants }).eq('id', p.id).eq('store_id', storeId);
          }
      }

      const originalPayments = Array.isArray(t.payments) ? t.payments : (t.payments ? JSON.parse(t.payments as any) : []);
      let rCash = 0, rYape = 0, rPlin = 0, rCard = 0;
      const totalAmount = Number(t.total);

      if (!refundMethodChoice || refundMethodChoice === 'original') {
          if (originalPayments.length > 0) {
              originalPayments.forEach((p: any) => {
                  const amt = Number(p.amount) || 0;
                  if (p.method === 'cash') rCash += amt;
                  else if (p.method === 'yape') rYape += amt;
                  else if (p.method === 'plin') rPlin += amt;
                  else if (p.method === 'card') rCard += amt;
              });
          } else {
              if (t.paymentMethod === 'cash') rCash = totalAmount;
              else if (t.paymentMethod === 'yape') rYape = totalAmount;
              else if (t.paymentMethod === 'plin') rPlin = totalAmount;
              else if (t.paymentMethod === 'card') rCard = totalAmount;
          }
      } else {
          if (refundMethodChoice === 'cash') rCash = totalAmount;
          else if (refundMethodChoice === 'yape') rYape = totalAmount;
          else if (refundMethodChoice === 'plin') rPlin = totalAmount;
          else if (refundMethodChoice === 'card') rCard = totalAmount;
      }

      const updatedShift = {
          total_sales_cash: Math.max(0, Number(dbShift.total_sales_cash || 0) - rCash),
          total_sales_yape: Math.max(0, Number(dbShift.total_sales_yape || 0) - rYape),
          total_sales_plin: Math.max(0, Number(dbShift.total_sales_plin || 0) - rPlin),
          total_sales_card: Math.max(0, Number(dbShift.total_sales_card || 0) - rCard),
          total_sales_digital: Math.max(0, Number(dbShift.total_sales_digital || 0) - (rYape + rPlin + rCard))
      };
      await supabase.from('shifts').update(updatedShift).eq('id', dbShift.id);

      await supabase.from('movements').insert({
          id: crypto.randomUUID(), shift_id: dbShift.id, type: 'OUT', amount: totalAmount,
          description: `ANULACIÓN #${t.id.slice(-6).toUpperCase()} (Vía ${refundMethodChoice || 'Original'})`,
          timestamp: new Date().toISOString(), store_id: storeId
      });

      await supabase.from('transactions').update({ status: 'CANCELED' }).eq('id', t.id);
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('transactions').select('*').eq('store_id', storeId).order('date', { ascending: false });
    return (data || []).map((t: any) => ({ 
        ...t, 
        shiftId: t.shift_id || t.shiftId, 
        items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items, 
        payments: typeof t.payments === 'string' ? JSON.parse(t.payments) : t.payments 
    }));
  },

  getPurchases: async (): Promise<Purchase[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('purchases').select('*').eq('store_id', storeId).order('date', { ascending: false });
    return (data || []).map((p: any) => ({
        ...p,
        supplierId: p.supplier_id,
        invoiceNumber: p.invoice_number,
        docType: p.doc_type,
        dueDate: p.due_date,
        paymentCondition: p.payment_condition,
        payFromCash: p.pay_from_cash,
        taxIncluded: p.tax_included,
        amountPaid: Number(p.amount_paid || 0),
        items: typeof p.items === 'string' ? JSON.parse(p.items) : p.items
    }));
  },

  savePurchase: async (p: Purchase) => {
    const storeId = await getStoreId();
    const dbPayload = {
        id: p.id, 
        reference: p.reference, 
        date: p.date, 
        due_date: p.dueDate, 
        supplier_id: p.supplierId,
        invoice_number: p.invoiceNumber, 
        doc_type: p.docType, 
        subtotal: p.subtotal, 
        tax: p.tax, 
        total: p.total,
        amount_paid: p.amountPaid, 
        payment_method: p.paymentMethod,
        payment_condition: p.paymentCondition, 
        pay_from_cash: p.payFromCash,
        tax_included: p.taxIncluded, 
        items: JSON.stringify(p.items), 
        status: p.status,
        received: p.received, 
        store_id: storeId
    };
    const { error } = await supabase.from('purchases').upsert(dbPayload);
    if (error) throw new Error(error.message || `Error DB (${error.code})`);
  },

  confirmReceptionAndSyncStock: async (purchase: Purchase) => {
    const storeId = await getStoreId();
    for (const item of purchase.items) {
        const { data: p } = await supabase.from('products').select('*').eq('id', item.productId).eq('store_id', storeId).maybeSingle();
        if (p) {
            let newStock = Number(p.stock) + item.quantity;
            let variants = Array.isArray(p.variants) ? p.variants : [];
            let currentPrice = p.price;

            if (item.variantId) {
                const vIdx = variants.findIndex((v: any) => v.id === item.variantId);
                if (vIdx !== -1) {
                    variants[vIdx].stock = (variants[vIdx].stock || 0) + item.quantity;
                    variants[vIdx].price = item.newSellPrice || variants[vIdx].price;
                } else if (item.variantName) {
                    variants.push({
                        id: item.variantId,
                        name: item.variantName,
                        price: item.newSellPrice || p.price,
                        stock: item.quantity
                    });
                }
                newStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
            } else {
                currentPrice = item.newSellPrice || p.price;
            }

            await supabase.from('products').update({ 
                stock: newStock, 
                cost: item.cost, 
                price: currentPrice,
                variants,
                has_variants: variants.length > 0
            }).eq('id', p.id).eq('store_id', storeId);
        }
    }
    await supabase.from('purchases').update({ status: 'RECIBIDO', received: 'YES' }).eq('id', purchase.id).eq('store_id', storeId);
  },

  revertReceptionAndSyncStock: async (purchase: Purchase) => {
    const storeId = await getStoreId();
    for (const item of purchase.items) {
        const { data: p } = await supabase.from('products').select('*').eq('id', item.productId).eq('store_id', storeId).maybeSingle();
        if (p) {
            let variants = Array.isArray(p.variants) ? p.variants : [];
            let newStock = Math.max(0, Number(p.stock) - item.quantity);
            
            if (item.variantId) {
                const vIdx = variants.findIndex((v: any) => v.id === item.variantId);
                if (vIdx !== -1) {
                    variants[vIdx].stock = Math.max(0, (Number(variants[vIdx].stock) || 0) - item.quantity);
                }
                newStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
            }
            
            await supabase.from('products').update({ stock: newStock, variants }).eq('id', p.id).eq('store_id', storeId);
        }
    }
    await supabase.from('purchases').update({ status: 'CONFIRMADO', received: 'NO' }).eq('id', purchase.id).eq('store_id', storeId);
  },

  saveShift: async (s: CashShift) => {
    const storeId = await getStoreId();
    await supabase.from('shifts').upsert({ 
        id: s.id, startTime: s.startTime, endTime: s.endTime, startAmount: s.startAmount, endAmount: s.endAmount, status: s.status,
        total_sales_cash: s.totalSalesCash || 0, total_sales_digital: s.totalSalesDigital || 0,
        total_sales_yape: s.totalSalesYape || 0, total_sales_plin: s.totalSalesPlin || 0, total_sales_card: s.totalSalesCard || 0,
        store_id: storeId 
    });
  },

  getShifts: async (): Promise<CashShift[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('shifts').select('*').eq('store_id', storeId).order('startTime', { ascending: false });
    return (data || []).map((s: any) => ({
        id: s.id, startTime: s.startTime, endTime: s.endTime, startAmount: Number(s.startAmount || 0), endAmount: Number(s.endAmount || 0), status: s.status,
        totalSalesCash: Number(s.total_sales_cash || 0), totalSalesDigital: Number(s.total_sales_digital || 0),
        totalSalesYape: Number(s.total_sales_yape || 0), totalSalesPlin: Number(s.total_sales_plin || 0), totalSalesCard: Number(s.total_sales_card || 0)
    }));
  },

  saveMovement: async (m: CashMovement) => {
    const storeIdValue = await getStoreId();
    await supabase.from('movements').insert({ ...m, shift_id: m.shiftId, store_id: storeIdValue });
  },

  getMovements: async (): Promise<CashMovement[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('movements').select('*').eq('store_id', storeId).order('timestamp', { ascending: false });
    return (data || []).map((m: any) => ({ ...m, shiftId: m.shift_id }));
  },

  getCustomers: async (): Promise<Customer[]> => {
    const storeId = await getStoreId();
    const { data: customersData } = await supabase.from('customers').select('*').eq('store_id', storeId);
    return customersData || [];
  },

  getSuppliers: async (): Promise<Supplier[]> => {
    const storeId = await getStoreId();
    const { data: suppliersData } = await supabase.from('suppliers').select('*').eq('store_id', storeId).order('name', { ascending: true });
    return suppliersData || [];
  },

  saveSupplier: async (s: Supplier) => {
    const storeId = await getStoreId();
    // Ajustado para coincidir exactamente con la estructura de tabla proporcionada por el usuario
    const { error } = await supabase.from('suppliers').upsert({ 
        id: s.id, 
        name: s.name, 
        contact: s.contact || s.phone || '', // Mapeamos contacto o teléfono al campo contact de la BD
        store_id: storeId 
    });
    if (error) throw error;
  },

  getSettings: async (): Promise<StoreSettings> => {
    const storeId = await getStoreId();
    const { data: storeData } = await supabase.from('stores').select('settings').eq('id', storeId).maybeSingle();
    return storeData?.settings || DEFAULT_SETTINGS;
  },

  saveSettings: async (settings: StoreSettings) => {
    const storeId = await getStoreId();
    await supabase.from('stores').update({ settings }).eq('id', storeId);
  },

  getActiveShiftId: (): string | null => localStorage.getItem(KEYS.ACTIVE_SHIFT_ID),
  setActiveShiftId: (id: string | null) => {
    if (id) localStorage.setItem(KEYS.ACTIVE_SHIFT_ID, id);
    else localStorage.removeItem(KEYS.ACTIVE_SHIFT_ID);
  },

  getDemoTemplate: async (): Promise<Product[]> => {
    const { data: productsData } = await supabase.from('products').select('*').eq('store_id', DEMO_TEMPLATE_ID).order('name', { ascending: true });
    if (!productsData) return [];
    const { data: imagesData } = await supabase.from('product_images').select('*').eq('store_id', DEMO_TEMPLATE_ID);
    return productsData.map((p: any) => ({
        id: p.id, name: p.name, price: Number(p.price), category: p.category, 
        stock: Number(p.stock), barcode: p.barcode, 
        hasVariants: p.has_variants, variants: Array.isArray(p.variants) ? p.variants : [], 
        images: imagesData ? imagesData.filter((img: any) => img.product_id === p.id).map((img: any) => img.image_data) : [], 
        cost: Number(p.cost || 0), 
        isPack: p.is_pack, packItems: Array.isArray(p.pack_items) ? p.pack_items : []
    }));
  },

  saveDemoProductToTemplate: async (product: Product) => {
      const { error } = await supabase.from('products').upsert({ 
          id: product.id, name: product.name, price: product.price, stock: product.stock, 
          category: product.category, barcode: product.barcode, variants: product.variants || [], 
          cost: product.cost || 0, store_id: DEMO_TEMPLATE_ID, has_variants: product.hasVariants,
          is_pack: product.isPack, pack_items: product.packItems || []
      });
      return { success: !error, error };
  },

  deleteDemoProduct: async (productId: string) => {
      await supabase.from('product_images').delete().eq('product_id', productId).eq('store_id', DEMO_TEMPLATE_ID);
      await supabase.from('products').delete().eq('id', productId).eq('store_id', DEMO_TEMPLATE_ID);
  },

  getLeads: async (): Promise<Lead[]> => {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      return data || [];
  },

  saveLead: async (lead: Omit<Lead, 'id' | 'created_at'>) => {
      await supabase.from('leads').upsert({ ...lead, status: 'NEW' }, { onConflict: 'phone' });
  },

  getAllStores: async (): Promise<Store[]> => {
      const { data } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
      return data || [];
  },

  resetDemoData: async () => {
      localStorage.removeItem(KEYS.ACTIVE_SHIFT_ID);
      cachedStoreId = null;
  }
};
