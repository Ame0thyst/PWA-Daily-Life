# Arsitektur & Alur Sistem (Flow) — Daily Journal PWA

Dokumen ini mendokumentasikan spesifikasi arsitektur, tumpukan teknologi (*tech stack*), alur kerja (*system workflow*), penanganan masalah (*error handling*), dan protokol keamanan proyek **Daily Journal PWA**. Dokumen ini dirancang khusus sebagai panduan visualisasi diagram arsitektur.

---

## 1. Ringkasan Tech Stack & Penempatan Komponen

```mermaid
flowchart TB
    subgraph ClientDevice ["Perangkat Klien (HP / Laptop / Tablet)"]
        direction TB
        subgraph PWA_Shell ["PWA Frontend Layer (GitHub Pages / Localhost)"]
            UI["UI Components & Views\n(Tailwind CSS 4, Vanilla JS ESM, Vite)"]
            SW["Service Worker (sw.js)\n(Offline Cache & Auto-Update)"]
            Router["Hash Router (SPA)\n(#/write, #/timeline, #/analytics, #/settings)"]
            CryptoModule["Security Module\n(Web Crypto API, Crockford Base32, PBKDF2)"]
        end
        subgraph StorageLayer ["Client-Side Storage (IndexedDB via localforage)"]
            StoreEntries["entriesStore\n(Cache Catatan Lokal)"]
            StoreQueue["queueStore\n(Antrean Sinkronisasi Offline)"]
            StoreDraft["draftStore\n(Autosave Tiap 2 Detik)"]
            StoreSettings["settingsStore\n(User_Key, PIN Hash, Preferences)"]
        end
    end

    subgraph CloudLayer ["Cloud Backend (Google Workspace Ecosystem - Gratis)"]
        direction TB
        GAS["Google Apps Script (Web App)\nBackend Serverless Handler\n(Code.gs via doPost & doGet)"]
        GSheets[("Google Sheets Database\n(Sheet: entries - 10 Kolom)")]
        GDrive[("Google Drive Storage\n(Folder: Journal_Assets - Foto HD)")]
    end

    UI --> Router
    Router --> CryptoModule
    UI <--> StorageLayer
    SW <--> StorageLayer
    
    StorageLayer -- "Sync Queue via Fetch API (HTTPS POST)" --> GAS
    GAS <--> GSheets
    GAS <--> GDrive
```

### Rincian Tumpukan Teknologi:
| Komponen | Teknologi / Library | Lokasi / Hosting | Peran Utama |
| :--- | :--- | :--- | :--- |
| **Frontend Shell** | HTML5, Modern Vanilla JS (ES Modules) | GitHub Pages (Statis) | Tampilan antarmuka responsif tanpa runtime framework berat. |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | Bundled via Vite | Desain *light cream*, responsif, dukungan Dark Mode & Safe Area HP. |
| **Bundler & Build Tool**| Vite 6 | GitHub Actions (CI/CD) | Kompilasi cepat, hash cache buster, pemrosesan aset. |
| **PWA & Cache** | Service Worker, Web App Manifest | Browser Perangkat | Instalasi *standalone* di Android/iOS, *offline-first*, dan *auto-update*. |
| **Client Storage** | IndexedDB via `localforage` | Browser / Storage HP | Database lokal instan: catatan, antrean offline, draf, dan setting. |
| **Grafik & Data** | Chart.js | Bundled via npm | Visualisasi tren mood dan heatmap aktivitas 53 minggu. |
| **Backend Engine** | Google Apps Script (V8 Runtime) | Serverless Google Cloud | Endpoint API Web App (`doPost`/`doGet`), LockService, otentikasi token. |
| **Database Utama** | Google Sheets | Google Cloud Personal | Penyimpanan data terstruktur (10 kolom) dengan isolasi `User_Key`. |
| **Penyimpanan Media** | Google Drive API | Google Cloud Personal | Folder privat `Journal_Assets` untuk menampung gambar resolusi tinggi (HD). |

---

## 2. Alur Sistem dari Awal sampai Akhir (End-to-End Workflow)

