# Daily Journal PWA (Offline-First & Analytics-Driven)

**Versi brief:** 2.1 (revisi dari "PWA - 4 (Research Phase)")
**Status:** Research Phase, siap masuk implementasi
**Tanggal revisi:** 25 Oktober 2026

## 1. Deskripsi Proyek

Daily Journal adalah aplikasi jurnal harian berbasis *Progressive Web App* (PWA) untuk penggunaan pribadi. Arsitekturnya *serverless*: Google Apps Script (GAS) sebagai API, Google Sheets sebagai database, dan Google Drive sebagai penyimpanan foto resolusi tinggi. Aplikasi dirancang *offline-first* (menulis dan membaca tetap bisa tanpa koneksi), menyinkronkan data di latar belakang, dan menyediakan dasbor analitik visual (heatmap ala GitHub dan grafik mood). Antarmukanya minimalis dengan palet warna *light cream* dan di-style memakai Tailwind CSS 4.

Revisi ini memuat tiga hal baru dibanding versi sebelumnya: desain UI/UX lengkap (bagian 5), koreksi arsitektur teknis terutama CORS, sinkronisasi, dan keamanan (bagian 3 dan 7), serta daftar fitur tambahan (bagian 10). Versi 2.1 mengganti pendekatan styling menjadi Tailwind CSS 4 (bagian 5.2, 5.8, dan 6).

## 2. Ringkasan Modul

| Modul / Fitur | Interaksi Pengguna | Proses Klien (PWA) | Tindakan Server (GAS) |
| :--- | :--- | :--- | :--- |
| Autentikasi Lokal | Memasukkan PIN (4 atau 6 digit) atau biometrik (WebAuthn). | Memverifikasi PIN terhadap hash PBKDF2 di penyimpanan lokal; auto-lock saat aplikasi di latar belakang. | Tidak ada. |
| Penulisan Entri | Menulis teks, memilih mood, melampirkan foto. Draf tersimpan otomatis. | Menyimpan entri ke IndexedDB dengan UUID, memasukkannya ke antrean sinkronisasi. | Tidak ada pada tahap ini. |
| Background Sync | Pasif. Melihat indikator status sinkronisasi. | Mengirim antrean via `fetch` POST saat online; fallback pada event `online` dan saat aplikasi dibuka. | `doPost` memvalidasi token, menulis ke Sheets/Drive, mengembalikan `{ok: true}`. |
| Dual-Image Storage | Pasif. | Membuat thumbnail dan HD di sisi klien, mengirim keduanya dalam payload. | Menyimpan HD ke Drive (mengambil `fileId`), thumbnail disimpan di Sheets. |
| Timeline | Menggulir daftar entri, membuka detail, mengedit, menghapus. | Membaca dari cache IndexedDB lebih dulu, lalu memperbarui dari server (*stale-while-revalidate*). | Aksi `list` dengan paginasi berbasis kursor. |
| Micro-Dashboard & Heatmap | Membuka tab Analitik. | Merender heatmap dan Chart.js dari data ringkas. | Aksi `stats` yang hanya membaca kolom ringan (tanpa teks dan thumbnail). |
| Ekspor / Backup | Mengetuk "Ekspor" di Pengaturan. | Mengunduh JSON atau Markdown. | Aksi `export`. |

## 3. Keputusan Arsitektur dan Koreksi dari Versi Sebelumnya

Bagian ini mencatat hal-hal yang berubah dari rancangan awal beserta alasannya.

**CORS.** Rancangan awal menyebut GAS menangani CORS secara default dan menyarankan `mode: 'no-cors'` sebagai cadangan. Keduanya bermasalah. POST dengan `Content-Type: application/json` memicu preflight `OPTIONS` yang tidak didukung GAS, sehingga request gagal. `no-cors` menghasilkan respons opaque yang tidak bisa dibaca, padahal klien perlu memastikan sukses sebelum menghapus antrean. Solusi yang dipakai: semua request dikirim sebagai `POST` dengan `Content-Type: text/plain;charset=utf-8` (termasuk operasi baca), isinya JSON string. Ini termasuk *simple request* sehingga tanpa preflight, dan respons JSON dari `ContentService` dapat dibaca. GAS akan mengalihkan (redirect) ke `script.googleusercontent.com`; `fetch` mengikutinya secara otomatis.

**Semua operasi lewat POST.** Karena GAS tidak dapat membaca header HTTP kustom dan token di query string bisa tercatat di log, token dikirim di body. Untuk itu operasi baca (`list`, `stats`, `image`) juga memakai POST. `doGet` hanya dipertahankan sebagai *health check* tanpa data.

**Autentikasi endpoint.** Web App diset "Anyone", sehingga URL saja sudah cukup untuk membaca seluruh jurnal. Ditambahkan *shared secret* (`API_TOKEN`) yang disimpan di Script Properties dan diperiksa di setiap request. Cara membuat dan menyimpannya ada di bagian 7.1.

**Folder Drive privat.** Rancangan awal membuka folder dengan "Anyone with the link". Untuk jurnal pribadi lebih aman membiarkan folder tetap privat dan mengambil gambar HD lewat aksi `image` GAS (dikembalikan sebagai Base64, lalu ditampilkan sebagai `blob:` URL). Konsekuensinya HD tidak bisa dimuat langsung via tag `<img src>`, tetapi thumbnail di timeline tetap instan karena sudah ada di Sheets.

**Urutan kolom Sheets diubah.** Kolom berat (`Teks`, `Thumbnail_Base64`) dipindah ke paling kanan agar aksi `stats` dapat membaca hanya kolom 1 sampai 5 tanpa memuat data besar. Kolom `Deleted` (soft delete), `Updated_At`, dan `Drive_File_ID` ditambahkan. Kolom `Timestamp` harus diformat *plain text* agar Sheets tidak mengubah string ISO menjadi objek `Date`.

**Ekstraksi tag di klien.** Ekstraksi tag dengan regex dipindah ke klien (dan divalidasi ulang di server). Alasannya: bila enkripsi isi jurnal diaktifkan (fase 2), server tidak lagi bisa membaca teks. Konsekuensinya, `Mood`, `Tags`, dan `Timestamp` tetap berupa plaintext di Sheets sebagai metadata untuk analitik.

