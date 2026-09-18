import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../prisma';

/**
 * ============================================================================
 * PostgreSQL Row-Level Security (RLS) & Connection Pooling Architecture Guide
 * ============================================================================
 * 
 * 1. PRASYARAT PGBOUNCER:
 *    Jika arsitektur backend menggunakan connection pooler seperti PgBouncer
 *    (misal pada Neon, Supabase Pooler, AWS RDS Proxy), PgBouncer WAJIB
 *    dikonfigurasi dalam `TRANSACTION POOLING MODE` (port 6543 pada Supabase).
 * 
 *    Alasan Teknis:
 *    - Dalam Transaction Pooling Mode, koneksi server PostgreSQL dialokasikan
 *      khusus untuk durasi satu transaksi (`BEGIN ... COMMIT`).
 *    - Perintah `SET LOCAL app.current_tenant_id = $1` secara spesifik memiliki
 *      skop 'LOCAL', yang berarti variabel sesi otomatis dibersihkan saat
 *      transaksi selesai (`COMMIT` atau `ROLLBACK`).
 *    - Jika menggunakan Session Pooling Mode atau koneksi non-transaksi,
 *      variabel sesi dapat bocor ke request penyewa lain yang kebetulan
 *      menggunakan koneksi yang sama dari pool (Connection Leakage Attack / Cross-Tenant Data Leak).
 * 
 * 2. SQLite DEV FALLBACK:
 *    Dalam lingkungan pengujian lokal (SQLite `dev.db`), SQLite tidak mendukung
 *    sintaks RLS PostgreSQL `SET LOCAL`. Fungsi ini mendeteksi database engine
 *    secara otomatis agar transisi antara dev lokal dan cloud production berjalan mulus.
 */

export async function withTenantContext<T>(
  tenantId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!tenantId) {
    throw new Error('[RLS Context] tenantId wajib disediakan untuk transaksi multi-tenant.');
  }

  return await prisma.$transaction(async (tx) => {
    // Cek apakah database provider adalah PostgreSQL
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') || false;

    if (isPostgres) {
      // Set variabel sesi lokal PostgreSQL untuk RLS Policy
      // Menggunakan query raw di dalam transaksi ber-scope LOCAL
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId.replace(/'/g, "''")}';`);
    }

    // Eksekusi operasi bisnis dalam konteks tenant yang terisolasi
    return await callback(tx);
  });
}