### A. Alur Inisialisasi & Onboarding Pertama Kali (Boot Sequence)

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (HP/Browser)
    participant App as Frontend (main.js)
    participant IDB as IndexedDB (settingsStore)
    participant Onboarding as Modal Onboarding
    participant GAS as Google Apps Script
    participant Sheet as Google Sheets

    User->>App: Buka URL PWA / Buka Aplikasi
    App->>App: Cek URL Parameter (?connect / ?apiUrl / ?token)
    alt Link Undangan Terdeteksi
        App->>IDB: Simpan Web App URL & API Token Otomatis
    end
    App->>IDB: Cek status PIN / Biometrik
    opt Jika PIN Aktif
        App->>User: Tampilkan Layar Kunci (Lock Screen)
        User->>App: Masukkan PIN / Sidik Jari
    end
    App->>IDB: Cek keberadaan User_Key (hasUserKey)
    alt User Baru (User_Key Belum Ada)
        App->>Onboarding: Tampilkan Modal Selamat Datang
        alt Pilih "Mulai Baru"
            Onboarding->>Onboarding: Generate CSPRNG 128-bit Key (DJ-XXXX-XXXX-XXXX-XXXX)
            Onboarding->>User: Tampilkan Kunci & Tombol Salin
            User->>Onboarding: Konfirmasi "Sudah Simpan Kunci"
            Onboarding->>IDB: Simpan User_Key ke settingsStore
        else Pilih "Saya Sudah Punya Kunci"
            User->>Onboarding: Tempelkan Secret Key Lama
            Onboarding->>IDB: Simpan User_Key
            Onboarding->>GAS: Panggil op: 'list' (Fetch Riwayat Catatan)
            GAS->>Sheet: Filter baris WHERE User_Key == ...
            Sheet-->>GAS: Kembalikan baris catatan
            GAS-->>Onboarding: Data catatan lama
            Onboarding->>IDB: Merge catatan lama ke entriesStore
        end
        Onboarding->>App: Selesai Onboarding, Masuk ke Jurnal
    else User Lama (User_Key Sudah Ada)
        App->>App: Langsung render tampilan (Tab Tulis / Timeline)
    end
```

---

### B. Alur Penulisan & Penyimpanan Catatan (Dual-Storage & Offline-First)

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna
    participant UI as Write View (write.js)
    participant Media as Image Processor (image.js)
    participant IDB as IndexedDB (localforage)
    participant Sync as Sync Engine (sync.js)
    participant GAS as Google Apps Script
    participant Sheet as Google Sheets
    participant Drive as Google Drive

    User->>UI: Ketik catatan, pilih mood, lampirkan foto
    UI->>UI: Auto-detect tag (#topik, @orang) & autosave draft (tiap 2 detik)
    User->>UI: Klik tombol "Simpan Catatan"
    UI->>Media: Proses foto yang diunggah
    Media->>Media: EXIF Auto-Orient & Resize 1080px (HD JPEG, Q=0.8)
    Media->>Media: Generate Thumbnail Mikro (150px Base64, ~8-10 KB)
    UI->>IDB: Simpan catatan instan ke 'entriesStore' (ID, Timestamp, Mood, Tags, Teks, Thumb)
    UI->>IDB: Tambahkan operasi ke 'queueStore' (op: 'create', status: 'pending')
    UI-->>User: Tampilkan toast "Disimpan di perangkat (offline-ready)"
    
    UI->>Sync: Trigger flushQueue()
    alt Perangkat Online & API Config Ada
        Sync->>IDB: Ambil antrean pending
        Sync->>GAS: Kirim POST JSON (Token, User_Key, op: 'create', entry, ImageHD)
        GAS->>GAS: Validasi API_TOKEN & User_Key
        opt Jika ada Foto HD
            GAS->>Drive: Buat file gambar di folder Journal_Assets
            Drive-->>GAS: Return Drive_File_ID
        end
        GAS->>Sheet: Tambah baris baru (10 Kolom lengkap)
        Sheet-->>GAS: Sukses
        GAS-->>Sync: Return { ok: true, fileId: ... }
        Sync->>IDB: Hapus item dari queueStore
        Sync-->>User: Update Sync Pill -> "Tersinkron"
    else Perangkat Offline / Gagal Jaringan
        Sync-->>User: Update Sync Pill -> "Disimpan di perangkat (N)"
        Note over Sync: Disimpan di queueStore; sinkronisasi otomatis<br/>begitu koneksi internet pulih.
    end
```

