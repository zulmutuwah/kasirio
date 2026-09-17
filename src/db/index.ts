import Dexie, { Table } from 'dexie';
import {
  AuditLogEntry,
  CashMovement,
  Category,
  Customer,
  DebtPaymentLog,
  KoinAccount,
  Product,
  StockLog,
  StoreSettings,
  SuspendedCart,
  Transaction,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_SETTINGS,
  INITIAL_TRANSACTIONS,
} from '../data/initialData';

export class KasirioDexieDB extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  customers!: Table<Customer, string>;
  debtLogs!: Table<DebtPaymentLog, string>;
  stockLogs!: Table<StockLog, string>;
  suspendedCarts!: Table<SuspendedCart, string>;
  auditLogs!: Table<AuditLogEntry, string>;
  cashMovements!: Table<CashMovement, string>;
  settings!: Table<{ id: string; data: StoreSettings }, string>;
  koinAccount!: Table<{ id: string; data: KoinAccount }, string>;

  constructor() {
    super('KasirioDatabase');
    this.version(1).stores({
      products: 'id, sku, barcode, categoryId, name, sellPrice, stock',
      categories: 'id, name',
      transactions: 'id, date, paymentMethod, status, cashierName, total, isAuditFlagged',
      customers: 'id, name, phone, totalDebt',
      debtLogs: 'id, customerId, date',
      stockLogs: 'id, productId, type, date',
      suspendedCarts: 'id, label, createdAt',
      auditLogs: 'id, timestamp, type, cashierName',
      cashMovements: 'id, type, date',
      settings: 'id',
      koinAccount: 'id',
    });
  }
}

export const db = new KasirioDexieDB();

/**
 * Meminta browser agar tidak menghapus IndexedDB secara sepihak (Storage Eviction Prevention)
 */
export async function ensureStoragePersistence(): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Kasirio DB] Persistent storage locked: ${isPersisted}`);
      return isPersisted;
    } catch (err) {
      console.warn('[Kasirio DB] Could not request persistence:', err);
      return false;
    }
  }
  return false;
}

/**
 * Inisialisasi data awal jika IndexedDB masih kosong
 */
export async function initDatabase(): Promise<void> {
  await ensureStoragePersistence();

  const productCount = await db.products.count();
  if (productCount === 0) {
    console.log('[Kasirio DB] Seeding initial data to IndexedDB...');
    await db.products.bulkAdd(INITIAL_PRODUCTS);
    await db.categories.bulkAdd(INITIAL_CATEGORIES);
    await db.customers.bulkAdd(INITIAL_CUSTOMERS);
    await db.transactions.bulkAdd(INITIAL_TRANSACTIONS);
    await db.settings.put({ id: 'current', data: INITIAL_SETTINGS });
    
    // Initial Koin Account
    const defaultKoin: KoinAccount = {
      saldoKoin: 150,
      isPro: true,
      proExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 hari ke depan
      history: [
        {
          id: 'koin-init',
          date: new Date().toISOString(),
          type: 'TOPUP',
          amountKoin: 150,
          rupiahEquivalent: 150000,
          description: 'Bonus Selamat Datang Pengguna Baru Kasirio Pro',
        },
      ],
    };
    await db.koinAccount.put({ id: 'current', data: defaultKoin });

    // Initial Audit Log
    const welcomeAudit: AuditLogEntry = {
      id: 'audit-0',
      timestamp: new Date().toISOString(),
      type: 'DRAWER_OPEN',
      details: 'Sistem Kasirio pertama kali diinisialisasi',
      cashierName: 'System Setup',
    };
    await db.auditLogs.add(welcomeAudit);
  }
}
