# Kasirio Role & Permission System — Agent Prompt (Revisi v2)

> **Tujuan dokumen:** Prompt siap-kirim untuk agent eksternal (misalnya Antigravity) yang akan merancang fitur, database, API, atau dokumentasi terkait sistem role & permission Kasirio. Direvisi dari draf awal setelah CTO review internal — lihat catatan scope di bawah sebelum diterapkan.

---

## ⚠️ Scope & Prasyarat — Baca Sebelum Menerapkan

Prompt ini mendefinisikan struktur role & permission untuk **arsitektur Cloud/Backend multi-tenant Kasirio**, yaitu fase pengembangan **setelah** fondasi offline-first saat ini (mengacu istilah internal Kasirio: Fase 1a/1b/1c sudah selesai; ini adalah bagian dari Horizon 2 "Cloud Sync Mesh" ke atas di roadmap).

**Batasan penerapan yang wajib dipatuhi:**
1. **Jangan ubah skema lokal Dexie/IndexedDB Fase 1** (`src/db/index.ts`, `src/types.ts`) di luar konteks pekerjaan backend/cloud yang eksplisit diminta. Skema lokal saat ini sengaja berbentuk "satu database device = satu tenant" — `tenantId`/`outletId` sudah ada sebagai field tunggal di `StoreSettings`, **bukan** kolom per-baris di setiap tabel. Aturan "semua data bisnis harus memiliki `tenant_id`" pada dokumen ini berlaku untuk **skema database backend multi-tenant yang baru**, bukan untuk memaksa penambahan kolom `tenant_id` ke tabel lokal yang sudah berjalan.
2. **Tipe `User.role` yang sudah ada di `src/types.ts` saat ini hanya `'OWNER' | 'CASHIER'`** (2 nilai, lokal, tanpa server). Perluasan ke 5 role penuh (termasuk Admin Toko) adalah pekerjaan migrasi yang terjadi **bersamaan** dengan pembangunan backend — jangan ubah union type ini secara terpisah tanpa migrasi datanya.
3. **Kasirio adalah produk offline-first** — kasir harus tetap bisa bertransaksi dan menggunakan PIN Gate Owner (otorisasi void/diskon) meski tidak ada koneksi internet. Setiap desain role/permission yang bergantung pada pemanggilan server secara real-time untuk setiap aksi **melanggar prinsip inti produk ini**. Lihat bagian "Prinsip Otorisasi Offline" di bawah — wajib dirancang bersamaan, bukan ditambahkan belakangan.

---

## Context

Kasirio adalah platform POS (Point of Sale) yang saat ini berjalan sebagai PWA offline-first single-device (satu toko, satu database lokal per perangkat), dan sedang berevolusi menjadi platform SaaS berarsitektur multi-tenant. Setiap bisnis (toko) adalah tenant yang memiliki data, pengguna, dan pengaturannya sendiri. Sistem role harus dipisahkan antara level platform dan level toko (tenant) agar aman, mudah dikembangkan, dan siap untuk fitur multi-cabang di masa depan.

Tugas Anda adalah selalu menggunakan struktur role berikut ketika merancang fitur, database, API, atau dokumentasi untuk **lapisan backend/cloud** Kasirio. Untuk lapisan aplikasi PWA lokal (Fase 1) yang sudah berjalan, terapkan hanya bagian yang eksplisit disebut relevan di instruksi tugas masing-masing.

---

## Prinsip Otorisasi Offline (Wajib Dirancang Sejak Awal)

Karena Kasirio harus tetap berfungsi tanpa internet:

- Role dan permission pengguna **di-cache secara lokal di device** (mirror dari server) setelah login/sinkronisasi terakhir, dengan grace period tertentu (misalnya tetap valid 24-72 jam tanpa koneksi).
- Otorisasi aksi sensitif (void, diskon manual, buka laci) **tidak boleh mewajibkan panggilan server** — cek dilakukan terhadap salinan role/permission lokal + PIN hash lokal, seperti mekanisme PIN Gate yang sudah berjalan sekarang.
- Sinkronisasi role/permission ke server terjadi saat koneksi tersedia (mengubah permission dari dashboard Owner akan terpropagasi ke device saat online kembali), bukan prasyarat setiap transaksi.
- Kalau device offline melewati grace period, tentukan fallback yang jelas (misalnya: hanya Owner lokal yang tersimpan boleh melakukan override, sampai device online kembali) — jangan biarkan aplikasi terkunci total.

