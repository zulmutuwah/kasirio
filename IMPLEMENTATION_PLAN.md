# 📋 Implementation Plan: Kasirio PWA (Fase 1 Production-Ready)

> **Revisi v2** — Dokumen ini telah direvisi berdasarkan CTO review internal dan cross-review kedua (ChatGPT). Setiap perubahan ditandai dengan label status. Struktur fase dipecah menjadi tiga sub-fase berbasis risiko, bukan satu rilis besar.

Membangun dan mematangkan aplikasi kasir digital **Kasirio** berbasis **Progressive Web App (PWA) Offline-First** dengan mengadopsi dan menyempurnakan basis kode prototipe AI Studio yang sudah ada menjadi sistem produksi yang siap pakai oleh UMKM Indonesia.

## Label Status

| Label | Arti |
|---|---|
| ✅ **DIPERTAHANKAN** | Ide asli sudah benar, tidak diubah. |
| 🟡 **DIKOREKSI** | Ide asli benar arahnya, tapi detail implementasi diubah karena ada risiko. |
| 🆕 **BARU DITAMBAHKAN** | Tidak ada di plan asli, ditambahkan karena celah kritis. |
| ⛔ **DITUNDA** | Ada di salah satu review sebelumnya, sengaja **tidak** dikerjakan di Fase 1 karena spekulatif/prematur — dijelaskan alasannya supaya tidak dikerjakan ulang tanpa sadar. |

---

## Ringkasan Perubahan Struktural

Plan asli menggabungkan **semua** hal (migrasi storage, infra PWA, hardware, AI, monetisasi, audit, UX) jadi satu rilis "Fase 1". Ini beresiko *big-bang release* — kalau ada bug, sulit tahu bagian mana yang menyebabkannya, dan bagian paling berisiko (migrasi data) tercampur dengan bagian paling tidak pasti (AI, monetisasi).

**Perubahan:** Fase 1 dipecah jadi 3 sub-fase berurutan, masing-masing punya gate (tidak lanjut ke sub-fase berikutnya sebelum yang sebelumnya beres & diverifikasi):

- **Fase 1a — Fondasi Data & Keamanan** (paling berisiko kalau salah, paling murah dibetulkan sekarang)
- **Fase 1b — Alur Kasir Inti & Hardware** (fitur yang langsung dipakai kasir tiap hari)
- **Fase 1c — AI & Monetisasi** (paling tidak pasti, digerbang oleh legal review)

---

## Fase 1a — Fondasi Data & Keamanan

### 1. Root Setup & PWA Foundation ✅ DIPERTAHANKAN

- Pindahkan file dari `kasirio-pos-ai-studio/` ke root workspace.
- Pasang dan konfigurasi `vite-plugin-pwa` untuk Service Worker, manifest aplikasi, ikon emerald modern, dan offline caching.

**🆕 Tambahan wajib — Git repository.**
- **Risiko kalau tidak dilakukan:** Tidak ada version control berarti tidak ada cara rollback kalau migrasi Dexie merusak data, tidak ada jejak review kode, dan kesalahan besar (misalnya salah query yang menghapus tabel) tidak bisa di-undo.
- **Dampak:** Kehilangan kerja tanpa cara pulih, terutama saat migrasi schema database di section 2 di bawah — migrasi adalah operasi yang secara alami berisiko tinggi.
- **Solusi:** `git init` + commit baseline **sebelum** menyentuh kode apa pun. Setiap perubahan schema Dexie (section 2) wajib jadi commit terpisah agar mudah di-bisect kalau ada bug data.