**Sinkronisasi tidak bergantung pada Background Sync API.** API tersebut hanya didukung browser Chromium dan tidak tersedia di iOS Safari. Pemicu sinkronisasi dibuat berlapis: event `online`, `visibilitychange` (saat aplikasi dibuka kembali), setelah setiap simpan, dan Background Sync bila tersedia. Service Worker tidak bisa membaca `localStorage`, sehingga token dan antrean disimpan di IndexedDB.

**Idempotensi.** Setiap entri diberi UUID di klien sebelum dikirim. Server memeriksa ID sebelum menulis, sehingga pengiriman ulang akibat timeout tidak menghasilkan baris ganda.

**Sifat kunci PIN.** PIN lokal adalah penghalang antarmuka, bukan enkripsi. Selama data di IndexedDB belum dienkripsi, orang yang punya akses fisik dan DevTools masih bisa membacanya. Enkripsi *at rest* masuk fase 2 (bagian 7.4).

## 4. Skema Data

### 4.1 Google Sheets (sheet `entries`)

| # | Kolom | Tipe | Keterangan |
| :-: | :--- | :--- | :--- |
| 1 | `ID` | string | UUID v4 dari klien. |
| 2 | `Timestamp` | string (plain text) | ISO 8601 dengan offset, mis. `2026-10-25T21:14:00+07:00`. |
| 3 | `Mood` | number | Skala 1 sampai 5. |
| 4 | `Tags` | string | Dipisah koma, mis. `#kerja,@andi`. |
| 5 | `Deleted` | boolean | Soft delete. |
| 6 | `Updated_At` | string (ISO) | Dipakai untuk resolusi konflik (last-write-wins). |
| 7 | `Drive_File_ID` | string | ID file HD di Drive; kosong bila tanpa foto. |
| 8 | `Teks` | string | Isi jurnal (ciphertext bila enkripsi aktif). |
| 9 | `Thumbnail_Base64` | string | Maksimum sekitar 10 KB; batas sel Sheets 50.000 karakter. |

Zona waktu proyek GAS diset `Asia/Jakarta` di `appsscript.json` agar perhitungan harian dan streak konsisten.

### 4.2 IndexedDB (via localforage)

| Store | Isi |
| :--- | :--- |
| `entries` | Cache entri untuk dibaca offline (kunci: ID). |
| `queue` | Antrean operasi: `{id, op, payload, status, attempts, createdAt}`. |
| `draft` | Draf entri yang sedang ditulis (autosave). |
| `settings` | Token API, hash PIN dan salt, preferensi tampilan. |

Status item antrean: `pending`, `syncing`, `failed`. Item yang sukses langsung dihapus dari antrean.

## 5. Desain UI/UX

### 5.1 Prinsip Desain

Antarmuka dibuat tenang dan tidak ramai. Satu layar memiliki satu tugas utama, ruang kosong sengaja dibiarkan luas, dan warna aksen dipakai hemat hanya untuk aksi utama dan data mood. Tampilan diprioritaskan untuk HP (*mobile-first*) dengan area sentuh minimal 44 px; di layar lebih lebar (≥ 768 px) tata letak menyesuaikan tanpa membuat versi terpisah.

### 5.2 Design Tokens

**Warna**

| Token `@theme` | Contoh utility | Hex | Penggunaan |
| :--- | :--- | :--- | :--- |
| `--color-cream` | `bg-cream` | `#FAF6EE` | Latar halaman (cream). |
| `--color-paper` | `bg-paper` | `#FFFDF8` | Kartu dan panel. |
| `--color-sand` | `bg-sand` | `#F1E9DA` | Beige: input, chip, hover. |
| `--color-line` | `border-line` | `#E4D9C5` | Garis tipis dan pemisah. |
| `--color-ink` | `text-ink` | `#3A3631` | Teks utama (abu-abu gelap hangat). |
| `--color-ink-muted` | `text-ink-muted` | `#6B6559` | Teks sekunder (kontras sekitar 5:1 di atas `cream`). |
| `--color-accent` | `bg-accent`, `text-accent` | `#A66A3F` | Tombol utama dan tab aktif (terakota lembut). |
| `--color-accent-soft` | `bg-accent-soft` | `#EBD8C6` | Latar tab aktif dan fokus. |
| `--color-danger` | `text-danger` | `#B3473B` | Hapus dan error. |

**Skala mood (5 level)**

| Level | Label | Warna | Ikon |
| :-: | :--- | :--- | :--- |
| 1 | Sangat buruk | `#B8644F` | wajah sedih besar |
| 2 | Kurang baik | `#D99A6C` | wajah sedih |
| 3 | Biasa saja | `#E6D3A3` | wajah datar |
| 4 | Baik | `#A9C08F` | wajah tersenyum |
| 5 | Sangat baik | `#6E9F7A` | wajah gembira |

Hari tanpa entri pada heatmap memakai `#EDE5D4`. Setiap level selalu disertai ikon dan label, tidak hanya warna, agar tetap terbaca bagi pengguna buta warna.

**Tipografi.** Judul dan teks area menulis memakai serif (disarankan *Lora* atau *Fraunces*) untuk kesan jurnal; elemen antarmuka (tab, tombol, label) memakai sans-serif (*Inter* atau font sistem). Ukuran: teks menulis 17 px dengan line-height 1,7; body 15 px; label kecil 12 px. Font di-*self-host* dalam format woff2 dan masuk daftar precache, jangan memakai Google Fonts CDN karena akan gagal saat offline. Di Tailwind, family didaftarkan lewat `--font-sans` dan `--font-serif` di `@theme` sehingga dipakai sebagai `font-sans` dan `font-serif` (lihat bagian 5.8).

**Bentuk dan jarak.** Skala jarak bawaan Tailwind sudah kelipatan 4 px (`p-1` = 4 px, `p-4` = 16 px, `p-6` = 24 px), jadi tidak perlu token jarak tambahan. Radius kartu 14 px (`rounded-card`), input 12 px (`rounded-field`), chip `rounded-full`. Bayangan sangat tipis (`shadow-card`), dan pemisah lebih banyak memakai garis `border-line` daripada bayangan.

