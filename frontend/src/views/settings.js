/**
 * settings.js — Settings view: Security, Sync, Data export/backup, Theme, and App info
 */
import { getSetting, setSetting, clearAllData, getAllEntries, getUserProfile } from '../data/db.js';
import { isPinSet, setPin, removePin, getPinLength } from '../lock/pin.js';
import { isWebAuthnSupported, isWebAuthnEnabled, registerWebAuthn, disableWebAuthn } from '../lock/webauthn.js';
import { flushQueue } from '../data/sync.js';
import { listAll as listQueue, remove as removeQueueItem } from '../data/queue.js';
import { showToast } from '../components/toast.js';
import { getDeferredInstallPrompt, clearDeferredInstallPrompt, isStandalone } from '../pwa.js';
import { getStoredUserKey, setStoredUserKey, validateSecretKey } from '../data/key.js';
import { restoreUserEntries } from '../data/restore.js';
import { generateInviteLink } from '../components/invite.js';
import { openProfileModal } from '../components/profileModal.js';

export async function renderSettingsView(container) {
  const profile = await getUserProfile();
  const apiUrl = (await getSetting('apiUrl')) || '';
  const apiToken = (await getSetting('apiToken')) || '';
  const userKey = (await getStoredUserKey()) || '';
  const pinExists = await isPinSet();
  const pinLength = await getPinLength();
  const bioSupported = await isWebAuthnSupported();
  const bioEnabled = await isWebAuthnEnabled();
  const autoLockSetting = (await getSetting('autoLockTimeout')) ?? 60000;
  const currentTheme = (await getSetting('theme')) || 'cream';
  const standaloneActive = isStandalone();

  const queueItems = await listQueue();
  const failedItems = queueItems.filter((q) => q.status === 'failed');

  container.innerHTML = `
    <div class="flex flex-col gap-5 pb-24 max-w-xl mx-auto">
      <div class="flex items-center justify-between pt-1">
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Pengaturan</h2>
      </div>

      <!-- Profil Pengguna -->
      <section class="modern-card p-5 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="size-14 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-800 dark:text-white text-lg shadow-xs">
            ${profile.avatar ? `<img src="${profile.avatar}" alt="${profile.username}" class="size-full object-cover" />` : (profile.username || 'V')[0].toUpperCase()}
          </div>
          <div class="flex flex-col">
            <h4 class="text-base font-bold text-gray-900 dark:text-white">${escapeHtml(profile.username || 'Vanessa')}</h4>
            <span class="text-xs text-gray-500">Tersinkron dengan Kunci Diary Anda</span>
          </div>
        </div>
        <button type="button" id="btn-edit-profile-settings"
          class="btn-obsidian px-5 py-2.5 text-xs font-bold cursor-pointer">
          Ubah Profil
        </button>
      </section>

      <!-- 0. Status Instalasi PWA -->
      ${standaloneActive ? `
        <section class="modern-card border border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 shadow-card flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="inline-flex size-6 items-center justify-center rounded-full bg-emerald-600 text-cream text-xs font-bold">✓</span>
            <div>
              <h4 class="text-xs font-semibold text-ink">Aplikasi Terpasang (PWA)</h4>
              <p class="text-[11px] text-ink-muted">Berjalan mandiri di layar utama. Pembaruan kode otomatis diperbarui.</p>
            </div>
          </div>
        </section>
      ` : `
        <section class="modern-card border bg-paper p-4 shadow-card flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
              <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Pasang Aplikasi di HP (PWA)
            </h3>
            <span class="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">Rekomendasi</span>
          </div>
          <p class="text-xs text-ink-muted">Pasang Daily Journal ke layar utama perangkat Anda agar dapat dibuka langsung tanpa address bar browser dan berjalan offline penuh.</p>

          <div id="pwa-install-action" class="flex flex-col gap-2">
            <button type="button" id="btn-install-pwa"
              class="${getDeferredInstallPrompt() ? '' : 'hidden'} flex items-center justify-center gap-2 rounded-field bg-accent px-4 py-2.5 text-xs font-semibold text-cream hover:opacity-90 cursor-pointer">
              📲 Pasang Aplikasi Sekarang
            </button>

            <div class="rounded-field bg-cream/60 dark:bg-sand/30 border p-3 text-xs text-ink-muted flex flex-col gap-1.5">
              <p class="font-medium text-ink">Panduan Pasang di HP:</p>
              <p>• <strong>Android (Chrome)</strong>: Ketuk menu titik tiga (⋮) di kanan atas browser → pilih <strong>"Install app"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</p>
              <p>• <strong>iPhone / iOS (Safari)</strong>: Buka di Safari, ketuk tombol <strong>Share / Bagikan</strong> ⎋ di bawah → gulir lalu pilih <strong>"Tambahkan ke Layar Utama (Add to Home Screen)"</strong> ➕.</p>
            </div>
          </div>
        </section>
      `}

      <!-- 1. Kunci Diary Kriptografi (User Identity) -->
      <section class="modern-card border bg-paper p-4 shadow-card flex flex-col gap-3">
        <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
          <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Kunci Pemulihan Diary (Secret Key)
        </h3>
        <p class="text-xs text-ink-muted">
          Kunci unik ini melindungi catatan Anda agar tidak tertukar dengan orang lain di database. Simpan kunci ini jika Anda ingin berganti HP.
        </p>

        <div class="flex items-center gap-2 rounded-field border bg-cream/40 p-2.5">
          <input type="password" id="display-user-key" value="${escapeHtml(userKey)}" readonly
            class="flex-1 bg-transparent font-mono text-xs font-bold tracking-wider text-ink focus:outline-hidden" />
          <button type="button" id="btn-toggle-view-key"
            class="text-xs text-ink-muted hover:text-ink cursor-pointer px-1">
            👁️ Lihat
          </button>
          <button type="button" id="btn-copy-user-key"
            class="rounded-field border bg-paper px-2.5 py-1 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            📋 Salin
          </button>
        </div>

        <div>
          <button type="button" id="btn-change-user-key"
            class="text-xs text-accent hover:underline cursor-pointer">
            Ganti / Pulihkan Kunci Lain...
          </button>
        </div>
      </section>

      <!-- 2. Sinkronisasi & API GAS -->
      <section class="modern-card border bg-paper p-4 shadow-card flex flex-col gap-3">
        <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
          <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Koneksi Google Apps Script
        </h3>
        <p class="text-xs text-ink-muted">Hubungkan jurnal dengan Google Sheets & Drive pribadi Anda via Web App GAS.</p>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-ink-muted">Web App URL</label>
          <input type="url" id="setting-api-url" value="${escapeHtml(apiUrl)}"
            placeholder="https://script.google.com/macros/s/.../exec"
            class="rounded-field border bg-cream/40 p-2.5 text-xs font-mono text-ink focus:border-accent focus:outline-hidden" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-ink-muted">API Token (Shared Secret)</label>
          <input type="password" id="setting-api-token" value="${escapeHtml(apiToken)}"
            placeholder="Kunci rahasia dari Script Properties"
            class="rounded-field border bg-cream/40 p-2.5 text-xs font-mono text-ink focus:border-accent focus:outline-hidden" />
          <span class="text-[11px] text-ink-muted">Token hanya disimpan lokal di IndexedDB perangkat ini.</span>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-2">
          <button type="button" id="btn-save-api"
            class="rounded-field bg-accent px-4 py-2 text-xs font-semibold text-cream hover:opacity-90 cursor-pointer">
            Simpan Konfigurasi
          </button>
          <button type="button" id="btn-sync-now"
            class="rounded-field border bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            Sinkronkan Sekarang
          </button>
          <button type="button" id="btn-auto-setup-sheet"
            class="rounded-field border border-accent/40 bg-accent-soft/30 px-3 py-2 text-xs font-medium text-accent hover:bg-accent-soft cursor-pointer">
            ⚡ Setup Sheet Otomatis
          </button>
          <button type="button" id="btn-share-invite-link"
            class="rounded-field border bg-paper px-3 py-2 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            🔗 Salin Link Undangan Teman
          </button>
        </div>

        <!-- Status Antrean -->
        <div class="border-t pt-2 mt-1">
          <p class="text-[11px] text-ink-muted">
            Total item dalam antrean lokal: <span class="font-medium text-ink">${queueItems.length}</span>
            ${failedItems.length > 0 ? `<span class="text-danger ml-1 font-semibold">(${failedItems.length} gagal)</span>` : ''}
          </p>
          ${failedItems.length > 0 ? `
            <div class="mt-2 flex flex-col gap-1.5">
              ${failedItems.map((item) => `
                <div class="flex items-center justify-between rounded-field border border-danger/30 bg-danger/10 p-2 text-xs">
                  <span class="truncate font-mono">${item.action} — ${item.entryId}</span>
                  <button type="button" data-id="${item.id}"
                    class="btn-delete-queue-item text-[11px] text-danger hover:underline cursor-pointer">
                    Hapus
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </section>

      <!-- 3. Keamanan & PIN -->
      <section class="modern-card border bg-paper p-4 shadow-card flex flex-col gap-3">
        <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
          <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Keamanan Kunci Harian (PIN & Biometrik)
        </h3>
        <p class="text-xs text-ink-muted">Kunci praktis harian agar orang lain tidak bisa membuka jurnal langsung dari HP Anda.</p>

        <!-- Status PIN -->
        <div class="flex items-center justify-between border-b pb-3">
          <div>
            <p class="text-xs font-medium text-ink">Kunci PIN</p>
            <p class="text-[11px] text-ink-muted">${pinExists ? `PIN aktif (${pinLength} digit)` : 'PIN belum diaktifkan'}</p>
          </div>
          <button type="button" id="btn-manage-pin"
            class="rounded-field border px-3 py-1.5 text-xs font-medium cursor-pointer ${pinExists ? 'border-danger/40 text-danger hover:bg-danger/10' : 'bg-accent text-cream hover:opacity-90'}">
            ${pinExists ? 'Hapus PIN' : 'Pasang PIN'}
          </button>
        </div>

        <!-- Biometrik WebAuthn -->
        <div class="flex items-center justify-between border-b pb-3 ${bioSupported ? '' : 'opacity-50'}">
          <div>
            <p class="text-xs font-medium text-ink">Biometrik (Sidik Jari / Face ID)</p>
            <p class="text-[11px] text-ink-muted">
              ${!bioSupported ? 'Perangkat tidak mendukung WebAuthn' : (bioEnabled ? 'Biometrik aktif' : 'Gunakan sensor perangkat untuk membuka aplikasi')}
            </p>
          </div>
          ${bioSupported ? `
            <button type="button" id="btn-toggle-bio"
              class="rounded-field border px-3 py-1.5 text-xs font-medium cursor-pointer ${bioEnabled ? 'border-danger/40 text-danger hover:bg-danger/10' : 'bg-accent text-cream hover:opacity-90'}">
              ${bioEnabled ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          ` : ''}
        </div>

        <!-- Auto-Lock Timeout -->
        <div class="flex items-center justify-between pt-1">
          <div>
            <p class="text-xs font-medium text-ink">Kunci Otomatis (Latar Belakang)</p>
            <p class="text-[11px] text-ink-muted">Kunci aplikasi jika ditinggalkan beberapa saat.</p>
          </div>
          <select id="select-autolock"
            class="rounded-field border bg-cream/40 p-1.5 text-xs text-ink focus:border-accent focus:outline-hidden">
            <option value="0" ${autoLockSetting === 0 ? 'selected' : ''}>Seketika (Instan)</option>
            <option value="60000" ${autoLockSetting === 60000 ? 'selected' : ''}>1 Menit</option>
            <option value="300000" ${autoLockSetting === 300000 ? 'selected' : ''}>5 Menit</option>
            <option value="900000" ${autoLockSetting === 900000 ? 'selected' : ''}>15 Menit</option>
          </select>
        </div>
      </section>

      <!-- 4. Ekspor & Cadangan Data -->
      <section class="modern-card border bg-paper p-4 shadow-card flex flex-col gap-3">
        <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
          <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Ekspor & Portabilitas Data
        </h3>
        <p class="text-xs text-ink-muted">Simpan salinan data jurnal Anda di komputer/HP secara mandiri bebas vendor lock-in.</p>
        <div class="flex items-center gap-2 pt-1">
          <button type="button" id="btn-export-json"
            class="rounded-field border bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            Ekspor JSON
          </button>
          <button type="button" id="btn-export-md"
            class="rounded-field border bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            Ekspor Markdown
          </button>
        </div>
      </section>

      <!-- 5. Tampilan -->
      <section class="modern-card border bg-paper p-4 shadow-card flex flex-col gap-3">
        <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
          <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          Tema Tampilan
        </h3>
        <div class="flex items-center gap-3">
          <button type="button" data-theme-val="cream"
            class="theme-toggle-btn rounded-field border px-4 py-2 text-xs font-medium cursor-pointer ${currentTheme === 'cream' ? 'bg-accent text-cream' : 'bg-sand text-ink'}">
            Light Cream
          </button>
          <button type="button" data-theme-val="dark"
            class="theme-toggle-btn rounded-field border px-4 py-2 text-xs font-medium cursor-pointer ${currentTheme === 'dark' ? 'bg-accent text-cream' : 'bg-sand text-ink'}">
            Dark Mode
          </button>
        </div>
      </section>

      <!-- 6. Reset & Cache -->
      <section class="modern-card border border-danger/20 bg-paper p-4 shadow-card flex flex-col gap-2">
        <h3 class="font-serif text-sm font-semibold text-danger">Reset Penyimpanan Lokal</h3>
        <p class="text-xs text-ink-muted">Bersihkan cache lokal di IndexedDB browser ini. Data yang sudah tersinkron ke Google Sheets tetap aman.</p>
        <div>
          <button type="button" id="btn-clear-cache"
            class="rounded-field border border-danger/40 bg-paper px-4 py-2 text-xs font-medium text-danger hover:bg-danger/10 cursor-pointer">
            Hapus Cache Lokal
          </button>
        </div>
      </section>

      <!-- 7. Tentang -->
      <footer class="text-center text-xs text-ink-muted pt-2">
        <p class="font-semibold text-ink">Daily Journal PWA v2.3</p>
        <p class="mt-0.5">Offline-first &bull; Multi-User Cryptographic Isolation &bull; Auto-Update PWA</p>
      </footer>
    </div>
  `;

  // Attach Handlers
  container.querySelector('#btn-edit-profile-settings')?.addEventListener('click', openProfileModal);
  setupInstallHandlers(container);
  setupUserKeyHandlers(container);
  setupApiHandlers(container);
  setupSecurityHandlers(container);
  setupExportHandlers(container);
  setupThemeHandlers(container);
}

function setupUserKeyHandlers(container) {
  const keyInput = container.querySelector('#display-user-key');
  const toggleBtn = container.querySelector('#btn-toggle-view-key');
  const copyBtn = container.querySelector('#btn-copy-user-key');
  const changeBtn = container.querySelector('#btn-change-user-key');

  toggleBtn.addEventListener('click', () => {
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      toggleBtn.textContent = '🙈 Tutup';
    } else {
      keyInput.type = 'password';
      toggleBtn.textContent = '👁️ Lihat';
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(keyInput.value);
      showToast('Kunci berhasil disalin!', 'success');
      copyBtn.textContent = '✓ Tersalin';
      setTimeout(() => { copyBtn.textContent = '📋 Salin'; }, 2000);
    } catch {
      showToast('Gagal menyalin', 'error');
    }
  });

  changeBtn.addEventListener('click', async () => {
    const input = window.prompt('Masukkan Kunci Diary lama Anda (format: DJ-XXXX-XXXX-XXXX-XXXX):');
    if (!input) return;
    if (!validateSecretKey(input)) {
      showToast('Format kunci tidak valid', 'error');
      return;
    }
    await setStoredUserKey(input);
    showToast('Kunci diperbarui. Memulihkan riwayat catatan...', 'info');
    renderSettingsView(container);
    const restoreResult = await restoreUserEntries();
    if (restoreResult.ok) {
      showToast(`Berhasil memulihkan ${restoreResult.count} catatan!`, 'success');
    }
    flushQueue();
  });
}

function setupInstallHandlers(container) {
  const installBtn = container.querySelector('#btn-install-pwa');
  if (!installBtn) return;

  installBtn.addEventListener('click', async () => {
    const promptEvent = getDeferredInstallPrompt();
    if (promptEvent) {
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        showToast('Aplikasi berhasil dipasang!', 'success');
        clearDeferredInstallPrompt();
        installBtn.classList.add('hidden');
      }
    }
  });

  const onInstallReady = () => {
    installBtn.classList.remove('hidden');
  };
  window.addEventListener('pwa-install-ready', onInstallReady);
}

function setupApiHandlers(container) {
  const saveBtn = container.querySelector('#btn-save-api');
  const syncBtn = container.querySelector('#btn-sync-now');
  const autoSetupBtn = container.querySelector('#btn-auto-setup-sheet');
  const shareInviteBtn = container.querySelector('#btn-share-invite-link');
  const urlInput = container.querySelector('#setting-api-url');
  const tokenInput = container.querySelector('#setting-api-token');

  if (shareInviteBtn) {
    shareInviteBtn.addEventListener('click', async () => {
      const link = await generateInviteLink();
      if (!link) {
        showToast('Isi dan simpan Web App URL terlebih dahulu', 'error');
        return;
      }
      try {
        await navigator.clipboard.writeText(link);
        showToast('Link undangan berhasil disalin! Bagikan ke teman.', 'success');
      } catch {
        window.prompt('Salin link undangan ini untuk teman:', link);
      }
    });
  }

  saveBtn.addEventListener('click', async () => {
    await setSetting('apiUrl', urlInput.value.trim());
    await setSetting('apiToken', tokenInput.value.trim());
    showToast('Pengaturan API tersimpan', 'success');
  });

  syncBtn.addEventListener('click', () => {
    showToast('Memulai sinkronisasi...', 'info');
    flushQueue();
  });

  if (autoSetupBtn) {
    autoSetupBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      const token = tokenInput.value.trim();
      if (!url || !token) {
        showToast('Isi Web App URL & API Token terlebih dahulu', 'error');
        return;
      }
      showToast('Menjalankan setup sheet otomatis...', 'info');
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ token, op: 'setup' }),
        });
        const data = await res.json();
        if (data && data.ok) {
          showToast('Google Sheets berhasil disetup otomatis! 10 kolom aktif.', 'success');
        } else {
          showToast('Gagal: ' + (data?.error || 'Periksa URL / Token'), 'error');
        }
      } catch (err) {
        showToast('Eror koneksi: ' + err.message, 'error');
      }
    });
  }

  container.querySelectorAll('.btn-delete-queue-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await removeQueueItem(btn.dataset.id);
      showToast('Item antrean dibuang', 'info');
      renderSettingsView(container);
    });
  });
}

