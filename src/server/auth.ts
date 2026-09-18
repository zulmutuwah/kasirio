import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Signing keys terpisah per realm untuk defense-in-depth (Blueprint Bagian 1 & 6)
export const JWT_APP_SECRET = process.env.JWT_APP_SECRET || process.env.JWT_SECRET || 'kasirio-app-secret-realm-2026';
export const JWT_OFFICE_SECRET = process.env.JWT_OFFICE_SECRET || 'kasirio-office-secret-realm-2026';

export type PlatformRole = 'DEVELOPER' | 'SUPER_ADMIN';
export type TenantRole = 'OWNER' | 'ADMIN' | 'CASHIER';
export type KasirioRole = PlatformRole | TenantRole | 'MANAGER'; // MANAGER = alias legacy untuk ADMIN

export interface AuthUserPayload {
  userId: string;
  name: string;
  role: KasirioRole;
  tenantId: string;
  outletId: string; // Wajib non-null sesuai pencegahan gotcha SQL
  permissions?: string[];
  sessionId?: string;
  aud?: 'app' | 'office';
  isMfaVerified?: boolean;
  isBreakGlass?: boolean;
  breakGlassJustification?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

/**
 * Katalog Permission Resmi Kasirio (RBAC/PBAC)
 * Mengacu pada Blueprint v1.0 Bagian 2
 */
export const KASIRIO_PERMISSIONS = {
  // Produk & Katalog
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',

  // Stok & Inventori
  STOCK_ADJUST: 'stock.adjust',
  STOCK_TRANSFER: 'stock.transfer',

  // Transaksi & Kasir
  TRANSACTION_CREATE: 'transaction.create',
  TRANSACTION_REFUND: 'transaction.refund',
  PAYMENT_PROCESS: 'payment.process',
  PAYMENT_REFUND: 'payment.refund',
  CASHSESSION_OPEN: 'cashSession.open',
  CASHSESSION_CLOSE: 'cashSession.close',
  DRAWER_KICK: 'drawer.kick',

  // Laporan & Ekspor Data
  REPORT_VIEW: 'report.view',
  CUSTOMER_EXPORT: 'customer.export',

  // Manajemen Pengguna & Toko
  USER_MANAGE: 'user.manage',
  STORE_MANAGE: 'store.manage',
  OUTLET_MANAGE: 'outlet.manage',
} as const;

/**
 * Default Permissions per Role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  DEVELOPER: Object.values(KASIRIO_PERMISSIONS),
  SUPER_ADMIN: Object.values(KASIRIO_PERMISSIONS),
  OWNER: Object.values(KASIRIO_PERMISSIONS),
  ADMIN: [
    KASIRIO_PERMISSIONS.PRODUCT_CREATE,
    KASIRIO_PERMISSIONS.PRODUCT_UPDATE,
    KASIRIO_PERMISSIONS.PRODUCT_DELETE,
    KASIRIO_PERMISSIONS.STOCK_ADJUST,
    KASIRIO_PERMISSIONS.STOCK_TRANSFER,
    KASIRIO_PERMISSIONS.TRANSACTION_CREATE,
    KASIRIO_PERMISSIONS.TRANSACTION_REFUND,
    KASIRIO_PERMISSIONS.PAYMENT_PROCESS,
    KASIRIO_PERMISSIONS.PAYMENT_REFUND,
    KASIRIO_PERMISSIONS.CASHSESSION_OPEN,
    KASIRIO_PERMISSIONS.CASHSESSION_CLOSE,
    KASIRIO_PERMISSIONS.DRAWER_KICK,
    KASIRIO_PERMISSIONS.REPORT_VIEW,
    KASIRIO_PERMISSIONS.CUSTOMER_EXPORT,
    KASIRIO_PERMISSIONS.USER_MANAGE,
  ],
  MANAGER: [
    // Alias untuk ADMIN
    KASIRIO_PERMISSIONS.PRODUCT_CREATE,
    KASIRIO_PERMISSIONS.PRODUCT_UPDATE,
    KASIRIO_PERMISSIONS.PRODUCT_DELETE,
    KASIRIO_PERMISSIONS.STOCK_ADJUST,
    KASIRIO_PERMISSIONS.STOCK_TRANSFER,
    KASIRIO_PERMISSIONS.TRANSACTION_CREATE,
    KASIRIO_PERMISSIONS.TRANSACTION_REFUND,
    KASIRIO_PERMISSIONS.PAYMENT_PROCESS,
    KASIRIO_PERMISSIONS.PAYMENT_REFUND,
    KASIRIO_PERMISSIONS.CASHSESSION_OPEN,
    KASIRIO_PERMISSIONS.CASHSESSION_CLOSE,
    KASIRIO_PERMISSIONS.DRAWER_KICK,
    KASIRIO_PERMISSIONS.REPORT_VIEW,
    KASIRIO_PERMISSIONS.CUSTOMER_EXPORT,
    KASIRIO_PERMISSIONS.USER_MANAGE,
  ],
  CASHIER: [
    KASIRIO_PERMISSIONS.TRANSACTION_CREATE,
    KASIRIO_PERMISSIONS.PAYMENT_PROCESS,
    KASIRIO_PERMISSIONS.CASHSESSION_OPEN,
    KASIRIO_PERMISSIONS.CASHSESSION_CLOSE,
    KASIRIO_PERMISSIONS.DRAWER_KICK,
    KASIRIO_PERMISSIONS.TRANSACTION_REFUND,
  ],
};

export interface PermissionOverrideItem {
  permission: string;
  type: 'GRANT' | 'REVOKE' | string;
}

/**
 * Resolusi Akhir Permission Pengguna:
 * Final Permissions = (Default Role Permissions) + (Grants) - (Revokes)
 */
export function resolveUserPermissions(
  role: string,
  overrides: PermissionOverrideItem[] = []
): string[] {
  if (role === 'OWNER' || role === 'DEVELOPER' || role === 'SUPER_ADMIN') {
    return Object.values(KASIRIO_PERMISSIONS);
  }

  const resolved = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role] || []);

  for (const item of overrides) {
    if (item.type === 'GRANT') {
      resolved.add(item.permission);
    } else if (item.type === 'REVOKE') {
      resolved.delete(item.permission);
    }
  }

  return Array.from(resolved);
}