### 5.3 Navigasi dan Tata Letak

Pada HP, navigasi utama adalah *bottom tab bar* dengan empat tab: **Tulis**, **Timeline**, **Analitik**, **Pengaturan**. Tab Tulis menjadi layar awal setelah membuka kunci. Header atas berisi judul layar dan *sync pill* (indikator status). Seluruh layout menghormati *safe area* (`viewport-fit=cover` dan `env(safe-area-inset-*)`) agar tidak tertutup notch atau gesture bar.

Pada layar ≥ 768 px, tab bar berubah menjadi *rail* vertikal di kiri, konten dibatasi lebar maksimum 680 px di tengah, dan halaman Analitik memakai grid dua kolom.

### 5.4 Indikator Status Sinkronisasi (Sync Pill)

Pil kecil di header selalu menunjukkan keadaan terbaru agar pengguna tidak perlu menebak.

| Kondisi | Teks | Perilaku |
| :--- | :--- | :--- |
| Offline, ada antrean | "Disimpan di perangkat (2)" | Angka menunjukkan jumlah entri belum terkirim. |
| Sedang mengirim | "Menyinkronkan..." | Animasi titik halus (nonaktif bila *reduced motion*). |
| Semua terkirim | "Tersinkron" | Hilang otomatis setelah 3 detik. |
| Gagal | "Gagal. Ketuk untuk coba lagi" | Mengetuk memicu `flushQueue()` manual; bila penyebabnya token salah, diarahkan ke Pengaturan. |

### 5.5 Wireframe Layar

**A. Layar Kunci**

```
┌──────────────────────────────┐
│                              │
│        [ikon aplikasi]       │
│         Daily Journal        │
│    Masukkan PIN untuk masuk  │
│                              │
│          ●  ●  ○  ○         │
│                              │
│        [1]  [2]  [3]         │
│        [4]  [5]  [6]         │
│        [7]  [8]  [9]         │
│      [sidik jari] [0] [hapus]│
│                              │
│   Terlalu banyak percobaan?  │
│   tunggu 30 detik            │
└──────────────────────────────┘
```

Tombol biometrik hanya muncul bila perangkat mendukung dan sudah didaftarkan. Setelah 5 kali salah, ada jeda yang menggandakan diri (30 d, 1 m, 2 m, dan seterusnya). Aplikasi mengunci ulang otomatis bila berada di latar belakang lebih dari 60 detik (dapat diubah di Pengaturan).

**B. Tulis (layar utama)**

```
┌──────────────────────────────┐
│ Minggu, 25 Okt      [Tersinkron]│
│──────────────────────────────│
│ Bagaimana harimu?            │
│ [😞][🙁][😐][🙂][😄]          │
│  1    2    3    4    5       │
│                              │
│ ┌──────────────────────────┐ │
│ │ Tulis sesuatu...         │ │
│ │                          │ │
│ │ Hari ini #kerja selesai  │ │
│ │ bareng @andi             │ │
│ └──────────────────────────┘ │
│  #kerja  @andi        128 kata│
│                              │
│ [ + Foto ]        [  Simpan ]│
│──────────────────────────────│
│ Tulis  Timeline  Analitik  ⚙ │
└──────────────────────────────┘
```

Selector mood berupa lima tombol dengan label di bawahnya. Tag yang terdeteksi saat mengetik (`#kata`, `@kata`) langsung tampil sebagai chip di bawah area teks. Draf disimpan otomatis ke IndexedDB setiap 2 detik setelah berhenti mengetik, dan dipulihkan bila aplikasi tertutup. Tombol Simpan nonaktif bila teks kosong atau mood belum dipilih. Setelah menyimpan, muncul toast "Disimpan di perangkat" (offline) atau "Tersimpan" (online), formulir dikosongkan, dan fokus kembali ke area teks.

Lampiran foto menampilkan pratinjau kecil dengan tombol hapus. Pemrosesan gambar berjalan di klien dan memperlihatkan indikator singkat bila lebih dari 300 ms.

**C. Timeline**

```
┌──────────────────────────────┐
│ Timeline            [Tersinkron]│
│ [cari...]        [Filter: tag]│
│──────────────────────────────│
│ Oktober 2026                 │
│ ┌──────────────────────────┐ │
│ │ 25 Okt, 21:14  [mood 4]  │ │
│ │ Hari ini #kerja selesai..│ │
│ │ [thumb]  #kerja @andi    │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 24 Okt, 20:02  [mood 3]  │ │
│ │ Cukup melelahkan tapi... │ │
│ └──────────────────────────┘ │
│        (memuat lebih...)     │
│──────────────────────────────│
│ Tulis  Timeline  Analitik  ⚙ │
└──────────────────────────────┘
```

Entri dikelompokkan per bulan. Setiap kartu menampilkan tanggal, titik/ikon mood, dua baris cuplikan teks, thumbnail kecil bila ada, dan chip tag. Daftar memuat 20 entri per halaman dengan *infinite scroll* (kursor dari server). Kartu yang masih di antrean diberi penanda "Belum tersinkron". Pencarian dan filter tag bekerja pada cache lokal sehingga tetap berfungsi offline.

**D. Detail Entri**

```
┌──────────────────────────────┐
│ [kembali]        [Edit][Hapus]│
│ Minggu, 25 Okt 2026 · 21:14  │
│ Mood: 4 - Baik               │
│                              │
│ [foto: thumbnail → HD saat   │
│  dibuka, dengan skeleton]    │
│                              │
│ Teks lengkap entri dengan    │
│ tipografi serif yang lega... │
│                              │
│ #kerja  @andi                │
└──────────────────────────────┘
```

Foto menampilkan thumbnail terlebih dahulu (buram), lalu diganti HD setelah aksi `image` selesai; bila offline, thumbnail tetap tampil dengan catatan "HD tersedia saat online". Hapus meminta konfirmasi dan bersifat soft delete.

**E. Analitik**