---

### C. Alur Multi-User Data Isolation (Isolasi Antar Pengguna)

```mermaid
flowchart LR
    subgraph Users ["Multi-User Devices"]
        UserA["Teman A\n(Key: DJ-7X9P-K4M2-...)"]
        UserB["Teman B\n(Key: DJ-3M8Q-W9L2-...)"]
        UserC["Anda Sendiri\n(Key: DJ-8B2X-N1V4-...)"]
    end

    subgraph Gateway ["Google Apps Script (Code.gs)"]
        AuthCheck{"Validasi\nToken & User_Key"}
        FilterOp["Filter Query Berdasarkan User_Key"]
    end

    subgraph Database ["1 Spreadsheet Google Sheets Bersama"]
        Row1["Baris 1: ID_01 | DJ-7X9P... | Curhat A"]
        Row2["Baris 2: ID_02 | DJ-3M8Q... | Curhat B"]
        Row3["Baris 3: ID_03 | DJ-8B2X... | Curhat Anda"]
        Row4["Baris 4: ID_04 | DJ-7X9P... | Catatan A lagi"]
    end

    UserA -- "op: 'list' + User_Key A" --> AuthCheck
    UserB -- "op: 'create' + User_Key B" --> AuthCheck
    UserC -- "op: 'list' + User_Key C" --> AuthCheck

    AuthCheck --> FilterOp
    FilterOp --> Database

    Row1 -. "Hanya dikembalikan ke" .-> UserA
    Row4 -. "Hanya dikembalikan ke" .-> UserA
    Row2 -. "Hanya dikembalikan ke" .-> UserB
    Row3 -. "Hanya dikembalikan ke" .-> UserC
```

---

## 3. Strategi Penanganan Masalah (Error Handling)

