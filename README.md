# 🛒 Kasirio POS — Kasir Pintar, UMKM Naik Kelas

> **Kasirio** adalah aplikasi Point of Sale (POS) modern berbasis **Progressive Web App (PWA) Offline-First** yang membantu UMKM Indonesia mengelola penjualan, stok inventori, piutang kasbon, cetak struk, dan laporan bisnis tanpa ketergantungan koneksi internet dan tanpa biaya plugin tersembunyi.

---

## ✨ Fitur Utama

- **🚀 Transaksi Cepat (< 3 Klik):** Antarmuka kasir responsif dengan tombol kalkulator uang pas, diskon instan, dan multi-metode pembayaran (Tunai, QRIS, Transfer, Kasbon).
- **📴 True Offline-First:** Menggunakan database lokal berkinerja tinggi **Dexie.js (IndexedDB)** yang didukung penguncian *Persistent Storage*. Internet mati transaksi tetap jalan 100%.
- **🧾 Dual-Mode Struk Cerdas:**
  - *Scan QR Struk di Layar:* Pelanggan langsung scan struk digital dengan kamera HP sendiri (tanpa kasir minta nomor WA).
  - *Cetak Thermal Fisik:* Dukungan format standar printer thermal 58mm dan 80mm.
- **⏸️ Tahan & Panggil Transaksi (Hold / Recall Multi-Cart):** Menahan antrean pembeli yang masih mengambil barang tanpa membatalkan transaksi sebelumnya.
- **📦 Inventori & Audit Stok:** Riwayat mutasi stok (*Inventory Ledger*), peringatan stok menipis, dan penyesuaian stok.
- **📒 Buku Kasbon & Piutang:** Pencatatan hutang pelanggan dan log cicilan pembayaran.
- **🔊 Virtual Web Soundbox:** Notifikasi audio suara lantang otomatis dari browser kasir saat pembayaran QRIS/tunai berhasil diterima.
- **🛡️ Keamanan Kasir (PIN Gate & Audit Log):** Pembatalan nota (*void*) dan diskon manual besar wajib otorisasi PIN Owner dan dicatat dalam audit log.
- **🪙 Sistem Koin Kasirio:** Model langganan Pro *closed-loop* yang aman dari regulasi uang elektronik Bank Indonesia dan bebas potongan 30% Google Play.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS v4
- **Komponen & UI:** Lucide React, Framer Motion (`motion`), Recharts
- **Penyimpanan Lokal:** Dexie.js (IndexedDB)
- **Aplikasi Web:** Progressive Web App (PWA) via `vite-plugin-pwa`
- **AI Co-Pilot:** Google Gemini Flash API (`@google/genai`)

---

## 🚀 Menjalankan Secara Lokal

1. **Prasyarat:**
   - Node.js (v18 ke atas) & npm

2. **Instalasi Dependensi:**
   ```bash
   npm install
   ```

3. **Menjalankan Server Pengembangan:**
   ```bash
   npm run dev
   ```
   Buka peramban di `http://localhost:3000`.

4. **Build untuk Produksi:**
   ```bash
   npm run build
   npm run preview
   ```

---

## 📚 Dokumentasi Terkait

- [AGENTS.md](AGENTS.md) — Panduan tata kelola, arsitektur, dan aturan kerja AI Agent.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Rencana implementasi teknis bertahap (Fase 1a, 1b, 1c).
- [CHANGELOG.md](CHANGELOG.md) — Riwayat pembaruan dan rilis versi.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Spesifikasi arsitektur sistem dan alur data.
- [KASIRIO_AGENT_KNOWLEDGE_BASE_v1.0.md](KASIRIO_AGENT_KNOWLEDGE_BASE_v1.0.md) — Sumber kebenaran tunggal (*Single Source of Truth*) visi Kasirio.

---

## 📄 Lisensi

Proprietary © 2026 Kasirio. All rights reserved.
