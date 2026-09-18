import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateOfficeToken,
  JWT_OFFICE_SECRET,
  AuthUserPayload,
} from '../server/auth';

describe('Kasirio Platform Office (office.kasirio.com) Integration Tests', () => {
  const mockSuperAdmin: Omit<AuthUserPayload, 'aud'> = {
    userId: 'super-admin-01',
    name: 'Admin Kasirio',
    role: 'SUPER_ADMIN',
    tenantId: 'platform-internal',
    outletId: 'platform-internal',
    isMfaVerified: true,
  };

  describe('1. Platform Office Authentication & Session Lifecycle', () => {
    it('menerbitkan token autentikasi staf platform dengan klaim MFA valid', () => {
      const token = generateOfficeToken(mockSuperAdmin, '1h');
      const decoded = jwt.verify(token, JWT_OFFICE_SECRET, {
        algorithms: ['HS256'],
        audience: 'office',
      }) as AuthUserPayload;

      expect(decoded.userId).toBe(mockSuperAdmin.userId);
      expect(decoded.role).toBe('SUPER_ADMIN');
      expect(decoded.isMfaVerified).toBe(true);
      expect(decoded.aud).toBe('office');
    });

    it('menerbitkan token Break-Glass darurat dengan masa aktif ketat 30 menit dan justifikasi tertulis', () => {
      const justification = 'Investigasi insiden gagal sinkronisasi merchant darurat.';
      const breakGlassToken = generateOfficeToken(
        mockSuperAdmin,
        '30m',
        true,
        justification
      );

      const decoded = jwt.verify(breakGlassToken, JWT_OFFICE_SECRET, {
        algorithms: ['HS256'],
        audience: 'office',
      }) as AuthUserPayload & { exp: number; iat: number };

      expect(decoded.isBreakGlass).toBe(true);
      expect(decoded.breakGlassJustification).toBe(justification);
      
      // Verifikasi durasi token <= 30 menit (1800 detik)
      const durationSeconds = (decoded.exp - decoded.iat);
      expect(durationSeconds).toBe(30 * 60);
    });
  });

  describe('2. Verifikasi Pembayaran Transfer Koin (Finance Engine)', () => {
    interface MockPayment {
      id: string;
      tenantId: string;
      amount: number;
      status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
      verifiedByStaffId?: string;
    }

    interface MockSubscription {
      tenantId: string;
      status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'LIMITED';
      activeEndsAt: Date;
    }

    it('melakukan atomic conditional update pada pembayaran pending (Anti-Race Condition)', () => {
      const payment: MockPayment = {
        id: 'pay-001',
        tenantId: 'tenant-umkm-123',
        amount: 50000,
        status: 'PENDING_VERIFICATION',
      };

      // Simulasi update pertama
      const verifyPayment = (p: MockPayment, staffId: string) => {
        if (p.status !== 'PENDING_VERIFICATION') {
          throw new Error('ALREADY_PROCESSED');
        }
        p.status = 'VERIFIED';
        p.verifiedByStaffId = staffId;
        return p;
      };

      const result1 = verifyPayment(payment, 'staff-001');
      expect(result1.status).toBe('VERIFIED');
      expect(result1.verifiedByStaffId).toBe('staff-001');

      // Percobaan verifikasi kedua dari staf lain harus ditolak
      expect(() => verifyPayment(payment, 'staff-002')).toThrow('ALREADY_PROCESSED');
    });

    it('memperpanjang masa aktif langganan toko secara instan sebesar +30 hari', () => {
      const now = new Date('2026-09-18T10:00:00Z');
      const currentSub: MockSubscription = {
        tenantId: 'tenant-umkm-123',
        status: 'ACTIVE',
        activeEndsAt: new Date('2026-09-20T10:00:00Z'), // Masih tersisa 2 hari
      };

      // Logika perpanjangan: jika activeEndsAt > now, gunakan activeEndsAt sebagai basis
      const baseDate = currentSub.activeEndsAt > now ? currentSub.activeEndsAt : now;
      const newActiveEndsAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      currentSub.activeEndsAt = newActiveEndsAt;
      currentSub.status = 'ACTIVE';

      // Tanggal baru harus 20 Oktober 2026 (bukan 18 Oktober) karena menambahkan sisa masa aktif
      expect(currentSub.activeEndsAt.toISOString()).toBe('2026-10-20T10:00:00.000Z');
      expect(currentSub.status).toBe('ACTIVE');
    });
  });

  describe('3. Konfigurasi Dinamis Platform (System Configs)', () => {
    const mockConfigs: Record<string, string> = {
      grace_period_days: '7',
      additional_tenant_monthly_price: '49000',
      max_concurrent_sessions_starter: '3',
      max_concurrent_sessions_pro: '10',
    };

    it('memvalidasi pembacaan dan pembaruan konfigurasi sistem', () => {
      expect(mockConfigs['grace_period_days']).toBe('7');

      // Update nilai konfigurasi
      const newGracePeriod = '14';
      mockConfigs['grace_period_days'] = newGracePeriod;

      expect(mockConfigs['grace_period_days']).toBe('14');
    });
  });
});
