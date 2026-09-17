# AGENTS.md — Panduan & Aturan AI Agent Proyek Kasirio

> Dokumen ini adalah acuan operasional bagi seluruh AI Agent (Antigravity / Gemini / Claude / ChatGPT / Cursor) yang bekerja pada repositori proyek **Kasirio**.
> Dokumen ini wajib dibaca dan dipatuhi sebelum menyarankan atau melakukan modifikasi kode apa pun.

---

## 1. Aturan Mutlak Tata Kelola (Governance & Safety Rules) ⚠️

1. **Konfirmasi Manual Mutlak:**
   - **JANGAN PERNAH** mengeksekusi perubahan kode, perintah terminal, migrasi, atau penghapusan file tanpa konfirmasi/persetujuan eksplisit dari User.
   - Bahkan jika sistem tools otomatis memberikan sinyal persetujuan (*auto-approval hook*), Agent **tetap wajib** berhenti dan meminta konfirmasi manual dari User.
2. **Prosedur Permintaan Review:**
   - Jika User meminta rencana atau kode untuk "di-review", Agent bertugas memaparkan analisis/perubahan secara jelas dan padat.
   - Agent **wajib mengakhiri respons dengan pertanyaan eksplisit**:
     > *"Apakah hasil review ini disetujui atau ditolak/ada revisi?"*
   - Agent **dilarang langsung melompat ke eksekusi** sebelum User menjawab secara manual.

---

## 2. Identitas & Filosofi Produk Kasirio

* **Nama Produk:** Kasirio
* **Kategori:** Point of Sale (POS) & Business Management Platform UMKM.
* **Tagline:** *"Kasir Pintar, UMKM Naik Kelas."*
* **Positioning:** Platform operasional bisnis UMKM yang berpusat pada POS. **Bukan ERP korporasi yang rumit.**
* **Prinsip Inti:**
  * **Simple First:** Antarmuka mudah dipahami orang awam, font besar, tombol ramah sentuh.
  * **Fast Everyday:** Transaksi selesai dalam < 3 klik, perhitungan kembalian instan, barcode scanner responsif.
  * **Offline-First:** IndexedDB (Dexie.js) adalah sumber utama data transaksi kasir lokal. Internet mati, kasir tetap jualan 100% lancar.
  * **PWA Web-First:** Cukup buka di browser (Chrome/Edge/Safari), dapat di-install di Desktop PC maupun HP tanpa download installer/APK berat.

---

## 3. Keputusan Arsitektur Kunci (Approved Architectural Decisions)

1. **Penyimpanan Lokal (IndexedDB via Dexie.js):**
   - Menggantikan `localStorage` yang terbatas dan lambat.
   - Mengaktifkan `navigator.storage.persist()` untuk mencegah browser menghapus data saat memori penuh (*storage eviction*).
   - Skema transaksi dinormalisasi: Header transaksi di tabel `transactions`, rincian baris barang di `transactionItems`.
   - Mutasi stok berbasis *Inventory Ledger* (`stockLogs`), bukan penimpaan angka stok secara membabi buta.
2. **Struk Belanja Dual-Mode:**
   - Default: Layar kasir menampilkan **Dynamic QR Code Struk** dengan payload offline ringkas (pembeli scan sendiri pakai kamera HP).
   - Opsi fisik: Tombol *"Cetak Thermal"* 58mm/80mm menggunakan CSS print bersih tanpa header URL browser bawaan.
3. **Sistem Monetisasi Koin Kasirio:**
   - Menggunakan konsep **Koin Kasirio (Closed-Loop Service Token)** untuk berlangganan paket Pro.
   - Alasan: Aman dari regulasi penampungan saldo rupiah Bank Indonesia (PBI Uang Elektronik/PJP), aman dari potongan 30% Google Play Store, dan memungkinkan auto-potong masa aktif bulanan bagi UMKM yang tidak memiliki kartu kredit.
4. **Keamanan Transaksi Kasir (PIN Gate):**
   - Aksi sensitif (Void transaksi, diskon manual besar > 10%) meminta PIN otorisasi Owner.
   - Seluruh aksi sensitif dicatat dalam `auditLogs` dan disorot di laporan keuangan.
5. **AI Co-Pilot (Human-in-the-Loop):**
   - Fitur OCR Nota Pasar Tradisional wajib melalui layar konfirmasi/tabel review kasir sebelum masuk ke stok utama toko.
   - Panggilan API Gemini wajib melalui backend proxy tipis agar API Key tidak bocor di bundle JavaScript browser publik.

---

## 4. Struktur Direktori Proyek

```
Kasirio/
├── src/
│   ├── components/       # Komponen UI modular
│   │   ├── pos/          # Layar Kasir, Keranjang, Modal Bayar, Struk
│   │   ├── inventory/    # Manajemen Produk, Kategori, Mutasi Stok, AI OCR
│   │   ├── customers/    # Database Pelanggan & Buku Kasbon
│   │   ├── reports/      # Laporan Omzet, Laba Rugi, & Audit Log Kasir
│   │   ├── settings/     # Pengaturan Toko, Toggle Tipe Usaha, Koin Kasirio
│   │   ├── shift/        # Buka / Tutup Shift Kasir & Rekonsiliasi Laci
│   │   └── shortcuts/    # Modal Pintasan Keyboard (F1-F12, Space, Enter)
│   ├── context/          # POSContext (State Management Global)
│   ├── db/               # Dexie.js Database (IndexedDB Schema & Seeding)
│   ├── data/             # Data awal & pengaturan default toko
│   ├── types.ts          # TypeScript domain interfaces & types
│   ├── utils/            # Format rupiah, tanggal, barcode buffer, Gemini service
│   ├── App.tsx           # Layout shell & navigasi tab
│   └── main.tsx          # Entry point aplikasi React
├── docs/                 # Dokumentasi arsitektur & panduan teknis
├── IMPLEMENTATION_PLAN.md# Rencana implementasi teknis v2 yang disetujui
├── KASIRIO_AGENT_KNOWLEDGE_BASE_v1.0.md # Single Source of Truth
├── CHANGELOG.md          # Riwayat perubahan proyek
└── package.json          # Dependensi Vite, React 19, Dexie, Tailwind v4
```

---

## 5. Rencana Kerja Bertahap (Fase 1 Sub-Phases)

* **Fase 1a — Fondasi Data & Keamanan:** Git baseline, Dexie schema normalisasi, Backup/Restore JSON manual, PIN Gate untuk void/diskon.
* **Fase 1b — Alur Kasir Inti & Hardware:** Barcode buffer (<50ms timing), Hold/Recall antrean, Dual-Mode QR struk & cetak thermal fisik, Toggle Ritel vs F&B.
* **Fase 1c — AI & Monetisasi:** Proxy backend Gemini AI, Review modal OCR nota belanja pasar, Koin Kasirio billing interface (digerbang validasi legal).
