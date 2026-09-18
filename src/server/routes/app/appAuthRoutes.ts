import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../../prisma';
import {
  hashSecret,
  verifySecret,
  generateAppToken,
  AuthenticatedRequest,
  authenticateApp,
} from '../../auth';
import { normalizeEmail, createRateLimiter, checkConcurrentSessionLimit } from '../../middleware/security';

export const appAuthRouter = Router();

// Rate limiter untuk pendaftaran tenant & login (5 request per menit)
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu 1 menit.',
});

/**
 * POST /api/app/auth/register-tenant
 * Blueprint Bagian 4.1: Pembuatan User (Owner) + Tenant + Default Outlet + Trial Subscription (15 hari)
 * dalam SATU TRANSAKSI ATOMIK.
 */
appAuthRouter.post('/register-tenant', authLimiter, async (req: Request, res: Response) => {
  try {
    const { storeName, ownerName, email, phone, password, pin, businessType = 'RETAIL' } = req.body;

    if (!storeName || !ownerName || !email || !password || !pin) {
      return res.status(400).json({
        error: 'Data tidak lengkap. Nama toko, nama pemilik, email, password, dan PIN 6-digit wajib diisi.',
      });
    }

    const cleanEmail = normalizeEmail(email);

    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findFirst({
      where: { email: cleanEmail },
      include: { tenantOwnerships: true },
    });

    const isAdditionalTenant = existingUser && existingUser.tenantOwnerships.length >= 1;

    // Generate slug toko yang unik
    const baseSlug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const slug = `${baseSlug}-${randomSuffix}`;

    const passwordHash = await hashSecret(password);
    const pinHash = await hashSecret(pin);

    const trialDays = 15;
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // Transaksi Atomik Registrasi Multi-Tenant
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: storeName,
          slug,
          businessType: businessType === 'FNB' ? 'FNB' : 'RETAIL',
          phone: phone || null,
        },
      });

      // 2. Buat Default Outlet ("Toko Utama") — Solusi gotcha SQL NULL (Blueprint Refinement)
      const defaultOutlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: 'Toko Utama',
          isMainBranch: true,
          phone: phone || null,
        },
      });

      // 3. Buat atau hubungkan User Owner
      let ownerUser = existingUser;
      if (!ownerUser) {
        ownerUser = await tx.user.create({
          data: {
            tenantId: tenant.id,
            outletId: defaultOutlet.id,
            name: ownerName,
            email: cleanEmail,
            phone: phone || null,
            passwordHash,
            pinHash,
            role: 'OWNER',
          },
          include: { tenantOwnerships: true },
        });
      }

      // 4. Catat Kepemilikan Tenant (TenantOwnership)
      await tx.tenantOwnership.create({
        data: {
          userId: ownerUser.id,
          tenantId: tenant.id,
          isPrimary: !isAdditionalTenant,
          billingType: isAdditionalTenant ? 'ADDITIONAL_TENANT' : 'PRIMARY',
        },
      });

      // 5. Buat Kebijakan Otorisasi Awal (TenantAuthPolicy)
      await tx.tenantAuthPolicy.create({
        data: {
          tenantId: tenant.id,
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

      // 6. Buat Subscription Trial 15 Hari
      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          status: 'TRIAL',
          trialEndsAt,
          planType: 'PRO',
        },
      });

      // 7. Catat Audit Log registrasi
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          outletId: defaultOutlet.id,
          type: 'REGISTRATION',
          details: `Toko '${storeName}' berhasil didaftarkan dengan status TRIAL hingga ${trialEndsAt.toISOString().slice(0, 10)}.`,
          cashierName: ownerName,
          actorRole: 'OWNER',
          actorId: ownerUser.id,
        },
      });

      return { tenant, defaultOutlet, ownerUser, subscription };
    });

    // Buat UserSession & Token langsung agar user tidak perlu login ulang
    const refreshTokenId = crypto.randomUUID();
    const deviceFingerprint = (req.headers['x-device-fingerprint'] as string) || 'browser-register-device';
    const clientIp = (req.headers['cf-connecting-ip'] as string) || req.ip || '127.0.0.1';

    await prisma.userSession.create({
      data: {
        userId: result.ownerUser.id,
        tenantId: result.tenant.id,
        deviceFingerprint,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        refreshTokenId,
      },
    });

    const token = generateAppToken({
      userId: result.ownerUser.id,
      name: result.ownerUser.name,
      role: 'OWNER',
      tenantId: result.tenant.id,
      outletId: result.defaultOutlet.id,
      sessionId: refreshTokenId,
    });

    // Set Host-Only Cookie untuk app.kasirio.com
    res.cookie('kasirio_app_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(201).json({
      success: true,
      token,
      refreshToken: refreshTokenId,
      user: {
        id: result.ownerUser.id,
        name: result.ownerUser.name,
        role: result.ownerUser.role,
        tenantId: result.tenant.id,
        tenantName: result.tenant.name,
        outletId: result.defaultOutlet.id,
        outletName: result.defaultOutlet.name,
        trialEndsAt: result.subscription.trialEndsAt,
      },
    });
  } catch (error: any) {
    console.error('[Register Tenant Error]:', error);
    return res.status(500).json({ error: 'Gagal mendaftarkan toko baru.', details: error.message });
  }
});