**🆕 Tambahan wajib — Strategi update Service Worker.**
- **Risiko:** PWA offline-first yang cache-nya agresif bisa membuat kasir "terjebak" di versi lama, atau lebih buruk, service worker reload paksa halaman di tengah transaksi aktif saat versi baru terdeteksi.
- **Dampak:** Transaksi yang sedang diinput bisa hilang total kalau reload terjadi di tengah proses bayar — ini kerugian finansial langsung bagi pemilik toko.
- **Solusi:** Gunakan strategi `registerType: 'prompt'` (bukan `autoUpdate`) pada `vite-plugin-pwa`. Tampilkan notifikasi non-intrusif "Update tersedia — muat ulang" yang hanya aktif ketika keranjang kosong / tidak ada transaksi berjalan, bukan auto-reload.

---

### 2. Database & Storage Layer (Offline-First) 🟡 DIKOREKSI

#### [db.ts](file:///c:/Users/LOQ/Downloads/Kasirio/src/db/index.ts)

Ide dasar (Dexie.js menggantikan localStorage) **benar dan wajib** — localStorage punya batas ±5MB, sifatnya blocking/synchronous, dan mudah corrupt saat ditulis berulang kali oleh transaksi kasir. Namun **schema di plan asli mengikuti bentuk UI, bukan bentuk domain bisnis**, yang akan menyulitkan laporan dan migrasi ke cloud nanti. Detail koreksi:

| Tabel | Status asli | Koreksi | Risiko kalau tidak dikoreksi |
|---|---|---|---|
| `products` | Ada | 🟡 Tambah `id` sebagai **UUID** (bukan angka increment), tambah `createdAt`, `updatedAt`, `deletedAt` (soft-delete) | Kalau nanti sinkronisasi ke cloud/multi-device, ID angka increment akan bentrok antar device. Menambah field ini belakangan berarti migrasi ulang seluruh data produksi yang sudah berjalan. |
| `transactions` | Item disimpan sebagai array di dalam satu row | 🟡 **Pisah jadi 2 tabel**: `transactions` (header: id, tanggal, total, metode bayar, kasir) + `transactionItems` (baris per item: transactionId, productId, qty, harga, hpp, diskon, subtotal) | Item tersimpan sebagai JSON blob membuat query "produk terlaris" atau "laba per SKU" harus mem-parse & mem-scan seluruh riwayat transaksi di JS — lambat begitu data ribuan transaksi, dan tidak bisa diindeks Dexie. |
| stok produk | Field `stock` diubah langsung tiap transaksi | 🆕 **Inventory Movement Ledger** — tambah tabel `stockLogs` yang mencatat setiap pergerakan (`SALE -5`, `RESTOCK +20`, `ADJUSTMENT -2`, `VOID +5`); nilai stok akhir **dihitung dari akumulasi log**, bukan field independen yang ditimpa berulang | Field mutable yang ditimpa berulang kali rawan *drift* (nilai stok tercatat vs riwayat aktual tidak match) kalau ada race condition antara dua aksi (misal void transaksi bersamaan dengan restock). Tanpa ledger, "kenapa stok jadi segini" tidak bisa dijawab — audit stok jadi mustahil dilakukan mundur. |
| — | Tidak ada | 🆕 Tambah tabel `users` (nama, PIN hash, role) dan `cashSessions` (buka/tutup shift kasir) | Lihat detail risiko keamanan di section 3 (PIN Gate). |

**Risiko keseluruhan kalau schema tidak dikoreksi sekarang:** Semua koreksi di atas murah dilakukan **sebelum** ada data produksi nyata, tapi sangat mahal setelah UMKM mulai memakai aplikasi ini untuk mencatat transaksi harian — migrasi schema pada database yang sudah berisi data riil membawa risiko kehilangan/korupsi data transaksi keuangan yang sudah tercatat.