function setupSecurityHandlers(container) {
  const managePinBtn = container.querySelector('#btn-manage-pin');
  const toggleBioBtn = container.querySelector('#btn-toggle-bio');
  const autoLockSelect = container.querySelector('#select-autolock');

  managePinBtn.addEventListener('click', async () => {
    const pinExists = await isPinSet();
    if (pinExists) {
      const currentPin = window.prompt('Masukkan PIN saat ini untuk konfirmasi penghapusan:');
      if (!currentPin) return;
      const success = await removePin(currentPin);
      if (success) {
        showToast('PIN berhasil dihapus', 'info');
        renderSettingsView(container);
      } else {
        showToast('PIN salah', 'error');
      }
    } else {
      const newPin = window.prompt('Masukkan 4 atau 6 digit PIN baru:');
      if (!newPin || (newPin.length !== 4 && newPin.length !== 6) || !/^\d+$/.test(newPin)) {
        showToast('PIN harus berupa 4 atau 6 digit angka', 'error');
        return;
      }
      const confirmPin = window.prompt('Ulangi PIN baru untuk konfirmasi:');
      if (newPin !== confirmPin) {
        showToast('Konfirmasi PIN tidak cocok', 'error');
        return;
      }
      await setPin(newPin);
      showToast('PIN berhasil diaktifkan', 'success');
      renderSettingsView(container);
    }
  });

  if (toggleBioBtn) {
    toggleBioBtn.addEventListener('click', async () => {
      const enabled = await isWebAuthnEnabled();
      if (enabled) {
        await disableWebAuthn();
        showToast('Biometrik dinonaktifkan', 'info');
        renderSettingsView(container);
      } else {
        const pinExists = await isPinSet();
        if (!pinExists) {
          showToast('Aktifkan PIN terlebih dahulu sebelum memasang biometrik', 'error');
          return;
        }
        showToast('Menghubungkan biometrik perangkat...', 'info');
        const success = await registerWebAuthn('Daily Journal User');
        if (success) {
          showToast('Biometrik berhasil diaktifkan', 'success');
          renderSettingsView(container);
        } else {
          showToast('Gagal mengaktifkan biometrik', 'error');
        }
      }
    });
  }

  autoLockSelect.addEventListener('change', async () => {
    const timeout = parseInt(autoLockSelect.value, 10);
    await setSetting('autoLockTimeout', timeout);
    showToast('Waktu kunci otomatis diperbarui', 'success');
  });
}

