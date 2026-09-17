import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, AuthenticatedRequest } from '../auth';

export const syncRouter = Router();

interface SyncMutationPayload {
  id: string;
  entityType: 'TRANSACTION' | 'PRODUCT' | 'STOCK_LOG' | 'CUSTOMER' | 'DEBT_PAYMENT' | 'AUDIT_LOG';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: string;
  payload: any;
  clientTimestamp: string;
  deviceId: string;
}

// POST /api/sync/push - Menerima antrean mutasi outbox dari kasir lokal
syncRouter.post('/push', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mutations } = req.body as { mutations: SyncMutationPayload[] };
    const tenantId = req.user!.tenantId;
    const outletId = req.user!.outletId || (await getDefaultOutletId(tenantId));

    if (!Array.isArray(mutations) || mutations.length === 0) {
      return res.json({ success: true, syncedIds: [], message: 'Tidak ada mutasi yang dikirim.' });
    }

    const syncedIds: string[] = [];

    // Proses setiap mutasi secara atomik atau berurutan
    for (const m of mutations) {
      try {
        // Cek apakah mutasi ini sudah pernah diproses sebelumnya (Idempotensi)
        const alreadyProcessed = await prisma.syncMutationLog.findUnique({
          where: { id: m.id },
        });

        if (alreadyProcessed) {
          syncedIds.push(m.id);
          continue;
        }

        if (m.entityType === 'TRANSACTION' && m.action === 'CREATE') {
          const t = m.payload;
          // Upsert transaction agar append-only & no duplicate
          const existing = await prisma.transaction.findUnique({ where: { id: t.id } });
          if (!existing) {
            await prisma.transaction.create({
              data: {
                id: t.id,
                tenantId,
                outletId,
                invoiceNumber: t.invoiceNumber || t.id,
                date: new Date(t.date || m.clientTimestamp),
                subtotal: Number(t.subtotal || t.total),
                discount: Number(t.discount || 0),
                tax: Number(t.tax || 0),
                total: Number(t.total),
                cashierGiven: t.cashierGiven ? Number(t.cashierGiven) : null,
                changeDue: t.changeDue ? Number(t.changeDue) : null,
                paymentMethod: t.paymentMethod || 'CASH',
                status: t.status || 'COMPLETED',
                cashierId: t.cashierId || req.user!.userId,
                cashierName: t.cashierName || req.user!.name,
                customerId: t.customerId || null,
                customerName: t.customerName || null,
                notes: t.notes || null,
                isAuditFlagged: Boolean(t.isAuditFlagged),
                items: {
                  create: (t.items || []).map((item: any) => ({
                    id: item.id || `${t.id}-${item.productId}`,
                    productId: item.productId,
                    productName: item.productName || item.name,
                    quantity: Number(item.quantity),
                    buyPrice: Number(item.buyPrice || 0),
                    sellPrice: Number(item.sellPrice || item.price),
                    discount: Number(item.discount || 0),
                    subtotal: Number(item.subtotal || item.quantity * item.price),
                  })),
                },
              },
            });
          }
        } else if (m.entityType === 'STOCK_LOG' && m.action === 'CREATE') {
          const s = m.payload;
          const existing = await prisma.stockLog.findUnique({ where: { id: s.id } });
          if (!existing) {
            await prisma.stockLog.create({
              data: {
                id: s.id,
                tenantId,
                outletId,
                productId: s.productId,
                productName: s.productName,
                type: s.type,
                quantity: Number(s.quantity),
                previousStock: Number(s.previousStock),
                currentStock: Number(s.currentStock),
                notes: s.notes || null,
                date: new Date(s.date || m.clientTimestamp),
              },
            });

            // Perbarui stok produk terkait di cloud
            await prisma.product.updateMany({
              where: { id: s.productId, tenantId },
              data: {
                stock: {
                  increment: s.type === 'IN' || s.type === 'VOID' ? Number(s.quantity) : -Number(s.quantity),
                },
              },
            });
          }
        } else if (m.entityType === 'PRODUCT') {
          const p = m.payload;
          if (m.action === 'CREATE' || m.action === 'UPDATE') {
            await prisma.product.upsert({
              where: { id: p.id },
              update: {
                name: p.name,
                sku: p.sku || null,
                barcode: p.barcode || null,
                buyPrice: Number(p.buyPrice || 0),
                sellPrice: Number(p.sellPrice),
                stock: Number(p.stock),
                minStockAlert: Number(p.minStockAlert || 5),
                unit: p.unit || 'Pcs',
                categoryId: p.categoryId || null,
                deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
              },
              create: {
                id: p.id,
                tenantId,
                outletId,
                name: p.name,
                sku: p.sku || null,
                barcode: p.barcode || null,
                buyPrice: Number(p.buyPrice || 0),
                sellPrice: Number(p.sellPrice),
                stock: Number(p.stock),
                minStockAlert: Number(p.minStockAlert || 5),
                unit: p.unit || 'Pcs',
                categoryId: p.categoryId || null,
              },
            });
          }
        } else if (m.entityType === 'CUSTOMER') {
          const c = m.payload;
          await prisma.customer.upsert({
            where: { id: c.id },
            update: {
              name: c.name,
              phone: c.phone || null,
              address: c.address || null,
              totalDebt: Number(c.totalDebt || 0),
            },
            create: {
              id: c.id,
              tenantId,
              name: c.name,
              phone: c.phone || null,
              address: c.address || null,
              totalDebt: Number(c.totalDebt || 0),
            },
          });
        } else if (m.entityType === 'DEBT_PAYMENT' && m.action === 'CREATE') {
          const d = m.payload;
          await prisma.debtPaymentLog.create({
            data: {
              id: d.id,
              tenantId,
              customerId: d.customerId,
              amount: Number(d.amount),
              paymentMethod: d.paymentMethod || 'CASH',
              notes: d.notes || null,
              date: new Date(d.date || m.clientTimestamp),
            },
          });
          // Kurangi hutang pelanggan
          await prisma.customer.updateMany({
            where: { id: d.customerId, tenantId },
            data: { totalDebt: { decrement: Number(d.amount) } },
          });
        } else if (m.entityType === 'AUDIT_LOG' && m.action === 'CREATE') {
          const a = m.payload;
          await prisma.auditLog.create({
            data: {
              id: a.id,
              tenantId,
              outletId,
              type: a.type,
              details: a.details,
              cashierName: a.cashierName,
              timestamp: new Date(a.timestamp || m.clientTimestamp),
            },
          });
        }

        // Catat mutasi log
        await prisma.syncMutationLog.create({
          data: {
            id: m.id,
            tenantId,
            outletId,
            deviceId: m.deviceId || 'unknown-device',
            entityType: m.entityType,
            entityId: m.entityId,
            action: m.action,
            payload: JSON.stringify(m.payload),
            clientTimestamp: new Date(m.clientTimestamp),
          },
        });

        syncedIds.push(m.id);
      } catch (mutationErr: any) {
        console.error(`[Sync Mutation Error] Mutasi ${m.id} gagal:`, mutationErr);
      }
    }

    res.json({
      success: true,
      syncedIds,
      serverTimestamp: new Date().toISOString(),
      message: `${syncedIds.length} dari ${mutations.length} mutasi berhasil disinkronkan ke cloud.`,
    });
  } catch (error: any) {
    console.error('[Sync Push Fatal Error]', error);
    res.status(500).json({ error: 'Gagal memproses sinkronisasi: ' + error.message });
  }
});