**🆕 Tambahan wajib — Export/Import Data Manual.**
- **Risiko:** Seluruh data (transaksi, hutang pelanggan, audit log) hidup 100% di IndexedDB satu perangkat. `navigator.storage.persist()` mengurangi kemungkinan browser menghapus data saat memori penuh, tapi tidak melindungi dari: HP/laptop rusak atau hilang, user tidak sengaja clear data browser, ganti device saat upgrade usaha.
- **Dampak:** Kehilangan seluruh riwayat transaksi dan catatan hutang-piutang pelanggan secara permanen — ini bukan sekadar bug teknis, tapi kehilangan bukti keuangan riil pelaku usaha.
- **Solusi:** Tambahkan tombol **"Backup Data"** di Settings yang meng-export seluruh tabel Dexie ke satu file JSON terenkripsi ringan (atau minimal terkompresi), dan **"Restore Data"** untuk impor kembali. Ini pengerjaan yang murah (hitungan jam) dan tetap berguna terlepas dari apakah sinkronisasi cloud (lihat Fase 1c/DITUNDA) pernah dibangun atau tidak — anggap ini jaring pengaman minimum, bukan fitur premium.

---

### 3. Keamanan & Otorisasi Aksi Sensitif 🆕 BARU DITAMBAHKAN

Plan asli mencatat aksi sensitif (void transaksi, diskon manual, buka laci) ke `auditLogs`, tapi **audit log hanya mendeteksi setelah kejadian — tidak mencegah**.

- **Risiko:** Tanpa PIN otorisasi, kasir biasa (bukan hanya pemilik/manager) bisa melakukan void transaksi atau memberi diskon besar kapan saja. Audit log yang tercatat rapi tidak ada gunanya kalau tidak pernah dicek oleh pemilik toko.
- **Dampak:** Ini celah kecurangan finansial langsung untuk toko dengan lebih dari satu karyawan — target pasar utama "UMKM naik kelas" yang disebut di deskripsi produk kemungkinan besar punya lebih dari satu kasir.
- **Solusi:**
  1. Tambah tabel `users` (nama, PIN hash — jangan simpan PIN plaintext, gunakan hash sederhana seperti bcrypt-lite atau SHA-256 dengan salt lokal) dan `roles` (`OWNER`, `CASHIER`).
  2. Void transaksi dan diskon manual di atas ambang tertentu (misal >10% atau nominal tertentu) **wajib** meminta PIN role `OWNER` sebelum diproses, bukan hanya dicatat.
  3. Buka laci kasir tanpa transaksi (`DRAWER_OPEN` manual) tetap dicatat di audit log seperti rencana asli, tapi log ini sekarang punya nilai karena aksi void/diskon sudah tersaring oleh PIN gate — audit log jadi lapisan kedua, bukan satu-satunya lapisan.

---

## Fase 1b — Alur Kasir Inti & Hardware

### 4. Modul Kasir POS & Hardware 🟡 DIKOREGSI (sebagian)

#### [POSView.tsx](file:///c:/Users/LOQ/Downloads/Kasirio/src/components/pos/POSView.tsx)

**Barcode Listener 🟡 DIKOREKSI.**
Plan asli: "Global Barcode Keydown Listener" — ide dasarnya benar (scan barcode otomatis masuk keranjang tanpa fokus mouse), tapi implementasi naif (`window.addEventListener('keydown', ...)` tanpa filter waktu) akan salah membedakan input scanner fisik dari user yang mengetik cepat di keyboard.

- **Risiko:** Listener keydown polos menganggap ketikan manusia yang kebetulan cepat sebagai barcode scan, atau sebaliknya gagal mendeteksi scan asli kalau ada jeda render di antaranya.
- **Dampak:** Produk salah masuk ke keranjang secara tidak sengaja saat kasir mengetik di field lain, atau scan barcode fisik tidak terdeteksi sama sekali — mengganggu alur transaksi yang seharusnya jadi fitur andalan kecepatan.
- **Solusi — pola "Barcode Buffer":** Kumpulkan karakter `keydown` ke dalam buffer. Ukur jeda waktu antar karakter. Scanner barcode fisik mengirim karakter dengan jeda **<50ms**, jauh lebih cepat dari kemampuan mengetik manusia. Kalau seluruh buffer masuk dalam ambang waktu itu dan diakhiri `Enter`, baru dianggap hasil scan dan diproses sebagai barcode; kalau tidak, biarkan sebagai input keyboard biasa. Ini adalah teknik standar di sistem POS profesional, bukan penyempurnaan kosmetik.

