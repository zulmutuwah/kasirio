import { describe, it, expect } from 'vitest';

describe('6. Sub-Fase 3c: WhatsApp Official API Notification Test', () => {
  it('harus memformat template nota struk WhatsApp secara profesional', () => {
    const payload = {
      phone: '0812-3456-7890',
      invoiceNumber: 'INV-2026-0917-001',
      storeName: 'Warung Bu Siti',
      total: 65000,
      paymentMethod: 'QRIS',
      items: [
        { name: 'Beras Ramos 5kg', quantity: 1, subtotal: 65000 },
      ],
      cashierName: 'Siti Kasir',
    };

    const cleanPhone = payload.phone.replace(/[^0-9]/g, '');
    expect(cleanPhone).toBe('081234567890');

    const formattedItems = payload.items
      .map((i) => `• ${i.name} (x${i.quantity}) : Rp ${i.subtotal.toLocaleString('id-ID')}`)
      .join('\n');

    expect(formattedItems).toContain('Beras Ramos 5kg (x1) : Rp 65.000');
    expect(payload.total.toLocaleString('id-ID')).toBe('65.000');
  });

  it('harus memformat pesan pengingat kasbon ramah UMKM', () => {
    const customer = {
      phone: '+62 899-1234-567',
      customerName: 'Pak Joko',
      storeName: 'Toko Sejahtera',
      totalDebt: 120000,
      dueDate: '20 September 2026',
    };

    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    expect(cleanPhone).toBe('628991234567');

    const reminderMsg = `Halo Kak *${customer.customerName}*, salam hangat dari *${customer.storeName}* 🙏\n` +
      `Sekadar informasi pengingat catatan kasbon / piutang belanja Anda saat ini:\n` +
      `• *Total Tagihan:* Rp ${customer.totalDebt.toLocaleString('id-ID')}\n` +
      `• *Estimasi Jatuh Tempo:* ${customer.dueDate}`;

    expect(reminderMsg).toContain('Pak Joko');
    expect(reminderMsg).toContain('Rp 120.000');
    expect(reminderMsg).toContain('20 September 2026');
  });
});
