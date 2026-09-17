import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirio-fallback-dev-secret-key-2026';

export type PlatformRole = 'DEVELOPER' | 'SUPER_ADMIN';
export type TenantRole = 'OWNER' | 'ADMIN' | 'CASHIER';
export type KasirioRole = PlatformRole | TenantRole | 'MANAGER'; // MANAGER = alias legacy untuk ADMIN

export interface AuthUserPayload {
  userId: string;
  name: string;
  role: KasirioRole;
  tenantId: string;
  outletId?: string | null;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

/**
 * Katalog Permission Resmi Kasirio (RBAC/PBAC)
 * Mengacu pada docs/KASIRIO_ROLE_PERMISSION_AGENT_PROMPT_v1.0.md
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
 * Owner, Developer, Super Admin selalu mempertahankan izin penuh.
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

export function generateToken(payload: AuthUserPayload, expiresIn: any = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(secret, salt);
}

export async function verifySecret(secret: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(secret, hashed);
}

/**
 * Middleware untuk memastikan request membawa JWT Token yang valid
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Token otentikasi tidak ditemukan.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ error: 'Token tidak valid atau telah kedaluwarsa.' });
    }
    req.user = decoded as AuthUserPayload;
    next();
  });
}

/**
 * Middleware untuk membatasi akses endpoint berdasarkan peran (RBAC)
 */
export function requireRole(allowedRoles: KasirioRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Pengguna belum terotentikasi.' });
    }

    // Role mapping: MANAGER dianggap sama dengan ADMIN
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
 * Middleware untuk membatasi akses endpoint berdasarkan permission spesifik (PBAC)
 */
export function requirePermission(requiredPermission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Pengguna belum terotentikasi.' });
    }

    // Owner, Developer, Super Admin selalu lolos
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
