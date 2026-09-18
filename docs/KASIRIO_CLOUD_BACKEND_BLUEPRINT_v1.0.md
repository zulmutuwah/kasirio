# Kasirio Cloud Backend Blueprint v1.0 — Agent Execution Prompt

> **Dokumen ini menggantikan dan menggabungkan** `KASIRIO_ROLE_PERMISSION_AGENT_PROMPT_v1.0.md`. Ini adalah acuan tunggal untuk membangun lapisan backend/cloud multi-tenant Kasirio (Fase 2 dan seterusnya). Ditulis untuk dieksekusi oleh agent (Antigravity) — setiap bagian bersifat wajib kecuali ditandai sebagai catatan/opsional.

---

## 0. Scope & Prasyarat — Wajib Dibaca Sebelum Eksekusi

1. **Jangan ubah skema lokal Dexie/IndexedDB Fase 1** (`src/db/index.ts`, `src/types.ts`) di luar konteks yang eksplisit diminta. Skema lokal itu sengaja "satu database device = satu tenant" — berbeda dari skema backend multi-tenant yang didefinisikan di dokumen ini.
2. **Kasirio adalah PWA offline-first.** POS kasir harus tetap berfungsi tanpa internet. Setiap desain otorisasi/validasi yang mewajibkan panggilan server real-time untuk operasi harian melanggar prinsip inti ini — lihat Bagian 2.4.
3. **Prinsip anti-overengineering yang dipegang di seluruh dokumen ini:** bangun yang dibutuhkan sekarang, siapkan fondasi untuk yang akan datang (misalnya UUID, timestamp), tapi jangan membangun logika penuh untuk kebutuhan yang masih spekulatif.
4. Kalau ada bagian dokumen ini yang ambigu atau bertentangan dengan kode yang sudah ada di repo, **hentikan dan tanyakan** sebelum melanjutkan implementasi.

---

## 1. Arsitektur Domain

```
kasirio.com           → Landing/marketing publik, tanpa auth
kasirio.id             → HANYA domain defensif: redirect 301 permanen ke kasirio.com.
                          Tidak ada konten atau aplikasi aktif di domain ini. Tujuannya
                          mencegah pihak lain mendaftarkan domain ini untuk phishing/tiruan.

app.kasirio.com        → Frontend Bisnis (Owner / Admin Toko / Kasir), SATU origin, dua
                          modul yang di-code-split:
  ├── /pos               (eager-load, offline-first, target latensi <16ms — dipakai Kasir,
  │                        termasuk Owner yang merangkap sebagai kasir)
  └── /admin             (lazy-load, online-only — laporan, kelola produk/pengguna/settings)

office.kasirio.com     → Frontend Platform (Developer / Super Admin), deployment TERPISAH
                          total dari app.kasirio.com. Lihat Bagian 5.5 untuk pembatasan akses.

api.kasirio.com         → Backend bersama, dipanggil kedua frontend, dinamespace per
                          audience & peran:
  ├── /api/app/pos/*      (aud=app, role ≥ CASHIER)
  ├── /api/app/admin/*    (aud=app, role ≥ ADMIN)
  └── /api/office/*       (aud=office)
```

**Aturan wajib:**
- Kasir TIDAK mendapat subdomain sendiri — tetap di `/pos` dalam `app.kasirio.com`, supaya IndexedDB/service worker offline tetap satu origin dan Owner-yang-jadi-kasir tidak perlu pindah aplikasi/login ulang.
- JWT memakai audience berbeda per realm: `aud: "app"` vs `aud: "office"`. Gunakan **signing key berbeda** per realm (bukan cuma klaim `aud` berbeda) sebagai defense-in-depth.
- Endpoint login **terpisah total** per realm (`/api/app/auth/login` vs `/api/office/auth/login`) — jangan satu endpoint yang bercabang berdasarkan role yang ditemukan.
- Cookie sesi bersifat **host-only** (jangan set atribut `Domain=.kasirio.com`) agar otomatis terisolasi per subdomain.
- CORS di `api.kasirio.com` hanya mengizinkan origin `app.kasirio.com` dan `office.kasirio.com` secara eksplisit — tidak ada wildcard.

---

## 2. Role & Permission System

### 2.1 Hierarki Role