**Toggle Ritel vs F&B ✅ DIPERTAHANKAN (dengan catatan cakupan).**
- Ide toggle Ritel/F&B tetap dipakai seperti rencana asli: mode list ringkas untuk Ritel, mode grid+meja untuk F&B.
- **Catatan penting (lihat bagian DITUNDA):** implementasikan ini sebagai **rendering kondisional berbasis `businessType`** di dalam komponen yang sudah ada, **bukan** sebagai arsitektur plug-in modul terpisah per jenis usaha. Alasan detail ada di bagian "Hal yang Sengaja Ditunda" di bawah.

#### [CartPanel.tsx](file:///c:/Users/LOQ/Downloads/Kasirio/src/components/pos/CartPanel.tsx)

**Hold/Recall Transaksi ✅ DIPERTAHANKAN + 🆕 detail tambahan.**
Fitur dasar sudah tepat. Tambahan field agar lebih berguna di lapangan:

| Field tambahan | Alasan |
|---|---|
| Label (Meja/Pelanggan/Warna) | Memudahkan kasir mengenali antrean tertahan secara visual, penting saat antrean lebih dari 3-4 pesanan di jam ramai. |
| Waktu dibuat | Supaya kasir tahu pesanan mana yang sudah lama ditahan dan berpotensi terlupa. |
| Status (Draft/Hold/Completed) | Membedakan pesanan yang benar-benar ditahan vs baru draft, mencegah dobel proses. |

#### [ReceiptModal.tsx](file:///c:/Users/LOQ/Downloads/Kasirio/src/components/pos/ReceiptModal.tsx)

**Dual Mode Struk 🟡 DIKOREKSI.**
Konsep QR Struk + Cetak Thermal tetap dipertahankan sebagai salah satu ide terbaik di plan ini, tapi ada dua koreksi penting:

1. **Isi QR jangan bergantung pada URL cloud yang belum ada.**
   - **Risiko:** Plan asli menyebut QR mengarah ke `kasirio.id/r/[TRX_ID]` — sebuah endpoint cloud yang belum dibangun di Fase 1. Kalau QR di-generate menunjuk URL yang belum aktif, fitur ini akan tampak rusak/tidak berfungsi bagi pengguna pertama, padahal aplikasi ini offline-first.
   - **Solusi:** Untuk Fase 1, encode payload struk **langsung sebagai JSON di dalam QR** (nomor transaksi, nama toko, total, tanggal) sehingga tetap bisa dipindai dan dibaca kamera HP pelanggan **tanpa koneksi internet apa pun**. URL `kasirio.id/r/[TRX_ID]` yang menampilkan struk digital penuh via web baru dibangun saat fase cloud benar-benar ada — jangan janjikan fitur yang bergantung infrastruktur yang belum berdiri.

2. **Validasi cetak thermal dengan hardware fisik, jangan asumsikan `window.print()` + CSS cukup.**
   - **Risiko:** `window.print()` dengan CSS `@media print` bekerja di simulasi browser desktop, tapi banyak printer thermal Bluetooth/USB 58mm/80mm yang umum dipakai warung/UMKM Indonesia butuh command ESC/POS langsung, dan dialog print bawaan Android Chrome sering tidak stabil untuk printer thermal.
   - **Dampak:** Fitur cetak struk — kebutuhan paling dasar sebuah aplikasi kasir — bisa gagal total di lapangan meski lolos testing di laptop developer.
   - **Solusi:** Uji coba dengan minimal satu printer thermal fisik 58mm dan satu 80mm sebelum menganggap fitur ini selesai. Kalau `window.print()` terbukti tidak stabil di Android, evaluasi Web Bluetooth API untuk komunikasi ESC/POS langsung sebagai fallback.

