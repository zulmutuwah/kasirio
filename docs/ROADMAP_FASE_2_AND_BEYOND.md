# Roadmap Strategis Kasirio: Fase 2 & Tahap Lanjutan

> Dokumen acuan pengembangan jangka menengah dan panjang untuk platform **Kasirio POS & Business Management**.
> Melanjutkan keberhasilan Fase 1 (Offline-First Single POS PWA).

---

## Peta Jalan Komprehensif (Overview)

```
[ Fase 1: SELESAI ✅ ]
Offline-First PWA, Dexie v2, Barcode Buffer, Hold/Recall, Dual-Mode Struk, AI OCR Human-in-the-Loop, PIN Gate.
       │
       ▼
[ Fase 2: BACKEND & MULTI-DEVICE SYNC 🟡 (Target Berikutnya) ]
Backend Cloud Multi-Tenant, Bi-directional Sync Engine, Multi-Outlet, Remote Owner Dashboard.
       │
       ▼
[ Fase 3: PEMBAYARAN OTOMATIS & KOMUNIKASI ]
Payment Gateway QRIS Dinamis (Midtrans/Xendit), Notifikasi Struk WhatsApp Otomatis, Tagihan Kasbon Berkala.
       │
       ▼
[ Fase 4: NATIVE HYBRID & PREDICTIVE AI ]
Desktop & Mobile Native Wrappers (Tauri / Capacitor), AI Smart Reorder Point, Laporan Prediksi Omzet.
```

---

## FASE 2: Arsitektur Backend, Multi-Device Sync, & Multi-Outlet

Fokus utama Fase 2 adalah membawa Kasirio dari aplikasi kasir lokal mandiri (*single-device standalone*) menjadi platform multi-perangkat yang tersinkronisasi otomatis ke cloud (*multi-device real-time sync*), sehingga pemilik usaha (Owner) dapat memantau beberapa kasir dan cabang toko secara terpusat dari HP mereka.

### Sub-Fase 2a — Backend Cloud & Multi-Tenant Database
1. **Pilihan Arsitektur Teknologi:**
   - **Framework:** Node.js dengan Fastify atau Express / NestJS (TypeScript murni).
   - **Database Utama:** PostgreSQL (Relasional, ACID compliance untuk data keuangan).
   - **ORM / Query Builder:** Prisma atau Drizzle ORM (type-safe database migration).
2. **Desain Multi-Tenancy (Isolasi Data Toko):**
   - Setiap entitas data terikat pada `tenant_id` (Toko) dan `outlet_id` (Cabang Toko).
   - Skema keamanan Row-Level Security (RLS) atau middleware scoping untuk menjamin tidak ada kebocoran data antar-merchant.
3. **Autentikasi & Otorisasi Berjenjang (RBAC):**
   - Autentikasi menggunakan JWT Access Token (short-lived) + HTTP-only Secure Refresh Token.
   - Peran Pengguna (*Roles*):
     - **Owner:** Akses penuh seluruh cabang, laporan laba rugi, HPP, pengaturan koin, dan PIN otoritas.
     - **Manajer Toko:** Akses kelola stok, penerimaan barang, dan laporan penjualan cabang terkait.
     - **Kasir:** Hanya akses transaksi penjualan, buka/tutup shift, dan input kasbon.

---

### Sub-Fase 2b — Cloud Sync Engine & Resolusi Konflik (Offline-First)
Kasirio tetap mempertahankan prinsip **Offline-First 100%**. Transaksi kasir tidak boleh terhenti sedetik pun jika internet mati.
1. **Outbox Pattern / Mutation Queue (`syncQueue` di IndexedDB):**
   - Setiap mutasi lokal (transaksi baru, potong stok, bayar kasbon) dicatat ke antrean lokal `syncQueue`.
   - Web Worker di background mendeteksi sinyal online (`navigator.onLine` / periodic ping) dan mengirim mutasi secara *batched* ke backend.
2. **Delta Synchronization (Sinkronisasi Selisih):**
   - Kasir hanya mengunduh data yang berubah sejak `lastSyncTimestamp` (menghemat kuota internet dan baterai HP kasir).