```
Platform (tidak muncul di aplikasi tenant, WAJIB MFA):
  Developer     — akses penuh source code, infra, seluruh data platform
  Super Admin   — kelola tenant/billing/support, TANPA akses source code/server

Tenant/Toko (penugasan disimpan per (userId, tenantId, outletId); outletId=null → semua cabang):
  Owner         — role tertinggi di tenant, akses lintas semua cabang
  Admin Toko    — dikelola Owner, scope outletId tertentu atau semua cabang
  Kasir         — scope outletId tertentu
```

- Setiap akses Developer/Super Admin ke data tenant tertentu **wajib tercatat di audit log yang terlihat oleh Owner tenant itu** — transparansi ini wajib, bukan opsional.
- Admin Toko tidak dapat mengedit profil/permission Owner, tidak dapat mengubah paket langganan atau menghapus tenant/cabang.

### 2.2 Model Permission

RBAC (role menentukan permission default) + **override per user**: `grant` (menambah izin di luar default) dan `revoke` (mencabut izin default). Resolusi akhir = (default role) + (grant) − (revoke). Implementasikan identik di database, API, dan UI.

Contoh permission key: `product.create`, `product.update`, `stock.adjust`, `report.view`, `transaction.refund`, `user.manage`.

### 2.3 Tipe `User.role` Lokal yang Sudah Ada
`src/types.ts` saat ini hanya punya `role: 'OWNER' | 'CASHIER'` (lokal, tanpa server). Perluasan ke 5 role penuh adalah pekerjaan migrasi yang terjadi **bersamaan** dengan pembangunan backend — jangan diubah terpisah tanpa migrasi datanya.

### 2.4 Prinsip Otorisasi Offline (Wajib)
- Role & permission di-cache lokal di device (mirror dari server) dengan grace period (24-72 jam tanpa koneksi tetap valid).
- Otorisasi aksi sensitif tidak boleh mewajibkan panggilan server real-time — cek terhadap salinan lokal + PIN hash lokal.
- Sinkronisasi role/permission ke server terjadi saat online, bukan prasyarat setiap transaksi.
- **Catatan penyederhanaan (per keputusan produk):** untuk status trial/subscription (bukan role/permission), cukup cek sekali per sesi/login saat online dan simpan hasilnya untuk dipakai sepanjang hari itu — tanpa mesin grace-period multi-hari yang kompleks. Sebagian besar toko sudah punya wifi; jangan over-invest di ketahanan offline untuk kasus yang makin jarang terjadi.

---

## 3. Kebijakan Otorisasi Fleksibel (`tenantAuthPolicy`)

**Prinsip kunci:** PIN Gate tidak pernah meminta Owner mengonfirmasi aksinya sendiri. Gerbang otorisasi hanya berlaku saat aktor **bukan** Owner.

```
if (actor.role === 'OWNER') {
    proses langsung, tanpa prompt PIN
} else {
    cek tenantAuthPolicy[actionType]:
      ALLOW        → proses langsung (tetap dicatat di log)
      THRESHOLD     → di bawah batas: langsung; di atas batas: minta PIN Owner/Admin
      ALWAYS_PIN    → selalu minta PIN
}
```

**Skema, dikonfigurasi Owner sendiri dari Settings (`app.kasirio.com/admin`):**
```
tenantAuthPolicy: tenantId,
  manualDiscount:        { mode, thresholdPercent? }
  manualProductAdd:      { mode }              -- item non-katalog, WAJIB ditandai kategori
                                                    khusus di laporan apa pun mode-nya
  priceOverrideAtTx:     { mode, thresholdPercent? }
  voidTransaction:       { mode }
  refund:                { mode, thresholdAmount? }   -- WAJIB ada gerbang; jangan biarkan
                                                          `transaction.refund` jadi izin bebas
                                                          tanpa batas untuk Kasir
  drawerOpenManual:      { mode }
```

Default disarankan ketat (`THRESHOLD`/`ALWAYS_PIN`), Owner bebas ubah ke `ALLOW` untuk toko yang dia operasikan sendiri. **Walau mode `ALLOW`, aksi tetap dicatat ke audit log** — fleksibel bukan berarti tanpa jejak.

---

## 4. Alur Bisnis: Akuisisi → Trial → Subscription → Aktivasi

### 4.1 Registrasi Trial

**Form pendaftaran (disetujui, implementasikan sekarang):** 4 field — **Nama, Email, Nomor WA, Password**. Data toko (nama toko, tipe usaha) **jangan** ditanya di form ini — tanyakan lewat wizard singkat "Setup Toko" setelah pengguna berhasil masuk ke `app.kasirio.com` (progressive onboarding, mengurangi drop-off di form awal).