---

## Fase 1c — AI & Monetisasi (Digerbang, Bukan Dihapus)

⚠️ **Sub-fase ini tidak dimulai sebelum Fase 1a dan 1b selesai diverifikasi, dan sebelum item legal di bawah beres.**

### 5. Modul AI & Laporan Cerdas 🟡 DIKOREKSI (prioritas & keamanan, bukan fitur)

#### [geminiService.ts](file:///c:/Users/LOQ/Downloads/Kasirio/src/utils/geminiService.ts)

**Risiko kebocoran API key 🆕 BARU DITAMBAHKAN.**
- **Risiko:** `@google/genai` dipanggil langsung dari kode client (PWA statis tanpa backend server). `.env.example` mengasumsikan AI Studio menyuntik `GEMINI_API_KEY` saat runtime, tapi begitu proyek di-build sebagai aplikasi produksi biasa dengan Vite, environment variable semacam ini gampang ikut ter-bundle ke JavaScript yang dikirim ke browser pengguna.
- **Dampak:** API key yang bocor di client bundle bersifat publik — siapa pun bisa mengambilnya lewat DevTools/Network tab dan memakainya untuk menghabiskan kuota/biaya API milik Kasirio, atau disalahgunakan untuk tujuan lain.
- **Solusi:** Panggilan ke Gemini **wajib** lewat proxy backend tipis (misalnya endpoint Express — `express` sudah ada sebagai dependency di `package.json`), bukan langsung dari browser. API key hanya hidup di server, client hanya memanggil endpoint `/api/parse-nota` milik Kasirio sendiri.

**Prioritas fitur ✅ DIPERTAHANKAN, waktu pengerjaan 🟡 DIKOREKSI.**
- `parseNotaPasar()` (OCR nota belanja) dan `generateBusinessBriefing()` (ringkasan naratif laba/rugi) tetap fitur yang bagus, tapi **AI bukan fitur inti sebuah aplikasi kasir** — kalau dipaksakan masuk sprint awal pengembangan, ini akan memperlambat penyelesaian fitur dasar (section 1-4 di atas) yang justru dipakai kasir setiap hari.
- **Solusi:** Kerjakan AI OCR & briefing setelah Fase 1a+1b stabil dan sudah divalidasi minimal oleh satu UMKM nyata.

#### [AiNotaOcrModal.tsx](file:///c:/Users/LOQ/Downloads/Kasirio/src/components/inventory/AiNotaOcrModal.tsx)

✅ **DIPERTAHANKAN** — desain human-in-the-loop (kasir review hasil bacaan AI sebelum disimpan ke stok) sudah benar. Ini mencegah kesalahan baca AI langsung merusak data stok tanpa verifikasi manusia. Tidak ada perubahan.

---

### 6. Koin Kasirio & Monetisasi 🟡 DIKOREKSI — digerbang legal review

#### [SettingsView.tsx](file:///c:/Users/LOQ/Downloads/Kasirio/src/components/settings/SettingsView.tsx)

**Risiko kepatuhan regulasi 🆕 BARU DITAMBAHKAN.**
- **Risiko:** Plan asli menyatakan sebagai fakta bahwa "Koin Kasirio (Closed-Loop Service Token) sesuai regulasi Bank Indonesia untuk menghindari kewajiban izin uang elektronik". Ini adalah **kesimpulan hukum**, bukan keputusan teknis — belum ada konfirmasi dari legal/konsultan compliance bahwa desain closed-loop token ini benar-benar memenuhi definisi pengecualian BI.
- **Dampak:** Kalau asumsi ini keliru setelah produk sudah dipakai banyak UMKM dan menyimpan saldo koin riil milik mereka, seluruh model bisnis "Pro subscription via Koin" harus dirombak di tengah jalan — berpotensi masalah hukum dan kepercayaan pengguna yang sudah top-up.
- **Solusi:** Sebelum fitur top-up/beli paket Koin dibuka ke pengguna nyata (bukan sekadar dikoding), validasikan desain closed-loop token ini ke konsultan hukum/compliance yang paham regulasi e-money BI. Implementasi teknis (`topupKoin`, `deductKoinForPro` — sudah ada di [POSContext.tsx](src/context/POSContext.tsx)) boleh tetap dikerjakan paralel, tapi **tombol pembelian real ke pengguna** ditahan sampai validasi ini selesai.

