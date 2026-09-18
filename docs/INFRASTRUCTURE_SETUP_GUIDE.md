# Panduan Setup Infrastruktur Beta Kasirio (v1.0)

> Dokumen ini adalah panduan teknis operasional untuk menyiapkan seluruh domain dan layanan cloud Kasirio pada tahap beta internal hingga siap scale-up ke tenant publik berbayar tanpa rearsitektur.
> Mengacu pada: `docs/KASIRIO_CLOUD_BACKEND_BLUEPRINT_v1.0.md`.

---

## 1. Topologi Arsitektur Domain & Komponen

```
kasirio.com           → Cloudflare Pages (Marketing publik, statis)
kasirio.id             → Cloudflare Redirect Rules (301 Permanent Redirect ke kasirio.com)
app.kasirio.com        → Cloudflare Pages (Frontend Tenant / PWA offline-first: /pos & /admin)
office.kasirio.com     → Cloudflare Pages + Cloudflare Access Zero Trust (Identity-based: Email + MFA)
api.kasirio.com         → GCP Cloud Run (Docker Container Express API)
Database               → Managed PostgreSQL (Supabase / Neon) dengan Row-Level Security (RLS)
Job Terjadwal          → GCP Cloud Scheduler (Cron harian pkl 07:00 WIB memanggil Cloud Run)
```

---

## 2. Setup Cloudflare DNS & Redirect

1. **Nameserver:** Arahkan NS domain `kasirio.com` dan `kasirio.id` ke Cloudflare.
2. **Defensive Domain (`kasirio.id`):**
   * Di dashboard Cloudflare untuk zona `kasirio.id`, buka menu **Rules** $\to$ **Redirect Rules**.
   * Buat rule baru:
     * *When incoming requests match:* All incoming requests.
     * *Type:* Dynamic / Static.
     * *URL:* `https://kasirio.com/`
     * *Status code:* `301 Moved Permanently`.
   * *Hasil:* Semua akses ke `kasirio.id` otomatis dialihkan ke `kasirio.com` tanpa perlu menyewa server/hosting.

---

## 3. Setup Frontend di Cloudflare Pages

### 3.1 `kasirio.com` (Marketing)
* Connect repository GitHub/GitLab ke Cloudflare Pages.
* Output directory: `/dist` (atau sesuai folder static site marketing).
* Custom Domain: `kasirio.com` dan `www.kasirio.com`.

### 3.2 `app.kasirio.com` (Frontend Tenant / PWA)
* Connect repo `Kasirio`.
* Build command: `npm run build`
* Build output directory: `dist`
* Custom Domain: `app.kasirio.com`
* Environment variable:
  * `VITE_API_URL=https://api.kasirio.com`

### 3.3 `office.kasirio.com` (Frontend Platform Internal)
* Connect repo office frontend (atau branch deployment office).
* Custom Domain: `office.kasirio.com`
* Lanjut ke proteksi Cloudflare Access di Bagian 4.

---

## 4. Proteksi `office.kasirio.com` dengan Cloudflare Access & Break-Glass

### 4.1 Konfigurasi Cloudflare Zero Trust (Access)
1. Buka **Cloudflare One / Zero Trust Dashboard** $\to$ **Access** $\to$ **Applications**.
2. Klik **Add an Application** $\to$ Pilih **Self-hosted**.
3. Isi detail aplikasi:
   * **Application name:** `Kasirio Platform Office`
   * **Application domain:** `office.kasirio.com`
   * **Session Duration:** 8 hours (atau 1 hari).
4. Tentukan **Identity Provider (IdP):**
   * Default: *One-time PIN (OTP)* ke email staf terdaftar.
   * Alternatif: Integrasi *Google Workspace / Microsoft Entra ID* untuk domain email `@kasirio.com`.
5. Buat **Access Policy:**
   * **Policy name:** `Staff Only with MFA`
   * **Action:** `Allow`
   * **Rules Include:**
     * *Emails:* Masukkan email tim internal (e.g. `dev@kasirio.com`, `admin@kasirio.com`), ATAU *Email domain:* `@kasirio.com`.
   * **Require MFA:** Centang opsi *Require MFA* untuk mewajibkan verifikasi faktor kedua (Google Authenticator / Security Key).

### 4.2 Prosedur Darurat *Break-Glass* (Emergency Override)
Jika Cloudflare Access down atau tim inti terkunci:
1. Staf membuka endpoint darurat via browser atau REST client:
   * `POST https://api.kasirio.com/api/office/auth/break-glass`
   * Body payload:
     ```json
     {
       "emergencySecret": "<NILAI_DARI_SECRET_MANAGER>",
       "staffEmail": "developer@kasirio.com",
       "justification": "Cloudflare Access down, perbaikan kritis issue payment sync"
     }
     ```
2. **Karakteristik Keamanan:**
   * Masa aktif token darurat dibatasi **30 menit** (`expiresInMinutes: 30`).
   * Aksi dicatat secara permanen di database tabel `auditLogs` dengan tipe `BREAK_GLASS_ACCESS` dan IP client.
   * Sistem otomatis memancarkan peringatan *High-Priority Alert* ke seluruh Developer & Super Admin.

