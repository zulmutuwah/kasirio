import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'kasirio-fallback-dev-secret-key-2026';

export interface AuthUserPayload {
  userId: string;
  name: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  tenantId: string;
  outletId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
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
export function requireRole(allowedRoles: ('OWNER' | 'MANAGER' | 'CASHIER')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Pengguna belum terotentikasi.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses ditolak. Peran '${req.user.role}' tidak memiliki otorisasi untuk tindakan ini.`,
      });
    }

    next();
  };
}