**Pemisahan arsitektur billing 🟡 DIKOREKSI.**
- Logic Koin/billing sebaiknya dipisah dari logic POS inti (bukan bercampur di satu context besar) — lihat section 7 di bawah soal `POSContext`. Ini memudahkan audit khusus terhadap alur uang/koin secara terisolasi, terlepas dari alur transaksi kasir.

---

### 7. Refactor `POSContext` 🟡 DIKOREKSI (opsional, prioritas rendah di Fase 1)

[POSContext.tsx](src/context/POSContext.tsx) saat ini sudah mendekati 900 baris dan menampung semua logic (cart, transaksi, hold/recall, void, koin, laporan). Proyeksi ke depan bisa mencapai 1500-2000 baris kalau semua fitur di atas ditambahkan tanpa dipecah.

- **Risiko:** Satu file besar yang menampung semua state & logic bisnis ("God Object") menyulitkan maintenance — perubahan kecil di satu fitur berisiko menyenggol fitur lain yang tidak terkait, dan sulit ditest secara terisolasi.
- **Dampak:** Bug regresi lebih sering terjadi, waktu onboarding developer baru (kalau tim bertambah) lebih lama.
- **Solusi:** Pecah jadi store modules terpisah (`cart.store`, `product.store`, `transaction.store`, `settings.store`, `customer.store`, `audit.store`) menggunakan state management ringan (misal Zustand) + Dexie reactive hooks, dengan React Context hanya untuk state global ringan (misal user yang login, tema).
- **Catatan prioritas:** Ini **boleh dikerjakan bertahap**, bukan blocker sebelum fitur lain jalan. Refactor struktur kode tidak mengubah perilaku yang dilihat pengguna — lakukan setelah Fase 1a (data safety) selesai, sebagai pekerjaan rumah teknis yang berjalan paralel dengan Fase 1b/1c.

---

## Hal yang Sengaja Ditunda (⛔ Jangan Dikerjakan di Fase 1)

Bagian ini penting: dua review sebelumnya (internal & cross-review) memunculkan beberapa saran arsitektur yang **terdengar benar tapi prematur** untuk tahap ini. Dicatat di sini secara eksplisit supaya tidak dikerjakan ulang tanpa sadar oleh siapa pun yang membaca dokumen ini nanti.

### ⛔ Sync Engine penuh ke Cloud API
**Kenapa ditunda:** Membangun `syncEngine.ts`, `queue.ts`, `conflictResolver.ts`, `apiAdapter.ts` untuk sinkronisasi ke "Kasirio Cloud API" berarti menulis logic penyelesaian konflik data untuk backend yang **belum didesain, apalagi dibangun**. Requirement sinkronisasi (last-write-wins vs merge vs manual resolve) baru bisa dipastikan setelah backend cloud benar-benar ada — menulisnya sekarang besar risiko ditulis ulang total begitu API sesungguhnya dibuat.
**Yang tetap dilakukan sebagai asuransi murah:** schema Dexie di Fase 1a sudah disiapkan "sync-ready" (UUID, `createdAt`/`updatedAt`/`deletedAt`) — cukup itu saja untuk sekarang. Logic sync sesungguhnya dikerjakan sebagai fase terpisah nanti, saat backend cloud mulai didesain.