/**
 * POST /api/app/auth/login
 * Login Staf Bisnis (Owner / Admin / Kasir) di app.kasirio.com
 */
appAuthRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier, password, pin, deviceFingerprint = 'web-client' } = req.body;

    if (!identifier || (!password && !pin)) {
      return res.status(400).json({ error: 'Identitas (email/telepon) dan Password atau PIN wajib diisi.' });
    }

    const cleanIdentifier = identifier.includes('@') ? normalizeEmail(identifier) : identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
      },
      include: {
        tenant: true,
        outlet: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Kredensial tidak ditemukan atau akun belum terdaftar.' });
    }

    // Verifikasi password atau PIN
    let isMatch = false;
    if (password && user.passwordHash) {
      isMatch = await verifySecret(password, user.passwordHash);
    } else if (pin && user.pinHash) {
      isMatch = await verifySecret(pin, user.pinHash);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Password atau PIN salah.' });
    }

    // Blueprint Bagian 7.1: Validasi Batas Concurrent Sessions
    const sessionCheck = await checkConcurrentSessionLimit(user.tenantId, deviceFingerprint);
    if (!sessionCheck.allowed) {
      return res.status(403).json({
        error: `Batas perangkat aktif (${sessionCheck.maxAllowed} perangkat) untuk toko Anda telah tercapai. Silakan logout dari perangkat lain untuk login di sini.`,
      });
    }

    // Pastikan user memiliki outlet default jika belum tersambung
    let outletId = user.outletId;
    if (!outletId) {
      const mainOutlet = await prisma.outlet.findFirst({
        where: { tenantId: user.tenantId, isMainBranch: true },
      });
      outletId = mainOutlet?.id || (await prisma.outlet.findFirst({ where: { tenantId: user.tenantId } }))?.id || '';
    }

    // Buat Sesi Baru
    const refreshTokenId = crypto.randomUUID();
    const clientIp = (req.headers['cf-connecting-ip'] as string) || req.ip || '127.0.0.1';

    await prisma.userSession.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        deviceFingerprint,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        refreshTokenId,
      },
    });

    const token = generateAppToken({
      userId: user.id,
      name: user.name,
      role: user.role as any,
      tenantId: user.tenantId,
      outletId: outletId!,
      sessionId: refreshTokenId,
    });

    // Set Host-Only Cookie
    res.cookie('kasirio_app_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.json({
      success: true,
      token,
      refreshToken: refreshTokenId,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        outletId,
        outletName: user.outlet?.name || 'Toko Utama',
      },
    });
  } catch (error: any) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ error: 'Gagal memproses login.', details: error.message });
  }
});

/**
 * POST /api/app/auth/logout
 * Cabut sesi pengguna di server (Token Revocation)
 */
appAuthRouter.post('/logout', authenticateApp, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.sessionId) {
      await prisma.userSession.updateMany({
        where: { refreshTokenId: req.user.sessionId },
        data: { isRevoked: true },
      });
    }

    res.clearCookie('kasirio_app_token', { path: '/' });
    return res.json({ success: true, message: 'Logout berhasil, sesi telah dicabut.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Gagal memproses logout.', details: error.message });
  }
});
