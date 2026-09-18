import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma';
import { AuthenticatedRequest, authenticateApp, JWT_APP_SECRET } from '../../auth';
import { withTenantContext } from '../../middleware/rlsContext';

export const posSyncRouter = Router();

interface SyncSessionPayload {
  tenantId: string;
  outletId: string;
  deviceId: string;
  skewDetected: boolean;
  skewSeconds: number;
}

/**
 * POST /api/app/pos/handshake
 * Live Clock Handshake (Blueprint Refinement User 1)
 * Dilakukan sekali per sesi sinkronisasi sebelum batch upload data offline dimulai.
 * Membandingkan jam device saat itu juga vs jam server saat itu juga.
 */
posSyncRouter.post('/handshake', authenticateApp, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceNowIso, deviceId = 'unknown-device' } = req.body;

    if (!deviceNowIso) {
      return res.status(400).json({ error: 'deviceNowIso (ISO string waktu saat ini di perangkat) wajib disertakan.' });
    }

    const tenantId = req.user!.tenantId;
    const outletId = req.user!.outletId;

    const serverNow = new Date();
    const deviceNow = new Date(deviceNowIso);

    // Hitung drift detik antara jam server vs jam device saat ini
    const skewSeconds = Math.round((serverNow.getTime() - deviceNow.getTime()) / 1000);

    // Toleransi drift NTP normal: 5 menit (300 detik)
    const MAX_TOLERANCE_SECONDS = 300;
    const skewDetected = Math.abs(skewSeconds) > MAX_TOLERANCE_SECONDS;

    if (skewDetected) {
      // Catat anomali manipulasi / desinkronisasi jam ke AuditLog
      await prisma.auditLog.create({
        data: {
          tenantId,
          outletId,
          type: 'CLOCK_SKEW_DETECTED',
          details: `Peringatan: Perangkat '${deviceId}' memiliki selisih jam ${skewSeconds} detik vs server (${Math.round(skewSeconds / 60)} menit).`,
          cashierName: req.user!.name,
          actorRole: req.user!.role,
          actorId: req.user!.userId,
        },
      });
    }

    // Terbitkan token sesi sync yang membawa status clock skew
    const sessionPayload: SyncSessionPayload = {
      tenantId,
      outletId,
      deviceId,
      skewDetected,
      skewSeconds,
    };

    const syncSessionToken = jwt.sign(sessionPayload, JWT_APP_SECRET, { expiresIn: '1h' });

    return res.json({
      success: true,
      serverTimeIso: serverNow.toISOString(),
      skewSeconds,
      skewDetected,
      syncSessionToken,
      message: skewDetected
        ? `Perhatian: Jam perangkat kasir berselisih ${Math.round(skewSeconds / 60)} menit dari waktu resmi server.`
        : 'Jam perangkat sinkron dengan server.',
    });
  } catch (error: any) {
    console.error('[Handshake Error]:', error);
    return res.status(500).json({ error: 'Gagal melakukan handshake sinkronisasi.', details: error.message });
  }
});

/**
 * POST /api/app/pos/sync
 * Blueprint Bagian 2.4, 6.3 & Refinement User 1:
 * - Idempotensi via UUID v4 (ON CONFLICT DO NOTHING)
 * - OutletId dijamin 100% NON-NULL
 * - Server Recalculation (Kalkulasi ulang harga & total transaksi, jangan percaya penuh client)
 * - Deteksi Clock Skew yang diwariskan dari handshake
 */