### ⛔ Arsitektur plug-in multi-vertical (`business-modules/{retail,fnb,service,laundry,salon,...}`)
**Kenapa ditunda:** Fase 1 hanya butuh toggle Ritel vs F&B. Membangun sistem modul plug-in penuh (masing-masing dengan `POSLayout`, `ReceiptLayout`, `DashboardWidget`, `Reports`, `Settings` sendiri) untuk vertical yang belum ada satu pun penggunanya (laundry, salon, barbershop, service HP) adalah desain untuk kebutuhan hipotetis yang belum tervalidasi pasar.
**Yang tetap dilakukan:** toggle `businessType` sebagai rendering kondisional sederhana di komponen yang sudah ada. Refactor ke modul plug-in terpisah dilakukan **nanti, saat** vertical kedua benar-benar mulai dikerjakan — bukan sebelumnya.

### ⛔ Restrukturisasi monorepo (`packages/core`, `packages/ui`, `packages/utils`)
**Kenapa ditunda:** Baik untuk masa depan (reuse antara Kasirio Mobile/Admin/Cloud), tapi overhead tooling monorepo (workspace config, build orchestration) akan memperlambat iterasi sekarang, untuk manfaat yang baru terasa setelah produk lain benar-benar mulai dibangun. Bukan blocker Fase 1.

### ⛔ Mode struk PDF & WhatsApp
**Kenapa ditunda:** Nice-to-have, bukan kebutuhan inti Fase 1. Thermal 58/80mm dan QR offline sudah menutupi kebutuhan dasar cetak & bagikan struk. Tambahkan setelah dua mode inti ini stabil di lapangan.

---

## Verification Plan

### Automated Tests 🟡 DIKOREKSI — ditambah unit test untuk logic finansial

Plan asli hanya mengandalkan type-check + build + testing manual. **Risiko:** aplikasi ini menyentuh uang (total transaksi, pemotongan stok, kasbon, saldo koin) — bug logic di area ini sulit terdeteksi lewat testing manual sekali jalan, dan gampang regresi diam-diam saat fitur baru ditambahkan tanpa disadari.

1. **Unit test untuk logic finansial & stok (🆕 wajib ditambahkan):**
   ```powershell
   npm install -D vitest
   npm run test
   ```
   Cakupan minimum: perhitungan total+pajak+diskon, pemotongan stok saat transaksi & void (harus konsisten dengan inventory ledger), penambahan/pengurangan kasbon pelanggan, pemotongan saldo Koin saat perpanjangan Pro.

2. **Pemeriksaan Kompilasi TypeScript & Lint:**
   ```powershell
   npm install
   npm run lint
   ```

3. **Pengujian Build Produksi (Vite + PWA Bundling):**
   ```powershell
   npm run build
   ```

### Manual Verification

1. **Pengujian Offline & PWA** — termasuk 🆕 skenario update service worker: pastikan notifikasi update tidak memaksa reload saat ada transaksi aktif.
2. **Pengujian Tahan Transaksi (Hold & Recall)** — sesuai rencana asli, ditambah verifikasi label/waktu/status.
3. **Pengujian Dual-Mode Struk** — 🆕 wajib diuji dengan printer thermal fisik 58mm dan 80mm nyata, bukan hanya simulasi print browser di laptop.
4. **Pengujian Toggle Mode Usaha** — sesuai rencana asli.
5. **Pengujian Audit Log & PIN Gate** — 🆕 diperluas: void transaksi dan diskon manual di atas ambang harus **ditolak tanpa PIN owner yang benar**, baru kemudian tercatat di audit log.
6. **🆕 Pengujian Backup/Restore Data** — export data, hapus data lokal (simulasi clear browser), restore dari file backup, pastikan seluruh transaksi & saldo hutang kembali utuh.
7. **🆕 Pengujian Barcode Buffer** — scan barcode fisik asli harus terdeteksi otomatis; mengetik angka yang sama secara manual di keyboard (lebih lambat dari 50ms/karakter) tidak boleh salah terdeteksi sebagai scan.