**Nomor WA dikumpulkan sekarang, TAPI TIDAK diverifikasi OTP dulu** (lihat catatan DITAHAN di bawah) — alasan mengumpulkannya lebih dulu: supaya pengguna yang sudah daftar di masa ini tidak perlu diminta ulang begitu verifikasi OTP diaktifkan nanti. Validasi hanya **format** nomor (`+62...`) saat submit, jangan validasi kepemilikan (belum kirim OTP apa pun). Nomor ini boleh langsung dipakai sebagai tujuan pengiriman notifikasi (Bagian 4.3) — hanya belum dipakai sebagai gerbang anti-fraud sampai OTP diaktifkan.

**Alur:**
```
1. Form: Nama, Email, Nomor WA, Password → submit (validasi format WA saja)
2. POST /api/app/auth/register-tenant: buat User (Owner) + Tenant + Subscription
   (status TRIAL, trialEndsAt = now + 15 hari) dalam SATU TRANSAKSI ATOMIK
3. Setelah sukses, terbitkan token langsung, redirect ke app.kasirio.com
   — JANGAN minta login ulang, JANGAN blokir akses menunggu apa pun
   (termasuk TIDAK menunggu verifikasi WA — itu masih DITAHAN)
4. Paralel (non-blocking): kirim link verifikasi email
5. Setelah masuk: wizard "Setup Toko" (nama toko, tipe usaha)
```

**Verifikasi email — non-blocking:**
- Tidak menghalangi akses awal ke aplikasi (beda dari pola "harus klik link aktivasi dulu" seperti pada beberapa layanan lain — itu menambah friksi tepat di titik paling kritis funnel trial).
- Tampilkan banner pengingat halus di UI kalau belum diverifikasi.
- Verifikasi email **baru jadi prasyarat wajib** untuk aksi finansial sensitif tertentu (submit konfirmasi pembayaran, upgrade paket) — bukan untuk pemakaian POS harian.
- Kalau email salah/belum diverifikasi, Owner tetap menerima notifikasi kritis (H-7/H-3/H-1, GRACE/LIMITED) lewat kanal lain (in-app banner) — lihat Bagian 4.3.

**🔸 DITAHAN — Verifikasi nomor WA (OTP) sebagai gerbang wajib pendaftaran.**
Ide ini sudah disetujui secara konsep (nomor WA + OTP sebagai gerbang anti-fraud utama, menggantikan/melengkapi verifikasi email untuk tujuan itu — lihat Bagian 7.2), **tapi implementasinya DITAHAN** sampai diputuskan:
1. Provider WA API yang dipakai, dan apakah plan-nya mendukung kategori template *Authentication* (kalau pakai jalur resmi Meta Business API) — kategori ini terpisah dari kategori *Utility* yang dipakai untuk notifikasi biasa (Bagian 5.4), sering butuh izin/tarif berbeda meski dari provider yang sama.
2. Mekanisme fallback kalau OTP WA gagal terkirim/timeout (misal verifikasi via link email sebagai cadangan) — supaya pendaftaran tidak macet total kalau channel WA sedang bermasalah atau nomor gateway terblokir WhatsApp.

**Antigravity: field nomor WA BOLEH ditambahkan ke form (dikumpulkan & divalidasi formatnya saja), tapi JANGAN implementasikan logika OTP/pengiriman kode verifikasi apa pun sampai instruksi lanjutan diberikan.** Jangan blokir proses registrasi menunggu verifikasi WA dalam bentuk apa pun.

**Multi-tenant per email:** Satu email boleh memiliki lebih dari satu tenant, **dengan biaya tambahan** untuk tenant kedua dan seterusnya (`tenantOwnership: userId, tenantId, isPrimary`, tandai `billingType: 'ADDITIONAL_TENANT'` pada tenant baru saat `COUNT(tenantOwnership WHERE userId=?) ≥ 1`).

### 4.2 State Machine Trial/Subscription — TIDAK BOLEH mengunci mendadak

```
TRIAL/ACTIVE → (jatuh tempo tanpa bayar) → GRACE → LIMITED
```