| Skenario Kendala | Titik Masalah | Solusi & Mekanisme Penanganan (*Handling*) |
| :--- | :--- | :--- |
| **Koneksi Internet Putus (Offline)** | Jaringan Klien | Operasi tulis tetap 100% berjalan. Data disimpan ke `entriesStore` dan antrean `queueStore`. Event listener `window.ononline` dan `visibilitychange` otomatis memicu `flushQueue()` saat internet aktif kembali. |
| **Ganti Perangkat / Install Ulang** | Kehilangan Data Lokal | Modul [`restoreUserEntries()`](file:///d:/Coding/PWA-4/frontend/src/data/restore.js) otomatis menarik hingga 500 catatan dari Google Sheets berdasarkan `User_Key` yang dimasukkan pada wizard pemulihan. |
| **Pembaruan Aplikasi (*Update Release*)** | Browser Cache Lama | Service Worker menggunakan strategi **Network-First** untuk navigasi (HTML) dan **Stale-While-Revalidate/Cache-First** untuk bundel aset. Begitu ada rilis baru, SW memicu `skipWaiting()` dan `controllerchange` mereload halaman secara mulus. |
| **Konflik Edit Data (*Race Condition*)** | Sinkronisasi Paralel | Menggunakan strategi **Last-Write-Wins (LWW)** berdasarkan perbandingan kolom `Updated_At`. Pada sisi backend GAS, digunakan `LockService.getScriptLock()` dengan timeout 20 detik untuk mencegah tumpang tindih penulisan baris. |
| **Struktur Database Sheets Berubah** | Versi Kolom Lama | Fungsi `sheet_()` memiliki logika **Auto-Migration & Self-Healing**: mendeteksi apakah kolom `User_Key` sudah ada. Jika belum, kolom B otomatis disisipkan dan data lama dipertahankan dengan label default. |
| **Kegagalan API GAS / Limit Kuota** | Backend Google | Antrean menerapkan *exponential backoff* dan penandaan status `failed` pada antrean bermasalah tanpa menghapus catatan lokal. Pengguna dapat mengulang manual di tab Pengaturan. |

---

## 4. Arsitektur Keamanan (Security Matrix)

```mermaid
flowchart TD
    subgraph Perimeter1 ["Lapisan 1: Keamanan Akses Fisik (Perangkat)"]
        PIN["Kunci PIN Lokal (PBKDF2 SHA-256, 310.000 iterasi + Garam)"]
        Bio["Biometrik WebAuthn (Sidik Jari / Face ID)"]
        AutoLock["Auto-Lock Guard (Timer Latar Belakang 1-15 Menit)"]
    end

    subgraph Perimeter2 ["Lapisan 2: Identitas & Privasi Multi-User"]
        SecretKey["Cryptographic Secret Key (128-bit CSPRNG, Crockford Base32)"]
        Isolation["Isolasi Baris Database per User_Key"]
    end

    subgraph Perimeter3 ["Lapisan 3: Saluran & Transportasi Data"]
        HTTPS["Enkripsi Jaringan End-to-End HTTPS TLS 1.3"]
        NoParams["Token & Payload via HTTP POST Body (Bebas URL Log Leak)"]
        InviteLink["Encrypted/Base64 Invite Link with Auto-Clean Address Bar"]
    end

    subgraph Perimeter4 ["Lapisan 4: Backend & Database"]
        SharedSecret["API_TOKEN Shared Secret Authentication"]
        DrivePrivate["Google Drive Folder Private Access (Akses Dibatasi ke Script)"]
    end

    Perimeter1 --> Perimeter2 --> Perimeter3 --> Perimeter4
```

### Rincian Fitur Keamanan:
1. **Zero Exposure of Personal Diary to Strangers**:
   Meskipun repositori frontend bersifat publik, database Google Sheets terlindungi oleh `API_TOKEN`. Selain itu, data antar sesama teman yang menggunakan server bersama diisolasi secara mutlak oleh `User_Key`.
2. **Kunci Kriptografi Entropi Tinggi**:
   Format `DJ-XXXX-XXXX-XXXX-XXXX` dihasilkan menggunakan modul `crypto.getRandomValues(new Uint8Array(16))` sehingga memiliki entropi $2^{128}$ kemungkinan, mustahil untuk ditebak (*brute-force proof*).
3. **Kunci PIN Kebal Analisis Waktu (Constant-Time Comparison)**:
   Verifikasi hash PIN dienkripsi menggunakan PBKDF2 SHA-256 dengan perhitungan waktu perbandingan yang konstan untuk mencegah serangan *timing attack*.
4. **Pembersihan Otomatis URL (*History Cleaning*)**:
   Ketika teman membuka aplikasi melalui tautan undangan (*Invite Link*), skrip [`invite.js`](file:///d:/Coding/PWA-4/frontend/src/components/invite.js) segera menyerap kredensial ke IndexedDB dan membersihkan parameter token dari address bar peramban menggunakan `history.replaceState()`.

---

## 5. Panduan Pembuatan Diagram Visual

Saat Anda memindahkan dokumen ini ke alat desain diagram (seperti Figma, Draw.io, Whimsical, atau Eraser.io), gunakan pembagian 4 zona visual berikut:

1. **Zona Biru / Kiri (Klien Frontend)**:
   - Komponen UI & Navigasi (PWA).
   - Service Worker & Cache Storage.
   - IndexedDB (4 Store: `entries`, `queue`, `draft`, `settings`).
2. **Zona Kuning / Tengah (Protokol Sinkronisasi & Keamanan)**:
   - Filter `User_Key` kriptografis.
   - Auto-lock & Biometrik guard.
   - Antrean Offline (`queueStore` -> `flushQueue`).
3. **Zona Hijau / Kanan (Backend Serverless Google)**:
   - Web App Google Apps Script (`Code.gs`).
   - LockService & Router Operasi (`create`, `update`, `delete`, `list`, `setup`).
4. **Zona Abu-Abu / Bawah (Penyimpanan Cloud)**:
   - Google Spreadsheet (Tabel Data 10 Kolom).
   - Google Drive Folder (`Journal_Assets` untuk file gambar biner).

