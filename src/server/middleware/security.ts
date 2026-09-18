import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

/**
 * Normalisasi alamat email (Blueprint Bagian 7.2 - Anti Trial Abuse)
 * Menghilangkan tag '+alias' dan karakter titik khusus penyedia seperti Gmail
 */
export function normalizeEmail(rawEmail: string): string {
  if (!rawEmail || typeof rawEmail !== 'string') return '';
  const trimmed = rawEmail.trim().toLowerCase();
  const [localPart, domain] = trimmed.split('@');

  if (!domain) return trimmed;

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Hilangkan titik dan potong bagian setelah tanda '+'
    const cleanLocal = localPart.replace(/\./g, '').split('+')[0];
    return `${cleanLocal}@gmail.com`;
  }

  // Untuk domain lain, tetap potong tanda '+' alias jika ada
  const cleanLocal = localPart.split('+')[0];
  return `${cleanLocal}@${domain}`;
}

/**
 * In-memory sliding rate limiter untuk proteksi endpoint autentikasi
 */
interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function createRateLimiter(options: { windowMs: number; maxRequests: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Ambil IP dari Cloudflare (CF-Connecting-IP) atau Express remote IP
    const clientIp = (req.headers['cf-connecting-ip'] as string) || req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.path}:${clientIp}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record) {
      rateLimitStore.set(key, { count: 1, firstRequestTime: now });
      return next();
    }

    if (now - record.firstRequestTime > options.windowMs) {
      // Window telah kedaluwarsa, reset
      rateLimitStore.set(key, { count: 1, firstRequestTime: now });
      return next();
    }

    record.count += 1;
    if (record.count > options.maxRequests) {
      return res.status(429).json({
        error: options.message,
        retryAfterSeconds: Math.ceil((record.firstRequestTime + options.windowMs - now) / 1000),
      });
    }

    next();
  };
}

/**
 * Validasi batas sesi login bersamaan (Blueprint Bagian 7.1 - Anti Account Sharing)
 * Menolak login baru jika batas concurrent sessions tercapai
 */
export async function checkConcurrentSessionLimit(
  tenantId: string,
  deviceFingerprint: string
): Promise<{ allowed: boolean; maxAllowed: number; activeCount: number }> {
  // Ambil batas dari SystemConfig atau default ke 3 untuk tier starter
  const config = await prisma.systemConfig.findUnique({
    where: { key: 'max_concurrent_sessions_default' },
  });

  const maxAllowed = config ? parseInt(config.value, 10) : 3;

  // Cek apakah device fingerprint ini sudah punya sesi aktif (jika ya, izinkan login ulang)
  const existingDeviceSession = await prisma.userSession.findFirst({
    where: {
      tenantId,
      deviceFingerprint,
      isRevoked: false,
    },
  });

  if (existingDeviceSession) {
    return { allowed: true, maxAllowed, activeCount: 1 };
  }

  // Hitung jumlah sesi aktif yang belum dicabut
  const activeCount = await prisma.userSession.count({
    where: {
      tenantId,
      isRevoked: false,
    },
  });

  if (activeCount >= maxAllowed) {
    return { allowed: false, maxAllowed, activeCount };
  }

  return { allowed: true, maxAllowed, activeCount };
}