- **GRACE** (durasi dikonfigurasi produk — lihat Bagian 8): semua fitur tetap 100% berfungsi, hanya banner persisten "Perpanjang sekarang".
- **LIMITED**: tetap aplikasi & URL yang sama (jangan pernah alihkan ke aplikasi/produk lain). Riwayat transaksi, laporan, data pelanggan tetap **bisa dilihat penuh** (read-only). Hanya aksi baru (transaksi baru, tambah produk) diblok dengan layar interstitial jelas + tombol bayar langsung.
- Begitu pembayaran terverifikasi, **unlock harus instan** — tidak menunggu batch job berikutnya.
- Kirim notifikasi tepat di momen transisi (masuk GRACE, masuk LIMITED), bukan hanya sebelumnya (H-7/H-3/H-1).

> Alasan desain ini: menghindari kegagalan UX yang dialami produk kompetitor (Kasir Pintar) — penguncian mendadak jam 3 pagi tanpa peringatan dan pengalihan paksa ke aplikasi lain merusak trust pengguna.

### 4.3 Notifikasi
```
notificationTemplates: id, type(TRIAL_H7|TRIAL_H3|TRIAL_H1|ENTER_GRACE|ENTER_LIMITED),
                        channel(APP|EMAIL|WHATSAPP), subject, bodyTemplate, isActive
```
Dikelola dari `office.kasirio.com` (lihat Bagian 5.4) — mendukung placeholder (`{{nama_toko}}`, `{{hari_tersisa}}`, `{{link_perpanjang}}`). `notificationLog` mencatat pengiriman dengan unique constraint `(tenantId, type)` untuk mencegah kiriman duplikat.

### 4.4 Pembayaran & Verifikasi
- **Bukti transfer tidak wajib** — Owner input nomor referensi transfer manual, staf mencocokkan ke mutasi bank secara manual (MVP). Tidak perlu infra upload file.
- `payments: id, tenantId, subscriptionId, amount, status(PENDING_VERIFICATION|VERIFIED|REJECTED), referenceNumber (UNIQUE di seluruh sistem), verifiedByStaffId, verifiedAt`.
- **Transisi status wajib dijaga dari race condition:** `UPDATE payments SET status='VERIFIED' WHERE id=? AND status='PENDING_VERIFICATION'` — bukan `WHERE id=?` saja — supaya dua staf yang verifikasi bersamaan tidak menyebabkan double-crediting.
- Fase berikutnya (otomatis via webhook payment gateway): **wajib validasi HMAC signature** dari provider, dan **wajib idempoten** (simpan `webhookEventId` yang sudah diproses, tolak duplikat).

### 4.5 Koin & Plan Settings
```
koinSettings: id, rupiahPerKoin, minTopupKoin, bundleDiscounts(json), updatedBy
koinPriceHistory: id, rupiahPerKoin, effectiveFrom, effectiveTo
```
**Wajib:** setiap record `payments`/`koinTransactions` menyimpan `rupiahPerKoinAtPurchase` sebagai snapshot harga saat transaksi — jangan pernah menghitung ulang transaksi lama berdasarkan harga baru. Konsisten dengan prinsip immutable ledger yang sudah dipakai untuk stok.

---

## 5. Modul Backend `office.kasirio.com`

| Modul | Fungsi |
|---|---|
| Dashboard | Ringkasan tenant per status, MRR Koin, antrean verifikasi pending |
| Tenant Management | List/detail tenant, riwayat langganan, aksi manual (aktifkan/perpanjang/suspend) — semua tercatat di audit log terlihat Owner |
| Payment Verification Queue | Lihat 4.4 |
| Plan & Koin Settings | Lihat 4.5 |
| Notification & Marketing Center | Lihat 5.4 |
| Platform Staff Management | Kelola akun Developer/Super Admin, status MFA |
| Audit Log Viewer | Log semua aksi staf platform lintas tenant, bisa difilter/cari |

### 5.4 Integrasi Email/WhatsApp — Pola Provider Adapter
Jangan hardcode satu provider (Mailketing, Kirim.Email, dll). Gunakan interface umum:
```
EmailProvider interface     → send(to, subject, body)
WhatsAppProvider interface  → send(to, message)
```
```
integrationProviders: id, type(EMAIL|WHATSAPP), providerName, credentialsEncrypted(json),
                       isActive, lastTestStatus, lastTestedAt, updatedBy
```
- Hanya satu provider aktif per tipe. Sediakan tombol "Test Kirim" setelah konfigurasi disimpan.
- `credentialsEncrypted` terenkripsi AES; API **tidak pernah** mengembalikan nilai asli ke frontend setelah disimpan, hanya versi tersamar (`****1234`).
- **Pisahkan** pengiriman transaksional (notifikasi trial/pembayaran — otomatis, tanpa opt-out) dari marketing/broadcast (butuh mekanisme unsubscribe & rate-limiting terpisah).
- **Konfirmasi pembayaran masuk memicu 3 kanal sekaligus:** badge di dashboard office (polling `/api/office/payments/pending/count` setiap 30-60 detik — tidak perlu WebSocket untuk skala sekarang) + email + WA ke daftar `csEmailRecipients`/`csWhatsappRecipients` (dikonfigurasi dari settings, bukan hardcode). Cegah duplikasi: cek dulu apakah sudah ada `PENDING_VERIFICATION` untuk `subscriptionId` yang sama sebelum membuat record baru.