---

## 5. Keamanan Database Langsung (Residual Note)

> **Catatan:** Cloudflare Access hanya melindungi web app HTTPS. Untuk akses langsung DBA/Developer ke engine database (via DBeaver/TablePlus/psql):

1. **IP Restriction Bawaan Provider:**
   * Pada **Supabase Dashboard** $\to$ **Settings** $\to$ **Database** $\to$ **Network Restrictions**.
   * Atau pada **Neon Console** $\to$ **Project Settings** $\to$ **IP Allowlist**.
   * Tambahkan CIDR IP gateway kantor/rumah yang stabil saat maintenance terjadwal.
2. **Koneksi Wajib Enkripsi:**
   * String koneksi wajib menyertakan flag `sslmode=require` atau `sslmode=verify-full`.
3. **Prinsip Anti Over-Engineering:**
   * Jangan pasang VPN Mesh (Tailscale) di awal jika kebutuhan akses DB langsung belum rutin. Cukup manfaatkan IP Restriction bawaan cloud DB provider.

---

## 6. Deployment Backend di Google Cloud Run (`api.kasirio.com`)

### 6.1 Build & Push Docker Container
Backend Kasirio telah dilengkapi `Dockerfile` multi-stage:
```bash
# 1. Login ke Google Cloud SDK
gcloud auth login
gcloud config set project [NAMA_PROJECT_GCP]

# 2. Build image via Google Cloud Build (tanpa perlu Docker lokal)
gcloud builds submit --tag gcr.io/[NAMA_PROJECT_GCP]/kasirio-api:latest .
```

### 6.2 Deploy ke Cloud Run
```bash
gcloud run deploy kasirio-api \
  --image gcr.io/[NAMA_PROJECT_GCP]/kasirio-api:latest \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DATABASE_URL=postgresql://..." \
  --set-env-vars="JWT_SECRET_APP=..." \
  --set-env-vars="JWT_SECRET_OFFICE=..." \
  --set-env-vars="BREAK_GLASS_SECRET=..." \
  --set-env-vars="CRON_SECRET=..."
```
*Catatan:* Pada Cloudflare DNS, buat CNAME record `api.kasirio.com` mengarah ke URL Cloud Run yang dihasilkan (aktifkan proxy orange cloud Cloudflare).

---

## 7. Setup Job Notifikasi Terjadwal (GCP Cloud Scheduler)

Karena Cloud Run membekukan CPU saat idle, eksekusi cron harian didelegasikan ke **GCP Cloud Scheduler**.

### 7.1 Konfigurasi Cloud Scheduler Job
1. Buka **GCP Console** $\to$ **Cloud Scheduler** $\to$ **Create Job**.
2. Parameter Job:
   * **Name:** `kasirio-daily-subscription-lifecycle`
   * **Region:** `asia-southeast2` (Jakarta)
   * **Frequency:** `0 7 * * *` (Setiap hari pkl 07:00 WIB)
   * **Timezone:** `Asia/Jakarta`
3. Target Konfigurasi:
   * **Target type:** `HTTP`
   * **URL:** `https://api.kasirio.com/api/internal/jobs/subscription-lifecycle`
   * **HTTP method:** `POST`
   * **HTTP Headers:**
     * `Content-Type`: `application/json`
     * `X-Cron-Secret`: `<NILAI_CRON_SECRET>`
   * **Body:** `{}`
   * **Timeout:** `300s` (5 menit)

### 7.2 Alur Kerja Logika Cron di Backend
* Mengevaluasi seluruh tenant dengan status `TRIAL`, `GRACE`, atau `ACTIVE`.
* Mendeteksi jatuh tempo H-7, H-3, H-1, transisi `TRIAL` $\to$ `GRACE`, dan transisi `GRACE` $\to$ `LIMITED`.
* Mengecek tabel `notificationLogs` dengan key `(tenantId, type)`. Jika notifikasi jenis tersebut sudah terkirim, proses di-*skip* (100% idempoten).
* Melaporkan ringkasan JSON:
  ```json
  {
    "success": true,
    "message": "Job subscription lifecycle berhasil dieksekusi.",
    "summary": {
      "processedTenants": 12,
      "stateTransitions": ["Tenant 'Toko Maju' bertransisi TRIAL -> GRACE"],
      "notificationsTriggered": [
        { "tenantId": "...", "type": "ENTER_GRACE", "recipient": "owner@tokomaju.com" }
      ]
    }
  }
  ```

---

## 8. Checklist Validasi Pra-Rilis

- [x] Dockerfile multi-stage production build siap dan diuji.
- [x] Route internal `/api/internal/jobs/subscription-lifecycle` terlindungi otentikasi secret token.
- [x] Route darurat `/api/office/auth/break-glass` aktif dengan audit logging dan 30-menit TTL.
- [x] Host-only cookies dikonfigurasi tanpa wildcard domain.
- [x] Skema RLS pada PostgreSQL dipersiapkan untuk isolasi multi-tenant.
