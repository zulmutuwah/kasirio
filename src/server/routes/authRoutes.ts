import { Router, Response } from 'express';
import { prisma } from '../prisma';
import {
  generateToken,
  hashSecret,
  verifySecret,
  authenticateToken,
  AuthenticatedRequest,
} from '../auth';

export const authRouter = Router();

// POST /api/auth/register-tenant - Registrasi Toko Baru & Akun Owner
authRouter.post('/register-tenant', async (req, res) => {
  try {
    const { tenantName, businessType = 'RETAIL', ownerName, email, password, pin = '123456' } = req.body;

    if (!tenantName || !ownerName || !email || !password) {
      return res.status(400).json({ error: 'Nama toko, nama pemilik, email, dan kata sandi wajib diisi.' });
    }

    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar. Silakan gunakan email lain.' });
    }

    // Buat slug unik
    const baseSlug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const passwordHash = await hashSecret(password);
    const pinHash = await hashSecret(pin);

    // Atomic transaction: Buat Tenant, Outlet Pusat, dan Owner User
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug,
          businessType,
        },
      });

      const mainOutlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: `${tenantName} - Cabang Utama`,
          isMainBranch: true,
        },
      });

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          outletId: mainOutlet.id,
          name: ownerName,
          email,
          passwordHash,
          pinHash,
          role: 'OWNER',
        },
      });

      // Default Kategori
      await tx.category.createMany({
        data: [
          { tenantId: tenant.id, name: 'Sembako & Pokok' },
          { tenantId: tenant.id, name: 'Makanan & Camilan' },
          { tenantId: tenant.id, name: 'Minuman' },
        ],
      });

      return { tenant, outlet: mainOutlet, owner };
    });

    const token = generateToken({
      userId: result.owner.id,
      name: result.owner.name,
      role: 'OWNER',
      tenantId: result.tenant.id,
      outletId: result.outlet.id,
    });

    res.status(201).json({
      message: 'Registrasi toko Kasirio berhasil.',
      token,
      tenant: result.tenant,
      outlet: result.outlet,
      user: {
        id: result.owner.id,
        name: result.owner.name,
        email: result.owner.email,
        role: result.owner.role,
      },
    });
  } catch (error: any) {
    console.error('[Auth Error]', error);
    res.status(500).json({ error: 'Gagal melakukan registrasi toko: ' + error.message });
  }
});

// POST /api/auth/login - Login via Email & Password
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true, outlet: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Email atau kata sandi salah.' });
    }

    const isMatch = await verifySecret(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email atau kata sandi salah.' });
    }

    const token = generateToken({
      userId: user.id,
      name: user.name,
      role: user.role as any,
      tenantId: user.tenantId,
      outletId: user.outletId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tenant: user.tenant,
      outlet: user.outlet,
    });
  } catch (error: any) {
    console.error('[Login Error]', error);
    res.status(500).json({ error: 'Terjadi kendala pada server saat login.' });
  }
});

// POST /api/auth/verify-pin - Otorisasi PIN POS (misal PIN Gate untuk void/diskon)
authRouter.post('/verify-pin', async (req, res) => {
  try {
    const { pin, tenantId, requiredRole } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN wajib diisi.' });
    }

    // Cari user pemilik atau manajer toko yang sesuai
    const users = await prisma.user.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(requiredRole ? { role: requiredRole } : {}),
      },
    });

    let authorizedUser = null;
    for (const u of users) {
      const match = await verifySecret(pin, u.pinHash);
      if (match) {
        authorizedUser = u;
        break;
      }
    }

    if (!authorizedUser) {
      return res.status(401).json({ success: false, error: 'PIN tidak valid atau tidak memiliki wewenang.' });
    }

    res.json({
      success: true,
      user: {
        id: authorizedUser.id,
        name: authorizedUser.name,
        role: authorizedUser.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Gagal memverifikasi PIN.' });
  }
});

// GET /api/auth/me - Dapatkan profil pengguna saat ini
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { tenant: true, outlet: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant: user.tenant,
      outlet: user.outlet,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal mengambil informasi profil.' });
  }
});