### 5.5 Pembatasan Akses `office.kasirio.com` — Identity-Based, Bukan IP-Based

**Revisi keputusan:** gerbang utama memakai **Cloudflare Access (Zero Trust)** berbasis identitas (login email resmi + MFA), **bukan** VPN/IP allowlist sebagai lapis wajib. Alasan perubahan: IP rumah staf di Indonesia umumnya dynamic dan CGNAT pada koneksi seluler membuat banyak pelanggan berbagi IP publik yang sama — pendekatan berbasis IP akan sering salah kunci staf legit keluar. Gerbang berbasis identitas menghilangkan masalah ini sepenuhnya karena tidak ada IP yang perlu di-allowlist sama sekali.

```
Staf → Cloudflare Access (login email resmi + MFA, dari mana pun, IP apa pun)
     → office.kasirio.com
     → Audit log setiap sesi (siapa, dari IP mana, kapan)
```

**Wajib:** sediakan jalur *break-glass* darurat (akses alternatif via token/hardware key, tercatat khusus di audit log, dibatasi waktu ~30 menit, memicu alert ke seluruh Developer & Super Admin) untuk kasus tim terkunci keluar dari Cloudflare Access.

**Catatan residual — bukan untuk web app, tapi untuk akses infra langsung:** Cloudflare Access hanya melindungi aplikasi web `office.kasirio.com`. Kalau nanti Developer butuh koneksi **langsung** ke database (DB client untuk maintenance, bukan lewat web app), itu tidak lewat Cloudflare sama sekali. Untuk kebutuhan itu, evaluasi fitur IP-restriction bawaan provider database (Supabase/Neon) dulu; pasang VPN mesh (Tailscale) hanya kalau kebutuhan akses infra langsung ini benar-benar muncul — jangan dipasang preventif tanpa kebutuhan konkret.

---

## 6. Keamanan (Security Baseline) — Wajib Sebelum Backend Live

### 6.1 Kritis
- **Password & Token:** hash password dengan Argon2/bcrypt (bukan MD5/SHA polos), rate-limit percobaan login + lockout. Access token berumur pendek (15-30 menit) + refresh token yang disimpan server-side dan **bisa dicabut** (saat user dihapus/dipecat, hapus refresh token-nya — jangan andalkan expiry saja).
- **Isolasi tenant di level database, bukan cuma kode:** terapkan Row-Level Security (RLS) di database sebagai lapisan pertahanan kedua yang independen dari filter `WHERE tenant_id` di kode aplikasi — satu baris kode yang lupa filter tidak boleh menyebabkan kebocoran data lintas tenant.
- **Kepatuhan UU PDP (Pelindungan Data Pribadi):** Kasirio menyimpan nama/no. HP/riwayat hutang pelanggan — ini data pribadi menurut UU 27/2022. Butuh privacy policy resmi & dasar hukum pengolahan data sebelum onboarding tenant nyata dalam skala besar — **ini pekerjaan legal, bukan asumsi teknis**, sekelas isu regulasi BI pada Koin (lihat ADR-006 di Architecture Bible).
- **Secret management:** kunci enkripsi utama (untuk `credentialsEncrypted`, dll) disimpan di secret manager terkelola (bukan file `.env` biasa).
- **Enkripsi file backup lokal:** fitur export/backup JSON Fase 1 saat ini plaintext dan berisi PII pelanggan. Naikkan RFC-013 (enkripsi backup AES-GCM-256 dengan kunci pemilik) dari "ide masa depan" jadi **wajib sebelum rilis publik skala besar**.

