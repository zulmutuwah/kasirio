import { Router, Response } from 'express';
import { prisma } from '../prisma';
import {
  authenticateToken,
  AuthenticatedRequest,
  hashSecret,
  KASIRIO_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveUserPermissions,
} from '../auth';

export const userRouter = Router();

// Semua endpoint wajib membawa token otentikasi
userRouter.use(authenticateToken);

/**
 * GET /api/users - Daftar staf & pengguna dalam satu tenant
 */
userRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID tidak terdeteksi.' });
    }

    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        outlet: { select: { id: true, name: true } },
        permissionOverrides: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const sanitizedUsers = users.map((u) => {
      const resolved = resolveUserPermissions(u.role, u.permissionOverrides);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        email: u.email,
        phone: u.phone,
        outletId: u.outletId,
        outletName: u.outlet ? u.outlet.name : 'Seluruh Cabang (Pusat)',
        createdAt: u.createdAt,
        permissions: resolved,
        overrideCount: u.permissionOverrides.length,
      };
    });

    return res.json({
      success: true,
      users: sanitizedUsers,
    });
  } catch (error: any) {
    console.error('[User Router GET /]:', error);
    return res.status(500).json({ error: 'Gagal mengambil daftar pengguna.' });
  }
});

/**
 * POST /api/users - Tambah kasir atau admin toko baru
 */
userRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const actorRole = req.user?.role;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID tidak terdeteksi.' });
    }

    // Hanya Owner atau Admin Toko yang boleh menambah user
    if (!['OWNER', 'ADMIN', 'DEVELOPER', 'SUPER_ADMIN'].includes(actorRole as string)) {
      return res.status(403).json({ error: 'Hanya Pemilik Toko atau Admin yang dapat menambah karyawan.' });
    }

    const {
      name,
      role = 'CASHIER',
      outletId = null,
      phone,
      email,
      pin = '123456',
      password,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nama karyawan wajib diisi.' });
    }

    // Validasi role: tidak boleh membuat akun Owner baru atau Platform role via endpoint ini
    const allowedNewRoles = ['ADMIN', 'CASHIER'];
    if (!allowedNewRoles.includes(role)) {
      return res.status(400).json({
        error: `Role '${role}' tidak diizinkan. Hanya 'ADMIN' (Admin Toko) atau 'CASHIER' (Kasir) yang dapat ditambahkan.`,
      });
    }

    // Hash PIN kasir & password
    const pinHash = await hashSecret(String(pin));
    const passwordHash = password ? await hashSecret(password) : null;

    const newUser = await prisma.user.create({
      data: {
        tenantId,
        outletId: outletId || null,
        name,
        role,
        phone: phone || null,
        email: email || null,
        pinHash,
        passwordHash,
      },
      include: {
        outlet: { select: { id: true, name: true } },
      },
    });

    // Catat ke AuditLog
    await prisma.auditLog.create({
      data: {
        tenantId,
        outletId: outletId || null,
        type: 'USER_CREATED',
        details: `Karyawan baru '${name}' (${role}) ditambahkan oleh ${req.user?.name}.`,
        cashierName: req.user?.name || 'Owner',
        actorRole: req.user?.role,
        actorId: req.user?.userId,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Karyawan '${name}' berhasil ditambahkan.`,
      user: {
        id: newUser.id,
        name: newUser.name,
        role: newUser.role,
        outletId: newUser.outletId,
        outletName: newUser.outlet ? newUser.outlet.name : 'Seluruh Cabang (Pusat)',
        phone: newUser.phone,
        email: newUser.email,
      },
    });
  } catch (error: any) {
    console.error('[User Router POST /]:', error);
    return res.status(500).json({ error: 'Gagal menambahkan karyawan baru.' });
  }
});

/**
 * PUT /api/users/:id - Edit profil, role, atau cabang karyawan
 */
userRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const actorRole = req.user?.role;
    const targetUserId = req.params.id;

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });
    }

    // Batasan: Admin tidak dapat mengedit akun Owner
    if (targetUser.role === 'OWNER' && actorRole !== 'OWNER' && actorRole !== 'DEVELOPER') {
      return res.status(403).json({ error: 'Akun Pemilik Toko (Owner) hanya dapat diubah oleh Owner itu sendiri.' });
    }

    const { name, role, outletId, phone, email, pin, password } = req.body;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (phone !== undefined) dataToUpdate.phone = phone || null;
    if (email !== undefined) dataToUpdate.email = email || null;
    if (outletId !== undefined) dataToUpdate.outletId = outletId || null;

    // Hanya Owner yang boleh mengubah role
    if (role && role !== targetUser.role) {
      if (actorRole !== 'OWNER' && actorRole !== 'DEVELOPER') {
        return res.status(403).json({ error: 'Hanya Owner yang dapat mengubah peran (role) pengguna.' });
      }
      if (targetUser.role === 'OWNER') {
        return res.status(400).json({ error: 'Peran Owner tidak dapat diubah ke peran lain.' });
      }
      dataToUpdate.role = role;
    }

    if (pin) {
      dataToUpdate.pinHash = await hashSecret(String(pin));
    }
    if (password) {
      dataToUpdate.passwordHash = await hashSecret(password);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: dataToUpdate,
      include: { outlet: { select: { id: true, name: true } } },
    });

    return res.json({
      success: true,
      message: `Data karyawan '${updatedUser.name}' berhasil diperbarui.`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role,
        outletId: updatedUser.outletId,
        outletName: updatedUser.outlet ? updatedUser.outlet.name : 'Seluruh Cabang (Pusat)',
        phone: updatedUser.phone,
        email: updatedUser.email,
      },
    });
  } catch (error: any) {
    console.error('[User Router PUT /:id]:', error);
    return res.status(500).json({ error: 'Gagal memperbarui data karyawan.' });
  }
});

/**
 * DELETE /api/users/:id - Hapus akun karyawan
 */
userRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const actorRole = req.user?.role;
    const targetUserId = req.params.id;

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan.' });
    }

    // ATURAN MUTLAK: Akun Owner tidak dapat dihapus oleh siapapun
    if (targetUser.role === 'OWNER') {
      return res.status(403).json({ error: 'Akun Pemilik Toko (Owner) adalah akun utama dan TIDAK DAPAT dihapus.' });
    }

    if (actorRole !== 'OWNER' && actorRole !== 'DEVELOPER') {
      return res.status(403).json({ error: 'Hanya Pemilik Toko (Owner) yang dapat menghapus karyawan.' });
    }

    await prisma.user.delete({
      where: { id: targetUserId },
    });

    // Catat ke AuditLog
    await prisma.auditLog.create({
      data: {
        tenantId: tenantId!,
        outletId: targetUser.outletId,
        type: 'USER_DELETED',
        details: `Karyawan '${targetUser.name}' (${targetUser.role}) dihapus oleh ${req.user?.name}.`,
        cashierName: req.user?.name || 'Owner',
        actorRole: req.user?.role,
        actorId: req.user?.userId,
      },
    });

    return res.json({
      success: true,
      message: `Karyawan '${targetUser.name}' berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error('[User Router DELETE /:id]:', error);
    return res.status(500).json({ error: 'Gagal menghapus karyawan.' });
  }
});

