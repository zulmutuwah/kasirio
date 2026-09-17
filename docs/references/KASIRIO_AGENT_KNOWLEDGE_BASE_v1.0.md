# Kasirio — Knowledge Base untuk AI Agent

> Dokumen ini adalah sumber kebenaran (Single Source of Truth) mengenai proyek **Kasirio**.
> Gunakan dokumen ini sebagai konteks utama ketika membantu pengembangan, desain, dokumentasi, maupun strategi bisnis Kasirio.

---

# 1. Identitas Produk

## Nama Produk
**Kasirio**

## Kategori
Point of Sale (POS) & Business Management Platform.

## Tagline
> **Kasir Pintar, UMKM Naik Kelas.**

## Deskripsi Singkat

Kasirio adalah aplikasi Point of Sale (POS) modern yang membantu UMKM mengelola transaksi penjualan, stok, pembelian, pelanggan, keuangan, dan laporan bisnis dalam satu sistem.

Kasirio dirancang agar mudah digunakan oleh pemilik usaha kecil hingga bisnis multi-cabang, dengan konsep **offline-first** dan siap berkembang menjadi platform cloud.

---

# 2. Positioning

Kasirio bukan sekadar aplikasi kasir.

Kasirio diposisikan sebagai:

> **Platform operasional bisnis UMKM yang berpusat pada POS.**

Fokus utamanya adalah membantu pemilik usaha menjalankan toko secara profesional tanpa membutuhkan software ERP yang rumit.

## Target Pengguna

- Warung & Toko Kelontong
- Coffee Shop
- Restoran
- Laundry
- Barbershop
- Bengkel
- Apotek
- Retail Fashion
- Toko Elektronik
- Toko Bangunan
- UMKM Multi Cabang

---

# 3. Visi & Misi

## Visi

Membantu jutaan UMKM Indonesia naik kelas melalui teknologi kasir yang sederhana, modern, dan terjangkau.

## Misi

- Mempermudah operasional bisnis harian.
- Menyatukan penjualan, stok, dan laporan dalam satu aplikasi.
- Menyediakan POS yang dapat digunakan offline maupun online.
- Menjadi fondasi digital bisnis UMKM.

---

# 4. Filosofi Produk

Kasirio dibangun dengan prinsip:

## Simple First

Mudah dipahami bahkan oleh pengguna yang baru pertama kali memakai aplikasi kasir.

## Fast Everyday

Semua aktivitas transaksi harus cepat.

## Offline First

Transaksi tetap berjalan tanpa internet.

## Cloud Ready

Data dapat tersinkronisasi ke cloud ketika internet tersedia.

## Modular

Fitur berkembang melalui modul tanpa membuat aplikasi menjadi rumit.

---

# 5. Konsep Arsitektur

## Offline First

Database lokal menjadi sumber utama transaksi.

## Cloud Sync

Ketika online, data disinkronkan otomatis.

## Multi Device

- Web
- Desktop
- Android Tablet
- Android POS

## Multi Store

Satu akun dapat memiliki banyak toko.

---

# 6. Modul Inti Kasirio

## Dashboard

Fungsi:

- Ringkasan penjualan.
- Omzet.
- Laba.
- Produk terlaris.
- Grafik harian.

## POS / Penjualan

Fitur:

- Transaksi cepat.
- Barcode Scanner.
- QRIS.
- Tunai.
- Transfer.
- Split Payment.
- Draft transaksi.
- Suspend transaksi.
- Retur penjualan.

## Produk

- Produk.
- Variasi.
- Kategori.
- Satuan.
- Barcode.
- SKU.
- Foto Produk.
- Harga beli.
- Harga jual.
- Pajak.

## Inventori

- Mutasi stok.
- Stock opname.
- Penyesuaian stok.
- Transfer stok antar cabang.
- Minimum stock alert.

## Pembelian

- Supplier.
- Purchase Order.
- Penerimaan barang.
- Retur pembelian.

## Pelanggan

- Database pelanggan.
- Riwayat transaksi.
- Poin loyalitas.
- Member.

## Supplier

- Database supplier.
- Hutang supplier.
- Riwayat pembelian.

## Keuangan

- Pengeluaran.
- Pemasukan lain.
- Hutang.
- Piutang.
- Cashflow.

## Laporan

- Penjualan.
- Pembelian.
- Stok.
- Produk.
- Pelanggan.
- Kasir.
- Cabang.
- Laba Rugi.
- Cashflow.

## Pengguna

