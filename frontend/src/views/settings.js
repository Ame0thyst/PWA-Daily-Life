/**
 * settings.js — Settings view: Security, Sync, Data export/backup, Theme, and App info
 */
import { getSetting, setSetting, clearAllData, getAllEntries } from '../data/db.js';
import { isPinSet, setPin, removePin, getPinLength } from '../lock/pin.js';
import { isWebAuthnSupported, isWebAuthnEnabled, registerWebAuthn, disableWebAuthn } from '../lock/webauthn.js';
import { flushQueue } from '../data/sync.js';
import { listAll as listQueue, remove as removeQueueItem } from '../data/queue.js';
import { showToast } from '../components/toast.js';

export async function renderSettingsView(container) {
  const apiUrl = (await getSetting('apiUrl')) || '';
  const apiToken = (await getSetting('apiToken')) || '';
  const pinExists = await isPinSet();
  const pinLength = await getPinLength();
  const bioSupported = await isWebAuthnSupported();
  const bioEnabled = await isWebAuthnEnabled();
  const autoLockSetting = (await getSetting('autoLockTimeout')) ?? 60000;
  const currentTheme = (await getSetting('theme')) || 'cream';

  const queueItems = await listQueue();
  const failedItems = queueItems.filter((q) => q.status === 'failed');

  container.innerHTML = `
    <div class="view-enter flex flex-col gap-6 pb-12">
      <div class="border-b pb-3">
        <h2 class="font-serif text-xl font-bold text-ink">Pengaturan</h2>
      </div>

      <!-- 1. Sinkronisasi & API GAS -->
      <section class="rounded-card border bg-paper p-4 shadow-card flex flex-col gap-3">
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

        <div class="flex items-center gap-2 pt-2">
          <button type="button" id="btn-save-api"
            class="rounded-field bg-accent px-4 py-2 text-xs font-semibold text-cream hover:opacity-90 cursor-pointer">
            Simpan Konfigurasi
          </button>
          <button type="button" id="btn-sync-now"
            class="rounded-field border bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            Sinkronkan Sekarang
          </button>
        </div>

        ${failedItems.length > 0 ? `
          <div class="mt-3 rounded-field bg-danger/10 p-3 text-xs text-danger">
            <p class="font-medium">Ada ${failedItems.length} antrean yang gagal terkirim:</p>
            <ul class="mt-2 space-y-1">
              ${failedItems.map((item) => `
                <li class="flex items-center justify-between">
                  <span>${item.op} (${item.id.substring(0, 8)}...) - ${escapeHtml(item.error || 'Error')}</span>
                  <button type="button" class="btn-delete-queue-item underline text-danger ml-2" data-id="${item.id}">Buang</button>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </section>

      <!-- 2. Keamanan & Kunci -->
      <section class="rounded-card border bg-paper p-4 shadow-card flex flex-col gap-3">
        <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
          <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Keamanan & Kunci Lokal
        </h3>

        <div class="flex items-center justify-between py-1 border-b">
          <div>
            <p class="text-xs font-medium text-ink">Kunci PIN</p>
            <p class="text-[11px] text-ink-muted">${pinExists ? `Aktif (${pinLength} digit)` : 'Belum diatur'}</p>
          </div>
          <button type="button" id="btn-manage-pin"
            class="rounded-field border bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            ${pinExists ? 'Ubah PIN' : 'Pasang PIN'}
          </button>
        </div>

        ${pinExists ? `
          <div class="flex items-center justify-between py-1 border-b">
            <div>
              <p class="text-xs font-medium text-danger">Hapus Kunci PIN</p>
              <p class="text-[11px] text-ink-muted">Aplikasi tidak lagi meminta PIN saat dibuka.</p>
            </div>
            <button type="button" id="btn-remove-pin"
              class="rounded-field border border-danger/30 text-danger px-3 py-1.5 text-xs font-medium hover:bg-danger/10 cursor-pointer">
              Nonaktifkan
            </button>
          </div>
        ` : ''}

        ${bioSupported ? `
          <div class="flex items-center justify-between py-1 border-b">
            <div>
              <p class="text-xs font-medium text-ink">Buka Cepat Biometrik (WebAuthn)</p>
              <p class="text-[11px] text-ink-muted">Gunakan sidik jari atau Face ID perangkat.</p>
            </div>
            <button type="button" id="btn-toggle-biometric"
              class="rounded-field border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${bioEnabled ? 'bg-accent text-cream' : 'bg-paper text-ink hover:bg-sand'}">
              ${bioEnabled ? 'Aktif' : 'Aktifkan'}
            </button>
          </div>
        ` : ''}

        <div class="flex flex-col gap-2 pt-1">
          <label class="text-xs font-medium text-ink-muted">Waktu Kunci Otomatis (Latar Belakang)</label>
          <select id="setting-autolock-timeout"
            class="rounded-field border bg-cream/40 p-2 text-xs text-ink focus:border-accent">
            <option value="15000" ${autoLockSetting === 15000 ? 'selected' : ''}>15 detik</option>
            <option value="60000" ${autoLockSetting === 60000 ? 'selected' : ''}>1 menit (disarankan)</option>
            <option value="120000" ${autoLockSetting === 120000 ? 'selected' : ''}>2 menit</option>
            <option value="300000" ${autoLockSetting === 300000 ? 'selected' : ''}>5 menit</option>
          </select>
        </div>
      </section>

      <!-- 3. Ekspor & Backup Data -->
      <section class="rounded-card border bg-paper p-4 shadow-card flex flex-col gap-3">
        <h3 class="font-serif text-sm font-semibold text-ink flex items-center gap-2">
          <svg class="size-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Backup & Ekspor
        </h3>
        <p class="text-xs text-ink-muted">Unduh seluruh catatan Anda ke format terbuka tanpa lock-in vendor.</p>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" id="btn-export-json"
            class="rounded-field border bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            Ekspor JSON
          </button>
          <button type="button" id="btn-export-markdown"
            class="rounded-field border bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            Ekspor Markdown (.zip / .txt)
          </button>
        </div>
      </section>

      <!-- 4. Tampilan -->
      <section class="rounded-card border bg-paper p-4 shadow-card flex flex-col gap-3">
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

      <!-- 5. Reset & Cache -->
      <section class="rounded-card border border-danger/20 bg-paper p-4 shadow-card flex flex-col gap-2">
        <h3 class="font-serif text-sm font-semibold text-danger">Reset Penyimpanan Lokal</h3>
        <p class="text-xs text-ink-muted">Bersihkan cache lokal di IndexedDB browser ini. Data yang sudah tersinkron ke Google Sheets tetap aman.</p>
        <div>
          <button type="button" id="btn-clear-cache"
            class="rounded-field border border-danger/40 bg-paper px-4 py-2 text-xs font-medium text-danger hover:bg-danger/10 cursor-pointer">
            Hapus Cache Lokal
          </button>
        </div>
      </section>

      <!-- 6. Tentang -->
      <footer class="text-center text-xs text-ink-muted pt-2">
        <p class="font-semibold text-ink">Daily Journal PWA v2.1</p>
        <p class="mt-0.5">Offline-first &bull; Tailwind CSS 4 &bull; GAS Serverless</p>
      </footer>
    </div>
  `;

  // Attach Handlers
  setupApiHandlers(container);
  setupSecurityHandlers(container);
  setupExportHandlers(container);
  setupThemeHandlers(container);
}

function setupApiHandlers(container) {
  const saveBtn = container.querySelector('#btn-save-api');
  const syncBtn = container.querySelector('#btn-sync-now');
  const urlInput = container.querySelector('#setting-api-url');
  const tokenInput = container.querySelector('#setting-api-token');

  saveBtn.addEventListener('click', async () => {
    await setSetting('apiUrl', urlInput.value.trim());
    await setSetting('apiToken', tokenInput.value.trim());
    showToast('Pengaturan API tersimpan', 'success');
  });

  syncBtn.addEventListener('click', () => {
    showToast('Memulai sinkronisasi...', 'info');
    flushQueue();
  });

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
  const removePinBtn = container.querySelector('#btn-remove-pin');
  const toggleBioBtn = container.querySelector('#btn-toggle-biometric');
  const autoLockSelect = container.querySelector('#setting-autolock-timeout');

  if (managePinBtn) {
    managePinBtn.addEventListener('click', async () => {
      const pin = window.prompt('Masukkan PIN baru (4 atau 6 angka):');
      if (!pin) return;
      if (!/^\d{4}$|^\d{6}$/.test(pin)) {
        window.alert('PIN harus berupa 4 atau 6 digit angka.');
        return;
      }
      const confirmPin = window.prompt('Konfirmasi PIN baru:');
      if (pin !== confirmPin) {
        window.alert('PIN konfirmasi tidak cocok.');
        return;
      }
      await setPin(pin);
      showToast('PIN berhasil dipasang', 'success');
      renderSettingsView(container);
    });
  }

  if (removePinBtn) {
    removePinBtn.addEventListener('click', async () => {
      if (window.confirm('Yakin ingin menonaktifkan PIN?')) {
        await removePin();
        showToast('PIN dinonaktifkan', 'info');
        renderSettingsView(container);
      }
    });
  }

  if (toggleBioBtn) {
    toggleBioBtn.addEventListener('click', async () => {
      const enabled = await isWebAuthnEnabled();
      if (enabled) {
        await disableWebAuthn();
        showToast('Biometrik dinonaktifkan', 'info');
        renderSettingsView(container);
      } else {
        try {
          await registerWebAuthn();
          showToast('Biometrik berhasil diaktifkan', 'success');
          renderSettingsView(container);
        } catch (err) {
          window.alert(err.message || 'Gagal mengaktifkan biometrik');
        }
      }
    });
  }

  if (autoLockSelect) {
    autoLockSelect.addEventListener('change', async (e) => {
      await setSetting('autoLockTimeout', parseInt(e.target.value, 10));
      showToast('Waktu auto-lock diperbarui', 'info');
    });
  }
}

function setupExportHandlers(container) {
  const jsonBtn = container.querySelector('#btn-export-json');
  const mdBtn = container.querySelector('#btn-export-markdown');
  const clearBtn = container.querySelector('#btn-clear-cache');

  jsonBtn.addEventListener('click', async () => {
    const entries = await getAllEntries();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `daily-journal-backup-${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Ekspor JSON berhasil', 'success');
  });

  mdBtn.addEventListener('click', async () => {
    const entries = await getAllEntries();
    let mdContent = '# Daily Journal Backup\n\n';
    entries.forEach((e) => {
      mdContent += `## ${e.timestamp}\n`;
      mdContent += `**Mood**: ${e.mood}/5 | **Tags**: ${Array.isArray(e.tags) ? e.tags.join(', ') : e.tags}\n\n`;
      mdContent += `${e.text}\n\n---\n\n`;
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