// GET /api/sync/pull - Mengirimkan delta data yang berubah sejak timestamp tertentu
syncRouter.get('/pull', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sinceQuery = req.query.since as string;
    const sinceDate = sinceQuery ? new Date(sinceQuery) : new Date(0);

    const [products, categories, customers] = await Promise.all([
      prisma.product.findMany({
        where: {
          tenantId,
          updatedAt: { gt: sinceDate },
        },
      }),
      prisma.category.findMany({
        where: {
          tenantId,
          updatedAt: { gt: sinceDate },
        },
      }),
      prisma.customer.findMany({
        where: {
          tenantId,
          updatedAt: { gt: sinceDate },
        },
      }),
    ]);

    res.json({
      success: true,
      serverTimestamp: new Date().toISOString(),
      delta: {
        products,
        categories,
        customers,
      },
    });
  } catch (error: any) {
    console.error('[Sync Pull Error]', error);
    res.status(500).json({ error: 'Gagal mengambil delta data sinkronisasi.' });
  }
});

async function getDefaultOutletId(tenantId: string): Promise<string> {
  const mainOutlet = await prisma.outlet.findFirst({
    where: { tenantId, isMainBranch: true },
  });
  if (mainOutlet) return mainOutlet.id;
  const anyOutlet = await prisma.outlet.findFirst({ where: { tenantId } });
  return anyOutlet ? anyOutlet.id : 'default-outlet';
}
