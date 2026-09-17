import Dexie, { Table } from 'dexie';
import {
  AuditLogEntry,
  CashMovement,
  CashSession,
  Category,
  Customer,
  DebtPaymentLog,
  KoinAccount,
  Product,
  StockLog,
  StoreSettings,
  SuspendedCart,
  Transaction,
  TransactionItem,
  User,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_SETTINGS,
  INITIAL_TRANSACTIONS,
} from '../data/initialData';
import { hashPin, DEFAULT_OWNER_PIN } from '../utils/security';

export class KasirioDexieDB extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  transactionItems!: Table<TransactionItem, string>;
  customers!: Table<Customer, string>;
  debtLogs!: Table<DebtPaymentLog, string>;
  stockLogs!: Table<StockLog, string>;
  suspendedCarts!: Table<SuspendedCart, string>;
  auditLogs!: Table<AuditLogEntry, string>;
  cashMovements!: Table<CashMovement, string>;
  cashSessions!: Table<CashSession, string>;
  users!: Table<User, string>;
  settings!: Table<{ id: string; data: StoreSettings }, string>;
  koinAccount!: Table<{ id: string; data: KoinAccount }, string>;

  constructor() {
    super('KasirioDatabase');
    this.version(2).stores({
      products: 'id, sku, barcode, categoryId, name, sellPrice, stock, deletedAt',
      categories: 'id, name',
      transactions: 'id, date, paymentMethod, status, cashierName, total, isAuditFlagged',
      transactionItems: 'id, transactionId, productId',
      customers: 'id, name, phone, totalDebt',
      debtLogs: 'id, customerId, date',
      stockLogs: 'id, productId, type, date',
      suspendedCarts: 'id, label, createdAt',
      auditLogs: 'id, timestamp, type, cashierName',
      cashMovements: 'id, type, date',
      cashSessions: 'id, cashierId, status',
      users: 'id, role',
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
    console.log('[Kasirio DB] Seeding initial normalized data to IndexedDB...');
    
    // 1. Seed Products with timestamps
    const timestampedProducts = INITIAL_PRODUCTS.map((p) => ({
      ...p,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    }));
    await db.products.bulkAdd(timestampedProducts);

    // 2. Seed Categories & Customers
    await db.categories.bulkAdd(INITIAL_CATEGORIES);
    await db.customers.bulkAdd(INITIAL_CUSTOMERS);

    // 3. Seed Transactions & Normalized Transaction Items
    const allNormalizedItems: TransactionItem[] = [];
    for (const trx of INITIAL_TRANSACTIONS) {
      trx.items.forEach((item, idx) => {
        allNormalizedItems.push({
          ...item,
          id: `${trx.id}-item-${idx}`,
          transactionId: trx.id,
        });
      });
    }
    await db.transactions.bulkAdd(INITIAL_TRANSACTIONS);
    await db.transactionItems.bulkAdd(allNormalizedItems);

    // 4. Seed Settings
    await db.settings.put({ id: 'current', data: INITIAL_SETTINGS });

    // 5. Seed Default Owner User with Salted PIN Hash
    const ownerPinHash = await hashPin(DEFAULT_OWNER_PIN);
    const defaultOwner: User = {
      id: 'user-owner-1',
      name: 'Pemilik Toko (Owner)',
      role: 'OWNER',
      pinHash: ownerPinHash,
      createdAt: new Date().toISOString(),
    };
    await db.users.put(defaultOwner);
    
    // 6. Initial Koin Account
    const defaultKoin: KoinAccount = {
      saldoKoin: 150,
      isPro: true,
      proExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
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

    // 7. Initial Audit Log
    const welcomeAudit: AuditLogEntry = {
      id: 'audit-0',
      timestamp: new Date().toISOString(),
      type: 'DRAWER_OPEN',
      details: 'Sistem Kasirio pertama kali diinisialisasi dengan keamanan PIN Gate',
      cashierName: 'System Setup',
    };
    await db.auditLogs.add(welcomeAudit);

    // 8. Seed Initial Stock Ledger
    const initialLogs: StockLog[] = timestampedProducts.map((p) => ({
      id: `stock-init-${p.id}`,
      productId: p.id,
      productName: p.name,
      type: 'IN',
      quantity: p.stock,
      previousStock: 0,
      currentStock: p.stock,
      notes: 'Saldo stok awal toko saat setup',
      date: new Date().toISOString(),
    }));
    await db.stockLogs.bulkAdd(initialLogs);
  }
}

/**
 * Backup / Export seluruh database lokal ke format JSON
 */
export async function exportDatabaseBackup(): Promise<string> {
  const [
    products,
    categories,
    transactions,
    transactionItems,
    customers,
    debtLogs,
    stockLogs,
    suspendedCarts,
    auditLogs,
    cashMovements,
    cashSessions,
    users,
    settings,
    koinAccount,
  ] = await Promise.all([
    db.products.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.transactionItems.toArray(),
    db.customers.toArray(),
    db.debtLogs.toArray(),
    db.stockLogs.toArray(),
    db.suspendedCarts.toArray(),
    db.auditLogs.toArray(),
    db.cashMovements.toArray(),
    db.cashSessions.toArray(),
    db.users.toArray(),
    db.settings.toArray(),
    db.koinAccount.toArray(),
  ]);

  const backupPayload = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    appName: 'Kasirio POS',
    data: {
      products,
      categories,
      transactions,
      transactionItems,
      customers,
      debtLogs,
      stockLogs,
      suspendedCarts,
      auditLogs,
      cashMovements,
      cashSessions,
      users,
      settings,
      koinAccount,
    },
  };

  return JSON.stringify(backupPayload, null, 2);
}

/**
 * Restore / Import data dari file backup JSON ke IndexedDB
 */
export async function importDatabaseBackup(jsonString: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || parsed.appName !== 'Kasirio POS') {
      throw new Error('Format berkas backup tidak valid untuk Kasirio POS.');
    }

    const d = parsed.data;

    await db.transaction('rw', [
      db.products,
      db.categories,
      db.transactions,
      db.transactionItems,
      db.customers,
      db.debtLogs,
      db.stockLogs,
      db.suspendedCarts,
      db.auditLogs,
      db.cashMovements,
      db.cashSessions,
      db.users,
      db.settings,
      db.koinAccount,
    ], async () => {
      if (d.products?.length) { await db.products.clear(); await db.products.bulkAdd(d.products); }
      if (d.categories?.length) { await db.categories.clear(); await db.categories.bulkAdd(d.categories); }
      if (d.transactions?.length) { await db.transactions.clear(); await db.transactions.bulkAdd(d.transactions); }
      if (d.transactionItems?.length) { await db.transactionItems.clear(); await db.transactionItems.bulkAdd(d.transactionItems); }
      if (d.customers?.length) { await db.customers.clear(); await db.customers.bulkAdd(d.customers); }
      if (d.debtLogs?.length) { await db.debtLogs.clear(); await db.debtLogs.bulkAdd(d.debtLogs); }
      if (d.stockLogs?.length) { await db.stockLogs.clear(); await db.stockLogs.bulkAdd(d.stockLogs); }
      if (d.suspendedCarts?.length) { await db.suspendedCarts.clear(); await db.suspendedCarts.bulkAdd(d.suspendedCarts); }
      if (d.auditLogs?.length) { await db.auditLogs.clear(); await db.auditLogs.bulkAdd(d.auditLogs); }
      if (d.cashMovements?.length) { await db.cashMovements.clear(); await db.cashMovements.bulkAdd(d.cashMovements); }
      if (d.cashSessions?.length) { await db.cashSessions.clear(); await db.cashSessions.bulkAdd(d.cashSessions); }
      if (d.users?.length) { await db.users.clear(); await db.users.bulkAdd(d.users); }
      if (d.settings?.length) { await db.settings.clear(); await db.settings.bulkAdd(d.settings); }
      if (d.koinAccount?.length) { await db.koinAccount.clear(); await db.koinAccount.bulkAdd(d.koinAccount); }
    });

    console.log('[Kasirio DB] Database successfully restored from backup file.');
    return true;
  } catch (err) {
    console.error('[Kasirio DB] Import failed:', err);
    throw err;
  }
}
