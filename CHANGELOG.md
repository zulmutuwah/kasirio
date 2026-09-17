# CHANGELOG — Kasirio POS

Semua perubahan penting pada proyek **Kasirio** akan didokumentasikan dalam berkas ini.
Format penulisan mengikuti standar [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.3.0] - 2026-09-17
### Added - Sistem Role & Permission Multi-Tenant (RBAC & PBAC)
- **Kepatuhan Dokumen Acuan Resmi (`docs/KASIRIO_ROLE_PERMISSION_AGENT_PROMPT_v1.0.md`):**
  - Pemisahan ketat: skema lokal Dexie Fase 1 (`src/db/index.ts` & `src/types.ts`) tetap terjaga utuh tanpa modifikasi.
  - Implementasi hierarki 5 role resmi pada lapisan backend/cloud: `DEVELOPER`, `SUPER_ADMIN` (Platform), `OWNER`, `ADMIN` (Admin Toko), dan `CASHIER` (Kasir).
  - Skema database Prisma SQLite & PostgreSQL diperbarui dengan model `UserPermissionOverride` ber-scope `(userId, tenantId, outletId)`.
  - Pelacakan audit transparan pada `AuditLog` dengan `actorRole` dan `actorId` untuk mencatat setiap interaksi platform staff terhadap tenant.
- **Engine Resolusi Permission & Overrides (`src/server/auth.ts`):**
  - Katalog izin terstandarisasi: katalog (`product.*`), stok (`stock.*`), transaksi (`transaction.*`), kasir (`cashSession.*`, `drawer.kick`), laporan (`report.view`), dan manajemen (`user.manage`).
  - Resolusi izin matematis: *(Default Permissions Role)* + *(Grant Override)* − *(Revoke Override)*.
  - Proteksi integritas Owner: akun Pemilik Toko selalu mempertahankan izin penuh dan tidak dapat dicabut haknya.
- **REST API Manajemen Karyawan (`src/server/routes/userRoutes.ts`):**
  - `GET /api/users`: Daftar staf toko dengan resolved permissions dan jumlah override.
  - `POST /api/users`: Pendaftaran karyawan baru dengan validasi role (`ADMIN` / `CASHIER`), scoping cabang, dan hashing PIN kasir.
  - `PUT /api/users/:id`: Edit profil, peran, dan cabang karyawan.
  - `DELETE /api/users/:id`: Hapus akun karyawan dengan proteksi mutlak (akun Owner dilarang dihapus).
  - `GET /api/users/:id/permissions`: Inspeksi izin default dan daftar override aktif.
  - `POST /api/users/:id/permissions/override`: Pemasangan override `GRANT` atau `REVOKE`.
- **Antarmuka UI Owner Backoffice (`OwnerDashboardView.tsx`):**
  - Sub-tab baru **"Manajemen Staf & Hak Akses"** dengan ringkasan hierarki role dan daftar karyawan aktif.
  - Modal **Tambah / Edit Karyawan** dengan pemilihan peran, penugasan cabang toko, dan PIN kasir.
  - Modal **Kustomisasi Hak Akses (Permission Overrides Matrix)** dengan tombol aksi interaktif Grant / Revoke / Reset per item izin.
- **Automated Test Suite:**
  - Penambahan test suite baru `src/tests/rolePermissions.test.ts`. Total **12 test suites (49 unit tests)** Vitest lulus 100%.

## [1.2.0] - 2026-09-17
### Added - FASE 4: Native Wrappers & AI Prediktif
- **Sub-Fase 4a — Native Wrappers & Unified Hardware Bridge:**
  - Konfigurasi Mobile Android/iOS (`capacitor.config.ts`): App ID `id.kasirio.pos`, App Name `Kasirio POS`, aset web `dist/`.
  - Konfigurasi Desktop Windows/macOS/Linux (`src-tauri/tauri.conf.json`): Ukuran default 1280x800, port lokal 3000, build hooks otomatis.
  - Abstraksi Hardware Bridge terpadu [`hardwareBridge.ts`](src/utils/hardwareBridge.ts): deteksi transparan platform Web vs Tauri vs Capacitor, abstraction printing ESC/POS thermal printer (58mm/80mm), perintah pulse buka laci kasir (`openCashDrawer`), dan fallback aman ke browser dialog.
  - Integrasi hardware bridge pada [`ReceiptModal.tsx`](src/components/pos/ReceiptModal.tsx).
  - Skrip runner build & dev native di `package.json` (`desktop:dev`, `desktop:build`, `mobile:sync`).
