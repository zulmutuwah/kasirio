import { Router, Request, Response } from 'express';

export const paymentRouter = Router();

export interface QrisOrder {
  orderId: string;
  amount: number;
  customerName?: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  qrisString: string;
  createdAt: number;
  expiresAt: number;
  paidAt?: string;
}

// In-memory / cache store for active payment sessions
const activeQrisOrders = new Map<string, QrisOrder>();

/**
 * Menghasilkan string QRIS dinamis berbasis standar EMVCo / QRIS Nasional
 */
export function generateDynamicQrisString(orderId: string, amount: number, merchantName: string = 'KASIRIO POS'): string {
  // Format standar QRIS Dinamis (EMVCo Tag 54 untuk nominal transaksi)
  const paddedMerchant = merchantName.slice(0, 25);
  const formattedAmount = amount.toFixed(2);
  
  return `00020101021226590014ID.LINKAJA.WWW01189360091100223456780215000${orderId.slice(-8)}52045411530336054${formattedAmount.length.toString().padStart(2, '0')}${formattedAmount}5802ID59${paddedMerchant.length.toString().padStart(2, '0')}${paddedMerchant}6007JAKARTA62${(orderId.length + 4).toString().padStart(2, '0')}01${orderId.length.toString().padStart(2, '0')}${orderId}6304A1B2`;
}

// POST /api/payment/qris/create - Generate tagihan QRIS dinamis ber-nominal
paymentRouter.post('/qris/create', (req: Request, res: Response) => {
  try {
    const { amount, customerName, notes, merchantName } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran (amount) harus lebih dari 0.' });
    }

    const orderId = req.body.orderId || `QRIS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const numAmount = Number(amount);
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // Berlaku 5 menit

    const qrisString = generateDynamicQrisString(orderId, numAmount, merchantName || 'KASIRIO POS');

    const orderData: QrisOrder = {
      orderId,
      amount: numAmount,
      customerName,
      status: 'PENDING',
      qrisString,
      createdAt: now,
      expiresAt,
    };

    activeQrisOrders.set(orderId, orderData);

    res.status(201).json({
      success: true,
      orderId,
      amount: numAmount,
      qrisString,
      expiresAt,
      message: 'QRIS dinamis berhasil dibuat.',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal membuat QRIS dinamis: ' + error.message });
  }
});

// GET /api/payment/qris/status/:orderId - Polling status transaksi QRIS
paymentRouter.get('/qris/status/:orderId', (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = activeQrisOrders.get(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Tagihan QRIS tidak ditemukan atau telah kedaluwarsa.' });
  }

  // Cek kedaluwarsa
  if (order.status === 'PENDING' && Date.now() > order.expiresAt) {
    order.status = 'EXPIRED';
  }

  res.json({
    success: true,
    orderId: order.orderId,
    status: order.status,
    amount: order.amount,
    paidAt: order.paidAt,
  });
});

// POST /api/payment/webhook - Webhook listener resmi (Midtrans / Xendit)
paymentRouter.post('/webhook', (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log('[Payment Webhook Received]', body);

    // Deteksi payload Midtrans
    let targetOrderId = body.order_id || body.orderId;
    let isSuccess = false;

    if (body.transaction_status === 'settlement' || body.transaction_status === 'capture') {
      isSuccess = true;
    }

    // Deteksi payload Xendit
    if (body.event === 'qr.payment' && body.data?.status === 'COMPLETED') {
      targetOrderId = body.data.external_id || body.data.reference_id;
      isSuccess = true;
    }

    if (targetOrderId && isSuccess) {
      const order = activeQrisOrders.get(targetOrderId);
      if (order) {
        order.status = 'PAID';
        order.paidAt = new Date().toISOString();
        console.log(`[Payment Webhook] Order ${targetOrderId} BERHASIL DIBAYAR (Rp ${order.amount})`);
      }
    }

    res.json({ success: true, message: 'Webhook berhasil diproses.' });
  } catch (error: any) {
    console.error('[Payment Webhook Error]', error);
    res.status(500).json({ error: 'Gagal memproses webhook pembayaran.' });
  }
});

// POST /api/payment/simulate-webhook - Simulasi pembeli scan & bayar QRIS
paymentRouter.post('/simulate-webhook', (req: Request, res: Response) => {
  const { orderId } = req.body;
  const order = activeQrisOrders.get(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order QRIS tidak ditemukan.' });
  }

  order.status = 'PAID';
  order.paidAt = new Date().toISOString();

  console.log(`[Simulator Webhook] Pembayaran QRIS ${orderId} (Rp ${order.amount}) disimulasikan LUNAS.`);

  res.json({
    success: true,
    orderId: order.orderId,
    status: 'PAID',
    amount: order.amount,
    paidAt: order.paidAt,
    message: `Pembayaran QRIS ${orderId} berhasil disimulasikan lunas.`,
  });
});