### 6.2 Penting
- Rate-limit/CAPTCHA pada endpoint registrasi trial & login (target bot/brute-force).
- Pemindaian dependency otomatis (`npm audit`/Dependabot/Snyk) di CI.
- Webhook payment gateway: validasi HMAC signature, bukan hanya cek event ID.
- JWT: pin algoritma verifikasi secara eksplisit di kode (`algorithms: ['HS256']`), jangan biarkan ditebak dari header token.
- IDOR: setiap endpoint yang menerima `transactionId`/`productId` dsb wajib validasi kepemilikan tenant — test eksplisit per endpoint.
- Simpan token sesi di cookie `httpOnly` (bukan `localStorage`) supaya XSS/dependency compromise tidak bisa mencuri token langsung.
- CSRF token wajib di form-form penting `office.kasirio.com` (verifikasi pembayaran, ubah harga Koin).

### 6.3 Prinsip untuk data yang datang dari device offline
**Jangan pernah percaya penuh data yang dikirim device client saat sinkronisasi.** Karena arsitektur offline-first memungkinkan manipulasi state/IndexedDB langsung oleh pengguna teknis, server **wajib menghitung ulang** nilai kritis (misalnya total transaksi dari item-nya) saat menerima data sync — anggap data dari client sebagai klaim yang perlu divalidasi ulang, bukan kebenaran mutlak.

---

## 7. Pencegahan Kecurangan (Fraud Prevention)

### 7.1 Berbagi Akun / Sesi Lintas Banyak Device
```
userSessions: id, userId, deviceFingerprint, ipAddress, loginAt, lastActiveAt, refreshTokenId
plans: ..., maxConcurrentSessions
```
- Saat login baru akan melebihi `maxConcurrentSessions` milik tenant, **tolak login** dengan pesan jelas ("batas perangkat aktif tercapai") — jangan otomatis mengusir sesi lama (berisiko mengganggu transaksi yang sedang berjalan).
- Tandai untuk ditinjau manual (bukan blokir otomatis): login dari dua lokasi geografis yang mustahil dalam rentang waktu singkat ("impossible travel"), atau jumlah device fingerprint berbeda yang login sebagai satu user jauh melebihi slot device paketnya dalam 30 hari.

### 7.2 Trial & Billing Abuse
- Normalisasi email saat cek duplikat trial (buang tag `+xxx` dan variasi titik pada domain gmail.com).
- Verifikasi nomor WA sebagai identitas sekunder yang lebih sulit dipalsukan berulang.
- Cek device fingerprint saat registrasi trial baru — device yang sudah pernah membuat trial sebelumnya diberi verifikasi tambahan.
- `referenceNumber` pada `payments` bersifat **unique di seluruh sistem** — satu nomor referensi transfer tidak bisa diklaim dua tenant berbeda.

### 7.3 Kecurangan Operasional Kasir
| Pola | Solusi |
|---|---|
| Void setelah uang tunai diterima, tidak dikembalikan | Laporan rasio void per kasir yang menonjol di dashboard Owner, bukan cuma log mentah |
| **Kasbon fiktif** (kasir catat kasbon padahal uang tunai sudah diterima, lalu "melunasi" sendiri) | Red-flag otomatis: kasbon dibuat & dilunasi oleh kasir yang sama dalam rentang waktu singkat |
| **Retur palsu** | `transaction.refund` WAJIB melalui `tenantAuthPolicy` threshold/PIN (lihat Bagian 3) — jangan jadi izin default tanpa batas untuk Kasir |
| Adjustment stok menutupi shrinkage | Laporan otomatis untuk adjustment stok bernilai besar/frekuensi tinggi |
| Manipulasi jam device | Server catat waktu terima sendiri saat sync; selisih besar vs jam device ditandai untuk ditinjau |
| Manipulasi HPP untuk memalsukan margin | Riwayat perubahan harga produk (siapa/kapan/dari-ke), jangan ditimpa diam-diam |
| Menutup selisih kas lewat shift baru | Selisih `expectedCash` vs `actualCash` per sesi permanen di riwayat, tidak "tertutup" modal shift berikutnya |
| Retur dengan metode pengembalian tidak cocok metode bayar asli | Field retur wajib cocok metode pembayaran asli; kalau beda, minta approval ekstra |
| Produk dummy murah untuk beli sendiri lalu dihapus | Selalu soft-delete (`deletedAt`) — produk "terhapus" tetap terlihat di riwayat transaksi lama |

---

## 8. Keputusan Terbuka — Perlu Ditentukan Pemilik Produk Sebelum Implementasi Final