/**
 * GET /api/users/:id/permissions - Tinjau permission & override pengguna
 */
userRouter.get('/:id/permissions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const targetUserId = req.params.id;

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      include: { permissionOverrides: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[targetUser.role] || [];
    const resolved = resolveUserPermissions(targetUser.role, targetUser.permissionOverrides);

    return res.json({
      success: true,
      role: targetUser.role,
      allPermissionsCatalog: Object.values(KASIRIO_PERMISSIONS),
      defaultPermissions: defaultPerms,
      overrides: targetUser.permissionOverrides,
      resolvedPermissions: resolved,
    });
  } catch (error: any) {
    console.error('[User Router GET /:id/permissions]:', error);
    return res.status(500).json({ error: 'Gagal mengambil data permission.' });
  }
});

/**
 * POST /api/users/:id/permissions/override - Pasang override GRANT atau REVOKE
 */
userRouter.post('/:id/permissions/override', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const actorRole = req.user?.role;
    const targetUserId = req.params.id;

    if (actorRole !== 'OWNER' && actorRole !== 'DEVELOPER') {
      return res.status(403).json({ error: 'Hanya Pemilik Toko (Owner) yang dapat mengatur hak akses spesifik karyawan.' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    if (targetUser.role === 'OWNER') {
      return res.status(400).json({ error: 'Pemilik Toko (Owner) memiliki seluruh hak akses secara permanen dan tidak dapat diubah.' });
    }

    const { permission, type } = req.body; // type: 'GRANT' | 'REVOKE' | 'RESET'

    if (!permission || !type) {
      return res.status(400).json({ error: 'Field permission dan type (GRANT/REVOKE/RESET) wajib diisi.' });
    }

    if (type === 'RESET') {
      // Hapus override jika kembali ke default
      await prisma.userPermissionOverride.deleteMany({
        where: {
          userId: targetUserId,
          permission,
        },
      });
    } else if (type === 'GRANT' || type === 'REVOKE') {
      // Upsert override
      const existing = await prisma.userPermissionOverride.findFirst({
        where: { userId: targetUserId, permission },
      });

      if (existing) {
        await prisma.userPermissionOverride.update({
          where: { id: existing.id },
          data: { type },
        });
      } else {
        await prisma.userPermissionOverride.create({
          data: {
            userId: targetUserId,
            tenantId: tenantId!,
            outletId: targetUser.outletId,
            permission,
            type,
          },
        });
      }
    } else {
      return res.status(400).json({ error: "Type harus bernilai 'GRANT', 'REVOKE', atau 'RESET'." });
    }

    // Ambil ulang permissions ter-update
    const updatedOverrides = await prisma.userPermissionOverride.findMany({
      where: { userId: targetUserId },
    });
    const resolved = resolveUserPermissions(targetUser.role, updatedOverrides);

    return res.json({
      success: true,
      message: `Hak akses '${permission}' untuk ${targetUser.name} berhasil disetel ke '${type}'.`,
      overrides: updatedOverrides,
      resolvedPermissions: resolved,
    });
  } catch (error: any) {
    console.error('[User Router POST /:id/permissions/override]:', error);
    return res.status(500).json({ error: 'Gagal mengubah override hak akses.' });
  }
});
