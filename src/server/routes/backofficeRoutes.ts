import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth';

export const backofficeRouter = Router();

// Semua rute backoffice wajib login & peran OWNER atau MANAGER
backofficeRouter.use(authenticateToken);
backofficeRouter.use(requireRole(['OWNER', 'MANAGER']));

// GET /api/backoffice/summary - Ringkasan Omzet Konsolidasi Multi-Cabang
backofficeRouter.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { outletId, startDate, endDate } = req.query as {
      outletId?: string;
      startDate?: string;
      endDate?: string;
    };

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const whereClause: any = {
      tenantId,
      status: 'COMPLETED',
      ...(outletId ? { outletId } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    };

    // Ambil seluruh transaksi yang sesuai
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: { items: true, outlet: true },
      orderBy: { date: 'desc' },
    });

    const totalOmzet = transactions.reduce((acc, t) => acc + t.total, 0);
    const totalTransactions = transactions.length;

    // Hitung total HPP dan Laba Kotor
    let totalHPP = 0;
    const productSalesCount: Record<string, { name: string; qty: number; revenue: number }> = {};
    const outletBreakdown: Record<string, { outletName: string; omzet: number; count: number }> = {};

    transactions.forEach((trx) => {
      // Breakdown per outlet
      const outName = trx.outlet?.name || 'Cabang';
      if (!outletBreakdown[trx.outletId]) {
        outletBreakdown[trx.outletId] = { outletName: outName, omzet: 0, count: 0 };
      }
      outletBreakdown[trx.outletId].omzet += trx.total;
      outletBreakdown[trx.outletId].count += 1;

      // Items calculation
      trx.items.forEach((item) => {
        totalHPP += item.buyPrice * item.quantity;
        if (!productSalesCount[item.productId]) {
          productSalesCount[item.productId] = {
            name: item.productName,
            qty: 0,
            revenue: 0,
          };
        }
        productSalesCount[item.productId].qty += item.quantity;
        productSalesCount[item.productId].revenue += item.subtotal;
      });
    });

    const grossProfit = totalOmzet - totalHPP;
    const profitMargin = totalOmzet > 0 ? Math.round((grossProfit / totalOmzet) * 100) : 0;

    // Top 5 Produk Terlaris
    const topProducts = Object.values(productSalesCount)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        totalOmzet,
        grossProfit,
        profitMargin,
        totalTransactions,
        averageTicket: totalTransactions > 0 ? Math.round(totalOmzet / totalTransactions) : 0,
        outletBreakdown: Object.values(outletBreakdown),
        topProducts,
      },
    });
  } catch (error: any) {
    console.error('[Backoffice Summary Error]', error);
    res.status(500).json({ error: 'Gagal memuat ringkasan backoffice: ' + error.message });
  }
});

// GET /api/backoffice/outlets - Daftar Seluruh Cabang
backofficeRouter.get('/outlets', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const outlets = await prisma.outlet.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { products: true, users: true, transactions: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, outlets });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal mengambil daftar cabang toko.' });
  }
});

// POST /api/backoffice/outlets - Tambah Cabang Baru (Owner Only)
backofficeRouter.post('/outlets', requireRole(['OWNER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, address, phone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nama cabang toko wajib diisi.' });
    }

    const outlet = await prisma.outlet.create({
      data: {
        tenantId,
        name,
        address: address || null,
        phone: phone || null,
        isMainBranch: false,
      },
    });

    res.status(201).json({ success: true, outlet, message: `Cabang ${name} berhasil ditambahkan.` });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal menambahkan cabang toko: ' + error.message });
  }
});

// POST /api/backoffice/stock-transfer - Transfer Stok Antar-Cabang
backofficeRouter.post('/stock-transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { sourceOutletId, targetOutletId, productId, quantity, notes } = req.body;

    if (!sourceOutletId || !targetOutletId || !productId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Data transfer stok tidak lengkap atau kuantitas tidak valid.' });
    }

    if (sourceOutletId === targetOutletId) {
      return res.status(400).json({ error: 'Cabang asal dan tujuan tidak boleh sama.' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    }

    const qty = Number(quantity);

    // Jalankan transaksi database untuk mencatat transfer stok
    await prisma.$transaction(async (tx) => {
      // 1. Catat log keluar di cabang asal
      await tx.stockLog.create({
        data: {
          tenantId,
          outletId: sourceOutletId,
          productId,
          productName: product.name,
          type: 'TRANSFER',
          quantity: qty,
          previousStock: product.stock,
          currentStock: product.stock - qty,
          notes: `Transfer KELUAR ke cabang tujuan. Catatan: ${notes || '-'}`,
        },
      });

      // 2. Catat log masuk di cabang tujuan
      await tx.stockLog.create({
        data: {
          tenantId,
          outletId: targetOutletId,
          productId,
          productName: product.name,
          type: 'TRANSFER',
          quantity: qty,
          previousStock: 0,
          currentStock: qty,
          notes: `Transfer MASUK dari cabang asal. Catatan: ${notes || '-'}`,
        },
      });
    });

    res.json({
      success: true,
      message: `Berhasil mentransfer ${qty} ${product.unit} ${product.name}.`,
    });
  } catch (error: any) {
    console.error('[Stock Transfer Error]', error);
    res.status(500).json({ error: 'Gagal melakukan transfer stok: ' + error.message });
  }
});

// GET /api/backoffice/live-sessions - Pantau Sesi Kasir Aktif
backofficeRouter.get('/live-sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const activeSessions = await prisma.cashSession.findMany({
      where: {
        tenantId,
        status: 'OPEN',
      },
      include: {
        outlet: true,
      },
      orderBy: { openedAt: 'desc' },
    });

    res.json({ success: true, sessions: activeSessions });
  } catch (error: any) {
    res.status(500).json({ error: 'Gagal memuat sesi kasir aktif.' });
  }
});