function setupExportHandlers(container) {
  const exportJsonBtn = container.querySelector('#btn-export-json');
  const exportMdBtn = container.querySelector('#btn-export-md');
  const clearBtn = container.querySelector('#btn-clear-cache');

  exportJsonBtn.addEventListener('click', async () => {
    const entries = await getAllEntries();
    const dataStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-journal-${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Ekspor JSON berhasil', 'success');
  });

  exportMdBtn.addEventListener('click', async () => {
    const entries = await getAllEntries();
    let mdContent = `# Cadangan Daily Journal\nDiunduh pada: ${new Date().toLocaleString('id-ID')}\nTotal Entri: ${entries.length}\n\n---\n\n`;

    entries.forEach((e) => {
      mdContent += `## ${new Date(e.timestamp).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n`;
      mdContent += `**Waktu**: ${new Date(e.timestamp).toLocaleTimeString('id-ID')}\n`;
      mdContent += `**Mood**: ${e.mood || '-'}\n`;
      if (e.tags && e.tags.length > 0) {
        mdContent += `**Tag**: ${e.tags.map((t) => (t.startsWith('#') || t.startsWith('@') ? t : `#${t}`)).join(' ')}\n`;
      }
      mdContent += `\n${e.text || ''}\n\n---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-journal-${new Date().toISOString().substring(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Ekspor Markdown berhasil', 'success');
  });

  clearBtn.addEventListener('click', async () => {
    if (window.confirm('Yakin ingin membersihkan semua cache lokal?')) {
      await clearAllData();
      showToast('Cache lokal dibersihkan', 'info');
      setTimeout(() => window.location.reload(), 500);
    }
  });
}

function setupThemeHandlers(container) {
  container.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.themeVal;
      await setSetting('theme', theme);
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      renderSettingsView(container);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
