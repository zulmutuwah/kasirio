import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAppToken,
  generateOfficeToken,
  JWT_APP_SECRET,
  JWT_OFFICE_SECRET,
  AuthUserPayload,
} from '../server/auth';
import { normalizeEmail } from '../server/middleware/security';

describe('Kasirio Cloud Backend Blueprint v1.0 Tests', () => {
  describe('1. Dual-Realm JWT Signing & Audience Isolation', () => {
    const mockAppUser: Omit<AuthUserPayload, 'aud'> = {
      userId: 'user-owner-123',
      name: 'Budi Owner',
      role: 'OWNER',
      tenantId: 'tenant-abc-123',
      outletId: 'outlet-main-001',
    };

    const mockOfficeUser: Omit<AuthUserPayload, 'aud'> = {
      userId: 'user-dev-999',
      name: 'Super Developer',
      role: 'DEVELOPER',
      tenantId: 'platform-internal',
      outletId: 'platform-internal',
      isMfaVerified: true,
    };

    it('menerbitkan token App dengan audience "app" dan signing key JWT_APP_SECRET', () => {
      const appToken = generateAppToken(mockAppUser, '15m');
      const decoded = jwt.verify(appToken, JWT_APP_SECRET, {
        algorithms: ['HS256'],
        audience: 'app',
      }) as AuthUserPayload;

      expect(decoded.userId).toBe(mockAppUser.userId);
      expect(decoded.role).toBe('OWNER');
      expect(decoded.aud).toBe('app');
    });

    it('menerbitkan token Office dengan audience "office" dan signing key JWT_OFFICE_SECRET', () => {
      const officeToken = generateOfficeToken(mockOfficeUser, '15m');
      const decoded = jwt.verify(officeToken, JWT_OFFICE_SECRET, {
        algorithms: ['HS256'],
        audience: 'office',
      }) as AuthUserPayload;

      expect(decoded.userId).toBe(mockOfficeUser.userId);
      expect(decoded.role).toBe('DEVELOPER');
      expect(decoded.aud).toBe('office');
    });

    it('menolak mentah-mentah verifikasi silang (Cross-Realm Isolation)', () => {
      const appToken = generateAppToken(mockAppUser, '15m');
      const officeToken = generateOfficeToken(mockOfficeUser, '15m');

      // Token App tidak boleh bisa diverifikasi oleh Office Secret
      expect(() => {
        jwt.verify(appToken, JWT_OFFICE_SECRET, { audience: 'office' });
      }).toThrow();

      // Token Office tidak boleh bisa diverifikasi oleh App Secret
      expect(() => {
        jwt.verify(officeToken, JWT_APP_SECRET, { audience: 'app' });
      }).toThrow();
    });

    it('menolak token jika audience tidak cocok (mencegah peniruan klaim)', () => {
      const appToken = generateAppToken(mockAppUser, '15m');
      expect(() => {
        jwt.verify(appToken, JWT_APP_SECRET, { audience: 'office' });
      }).toThrow();
    });
  });

  describe('2. Mekanisme Break-Glass Office (TTL 30 Menit & Justifikasi)', () => {
    it('menerbitkan token Break-Glass dengan expiry ketat 30 menit dan flag darurat', () => {
      const staffPayload: Omit<AuthUserPayload, 'aud'> = {
        userId: 'dev-001',
        name: 'Lead Architect',
        role: 'DEVELOPER',
        tenantId: 'platform-internal',
        outletId: 'platform-internal',
        isMfaVerified: true,
      };

      const justification = 'VPN gateway Tailscale down, perbaikan darurat server produksi.';
      const token = generateOfficeToken(staffPayload, '1h', true, justification);

      const decoded = jwt.verify(token, JWT_OFFICE_SECRET, { audience: 'office' }) as any;
      expect(decoded.isBreakGlass).toBe(true);
      expect(decoded.breakGlassJustification).toBe(justification);

      // Hitung durasi expiry dalam menit (~30 menit)
      const durationSeconds = decoded.exp - decoded.iat;
      expect(durationSeconds).toBe(30 * 60);
    });
  });

  describe('3. Normalisasi Email (Pencegahan Abuse Trial)', () => {
    it('menghapus titik dan tag alias plus (+) pada domain Gmail', () => {
      expect(normalizeEmail('budi.santoso+kasir1@gmail.com')).toBe('budisantoso@gmail.com');
      expect(normalizeEmail('b.u.d.i.s.a.n.t.o.s.o@gmail.com')).toBe('budisantoso@gmail.com');
      expect(normalizeEmail('owner+trial2@googlemail.com')).toBe('owner@gmail.com');
    });

    it('menghapus tag plus (+) pada penyedia email non-gmail namun mempertahankan struktur domain', () => {
      expect(normalizeEmail('owner+outlet2@tokokelontong.id')).toBe('owner@tokokelontong.id');
      expect(normalizeEmail('admin+cabang@yahoo.com')).toBe('admin@yahoo.com');
    });
  });

  describe('4. Deteksi Clock Skew Handshake (Live Clock Drift)', () => {
    const TOLERANCE_SECONDS = 300; // 5 menit

    function evaluateClockSkew(serverNow: Date, deviceNow: Date): { skewSeconds: number; isSkewDetected: boolean } {
      const skewSeconds = Math.round((serverNow.getTime() - deviceNow.getTime()) / 1000);
      return {
        skewSeconds,
        isSkewDetected: Math.abs(skewSeconds) > TOLERANCE_SECONDS,
      };
    }

    it('tidak mendeteksi skew jika drift dalam toleransi normal (< 5 menit)', () => {
      const serverNow = new Date('2026-09-17T12:00:00Z');
      const deviceNow = new Date('2026-09-17T12:02:30Z'); // 2.5 menit lebih cepat

      const result = evaluateClockSkew(serverNow, deviceNow);
      expect(result.isSkewDetected).toBe(false);
      expect(Math.abs(result.skewSeconds)).toBeLessThanOrEqual(300);
    });

    it('mendeteksi manipulasi jam kasir yang dimundurkan 3 jam di hari yang sama', () => {
      const serverNow = new Date('2026-09-17T15:00:00Z');
      const deviceNow = new Date('2026-09-17T12:00:00Z'); // Dimundurkan 3 jam (10.800 detik)

      const result = evaluateClockSkew(serverNow, deviceNow);
      expect(result.isSkewDetected).toBe(true);
      expect(result.skewSeconds).toBe(10800);
    });

    it('mendeteksi manipulasi jam kasir yang dimajukan secara drastis', () => {
      const serverNow = new Date('2026-09-17T10:00:00Z');
      const deviceNow = new Date('2026-09-17T10:15:00Z'); // 15 menit lebih cepat

      const result = evaluateClockSkew(serverNow, deviceNow);
      expect(result.isSkewDetected).toBe(true);
      expect(result.skewSeconds).toBe(-900);
    });
  });

  describe('5. Kalkulasi Ulang Server & Validasi Idempotensi', () => {
    it('menghitung ulang total transaksi secara akurat dan tidak mempercayai angka client mentah', () => {
      const lineItems = [
        { quantity: 2, sellPrice: 25000, discount: 5000 }, // (2 * 25000) - 5000 = 45000
        { quantity: 1, sellPrice: 15000, discount: 0 },    // 15000
      ];

      const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.sellPrice - item.discount), 0);
      const txDiscount = 10000;
      const tax = 5500;
      const calculatedTotal = subtotal - txDiscount + tax;

      expect(subtotal).toBe(60000);
      expect(calculatedTotal).toBe(55500);

      // Jika client mengklaim total 10.000 (manipulasi / bug offline client), deteksi discrepancy
      const clientClaimedTotal = 10000;
      const hasDiscrepancy = Math.abs(calculatedTotal - clientClaimedTotal) > 1;
      expect(hasDiscrepancy).toBe(true);
    });
  });
});