---

## Hierarki Role Kasirio

### Level 1 — Platform (Kasirio SaaS)
Role pada level ini hanya dimiliki oleh tim internal Kasirio dan tidak termasuk pengguna toko. **Wajib MFA aktif untuk kedua role ini** — akses mereka mencakup data finansial banyak bisnis pihak ketiga.

#### 1. Developer
**Deskripsi:** Pembuat dan pengelola sistem Kasirio. Akses penuh terhadap aplikasi dan infrastruktur.

**Hak akses:**
- Akses penuh ke seluruh database.
- Mengelola source code dan deployment.
- Mengubah konfigurasi sistem.
- Mengelola API, feature flag, environment, dan maintenance.
- Mengakses seluruh tenant dan seluruh data platform.

**Catatan:** Role ini tidak muncul pada aplikasi pengguna toko. **Setiap akses Developer ke data tenant tertentu wajib tercatat di audit log yang dapat dilihat oleh Owner tenant tersebut** — transparansi ini wajib, bukan opsional, karena menyangkut kepercayaan pengguna terhadap data keuangan mereka.

#### 2. Super Admin
**Deskripsi:** Mengelola operasional platform Kasirio tanpa akses ke source code atau server.

**Hak akses:**
- Mengelola seluruh tenant/toko.
- Mengaktifkan atau menonaktifkan akun toko.
- Mengelola paket langganan dan billing.
- Mengelola voucher dan promo platform.
- Melihat statistik seluruh platform.
- Mengelola support dan verifikasi akun.

**Batasan:** Tidak memiliki akses untuk mengubah kode aplikasi atau konfigurasi server. Sama seperti Developer, akses ke data operasional tenant tertentu (misalnya saat menangani tiket support) wajib tercatat di audit log yang terlihat oleh Owner tenant terkait.

### Level 2 — Tenant / Toko
Role pada level ini dimiliki oleh pengguna bisnis yang menggunakan Kasirio. **Penugasan role disimpan per kombinasi `(userId, tenantId, outletId)`** — `outletId` bernilai `null` berarti akses ke seluruh cabang milik tenant tersebut. Ini wajib dirancang sejak awal skema, supaya fitur multi-cabang (rencana jangka menengah) tidak butuh migrasi ulang skema permission.

#### 3. Pemilik Toko (Owner)
**Deskripsi:** Pemilik bisnis yang memiliki satu atau lebih toko/cabang.

**Hak akses:**
- Mengelola profil bisnis.
- Mengelola cabang (menambah/menutup outlet).
- Mengelola pengguna toko (mengundang, menghapus, mengubah role Admin/Kasir).
- Mengelola paket langganan toko.
- Mengelola seluruh produk, stok, supplier, pelanggan, dan laporan — lintas semua cabang miliknya.
- Mengatur permission Admin dan Kasir, baik menambah izin di atas default role (*grant*) maupun mencabut izin default role (*revoke*) — lihat "Model Permission Override" di bawah.

**Cakupan:** Semua data hanya milik tenant tersebut. Owner adalah role tertinggi di dalam tenant — tidak ada role tenant lain yang dapat mengubah atau menghapus akun Owner.

#### 4. Admin Toko
**Deskripsi:** Pengelola operasional toko yang ditunjuk oleh Owner, discope ke satu cabang tertentu atau seluruh cabang (sesuai penugasan `outletId`).

**Hak akses:**
- Mengelola produk, kategori, stok, supplier, pelanggan.
- Melihat laporan sesuai izin yang diberikan Owner.
- Mengelola promo dan diskon jika diberikan izin.

**Batasan (dipisah menjadi dua jenis agar tidak ambigu):**
- *Batasan terhadap akun Owner:* Admin tidak dapat mengedit profil, permission, atau mencabut akses Owner.
- *Batasan terhadap kelangsungan bisnis:* Admin tidak dapat mengubah paket langganan atau menghapus toko/cabang.

#### 5. Kasir
**Deskripsi:** Pengguna yang fokus pada transaksi penjualan, discope ke satu cabang tempat dia bertugas.

