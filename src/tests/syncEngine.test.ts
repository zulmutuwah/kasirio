import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, queueMutation } from '../db';
import { syncEngine } from '../utils/syncEngine';

describe('3. Sub-Fase 2b: Cloud Sync Engine & Outbox Queue Test', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  it('harus mencatat mutasi transaksi baru ke tabel outbox syncQueue', async () => {
    const dummyTransaction = {
      id: 'TRX-TEST-001',
      total: 75000,
      paymentMethod: 'QRIS',
      status: 'LUNAS',
    };

    const mutId = await queueMutation('TRANSACTION', 'CREATE', dummyTransaction.id, dummyTransaction);
    expect(mutId).toBeDefined();

    const queued = await db.syncQueue.get(mutId);
    expect(queued).toBeDefined();
    expect(queued?.entityType).toBe('TRANSACTION');
    expect(queued?.action).toBe('CREATE');
    expect(queued?.status).toBe('PENDING');
    expect(queued?.payload.total).toBe(75000);
  });

  it('harus mencatat mutasi perubahan stok (Ledger Movement) ke outbox', async () => {
    const stockLogPayload = {
      id: 'stock-log-test-1',
      productId: 'prod-beras-1',
      productName: 'Beras Ramos 5kg',
      type: 'IN',
      quantity: 10,
      previousStock: 5,
      currentStock: 15,
    };

    const mutId = await queueMutation('STOCK_LOG', 'CREATE', stockLogPayload.id, stockLogPayload);
    const count = await syncEngine.refreshPendingCount();

    expect(count).toBe(1);
    const item = await db.syncQueue.get(mutId);
    expect(item?.entityType).toBe('STOCK_LOG');
  });

  it('harus menangani status antrean outbox secara tepat', async () => {
    await queueMutation('CUSTOMER', 'CREATE', 'cust-1', { name: 'Ibu Ani' });
    await queueMutation('DEBT_PAYMENT', 'CREATE', 'debt-1', { amount: 20000 });

    const pendingCount = await syncEngine.refreshPendingCount();
    expect(pendingCount).toBe(2);

    const pendingItems = await db.syncQueue.where('status').equals('PENDING').toArray();
    expect(pendingItems.length).toBe(2);
  });
});
