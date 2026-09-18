import { Router, Response } from 'express';
import prisma from '../../prisma';
import { AuthenticatedRequest, authenticateApp, requireRole } from '../../auth';

export const adminRouter = Router();

// Seluruh rute /api/app/admin/* wajib token realm app dengan minimal role ADMIN / OWNER
adminRouter.use(authenticateApp);

/**
 * GET /api/app/admin/policy
 * Mengambil konfigurasi TenantAuthPolicy (PIN Gate settings)
 */
adminRouter.get('/policy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    let policy = await prisma.tenantAuthPolicy.findUnique({
      where: { tenantId },
    });

    if (!policy) {
      // Inisialisasi default jika belum ada
      policy = await prisma.tenantAuthPolicy.create({
        data: {
          tenantId,
          manualDiscountMode: 'THRESHOLD',
          manualDiscountPercent: 10,
          manualProductAddMode: 'ALLOW',
          priceOverrideMode: 'ALWAYS_PIN',
          priceOverridePercent: 5,
          voidTransactionMode: 'ALWAYS_PIN',
          refundMode: 'ALWAYS_PIN',
          refundThresholdAmount: 50000,
          drawerOpenManualMode: 'ALWAYS_PIN',
        },
      });
    }

    return res.json({ success: true, policy });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat kebijakan otorisasi toko.', details: error.message });
  }
});

/**
 * PUT /api/app/admin/policy
 * Mengubah konfigurasi TenantAuthPolicy — Khusus Owner (Blueprint Bagian 3)
 */
adminRouter.put('/policy', requireRole(['OWNER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const {
      manualDiscountMode,
      manualDiscountPercent,
      manualProductAddMode,
      priceOverrideMode,
      priceOverridePercent,
      voidTransactionMode,
      refundMode,
      refundThresholdAmount,
      drawerOpenManualMode,
    } = req.body;

    const updated = await prisma.tenantAuthPolicy.upsert({
      where: { tenantId },
      update: {
        manualDiscountMode,
        manualDiscountPercent: manualDiscountPercent !== undefined ? Number(manualDiscountPercent) : undefined,
        manualProductAddMode,
        priceOverrideMode,
        priceOverridePercent: priceOverridePercent !== undefined ? Number(priceOverridePercent) : undefined,
        voidTransactionMode,
        refundMode,
        refundThresholdAmount: refundThresholdAmount !== undefined ? Number(refundThresholdAmount) : undefined,
        drawerOpenManualMode,
      },
      create: {
        tenantId,
        manualDiscountMode: manualDiscountMode || 'THRESHOLD',
        manualDiscountPercent: Number(manualDiscountPercent) || 10,
        manualProductAddMode: manualProductAddMode || 'ALLOW',
        priceOverrideMode: priceOverrideMode || 'ALWAYS_PIN',
        priceOverridePercent: Number(priceOverridePercent) || 5,
        voidTransactionMode: voidTransactionMode || 'ALWAYS_PIN',
        refundMode: refundMode || 'ALWAYS_PIN',
        refundThresholdAmount: Number(refundThresholdAmount) || 50000,
        drawerOpenManualMode: drawerOpenManualMode || 'ALWAYS_PIN',
      },
    });

    // Catat ke AuditLog
    await prisma.auditLog.create({
      data: {
        tenantId,
        outletId: req.user!.outletId,
        type: 'AUTH_POLICY_UPDATE',
        details: `Owner '${req.user!.name}' memperbarui konfigurasi PIN Gate toko.`,
        cashierName: req.user!.name,
        actorRole: 'OWNER',
        actorId: req.user!.userId,
      },
    });

    return res.json({ success: true, message: 'Kebijakan PIN Gate berhasil diperbarui.', policy: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memperbarui kebijakan PIN Gate.', details: error.message });
  }
});

/**
 * GET /api/app/admin/subscription
 * Cek status Trial / Subscription toko (Blueprint Bagian 4.2)
 */
adminRouter.get('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Data langganan tidak ditemukan.' });
    }

    const now = new Date();
    let daysRemaining = 0;
    if (subscription.status === 'TRIAL') {
      daysRemaining = Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / (1000 * 3600 * 24)));
    } else if (subscription.activeEndsAt) {
      daysRemaining = Math.max(0, Math.ceil((subscription.activeEndsAt.getTime() - now.getTime()) / (1000 * 3600 * 24)));
    }

    return res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planType: subscription.planType,
        trialEndsAt: subscription.trialEndsAt,
        graceEndsAt: subscription.graceEndsAt,
        activeEndsAt: subscription.activeEndsAt,
        daysRemaining,
        isGrace: subscription.status === 'GRACE',
        isLimited: subscription.status === 'LIMITED',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat status langganan.', details: error.message });
  }
});

/**
 * GET /api/app/admin/koin
 * Data tarif Koin & riwayat pembayaran toko
 */
adminRouter.get('/koin', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const setting = (await prisma.koinSetting.findFirst()) || {
      rupiahPerKoin: 1000,
      minTopupKoin: 50,
      bundleDiscounts: null,
    };

    const payments = await prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({
      success: true,
      koinSetting: setting,
      recentPayments: payments,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat data Koin Kasirio.', details: error.message });
  }
});

/**
 * POST /api/app/admin/koin/topup
 * Submit konfirmasi transfer bank untuk top-up Koin / aktivasi langganan (Blueprint Bagian 4.4 & 4.5)
 */
adminRouter.post('/koin/topup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { amount, referenceNumber, koinAmount } = req.body;

    if (!amount || !referenceNumber) {
      return res.status(400).json({ error: 'Nominal transfer dan nomor referensi mutasi bank wajib diisi.' });
    }

    const cleanRef = String(referenceNumber).trim().toUpperCase();

    // Blueprint Bagian 4.4: referenceNumber UNIQUE di seluruh sistem
    const existingRef = await prisma.payment.findUnique({
      where: { referenceNumber: cleanRef },
    });

    if (existingRef) {
      return res.status(400).json({
        error: 'Nomor referensi transfer ini sudah pernah diklaim di sistem. Pastikan memasukkan nomor yang valid.',
      });
    }

    // Ambil subscription aktif/terakhir
    const sub = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Snapshot harga koin saat transaksi dibuat (Immutable Ledger)
    const currentRate = (await prisma.koinSetting.findFirst())?.rupiahPerKoin || 1000;

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        subscriptionId: sub?.id || null,
        amount: Number(amount),
        koinAmount: koinAmount ? Number(koinAmount) : Math.floor(Number(amount) / currentRate),
        rupiahPerKoinAtPurchase: currentRate,
        referenceNumber: cleanRef,
        status: 'PENDING_VERIFICATION',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Konfirmasi transfer berhasil disimpan. Menunggu verifikasi staf platform.',
      payment,
    });
  } catch (error: any) {
    console.error('[Topup Error]:', error);
    return res.status(500).json({ error: 'Gagal memproses pengajuan transfer.', details: error.message });
  }
});
