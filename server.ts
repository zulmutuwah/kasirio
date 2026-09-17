import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { authRouter } from './src/server/routes/authRoutes';
import { syncRouter } from './src/server/routes/syncRoutes';
import { backofficeRouter } from './src/server/routes/backofficeRoutes';
import { paymentRouter } from './src/server/routes/paymentRoutes';
import { notificationRouter } from './src/server/routes/notificationRoutes';
import { aiReorderRouter } from './src/server/routes/aiReorderRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Daftarkan rute API Fase 2, Fase 3 & Fase 4
app.use('/api/auth', authRouter);
app.use('/api/sync', syncRouter);
app.use('/api/backoffice', backofficeRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/ai', aiReorderRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Mock parser for demo & offline fallback
const getMockNotaItems = () => [
  { name: 'Bawang Merah Brebes', quantity: 3, buyPrice: 28000, unit: 'Kg' },
  { name: 'Cabai Rawit Merah', quantity: 2, buyPrice: 45000, unit: 'Kg' },
  { name: 'Bawang Putih Kating', quantity: 2, buyPrice: 32000, unit: 'Kg' },
  { name: 'Minyak Goreng Curah', quantity: 5, buyPrice: 16500, unit: 'Liter' },
  { name: 'Telur Ayam Ras', quantity: 10, buyPrice: 26000, unit: 'Kg' },
];

// POST /api/parse-nota - Proxy for Gemini Multimodal Vision OCR
app.post('/api/parse-nota', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'Gambar nota (imageBase64) diperlukan.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('[Kasirio Proxy] GEMINI_API_KEY tidak disetel. Mengembalikan data simulasi mock nota pasar.');
    // Simulated short delay for realism
    await new Promise((r) => setTimeout(r, 1200));
    return res.json({
      success: true,
      mode: 'mock',
      items: getMockNotaItems(),
      message: 'Mode Simulasi (Atur GEMINI_API_KEY di .env untuk OCR riil)',
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Remove data URL prefix if provided
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const prompt = `
      Anda adalah AI asisten kasir ahli membaca tulisan tangan dan struk belanja pasar tradisional Indonesia (nota kelontong/pasar basah).
      Ekstrak seluruh daftar barang, jumlah kuantitas (quantity), harga beli / harga satuan (buyPrice), dan satuan (unit).
      Perhatikan singkatan khas pasar:
      - "Bwg M" -> "Bawang Merah"
      - "Bwg P" -> "Bawang Putih"
      - "C. Rawit" / "CR" -> "Cabai Rawit"
      - "Mnyk" -> "Minyak"
      - "Tlr" -> "Telur"
      Jika angka tidak jelas, berikan estimasi terbaik yang wajar.
      Kembalikan hanya dalam format JSON sesuai schema.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            items: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  quantity: { type: 'NUMBER' },
                  buyPrice: { type: 'NUMBER' },
                  unit: { type: 'STRING' },
                },
                required: ['name', 'quantity', 'buyPrice', 'unit'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{"items":[]}');
    res.json({
      success: true,
      mode: 'gemini-api',
      items: parsedJson.items || [],
    });
  } catch (error: any) {
    console.error('[Kasirio Proxy] Error memanggil Gemini API:', error);
    // Fallback to mock on API error so cashier is never blocked
    res.json({
      success: true,
      mode: 'fallback-mock',
      items: getMockNotaItems(),
      warning: `Gemini API mengalami kendala (${error.message}). Ditampilkan data cadangan.`,
    });
  }
});

// POST /api/business-briefing
app.post('/api/business-briefing', async (req, res) => {
  const { omzet, profit, transactionCount } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.json({
      insights: [
        `Omzet Anda tercatat Rp ${omzet?.toLocaleString('id-ID') || 0} dari ${transactionCount || 0} transaksi.`,
        'Tingkatkan penjualan produk dengan margin tinggi (F&B / Kopi / Minuman).',
        'Pertahankan stok barang kebutuhan pokok yang cepat berputar (fast-moving items).',
      ],
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Buat 3 butir analisis ringkas (<20 kata per butir) bahasa Indonesia ramah UMKM untuk: Omzet Rp ${omzet}, Laba Rp ${profit}, Jumlah Transaksi: ${transactionCount}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            insights: {
              type: 'ARRAY',
              items: { type: 'STRING' },
            },
          },
          required: ['insights'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"insights":[]}');
    res.json(parsed);
  } catch (err) {
    res.json({
      insights: [
        'Bisnis Anda berjalan stabil hari ini.',
        'Perhatikan barang dengan sisa stok sedikit untuk segera di-restock.',
        'Dorong pelanggan melakukan pembayaran QRIS untuk mempercepat transaksi kasir.',
      ],
    });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Kasirio Backend Proxy] Server berjalan di http://localhost:${PORT}`);
  });
}

export default app;