```
┌──────────────────────────────┐
│ Analitik   [30 hari|90 hari|1 th]│
│──────────────────────────────│
│ Streak: 12 hari   Entri: 87  │
│                              │
│ Aktivitas                    │
│ ▢▢▣▣▢▣▣▣▢▣▣▢▣▣▣ (heatmap 53×7)│
│ Sedikit ▢▣ Banyak            │
│                              │
│ Tren mood (garis, rata-rata  │
│ mingguan)                    │
│                              │
│ Tag teratas (batang horizontal)│
│ #kerja ████████ 24           │
│ #olahraga ████ 12            │
│──────────────────────────────│
│ Tulis  Timeline  Analitik  ⚙ │
└──────────────────────────────┘
```

Heatmap memakai CSS Grid (53 kolom × 7 baris), warna sel mengikuti skala mood (rata-rata mood bila ada beberapa entri pada hari yang sama), dan mengetuk sel membuka entri hari itu. Saat data dimuat, tampil *skeleton* abu-abu, bukan spinner. Bila belum ada data, tampil keadaan kosong dengan ajakan menulis entri pertama.

**F. Pengaturan**

Bagian-bagiannya: Keamanan (ganti PIN, aktifkan biometrik, jeda auto-lock, panjang PIN 4/6 digit), Sinkronisasi (URL Web App, token API, tombol "Sinkronkan sekarang", daftar item antrean gagal), Data (ekspor JSON/Markdown, hapus cache lokal), Tampilan (ukuran font, tema krem atau gelap bila diaktifkan), dan Tentang (versi aplikasi). Pada penggunaan pertama, Pengaturan juga menjadi layar *onboarding* untuk menempelkan URL dan token.

### 5.6 Keadaan Khusus dan Mikro-interaksi

Setiap layar memiliki empat keadaan yang dirancang eksplisit: *loading* (skeleton), *empty* (teks ramah dan satu aksi), *error* (pesan jelas dengan tombol coba lagi), dan *offline* (tetap menampilkan cache dengan penanda). Transisi antarlayar memakai fade 150 sampai 200 ms; semua animasi dinonaktifkan bila `prefers-reduced-motion: reduce` (di Tailwind: varian `motion-reduce:`). Umpan balik haptik singkat (`navigator.vibrate`) opsional saat menyimpan, di perangkat yang mendukung.

### 5.7 Aksesibilitas

Kontras teks minimal 4,5:1, area sentuh minimal 44×44 px, fokus keyboard terlihat jelas (cincin `--accent`), tombol ikon memiliki `aria-label`, selector mood memakai `role="radiogroup"` dengan label teks, dan indikator sync diumumkan lewat `aria-live="polite"`. Ukuran font mengikuti pengaturan sistem (satuan `rem`).

### 5.8 Implementasi Styling dengan Tailwind CSS 4

Tailwind CSS 4 dikonfigurasi lewat CSS, bukan `tailwind.config.js`. Tidak ada file konfigurasi JavaScript, tidak ada `postcss.config.js`, dan tidak perlu daftar `content`, karena Tailwind mendeteksi sumber kelas secara otomatis. Styling dibangun saat *build* (bukan lewat Play CDN), sehingga CSS akhir ikut di-precache dan bekerja offline.

**Instalasi (Vite)**

```bash
npm i -D vite tailwindcss @tailwindcss/vite
```

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/nama-repo/',          // sesuai nama repositori GitHub Pages
  plugins: [tailwindcss()],
});
```

**`src/styles/app.css`: satu-satunya file CSS**

```css
@import "tailwindcss";