1. Durasi periode `GRACE` sebelum masuk `LIMITED` (hari).
2. Nominal biaya tambahan per tenant ekstra untuk satu email (`ADDITIONAL_TENANT`).
3. `maxConcurrentSessions` per tier paket (Basic/Pro/dst).
4. Threshold default untuk diskon manual & refund yang butuh PIN (persen/nominal) — nilai default sebelum diubah Owner.

> Antigravity: implementasikan skema/mekanisme untuk item di atas dengan nilai default yang wajar, tapi **tandai sebagai TODO konfigurasi** yang bisa diubah tanpa deploy ulang (lewat tabel settings, bukan konstanta di kode) — karena nilai final belum diputuskan pemilik produk.

---

## 9. Rekomendasi Infrastruktur & Deployment (Tahap Beta → Upgrade Path)

### 9.1 Keputusan: Managed/PaaS, bukan VPS mentah, di tahap awal
Untuk beta dengan pengguna tim internal dan budget rendah, **jangan sewa VPS unmanaged** (DigitalOcean/Linode/Hetzner mentah). Gunakan layanan managed/PaaS:
- **Beban operasional:** VPS mentah butuh Anda sendiri yang urus OS hardening, patching keamanan, setup reverse proxy/SSL, backup database, monitoring — waktu tim tersita untuk sysadmin ketimbang menyempurnakan produk.
- **Efisiensi biaya saat idle:** VPS menagih flat rate meski utilisasi rendah; PaaS/serverless modern punya free tier yang royal untuk traffic tim internal.
- **Portabilitas — wajib bungkus backend dalam `Dockerfile` sejak awal.** Selama backend Node/Express dikemas sebagai container standar dan database memakai PostgreSQL standar, migrasi ke VPS/Kubernetes mandiri nanti bisa dilakukan dalam hitungan menit tanpa mengubah kode — ini yang membuat pilihan PaaS sekarang **tidak** mengorbankan opsi upgrade nanti.

### 9.2 Komponen per Domain

| Domain | Layanan | Estimasi Biaya Beta | Catatan |
|---|---|---|---|
| `kasirio.com` (+ redirect `kasirio.id`) | Cloudflare Pages | Gratis | Redirect 301 dibuat via Cloudflare Redirect Rules, tanpa server |
| `app.kasirio.com` | Cloudflare Pages / Vercel | Gratis | Bundle statis (SPA offline-first), edge CDN dekat Indonesia |
| `office.kasirio.com` | Cloudflare Pages + Cloudflare Access | Gratis (s.d. puluhan user) | Lihat Bagian 5.5 untuk mekanisme akses |
| `api.kasirio.com` | Render.com / Railway.app / GCP Cloud Run | Rp0 – ~$7/bulan | Cloud Run scale-to-zero cocok untuk traffic beta yang sporadis; **kalau pilih Cloud Run, job notifikasi terjadwal (H-7/H-3/H-1, ENTER_GRACE, ENTER_LIMITED) wajib dipasangkan dengan Cloud Scheduler** — Cloud Run tidak punya proses cron persisten bawaan |
| Database | Supabase / Neon.tech (free tier) | Gratis (dengan limit) | Postgres asli dengan RLS bawaan, connection pooling — perlu diverifikasi mode pooling-nya *transaction mode* agar pola `SET LOCAL app.current_tenant_id` (Bagian 6.1) aman |
| DNS/CDN/Firewall | Cloudflare (free plan) | Gratis | Mengelola routing 4 subdomain, SSL otomatis, WAF dasar |

### 9.3 Checklist Pondasi Agar Upgrade Nanti Tidak Perlu Rearsitektur
1. **Backend stateless & Docker-based** — jangan simpan file upload/state sesi di disk/memori lokal Node.js; sesi & token disimpan di database, bukan file lokal, supaya horizontal scaling (1 instance → banyak instance) tidak menimbulkan masalah sinkronisasi sesi.
2. **RLS di level PostgreSQL dengan kolom `tenant_id UUID NOT NULL`** di setiap tabel relasional (Bagian 6.1) — saat upgrade dari Supabase Free ke tier lebih besar/provider lain, logika isolasi data tidak berubah sama sekali.
3. **Cookie sesi host-only** (bukan wildcard `.kasirio.com`) — token `app.kasirio.com` tidak bisa bocor ke `office.kasirio.com` (konsisten dengan Bagian 1).
4. **12-Factor App** — seluruh koneksi DB, secret JWT, URL API, dan API key disimpan di environment variable, tidak ada yang hardcoded di source code frontend maupun backend.
5. **Server tidak boleh mempercayai total harga dari client mentah-mentah** — saat sinkronisasi data offline, server wajib menghitung ulang `qty × price − discount` sendiri (konsisten dengan Bagian 6.3), bukan menerima field `total` yang dikirim device sebagai kebenaran.

