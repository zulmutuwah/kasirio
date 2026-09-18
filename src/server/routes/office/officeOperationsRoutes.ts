import { Router, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../prisma';
import { AuthenticatedRequest, authenticateOffice } from '../../auth';

export const officeRouter = Router();

// Seluruh rute di bawah ini wajib terotentikasi sebagai Developer / Super Admin
officeRouter.use(authenticateOffice);

// ============================================================================
// 1. MANAJEMEN TENANT (Blueprint Bagian 2.1 & 5)
// ============================================================================

officeRouter.get('/tenants', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        users: { where: { role: 'OWNER' }, select: { id: true, name: true, email: true, phone: true } },
        outlets: { select: { id: true, name: true, isMainBranch: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, count: tenants.length, tenants });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat daftar tenant.', details: error.message });
  }
});

officeRouter.get('/tenants/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' } },
        users: true,
        outlets: true,
        authPolicy: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan.' });

    // Blueprint Bagian 2.1: Setiap akses staf platform ke data tenant tertentu dicatat di audit log
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        type: 'PLATFORM_ACCESS',
        details: `Staf platform '${req.user!.name}' (${req.user!.role}) meninjau data detail tenant.`,
        cashierName: req.user!.name,
        actorRole: req.user!.role,
        actorId: req.user!.userId,
      },
    });

    return res.json({ success: true, tenant });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat detail tenant.', details: error.message });
  }
});

officeRouter.post('/tenants/:id/action', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, notes, extendDays = 30 } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan.' });

    const latestSub = await prisma.subscription.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    if (action === 'ACTIVATE' || action === 'EXTEND') {
      const baseDate = latestSub?.activeEndsAt && latestSub.activeEndsAt > now ? latestSub.activeEndsAt : now;
      const newActiveEndsAt = new Date(baseDate.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000);

      if (latestSub) {
        await prisma.subscription.update({
          where: { id: latestSub.id },
          data: {
            status: 'ACTIVE',
            activeEndsAt: newActiveEndsAt,
            graceEndsAt: null,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            tenantId: id,
            status: 'ACTIVE',
            trialEndsAt: now,
            activeEndsAt: newActiveEndsAt,
          },
        });
      }

      // Catat di audit log yang terlihat oleh Owner
      await prisma.auditLog.create({
        data: {
          tenantId: id,
          type: 'SUBSCRIPTION_UPDATE',
          details: `Staf platform '${req.user!.name}' memperpanjang masa aktif toko hingga ${newActiveEndsAt.toISOString().slice(0, 10)}. Catatan: ${notes || '-'}`,
          cashierName: req.user!.name,
          actorRole: req.user!.role,
          actorId: req.user!.userId,
        },
      });

      return res.json({ success: true, message: `Tenant berhasil diaktifkan/diperpanjang ${extendDays} hari.` });
    }

    if (action === 'SUSPEND') {
      if (latestSub) {
        await prisma.subscription.update({
          where: { id: latestSub.id },
          data: { status: 'SUSPENDED' },
        });
      }

      await prisma.auditLog.create({
        data: {
          tenantId: id,
          type: 'SUBSCRIPTION_SUSPENDED',
          details: `Staf platform '${req.user!.name}' menangguhkan akun tenant. Alasan: ${notes || 'Pelanggaran ketentuan'}`,
          cashierName: req.user!.name,
          actorRole: req.user!.role,
          actorId: req.user!.userId,
        },
      });

      return res.json({ success: true, message: 'Tenant telah ditangguhkan.' });
    }

    return res.status(400).json({ error: `Aksi '${action}' tidak dikenal.` });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal menjalankan aksi tenant.', details: error.message });
  }
});

// ============================================================================
// 2. VERIFIKASI PEMBAYARAN (Blueprint Bagian 4.4 - Anti Race Condition)
// ============================================================================

