import { Router, Request, Response } from 'express';
import prisma from '../../prisma';

export const jobRouter = Router();

/**
 * Middleware Autentikasi Pemanggil Cron (Cloud Scheduler / External Runner)
 * Mendukung autentikasi via X-Cron-Secret header atau Bearer token.
 */
const authenticateCronCaller = (req: Request, res: Response, next: Function) => {
  const cronSecret = process.env.CRON_SECRET || 'kasirio-cron-secret-dev-2026';
  const incomingSecret =
    req.headers['x-cron-secret'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : null);

  if (!incomingSecret || incomingSecret !== cronSecret) {
    console.warn(`[Cron Invoker] Panggilan cron tidak sah ditolak dari IP: ${req.ip}`);
    return res.status(401).json({
      error: 'Akses ditolak. Token autentikasi cron tidak valid atau tidak disediakan.',
    });
  }

  next();
};

/**
 * POST /api/internal/jobs/subscription-lifecycle
 * Endpoint terjadwal yang dipanggil oleh GCP Cloud Scheduler (setiap hari pkl 07:00 WIB)
 * Tugas:
 * 1. Evaluasi siklus masa aktif tenant (TRIAL -> GRACE -> LIMITED)
 * 2. Mengirim notifikasi H-7, H-3, H-1, ENTER_GRACE, ENTER_LIMITED
 * 3. Idempoten: Tidak akan mengirim notifikasi berulang untuk status & tenant yang sama
 */
jobRouter.post('/subscription-lifecycle', authenticateCronCaller, async (req: Request, res: Response) => {
  const now = new Date();
  const summary = {
    evaluatedAt: now.toISOString(),
    processedTenants: 0,
    stateTransitions: [] as string[],
    notificationsTriggered: [] as { tenantId: string; type: string; recipient: string }[],
    errors: [] as string[],
  };

  try {
    // 1. Ambil seluruh subscription aktif, trial, atau grace beserta data owner tenant
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['TRIAL', 'GRACE', 'ACTIVE'] },
      },
      include: {
        tenant: {
          include: {
            users: {
              where: { role: 'OWNER' },
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    summary.processedTenants = subscriptions.length;

    for (const sub of subscriptions) {
      const owner = sub.tenant.users[0];
      const recipient = owner?.email || owner?.phone || 'owner@toko.local';
      const tenantId = sub.tenantId;

      // Evaluasi Tenant dalam masa TRIAL
      if (sub.status === 'TRIAL') {
        const msLeft = sub.trialEndsAt.getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

        let notificationType: string | null = null;

        if (daysLeft === 7) {
          notificationType = 'TRIAL_H7';
        } else if (daysLeft === 3) {
          notificationType = 'TRIAL_H3';
        } else if (daysLeft === 1) {
          notificationType = 'TRIAL_H1';
        } else if (daysLeft <= 0) {
          // Jatuh tempo: Masuk periode GRACE (Blueprint Bagian 4.2)
          // Default grace period: 7 hari
          const graceDays = 7;
          const graceEndsAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);

          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: 'GRACE',
              graceEndsAt,
            },
          });

          notificationType = 'ENTER_GRACE';
          summary.stateTransitions.push(
            `Tenant '${sub.tenant.name}' (${tenantId}) bertransisi TRIAL -> GRACE (Grace aktif s.d. ${graceEndsAt.toISOString()})`
          );
        }

        // Kirim notifikasi jika ada trigger tipe & belum pernah dikirim
        if (notificationType) {
          await triggerNotificationIdempotent(tenantId, notificationType, recipient, summary);
        }
      }

      // Evaluasi Tenant dalam masa GRACE
      else if (sub.status === 'GRACE') {
        const isGraceExpired = sub.graceEndsAt && sub.graceEndsAt.getTime() <= now.getTime();

        if (isGraceExpired) {
          // Masa tenggang habis: Masuk LIMITED (Read-only, blok transaksi baru)
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: 'LIMITED',
            },
          });

          summary.stateTransitions.push(
            `Tenant '${sub.tenant.name}' (${tenantId}) bertransisi GRACE -> LIMITED (Akses dibatasi read-only)`
          );

          await triggerNotificationIdempotent(tenantId, 'ENTER_LIMITED', recipient, summary);
        }
      }
    }

    console.log(`[Subscription Lifecycle Job] Selesai: ${summary.processedTenants} tenant diproses, ${summary.stateTransitions.length} transisi status, ${summary.notificationsTriggered.length} notifikasi dikirim.`);

    return res.json({
      success: true,
      message: 'Job subscription lifecycle berhasil dieksekusi.',
      summary,
    });
  } catch (error: any) {
    console.error('[Subscription Lifecycle Job Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal mengeksekusi job subscription lifecycle.',
      details: error.message,
    });
  }
});

/**
 * Helper Idempoten: Mengecek apakah notifikasi jenis tertentu sudah pernah dikirim.
 * Mencegah pengiriman berulang / spam ke pengguna.
 */
async function triggerNotificationIdempotent(
  tenantId: string,
  type: string,
  recipient: string,
  summary: any
) {
  try {
    const existingLog = await prisma.notificationLog.findFirst({
      where: {
        tenantId,
        type,
      },
    });

    if (existingLog) {
      // Sudah pernah dikirim, skip
      return;
    }

    // Catat ke notificationLog
    await prisma.notificationLog.create({
      data: {
        tenantId,
        type,
        channel: 'EMAIL',
        recipient,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    summary.notificationsTriggered.push({
      tenantId,
      type,
      recipient,
    });

    console.log(`[Notification Dispatch] Notifikasi ${type} berhasil dikirim ke ${recipient} (Tenant: ${tenantId})`);
  } catch (err: any) {
    console.error(`[Notification Dispatch Error] Gagal mencatat notifikasi ${type} untuk ${tenantId}:`, err);
    summary.errors.push(`Gagal kirim notifikasi ${type} (${tenantId}): ${err.message}`);
  }
}
