# 🏗️ Arsitektur Sistem & Alur Data Kasirio (PWA Offline-First)

---

## 1. Ikhtisar Arsitektur

Kasirio dirancang dengan pendekatan **Progressive Web App (PWA) Offline-First**, di mana browser client memiliki otonomi penuh untuk menjalankan seluruh transaksi bisnis tanpa ketergantungan pada koneksi internet.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KASIRIO CLIENT BROWSER                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    UI Layer (React 19 + Tailwind)                │  │
│  │   [ POS View ]   [ Inventory ]   [ Reports ]   [ Settings ]      │  │
│  └─────────────────────────────────▲────────────────────────────────┘  │
│                                    │ Reactive State                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │                     POSContext & Store Layer                     │  │
│  │   - Cart & Hold Manager      - Shift & Cash Drawer               │  │
│  │   - Barcode Buffer Engine    - PIN Gate Security                 │  │
│  └─────────────────────────────────▲────────────────────────────────┘  │
│                                    │ Queries & Mutations               │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │            Local Storage Engine (Dexie.js / IndexedDB)           │  │
│  │   [products]      [transactions]      [transactionItems]         │  │
│  │   [stockLogs]     [customers]         [suspendedCarts]           │  │
│  │   [auditLogs]     [cashSessions]      [settings]                 │  │
│  └─────────────────────────────────▲────────────────────────────────┘  │
│                                    │ Storage Lock                      │
│  ┌─────────────────────────────────┴────────────────────────────────┐  │
│  │      Browser Storage Guardian (navigator.storage.persist())      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────▲───────────────────────────────────┘
                                     │ Offline Cache Shell
┌────────────────────────────────────┴───────────────────────────────────┐
│              Service Worker Layer (vite-plugin-pwa)                    │
│      Cache: index.html, JS/CSS bundles, fonts, static assets           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Alur Transaksi Kasir (Offline Checkout Flow)

1. **Input Item:**
   * Kasir memilih produk dari grid visual atau menembak barcode scanner fisik (dideteksi via buffer jeda < 50ms).
   * Item masuk ke state keranjang lokal (`cart`).
2. **Kalkulator Pembayaran:**
   * Menghitung subtotal, diskon (nominal/persen), dan pajak (PPN/PB1).
   * Tombol cepat uang pas menghitung kembalian instan.
3. **Penyimpanan Transaksi (Atomic Multi-Write):**
   * Transaksi disimpan ke tabel `transactions` (Header).
   * Rincian barang disimpan ke tabel `transactionItems` (Normalized).
   * Setiap pengurangan stok dicatat ke tabel `stockLogs` sebagai entri mutasi `SALE`.
   * Jika ada diskon manual > 10%, sistem meminta PIN otorisasi Owner dan mencatatnya ke `auditLogs`.
4. **Penyampaian Struk (Dual-Mode):**
   * Layar kasir menampilkan **Dynamic QR Code Struk** (berisi payload ringkas JSON offline) untuk di-scan oleh pembeli.
   * Opsi cetak kertas thermal 58mm/80mm siap dipicu via tombol cetak.
5. **Notifikasi Virtual Soundbox:**
   * Jika diaktifkan, browser memicu Web Speech API: *"Pembayaran tunai/QRIS sebesar [nominal] rupiah berhasil diterima"*.

---

## 3. Skema Normalisasi Database Lokal (Dexie.js)

* **`products`:** `id` (UUID), `sku`, `barcode`, `name`, `categoryId`, `buyPrice`, `sellPrice`, `stock`, `unit`, `deletedAt`.
* **`transactions`:** `id` (Invoice No), `date`, `paymentMethod`, `subtotal`, `discount`, `tax`, `total`, `amountPaid`, `change`, `cashierName`, `status`, `isAuditFlagged`.
* **`transactionItems`:** `id`, `transactionId`, `productId`, `productName`, `quantity`, `sellPrice`, `buyPrice`, `discount`, `subtotal`.
* **`stockLogs`:** `id`, `productId`, `productName`, `type` (`IN` | `OUT` | `SALE` | `VOID` | `ADJUSTMENT`), `quantity`, `previousStock`, `currentStock`, `notes`, `date`.
* **`suspendedCarts`:** `id`, `label`, `items`, `cartOrderDiscount`, `selectedCustomer`, `createdAt`, `notes`.
* **`auditLogs`:** `id`, `timestamp`, `type` (`VOID` | `MANUAL_DISCOUNT` | `DRAWER_OPEN`), `cashierName`, `details`, `amount`, `relatedTransactionId`.
* **`users`:** `id`, `name`, `role` (`OWNER` | `CASHIER`), `pinHash`.
* **`customers`:** `id`, `name`, `phone`, `totalDebt`, `createdAt`.
* **`koinAccount`:** `id`, `saldoKoin`, `isPro`, `proExpiresAt`, `history`.
* **`settings`:** `id`, `data` (StoreSettings).

---

## 4. Keamanan & Ketahanan Data

1. **Storage Eviction Prevention:**
   * Panggilan `navigator.storage.persist()` mengunci IndexedDB Kasirio agar sistem operasi tidak menghapusnya saat memori HP penuh.
2. **Offline Data Safety Net:**
   * Fitur **Backup Data** mengunduh file `.json` terenkripsi ringan dari seluruh tabel lokal.
   * Fitur **Restore Data** memulihkan seluruh catatan transaksi, hutang pelanggan, dan inventori jika perangkat kasir rusak/diganti.
