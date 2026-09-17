import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../stores/useCartStore';
import { useCatalogStore } from '../stores/useCatalogStore';
import { useSessionStore } from '../stores/useSessionStore';
import { Product } from '../types';

describe('4. Sub-Fase 2d: Modular Zustand Stores Test', () => {
  const dummyProduct: Product = {
    id: 'prod-minyak-1',
    name: 'Minyak Goreng 2L',
    sku: 'MYK-2L',
    barcode: '89912345678',
    buyPrice: 28000,
    sellPrice: 34000,
    stock: 20,
    minStock: 5,
    unit: 'Pouch',
    categoryId: 'cat-sembako',
  };

  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('useCartStore: harus menambah item ke keranjang dan menghitung subtotal', () => {
    const { addToCart, getCartSubtotal, getCartItemCount } = useCartStore.getState();

    addToCart(dummyProduct, 2);
    expect(useCartStore.getState().cart.length).toBe(1);
    expect(getCartItemCount()).toBe(2);
    expect(getCartSubtotal()).toBe(68000); // 34.000 * 2
  });

  it('useCartStore: harus menghitung diskon item persen dan nominal dengan benar', () => {
    const { addToCart, updateCartItemDiscount, getCartSubtotal } = useCartStore.getState();

    addToCart(dummyProduct, 1);
    // Diskon nominal Rp 4.000
    updateCartItemDiscount(dummyProduct.id, 4000, 'NOMINAL');
    expect(getCartSubtotal()).toBe(30000);

    // Diskon persen 10% dari 34.000 = 3.400 -> subtotal = 30.600
    updateCartItemDiscount(dummyProduct.id, 10, 'PERCENT');
    expect(getCartSubtotal()).toBe(30600);
  });

  it('useCatalogStore: harus memfilter produk berdasarkan nama atau barcode', () => {
    const { setProducts, setSearchQuery, getFilteredProducts } = useCatalogStore.getState();

    setProducts([
      dummyProduct,
      {
        id: 'prod-gula-1',
        name: 'Gula Pasir 1kg',
        sku: 'GLA-1K',
        barcode: '89998765432',
        buyPrice: 14000,
        sellPrice: 17500,
        stock: 50,
        minStock: 10,
        unit: 'Kg',
        categoryId: 'cat-sembako',
      },
    ]);

    setSearchQuery('minyak');
    expect(getFilteredProducts().length).toBe(1);
    expect(getFilteredProducts()[0].name).toBe('Minyak Goreng 2L');

    // Pencarian barcode
    setSearchQuery('89998765432');
    expect(getFilteredProducts().length).toBe(1);
    expect(getFilteredProducts()[0].name).toBe('Gula Pasir 1kg');
  });

  it('useSessionStore: harus membuka shift kasir dan mencatat pergerakan uang laci', () => {
    const { openShift, addMovement, closeShift } = useSessionStore.getState();

    openShift('Siti Kasir', 100000);
    expect(useSessionStore.getState().activeShift?.status).toBe('OPEN');
    expect(useSessionStore.getState().activeShift?.initialCash).toBe(100000);

    addMovement({
      id: 'mov-1',
      type: 'IN',
      amount: 50000,
      category: 'Modal Tambahan',
      notes: 'Kembalian uang kecil',
      date: new Date().toISOString(),
    });

    closeShift(150000);
    const closed = useSessionStore.getState().activeShift;
    expect(closed?.status).toBe('CLOSED');
    expect(closed?.expectedCash).toBe(150000);
    expect(closed?.finalCash).toBe(150000);
  });
});
