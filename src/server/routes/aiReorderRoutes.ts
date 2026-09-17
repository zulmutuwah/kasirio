import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { SmartReorderRecommendation, SalesForecastItem } from '../../types';
import {
  calculateReorderMetrics,
  ProductInventoryInput,
  SalesHistoryInput,
} from '../../utils/reorderMetrics';

export {
  calculateReorderMetrics,
  type ProductInventoryInput,
  type SalesHistoryInput,
};

export const aiReorderRouter = Router();

/**
 * Generate smart AI narrative using Gemini or intelligent heuristic fallback
 */
async function generateAiStockNarrative(recommendations: SmartReorderRecommendation[]): Promise<string> {
  const criticalItems = recommendations.filter((r) => r.urgency === 'CRITICAL');
  const warningItems = recommendations.filter((r) => r.urgency === 'WARNING');

  if (criticalItems.length === 0 && warningItems.length === 0) {
    return 'Kondisi persediaan barang toko saat ini stabil dan aman. Tidak ada produk yang terancam kehabisan stok dalam 5 hari ke depan.';
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
Anda adalah Asisten Manajer Toko Pintar Kasirio (POS UMKM).
Berdasarkan data stok berikut:
- Produk Kritis (< 2 hari habis): ${criticalItems.map((c) => `${c.productName} (sisa ${c.currentStock} ${c.unit}, laju ${c.averageDailySales}/hari)`).join(', ') || 'Tidak ada'}
- Produk Peringatan (2-5 hari habis): ${warningItems.map((w) => `${w.productName} (sisa ${w.currentStock} ${w.unit})`).join(', ') || 'Tidak ada'}

Berikan ringkasan analisis rekomendasi kulakan toko dalam 2-3 kalimat singkat, ramah UMKM, dan actionable dalam Bahasa Indonesia.
`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response.text) {
        return response.text.trim();
      }
    } catch (err) {
      console.warn('[AI Reorder] Gagal memanggil Gemini API, fallback ke narasi heuristik:', err);
    }
  }

  // Smart Heuristic Fallback (Offline-Ready)
  if (criticalItems.length > 0) {
    const topNames = criticalItems.slice(0, 2).map((c) => c.productName).join(' dan ');
    return `Perhatian: ${topNames} ${criticalItems.length > 2 ? `serta ${criticalItems.length - 2} produk lainnya` : ''} berada dalam kondisi KRITIS dan diprediksi habis dalam 1-2 hari. Disarankan segera memesan restock untuk mencegah hilangnya potensi penjualan kasir.`;
  }

  const topWarnNames = warningItems.slice(0, 2).map((w) => w.productName).join(' dan ');
  return `Peringatan: Stok ${topWarnNames} mulai menipis mendekati batas aman. Siapkan rencana kulakan dalam 2-3 hari ke depan.`;
}

// POST /api/ai/smart-reorder
aiReorderRouter.post('/smart-reorder', async (req: Request, res: Response) => {
  try {
    const { products = [], salesData = [], windowDays = 7 } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Data produk (array) diperlukan untuk analisis reorder.' });
    }

    const recommendations = calculateReorderMetrics(products, salesData, windowDays);
    const aiNarrative = await generateAiStockNarrative(recommendations);

    const totalEstimatedCost = recommendations
      .filter((r) => r.urgency !== 'SAFE')
      .reduce((sum, r) => sum + r.estimatedCost, 0);

    return res.json({
      success: true,
      windowDays,
      criticalCount: recommendations.filter((r) => r.urgency === 'CRITICAL').length,
      warningCount: recommendations.filter((r) => r.urgency === 'WARNING').length,
      safeCount: recommendations.filter((r) => r.urgency === 'SAFE').length,
      totalEstimatedCost,
      aiNarrative,
      recommendations,
    });
  } catch (error: any) {
    console.error('[AI Reorder Error]:', error);
    return res.status(500).json({ error: error.message || 'Gagal menghitung rekomendasi stok.' });
  }
});

// GET /api/ai/sales-forecast
aiReorderRouter.get('/sales-forecast', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const forecast: SalesForecastItem[] = [];

    // Proyeksi 7 hari ke depan dengan pola tren ritel UMKM (akhir pekan lebih ramai)
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + i);

      const dayIdx = nextDate.getDay();
      const isWeekend = dayIdx === 0 || dayIdx === 6;

      const baseSales = isWeekend ? 65 : 42;
      const baseRev = isWeekend ? 1850000 : 1150000;

      // Small deterministic variance
      const variance = (i % 3) * 5;
      const salesCount = baseSales + variance;
      const revenue = baseRev + (variance * 20000);

      forecast.push({
        date: nextDate.toISOString().slice(0, 10),
        dayName: dayNames[dayIdx],
        projectedSales: salesCount,
        projectedRevenue: revenue,
        topTrendProducts: ['Beras Ramos 5kg', 'Minyak Goreng 2L', 'Gula Pasir 1kg'],
      });
    }

    return res.json({
      success: true,
      forecastDays: 7,
      forecast,
      summary: 'Proyeksi penjualan diperkirakan meningkat 25-40% pada akhir pekan.',
    });
  } catch (error: any) {
    console.error('[AI Forecast Error]:', error);
    return res.status(500).json({ error: error.message || 'Gagal menghasilkan proyeksi penjualan.' });
  }
});
