
export enum ViewState {
  POS,
  SHIFTS,
  INVENTORY,
  PURCHASES,
  ANALYTICS,
  SETTINGS,
  SUPER_ADMIN,
  // Added to fix compilation errors in App.tsx
  ADMIN,
  REPORTS
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface PackItem {
    productId: string;
    productName: string; 
    quantity: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  barcode?: string;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  isPack?: boolean;     
  packItems?: PackItem[]; 
  images?: string[]; 
  description?: string;
  cost?: number; 
}

export interface CartItem extends Product {
  quantity: number;
  selectedVariantId?: string;
  selectedVariantName?: string;
  discount?: number;
}

export type PaymentMethod = 'cash' | 'card' | 'yape' | 'plin' | 'transfer' | 'credit';

export interface PaymentDetail {
  method: PaymentMethod;
  amount: number;
}

export interface Transaction {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  payments?: PaymentDetail[];
  profit: number;
  shiftId?: string;
  storeId?: string; 
  status?: 'COMPLETED' | 'CANCELED';
}

export interface StoreSettings {
  name: string;
  currency: string;
  taxRate: number;
  pricesIncludeTax: boolean;
  address?: string;
  phone?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'admin' | 'cashier' | 'super_admin' | 'owner';
  storeId?: string; 
  email?: string;
}

export interface CashShift {
  id: string;
  startTime: string;
  endTime?: string;
  startAmount: number;
  endAmount?: number;
  status: 'OPEN' | 'CLOSED';
  totalSalesCash: number;
  totalSalesDigital: number;
  totalSalesYape: number;
  totalSalesPlin: number;
  totalSalesCard: number;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'OPEN' | 'CLOSE' | 'IN' | 'OUT';
  amount: number;
  description: string;
  timestamp: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
}

export interface PurchaseItem {
  productId: string;
  productName?: string; 
  variantId?: string;     // Identificador de la variante
  variantName?: string;   // Nombre descriptivo (ej: XL, 1L, etc)
  quantity: number;
  cost: number;
  isBonus?: boolean;
  newSellPrice?: number;
  currentPrice?: number; 
}

export type PurchaseStatus = 'BORRADOR' | 'CONFIRMADO' | 'RECIBIDO' | 'CANCELADO';

export interface Purchase {
  id: string;
  reference: string;
  date: string;
  dueDate?: string;
  supplierId: string;
  invoiceNumber?: string;
  docType?: 'FACTURA' | 'BOLETA' | 'GUIA' | 'OTRO';
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  paymentMethod?: string;
  paymentCondition: 'CONTADO' | 'CREDITO';
  payFromCash: boolean;
  taxIncluded: boolean;
  items: PurchaseItem[];
  status: PurchaseStatus;
  received: 'YES' | 'NO';
  store_id?: string;
}

export interface Lead {
    id: string;
    name: string;
    business_name: string;
    phone: string;
    created_at: string;
    status?: 'NEW' | 'CONTACTED';
}

export interface Store {
    id: string;
    created_at: string;
    settings: StoreSettings;
    owner_id?: string;
}
