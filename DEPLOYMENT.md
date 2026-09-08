# AccessTansi — Panduan Deployment ke Rumah Web

> **Domain:** `accesstansi.id` | **Username cPanel:** `accj7125`
>
> **Arsitektur:**
> - Frontend (React static) → `app.accesstansi.id`
> - Backend (Node.js) → `api.accesstansi.id` (Setup Node.js App)
> - Database (MySQL) → Rumah Web MySQL via `localhost`

---

## URUTAN PENGERJAAN

```
[1]  cPanel → Buat database MySQL
[2]  phpMyAdmin → Import schema.sql
[3]  cPanel → Buat 2 subdomain (app + api)
[4]  cPanel → Setup Node.js App → arahkan ke api.accesstansi.id
[5]  Upload backend code via File Manager / FTP
[6]  cPanel Terminal → npm install + npm run build + npx prisma generate
[7]  Buat file .env di folder backend
[8]  Restart Node.js App → test /health
[9]  Edit & Upload seed_admin.php → jalankan → HAPUS
[10] Build frontend lokal (npm run build)
[11] Upload dist/ ke folder app.accesstansi.id
[12] Test login di https://app.accesstansi.id
```

---

## LANGKAH 1 — Buat Database MySQL

1. Login **cPanel** Rumah Web
2. Menu **MySQL Databases**
3. **Create New Database** → isi nama (contoh: `accesstansi`)
   - Nama lengkap jadi: `accj7125_accesstansi`
4. **Create New User** → isi username + password yang kuat
   - Username lengkap jadi: `accj7125_dbuser`
5. **Add User To Database** → centang **ALL PRIVILEGES** → Make Changes

Catat 3 info ini (butuh di langkah 7):
```
Database : accj7125_accesstansi
User     : accj7125_dbuser
Password : (password yang kamu set)
```

---

## LANGKAH 2 — Import Schema Database via phpMyAdmin

1. cPanel → **phpMyAdmin**
2. Klik nama database `accj7125_accesstansi` (panel kiri)
3. Tab **Import** → **Choose File**
4. Pilih file: `backend/prisma/schema.sql` (ada di komputer lokal)
5. Format: SQL (biarkan default)
6. Klik **Go**
7. Sukses → muncul pesan hijau, ada **10 tabel** terbuat:
   - accounts, contacts, journal_entries, journal_lines
   - account_budgets, company_profile, app_config
   - users, fiscal_years, locked_months

---

## LANGKAH 3 — Buat 2 Subdomain

### Subdomain 1: Frontend (`app.accesstansi.id`)

1. cPanel → **Subdomains**
2. Isi:
   - Subdomain: `app`
   - Domain: `accesstansi.id`
   - Document Root: `public_html/app.accesstansi.id` (otomatis)
3. Klik **Create**

### Subdomain 2: Backend (`api.accesstansi.id`)

1. Tetap di menu **Subdomains**
2. Isi:
   - Subdomain: `api`
   - Domain: `accesstansi.id`
   - Document Root: `public_html/api.accesstansi.id` (biarkan default, nanti diurus Passenger)
3. Klik **Create**

---

## LANGKAH 4 — Setup Node.js App di cPanel

1. cPanel → **Setup Node.js App**
2. Klik **CREATE APPLICATION**
3. Isi pengaturan:

   | Setting | Nilai |
   |---------|-------|
   | Node.js version | `18.x` atau `20.x` (pilih tertinggi yang tersedia) |
   | Application mode | `Production` |
   | Application root | `accesstansi_backend` |
   | Application URL | `api.accesstansi.id` |
   | Application startup file | `dist/index.js` |

4. Klik **CREATE**
5. cPanel akan membuat folder `~/accesstansi_backend/` → path lengkap: `/home/accj7125/accesstansi_backend/`

> 📌 **Application root** adalah nama folder di home directory, **bukan** di public_html!

---

## LANGKAH 5 — Upload Backend Code

### Via File Manager cPanel