**Hak akses:**
- Membuat transaksi penjualan.
- Retur transaksi (permission: `transaction.refund`).
- Membuka dan menutup shift (`cashSession.open`, `cashSession.close`).
- Melihat riwayat transaksi pribadi.
- Mencetak struk.
- Memproses pembayaran sesuai izin (`payment.process`; `payment.refund` jika diberikan izin tambahan oleh Owner/Admin).

**Batasan:** Tidak dapat mengubah produk, stok, pengguna, atau pengaturan bisnis kecuali diberikan permission khusus oleh Owner/Admin.

---

## Struktur Hierarki

```
Platform
├── Developer
│   └── Super Admin
Tenant / Toko (per tenantId)
├── Pemilik Toko (Owner)      — scope: seluruh cabang
│   ├── Admin Toko            — scope: outletId tertentu atau seluruh cabang
│   │   └── Kasir             — scope: outletId tertentu
```

- Developer dan Super Admin berada di level platform, terpisah total dari akun tenant manapun.
- Owner, Admin, dan Kasir berada di dalam tenant, dan setiap penugasan role membawa scope `outletId` (lihat "Penugasan role" di atas).
- Setiap tenant terisolasi dan tidak dapat melihat data tenant lain — termasuk melalui API, tanpa terkecuali.

---

## Prinsip Permission Kasirio

Kasirio menggunakan kombinasi **Role-Based Access Control (RBAC)** dan **Permission-Based Access Control**.

**Role** menentukan identitas utama dan permission default pengguna (Owner / Admin / Kasir).

**Permission** menentukan kemampuan spesifik, contoh: `product.create`, `product.update`, `product.delete`, `stock.adjust`, `report.view`, `customer.export`, `transaction.refund`, `payment.refund`, `user.manage`.

### Model Permission Override
Setiap penugasan role (`userId`, `tenantId`, `outletId`) memiliki **permission default berdasarkan role**, ditambah tabel override eksplisit yang bisa berupa:
- **Grant** — memberi permission di luar default role (misalnya Kasir tertentu diberi `payment.refund` yang biasanya bukan default Kasir).
- **Revoke** — mencabut permission yang biasanya default untuk role tersebut (misalnya Admin tertentu dicabut haknya untuk `product.delete`).

Resolusi akhir permission seorang pengguna = (permission default role) + (grant override) − (revoke override). Implementasikan ini secara identik di database, API, dan UI agar tidak ada celah di mana satu lapisan mengizinkan sesuatu yang lapisan lain larang.

---

## Aturan Arsitektur

Saat membuat fitur Kasirio di lapisan backend/cloud, selalu ikuti aturan berikut:

1. Pisahkan role Platform dan Tenant secara total — realm/audience autentikasi platform staff harus berbeda dari tenant user.
2. Jangan pernah memberikan akses lintas tenant, dalam kondisi apa pun.
3. Semua data bisnis di database backend multi-tenant harus memiliki `tenant_id` (lihat catatan scope di atas — ini tidak berlaku untuk skema lokal Fase 1).
4. Semua pengguna toko harus memiliki penugasan `(role, outletId, permissionOverrides)` seperti dijelaskan di atas.
5. Owner adalah role tertinggi di dalam tenant.
6. Developer adalah role tertinggi di seluruh platform.
7. Super Admin memiliki akses administrasi platform, tetapi bukan akses source code atau server.
8. Setiap aksi Developer/Super Admin terhadap data tenant tertentu wajib tercatat di audit log yang dapat dilihat Owner tenant tersebut.
9. Role dan permission wajib dapat berfungsi dalam mode offline sesuai "Prinsip Otorisasi Offline" di atas.

---

## Implementasi yang Harus Konsisten

Gunakan struktur role ini untuk lapisan backend/cloud Kasirio (bukan skema lokal Fase 1 yang sudah berjalan, kecuali diminta eksplisit):
- Database schema backend multi-tenant.
- Authentication & Authorization.
- Middleware & API endpoint.
- Dashboard Owner/Admin (web).
- Dokumentasi teknis.
- Audit log dan activity log (termasuk visibilitas aksi platform staff ke Owner tenant).

*(Mobile App dan Web App terpisah belum ada di Kasirio saat ini — abaikan poin ini sampai platform tersebut benar-benar mulai dibangun.)*

Jangan membuat role baru tanpa alasan arsitektur yang jelas. Untuk MVP backend/cloud Kasirio, gunakan hanya lima role inti: Developer, Super Admin, Pemilik Toko (Owner), Admin Toko, dan Kasir.
