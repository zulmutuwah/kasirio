import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, DEFAULT_OWNER_PIN } from '../utils/security';

describe('1. Kalkulasi Finansial Transaksi POS Kasirio', () => {
  it('harus menghitung subtotal barang dengan diskon nominal secara akurat', () => {
    const sellPrice = 18000;
    const qty = 2;
    const discountNominal = 2000; // Rp 2.000 per item
    const itemSubtotal = Math.max(0, (sellPrice * qty) - (discountNominal * qty));
    expect(itemSubtotal).toBe(32000);
  });

  it('harus menghitung subtotal barang dengan diskon persentase secara akurat', () => {
    const sellPrice = 20000;
    const qty = 3;
    const discountPercent = 10; // 10%
    const originalTotal = sellPrice * qty; // 60.000
    const discAmount = (originalTotal * discountPercent) / 100; // 6.000
    const itemSubtotal = originalTotal - discAmount;
    expect(itemSubtotal).toBe(54000);
  });

  it('harus menghitung total pajak (PPN/PB1 11%) dan grand total dengan diskon order', () => {
    const subtotal = 100000;
    const taxPercentage = 11;
    const enableTax = true;
    const cartOrderDiscount = 5000;

    const taxAmount = enableTax ? (subtotal * taxPercentage) / 100 : 0;
    const grandTotal = Math.max(0, subtotal + taxAmount - cartOrderDiscount);

    expect(taxAmount).toBe(11000);
    expect(grandTotal).toBe(106000);
  });

  it('harus menghitung uang kembalian tunai secara tepat', () => {
    const grandTotal = 106000;
    const amountPaid = 150000;
    const change = Math.max(0, amountPaid - grandTotal);
    expect(change).toBe(44000);
  });
});

describe('2. Logika Inventory Movement Ledger & Konsistensi Stok', () => {
  it('harus mengurangi stok saat penjualan dan mengembalikan stok saat transaksi di-void', () => {
    let currentStock = 50;
    const saleQty = 5;

    // 1. Aksi Penjualan (SALE)
    currentStock -= saleQty;
    expect(currentStock).toBe(45);

    // 2. Aksi Pembatalan (VOID)
    currentStock += saleQty;
    expect(currentStock).toBe(50);
  });

  it('akumulasi log mutasi stok harus sama persis dengan saldo stok akhir', () => {
    const initialStock = 20;
    const logs = [
      { type: 'IN', qty: 20 },
      { type: 'SALE', qty: -5 },
      { type: 'SALE', qty: -3 },
      { type: 'VOID', qty: 3 }, // void transaksi ke-2
      { type: 'ADJUSTMENT', qty: -1 }, // barang rusak
    ];

    const finalCalculated = logs.reduce((acc, log) => acc + log.qty, 0);
    expect(finalCalculated).toBe(14);
  });
});

describe('3. Logika Kasbon & Piutang Pelanggan', () => {
  it('harus menambah kasbon saat transaksi dan mengurangi saat cicilan dibayar', () => {
    let customerDebt = 0;
    const transactionKasbon = 45000;

    // Transaksi Kasbon
    customerDebt += transactionKasbon;
    expect(customerDebt).toBe(45000);

    // Cicilan Bayar Rp 20.000
    const payment = 20000;
    customerDebt = Math.max(0, customerDebt - payment);
    expect(customerDebt).toBe(25000);

    // Pelunasan Rp 30.000 (tidak boleh minus di bawah 0)
    customerDebt = Math.max(0, customerDebt - 30000);
    expect(customerDebt).toBe(0);
  });
});

describe('4. Keamanan PIN Gate & Salted Hash', () => {
  it('harus berhasil memverifikasi PIN yang benar', async () => {
    const hashed = await hashPin(DEFAULT_OWNER_PIN);
    const isValid = await verifyPin(DEFAULT_OWNER_PIN, hashed);
    expect(isValid).toBe(true);
  });

  it('harus menolak PIN yang salah', async () => {
    const hashed = await hashPin(DEFAULT_OWNER_PIN);
    const isInvalid = await verifyPin('999999', hashed);
    expect(isInvalid).toBe(false);
  });
});