- **Sub-Fase 4b — AI Smart Reorder Point & Prediksi Stok Toko:**
  - Mesin analitik matematis [`calculateReorderMetrics`](src/server/routes/aiReorderRoutes.ts): menghitung kecepatan penjualan harian (*Daily Sales Velocity*), estimasi hari tersisa sebelum kehabisan stok (*Days Until Stockout*), klasifikasi urgensi (`CRITICAL` <2 hari, `WARNING` 2-5 hari, `SAFE` >5 hari), kuantitas saran kulakan, dan estimasi modal kulakan (Rp).
  - Endpoint REST API Express: `POST /api/ai/smart-reorder` (dengan narasi cerdas Gemini 2.5 Flash / Smart Heuristic Fallback bahasa Indonesia) dan `GET /api/ai/sales-forecast` (proyeksi tren omzet 7 hari ke depan).
  - Komponen UI Cerdas [`SmartReorderWidget.tsx`](src/components/inventory/SmartReorderWidget.tsx) di halaman Produk & Stok [`InventoryView.tsx`](src/components/inventory/InventoryView.tsx): kartu ringkasan KPI urgensi stok, bubble analisis narasi AI, filter urgensi, dan tombol 1-klik *"Restock Cepat"* yang otomatis mengisi kuantitas rekomendasi ke dalam modal penyesuaian stok.
  - Dukungan pre-fill `initialQuantity` dan `initialType="IN"` pada [`StockAdjustmentModal.tsx`](src/components/inventory/StockAdjustmentModal.tsx).
- **Automated Test Suite:**
  - Penambahan 2 test suite baru: `src/tests/hardwareBridge.test.ts` dan `src/tests/smartReorder.test.ts`.
  - Total **11 test suites (43 unit tests)** Vitest lulus 100%.

## [1.1.0] - 2026-09-17
### Added - FASE 3: Pembayaran Otomatis & Komunikasi
- **Sub-Fase 3a — QRIS Dinamis & Webhook Auto-Detection:**
  - Endpoint pembuat tagihan QRIS dinamis (`/api/payment/qris/create`) dengan standar EMVCo/ASPI ber-nominal pas sesuai total belanja kasir.
  - Listener webhook pembayaran resmi (`/api/payment/webhook`) yang kompatibel dengan format notifikasi Midtrans dan Xendit.
  - Endpoint status polling real-time (`/api/payment/qris/status/:orderId`) dan simulator webhook sandbox (`/api/payment/simulate-webhook`).
  - Antarmuka kasir [`PaymentModal.tsx`](src/components/pos/PaymentModal.tsx) dengan visual `QRCodeSVG`, countdown timer kedaluwarsa (5 menit), status polling real-time, dan auto-checkout saat pembayaran berhasil tanpa klik manual.
- **Sub-Fase 3b — Virtual Soundbox Berbasis Webhook:**
  - Modul audio cerdas [`soundbox.ts`](src/utils/soundbox.ts): nada lonceng synthesizer ganda (Web Audio API oscillator C6 & G6) dan sintesis vokal Bahasa Indonesia (Web Speech API) yang mengumumkan nominal: *"Pembayaran QRIS sebesar [Nominal Rupiah] berhasil diterima!"*.
  - Menghilangkan kebutuhan perangkat soundbox fisik terpisah bagi UMKM.
- **Sub-Fase 3c — Notifikasi WhatsApp Official API:**
  - Endpoint pengiriman struk digital resmi (`/api/notifications/whatsapp/receipt`) dengan layout teks nota faktur rapi, rincian barang, total, dan nama kasir.
  - Endpoint pengingat kasbon ramah UMKM (`/api/notifications/whatsapp/debt-reminder`) dengan rincian sisa tagihan dan tanggal jatuh tempo.
  - Integrasi tombol aksi cepat pada [`ReceiptModal.tsx`](src/components/pos/ReceiptModal.tsx) (Kirim Struk WA Otomatis) dan [`CustomersView.tsx`](src/components/customers/CustomersView.tsx) (Ingatkan Kasbon WA).
- **Automated Test Suite:**
  - Penambahan 2 test suite baru: `src/tests/payment.test.ts` dan `src/tests/notifications.test.ts`. Total 35 unit test Vitest lulus 100%.

