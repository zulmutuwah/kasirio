export type BusinessType = 'RETAIL' | 'FNB' | 'SERVICE';

export type PaymentMethod = 'TUNAI' | 'QRIS' | 'TRANSFER' | 'KASBON';

export type TransactionStatus = 'LUNAS' | 'KASBON' | 'BATAL';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  priceModifier: number; // e.g. +3000 for Large
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  buyPrice: number; // HPP (Harga Pokok Penjualan)
  sellPrice: number; // Harga Jual
  stock: number;
  minStock: number;
  unit: string; // Pcs, Botol, Bungkus, Kg, Porsi, Box
  imageUrl?: string;
  variants?: ProductVariant[];
  description?: string;
  barcode?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string; // Soft-delete
}

export interface User {
  id: string;
  name: string;
  role: 'OWNER' | 'CASHIER';
  pinHash: string;
  createdAt: string;
}

export interface CashSession {
  id: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  initialCash: number;
  finalCash?: number;
  expectedCash?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: ProductVariant;
  discount: number; // Discount amount in Rp or percentage
  discountType: 'NOMINAL' | 'PERCENT';
  notes?: string;
  customPrice?: number; // Override sell price if open price
}

export interface SuspendedCart {
  id: string;
  label: string; // Meja 4 / Budi / Pesanan A
  items: CartItem[];
  cartOrderDiscount: number;
  selectedCustomer: Customer | null;
  createdAt: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalDebt: number;
  createdAt: string;
}

export interface DebtPaymentLog {
  id: string;
  customerId: string;
  amountPaid: number;
  paymentMethod: 'TUNAI' | 'TRANSFER' | 'QRIS';
  date: string;
  notes?: string;
}

export interface TransactionItem {
  id?: string;
  transactionId?: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  discount: number;
  notes?: string;
  subtotal: number;
}

export interface Transaction {
  id: string; // Invoice number e.g. TRX-20260805-001
  date: string; // ISO String
  items: TransactionItem[];
  subtotal: number;
  tax: number; // PPN / PB1 amount
  discount: number; // Order level discount
  serviceFee: number;
  total: number;
  totalCost: number; // Total HPP
  profit: number; // Total - TotalCost
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  customer?: Customer;
  status: TransactionStatus;
  cashierName: string;
  notes?: string;
  voidReason?: string;
  voidDate?: string;
  voidCashier?: string;
  isAuditFlagged?: boolean;
}

export interface CashMovement {
  id: string;
  type: 'IN' | 'OUT';
  amount: number;
  category: string; // e.g. Beli Es Batu, Modal Tambahan, Kembalian
  notes: string;
  date: string;
}

export interface Shift {
  id: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  initialCash: number;
  finalCash?: number;
  expectedCash?: number;
  cashMovements: CashMovement[];
  status: 'OPEN' | 'CLOSED';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  type: 'VOID' | 'MANUAL_DISCOUNT' | 'DRAWER_OPEN' | 'STOCK_OVERRIDE';
  details: string;
  cashierName: string;
  amount?: number;
  relatedTransactionId?: string;
}

export interface KoinTransaction {
  id: string;
  date: string;
  type: 'TOPUP' | 'DEDUCT';
  amountKoin: number;
  rupiahEquivalent: number;
  description: string;
}

export interface KoinAccount {
  saldoKoin: number;
  isPro: boolean;
  proExpiresAt?: string;
  history: KoinTransaction[];
}

export interface StoreSettings {
  storeName: string;
  businessType: BusinessType;
  address: string;
  phone: string;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  paperSize: '58mm' | '80mm';
  taxPercentage: number;
  enableTax: boolean;
  taxLabel: string; // 'PPN' atau 'PB1 Restoran'
  logoUrl?: string;
  qrisMerchantName?: string;
  bankAccountInfo?: string;
  soundboxEnabled: boolean;
  cloudSyncEnabled?: boolean;
  apiBaseUrl?: string;
  tenantId?: string;
  tenantName?: string;
  outletId?: string;
  outletName?: string;
  authToken?: string;
  deviceId?: string;
  lastSyncTimestamp?: string;
}

export interface SyncMutation {
  id: string;
  entityType: 'TRANSACTION' | 'PRODUCT' | 'STOCK_LOG' | 'CUSTOMER' | 'DEBT_PAYMENT' | 'AUDIT_LOG';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: string;
  payload: any;
  clientTimestamp: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  retryCount: number;
  errorMessage?: string;
}

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE';
  quantity: number;
  previousStock: number;
  currentStock: number;
  notes: string;
  date: string;
}

export interface SmartReorderRecommendation {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  currentStock: number;
  minStock: number;
  averageDailySales: number; // Kuantitas terjual rata-rata per hari
  daysUntilStockout: number; // Estimasi hari tersisa sebelum stok habis
  urgency: 'CRITICAL' | 'WARNING' | 'SAFE'; // <2 hari: CRITICAL, 2-5 hari: WARNING, >5 hari: SAFE
  suggestedReorderQty: number; // Formula: (DailySales * TargetDaysCoverage) + SafetyStock - CurrentStock
  estimatedCost: number; // suggestedReorderQty * buyPrice
  aiNarrative?: string; // Narasi rekomendasi kulakan cerdas
}

export interface SalesForecastItem {
  date: string;
  dayName: string;
  projectedSales: number;
  projectedRevenue: number;
  topTrendProducts: string[];
}


