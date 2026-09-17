# CHANGELOG — Kasirio POS

Semua perubahan penting pada proyek **Kasirio** akan didokumentasikan dalam berkas ini.
Format penulisan mengikuti standar [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

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