1. cPanel → **File Manager** → navigasi ke `/home/accj7125/accesstansi_backend/`
2. Upload **semua isi folder** `F:/Alim-Project-accestansi/backend/`:
   - `src/` (folder)
   - `prisma/` (folder — yang berisi `schema.prisma`, **bukan** `schema.sql`)
   - `package.json`
   - `tsconfig.json`
3. **JANGAN** upload: `node_modules/`, `dist/`, `.env`, `package-lock.json`

### Via FTP (FileZilla) — alternatif lebih cepat

- Host: `ftp.accesstansi.id` (atau IP server)
- User/Pass: FTP account dari cPanel
- Upload ke: `/home/accj7125/accesstansi_backend/`

---

## LANGKAH 6 — Build Backend (via Terminal cPanel)

1. cPanel → **Terminal**
2. Jalankan perintah berikut:

```bash
# Masuk ke folder backend
cd ~/accesstansi_backend

# Install dependencies
npm install

# Compile TypeScript → dist/
npm run build

# Generate Prisma Client (WAJIB!)
npx prisma generate
```

3. Kalau sukses: muncul folder `dist/` dengan file `index.js` di dalamnya

> ⚠️ Kalau cPanel tidak punya Terminal, bisa pakai **SSH**:
> ```bash
> ssh accj7125@accesstansi.id
> ```
> (aktifkan SSH Access dulu di cPanel → SSH/Shell Access)

---

## LANGKAH 7 — Buat File .env di Backend

1. cPanel → File Manager → `/home/accj7125/accesstansi_backend/`
2. Klik **+File** → buat file bernama `.env`
3. Klik kanan `.env` → **Edit**
4. Isi dengan (ganti sesuai data kamu):

```env
DATABASE_URL="mysql://accj7125_dbuser:PASSWORD_KAMU@localhost:3306/accj7125_accesstansi"
JWT_SECRET="isi-random-string-64-karakter-di-sini"
JWT_EXPIRES_IN="7d"
NODE_ENV="production"
FRONTEND_URL="https://app.accesstansi.id"
```

5. Klik **Save Changes**

> 🔑 Generate JWT_SECRET (64 karakter random): https://generate-secret.vercel.app/64
>
> 📌 `DATABASE_URL` pakai `localhost` karena backend & database di server yang sama!
>
> 📌 `FRONTEND_URL` **wajib** `https://app.accesstansi.id` (tanpa trailing slash) untuk CORS.

---

## LANGKAH 8 — Restart Node.js App & Test

1. cPanel → **Setup Node.js App**
2. Cari aplikasi `accesstansi_backend`
3. Klik tombol **Restart** (atau ▶ Run)
4. Status harus: **Started**

Test backend aktif (buka di browser):
```
https://api.accesstansi.id/health
```
Harus muncul:
```json
{"status":"ok","time":"2024-..."}
```

---

## LANGKAH 9 — Seed Data Admin

### Edit file `seed_admin.php` (di komputer lokal)

Buka `F:/Alim-Project-accestansi/backend/prisma/seed_admin.php`, ubah baris ini:
```php
$DB_HOST = 'localhost';
$DB_NAME = 'accj7125_accesstansi';   // nama database
$DB_USER = 'accj7125_dbuser';         // user database
$DB_PASS = 'PASSWORD_KAMU';           // password database
```

### Upload & Jalankan

1. Upload `seed_admin.php` ke `public_html/` (bukan ke backend folder!)
2. Buka di browser: `https://accesstansi.id/seed_admin.php`
   - Atau: `https://app.accesstansi.id/seed_admin.php` (tergantung document root)
3. Harus muncul: `✅ Seed berhasil!`
4. **HAPUS SEGERA** file ini dari server!
   - File Manager → `public_html/seed_admin.php` → Delete

---

## LANGKAH 10 — Build Frontend (di komputer lokal)

File `.env.production` sudah diupdate dengan:
```
VITE_API_URL=https://api.accesstansi.id
```

Jalankan build:
```bash
cd F:/Alim-Project-accestansi
npm run build
```

Hasil ada di folder `dist/`:
```
dist/
├── index.html
├── logo.png
├── assets/
│   ├── index-xxx.js
│   └── index-xxx.css
└── .htaccess          ← PENTING, jangan sampai kelewat!
```

