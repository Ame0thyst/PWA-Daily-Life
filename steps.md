# Panduan Menjalankan Daily Journal PWA

Panduan langkah demi langkah ini akan memandu Anda mulai dari menjalankan aplikasi di komputer lokal hingga menghubungkannya dengan Google Sheets & Google Drive, serta cara memasangnya di HP (Android/iOS).

---

## Ringkasan Alur Cepat

```
1. Jalankan Frontend Lokal (Langsung bisa dipakai offline)
                    ↓
2. Siapkan Google Sheets & Google Drive
                    ↓
3. Deploy Google Apps Script (Backend Web App)
                    ↓
4. Masukkan Web App URL & Token di Pengaturan Aplikasi
                    ↓
5. (Opsional) Deploy ke GitHub Pages & Pasang di HP (PWA)
```

---

## Langkah 1: Menjalankan Aplikasi di Komputer Lokal

Aplikasi Daily Journal ini dirancang **offline-first**, artinya Anda bisa langsung menggunakannya di browser tanpa backend sekalipun (data disimpan di browser perangkat Anda).

1. Buka terminal (PowerShell, Command Prompt, atau Terminal di VS Code / Antigravity).
2. Pastikan Anda berada di direktori `frontend`:
   ```bash
   cd d:\Coding\PWA-4\frontend
   ```
3. Jalankan server pengembangan Vite:
   ```bash
   npm run dev
   ```
4. Buka browser Anda dan akses tautan yang muncul:
   👉 **`http://127.0.0.1:5173/PWA-4/`**

> [!TIP]
> Pada tahap ini, Anda sudah bisa mencoba:
> - Menulis catatan baru & memilih mood.
> - Menyematkan tag `#topik` dan `@orang`.
> - Melampirkan foto.
> - Membuka tab Timeline, Analitik (Heatmap & Chart.js), serta Pengaturan tema (Dark Mode).

---

## Langkah 2: Menyiapkan Google Sheets & Google Drive

Agar catatan harian tersinkron ke cloud pribadi Anda, siapkan database Google gratis:

### A. Buat Google Spreadsheet
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet, misalnya: **`Daily_Journal_Database`**.
3. Di tab bawah lembar kerja, ubah nama sheet dari `Sheet1` menjadi **`entries`** *(wajib huruf kecil sesuai script)*.
4. Isi judul kolom pada **Baris 1** secara berurutan:
   - Kolom A: `ID`
   - Kolom B: `Timestamp`
   - Kolom C: `Mood`
   - Kolom D: `Tags`
   - Kolom E: `Deleted`
   - Kolom F: `Updated_At`
   - Kolom G: `Drive_File_ID`
   - Kolom H: `Teks`
   - Kolom I: `Thumbnail_Base64`
5. **PENTING**: Blok seluruh **Kolom B (`Timestamp`)**, lalu klik menu **Format** → **Number (Angka)** → pilih **Plain text (Teks biasa)**. Ini mencegah Google Sheets mengubah format tanggal ISO menjadi objek Date.
6. Salin **Spreadsheet ID** dari URL browser Anda:
   - URL: `https://docs.google.com/spreadsheets/d/`**`1a2B3c4D5e6F7g8H9...`**`/edit`
   - Simpan ID yang diapit tanda `/d/` dan `/edit`.

