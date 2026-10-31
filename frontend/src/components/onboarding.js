/**
 * onboarding.js — First-run Welcome & Cryptographic Secret Key Setup Wizard
 */
import { generateSecretKey, setStoredUserKey, validateSecretKey } from '../data/key.js';
import { showToast } from './toast.js';
import { flushQueue } from '../data/sync.js';
import { restoreUserEntries } from '../data/restore.js';

export function renderOnboardingModal(onComplete) {
  let modalContainer = document.getElementById('onboarding-modal');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'onboarding-modal';
    modalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs';
    document.body.appendChild(modalContainer);
  }

  modalContainer.innerHTML = `
    <div class="w-full max-w-md rounded-2xl border bg-paper p-6 shadow-2xl transition-all">
      <div id="onboarding-step-welcome" class="flex flex-col gap-4">
        <div class="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <div>
          <h2 class="font-serif text-xl font-bold text-ink">Selamat Datang di Daily Journal</h2>
          <p class="mt-1 text-xs leading-relaxed text-ink-muted">
            Jurnal harian personal yang aman, offline-first, dan terisolasi privat dengan Kunci Kriptografi unik Anda.
          </p>
        </div>

        <div class="rounded-xl border bg-cream/50 dark:bg-sand/20 p-3.5 text-xs text-ink-muted">
          <p class="font-medium text-ink flex items-center gap-1.5">
            <span class="inline-block size-2 rounded-full bg-accent"></span>
            Kunci Kriptografi Mandiri
          </p>
          <p class="mt-1">
            Kunci rahasia ini tersimpan otomatis di perangkat Anda. Cukup dibuat sekali saja dan tidak perlu diulang setiap kali membuka aplikasi.
          </p>
        </div>

        <div class="flex flex-col gap-2 pt-2">
          <button type="button" id="btn-onboarding-new"
            class="flex items-center justify-center gap-2 rounded-field bg-accent py-3 text-xs font-semibold text-cream hover:opacity-90 cursor-pointer shadow-xs">
            ✨ Mulai Baru (Buat Kunci Diary)
          </button>
          <button type="button" id="btn-onboarding-existing"
            class="rounded-field border bg-paper py-2.5 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            🔑 Saya Sudah Punya Kunci (Pulihkan / Ganti HP)
          </button>
        </div>
      </div>

      <!-- Step: Tampilkan Kunci Baru -->
      <div id="onboarding-step-show-key" class="hidden flex flex-col gap-4">
        <div>
          <h3 class="font-serif text-lg font-bold text-ink">Simpan Kunci Rahasia Anda</h3>
          <p class="mt-1 text-xs text-ink-muted">
            Kunci ini adalah identitas catatan Anda. Simpan atau salin kunci ini di tempat aman jika sewaktu-waktu Anda mengganti HP.
          </p>
        </div>

        <div class="rounded-xl border border-accent/40 bg-accent-soft/30 p-4 flex flex-col items-center gap-2">
          <span class="text-[11px] font-semibold tracking-wider text-accent uppercase">Secret Key Anda</span>
          <code id="display-generated-key" class="font-mono text-base font-bold text-ink tracking-widest select-all">
            DJ-XXXX-XXXX-XXXX-XXXX
          </code>
          <button type="button" id="btn-copy-generated-key"
            class="mt-1 inline-flex items-center gap-1.5 rounded-field border bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            📋 Salin Kunci
          </button>
        </div>

        <div class="flex items-start gap-2 text-[11px] text-ink-muted">
          <input type="checkbox" id="check-key-saved" class="mt-0.5 rounded cursor-pointer" />
          <label for="check-key-saved" class="cursor-pointer">
            Saya sudah mencatat / menyalin kunci rahasia ini dengan aman.
          </label>
        </div>

        <button type="button" id="btn-confirm-new-key" disabled
          class="rounded-field bg-accent py-3 text-xs font-semibold text-cream opacity-50 cursor-not-allowed transition-all">
          Lanjut ke Jurnal 🚀
        </button>
      </div>

      <!-- Step: Masukkan Kunci Lama -->
      <div id="onboarding-step-enter-key" class="hidden flex flex-col gap-4">
        <div>
          <h3 class="font-serif text-lg font-bold text-ink">Masukkan Kunci Diary Lama</h3>
          <p class="mt-1 text-xs text-ink-muted">
            Tempelkan Secret Key Anda untuk memulihkan seluruh riwayat jurnal Anda ke perangkat ini.
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-ink">Secret Key Anda</label>
          <input type="text" id="input-existing-key" placeholder="DJ-XXXX-XXXX-XXXX-XXXX"
            class="rounded-field border bg-cream/40 p-3 font-mono text-xs uppercase tracking-wider text-ink focus:border-accent focus:outline-hidden" />
          <span id="existing-key-error" class="hidden text-[11px] text-danger">Format kunci tidak valid. Pastikan formatnya benar.</span>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="button" id="btn-back-to-welcome"
            class="rounded-field border bg-paper px-4 py-2.5 text-xs font-medium text-ink hover:bg-sand cursor-pointer">
            Kembali
          </button>
          <button type="button" id="btn-confirm-existing-key"
            class="flex-1 rounded-field bg-accent py-2.5 text-xs font-semibold text-cream hover:opacity-90 cursor-pointer">
            Pulihkan Catatan
          </button>
        </div>
      </div>
    </div>
  `;

  // Step References
  const stepWelcome = modalContainer.querySelector('#onboarding-step-welcome');
  const stepShowKey = modalContainer.querySelector('#onboarding-step-show-key');
  const stepEnterKey = modalContainer.querySelector('#onboarding-step-enter-key');

  const btnNew = modalContainer.querySelector('#btn-onboarding-new');
  const btnExisting = modalContainer.querySelector('#btn-onboarding-existing');
  const displayKey = modalContainer.querySelector('#display-generated-key');
  const btnCopy = modalContainer.querySelector('#btn-copy-generated-key');
  const checkSaved = modalContainer.querySelector('#check-key-saved');
  const btnConfirmNew = modalContainer.querySelector('#btn-confirm-new-key');

  const inputKey = modalContainer.querySelector('#input-existing-key');
  const keyError = modalContainer.querySelector('#existing-key-error');
  const btnBack = modalContainer.querySelector('#btn-back-to-welcome');
  const btnConfirmExisting = modalContainer.querySelector('#btn-confirm-existing-key');

  let activeGeneratedKey = '';

  // 1. New Key Flow
  btnNew.addEventListener('click', () => {
    activeGeneratedKey = generateSecretKey();
    displayKey.textContent = activeGeneratedKey;
    stepWelcome.classList.add('hidden');
    stepShowKey.classList.remove('hidden');
  });

  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(activeGeneratedKey);
      showToast('Kunci berhasil disalin!', 'success');
      btnCopy.textContent = '✓ Tersalin';
      setTimeout(() => { btnCopy.textContent = '📋 Salin Kunci'; }, 2000);
    } catch {
      showToast('Silakan salin kode secara manual', 'info');
    }
  });

  checkSaved.addEventListener('change', () => {
    if (checkSaved.checked) {
      btnConfirmNew.disabled = false;
      btnConfirmNew.classList.remove('opacity-50', 'cursor-not-allowed');
      btnConfirmNew.classList.add('hover:opacity-90', 'cursor-pointer');
    } else {
      btnConfirmNew.disabled = true;
      btnConfirmNew.classList.add('opacity-50', 'cursor-not-allowed');
      btnConfirmNew.classList.remove('hover:opacity-90', 'cursor-pointer');
    }
  });

  btnConfirmNew.addEventListener('click', async () => {
    await setStoredUserKey(activeGeneratedKey);
    modalContainer.remove();
    showToast('Kunci diary berhasil dipasang!', 'success');
    if (onComplete) onComplete(activeGeneratedKey);
    flushQueue();
  });

  // 2. Existing Key Flow
  btnExisting.addEventListener('click', () => {
    stepWelcome.classList.add('hidden');
    stepEnterKey.classList.remove('hidden');
  });

  btnBack.addEventListener('click', () => {
    stepEnterKey.classList.add('hidden');
    stepWelcome.classList.remove('hidden');
  });

  btnConfirmExisting.addEventListener('click', async () => {
    const raw = inputKey.value.trim();
    if (!validateSecretKey(raw)) {
      keyError.classList.remove('hidden');
      return;
    }
    keyError.classList.add('hidden');
    btnConfirmExisting.disabled = true;
    btnConfirmExisting.textContent = 'Memulihkan Data...';

    const cleanKey = await setStoredUserKey(raw);
    showToast('Kunci diary terpasang. Mengunduh riwayat catatan...', 'info');

    // Tarik seluruh riwayat catatan dari Google Sheets untuk kunci ini
    const restoreResult = await restoreUserEntries();
    modalContainer.remove();

    if (restoreResult.ok) {
      if (restoreResult.count > 0) {
        showToast(`Berhasil memulihkan ${restoreResult.count} catatan!`, 'success');
      } else {
        showToast('Kunci terpasang. Belum ada catatan tersimpan di cloud.', 'info');
      }
    } else {
      showToast('Kunci disimpan. Akan disinkronkan saat terhubung.', 'info');
    }

    if (onComplete) onComplete(cleanKey);
    flushQueue();
  });
}

