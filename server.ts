import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

// Rute Resmi Blueprint v1.0
import { appAuthRouter } from './src/server/routes/app/appAuthRoutes';
import { posSyncRouter } from './src/server/routes/app/posSyncRoutes';
import { adminRouter } from './src/server/routes/app/adminRoutes';
import { officeAuthRouter } from './src/server/routes/office/officeAuthRoutes';
import { officeRouter } from './src/server/routes/office/officeOperationsRoutes';
import { jobRouter } from './src/server/routes/internal/jobRoutes';

// Rute Legacy (Fase 1/2 kompatibilitas)
import { authRouter } from './src/server/routes/authRoutes';
import { syncRouter } from './src/server/routes/syncRoutes';
import { backofficeRouter } from './src/server/routes/backofficeRoutes';
import { paymentRouter } from './src/server/routes/paymentRoutes';
import { notificationRouter } from './src/server/routes/notificationRoutes';
import { aiReorderRouter } from './src/server/routes/aiReorderRoutes';
import { userRouter } from './src/server/routes/userRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Blueprint Bagian 1: CORS di api.kasirio.com hanya mengizinkan origin eksplisit tanpa wildcard
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://app.kasirio.com',
  'https://office.kasirio.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan tools non-browser (misal curl / postman / mobile app) atau origin terdaftar
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' tidak diizinkan oleh kebijakan CORS api.kasirio.com`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '15mb' }));

// ============================================================================
// DAFTAR RUTE RESMI BLUEPRINT v1.0 (Namespaced per Audience & Realm)
// ============================================================================
app.use('/api/app/auth', appAuthRouter);
app.use('/api/app/pos', posSyncRouter);
app.use('/api/app/admin', adminRouter);
app.use('/api/office/auth', officeAuthRouter);
app.use('/api/office', officeRouter);
app.use('/api/internal/jobs', jobRouter);

// ============================================================================
// DAFTAR RUTE LEGACY (Kompatibilitas ke Belakang)
// ============================================================================
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/sync', syncRouter);
app.use('/api/backoffice', backofficeRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/ai', aiReorderRouter);

// Root landing message
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 32px; background: #0f172a; color: #f8fafc; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <h2 style="color: #2dd4bf; margin-top: 0;">✅ Kasirio Cloud Backend API (Blueprint v1.0) Aktif!</h2>
      <p style="color: #94a3b8; line-height: 1.6;">Server multi-tenant Express berjalan melayani App (/api/app/*) dan Office (/api/office/*) dengan isolasi realm, RLS support, dan live clock handshake.</p>
      <div style="margin-top: 24px;">
        <a href="http://localhost:3000" style="display: inline-block; background: #14b8a6; color: #020617; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 10px;">
          👉 Buka Aplikasi Kasir POS (localhost:3000)
        </a>
      </div>
    </div>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0-blueprint',
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
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType, data: cleanBase64 } }],
        },
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
                required: ['name', 'quantity', 'buyPrice'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"items":[]}');
    res.json({
      success: true,
      mode: 'live',
      items: parsed.items || [],
    });
  } catch (error: any) {
    console.error('[Gemini OCR Error]:', error);
    res.status(500).json({
      success: false,
      mode: 'error_fallback',
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
    console.log(`[Kasirio Cloud Backend] Server berjalan di http://localhost:${PORT}`);
  });
}

export default app;