## [1.0.0] - 2026-09-17
### Added - FASE 2: Backend Cloud, Multi-Device Sync & Remote Owner Dashboard
- **Sub-Fase 2a — Backend API & Database Multi-Tenant (PostgreSQL + Prisma):**
  - Skema database multi-tenant komprehensif (`prisma/schema.prisma` dan `schema.postgresql.prisma`): `Tenant`, `Outlet`, `User`, `Product`, `Category`, `Transaction`, `TransactionItem`, `StockLog`, `Customer`, `DebtPaymentLog`, `CashSession`, `AuditLog`, dan `SyncMutationLog`.
  - Otentikasi JWT berjenjang dan otorisasi Role-Based Access Control (RBAC): peran `OWNER`, `MANAGER`, dan `CASHIER`.
  - Hashing kata sandi dan PIN kasir berbasis `bcryptjs`.
  - REST API terpadu: `/api/auth/register-tenant`, `/api/auth/login`, `/api/auth/verify-pin`, `/api/auth/me`.
- **Sub-Fase 2b — Cloud Sync Engine & Offline Outbox Queue:**
  - Peningkatan skema Dexie ke versi 3 dengan tabel `syncQueue`.
  - Outbox Mutation Engine (`queueMutation`): pencatatan otomatis transaksi, penyesuaian stok ledger, katalog produk, pelunasan kasbon, dan audit log ke antrean lokal saat kasir offline.
  - Delta Synchronization (`/api/sync/pull` dan `/api/sync/push`): sinkronisasi selisih efisien berbasis `lastSyncTimestamp` tanpa transfer data berlebih.
  - Komponen visual `SyncIndicator` di header kasir dengan status koneksi (Online/Offline/Syncing/Error), jumlah antrean outbox, popover info, dan pemicu manual sinkronisasi.
- **Sub-Fase 2c — Remote Owner Dashboard & Backoffice Web:**
  - Modul Backoffice Web (`OwnerDashboardView.tsx`) khusus pemilik toko untuk memantau omzet harian/mingguan dari HP atau laptop jarak jauh.
  - Metrik Konsolidasian: Omzet gabungan seluruh cabang, Laba Kotor (Gross Profit), Margin Laba, dan Rata-rata Nilai Keranjang.
  - Manajemen Multi-Outlet & *Branch Switcher*: filter laporan per cabang toko dan pembukaan cabang baru.
  - Alur *Stock Transfer Orders*: pemindahan stok antar-gudang dan cabang toko dengan pencatatan mutasi ledger otomatis.
- **Sub-Fase 2d — Refactor Modular Stores (Zustand):**
  - Dekomposisi state global ke store modular terisolasi: `useCartStore`, `useCatalogStore`, `useSessionStore`, dan `useSyncStore`.
  - Peningkatan reaktivitas dan isolasi logic transaksi kasir.
- **Automated Test Suite:**
  - Penambahan 3 test suite baru: `src/tests/auth.test.ts`, `src/tests/syncEngine.test.ts`, dan `src/tests/stores.test.ts`. Total 31 unit test Vitest lulus 100%.

## [0.3.0] - 2026-09-17
### Added - Sub-Fase 1c (AI & Monetisasi Terbimbing)
- **Backend Proxy Tipis Gemini AI (`server.ts` & `/api/parse-nota`):** Panggilan multimodal vision Gemini dialihkan ke backend proxy Express lokal agar `GEMINI_API_KEY` tidak bocor ke browser client bundle publik, dilengkapi fallback cerdas offline.
- **AI OCR Nota Pasar Tradisional (`AiNotaOcrModal.tsx`):** Alur ekstraksi belanjaan kulakan berbasis filosofi *Human-in-the-Loop* — kasir dapat meninjau, mengedit tulisan tangan pasar, dan memvalidasi kuantitas serta HPP sebelum otomatis menambah stok toko dan mencatat mutasi ledger `stockLogs`.
- **Integrasi Tombol OCR di Inventori:** Tombol aksi cepat *"AI Nota Pasar (OCR)"* dengan gaya gradien di samping manajemen kategori dan produk pada [InventoryView.tsx](src/components/inventory/InventoryView.tsx).
- **Legal Gating & Sandbox Koin Kasirio:** Banner kepatuhan hukum (*compliance disclaimer*) pada dompet Koin Kasirio di [SettingsView.tsx](src/components/settings/SettingsView.tsx) yang menegaskan model *Closed-Loop Service Token* dan mode simulasi teknis sebelum audit regulasi PBI/PJP Bank Indonesia selesai.
- **Automated Test Suite:** Penambahan unit test Vitest untuk validasi data ekstraksi AI nota dan alur penambahan stok inventori (20 unit tests lolos).