/* Font self-host: letakkan woff2 di src/assets/fonts agar di-hash dan ikut precache */
@font-face {
  font-family: "Inter";
  src: url("../assets/fonts/inter-var.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: "Lora";
  src: url("../assets/fonts/lora-var.woff2") format("woff2");
  font-weight: 400 700;
  font-display: swap;
}

@theme {
  /* Warna */
  --color-cream: #FAF6EE;
  --color-paper: #FFFDF8;
  --color-sand: #F1E9DA;
  --color-line: #E4D9C5;
  --color-ink: #3A3631;
  --color-ink-muted: #6B6559;
  --color-accent: #A66A3F;
  --color-accent-soft: #EBD8C6;
  --color-danger: #B3473B;

  /* Mood 1-5 dan hari kosong pada heatmap */
  --color-mood-1: #B8644F;
  --color-mood-2: #D99A6C;
  --color-mood-3: #E6D3A3;
  --color-mood-4: #A9C08F;
  --color-mood-5: #6E9F7A;
  --color-heat-empty: #EDE5D4;

  /* Tipografi */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Lora", ui-serif, Georgia, serif;

  /* Bentuk */
  --radius-card: 14px;
  --radius-field: 12px;
  --shadow-card: 0 1px 2px rgb(58 54 49 / 0.06);
}

/* Warna border bawaan Tailwind 4 adalah currentColor, jadi atur default-nya */
@layer base {
  *, ::before, ::after { border-color: var(--color-line); }
}
```

Karena utility Tailwind 4 membaca variabel `--color-*` saat runtime, tema gelap (opsional) cukup menimpa variabel yang sama tanpa menambahkan awalan `dark:` di setiap elemen:

```css
[data-theme="dark"] {
  --color-cream: #1F1D1A;  --color-paper: #272420;  --color-sand: #332F2A;
  --color-line: #403B34;   --color-ink: #EFE9DD;    --color-ink-muted: #B3AA9A;
  --color-accent: #D49A6A; --color-accent-soft: #4A3626;
}
```

Nilai gelap di atas hanya contoh awal; kontrasnya perlu diperiksa ulang bila fitur ini diaktifkan.

**Halaman dasar (`index.html`)**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<body class="min-h-dvh bg-cream font-sans text-[15px] text-ink antialiased">
  <header class="pt-[env(safe-area-inset-top)]">...</header>
  <main class="mx-auto max-w-170 px-4 pb-24 md:pb-8 md:pl-24">...</main>
</body>
```

`max-w-170` setara 680 px (170 × 4 px). `pb-24` memberi ruang agar konten tidak tertutup tab bar.

**Contoh komponen**

Selector mood (target sentuh 44 px lewat `min-h-11`, status terpilih lewat varian `aria-checked:`):

```html
<div role="radiogroup" aria-label="Mood hari ini" class="flex gap-2">
  <button role="radio" aria-checked="false" data-mood="4"
    class="flex min-h-11 flex-1 flex-col items-center gap-1 rounded-field border bg-paper py-2
           text-xs text-ink-muted
           aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:text-ink
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
    <span class="text-2xl" aria-hidden="true">🙂</span>
    Baik
  </button>
  <!-- ...empat tombol lain -->
</div>
```

Sync pill (satu elemen, tampilan berubah mengikuti atribut `data-state` yang diatur JavaScript):

```html
<div role="status" aria-live="polite" data-state="synced"
  class="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-xs text-ink-muted
         data-[state=offline]:bg-accent-soft data-[state=offline]:text-ink
         data-[state=syncing]:motion-safe:animate-pulse
         data-[state=error]:bg-danger/10 data-[state=error]:text-danger">
  Tersinkron
</div>
```

Navigasi (bottom tab bar di HP, rail di kiri pada layar ≥ 768 px):

```html
<nav class="fixed inset-x-0 bottom-0 z-10 border-t bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur
            md:inset-x-auto md:inset-y-0 md:left-0 md:w-20 md:border-t-0 md:border-r md:pb-0">
  <ul class="flex justify-around md:h-full md:flex-col md:items-center md:justify-start md:gap-2 md:pt-6">
    <li>
      <a href="#/write" aria-current="page"
        class="flex min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 rounded-field px-3
               text-xs text-ink-muted aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent">
        Tulis
      </a>
    </li>
    <!-- Timeline, Analitik, Pengaturan -->
  </ul>
</nav>
```

Kartu entri dan skeleton:

```html
<article class="rounded-card border bg-paper p-4 shadow-card">
  <header class="flex items-center justify-between text-xs text-ink-muted">
    <time datetime="2026-10-25T21:14:00+07:00">25 Okt, 21:14</time>
    <span class="size-2.5 rounded-full bg-mood-4" role="img" aria-label="Mood 4"></span>
  </header>
  <p class="mt-2 line-clamp-2 font-serif text-[17px] leading-[1.7]">Hari ini #kerja selesai bareng @andi...</p>
</article>

<div class="h-24 animate-pulse rounded-card bg-sand motion-reduce:animate-none"></div>
```

Heatmap (53 kolom × 7 baris dengan `grid-flow-col` dan `grid-rows-7`):

```javascript
// Gunakan nama kelas LENGKAP di peta ini agar terdeteksi Tailwind
const HEAT = ['bg-heat-empty', 'bg-mood-1', 'bg-mood-2', 'bg-mood-3', 'bg-mood-4', 'bg-mood-5'];

const cell = (level, date, label) =>
  `<button data-date="${date}" aria-label="${label}"
     class="size-3 rounded-xs ${HEAT[level]}"></button>`;

// container: <div class="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto"></div>
```

**Aturan yang wajib diikuti**

Tailwind memindai teks sumber untuk nama kelas lengkap, jadi kelas tidak boleh dirakit dari potongan string. Kode seperti `` `bg-mood-${n}` `` tidak akan menghasilkan CSS; gunakan peta berisi nama kelas utuh seperti `HEAT` di atas. Untuk nilai yang benar-benar dinamis, gunakan atribut `data-*` atau variabel CSS inline.

Beberapa nama utility berubah dari Tailwind 3: `shadow-sm` menjadi `shadow-xs`, `rounded-sm` menjadi `rounded-xs`, `outline-none` menjadi `outline-hidden`, `ring` kini selebar 1 px (gunakan `ring-2` untuk tebal lama), dan `bg-opacity-*` dihapus sehingga transparansi ditulis `bg-paper/95`. Warna border bawaan juga berubah menjadi `currentColor`, itulah alasan aturan `@layer base` di atas.

Grafik Chart.js dirender di `<canvas>` dan tidak membaca kelas Tailwind. Ambil warna dari token yang sama agar konsisten, misalnya `getComputedStyle(document.documentElement).getPropertyValue('--color-accent')`.

**Dukungan browser.** Tailwind CSS 4 menargetkan browser modern: Safari 16.4+, Chrome 111+, dan Firefox 128+. HP dengan iOS atau Chrome lebih lama dari itu akan menampilkan antarmuka yang rusak. Untuk pemakaian pribadi ini biasanya bukan masalah, tetapi periksa versi di perangkat Anda sebelum memutuskan.

## 6. Struktur Proyek yang Disarankan

Disarankan Vite + JavaScript modular (tanpa framework) untuk frontend, karena kebutuhan PWA offline lebih sederhana tanpa lapisan SSR. Bila tetap memilih Next.js, gunakan *static export* dan perhatikan `basePath` untuk GitHub Pages serta konfigurasi Service Worker secara manual. Pada Next.js, Tailwind 4 dipasang lewat `@tailwindcss/postcss`, bukan plugin Vite.

```
daily-journal/
├─ frontend/
│  ├─ index.html
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  ├─ vite.config.js        # plugin @tailwindcss/vite
│  ├─ src/
│  │  ├─ main.js
│  │  ├─ config.js           # API_URL (bukan token)
│  │  ├─ lock/               # pin.js, webauthn.js, autolock.js
│  │  ├─ data/               # db.js (localforage), queue.js, sync.js, api.js
│  │  ├─ media/              # image.js (resize, base64)
│  │  ├─ views/              # write.js, timeline.js, detail.js, analytics.js, settings.js
│  │  ├─ components/         # moodPicker.js, syncPill.js, entryCard.js, heatmap.js
│  │  └─ styles/app.css      # @import "tailwindcss", @font-face, @theme
│  └─ public/icons/          # 192, 512, maskable
└─ backend/                  # proyek clasp
   ├─ appsscript.json
   ├─ Code.gs
   └─ .clasp.json
```

## 7. Spesifikasi Teknis

### 7.1 Token API (Shared Secret)

Token dibuat sendiri, bukan didapat dari layanan. Hasilkan string acak panjang, misalnya `openssl rand -hex 32` di Git Bash, lalu simpan di GAS pada **Project Settings → Script Properties** dengan key `API_TOKEN`. Spreadsheet ID dan Folder ID disimpan dengan cara yang sama (`SHEET_ID`, `FOLDER_ID`), jangan ditulis di kode karena ikut ter-push lewat `clasp`.

Di sisi klien, jangan menulis token di file JS atau konfigurasi karena frontend di GitHub Pages bersifat publik. Tempelkan token sekali saat onboarding di Pengaturan dan simpan di IndexedDB perangkat. Token adalah *shared secret*: bila bocor, ganti nilainya di Script Properties dan tempel ulang di perangkat.

### 7.2 Backend GAS

**`appsscript.json`**

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

`ANYONE_ANONYMOUS` diperlukan agar `fetch` dari PWA tidak diminta login Google. Perlindungan datanya berasal dari `API_TOKEN`.

**`Code.gs` (inti)**

```javascript
const P = PropertiesService.getScriptProperties();
const COLS = ['ID','Timestamp','Mood','Tags','Deleted','Updated_At',
              'Drive_File_ID','Teks','Thumbnail_Base64'];
const MAX_IMG_B64 = 3000000; // sekitar 2,2 MB biner

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function sheet_() {
  return SpreadsheetApp.openById(P.getProperty('SHEET_ID')).getSheetByName('entries');
}
function authOk_(t) {
  const real = P.getProperty('API_TOKEN');
  return !!real && !!t && t === real;
}

function doGet() { return json_({ ok: true, service: 'daily-journal' }); } // health check

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    if (!authOk_(req.token)) return json_({ ok: false, error: 'unauthorized' });
    lock.waitLock(20000);
    switch (req.op) {
      case 'create': return json_(createEntry_(req.entry));
      case 'update': return json_(updateEntry_(req.entry));
      case 'delete': return json_(deleteEntry_(req.id));
      case 'list':   return json_(listEntries_(req.limit || 20, req.cursor || null));
      case 'stats':  return json_(stats_());
      case 'image':  return json_(getImage_(req.fileId));
      default:       return json_({ ok: false, error: 'unknown_op' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return null;
  const hit = sh.getRange(2, 1, last - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : null;
}

function createEntry_(en) {
  const sh = sheet_();
  if (findRow_(sh, en.id)) return { ok: true, id: en.id, duplicate: true }; // idempoten

  let fileId = '';
  if (en.imageHD) {
    if (en.imageHD.length > MAX_IMG_B64) return { ok: false, error: 'image_too_large' };
    const bytes = Utilities.base64Decode(en.imageHD);          // base64 mentah tanpa prefix data:
    const blob = Utilities.newBlob(bytes, 'image/jpeg', en.id + '.jpg');
    fileId = DriveApp.getFolderById(P.getProperty('FOLDER_ID')).createFile(blob).getId();
  }
  const tags = (en.tags || []).join(',');
  sh.appendRow([en.id, en.timestamp, en.mood, tags, false, en.updatedAt,
                fileId, en.text, en.thumb || '']);
  return { ok: true, id: en.id, fileId: fileId };
}

function updateEntry_(en) {
  const sh = sheet_(); const row = findRow_(sh, en.id);
  if (!row) return { ok: false, error: 'not_found' };
  const cur = sh.getRange(row, 6).getValue();
  if (cur && cur > en.updatedAt) return { ok: true, id: en.id, skipped: true }; // last-write-wins
  sh.getRange(row, 3, 1, 4).setValues([[en.mood, (en.tags||[]).join(','), false, en.updatedAt]]);
  sh.getRange(row, 8).setValue(en.text);
  return { ok: true, id: en.id };
}

function deleteEntry_(id) {
  const sh = sheet_(); const row = findRow_(sh, id);
  if (!row) return { ok: true, id: id };            // sudah tidak ada: anggap sukses
  sh.getRange(row, 5).setValue(true);
  sh.getRange(row, 6).setValue(new Date().toISOString());
  return { ok: true, id: id };
}

// Paginasi kursor: baca per blok baris dari bawah, bukan getDataRange()
function listEntries_(limit, beforeRow) {
  const sh = sheet_(); const last = sh.getLastRow();
  const end = beforeRow ? Math.min(beforeRow - 1, last) : last;
  if (end < 2) return { ok: true, items: [], nextCursor: null };
  const start = Math.max(2, end - limit + 1);
  const rows = sh.getRange(start, 1, end - start + 1, COLS.length).getValues();
  const items = rows.reverse().filter(r => r[4] !== true).map(r => ({
    id: r[0], timestamp: r[1], mood: r[2],
    tags: r[3] ? String(r[3]).split(',') : [],
    updatedAt: r[5], fileId: r[6], text: r[7], thumb: r[8]
  }));
  return { ok: true, items: items, nextCursor: start > 2 ? start : null };
}

// Hanya kolom 1-5: tanpa teks dan thumbnail, jadi tetap cepat
function stats_() {
  const sh = sheet_(); const last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  const rows = sh.getRange(2, 1, last - 1, 5).getValues()
    .filter(r => r[4] !== true)
    .map(r => ({ id: r[0], t: r[1], mood: r[2], tags: r[3] }));
  return { ok: true, rows: rows };
}

function getImage_(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  return { ok: true, base64: Utilities.base64Encode(blob.getBytes()) };
}
```

**Deploy dan URL stabil.** Setiap `clasp push` tidak otomatis memperbarui Web App. Buat deployment sekali (`clasp deploy`), catat *deployment ID*, lalu untuk pembaruan berikutnya gunakan `clasp deploy -i <deploymentId>` agar URL tidak berubah. Setelah deploy, pastikan URL berakhiran `/exec`.

**Batasan GAS yang perlu diingat.** Satu eksekusi maksimum 6 menit; kuota Drive 15 GB dibagi dengan akun Google; thumbnail di sel Sheets maksimum 50.000 karakter (target thumbnail ≤ 10 KB Base64). Gunakan `LockService` (seperti di atas) agar penulisan bersamaan tidak merusak urutan baris.

### 7.3 Klien: API, Antrean, Sinkronisasi

```javascript
// api.js: simple request tanpa preflight; token di body
export async function callApi(op, payload = {}) {
  const { apiUrl, token } = await getSettings();
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, op, ...payload }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
```

```javascript
// sync.js: kirim antrean secara berurutan; hentikan pada galat jaringan
let flushing = false;
export async function flushQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true; setSyncState('syncing');
  try {
    for (const item of await queue.listPending()) {
      try {
        const r = await callApi(item.op, item.payload);
        if (r.ok) { await queue.remove(item.id); continue; }
        if (r.error === 'unauthorized') { setSyncState('auth_error'); return; }
        await queue.markFailed(item.id, r.error);        // galat permanen untuk item ini
      } catch (netErr) {                                  // jaringan putus: coba lagi nanti
        await queue.bumpAttempts(item.id); setSyncState('offline'); return;
      }
    }
    setSyncState('synced');
  } finally { flushing = false; }
}
// Pemicu berlapis
window.addEventListener('online', flushQueue);
document.addEventListener('visibilitychange', () => { if (!document.hidden) flushQueue(); });
// setelah setiap simpan -> flushQueue(); Background Sync bila tersedia (di SW)
```

Item gagal diberi *backoff* (percobaan ulang bertahap) dan ditampilkan di Pengaturan bila sudah gagal beberapa kali. Baik `online` maupun `visibilitychange` aman dipanggil berulang berkat penjaga `flushing`.

**Pemrosesan gambar (klien)**

```javascript
// image.js: gunakan sisi terpanjang agar foto potret tidak terlalu besar
async function resize(bmp, maxSide, quality) {
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', quality));
}
const toB64 = b => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result.split(',')[1]);   // buang prefix data:
  fr.onerror = rej; fr.readAsDataURL(b);
});
export async function processImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); // koreksi EXIF
  const [hd, th] = await Promise.all([resize(bmp, 1080, 0.8), resize(bmp, 150, 0.5)]);
  return { imageHD: await toB64(hd), thumb: await toB64(th) };
}
```

Estimasi ukuran: HD 1080 px kualitas 0,8 sekitar 150 sampai 400 KB, menjadi sekitar 200 sampai 550 KB setelah Base64; thumbnail 150 px sekitar 8 KB. Bila `doPost` melampaui 5 sampai 7 detik, turunkan kualitas atau dimensi HD.

### 7.4 Keamanan Lokal

**PIN.** Disimpan sebagai hash PBKDF2 dengan salt acak, bukan teks biasa.

```javascript
async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin),
                                            'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}
```

Dengan 4 digit hanya ada 10.000 kemungkinan, jadi pembatasan percobaan (jeda yang menggandakan diri) wajib, dan pilihan PIN 6 digit disediakan di Pengaturan.

**WebAuthn.** Dipakai sebagai *gate* lokal (`authenticatorAttachment: 'platform'`, `userVerification: 'required'`); credential dibuat saat setup dan diverifikasi lewat `navigator.credentials.get` saat membuka kunci. Perlu diketahui bahwa tanpa server dan tanpa ekstensi PRF, ini hanya pengaman antarmuka, setara dengan PIN dari sisi perlindungan data.

**Auto-lock.** Kunci diaktifkan kembali saat aplikasi dibuka dari kondisi tertutup, dan saat `visibilitychange` ke `hidden` melebihi batas waktu. Layar Kunci harus tampil sebelum data historis dirender apa pun.

**Fase 2: enkripsi isi jurnal.** Teks (dan idealnya foto) dienkripsi di klien dengan AES-GCM sebelum dikirim, sehingga Sheets dan Drive hanya berisi ciphertext. Kunci diturunkan dari *passphrase* terpisah lewat PBKDF2, bukan dari PIN 4 digit, karena kunci dari PIN dapat ditebak secara offline. Konsekuensinya: kehilangan passphrase berarti data tidak bisa dipulihkan, dan metadata (`Timestamp`, `Mood`, `Tags`) tetap plaintext agar analitik dapat berjalan.

### 7.5 PWA dan Service Worker

**`manifest.webmanifest`** memakai path relatif agar tetap benar di subpath GitHub Pages (`https://user.github.io/nama-repo/`).

```json
{
  "name": "Daily Journal",
  "short_name": "Journal",
  "start_url": "./?source=pwa",
  "scope": "./",
  "display": "standalone",
  "background_color": "#FAF6EE",
  "theme_color": "#FAF6EE",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**Strategi cache.** *App shell* (HTML, CSS, JS, font, ikon, dan library seperti Chart.js dan localforage) di-*precache* dan dilayani *cache-first*, dengan nama cache berversi (`journal-static-v1`) dan pembersihan versi lama saat `activate`. Panggilan API tidak di-cache oleh Service Worker (token berada di body POST, dan POST memang tidak di-cache); sebagai gantinya aplikasi sendiri menerapkan *stale-while-revalidate* memakai cache IndexedDB. Library pihak ketiga harus disertakan lokal atau masuk daftar precache, bukan dimuat dari CDN saat runtime, agar dasbor tetap bisa dirender offline.

```javascript
// sw.js (kerangka)
const CACHE = 'journal-static-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest' /* + aset hasil build */];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // lewati API
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
self.addEventListener('sync', e => { if (e.tag === 'sync-journal') e.waitUntil(notifyClientsToFlush()); });
```

**Catatan platform.** Di iOS, PWA harus dipasang lewat Share → Add to Home Screen agar penyimpanannya tidak terkena pembersihan otomatis Safari. Panggil `navigator.storage.persist()` saat pertama berjalan untuk meminta penyimpanan persisten.

## 8. Tahapan Eksekusi

### Tahap 1: Persiapan

1. **Repositori dan lingkungan.** Buat repositori Git, manfaatkan alias Git Bash/PowerShell yang sudah ada, siapkan `frontend/` (Vite) dan `backend/` (clasp: `clasp login`, `clasp create --type webapp`).
2. **Google Sheets.** Buat spreadsheet dengan sheet `entries` dan sembilan kolom sesuai bagian 4.1; format kolom `Timestamp` sebagai plain text. Simpan ID ke Script Properties (`SHEET_ID`).
3. **Google Drive.** Buat folder `Journal_Assets` dan biarkan privat. Simpan ID ke Script Properties (`FOLDER_ID`).
4. **Token.** Buat `API_TOKEN` dan simpan di Script Properties (bagian 7.1).
5. **Desain dan styling.** Finalkan design tokens (bagian 5.2), pasang Tailwind CSS 4 (bagian 5.8), dan buat wireframe kasar di alat pilihan sebagai acuan.

### Tahap 2: Implementasi

1. **Backend.** Tulis `Code.gs` sesuai bagian 7.2, lalu uji tiap aksi dengan `curl` atau skrip uji (termasuk token salah, ID duplikat, dan gambar besar).
2. **Fondasi PWA.** Manifest, Service Worker, layar Kunci (PIN, auto-lock), dan lapisan data (localforage, antrean).
3. **Fitur inti.** Layar Tulis (draf otomatis, mood, tag, foto), alur simpan → antrean → sinkronisasi, lalu Timeline dan Detail.
4. **Analitik.** Aksi `stats`, heatmap CSS Grid, grafik Chart.js (tren mood dan tag teratas), streak.
5. **Pengaturan.** Onboarding URL dan token, ekspor, daftar antrean gagal.

### Tahap 3: Deployment

1. `clasp push`, deploy sebagai Web App (Execute as: Me, Who has access: Anyone), catat deployment ID dan URL `/exec`.
2. Isi `API_URL` di `config.js`; token tidak dimasukkan ke repositori.
3. Deploy frontend ke GitHub Pages (pastikan `base` Vite sesuai nama repositori).
4. Pasang ke layar utama HP; tempel token pada onboarding.

### Tahap 4: Evaluasi

| Uji | Cara | Kriteria lulus |
| :--- | :--- | :--- |
| Offline end-to-end | Mode pesawat, tulis entri dengan foto, simpan. | UI tidak error; muncul "Disimpan di perangkat". |
| Sinkronisasi pulih | Matikan mode pesawat. | Entri muncul di Sheets dan Drive tanpa tindakan manual; antrean kosong. |
| Idempotensi | Putus koneksi tepat saat kirim, lalu kirim ulang. | Tidak ada baris ganda. |
| Token | Ubah token di klien menjadi salah. | Muncul status auth error; data tidak bocor. |
| Fallback iOS | Uji di Safari iOS yang terpasang. | Sinkronisasi berjalan lewat `online` dan saat aplikasi dibuka. |
| Kompatibilitas Tailwind 4 | Buka di perangkat dan browser paling lama yang Anda pakai (syarat: Safari 16.4+, Chrome 111+). | Warna, layout, dan font tampil benar. |
| Kinerja `doPost` | Cek waktu eksekusi di dashboard GAS. | Di bawah 5 sampai 7 detik; bila lebih, kompres HD lebih kuat. |
| Kinerja dasbor | Isi 50+ baris (idealnya 500+) data tiruan. | Analitik selesai dirender di bawah 2 detik. |
| Kunci lokal | Hapus dari recent apps, buka lagi. | Layar Kunci muncul sebelum data apa pun. |
| Offline baca | Mode pesawat, buka Timeline dan Analitik. | Data cache tampil; tidak ada layar kosong. |
| Audit | Lighthouse (PWA, Performance, Accessibility). | PWA terpasang; kontras dan label lulus. |

## 9. Risiko dan Batasan

Google Sheets bukan database yang tumbuh baik tanpa batas; dengan Base64 thumbnail, ukuran sheet membesar cepat, sehingga paginasi dan pemisahan endpoint `stats` bersifat wajib, bukan opsional. Penyimpanan IndexedDB di browser dapat dibersihkan sistem pada kondisi tertentu, jadi data yang belum tersinkron harus dianggap rentan dan ekspor berkala dianjurkan. Kuota harian GAS dan Drive cukup untuk penggunaan pribadi, tetapi eksekusi yang berulang kali melebihi 6 menit atau pengiriman foto yang terlalu besar akan gagal. Tailwind CSS 4 hanya mendukung browser modern (Safari 16.4+, Chrome 111+, Firefox 128+), sehingga perangkat lama yang tidak memenuhinya akan menampilkan antarmuka yang rusak. Terakhir, tanpa enkripsi fase 2, siapa pun dengan akses ke akun Google Anda dapat membaca jurnal di Sheets.

## 10. Fitur Tambahan yang Disarankan

**Prioritas tinggi (v1.1):** pencarian teks dan filter tag, edit dan hapus entri, ekspor/backup JSON dan Markdown, serta statistik streak.

**Prioritas menengah:** pengingat menulis harian, prompt harian (pertanyaan pemantik di layar kosong), fitur "Pada hari ini" (kilas balik entri dari bulan atau tahun lalu), beberapa foto per entri, dan tema gelap sebagai pilihan. Catatan untuk pengingat: Web Push memerlukan server, sehingga pada arsitektur ini opsi paling realistis adalah *time-driven trigger* GAS yang mengirim email pengingat lewat `MailApp`; notifikasi lokal PWA tidak andal di semua platform.

**Analitik lanjutan:** korelasi mood dengan tag (tag mana yang berhubungan dengan mood tinggi atau rendah), tren mood per hari dalam seminggu, dan analisis sentimen teks untuk dibandingkan dengan mood yang dipilih. Bila analisis berbasis model bahasa dipertimbangkan, ingat bahwa itu berarti mengirim isi jurnal ke pihak ketiga; jalankan secara lokal atau jadikan opsional dengan persetujuan eksplisit.

**Keamanan (fase 2):** enkripsi AES-GCM pada teks dan foto dengan passphrase terpisah, seperti dijelaskan di bagian 7.4.

## 11. Definisi Selesai (v1.0)

Versi 1.0 dianggap selesai bila seluruh uji di tabel Tahap 4 lulus, aplikasi dapat dipasang dan dipakai penuh di HP (Android dan iOS) dalam kondisi offline, tidak ada baris ganda pada pengujian pengiriman ulang, endpoint menolak request tanpa token yang benar, dan Layar Kunci selalu mendahului tampilan data.
