# Daily Journal PWA

> Jurnal harian personal berbasis Progressive Web App (PWA) dengan arsitektur **offline-first**, Google Apps Script (GAS) sebagai backend serverless, Google Sheets sebagai basis data, Google Drive untuk media resolusi tinggi, dan antarmuka minimalis bernuansa *light cream* yang ditenagai oleh **Tailwind CSS 4**.

---

## 🌟 Fitur Utama

- 🔒 **Keamanan Lokal Berlapis**: Kunci PIN (PBKDF2 SHA-256 310.000 iterasi) dengan pembatasan percobaan eksponensial, biometrik WebAuthn lokal (Face ID / Sidik Jari), dan kunci otomatis latar belakang.
- ✍️ **Penulisan Entri Cepat & Draf Otomatis**:
  - Selector 5 skala mood dengan ikon dan label ramah aksesibilitas.
  - Deteksi tag dan sebutan dinamis (`#topik`, `@orang`).
  - Autosave draf ke IndexedDB setiap 2 detik.
  - Penghitung kata langsung.
- 🖼️ **Dual-Image Storage**:
  - Kompresi sisi klien otomatis (koreksi rotasi EXIF).
  - Thumbnail ringan (~8-10 KB) disimpan langsung di Sheets.
  - Gambar HD (1080px, kualitas 0.8) diunggah privat ke Google Drive.
- 📴 **Offline-First & Background Sync**:
  - Semua penulisan dan pembacaan berjalan instan lewat IndexedDB (`localforage`).
  - Antrean operasi cerdas (`queueStore`) dengan pemicu sinkronisasi multi-lapisan (`online`, `visibilitychange`, dan manual).
  - Indikator status sinkronisasi (*Sync Pill*) di header.
- 📊 **Dasbor Analitik & Heatmap**:
  - Heatmap aktivitas & mood 53 minggu ala GitHub (CSS Grid).
  - Grafik tren mood harian menggunakan Chart.js.
  - Perhitungan streak penulisan berturut-turut.
  - Distribusi tag dan topik terpopuler.
- ⚙️ **Backup & Portabilitas Bebas Vendor**:
  - Ekspor seluruh data ke file JSON dan Markdown.
  - Dukungan tema Light Cream dan Dark Mode.

---

## 🏗️ Struktur Proyek

```
PWA-4/
├── backend/
│   ├── appsscript.json        # Konfigurasi runtime V8 & deployment Web App
│   ├── Code.gs                # Handler doPost & doGet GAS (idempoten & LockService)
│   └── .clasp.json            # Template konfigurasi Google clasp
├── frontend/
│   ├── index.html             # Shell aplikasi PWA (Safe-area cover, responsive)
│   ├── manifest.webmanifest   # Manifest PWA (Cream theme, standalone)
│   ├── vite.config.js         # Vite bundler dengan plugin @tailwindcss/vite
│   ├── public/
│   │   ├── icons/             # Ikon aplikasi 192px, 512px, maskable
│   │   └── sw.js              # Service Worker (precache shell & sync event)
│   └── src/
│       ├── main.js            # Router SPA, boot lock guard, & inisialisasi
│       ├── config.js          # Konstanta timeout, batas resolusi, pagination
│       ├── lock/              # pin.js, webauthn.js, autolock.js
│       ├── data/              # db.js, queue.js, sync.js, api.js
│       ├── media/             # image.js (dual resize & EXIF)
│       ├── components/        # syncPill.js, moodPicker.js, entryCard.js, heatmap.js, toast.js
│       ├── views/             # write.js, timeline.js, detail.js, analytics.js, settings.js
│       ├── styles/app.css     # Tailwind 4 @theme, tokens, & font-face
│       └── assets/fonts/      # Self-hosted woff2: Inter-var & Lora-var
└── brief-tailwind.md          # Spesifikasi teknis & desain
```

---

## 🚀 Panduan Menjalankan Frontend

### 1. Masuk ke direktori frontend & jalankan dev server:
```bash
cd frontend
npm run dev
```
Buka peramban di `http://127.0.0.1:5173/PWA-4/`.

### 2. Membangun bundle produksi:
```bash
npm run build
```
Hasil build berada di `frontend/dist/` dan siap di-deploy ke GitHub Pages atau hosting statis lainnya.

---

## ☁️ Panduan Deployment Backend Google Apps Script (GAS)

1. Buat Google Spreadsheet baru, beri nama sheet pertama `entries`.
2. Format kolom B (`Timestamp`) sebagai **Plain Text**.
3. Buat folder di Google Drive bernama `Journal_Assets` (biarkan akses folder tetap privat).
4. Buka **Extensions → Apps Script**, salin isi [backend/Code.gs](file:///d:/Coding/PWA-4/backend/Code.gs) dan [backend/appsscript.json](file:///d:/Coding/PWA-4/backend/appsscript.json).
5. Pada **Project Settings → Script Properties**, tambahkan:
   - `SHEET_ID`: ID dari Google Spreadsheet Anda.
   - `FOLDER_ID`: ID dari folder Google Drive Anda.
   - `API_TOKEN`: Buat string acak panjang (mis. `openssl rand -hex 32`).
6. Deploy sebagai Web App:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
7. Salin URL Web App yang berakhiran `/exec`.
8. Buka tab **Pengaturan** di aplikasi frontend, tempelkan URL Web App dan `API_TOKEN`. Klik **Simpan Konfigurasi**.
