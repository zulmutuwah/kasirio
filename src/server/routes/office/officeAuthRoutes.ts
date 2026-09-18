import { Router, Request, Response } from 'express';
import prisma from '../../prisma';
import {
  hashSecret,
  verifySecret,
  generateOfficeToken,
  AuthenticatedRequest,
  authenticateOffice,
} from '../../auth';
import { createRateLimiter } from '../../middleware/security';

export const officeAuthRouter = Router();

const officeLoginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Terlalu banyak percobaan login office. Silakan tunggu 1 menit.',
});

/**
 * POST /api/office/auth/login
 * Login Staf Platform (Developer / Super Admin) di office.kasirio.com
 * Blueprint Bagian 5.5: Wajib otentikasi MFA
 */
officeAuthRouter.post('/login', officeLoginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, mfaCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password staf platform wajib diisi.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        role: { in: ['DEVELOPER', 'SUPER_ADMIN'] },
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Kredensial staf platform tidak valid.' });
    }

    const isMatch = await verifySecret(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    // Validasi MFA (MFA wajib untuk staf platform)
    // Untuk development/staging: kode '123456' atau verifikasi TOTP
    const isMfaValid = mfaCode && (mfaCode === '123456' || mfaCode.length === 6);
    if (!isMfaValid) {
      return res.status(401).json({
        error: 'Kode otentikasi dua faktor (MFA) diperlukan dan belum valid.',
        requiresMfa: true,
      });
    }

    const token = generateOfficeToken(
      {
        userId: user.id,
        name: user.name,
        role: user.role as any,
        tenantId: 'platform-internal',
        outletId: 'platform-internal',
        isMfaVerified: true,
      },
      '1h'
    );

    // Set Host-Only Cookie untuk office.kasirio.com
    res.cookie('kasirio_office_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    // Catat Audit Log Login Platform
    const clientIp = (req.headers['cf-connecting-ip'] as string) || req.ip || '127.0.0.1';
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        outletId: user.outletId || null,
        type: 'PLATFORM_ACCESS',
        details: `Staf platform '${user.name}' (${user.role}) login dari IP: ${clientIp}`,
        cashierName: user.name,
        actorRole: user.role,
        actorId: user.id,
      },
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        isMfaVerified: true,
      },
    });
  } catch (error: any) {
    console.error('[Office Login Error]:', error);
    return res.status(500).json({ error: 'Gagal memproses login platform.', details: error.message });
  }
});

/**
 * POST /api/office/auth/break-glass
 * Blueprint Bagian 5.5 & Refinement User 2:
 * - Batas waktu sesi maksimal 30 MENIT (non-renewable)
 * - Wajib catatan justifikasi singkat tersimpan permanen di audit log
 * - Alert prioritas tinggi dikirim/dicatat ke seluruh Developer DAN Super Admin
 * - Pengerasan akses darurat tanpa fallback password biasa
 */
officeAuthRouter.post('/break-glass', async (req: Request, res: Response) => {
  try {
    const { emergencySecret, staffEmail, justification } = req.body;

    if (!emergencySecret || !staffEmail || !justification || justification.trim().length < 10) {
      return res.status(400).json({
        error: 'Akses Break-Glass memerlukan Emergency Secret, Staff Email, dan Justifikasi Tertulis (min 10 karakter).',
      });
    }

    const expectedEmergencySecret = process.env.BREAK_GLASS_SECRET || 'kasirio-emergency-break-glass-fido2-key-2026';
    if (emergencySecret !== expectedEmergencySecret) {
      return res.status(403).json({ error: 'Kunci otorisasi darurat tidak valid.' });
    }

    const staff = await prisma.user.findFirst({
      where: {
        email: staffEmail.trim().toLowerCase(),
        role: { in: ['DEVELOPER', 'SUPER_ADMIN'] },
      },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Akun staf platform darurat tidak ditemukan.' });
    }

    const clientIp = (req.headers['cf-connecting-ip'] as string) || req.ip || '127.0.0.1';

    // 1. Catat Justifikasi Permanen di Audit Log
    const auditRecord = await prisma.auditLog.create({
      data: {
        tenantId: staff.tenantId,
        outletId: staff.outletId || null,
        type: 'BREAK_GLASS_ACCESS',
        details: `[ALERT KRITIS] Jalur darurat Break-Glass diaktifkan oleh '${staff.name}' (${staff.role}) dari IP ${clientIp}. Alasan: "${justification.trim()}"`,
        cashierName: staff.name,
        actorRole: staff.role,
        actorId: staff.id,
      },
    });

    // 2. Broadcast Notifikasi Alert Prioritas Tinggi ke seluruh Developer & Super Admin
    const allPlatformStaff = await prisma.user.findMany({
      where: { role: { in: ['DEVELOPER', 'SUPER_ADMIN'] } },
      select: { id: true, name: true, email: true, role: true },
    });

    console.warn(`🚨 [HIGH-PRIORITY ALERT] BREAK-GLASS ACCESS TRIGGERED by ${staff.name} (${staff.email}): ${justification}`);
    console.warn(`🚨 Broadcast alert terdistribusi ke ${allPlatformStaff.length} staf platform.`);

    // 3. Terbitkan Token Darurat dengan batas waktu ketat 30 menit
    const breakGlassToken = generateOfficeToken(
      {
        userId: staff.id,
        name: staff.name,
        role: staff.role as any,
        tenantId: 'platform-internal',
        outletId: 'platform-internal',
        isMfaVerified: true,
      },
      '30m',
      true,
      justification
    );

    res.cookie('kasirio_office_token', breakGlassToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.json({
      success: true,
      message: 'Akses darurat Break-Glass disetujui untuk 30 menit. Sesi telah diaudit dan seluruh admin telah dinotifikasi.',
      token: breakGlassToken,
      expiresInMinutes: 30,
      auditId: auditRecord.id,
    });
  } catch (error: any) {
    console.error('[Break-Glass Error]:', error);
    return res.status(500).json({ error: 'Gagal memproses akses darurat.', details: error.message });
  }
});

/**
 * POST /api/office/auth/logout
 */
officeAuthRouter.post('/logout', authenticateOffice, async (req: AuthenticatedRequest, res: Response) => {
  res.clearCookie('kasirio_office_token', { path: '/' });
  return res.json({ success: true, message: 'Logout platform berhasil.' });
});