/**
 * Penerbitan Token App Realm (app.kasirio.com)
 * aud: "app", masa berlaku pendek (15m - 24h)
 */
export function generateAppToken(payload: Omit<AuthUserPayload, 'aud'>, expiresIn: any = '15m'): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    audience: 'app',
    expiresIn,
  };
  return jwt.sign(payload, JWT_APP_SECRET, options);
}

/**
 * Penerbitan Token Office Realm (office.kasirio.com)
 * aud: "office", masa berlaku pendek (15m - 1h), wajib MFA
 */
export function generateOfficeToken(
  payload: Omit<AuthUserPayload, 'aud'>,
  expiresIn: any = '15m',
  isBreakGlass = false,
  justification?: string
): string {
  const fullPayload = {
    ...payload,
    isBreakGlass,
    breakGlassJustification: justification,
  };

  const options: SignOptions = {
    algorithm: 'HS256',
    audience: 'office',
    expiresIn: isBreakGlass ? '30m' : expiresIn, // Break glass strict max 30 mins
  };

  return jwt.sign(fullPayload, JWT_OFFICE_SECRET, options);
}

/**
 * Legacy generator untuk kompatibilitas ke belakang
 */
export function generateToken(payload: AuthUserPayload, expiresIn: any = '7d'): string {
  return generateAppToken(payload, expiresIn);
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(secret, salt);
}

export async function verifySecret(secret: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(secret, hashed);
}

/**
 * Ekstraksi token dari Authorization Bearer header atau Host-Only Cookie
 */
function extractToken(req: Request, cookieName: string): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // Cookie fallback (jika cookie-parser aktif atau dari req.headers.cookie)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=');
        return [k, decodeURIComponent(v.join('='))];
      })
    );
    if (cookies[cookieName]) {
      return cookies[cookieName];
    }
  }
  return null;
}

/**
 * Middleware Otorisasi App Realm (api.kasirio.com/api/app/*)
 * Memvalidasi aud: "app", signing key JWT_APP_SECRET, algoritma HS256
 */