## [0.2.0] - 2026-09-17
### Added - Sub-Fase 1b (Alur Kasir Inti & Hardware)
- **Barcode Buffer Scanner (`useBarcodeScanner`):** Listener global dengan pengukuran latensi inter-keystroke (<50ms) untuk mendeteksi scanner fisik USB/Bluetooth secara presisi dan menambahkan barang langsung ke keranjang belanja.
- **Hold & Recall Antrean Belanja (`RecallModal`):** Fitur menahan keranjang transaksi aktif (`SuspendedCart`) dengan label nomor meja / nama pelanggan, timestamp waktu dibuat, ringkasan item, dan auto-hold saat memanggil pesanan tertahan lain.
- **Dual-Mode Struk Belanja (`ReceiptModal`):**
  - Mode QR Code Mandiri (Offline): Menghasilkan QR Code dinamis berbasis payload JSON ringkas yang dapat dipindai langsung oleh kamera HP pelanggan tanpa internet maupun nomor WhatsApp.
  - Mode Cetak Thermal Fisik: Isolasi CSS print bersih untuk kertas 58mm & 80mm tanpa margin dan header URL browser.
- **Tampilan Kasir Adaptif (Ritel vs F&B):** Penyesuaian antarmuka otomatis berbasis `settings.businessType` (mode list barcode padat untuk Ritel vs mode grid gambar untuk F&B), dilengkapi indikator status hardware scanner aktif.
- **Automated Test Suite:** Penambahan unit test Vitest untuk `BarcodeBuffer` timing threshold dan state machine `Hold & Recall` order (16 unit tests lolos).

## [0.1.5] - 2026-09-17
### Added - Sub-Fase 1a (Fondasi Data & Keamanan)
- **Penyimpanan Offline-First (Dexie.js / IndexedDB):**
  - Database lokal reaktif menggantikan `localStorage` yang terbatas.
  - Normalisasi tabel: Header `transactions` dan rincian baris item `transactionItems`.
  - Sistem *Inventory Movement Ledger* (`stockLogs`) untuk audit mutasi stok secara akuntansi.
  - Penguncian `navigator.storage.persist()` untuk mencegah penghapusan otomatis data browser saat memori perangkat penuh.
  - Fitur Ekspor & Impor Data Manual (Backup / Restore file JSON) sebagai jaring pengaman data offline.
- **PWA (Progressive Web App):**
  - Konfigurasi `vite-plugin-pwa` dengan Service Worker dan manifest `standalone`.
  - Strategi update non-intrusif (`registerType: 'prompt'`) yang tidak memaksa reload saat transaksi kasir sedang berjalan.
- **Alur Kasir Cepat & Hardware:**
  - *Dual-Mode Struk:* QR Code dinamis langsung di layar kasir dengan offline payload + tombol cetak thermal fisik 58mm/80mm.
  - *Pola Barcode Buffer:* Deteksi scanner fisik USB/Bluetooth dengan threshold waktu jeda ketikan (<50ms).
  - *Tahan & Panggil Transaksi (Hold / Recall Multi-Cart):* Antrean belanja dengan label meja/nama pelanggan dan catatan waktu.
  - *Virtual Web Soundbox:* Notifikasi audio suara lantang dari browser kasir saat pembayaran QRIS berhasil diverifikasi.
  - *Toggle Tipe Usaha:* Mode Ritel (fokus barcode & SKU) vs Mode F&B (fokus meja & varian menu).
- **Keamanan & Anti-Fraud:**
  - *PIN Gate:* Aksi sensitif pembatalan nota (*void*) dan diskon manual > 10% meminta otorisasi PIN Owner (tersimpan dalam bentuk hash salt).
  - *Audit Log Kasir:* Pencatatan seluruh aksi void, diskon, dan buka laci kasir manual.
- **Model Bisnis Koin Kasirio:**
  - Skema token utilitas *closed-loop* untuk langganan Pro yang aman dari regulasi uang elektronik Bank Indonesia dan bebas potongan 30% Google Play Store.

### Changed
- **Pembersihan Repositori:**
  - Memindahkan seluruh basis kode AI Studio ke root directory proyek.
  - Menghapus file sementara (`kasirio-pos.zip`, `bun.lock`, `metadata.json`, dan draf riset lama).
  - Menyusun dokumen panduan `AGENTS.md` dan memperbarui `README.md`.

---

## [0.1.0] - 2026-09-16
### Added
- Prototipe awal Kasirio berbasis React 19 + TypeScript + Vite + Tailwind CSS v4 dari Google AI Studio.
- Komponen dasar POS, Inventori produk, Database pelanggan & kasbon, Laporan grafik Recharts, dan Modal Shift Kasir.
