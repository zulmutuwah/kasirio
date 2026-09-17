import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, initDatabase } from '../db';
import {
  AuditLogEntry,
  CartItem,
  CashMovement,
  Category,
  Customer,
  KoinAccount,
  Product,
  Shift,
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
import { generateInvoiceNumber, formatRupiah } from '../utils/formatters';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface POSContextType {
  // Navigation
  activeTab: 'kasir' | 'produk' | 'pelanggan' | 'laporan' | 'pengaturan';
  setActiveTab: (tab: 'kasir' | 'produk' | 'pelanggan' | 'laporan' | 'pengaturan') => void;

  // Products
  products: Product[];
  categories: Category[];
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (productId: string, quantityChange: number, reason: string) => Promise<void>;

  // Categories
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemDiscount: (productId: string, discount: number, discountType: 'NOMINAL' | 'PERCENT') => void;
  clearCart: () => void;
  cartOrderDiscount: number;
  setCartOrderDiscount: (discount: number) => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;

  // Suspended / Hold Orders
  suspendedCarts: SuspendedCart[];
  holdCurrentCart: (label?: string, notes?: string) => Promise<void>;
  recallCart: (suspendedCartId: string) => Promise<void>;
  deleteSuspendedCart: (suspendedCartId: string) => Promise<void>;

  // Customers & Debts
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'totalDebt' | 'createdAt'>) => Promise<Customer>;
  payCustomerDebt: (customerId: string, amountPaid: number, paymentMethod: 'TUNAI' | 'TRANSFER' | 'QRIS', notes?: string) => Promise<void>;

  // Transactions
  transactions: Transaction[];
  processCheckout: (
    paymentMethod: 'TUNAI' | 'QRIS' | 'TRANSFER' | 'KASBON',
    amountPaid: number,
    notes?: string
  ) => Promise<Transaction>;
  cancelTransaction: (transactionId: string) => Promise<void>;
  voidTransaction: (transactionId: string, reason: string) => Promise<void>;
  activeReceiptTransaction: Transaction | null;
  setActiveReceiptTransaction: (trx: Transaction | null) => void;

  // Shift Kasir
  activeShift: Shift | null;
  openShift: (cashierName: string, initialCash: number) => void;
  closeShift: (finalCash: number) => void;
  addCashMovement: (type: 'IN' | 'OUT', amount: number, category: string, notes: string) => void;

  // Settings
  settings: StoreSettings;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;

  // Audit Logs
  auditLogs: AuditLogEntry[];
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => Promise<void>;

  // Koin Kasirio System
  koinAccount: KoinAccount;
  topupKoin: (amountKoin: number, rupiahAmount: number) => Promise<void>;
  extendProWithKoin: (costKoin: number, days: number) => Promise<boolean>;

  // Stock logs
  stockLogs: StockLog[];

  // Soundbox
  speakSoundbox: (message: string) => void;

  // Toast notifications
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Demo Data Reset
  resetDemoData: () => Promise<void>;

  // Quick Barcode Scanner Modal toggle
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;

  // Sidebar Open/Collapse state
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<'kasir' | 'produk' | 'pelanggan' | 'laporan' | 'pengaturan'>('kasir');

  // Core Data States
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [suspendedCarts, setSuspendedCarts] = useState<SuspendedCart[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [koinAccount, setKoinAccount] = useState<KoinAccount>({
    saldoKoin: 150,
    isPro: true,
    proExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    history: [],
  });

  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    const saved = localStorage.getItem('kasir_active_shift');
    return saved ? JSON.parse(saved) : {
      id: 'shift-1',
      cashierName: 'Ahmad (Kasir Utama)',
      startTime: new Date().toISOString(),
      initialCash: 100000,
      cashMovements: [],
      status: 'OPEN',
    };
  });

  // Cart local state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cartOrderDiscount, setCartOrderDiscount] = useState<number>(0);
  const [activeReceiptTransaction, setActiveReceiptTransaction] = useState<Transaction | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Soundbox Helper
  const speakSoundbox = (message: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'id-ID';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Soundbox speech error:', err);
      }
    }
  };

  // Init IndexedDB on Mount
  useEffect(() => {
    async function loadData() {
      try {
        await initDatabase();

        const [
          dbProducts,
          dbCategories,
          dbCustomers,
          dbTransactions,
          dbSettingsObj,
          dbStockLogs,
          dbSuspended,
          dbAudit,
          dbKoinObj,
        ] = await Promise.all([
          db.products.toArray(),
          db.categories.toArray(),
          db.customers.toArray(),
          db.transactions.reverse().toArray(),
          db.settings.get('current'),
          db.stockLogs.reverse().toArray(),
          db.suspendedCarts.toArray(),
          db.auditLogs.reverse().toArray(),
          db.koinAccount.get('current'),
        ]);

        if (dbProducts.length > 0) setProducts(dbProducts);
        if (dbCategories.length > 0) setCategories(dbCategories);
        if (dbCustomers.length > 0) setCustomers(dbCustomers);
        if (dbTransactions.length > 0) setTransactions(dbTransactions);
        if (dbSettingsObj?.data) setSettings(dbSettingsObj.data);
        if (dbStockLogs.length > 0) setStockLogs(dbStockLogs);
        if (dbSuspended.length > 0) setSuspendedCarts(dbSuspended);
        if (dbAudit.length > 0) setAuditLogs(dbAudit);
        if (dbKoinObj?.data) setKoinAccount(dbKoinObj.data);
      } catch (err) {
        console.error('[Kasirio DB] Load failed, fallback to local state:', err);
      }
    }
    loadData();
  }, []);

  // Save Shift to LocalStorage
  useEffect(() => {
    if (activeShift) {
      localStorage.setItem('kasir_active_shift', JSON.stringify(activeShift));
    }
  }, [activeShift]);

  // Product Actions
  const addProduct = async (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [newProduct, ...prev]);
    await db.products.add(newProduct);
    showToast(`Produk "${newProduct.name}" berhasil ditambahkan.`);
  };

  const updateProduct = async (id: string, updatedFields: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updatedFields } : p))
    );
    await db.products.update(id, updatedFields);
    showToast('Data produk berhasil diperbarui.');
  };

  const deleteProduct = async (id: string) => {
    const prod = products.find((p) => p.id === id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await db.products.delete(id);
    showToast(`Produk "${prod?.name || ''}" berhasil dihapus.`);
  };

  const adjustStock = async (productId: string, quantityChange: number, reason: string) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return;

    const previousStock = targetProduct.stock;
    const newStock = Math.max(0, previousStock + quantityChange);

    const log: StockLog = {
      id: `log-${Date.now()}`,
      productId,
      productName: targetProduct.name,
      type: quantityChange >= 0 ? 'IN' : 'OUT',
      quantity: Math.abs(quantityChange),
      previousStock,
      currentStock: newStock,
      notes: reason,
      date: new Date().toISOString(),
    };

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
    );
    setStockLogs((prev) => [log, ...prev]);

    await db.products.update(productId, { stock: newStock });
    await db.stockLogs.add(log);

    showToast(`Stok ${targetProduct.name} disesuaikan menjadi ${newStock}.`);
  };

  // Category Actions
  const addCategory = async (catData: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...catData,
      id: `cat-${Date.now()}`,
    };
    setCategories((prev) => [...prev, newCat]);
    await db.categories.add(newCat);
    showToast(`Kategori "${newCat.name}" berhasil ditambahkan.`);
  };

  const deleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await db.categories.delete(id);
    showToast('Kategori berhasil dihapus.');
  };

  // Cart Actions
  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity,
          discount: 0,
          discountType: 'NOMINAL',
        },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const updateCartItemDiscount = (
    productId: string,
    discount: number,
    discountType: 'NOMINAL' | 'PERCENT'
  ) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, discount, discountType } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCartOrderDiscount(0);
  };

  // Hold / Suspend Order
  const holdCurrentCart = async (label?: string, notes?: string) => {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong, tidak ada pesanan untuk ditahan.', 'error');
      return;
    }

    const defaultLabel = selectedCustomer
      ? `Pelanggan: ${selectedCustomer.name}`
      : `Pesanan #${suspendedCarts.length + 1}`;

    const newSuspended: SuspendedCart = {
      id: `hold-${Date.now()}`,
      label: label || defaultLabel,
      items: [...cart],
      cartOrderDiscount,
      selectedCustomer,
      createdAt: new Date().toISOString(),
      notes,
    };

    setSuspendedCarts((prev) => [newSuspended, ...prev]);
    await db.suspendedCarts.add(newSuspended);
    clearCart();
    showToast(`Pesanan "${newSuspended.label}" berhasil ditahan.`);
  };

  const recallCart = async (suspendedCartId: string) => {
    const target = suspendedCarts.find((s) => s.id === suspendedCartId);
    if (!target) return;

    if (cart.length > 0) {
      await holdCurrentCart(`Otomatis Ditahan (${new Date().toLocaleTimeString('id-ID')})`);
    }

    setCart(target.items);
    setCartOrderDiscount(target.cartOrderDiscount);
    setSelectedCustomer(target.selectedCustomer);

    setSuspendedCarts((prev) => prev.filter((s) => s.id !== suspendedCartId));
    await db.suspendedCarts.delete(suspendedCartId);

    showToast(`Pesanan "${target.label}" berhasil dipanggil kembali ke keranjang.`);
  };

  const deleteSuspendedCart = async (suspendedCartId: string) => {
    setSuspendedCarts((prev) => prev.filter((s) => s.id !== suspendedCartId));
    await db.suspendedCarts.delete(suspendedCartId);
    showToast('Pesanan tertahan dihapus.');
  };

  // Customers
  const addCustomer = async (custData: Omit<Customer, 'id' | 'totalDebt' | 'createdAt'>): Promise<Customer> => {
    const newCustomer: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      totalDebt: 0,
      createdAt: new Date().toISOString(),
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    await db.customers.add(newCustomer);
    showToast(`Pelanggan "${newCustomer.name}" berhasil ditambahkan.`);
    return newCustomer;
  };

  const payCustomerDebt = async (
    customerId: string,
    amountPaid: number,
    paymentMethod: 'TUNAI' | 'TRANSFER' | 'QRIS',
    notes?: string
  ) => {
    let updatedCustomer: Customer | undefined;
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const newDebt = Math.max(0, c.totalDebt - amountPaid);
          updatedCustomer = { ...c, totalDebt: newDebt };
          return updatedCustomer;
        }
        return c;
      })
    );

    if (updatedCustomer) {
      await db.customers.update(customerId, { totalDebt: updatedCustomer.totalDebt });
    }

    const debtLog = {
      id: `debt-pay-${Date.now()}`,
      customerId,
      amountPaid,
      paymentMethod,
      date: new Date().toISOString(),
      notes,
    };
    await db.debtLogs.add(debtLog);

    if (activeShift && paymentMethod === 'TUNAI') {
      addCashMovement('IN', amountPaid, 'Pelunasan Kasbon', `Pembayaran kasbon dari pelanggan - ${notes || ''}`);
    }

    showToast('Pembayaran piutang / kasbon berhasil dicatat!');
  };

  // Audit Logs
  const addAuditLog = async (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const newLog: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    await db.auditLogs.add(newLog);
  };

  // Process Checkout
  const processCheckout = async (
    paymentMethod: 'TUNAI' | 'QRIS' | 'TRANSFER' | 'KASBON',
    amountPaid: number,
    notes?: string
  ): Promise<Transaction> => {
    let subtotal = 0;
    let totalCost = 0;

    const transactionItems = cart.map((item) => {
      const itemOriginalTotal = item.product.sellPrice * item.quantity;
      let itemDiscountAmount = 0;

      if (item.discountType === 'PERCENT') {
        itemDiscountAmount = (itemOriginalTotal * item.discount) / 100;
      } else {
        itemDiscountAmount = item.discount;
      }

      const itemSubtotal = Math.max(0, itemOriginalTotal - itemDiscountAmount);
      subtotal += itemSubtotal;
      totalCost += item.product.buyPrice * item.quantity;

      return {
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        unit: item.product.unit,
        buyPrice: item.product.buyPrice,
        sellPrice: item.product.sellPrice,
        quantity: item.quantity,
        discount: itemDiscountAmount,
        notes: item.notes,
        subtotal: itemSubtotal,
      };
    });

    const taxAmount = settings.enableTax ? (subtotal * settings.taxPercentage) / 100 : 0;
    const finalTotal = Math.max(0, subtotal + taxAmount - cartOrderDiscount);
    const totalProfit = finalTotal - totalCost;
    const change = paymentMethod === 'TUNAI' ? Math.max(0, amountPaid - finalTotal) : 0;

    const invoiceNumber = generateInvoiceNumber();

    const newTransaction: Transaction = {
      id: invoiceNumber,
      date: new Date().toISOString(),
      items: transactionItems,
      subtotal,
      tax: taxAmount,
      discount: cartOrderDiscount,
      serviceFee: 0,
      total: finalTotal,
      totalCost,
      profit: totalProfit,
      paymentMethod,
      amountPaid: paymentMethod === 'KASBON' ? 0 : amountPaid,
      change,
      customer: selectedCustomer || undefined,
      status: paymentMethod === 'KASBON' ? 'KASBON' : 'LUNAS',
      cashierName: activeShift?.cashierName || 'Kasir Utama',
      notes,
    };

    // 1. Deduct Product Stock in State & IndexedDB
    setProducts((prev) =>
      prev.map((p) => {
        const cartMatch = cart.find((item) => item.product.id === p.id);
        if (cartMatch) {
          const newStock = Math.max(0, p.stock - cartMatch.quantity);
          db.products.update(p.id, { stock: newStock });
          return { ...p, stock: newStock };
        }
        return p;
      })
    );

    // 2. If Kasbon, update Customer Debt
    if (paymentMethod === 'KASBON' && selectedCustomer) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === selectedCustomer.id) {
            const newDebt = c.totalDebt + finalTotal;
            db.customers.update(c.id, { totalDebt: newDebt });
            return { ...c, totalDebt: newDebt };
          }
          return c;
        })
      );
    }

    // 3. Save Transaction
    setTransactions((prev) => [newTransaction, ...prev]);
    await db.transactions.add(newTransaction);

    // 4. Audit Log for manual discount
    if (cartOrderDiscount > 0) {
      addAuditLog({
        type: 'MANUAL_DISCOUNT',
        details: `Diskon order manual diberikan sebesar ${formatRupiah(cartOrderDiscount)} pada nota ${invoiceNumber}`,
        cashierName: newTransaction.cashierName,
        amount: cartOrderDiscount,
        relatedTransactionId: invoiceNumber,
      });
    }

    // 5. Soundbox Announcement if enabled
    if (settings.soundboxEnabled) {
      if (paymentMethod === 'QRIS') {
        speakSoundbox(`Pembayaran QRIS sebesar ${finalTotal} rupiah berhasil diterima.`);
      } else if (paymentMethod === 'TUNAI') {
        speakSoundbox(`Pembayaran tunai diterima, kembalian ${change} rupiah.`);
      }
    }

    setActiveReceiptTransaction(newTransaction);
    clearCart();
    showToast(`Transaksi ${invoiceNumber} berhasil disimpan!`);
    return newTransaction;
  };

  const cancelTransaction = async (transactionId: string) => {
    voidTransaction(transactionId, 'Dibatalkan oleh kasir');
  };

  const voidTransaction = async (transactionId: string, reason: string) => {
    const target = transactions.find((t) => t.id === transactionId);
    if (!target) return;

    // Restore stock
    target.items.forEach(async (item) => {
      const p = products.find((prod) => prod.id === item.productId);
      if (p) {
        const restored = p.stock + item.quantity;
        await db.products.update(p.id, { stock: restored });
      }
    });

    setProducts((prev) =>
      prev.map((p) => {
        const itemMatch = target.items.find((item) => item.productId === p.id);
        if (itemMatch) {
          return { ...p, stock: p.stock + itemMatch.quantity };
        }
        return p;
      })
    );

    // Mark as VOID
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              status: 'BATAL',
              voidReason: reason,
              voidDate: new Date().toISOString(),
              voidCashier: activeShift?.cashierName || 'Kasir Utama',
              isAuditFlagged: true,
            }
          : t
      )
    );

    await db.transactions.update(transactionId, {
      status: 'BATAL',
      voidReason: reason,
      voidDate: new Date().toISOString(),
      voidCashier: activeShift?.cashierName || 'Kasir Utama',
      isAuditFlagged: true,
    });

    // Record in Audit Log
    addAuditLog({
      type: 'VOID',
      details: `Nota ${transactionId} dibatalkan (${reason}) dengan total nilai ${formatRupiah(target.total)}`,
      cashierName: activeShift?.cashierName || 'Kasir Utama',
      amount: target.total,
      relatedTransactionId: transactionId,
    });

    showToast(`Nota ${transactionId} telah dibatalkan (VOID) dan stok dikembalikan.`, 'error');
  };

  // Shift Actions
  const openShift = (cashierName: string, initialCash: number) => {
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      cashierName,
      startTime: new Date().toISOString(),
      initialCash,
      cashMovements: [],
      status: 'OPEN',
    };
    setActiveShift(newShift);
    showToast(`Shift kasir untuk ${cashierName} berhasil dibuka.`);
  };

  const closeShift = (finalCash: number) => {
    if (!activeShift) return;

    // Calculate total cash transactions during shift
    const shiftStart = new Date(activeShift.startTime).getTime();
    const cashSales = transactions
      .filter((t) => t.paymentMethod === 'TUNAI' && t.status === 'LUNAS' && new Date(t.date).getTime() >= shiftStart)
      .reduce((sum, t) => sum + t.total, 0);

    const cashIn = activeShift.cashMovements.filter((m) => m.type === 'IN').reduce((sum, m) => sum + m.amount, 0);
    const cashOut = activeShift.cashMovements.filter((m) => m.type === 'OUT').reduce((sum, m) => sum + m.amount, 0);
    const expectedCash = activeShift.initialCash + cashSales + cashIn - cashOut;

    setActiveShift({
      ...activeShift,
      endTime: new Date().toISOString(),
      finalCash,
      expectedCash,
      status: 'CLOSED',
    });

    showToast('Shift kasir berhasil ditutup.');
  };

  const addCashMovement = (type: 'IN' | 'OUT', amount: number, category: string, notes: string) => {
    if (!activeShift) return;

    const movement: CashMovement = {
      id: `mov-${Date.now()}`,
      type,
      amount,
      category,
      notes,
      date: new Date().toISOString(),
    };

    setActiveShift((prev) => (prev ? { ...prev, cashMovements: [...prev.cashMovements, movement] } : null));
    db.cashMovements.add(movement);

    if (type === 'OUT') {
      addAuditLog({
        type: 'DRAWER_OPEN',
        details: `Kas keluar sebesar ${formatRupiah(amount)} untuk ${category}: ${notes}`,
        cashierName: activeShift.cashierName,
        amount,
      });
    }

    showToast(`Kas ${type === 'IN' ? 'Masuk' : 'Keluar'} sebesar ${formatRupiah(amount)} dicatat.`);
  };

  // Settings Actions
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    await db.settings.put({ id: 'current', data: merged });
    showToast('Pengaturan toko berhasil diperbarui.');
  };

  // Koin Kasirio Actions
  const topupKoin = async (amountKoin: number, rupiahAmount: number) => {
    const newSaldo = koinAccount.saldoKoin + amountKoin;
    const newTx = {
      id: `koin-tx-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'TOPUP' as const,
      amountKoin,
      rupiahEquivalent: rupiahAmount,
      description: `Top-up ${amountKoin} Koin Kasirio (Pembayaran QRIS)`,
    };

    const updatedAccount: KoinAccount = {
      ...koinAccount,
      saldoKoin: newSaldo,
      history: [newTx, ...koinAccount.history],
    };

    setKoinAccount(updatedAccount);
    await db.koinAccount.put({ id: 'current', data: updatedAccount });
    showToast(`Top-up ${amountKoin} Koin Kasirio berhasil ditambahkan!`);
  };

  const extendProWithKoin = async (costKoin: number, days: number): Promise<boolean> => {
    if (koinAccount.saldoKoin < costKoin) {
      showToast(`Saldo Koin tidak cukup! Butuh ${costKoin} Koin, saldo Anda ${koinAccount.saldoKoin} Koin.`, 'error');
      return false;
    }

    const currentExpiry = koinAccount.proExpiresAt ? new Date(koinAccount.proExpiresAt).getTime() : Date.now();
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    const newExpiry = new Date(baseTime + days * 24 * 3600 * 1000).toISOString();

    const newTx = {
      id: `koin-deduct-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'DEDUCT' as const,
      amountKoin: costKoin,
      rupiahEquivalent: costKoin * 1000,
      description: `Perpanjangan Kasirio Pro ${days} Hari`,
    };

    const updatedAccount: KoinAccount = {
      saldoKoin: koinAccount.saldoKoin - costKoin,
      isPro: true,
      proExpiresAt: newExpiry,
      history: [newTx, ...koinAccount.history],
    };

    setKoinAccount(updatedAccount);
    await db.koinAccount.put({ id: 'current', data: updatedAccount });
    showToast(`Status Kasirio Pro berhasil diperpanjang ${days} hari!`);
    return true;
  };

  // Reset Demo Data
  const resetDemoData = async () => {
    await db.delete();
    await initDatabase();
    setProducts(INITIAL_PRODUCTS);
    setCategories(INITIAL_CATEGORIES);
    setCustomers(INITIAL_CUSTOMERS);
    setTransactions(INITIAL_TRANSACTIONS);
    setSettings(INITIAL_SETTINGS);
    setSuspendedCarts([]);
    setAuditLogs([]);
    clearCart();
    showToast('Data demo berhasil direset ke pengaturan awal.');
  };

  return (
    <POSContext.Provider
      value={{
        activeTab,
        setActiveTab,
        products,
        categories,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        addCategory,
        deleteCategory,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        updateCartItemDiscount,
        clearCart,
        cartOrderDiscount,
        setCartOrderDiscount,
        selectedCustomer,
        setSelectedCustomer,
        suspendedCarts,
        holdCurrentCart,
        recallCart,
        deleteSuspendedCart,
        customers,
        addCustomer,
        payCustomerDebt,
        transactions,
        processCheckout,
        cancelTransaction,
        voidTransaction,
        activeReceiptTransaction,
        setActiveReceiptTransaction,
        activeShift,
        openShift,
        closeShift,
        addCashMovement,
        settings,
        updateSettings,
        auditLogs,
        addAuditLog,
        koinAccount,
        topupKoin,
        extendProWithKoin,
        stockLogs,
        speakSoundbox,
        toasts,
        showToast,
        resetDemoData,
        isScannerOpen,
        setIsScannerOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
