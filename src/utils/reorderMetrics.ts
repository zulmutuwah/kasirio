import { SmartReorderRecommendation } from '../types';

export interface ProductInventoryInput {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  sellPrice: number;
  unit: string;
}

export interface SalesHistoryInput {
  productId: string;
  quantity: number;
  date?: string; // ISO string
}

/**
 * Pure calculation engine for reorder recommendations.
 * 100% browser and Node compatible without any server dependencies.
 */
export function calculateReorderMetrics(
  products: ProductInventoryInput[],
  salesHistory: SalesHistoryInput[] = [],
  windowDays: number = 7
): SmartReorderRecommendation[] {
  const safeDays = Math.max(1, windowDays);

  // Map total sold quantity per product in the analyzed window
  const salesMap = new Map<string, number>();
  for (const sale of salesHistory) {
    const prev = salesMap.get(sale.productId) || 0;
    salesMap.set(sale.productId, prev + (sale.quantity || 0));
  }

  const recommendations: SmartReorderRecommendation[] = products.map((product) => {
    const totalSold = salesMap.get(product.id) || 0;
    const averageDailySales = Number((totalSold / safeDays).toFixed(2));

    // Calculate days until stockout
    let daysUntilStockout: number;
    if (product.stock <= 0) {
      daysUntilStockout = 0;
    } else if (averageDailySales > 0) {
      daysUntilStockout = Math.floor(product.stock / averageDailySales);
    } else {
      // If no recent sales, check against minStock
      daysUntilStockout = product.stock <= (product.minStock || 0) ? 2 : 999;
    }

    // Urgency categorization
    let urgency: 'CRITICAL' | 'WARNING' | 'SAFE';
    if (product.stock <= 0 || daysUntilStockout < 2) {
      urgency = 'CRITICAL';
    } else if (daysUntilStockout <= 5 || product.stock <= (product.minStock || 0)) {
      urgency = 'WARNING';
    } else {
      urgency = 'SAFE';
    }

    // Formula: (DailySales * TargetCoverageDays) + SafetyStock - CurrentStock
    // Target 7 days coverage
    const targetDaysCoverage = 7;
    const safetyStock = product.minStock > 0 ? product.minStock : 5;
    const idealLevel = Math.ceil(averageDailySales * targetDaysCoverage) + safetyStock;
    const needed = idealLevel - product.stock;
    const suggestedReorderQty = Math.max(0, Math.ceil(needed));
    const estimatedCost = suggestedReorderQty * (product.buyPrice || 0);

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unit: product.unit || 'Pcs',
      currentStock: product.stock,
      minStock: product.minStock || 0,
      averageDailySales,
      daysUntilStockout,
      urgency,
      suggestedReorderQty,
      estimatedCost,
    };
  });

  // Sort by urgency priority: CRITICAL first, then WARNING, then SAFE
  const urgencyWeight = { CRITICAL: 0, WARNING: 1, SAFE: 2 };
  return recommendations.sort((a, b) => {
    const diff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    if (diff !== 0) return diff;
    return a.daysUntilStockout - b.daysUntilStockout;
  });
}