export function authenticateApp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req, 'kasirio_app_token');

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Token otentikasi aplikasi kasir tidak ditemukan.' });
  }

  const verifyOpts: VerifyOptions = {
    algorithms: ['HS256'],
    audience: 'app',
  };

  jwt.verify(token, JWT_APP_SECRET, verifyOpts, (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Token aplikasi tidak valid, audiens salah, atau telah kedaluwarsa.' });
    }
    const userPayload = decoded as AuthUserPayload;
    if (!['OWNER', 'ADMIN', 'CASHIER', 'MANAGER'].includes(userPayload.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Peran tidak diizinkan di modul app.' });
    }
    req.user = userPayload;
    next();
  });
}

/**
 * Middleware Otorisasi Office Realm (api.kasirio.com/api/office/*)
 * Memvalidasi aud: "office", signing key JWT_OFFICE_SECRET, algoritma HS256
 * Wajib role DEVELOPER atau SUPER_ADMIN, serta cek MFA
 */
export function authenticateOffice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req, 'kasirio_office_token');

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Token otentikasi platform office tidak ditemukan.' });
  }

  const verifyOpts: VerifyOptions = {
    algorithms: ['HS256'],
    audience: 'office',
  };

  jwt.verify(token, JWT_OFFICE_SECRET, verifyOpts, (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Token platform office tidak valid, bukan audiens office, atau telah kedaluwarsa.' });
    }
    const userPayload = decoded as AuthUserPayload;
    if (!['DEVELOPER', 'SUPER_ADMIN'].includes(userPayload.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Endpoint khusus staf internal platform (Developer/Super Admin).' });
    }
    // Blueprint Bagian 2.1 & 5.5: Staf platform wajib status MFA terverifikasi (kecuali sesi break-glass darurat)
    if (!userPayload.isMfaVerified && !userPayload.isBreakGlass) {
      return res.status(403).json({ error: 'Akses ditolak. Otentikasi dua faktor (MFA) wajib untuk platform office.' });
    }

    req.user = userPayload;
    next();
  });
}

/**
 * Middleware umum backward compatibility
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Coba verifikasi dengan app secret terlebih dahulu, lalu office secret jika gagal
  const token = extractToken(req, 'kasirio_app_token') || extractToken(req, 'kasirio_office_token');

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Token otentikasi tidak ditemukan.' });
  }

  jwt.verify(token, JWT_APP_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
    if (!err && decoded) {
      req.user = decoded as AuthUserPayload;
      return next();
    }
    jwt.verify(token, JWT_OFFICE_SECRET, { algorithms: ['HS256'] }, (err2, decoded2) => {
      if (!err2 && decoded2) {
        req.user = decoded2 as AuthUserPayload;
        return next();
      }
      return res.status(403).json({ error: 'Token tidak valid atau telah kedaluwarsa.' });
    });
  });
}

/**
 * Middleware RBAC
 */
export function requireRole(allowedRoles: KasirioRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Pengguna belum terotentikasi.' });
    }

    const userRole = req.user.role === 'MANAGER' ? 'ADMIN' : req.user.role;
    const normalizedAllowed = allowedRoles.map((r) => (r === 'MANAGER' ? 'ADMIN' : r));

    if (!normalizedAllowed.includes(userRole as any)) {
      return res.status(403).json({
        error: `Akses ditolak. Peran '${req.user.role}' tidak memiliki otorisasi untuk tindakan ini.`,
      });
    }

    next();
  };
}

/**
 * Middleware PBAC
 */
export function requirePermission(requiredPermission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Pengguna belum terotentikasi.' });
    }

    if (['OWNER', 'DEVELOPER', 'SUPER_ADMIN'].includes(req.user.role)) {
      return next();
    }

    const userPerms = req.user.permissions || DEFAULT_ROLE_PERMISSIONS[req.user.role] || [];
    if (!userPerms.includes(requiredPermission)) {
      return res.status(403).json({
        error: `Akses ditolak. Tindakan ini memerlukan izin '${requiredPermission}'.`,
      });
    }

    next();
  };
}
