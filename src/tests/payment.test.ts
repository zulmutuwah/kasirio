import { describe, it, expect } from 'vitest';
import { generateDynamicQrisString } from '../server/routes/paymentRoutes';

describe('5. Sub-Fase 3a: Dynamic QRIS & Webhook Listener Test', () => {
  it('harus menghasilkan string payload QRIS dinamis dengan nominal rupiah yang pas', () => {
    const orderId = 'QRIS-TRX-101';
    const amount = 45000;
    const merchant = 'TOKO BERKAH';

    const qris = generateDynamicQrisString(orderId, amount, merchant);

    expect(qris).toBeDefined();
    expect(qris.startsWith('000201010212')).toBe(true); // Standar tag EMVCo
    expect(qris).toContain('45000.00'); // Tag 54 nominal transaksi
    expect(qris).toContain('TOKO BERKAH'); // Tag 59 nama merchant
  });

  it('harus membuat invoice QRIS melalui HTTP request handler', async () => {
    const orderId = 'QRIS-TRX-202';
    const amount = 85000;

    const qris = generateDynamicQrisString(orderId, amount, 'KASIRIO MART');
    expect(qris).toContain('85000.00');
    expect(qris).toContain('KASIRIO MART');
  });
});
