import { describe, it, expect, beforeAll } from 'vitest';
import { hashSecret, verifySecret, generateToken } from '../server/auth';
import jwt from 'jsonwebtoken';
import { prisma } from '../server/prisma';

describe('2. Sub-Fase 2a: Multi-Tenant Database & Auth Test', () => {
  const testSecret = 'rahasia123';
  let hashedValue = '';

  it('harus melakukan hashing kata sandi / PIN dengan bcryptjs secara aman', async () => {
    hashedValue = await hashSecret(testSecret);
    expect(hashedValue).not.toBe(testSecret);
    expect(hashedValue.length).toBeGreaterThan(20);
  });

  it('harus memvalidasi kata sandi / PIN yang benar dan menolak yang salah', async () => {
    const isCorrect = await verifySecret(testSecret, hashedValue);
    const isWrong = await verifySecret('salah-pin', hashedValue);

    expect(isCorrect).toBe(true);
    expect(isWrong).toBe(false);
  });

  it('harus men-generate dan memverifikasi JWT token dengan payload multi-tenant', () => {
    const payload = {
      userId: 'user-test-123',
      name: 'Budi Owner',
      role: 'OWNER' as const,
      tenantId: 'tenant-kelontong-makmur',
      outletId: 'outlet-pusat',
    };

    const token = generateToken(payload, '1h');
    expect(typeof token).toBe('string');

    const decoded = jwt.decode(token) as any;
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.role).toBe('OWNER');
  });

  it('harus dapat membuat dan membaca entitas Tenant dan Outlet di Prisma', async () => {
    const testTenantId = `tenant-test-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        id: testTenantId,
        name: 'Toko Test Otomatis',
        slug: `toko-test-${Date.now()}`,
        businessType: 'RETAIL',
        outlets: {
          create: {
            name: 'Cabang Utama Test',
            isMainBranch: true,
          },
        },
      },
      include: { outlets: true },
    });

    expect(tenant.name).toBe('Toko Test Otomatis');
    expect(tenant.outlets.length).toBe(1);
    expect(tenant.outlets[0].isMainBranch).toBe(true);

    // Cleanup
    await prisma.tenant.delete({ where: { id: testTenantId } });
  });
});
