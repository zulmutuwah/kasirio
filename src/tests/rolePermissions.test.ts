import { describe, it, expect } from 'vitest';
import {
  KASIRIO_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveUserPermissions,
  PermissionOverrideItem,
} from '../server/auth';

describe('Kasirio Role & Permission Engine (RBAC/PBAC)', () => {
  it('memberikan seluruh hak akses (full permissions) kepada role OWNER, DEVELOPER, dan SUPER_ADMIN', () => {
    const allPerms = Object.values(KASIRIO_PERMISSIONS);

    const ownerPerms = resolveUserPermissions('OWNER');
    expect(ownerPerms.length).toBe(allPerms.length);
    expect(ownerPerms).toEqual(expect.arrayContaining([
      KASIRIO_PERMISSIONS.PRODUCT_DELETE,
      KASIRIO_PERMISSIONS.USER_MANAGE,
      KASIRIO_PERMISSIONS.STORE_MANAGE,
    ]));

    const devPerms = resolveUserPermissions('DEVELOPER');
    expect(devPerms.length).toBe(allPerms.length);

    const superAdminPerms = resolveUserPermissions('SUPER_ADMIN');
    expect(superAdminPerms.length).toBe(allPerms.length);
  });

  it('memberikan hak akses operasional kepada ADMIN TOKO namun membatasi store.manage', () => {
    const adminPerms = resolveUserPermissions('ADMIN');

    expect(adminPerms).toContain(KASIRIO_PERMISSIONS.PRODUCT_CREATE);
    expect(adminPerms).toContain(KASIRIO_PERMISSIONS.STOCK_ADJUST);
    expect(adminPerms).toContain(KASIRIO_PERMISSIONS.REPORT_VIEW);
    expect(adminPerms).toContain(KASIRIO_PERMISSIONS.USER_MANAGE);

    // Admin tidak memiliki store.manage (hanya Owner)
    expect(adminPerms).not.toContain(KASIRIO_PERMISSIONS.STORE_MANAGE);
    expect(adminPerms).not.toContain(KASIRIO_PERMISSIONS.OUTLET_MANAGE);
  });

  it('memberikan hak akses kasir terbatas kepada role CASHIER', () => {
    const cashierPerms = resolveUserPermissions('CASHIER');

    expect(cashierPerms).toContain(KASIRIO_PERMISSIONS.TRANSACTION_CREATE);
    expect(cashierPerms).toContain(KASIRIO_PERMISSIONS.PAYMENT_PROCESS);
    expect(cashierPerms).toContain(KASIRIO_PERMISSIONS.CASHSESSION_OPEN);
    expect(cashierPerms).toContain(KASIRIO_PERMISSIONS.DRAWER_KICK);

    // Kasir tidak boleh hapus produk atau kelola user
    expect(cashierPerms).not.toContain(KASIRIO_PERMISSIONS.PRODUCT_DELETE);
    expect(cashierPerms).not.toContain(KASIRIO_PERMISSIONS.USER_MANAGE);
    expect(cashierPerms).not.toContain(KASIRIO_PERMISSIONS.REPORT_VIEW);
  });

  it('berhasil menerapkan model GRANT override (memberikan izin di luar default role)', () => {
    // Kasir default tidak punya izin payment.refund
    const defaultCashier = resolveUserPermissions('CASHIER');
    expect(defaultCashier).not.toContain(KASIRIO_PERMISSIONS.PAYMENT_REFUND);

    // Berikan GRANT override khusus
    const overrides: PermissionOverrideItem[] = [
      { permission: KASIRIO_PERMISSIONS.PAYMENT_REFUND, type: 'GRANT' },
    ];
    const grantedCashier = resolveUserPermissions('CASHIER', overrides);

    expect(grantedCashier).toContain(KASIRIO_PERMISSIONS.PAYMENT_REFUND);
    expect(grantedCashier).toContain(KASIRIO_PERMISSIONS.TRANSACTION_CREATE);
  });

  it('berhasil menerapkan model REVOKE override (mencabut izin bawaan role)', () => {
    // Admin default punya izin product.delete
    const defaultAdmin = resolveUserPermissions('ADMIN');
    expect(defaultAdmin).toContain(KASIRIO_PERMISSIONS.PRODUCT_DELETE);

    // Cabut izin dengan REVOKE override
    const overrides: PermissionOverrideItem[] = [
      { permission: KASIRIO_PERMISSIONS.PRODUCT_DELETE, type: 'REVOKE' },
    ];
    const revokedAdmin = resolveUserPermissions('ADMIN', overrides);

    expect(revokedAdmin).not.toContain(KASIRIO_PERMISSIONS.PRODUCT_DELETE);
    expect(revokedAdmin).toContain(KASIRIO_PERMISSIONS.PRODUCT_CREATE); // Izin lain tetap aktif
  });

  it('memastikan Owner tetap memiliki izin penuh meskipun ada upaya override REVOKE', () => {
    // Owner tidak dapat dibatasi oleh override apapun
    const overrides: PermissionOverrideItem[] = [
      { permission: KASIRIO_PERMISSIONS.PRODUCT_DELETE, type: 'REVOKE' },
      { permission: KASIRIO_PERMISSIONS.USER_MANAGE, type: 'REVOKE' },
    ];
    const protectedOwner = resolveUserPermissions('OWNER', overrides);

    expect(protectedOwner).toContain(KASIRIO_PERMISSIONS.PRODUCT_DELETE);
    expect(protectedOwner).toContain(KASIRIO_PERMISSIONS.USER_MANAGE);
  });
});