officeRouter.get('/payments/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pendingPayments = await prisma.payment.findMany({
      where: { status: 'PENDING_VERIFICATION' },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, count: pendingPayments.length, payments: pendingPayments });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat antrean pembayaran.', details: error.message });
  }
});

officeRouter.get('/payments/pending/count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await prisma.payment.count({
      where: { status: 'PENDING_VERIFICATION' },
    });
    return res.json({ success: true, count });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal menghitung pembayaran pending.', details: error.message });
  }
});

/**
 * POST /api/office/payments/:id/verify
 * Blueprint Bagian 4.4:
 * Transisi status WAJIB dijaga dari race condition:
 * UPDATE payments SET status='VERIFIED' WHERE id=? AND status='PENDING_VERIFICATION'
 */
officeRouter.post('/payments/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffId = req.user!.userId;
    const staffName = req.user!.name;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomic conditional update untuk mencegah double-crediting
      const updateResult = await tx.payment.updateMany({
        where: {
          id,
          status: 'PENDING_VERIFICATION',
        },
        data: {
          status: 'VERIFIED',
          verifiedByStaffId: staffId,
          verifiedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error('ALREADY_PROCESSED');
      }

      const payment = await tx.payment.findUnique({
        where: { id },
        include: { tenant: true },
      });

      if (!payment) throw new Error('PAYMENT_NOT_FOUND');

      // 2. Unlock Instan Langganan Tenant (Blueprint Bagian 4.2)
      const now = new Date();
      const currentSub = await tx.subscription.findFirst({
        where: { tenantId: payment.tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const baseDate = currentSub?.activeEndsAt && currentSub.activeEndsAt > now ? currentSub.activeEndsAt : now;
      const newActiveEndsAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Tambah 30 hari

      if (currentSub) {
        await tx.subscription.update({
          where: { id: currentSub.id },
          data: {
            status: 'ACTIVE',
            activeEndsAt: newActiveEndsAt,
            graceEndsAt: null,
          },
        });
      }

      // 3. Catat ke Audit Log Tenant
      await tx.auditLog.create({
        data: {
          tenantId: payment.tenantId,
          type: 'PAYMENT_VERIFIED',
          details: `Pembayaran transfer ${payment.referenceNumber} sebesar Rp${payment.amount.toLocaleString('id-ID')} telah diverifikasi oleh staf '${staffName}'. Masa aktif toko diperpanjang hingga ${newActiveEndsAt.toISOString().slice(0, 10)}.`,
          cashierName: staffName,
          actorRole: req.user!.role,
          actorId: staffId,
        },
      });

      return payment;
    });

    return res.json({
      success: true,
      message: 'Pembayaran berhasil diverifikasi dan masa aktif toko telah diperpanjang instan.',
      payment: result,
    });
  } catch (error: any) {
    if (error.message === 'ALREADY_PROCESSED') {
      return res.status(409).json({
        error: 'Pembayaran ini sudah diverifikasi oleh staf lain atau statusnya telah berubah. Tidak ada kredit ganda yang diterbitkan.',
      });
    }
    return res.status(500).json({ error: 'Gagal memverifikasi pembayaran.', details: error.message });
  }
});

officeRouter.post('/payments/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ error: 'Data pembayaran tidak ditemukan.' });

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Nomor mutasi tidak cocok dengan rekening bank.',
        verifiedByStaffId: req.user!.userId,
        verifiedAt: new Date(),
      },
    });

    return res.json({ success: true, message: 'Pembayaran telah ditolak.', payment: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal menolak pembayaran.', details: error.message });
  }
});

// ============================================================================
// 3. KONFIGURASI DINAMIS PLATFORM (Blueprint Bagian 8 & Refinement User 3)
// ============================================================================