Role:

- Owner
- Admin
- Kasir
- Staff Gudang

Permission per modul.

---

# 7. Modul Lanjutan (Roadmap)

## CRM

- Customer Notes.
- Segmentasi pelanggan.
- Birthday Reminder.

## Loyalty

- Point.
- Voucher.
- Membership.

## QR Menu

Untuk restoran.

## Online Catalog

Halaman katalog produk online.

## Invoice Digital

Kirim invoice melalui WhatsApp.

## Multi Warehouse

Gudang terpisah.

## Marketplace Connector

Sinkronisasi produk.

## API

REST API untuk integrasi pihak ketiga.

---

# 8. Struktur Menu Aplikasi

Dashboard

Penjualan

Pembelian

Produk

Inventori

Pelanggan

Supplier

Keuangan

Laporan

Cabang

Pengguna

Pengaturan

---

# 9. Model Bisnis

## Freemium

Gratis:

- POS.
- Produk.
- Laporan dasar.

## PRO

- Multi Cabang.
- Backup Cloud.
- CRM.
- Loyalty.
- QR Menu.
- API.
- Online Catalog.
- Multi Warehouse.

## Enterprise

- Unlimited Cabang.
- Unlimited User.
- API Lengkap.
- White Label.
- Dedicated Support.

---

# 10. Nilai Jual (Unique Selling Proposition)

- Offline-first.
- Cloud Sync.
- Multi Cabang.
- Mudah digunakan.
- Cepat.
- Harga terjangkau.
- Siap berkembang bersama bisnis.

---

# 11. Perbedaan Kasirio dengan ERP

Kasirio fokus pada operasional toko.

Bukan sistem ERP perusahaan besar.

Prioritas:

- Penjualan.
- Stok.
- Keuangan sederhana.
- Laporan.

---

# 12. Teknologi yang Direncanakan

Frontend:

- React
- TypeScript
- Tailwind CSS

Backend:

- API-first.
- Cloud Ready.

Database:

- Local database untuk offline.
- Cloud database untuk sinkronisasi.

---

# 13. Prinsip UI/UX

Karakter UI:

- Modern.
- Bersih.
- Cepat.
- Ramah UMKM.

Prioritas:

- Sedikit klik.
- Font besar.
- Tombol mudah disentuh.
- Responsif.

---

# 14. Bahasa Produk

Nada komunikasi:

- Bahasa Indonesia sederhana.
- Profesional.
- Membantu.
- Tidak terlalu teknis.

Contoh:

- "Tambah Produk"
- "Bayar Sekarang"
- "Simpan Draft"

---

# 15. Integrasi Masa Depan

Kasirio akan memiliki integrasi dengan:

- QRIS.
- WhatsApp.
- WooCommerce.
- WordPress.
- Payment Gateway Indonesia.
- Marketplace.
- Email.

---

# 16. Roadmap Pengembangan

## V1

Core POS.

## V2

Keuangan + Inventori lengkap.

## V3

Cloud Sync.

## V4

CRM + Loyalty.

## V5

Marketplace + API + Automation.

---

# 17. Aturan AI Agent Saat Membantu Kasirio

AI Agent harus menganggap hal berikut sebagai aturan tetap.

## Identitas

- Nama selalu **Kasirio**.
- Fokus adalah aplikasi POS.

## Positioning

Jangan menyebut Kasirio sebagai ERP.

## Prioritas Produk

Semua rekomendasi harus mendukung kebutuhan UMKM.

## Arsitektur

Selalu mempertahankan konsep Offline First + Cloud Ready.

## UI

- Modern.
- Minimalis.
- Cepat.
- Mudah digunakan.

## Pengembangan

Setiap fitur baru harus berupa modul yang dapat berkembang tanpa mengganggu modul inti POS.

---

# 18. Ringkasan Singkat (Cheat Sheet)

| Item | Nilai |
|------|--------|
| Nama | Kasirio |
| Jenis Produk | Point of Sale (POS) |
| Fokus | Operasional UMKM |
| Target | Retail, F&B, Jasa, Multi Cabang |
| Konsep | Offline First + Cloud Ready |
| Platform | Web, Desktop, Android |
| Model Bisnis | Freemium, PRO, Enterprise |
| Nilai Utama | Cepat, Mudah, Modern, Modular |

---

**Versi Dokumen:** 1.0 (Genesis)

Dokumen ini menjadi referensi dasar seluruh AI Agent yang bekerja pada proyek Kasirio.
