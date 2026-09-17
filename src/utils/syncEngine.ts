import { db } from '../db';
import { SyncMutation, StoreSettings, Product, Category, Customer } from '../types';

export type SyncState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';

export interface SyncEngineStatus {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

type StatusListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isRunning = false;
  private isSyncing = false;
  private timer: any = null;
  private listeners: Set<StatusListener> = new Set();
  private status: SyncEngineStatus = {
    state: typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE',
    pendingCount: 0,
    lastSyncedAt: null,
    errorMessage: null,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      l({ ...this.status });
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    this.status.state = isOnline ? 'ONLINE' : 'OFFLINE';
    this.notify();
    if (isOnline) {
      this.syncNow();
    }
  }

  public async start(intervalMs: number = 10000) {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.refreshPendingCount();

    // Initial sync
    this.syncNow();

    this.timer = setInterval(() => {
      if (this.status.state !== 'OFFLINE' && !this.isSyncing) {
        this.syncNow();
      }
    }, intervalMs);
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const count = await db.syncQueue.where('status').equals('PENDING').count();
      this.status.pendingCount = count;
      this.notify();
      return count;
    } catch {
      return 0;
    }
  }

  public async syncNow(): Promise<boolean> {
    if (this.isSyncing) return false;

    // Cek koneksi browser
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status.state = 'OFFLINE';
      this.notify();
      return false;
    }

    const settingsDoc = await db.settings.get('current');
    const settings = settingsDoc?.data;

    // Jika cloud sync belum diaktifkan atau belum ada token, tetap offline mode aman
    if (!settings?.cloudSyncEnabled || !settings?.authToken) {
      await this.refreshPendingCount();
      return true;
    }

    const baseUrl = settings.apiBaseUrl || 'http://localhost:3001';

    try {
      this.isSyncing = true;
      this.status.state = 'SYNCING';
      this.status.errorMessage = null;
      this.notify();

      // 1. PUSH: Ambil mutasi outbox lokal yang pending
      const pendingMutations = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .limit(50)
        .toArray();

      if (pendingMutations.length > 0) {
        // Tandai mutasi sedang diproses
        await db.syncQueue.bulkPut(
          pendingMutations.map((m) => ({ ...m, status: 'SYNCING' }))
        );

        const pushRes = await fetch(`${baseUrl}/api/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.authToken}`,
          },
          body: JSON.stringify({ mutations: pendingMutations }),
        });

        if (!pushRes.ok) {
          throw new Error(`Push sync gagal (Status HTTP ${pushRes.status})`);
        }

        const pushData = await pushRes.json();
        const syncedIds: string[] = pushData.syncedIds || [];

        // Hapus mutasi yang sudah berhasil disinkronkan dari queue
        if (syncedIds.length > 0) {
          await db.syncQueue.bulkDelete(syncedIds);
        }

        // Jika ada yang gagal, kembalikan statusnya ke PENDING dengan retryCount
        const failedIds = pendingMutations
          .map((m) => m.id)
          .filter((id) => !syncedIds.includes(id));

        if (failedIds.length > 0) {
          const failedItems = pendingMutations.filter((m) => failedIds.includes(m.id));
          await db.syncQueue.bulkPut(
            failedItems.map((m) => ({
              ...m,
              status: 'PENDING',
              retryCount: (m.retryCount || 0) + 1,
            }))
          );
        }
      }

      // 2. PULL: Ambil delta data dari server sejak lastSyncTimestamp
      const lastSync = settings.lastSyncTimestamp || '';
      const pullRes = await fetch(`${baseUrl}/api/sync/pull?since=${encodeURIComponent(lastSync)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${settings.authToken}`,
        },
      });

      if (pullRes.ok) {
        const pullData = await pullRes.json();
        if (pullData.delta) {
          const { products, categories, customers } = pullData.delta;

          // Upsert catalog produk dari server (LWW)
          if (Array.isArray(products) && products.length > 0) {
            await db.products.bulkPut(
              products.map((p: any) => ({
                id: p.id,
                name: p.name,
                sku: p.sku || '',
                barcode: p.barcode || '',
                buyPrice: p.buyPrice || 0,
                sellPrice: p.sellPrice,
                stock: p.stock || 0,
                minStock: p.minStock || p.minStockAlert || 5,
                unit: p.unit || 'Pcs',
                categoryId: p.categoryId || '',
                deletedAt: p.deletedAt,
                createdAt: p.createdAt ? (typeof p.createdAt === 'string' ? p.createdAt : new Date(p.createdAt).toISOString()) : new Date().toISOString(),
                updatedAt: p.updatedAt ? (typeof p.updatedAt === 'string' ? p.updatedAt : new Date(p.updatedAt).toISOString()) : new Date().toISOString(),
              }))
            );
          }

          // Upsert kategori
          if (Array.isArray(categories) && categories.length > 0) {
            await db.categories.bulkPut(
              categories.map((c: any) => ({
                id: c.id,
                name: c.name,
              }))
            );
          }

          // Upsert pelanggan
          if (Array.isArray(customers) && customers.length > 0) {
            await db.customers.bulkPut(
              customers.map((c: any) => ({
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                address: c.address || '',
                totalDebt: c.totalDebt || 0,
                createdAt: c.createdAt ? (typeof c.createdAt === 'string' ? c.createdAt : new Date(c.createdAt).toISOString()) : new Date().toISOString(),
              }))
            );
          }
        }

        // Perbarui timestamp sinkronisasi terakhir
        const newTimestamp = pullData.serverTimestamp || new Date().toISOString();
        const updatedSettings = {
          ...settings,
          lastSyncTimestamp: newTimestamp,
        };
        await db.settings.put({ id: 'current', data: updatedSettings });
        this.status.lastSyncedAt = newTimestamp;
      }

      await this.refreshPendingCount();
      this.status.state = 'ONLINE';
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('[Sync Engine Error]', err);
      this.status.state = 'ERROR';
      this.status.errorMessage = err.message || 'Gagal menyinkronkan data.';
      await this.refreshPendingCount();
      this.notify();
      return false;
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();
