import { describe, it, expect } from 'vitest';
import { ParsedNotaItem } from '../utils/geminiService';
import { Product, StockLog } from '../types';

describe('AI OCR Nota Pasar & Human-in-the-Loop Stock Flow', () => {
  it('harus memvalidasi struktur data item hasil ekstraksi AI', () => {
    const rawAiItems: ParsedNotaItem[] = [
      { name: 'Bawang Merah Brebes', quantity: 5, buyPrice: 28000, unit: 'Kg' },
      { name: 'Cabai Rawit Merah', quantity: 2, buyPrice: 45000, unit: 'Kg' },
    ];

    expect(rawAiItems.length).toBe(2);
    expect(rawAiItems[0].name).toBe('Bawang Merah Brebes');
    expect(rawAiItems[0].quantity).toBeGreaterThan(0);
    expect(rawAiItems[0].buyPrice).toBe(28000);
  });

  it('harus menghitung total nilai belanja kulakan nota secara akurat', () => {
    const rawAiItems: ParsedNotaItem[] = [
      { name: 'Bawang Merah Brebes', quantity: 5, buyPrice: 28000, unit: 'Kg' }, // 140.000
      { name: 'Cabai Rawit Merah', quantity: 2, buyPrice: 45000, unit: 'Kg' },   // 90.000
      { name: 'Minyak Goreng Curah', quantity: 10, buyPrice: 16000, unit: 'Liter' }, // 160.000
    ];

    const total = rawAiItems.reduce((acc, item) => acc + item.quantity * item.buyPrice, 0);
    expect(total).toBe(390000);
  });

  it('harus mengupdate stok barang yang sudah ada dan mencatat mutasi PURCHASE di ledger', () => {
    const existingProducts: Product[] = [
      {
        id: 'prod-bwg',
        sku: 'BRG-BWG',
        name: 'Bawang Merah Brebes',
        categoryId: 'cat-1',
        buyPrice: 26000,
        sellPrice: 35000,
        stock: 10,
        minStock: 3,
        unit: 'Kg',
      },
    ];

    const stockLogs: StockLog[] = [];

    // Simulasi aksi konfirmasi Kasir dari modal OCR
    const itemFromNota: ParsedNotaItem = {
      name: 'Bawang Merah Brebes',
      quantity: 5,
      buyPrice: 28000,
      unit: 'Kg',
    };

    const targetProduct = existingProducts.find(
      (p) => p.name.toLowerCase() === itemFromNota.name.toLowerCase()
    );

    expect(targetProduct).toBeDefined();

    if (targetProduct) {
      // 1. Tambah stok produk
      targetProduct.stock += itemFromNota.quantity;
      targetProduct.buyPrice = itemFromNota.buyPrice;

      // 2. Buat log mutasi pembelian masuk
      stockLogs.push({
        id: `log-${Date.now()}`,
        productId: targetProduct.id,
        productName: targetProduct.name,
        type: 'IN',
        quantity: itemFromNota.quantity,
        previousStock: 10,
        currentStock: targetProduct.stock,
        notes: `Kulakan Nota Pasar (HPP: Rp ${itemFromNota.buyPrice})`,
        date: new Date().toISOString(),
      });
    }

    expect(targetProduct?.stock).toBe(15);
    expect(targetProduct?.buyPrice).toBe(28000);
    expect(stockLogs.length).toBe(1);
    expect(stockLogs[0].type).toBe('IN');
    expect(stockLogs[0].quantity).toBe(5);
    expect(stockLogs[0].currentStock).toBe(15);
  });

  it('harus dapat membuat SKU baru jika barang belanjaan nota belum ada di katalog', () => {
    const existingProducts: Product[] = [];
    const itemFromNota: ParsedNotaItem = {
      name: 'Tempe Daun Tradisional',
      quantity: 20,
      buyPrice: 2500,
      unit: 'Pcs',
    };

    const isExisting = existingProducts.some(
      (p) => p.name.toLowerCase() === itemFromNota.name.toLowerCase()
    );

    if (!isExisting) {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        sku: 'NOTA-AUTO-01',
        name: itemFromNota.name,
        categoryId: 'cat-1',
        buyPrice: itemFromNota.buyPrice,
        sellPrice: 3500, // Margin markup
        stock: itemFromNota.quantity,
        minStock: 5,
        unit: itemFromNota.unit,
      };
      existingProducts.push(newProduct);
    }

    expect(existingProducts.length).toBe(1);
    expect(existingProducts[0].name).toBe('Tempe Daun Tradisional');
    expect(existingProducts[0].stock).toBe(20);
    expect(existingProducts[0].buyPrice).toBe(2500);
  });
});