officeRouter.get('/configs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Inisialisasi default jika tabel masih kosong
    if (configs.length === 0) {
      const defaults = [
        { key: 'grace_period_days', value: '7', description: 'Durasi masa tenggang (GRACE) sebelum masuk LIMITED (hari)' },
        { key: 'additional_tenant_monthly_price', value: '49000', description: 'Biaya langganan bulanan per tenant tambahan (Rp)' },
        { key: 'max_concurrent_sessions_starter', value: '3', description: 'Batas perangkat login bersamaan untuk tier Starter' },
        { key: 'max_concurrent_sessions_pro', value: '10', description: 'Batas perangkat login bersamaan untuk tier Pro' },
        { key: 'default_pin_threshold_discount_percent', value: '10', description: 'Batas diskon manual kasir yang butuh PIN Owner (%)' },
        { key: 'default_pin_threshold_refund_amount', value: '50000', description: 'Batas nominal refund kasir yang butuh PIN Owner (Rp)' },
      ];

      for (const item of defaults) {
        await prisma.systemConfig.upsert({
          where: { key: item.key },
          update: {},
          create: item,
        });
      }

      const fresh = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
      return res.json({ success: true, configs: fresh });
    }

    return res.json({ success: true, configs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat konfigurasi sistem.', details: error.message });
  }
});

/**
 * PUT /api/office/configs/:key
 * Refinement User 3:
 * Setiap perubahan nilai di system_configs WAJIB tercatat di audit log platform staf
 * (aksi Super Admin yang mempengaruhi seluruh tenant di platform).
 */
officeRouter.put('/configs/:key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Nilai konfigurasi (value) wajib diisi.' });
    }

    const prevConfig = await prisma.systemConfig.findUnique({ where: { key } });

    const updated = await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: String(value),
        description: description || undefined,
        updatedByStaffId: req.user!.userId,
      },
      create: {
        key,
        value: String(value),
        description: description || null,
        updatedByStaffId: req.user!.userId,
      },
    });

    // Refinement User 3: Audit log perubahan konfigurasi sistem
    await prisma.auditLog.create({
      data: {
        tenantId: 'platform-internal',
        type: 'PLATFORM_SYSTEM_CONFIG_UPDATE',
        details: `Staf platform '${req.user!.name}' (${req.user!.role}) mengubah konfigurasi '${key}' dari '${prevConfig?.value || 'kosong'}' menjadi '${value}'.`,
        cashierName: req.user!.name,
        actorRole: req.user!.role,
        actorId: req.user!.userId,
      },
    });

    return res.json({
      success: true,
      message: `Konfigurasi '${key}' berhasil diperbarui dan tercatat di audit log platform.`,
      config: updated,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memperbarui konfigurasi sistem.', details: error.message });
  }
});

// ============================================================================
// 4. INTEGRASI PROVIDER (EMAIL & WHATSAPP) - Blueprint Bagian 5.4
// ============================================================================

officeRouter.get('/providers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const providers = await prisma.integrationProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Masking credentials agar API tidak mengembalikan nilai asli (Blueprint 5.4)
    const masked = providers.map((p) => ({
      ...p,
      credentialsEncrypted: '****(Tersimpan Aman Enkripsi AES)****',
    }));

    return res.json({ success: true, providers: masked });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memuat data provider integrasi.', details: error.message });
  }
});

officeRouter.post('/providers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, providerName, credentials, isActive = false } = req.body;

    if (!type || !providerName || !credentials) {
      return res.status(400).json({ error: 'Tipe (EMAIL/WHATSAPP), nama provider, dan kredensial wajib diisi.' });
    }

    // Enkripsi sederhana untuk kredensial
    const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY || 'kasirio-secret-aes-key-32chars!';
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.alloc(32, encKey), Buffer.alloc(16, 0));
    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const provider = await prisma.integrationProvider.create({
      data: {
        type: type.toUpperCase(),
        providerName,
        credentialsEncrypted: encrypted,
        isActive: Boolean(isActive),
        updatedBy: req.user!.userId,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Provider ${providerName} (${type}) berhasil ditambahkan.`,
      provider: { ...provider, credentialsEncrypted: '****(Tersimpan Aman)****' },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal menyimpan provider integrasi.', details: error.message });
  }
});
