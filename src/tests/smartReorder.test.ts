import { describe, it, expect } from 'vitest';
import {
  calculateReorderMetrics,
  ProductInventoryInput,
  SalesHistoryInput,
} from '../server/routes/aiReorderRoutes';

describe('AI Smart Reorder & Prediksi Stok Engine', () => {
  const mockProducts: ProductInventoryInput[] = [
    {
      id: 'prod-1',
      sku: 'MINYAK-01',
      name: 'Minyak Goreng 2L',
      stock: 2,
      minStock: 5,
      buyPrice: 30000,
      sellPrice: 35000,
      unit: 'Pouch',
    },
    {
      id: 'prod-2',
      sku: 'BERAS-01',
      name: 'Beras Ramos 5kg',
      stock: 0,
      minStock: 10,
      buyPrice: 65000,
      sellPrice: 72000,
      unit: 'Karung',
    },
    {
      id: 'prod-3',
      sku: 'GULA-01',
      name: 'Gula Pasir 1kg',
      stock: 50,
      minStock: 10,
      buyPrice: 15000,
      sellPrice: 18000,
      unit: 'Kg',
    },
    {
      id: 'prod-4',
      sku: 'KOPI-01',
      name: 'Kopi Kapal Api 65g',
      stock: 6,
      minStock: 5,
      buyPrice: 6000,
      sellPrice: 7500,
      unit: 'Bungkus',
    },
  ];

  const mockSales: SalesHistoryInput[] = [
    // Minyak: 14 pcs sold in 7 days -> 2 pcs/day
    { productId: 'prod-1', quantity: 7 },
    { productId: 'prod-1', quantity: 7 },
    // Beras: 21 sold in 7 days -> 3 pcs/day
    { productId: 'prod-2', quantity: 21 },
    // Gula: 7 sold in 7 days -> 1 pcs/day (stock 50 -> 50 days left -> SAFE)
    { productId: 'prod-3', quantity: 7 },
    // Kopi: 14 sold in 7 days -> 2 pcs/day (stock 6 -> 3 days left -> WARNING)
    { productId: 'prod-4', quantity: 14 },
  ];

  it('correctly calculates daily velocity and days until stockout', () => {
    const results = calculateReorderMetrics(mockProducts, mockSales, 7);

    const minyak = results.find((r) => r.productId === 'prod-1')!;
    expect(minyak.averageDailySales).toBe(2);
    // stock 2 / 2 per day = 1 day left -> CRITICAL
    expect(minyak.daysUntilStockout).toBe(1);
    expect(minyak.urgency).toBe('CRITICAL');

    const beras = results.find((r) => r.productId === 'prod-2')!;
    expect(beras.currentStock).toBe(0);
    expect(beras.daysUntilStockout).toBe(0);
    expect(beras.urgency).toBe('CRITICAL');

    const kopi = results.find((r) => r.productId === 'prod-4')!;
    expect(kopi.averageDailySales).toBe(2);
    // stock 6 / 2 per day = 3 days left -> WARNING
    expect(kopi.daysUntilStockout).toBe(3);
    expect(kopi.urgency).toBe('WARNING');

    const gula = results.find((r) => r.productId === 'prod-3')!;
    expect(gula.averageDailySales).toBe(1);
    expect(gula.daysUntilStockout).toBe(50);
    expect(gula.urgency).toBe('SAFE');
  });

  it('calculates suggested reorder quantity and estimated cost correctly', () => {
    const results = calculateReorderMetrics(mockProducts, mockSales, 7);

    // Minyak: daily 2 * 7 = 14 target + minStock 5 = 19 ideal. Current 2. Needed: 17
    const minyak = results.find((r) => r.productId === 'prod-1')!;
    expect(minyak.suggestedReorderQty).toBe(17);
    expect(minyak.estimatedCost).toBe(17 * 30000); // 510,000

    // Gula: current 50, ideal 7*1 + 10 = 17. 17 - 50 = -33 -> suggested 0
    const gula = results.find((r) => r.productId === 'prod-3')!;
    expect(gula.suggestedReorderQty).toBe(0);
    expect(gula.estimatedCost).toBe(0);
  });

  it('sorts recommendations with CRITICAL first, then WARNING, then SAFE', () => {
    const results = calculateReorderMetrics(mockProducts, mockSales, 7);

    expect(results[0].urgency).toBe('CRITICAL');
    expect(results[1].urgency).toBe('CRITICAL');
    expect(results[2].urgency).toBe('WARNING');
    expect(results[3].urgency).toBe('SAFE');
  });
});