posSyncRouter.post('/sync', authenticateApp, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { syncSessionToken, transactions = [], stockLogs = [], customers = [] } = req.body;
    const tenantId = req.user!.tenantId;
    const defaultOutletId = req.user!.outletId;

    let skewDetected = false;
    let deviceId = 'unknown-device';

    // Verifikasi syncSessionToken jika disertakan
    if (syncSessionToken) {
      try {
        const decoded = jwt.verify(syncSessionToken, JWT_APP_SECRET) as SyncSessionPayload;
        if (decoded.tenantId === tenantId) {
          skewDetected = decoded.skewDetected;
          deviceId = decoded.deviceId;
        }
      } catch (err) {
        // Abaikan jika token kedaluwarsa, lanjut dengan default
      }
    }

    const syncResults = {
      transactionsCreated: 0,
      transactionsSkipped: 0,
      stockLogsCreated: 0,
      stockLogsSkipped: 0,
      customersCreated: 0,
      customersSkipped: 0,
    };

    // Jalankan dalam RLS Context dengan transaksi database atomik
    await withTenantContext(tenantId, async (tx) => {
      // 1. SINKRONISASI TRANSAKSI
      for (const item of transactions) {
        if (!item.id) continue;

        // Idempotensi: Cek apakah ID (UUID v4) sudah ada di database
        const existingTx = await tx.transaction.findUnique({
          where: { id: item.id },
        });

        if (existingTx) {
          syncResults.transactionsSkipped += 1;
          continue;
        }

        // Blueprint Bagian 6.3: Kalkulasi Ulang Nilai Total di Server
        let calculatedSubtotal = 0;
        const validatedItems = (item.items || []).map((lineItem: any) => {
          const qty = Number(lineItem.quantity) || 1;
          const sellPrice = Number(lineItem.sellPrice) || 0;
          const discount = Number(lineItem.discount) || 0;
          const lineSubtotal = Math.max(0, qty * sellPrice - discount);
          calculatedSubtotal += lineSubtotal;

          return {
            id: lineItem.id || undefined,
            productId: lineItem.productId,
            productName: lineItem.productName || 'Produk',
            quantity: qty,
            buyPrice: Number(lineItem.buyPrice) || 0,
            sellPrice,
            discount,
            subtotal: lineSubtotal,
          };
        });

        const txDiscount = Number(item.discount) || 0;
        const txTax = Number(item.tax) || 0;
        const calculatedTotal = Math.max(0, calculatedSubtotal - txDiscount + txTax);

        // Jika ada selisih kalkulasi atau clock skew terdeteksi, tandai isAuditFlagged
        const hasCalculationDiscrepancy = Math.abs(calculatedTotal - (Number(item.total) || 0)) > 1;
        const isFlagged = skewDetected || hasCalculationDiscrepancy || Boolean(item.isAuditFlagged);

        const targetOutletId = item.outletId || defaultOutletId;

        // Simpan transaksi baru
        await tx.transaction.create({
          data: {
            id: item.id,
            tenantId,
            outletId: targetOutletId,
            invoiceNumber: item.invoiceNumber || `INV-${Date.now()}`,
            date: new Date(item.date || item.createdAt || Date.now()),
            subtotal: calculatedSubtotal,
            discount: txDiscount,
            tax: txTax,
            total: calculatedTotal,
            cashierGiven: item.cashierGiven ? Number(item.cashierGiven) : null,
            changeDue: item.changeDue ? Number(item.changeDue) : null,
            paymentMethod: item.paymentMethod || 'CASH',
            status: item.status || 'COMPLETED',
            cashierId: item.cashierId || req.user!.userId,
            cashierName: item.cashierName || req.user!.name,
            customerId: item.customerId || null,
            customerName: item.customerName || null,
            notes: item.notes || null,
            isAuditFlagged: isFlagged,
            items: {
              create: validatedItems,
            },
          },
        });

        syncResults.transactionsCreated += 1;
      }

      // 2. SINKRONISASI STOCK LOGS (Ledger Movement)
      for (const log of stockLogs) {
        if (!log.id) continue;

        const existingLog = await tx.stockLog.findUnique({
          where: { id: log.id },
        });

        if (existingLog) {
          syncResults.stockLogsSkipped += 1;
          continue;
        }

        const targetOutletId = log.outletId || defaultOutletId;

        await tx.stockLog.create({
          data: {
            id: log.id,
            tenantId,
            outletId: targetOutletId,
            productId: log.productId,
            productName: log.productName || 'Produk',
            type: log.type || 'SALE',
            quantity: Number(log.quantity) || 0,
            previousStock: Number(log.previousStock) || 0,
            currentStock: Number(log.currentStock) || 0,
            notes: log.notes || null,
            date: new Date(log.date || Date.now()),
          },
        });

        syncResults.stockLogsCreated += 1;
      }

      // 3. SINKRONISASI PELANGGAN
      for (const cust of customers) {
        if (!cust.id) continue;

        const existingCust = await tx.customer.findUnique({
          where: { id: cust.id },
        });

        if (existingCust) {
          // Update hutang / info jika ada perubahan
          await tx.customer.update({
            where: { id: cust.id },
            data: {
              name: cust.name,
              phone: cust.phone || null,
              address: cust.address || null,
              totalDebt: Number(cust.totalDebt) || 0,
            },
          });
          syncResults.customersSkipped += 1;
        } else {
          await tx.customer.create({
            data: {
              id: cust.id,
              tenantId,
              name: cust.name,
              phone: cust.phone || null,
              address: cust.address || null,
              totalDebt: Number(cust.totalDebt) || 0,
            },
          });
          syncResults.customersCreated += 1;
        }
      }

      // Catat riwayat sync ke SyncMutationLog
      await tx.syncMutationLog.create({
        data: {
          tenantId,
          outletId: defaultOutletId,
          deviceId,
          entityType: 'TRANSACTION',
          entityId: req.user!.userId,
          action: 'CREATE',
          payload: JSON.stringify(syncResults),
          clientTimestamp: new Date(),
          serverTimestamp: new Date(),
        },
      });
    });

    return res.json({
      success: true,
      message: 'Sinkronisasi data offline berhasil diproses.',
      results: syncResults,
      clockSkewDetected: skewDetected,
    });
  } catch (error: any) {
    console.error('[Sync Error]:', error);
    return res.status(500).json({ error: 'Gagal memproses sinkronisasi data.', details: error.message });
  }
});