3. **Resolusi Konflik Data (Conflict-Free Ledger):**
   - **Transaksi Penjualan:** Tidak pernah konflik karena setiap transaksi memiliki ID UUID unik dan append-only.
   - **Katalog Produk:** Menggunakan model *Last-Write-Wins (LWW)* berbasis `updatedAt` server authority.
   - **Stok Barang:** Menggunakan *Delta Mutasi Ledger* (+N / -N di tabel `stockLogs`), bukan menimpa angka stok absolut, sehingga penjumlahan mutasi dari 2 kasir berbeda tetap akurat.

---

### Sub-Fase 2c — Dashboard Remote Owner (Backoffice Web)
1. **Portal Manajemen Terpisah (`/admin` / `backoffice.kasirio.id`):**
   - Pemilik toko dapat membuka browser di laptop/HP di mana saja untuk melihat penjualan real-time.
2. **Manajemen Multi-Outlet / Multi-Cabang:**
   - Pindah antar-cabang toko (*Branch Switcher*).
   - Mutasi stok antar-cabang (*Transfer Stock Order* dari Gudang Utama ke Cabang).
3. **Laporan Konsolidasian:**
   - Total omzet gabungan seluruh cabang.
   - Cabang dengan performa terbaik dan produk terlaris lintas outlet.

---

### Sub-Fase 2d — Refactoring Modular Store (Zustand)
1. **Memecah `POSContext.tsx`:**
   - Memisahkan logic bisnis kasir menjadi store modular terisolasi:
     - `cartStore`: state keranjang, hold/recall antrean.
     - `catalogStore`: produk, kategori, pencarian.
     - `cashierSessionStore`: buka/tutup shift kasir, rekonsiliasi laci.
     - `billingStore`: koin kasirio dan masa aktif Pro.
2. **Manfaat:** Mencegah *God Object*, mempercepat rendering UI, dan mempermudah penulisan unit test otomatis per modul.

---

## FASE 3: Ekosistem Pembayaran Otomatis & Notifikasi

1. **Integrasi QRIS Dinamis (Payment Gateway):**
   - Menghubungkan Kasirio ke agregator pembayaran (misal: Midtrans, Xendit, atau DOKU).
   - Saat kasir memilih metode QRIS, layar memunculkan QRIS dengan nominal pas dan listener webhook yang otomatis mendeteksi ketika pembeli sudah membayar (kasir tidak perlu konfirmasi manual lagi).
2. **Virtual Soundbox Berbasis Webhook:**
   - Begitu webhook QRIS sukses diterima cloud, WebSocket mengirim sinyal ke kasir dan browser membunyikan suara: *"Pembayaran QRIS Rp 45.000 Berhasil Diterima"*.
3. **Notifikasi Struk WhatsApp Otomatis (Official BSP / WABA):**
   - Pengiriman struk digital resmi via WhatsApp Business API tanpa membuka tab browser baru.
   - Notifikasi pengingat jatuh tempo kasbon kepada pelanggan setia secara sopan.

---

## FASE 4: Native Hybrid Wrappers & AI Prediktif

1. **Desktop & Mobile Native Wrappers:**
   - **Desktop (Windows/macOS):** Menggunakan **Tauri** (sangat ringan <15MB, memori rendah, akses port USB/Serial printer langsung).
   - **Mobile (Android Tablet & HP):** Menggunakan **Capacitor** dengan plugin thermal printer Bluetooth ESC/POS langsung.
2. **AI Smart Reorder Point (Kulakan Cerdas):**
   - AI menganalisis laju penjualan mingguan dan otomatis merekomendasikan tanggal kulakan:
     > *"Beras Ramos tersisa 12 kg, diprediksi habis dalam 2 hari ke depan. Disarankan kulakan minimal 50 kg sebelum hari Jumat."*

---

## Matriks Prioritas Kerja Segera (Next Immediate Action)

| Urutan | Modul Kerja | Bobot | Estimasi Waktu |
|---|---|---|---|
| **1** | **Sub-Fase 2a:** Desain Database PostgreSQL, Prisma Schema, dan Auth API Multi-Tenant | Tinggi | Sprint 1 |
| **2** | **Sub-Fase 2b:** Sync Engine (Outbox Queue di Dexie & Endpoint Sync di Backend) | Kritis | Sprint 2 |
| **3** | **Sub-Fase 2c:** Remote Web Dashboard untuk Owner (Pantau Omzet dari HP) | Sedang | Sprint 3 |
| **4** | **Sub-Fase 2d:** Refactor `POSContext` ke modular Zustand stores | Rendah | Sprint 4 |
