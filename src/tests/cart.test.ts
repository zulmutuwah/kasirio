import { describe, it, expect } from 'vitest';
import { CartItem, Customer, Product, SuspendedCart } from '../types';

const sampleProduct: Product = {
  id: 'prod-1',
  sku: 'BRG-001',
  name: 'Kopi Susu Gula Aren',
  categoryId: 'cat-1',
  buyPrice: 8000,
  sellPrice: 18000,
  stock: 25,
  minStock: 5,
  unit: 'Cup',
};

const sampleCustomer: Customer = {
  id: 'cust-1',
  name: 'Budi Santoso',
  phone: '081234567890',
  totalDebt: 0,
  createdAt: '2026-09-17T00:00:00.000Z',
};

describe('Hold & Recall Order Antrean Belanja POS', () => {
  it('harus dapat menahan (hold) keranjang belanja aktif dan mengosongkan keranjang kasir', () => {
    let activeCart: CartItem[] = [
      { product: sampleProduct, quantity: 2, discount: 0, discountType: 'NOMINAL' },
    ];
    let cartDiscount = 2000;
    let selectedCust: Customer | null = sampleCustomer;
    const suspendedList: SuspendedCart[] = [];

    // Fungsi simulasi hold
    const holdCart = (label: string) => {
      const held: SuspendedCart = {
        id: `hold-${Date.now()}`,
        label,
        items: [...activeCart],
        cartOrderDiscount: cartDiscount,
        selectedCustomer: selectedCust,
        createdAt: new Date().toISOString(),
      };
      suspendedList.unshift(held);
      activeCart = [];
      cartDiscount = 0;
      selectedCust = null;
      return held;
    };

    const heldOrder = holdCart('Meja 05 (Tamu Luar)');

    expect(suspendedList.length).toBe(1);
    expect(suspendedList[0].label).toBe('Meja 05 (Tamu Luar)');
    expect(suspendedList[0].items.length).toBe(1);
    expect(suspendedList[0].selectedCustomer?.name).toBe('Budi Santoso');
    expect(activeCart.length).toBe(0);
    expect(cartDiscount).toBe(0);
    expect(selectedCust).toBeNull();
  });

  it('harus memulihkan (recall) antrean belanja ke keranjang aktif dan menghapusnya dari daftar antrean', () => {
    let activeCart: CartItem[] = [];
    let cartDiscount = 0;
    let selectedCust: Customer | null = null;

    const suspendedList: SuspendedCart[] = [
      {
        id: 'hold-123',
        label: 'Meja 08',
        items: [
          { product: sampleProduct, quantity: 3, discount: 1000, discountType: 'NOMINAL' },
        ],
        cartOrderDiscount: 5000,
        selectedCustomer: sampleCustomer,
        createdAt: '2026-09-17T10:00:00.000Z',
      },
    ];

    const recallCart = (id: string) => {
      const idx = suspendedList.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const target = suspendedList[idx];

      activeCart = target.items;
      cartDiscount = target.cartOrderDiscount;
      selectedCust = target.selectedCustomer;

      suspendedList.splice(idx, 1);
    };

    recallCart('hold-123');

    expect(activeCart.length).toBe(1);
    expect(activeCart[0].quantity).toBe(3);
    expect(cartDiscount).toBe(5000);
    expect(selectedCust?.name).toBe('Budi Santoso');
    expect(suspendedList.length).toBe(0); // Terhapus dari antrean hold
  });

  it('harus menahan otomatis transaksi aktif saat ini jika kasir me-recall pesanan lain saat keranjang tidak kosong', () => {
    let activeCart: CartItem[] = [
      { product: sampleProduct, quantity: 1, discount: 0, discountType: 'NOMINAL' },
    ];
    let cartDiscount = 0;
    let selectedCust: Customer | null = null;

    const suspendedList: SuspendedCart[] = [
      {
        id: 'hold-tamu-lama',
        label: 'Pesanan Ibu Ani',
        items: [
          { product: sampleProduct, quantity: 5, discount: 0, discountType: 'NOMINAL' },
        ],
        cartOrderDiscount: 0,
        selectedCustomer: null,
        createdAt: '2026-09-17T09:30:00.000Z',
      },
    ];

    const recallCartWithAutoHold = (id: string) => {
      const target = suspendedList.find((s) => s.id === id);
      if (!target) return;

      // Auto-hold pesanan aktif sekarang
      if (activeCart.length > 0) {
        suspendedList.push({
          id: `hold-auto-${Date.now()}`,
          label: 'Otomatis Ditahan (Sebelum Recall)',
          items: [...activeCart],
          cartOrderDiscount: cartDiscount,
          selectedCustomer: selectedCust,
          createdAt: new Date().toISOString(),
        });
      }

      // Restore target
      activeCart = target.items;
      cartDiscount = target.cartOrderDiscount;
      selectedCust = target.selectedCustomer;

      // Remove recalled from list
      const idx = suspendedList.findIndex((s) => s.id === id);
      suspendedList.splice(idx, 1);
    };

    recallCartWithAutoHold('hold-tamu-lama');

    // Keranjang aktif sekarang berisi pesanan Ibu Ani (5 items)
    expect(activeCart[0].quantity).toBe(5);

    // Daftar tertahan tetap memiliki 1 pesanan (yaitu pesanan yang sebelumnya aktif otomatis ditahan)
    expect(suspendedList.length).toBe(1);
    expect(suspendedList[0].label).toContain('Otomatis Ditahan');
    expect(suspendedList[0].items[0].quantity).toBe(1);
  });
});