---

## LANGKAH 11 — Upload Frontend ke app.accesstansi.id

1. cPanel → File Manager → `/home/accj7125/public_html/app.accesstansi.id/`
2. Upload **semua isi folder `dist/`**:
   - `index.html`
   - `logo.png`
   - `assets/` (folder)
   - `.htaccess` ← **WAJIB! Aktifkan "Show Hidden Files" di File Manager**
3. Pastikan struktur di server:
   ```
   /home/accj7125/public_html/app.accesstansi.id/
   ├── index.html
   ├── logo.png
   ├── assets/
   └── .htaccess
   ```

> ⚠️ `.htaccess` wajib ada agar routing SPA React berfungsi (refresh halaman tidak 404).

---

## LANGKAH 12 — Test Login

1. Buka browser: `https://app.accesstansi.id`
2. Login dengan:
   ```
   Email   : admin@accesstansi.com
   Password: admin123
   ```
3. **Langsung ganti password** di Settings → Users setelah login!

---

## TROUBLESHOOTING

### ❌ `https://api.accesstansi.id/health` tidak bisa diakses
- Cek cPanel → Setup Node.js App → klik nama app → lihat error log
- Pastikan `dist/index.js` ada (jalankan `npm run build` dulu)
- Pastikan file `.env` sudah dibuat dan `DATABASE_URL` benar
- Klik Restart di Setup Node.js App

### ❌ "Cannot connect to database"
- Cek `DATABASE_URL` di `.env` — pastikan nama DB/user/password benar
- Buka phpMyAdmin → pastikan 10 tabel sudah ada
- Pastikan pakai `localhost` (bukan IP eksternal)

### ❌ CORS Error di browser (Network tab: "CORS policy blocked")
- Pastikan `FRONTEND_URL` di backend `.env` = `https://app.accesstansi.id` (persis, tanpa trailing slash)
- Restart Node.js App setelah ubah `.env`

### ❌ Halaman 404 saat refresh / buka URL langsung
- `.htaccess` belum ter-upload ke `app.accesstansi.id/`
- Di File Manager, aktifkan **Show Hidden Files** lalu upload ulang

### ❌ "Application startup file not found" di cPanel
- Belum jalankan `npm run build` → folder `dist/` belum ada
- Terminal: `cd ~/accesstansi_backend && npm run build`

### ❌ Login berhasil tapi data kosong
- Seed belum dijalankan atau gagal
- Jalankan ulang `seed_admin.php`

### ❌ Logo tidak muncul
- Pastikan `logo.png` ter-upload ke `app.accesstansi.id/` (ada di `dist/` setelah build)

---

## STRUKTUR FILE DI RUMAH WEB (setelah selesai)

```
/home/accj7125/
├── public_html/
│   ├── app.accesstansi.id/       ← Frontend React
│   │   ├── index.html
│   │   ├── logo.png
│   │   ├── assets/
│   │   └── .htaccess             ← SPA routing
│   └── api.accesstansi.id/       ← Dibuat otomatis Passenger (biarkan)
│
└── accesstansi_backend/          ← Backend Node.js
    ├── src/
    ├── prisma/
    │   └── schema.prisma
    ├── dist/                     ← Hasil build TypeScript
    │   └── index.js              ← Startup file
    ├── node_modules/             ← Dibuat oleh npm install
    ├── package.json
    ├── tsconfig.json
    └── .env                      ← Database + JWT config
```

---

## RINGKASAN FILE YANG PERLU DISIAPKAN

| File | Keterangan |
|------|------------|
| `backend/prisma/schema.sql` | Import ke phpMyAdmin |
| `backend/prisma/seed_admin.php` | Edit DB credentials → upload → jalankan → HAPUS |
| `backend/.env.rumahweb` | Template → copy & rename jadi `.env` di server |
| `.env.production` | Sudah diset ke `https://api.accesstansi.id` ✅ |
| `dist/` | Hasil `npm run build` → upload ke `app.accesstansi.id/` |