### 9.4 Analisis Biaya Jangka Panjang — Kapan Perlu Waspada

**Biaya infra server TIDAK akan bengkak linear terhadap jumlah tenant**, karena arsitektur shared multi-tenant (satu database, isolasi via RLS — bukan satu server/database per tenant) membuat biaya compute tumbuh sublinear terhadap pertumbuhan jumlah tenant.

**Yang justru perlu diwaspadai: biaya per-panggilan dari layanan pihak ketiga** — Gemini API (OCR nota), gateway Email/WA, payment gateway (persentase per transaksi). Biaya ini **linear terhadap pemakaian aktif**, bukan terhadap infra server, dan berisiko jadi komponen biaya terbesar kalau adopsi tumbuh pesat.

**Mitigasi wajib dipikirkan sejak desain paket:**
- Tetapkan kuota/rate-limit penggunaan AI OCR & notifikasi per tier paket, supaya biaya variable per tenant tidak pernah melebihi harga jual paketnya.
- Hitung unit economics (biaya infra + API pihak ketiga per tenant per bulan) dan bandingkan ke harga jual paket — ini pekerjaan bisnis yang harus berjalan bersamaan dengan desain teknis kuota di atas.

**Titik transisi dari PaaS ke infra mandiri (VPS/cloud provider penuh + tim DevOps sendiri)** baru masuk akal setelah revenue recurring cukup besar sehingga penghematan biaya per-unit dari kontrol infra sendiri lebih besar dari biaya mempekerjakan orang untuk mengurusnya — bukan sebelum itu.

### 9.5 Email Hosting / Kotak Masuk Staf — Bedakan dari Provider Notifikasi Tenant

Ada dua kebutuhan email yang berbeda dan **jangan dicampur**:
1. **Pengiriman otomatis dari aplikasi ke tenant** (notifikasi trial H-7/H-3/H-1, konfirmasi pembayaran, dst) — sudah tercakup lewat pola *provider adapter* (Mailketing/Kirim.Email/SendGrid) di Bagian 5.4. Tidak perlu infra tambahan untuk ini.
2. **Kotak masuk untuk manusia** (`cs@kasirio.com`, `admin@kasirio.com` menerima notifikasi internal/pertanyaan pelanggan) — ini yang dibahas di bagian ini.

**Rekomendasi tahap beta: jangan beli email hosting berbayar (Google Workspace/Zoho Mail) dulu.** Gunakan **Cloudflare Email Routing** (gratis, tanpa batas, karena domain `kasirio.com` sudah di Cloudflare) untuk meneruskan email masuk ke `cs@kasirio.com`/`admin@kasirio.com` langsung ke inbox Gmail pribadi/tim yang sudah ada — cukup beberapa DNS record, tanpa biaya bulanan dan tanpa hosting mailbox sungguhan.

**Keterbatasan yang perlu diketahui:** Email Routing hanya forwarding satu arah (terima → teruskan). Untuk **membalas** sebagai `cs@kasirio.com` (bukan dari alamat Gmail pribadi), butuh setup tambahan ("Send As" di Gmail dengan SMTP relay). Untuk tahap beta, cukup pastikan notifikasi/pertanyaan **masuk** ke inbox yang dipantau tim — balasan ke pelanggan bisa lewat WhatsApp CS yang sudah direncanakan sebagai kanal utama.

**Wajib terlepas dari pilihan di atas:** konfigurasi **SPF/DKIM/DMARC** di DNS `kasirio.com` (via Cloudflare, gampang diatur) supaya email transaksional yang dikirim lewat provider notifikasi (Bagian 5.4) tidak dianggap spam oleh Gmail/Outlook penerima — ini sering terlewat dan berakibat email penting (misal pengingat trial habis) masuk folder spam tenant.

**Kapan upgrade:** pertimbangkan Google Workspace atau Zoho Mail berbayar **setelah** tim CS/support cukup besar dan butuh kolaborasi mailbox bersama (shared inbox, calendar, drive) — bukan sebelum itu.
