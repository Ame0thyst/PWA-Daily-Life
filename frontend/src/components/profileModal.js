/**
 * profileModal.js — Frosted glass modal to edit username and profile photo
 */
import { getUserProfile, setUserProfile } from '../data/db.js';
import { apiSetProfile } from '../data/api.js';
import { showToast } from './toast.js';

export async function openProfileModal() {
  const existing = document.getElementById('profile-modal-container');
  if (existing) existing.remove();

  const profile = await getUserProfile();
  let currentAvatarB64 = profile.avatar || '';

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'profile-modal-container';
  modalOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in';

  modalOverlay.innerHTML = `
    <div class="relative w-full max-w-sm rounded-3xl border border-white/15 bg-[#121622]/95 p-6 shadow-2xl backdrop-blur-2xl text-cream flex flex-col gap-5">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 class="font-serif text-lg font-bold text-white flex items-center gap-2">
          <span>👤</span> Profil Pengguna
        </h3>
        <button type="button" id="btn-close-profile" class="text-white/60 hover:text-white text-xl leading-none cursor-pointer">
          &times;
        </button>
      </div>

      <!-- Avatar Picker -->
      <div class="flex flex-col items-center gap-2.5">
        <div class="relative group cursor-pointer" id="avatar-click-zone">
          <div class="size-24 rounded-full overflow-hidden border-2 border-accent/60 bg-sand/20 shadow-lg flex items-center justify-center">
            ${currentAvatarB64 ? `
              <img id="profile-avatar-preview" src="${currentAvatarB64}" alt="Avatar" class="size-full object-cover" />
            ` : `
              <span id="profile-avatar-fallback" class="font-serif text-3xl font-bold text-accent">
                ${(profile.username || 'A')[0].toUpperCase()}
              </span>
            `}
          </div>
          <div class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-semibold text-white transition-opacity">
            📷 Ganti
          </div>
          <input type="file" id="avatar-file-input" accept="image/*" class="hidden" />
        </div>
        <span class="text-[11px] text-white/50">Ketuk untuk mengganti foto</span>
      </div>

      <!-- Username Input -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold uppercase tracking-wider text-white/70">Nama / Panggilan</label>
        <input type="text" id="input-username" value="${escapeHtml(profile.username || 'Alif')}"
          placeholder="Masukkan namamu..."
          maxlength="24"
          class="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:border-accent focus:outline-hidden focus:ring-1 focus:ring-accent" />
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-2 pt-2">
        <button type="button" id="btn-cancel-profile"
          class="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10 cursor-pointer">
          Batal
        </button>
        <button type="button" id="btn-save-profile"
          class="rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/40 cursor-pointer">
          Simpan Profil
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const fileInput = modalOverlay.querySelector('#avatar-file-input');
  const clickZone = modalOverlay.querySelector('#avatar-click-zone');
  const usernameInput = modalOverlay.querySelector('#input-username');
  const saveBtn = modalOverlay.querySelector('#btn-save-profile');
  const cancelBtn = modalOverlay.querySelector('#btn-cancel-profile');
  const closeBtn = modalOverlay.querySelector('#btn-close-profile');

  clickZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const b64 = await resizeToSquareAvatar(file);
      currentAvatarB64 = b64;
      const previewImg = modalOverlay.querySelector('#profile-avatar-preview');
      const fallback = modalOverlay.querySelector('#profile-avatar-fallback');
      if (previewImg) {
        previewImg.src = b64;
      } else if (fallback) {
        fallback.parentElement.innerHTML = `<img id="profile-avatar-preview" src="${b64}" alt="Avatar" class="size-full object-cover" />`;
      }
    } catch (err) {
      showToast('Gagal memproses gambar avatar', 'danger');
    }
  });

  const dismiss = () => modalOverlay.remove();
  cancelBtn.addEventListener('click', dismiss);
  closeBtn.addEventListener('click', dismiss);

  saveBtn.addEventListener('click', async () => {
    const newUsername = usernameInput.value.trim() || 'Alif';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    await setUserProfile({
      username: newUsername,
      avatar: currentAvatarB64,
    });

    // Background sync to GAS
    if (navigator.onLine) {
      apiSetProfile({
        username: newUsername,
        avatarBase64: currentAvatarB64,
      }).catch((err) => console.debug('Profile sync error:', err));
    }

    showToast('Profil berhasil disimpan!', 'success');
    dismiss();
  });
}

function resizeToSquareAvatar(file, size = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Center crop to square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