### B. Buat Folder Google Drive (Untuk Foto HD)
1. Buka [Google Drive](https://drive.google.com).
2. Buat folder baru, misalnya bernama: **`Journal_Assets`**.
3. Buka folder tersebut, biarkan aksesnya tetap **Private** (tidak perlu di-share publik).
4. Salin **Folder ID** dari URL browser Anda:
   - URL: `https://drive.google.com/drive/folders/`**`0B1a2b3c4d5e6...`**
   - Simpan ID yang ada di belakang `/folders/`.

---

## Langkah 3: Menyiapkan Google Apps Script (Backend)

1. Di Google Sheets yang Anda buat di Langkah 2, klik menu **Extensions (Ekstensi)** → **Apps Script**.
2. Anda akan diarahkan ke editor kode Google Apps Script.
3. Hapus seluruh isi kode bawaan (`function myFunction() { ... }`).
4. Buka file **`backend/Code.gs`** dari proyek ini, salin seluruh isinya, dan tempelkan ke editor Apps Script.
5. Konfigurasi `appsscript.json`:
   - Di sisi kiri editor Apps Script, klik ikon gerigi ⚙️ (**Project Settings**).
   - Centang opsi: **"Show 'appsscript.json' manifest file in editor"**.
   - Kembali ke ikon editor kode `< >`, klik berkas **`appsscript.json`**.
   - Ganti seluruh isinya dengan isi dari file **`backend/appsscript.json`**:
     ```json
     {
       "timeZone": "Asia/Jakarta",
       "exceptionLogging": "STACKDRIVER",
       "runtimeVersion": "V8",
       "webapp": {
         "executeAs": "USER_DEPLOYING",
         "access": "ANYONE_ANONYMOUS"
       }
     }
     ```
6. Masukkan Kunci Rahasia (**Script Properties**):
   - Di menu **Project Settings** ⚙️, gulir ke bawah ke bagian **Script Properties**.
   - Klik **Add script property**, lalu tambahkan 3 property berikut:

     | Property | Nilai / Value |
     | :--- | :--- |
     | `SHEET_ID` | Tempelkan **Spreadsheet ID** dari Langkah 2A |
     | `FOLDER_ID` | Tempelkan **Folder ID** dari Langkah 2B |
     | `API_TOKEN` | Buat kata kunci rahasia acak yang panjang (misalnya: `KunciRahasiaSaya2026!#JurnalPribadi`) |

   - Klik **Save script properties**.

7. **Deploy Web App**:
   - Di kanan atas, klik tombol biru **Deploy** → pilih **New deployment**.
   - Klik ikon gerigi di sebelah *Select type* → pilih **Web app**.
   - Konfigurasi deployment:
     - **Description**: `v1.0 Daily Journal`
     - **Execute as**: **`Me (email@gmail.com)`**
     - **Who has access**: **`Anyone`** *(Wajib agar PWA bisa mengirim data tanpa perlu login Google)*
   - Klik **Deploy**.
   - Google akan meminta otorisasi akun:
     - Klik **Authorize access** (atau *Review permissions*).
     - Pilih akun Google Anda.
     - Jika muncul peringatan *"Google hasn't verified this app"*, klik tautan kecil **Advanced** (Lanjutan) di kiri bawah, lalu klik **Go to ... (unsafe)**.
     - Klik **Allow**.
   - Salin **Web app URL** yang muncul (URL berakhiran `/exec`, contoh: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## Langkah 4: Menghubungkan Frontend ke Google Apps Script

1. Buka aplikasi Daily Journal Anda di browser: `http://127.0.0.1:5173/PWA-4/`.
2. Klik tab **Pengaturan** (ikon gerigi di navigasi bawah atau samping).
3. Di bagian **Koneksi Google Apps Script**:
   - Pada kolom **Web App URL**: Tempelkan URL Web App yang Anda salin dari Langkah 3.
   - Pada kolom **API Token (Shared Secret)**: Masukkan token rahasia yang sama persis seperti yang Anda atur di `API_TOKEN` Script Properties.
   - Klik **Simpan Konfigurasi**.
4. Klik tombol **Sinkronkan Sekarang**:
   - Amati indikator di header kanan atas: Pil status akan menampilkan **"Menyinkronkan..."** lalu berubah menjadi **"Tersinkron"**.
5. Cek Google Sheets Anda: baris entri yang Anda buat akan langsung muncul di sheet `entries`!

---

## Langkah 5: Memasang Kunci PIN (Keamanan Lokal)

Untuk menjaga privasi jurnal Anda saat perangkat dibuka orang lain:

1. Buka tab **Pengaturan**.
2. Di bagian **Keamanan & Kunci Lokal**, klik tombol **Pasang PIN**.
3. Masukkan 4 atau 6 digit angka, lalu konfirmasi.
4. Anda juga dapat mengaktifkan **Biometrik (Sidik Jari / Face ID)** jika perangkat mendukung.
5. Mulai saat ini, setiap kali aplikasi ditutup atau berada di latar belakang lebih dari 1 menit, layar kunci PIN akan otomatis melindungi catatan Anda.

---

## Langkah 6: Deploy ke GitHub Pages & Pasang di HP (PWA)

Agar aplikasi dapat diakses kapan saja dari smartphone Anda tanpa komputer:

### 1. Build Proyek
Di terminal `frontend`:
```bash
npm run build
```
Hasil kompilasi siap pakai akan berada di folder `frontend/dist/`.

### 2. Penyesuaian Nama Repositori
Jika repositori GitHub Anda bernama `nama-repo`, pastikan baris `base` di file `frontend/vite.config.js` sesuai:
```javascript
export default defineConfig({
  base: '/nama-repo/', // sesuaikan dengan nama repository Anda
  // ...
});
```

### 3. Deploy ke GitHub Pages
Anda dapat mengunggah isi folder `frontend/dist` ke branch `gh-pages` atau menggunakan GitHub Actions untuk deploy otomatis.

### 4. Pasang (Install) di HP:
- **Android (Chrome)**:
  - Buka URL GitHub Pages Anda.
  - Ketuk menu titik tiga (⋮) di kanan atas browser → pilih **Install app** (atau *Tambahkan ke Layar Utama*).
- **iOS / iPhone (Safari)**:
  - Buka URL GitHub Pages Anda di Safari.
  - Ketuk tombol **Share** (ikon kotak dengan panah ke atas) → pilih **Add to Home Screen** (*Tambahkan ke Layar Utama*).
- Buka aplikasi dari layar utama HP Anda, buka menu Pengaturan, dan masukkan Web App URL & API Token Anda sekali saja.

---

## 💡 Uji Coba Offline

1. Buka aplikasi di HP atau browser komputer.
2. Aktifkan **Mode Pesawat (Airplane Mode)** atau putuskan koneksi internet.
3. Tulis jurnal baru dengan foto dan simpan:
   - Aplikasi akan langsung menyimpan entri seketika dengan notifikasi *"Disimpan di perangkat (offline)"*.
   - Status header akan menampilkan: *"Disimpan di perangkat (1)"*.
4. Sambungkan kembali internet:
   - Dalam hitungan detik, aplikasi akan otomatis mengirim data antrean ke Google Sheets dan foto HD ke Google Drive.
   - Status berubah kembali menjadi *"Tersinkron"*.
