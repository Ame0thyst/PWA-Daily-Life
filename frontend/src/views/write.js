/**
 * write.js — Cosmic Glassmorphism Journal Editor matching reference design
 * Features:
 * - Dynamic Personalized Greeting: "Selamat Siang, [Username] 🌟"
 * - Neon Glowing Date Capsule: "📅 Minggu, 1 November"
 * - 5 Frosted Glass 3D Mood Selectors with amber glow
 * - Multi-Image Media Attachment Grid with "+ Tambah Media" slots
 * - "🔒 Privat" isolation badge & word counter
 * - Tactile Sunset Orange "✓ Simpan Cerita" button
 */
import { renderMoodPicker } from '../components/moodPicker.js';
import { processImage } from '../media/image.js';
import { draftStore, saveEntry, getUserProfile } from '../data/db.js';
import { enqueue } from '../data/queue.js';
import { flushQueue } from '../data/sync.js';
import { showToast } from '../components/toast.js';

let draftSaveTimer = null;
let currentMood = null;
let attachedImages = []; // Array of { imageHD, thumb, previewUrl }

export async function renderWriteView(container) {
  const profile = await getUserProfile();
  const username = profile.username || 'Alif';

  // Format date in Indonesian: e.g. "Minggu, 1 November"
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dateFormatted = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;

  // Dynamic greeting based on current time
  const hour = now.getHours();
  let greetingTime = 'Selamat Pagi';
  let greetingSub = 'Awali hari dengan mencatat pikiran & rencanamu.';

  if (hour >= 11 && hour < 15) {
    greetingTime = 'Selamat Siang';
    greetingSub = 'Bagaimana perjalanan harimu sejauh ini?';
  } else if (hour >= 15 && hour < 18) {
    greetingTime = 'Selamat Sore';
    greetingSub = 'Rehat sejenak dan tuangkan momen berhargamu.';
  } else if (hour >= 18 || hour < 4) {
    greetingTime = 'Selamat Malam';
    greetingSub = 'Refleksikan harimu sebelum beristirahat tenang.';
  }

  container.innerHTML = `
    <div class="flex flex-col gap-6 pb-12">
      <!-- 1. Top Greeting & Date Row -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div class="flex flex-col">
          <h2 class="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>${greetingTime}, <span class="text-white">${escapeHtml(username)}</span></span>
            <span class="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">🌟</span>
          </h2>
          <p class="text-xs sm:text-sm text-slate-300 mt-1">${greetingSub}</p>
        </div>

        <div class="date-capsule flex items-center gap-2 rounded-2xl px-4 py-2.5 backdrop-blur-xl">
          <span class="text-xs sm:text-sm font-semibold text-sky-200">📅 ${dateFormatted}</span>
        </div>
      </div>

      <!-- 2. Mood Picker Section -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between text-xs font-semibold tracking-wider uppercase">
          <span class="text-slate-300">Bagaimana Perasaanmu?</span>
          <span class="text-amber-500 font-bold tracking-normal drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">WAJIB DIPILIH</span>
        </div>
        <div id="write-mood-picker"></div>
      </div>

      <!-- 3. Glassmorphic Editor Card -->
      <div class="glass-panel flex flex-col rounded-3xl p-5 border border-white/10 shadow-2xl relative">
        <textarea id="entry-textarea"
          placeholder="Tuliskan ceritamu hari ini... Gunakan #topik untuk mengelompokkan atau @nama untuk menandai seseorang."
          rows="7"
          class="w-full resize-none bg-transparent font-serif text-[17px] leading-[1.8] text-white placeholder-slate-400/60 focus:outline-hidden"></textarea>

        <!-- Attached Media Strip inside Editor -->
        <div class="mt-4 pt-3 border-t border-white/10">
          <div id="media-strip" class="flex flex-wrap items-center gap-3">
            <!-- Dynamic attached images rendered here -->
            <div id="attached-images-container" class="flex flex-wrap gap-3"></div>

            <!-- "+ Tambah Media" Placeholder Button -->
            <button type="button" id="btn-add-media-slot"
              class="flex flex-col items-center justify-center size-20 rounded-2xl border border-white/15 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:border-white/30 transition-all cursor-pointer">
              <span class="text-xl leading-none text-white/80">+</span>
              <span class="text-[10px] font-medium mt-1">Tambah<br>Media</span>
            </button>
          </div>
        </div>

        <!-- Meta Bar: Word count & Privacy Badge -->
        <div class="mt-4 flex items-center justify-between text-xs text-slate-400">
          <div class="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-slate-300 border border-white/10">
            <span>🔒</span> <span>Privat (Terenkripsi)</span>
          </div>
          <div class="flex items-center gap-3">
            <span id="draft-status" class="italic text-[11px] text-slate-400"></span>
            <span id="word-count" class="font-mono text-[11px] bg-white/[0.06] px-2.5 py-1 rounded-md text-slate-200">0 kata</span>
          </div>
        </div>
      </div>

      <!-- 4. Bottom Action Buttons -->
      <div class="flex items-center justify-between pt-1">
        <div>
          <input type="file" id="photo-file-input" accept="image/*" multiple class="hidden" />
          <button type="button" id="btn-attach-photo"
            class="glass-card inline-flex min-h-12 items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium text-white transition-all active:scale-95 cursor-pointer">
            <span class="text-base">📷</span>
            <span id="btn-photo-label">+ Tambah Foto / Media</span>
          </button>
        </div>

        <button type="button" id="btn-save-entry" disabled
          class="btn-sunset inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-7 py-3 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer">
          <svg class="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span>Simpan Cerita</span>
        </button>
      </div>
    </div>
  `;

  // Attach DOM elements
  const textarea = document.getElementById('entry-textarea');
  const wordCountDisplay = document.getElementById('word-count');
  const saveBtn = document.getElementById('btn-save-entry');
  const photoInput = document.getElementById('photo-file-input');
  const photoBtn = document.getElementById('btn-attach-photo');
  const addMediaSlotBtn = document.getElementById('btn-add-media-slot');
  const imagesContainer = document.getElementById('attached-images-container');
  const draftStatus = document.getElementById('draft-status');

  // Init mood picker
  const moodPicker = renderMoodPicker('write-mood-picker', null, (level) => {
    currentMood = level;
    validateForm();
    scheduleAutoSave();
  });

  function renderAttachedImages() {
    imagesContainer.innerHTML = attachedImages.map((img, idx) => `
      <div class="relative size-20 rounded-2xl overflow-hidden border border-white/20 shadow-md group">
        <img src="${img.previewUrl}" alt="Media ${idx + 1}" class="size-full object-cover" />
        <button type="button" data-idx="${idx}"
          class="btn-remove-media absolute top-1 right-1 size-5 rounded-full bg-black/75 text-white flex items-center justify-center text-xs hover:bg-rose-600 transition cursor-pointer">
          &times;
        </button>
      </div>
    `).join('');

    imagesContainer.querySelectorAll('.btn-remove-media').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        attachedImages.splice(idx, 1);
        renderAttachedImages();
        scheduleAutoSave();
      });
    });
  }

  function validateForm() {
    const text = textarea.value.trim();
    const isValid = text.length > 0 && currentMood !== null;
    saveBtn.disabled = !isValid;
  }

  function updateCounts() {
    const text = textarea.value.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    wordCountDisplay.textContent = `${words} kata`;
    validateForm();
  }

  function scheduleAutoSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(async () => {
      const text = textarea.value;
      if (text.trim() || currentMood || attachedImages.length > 0) {
        await draftStore.setItem('currentDraft', {
          text,
          mood: currentMood,
          imageHD: attachedImages[0]?.imageHD || null,
          thumb: attachedImages[0]?.thumb || null,
          attachedImages: attachedImages.map(img => ({ thumb: img.thumb, previewUrl: img.previewUrl })),
          updatedAt: new Date().toISOString(),
        });
        if (draftStatus) draftStatus.textContent = 'Draf tersimpan';
      }
    }, 2000);
  }

  // Restore existing draft
  const savedDraft = await draftStore.getItem('currentDraft');
  if (savedDraft) {
    if (savedDraft.text) textarea.value = savedDraft.text;
    if (savedDraft.mood) {
      currentMood = savedDraft.mood;
      moodPicker.setValue(savedDraft.mood);
    }
    if (Array.isArray(savedDraft.attachedImages) && savedDraft.attachedImages.length > 0) {
      attachedImages = savedDraft.attachedImages;
      renderAttachedImages();
    } else if (savedDraft.thumb && savedDraft.thumb.length > 30) {
      attachedImages = [{
        imageHD: savedDraft.imageHD,
        thumb: savedDraft.thumb,
        previewUrl: `data:image/jpeg;base64,${savedDraft.thumb}`,
      }];
      renderAttachedImages();
    }
    updateCounts();
    if (draftStatus) draftStatus.textContent = 'Draf dipulihkan';
  }

  textarea.addEventListener('input', () => {
    updateCounts();
    scheduleAutoSave();
    if (draftStatus) draftStatus.textContent = '';
  });

  const triggerUpload = () => photoInput.click();
  photoBtn.addEventListener('click', triggerUpload);
  addMediaSlotBtn.addEventListener('click', triggerUpload);

  photoInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    photoBtn.disabled = true;
    photoBtn.querySelector('span:last-child').textContent = 'Memproses...';

    try {
      for (const file of files) {
        const imgRes = await processImage(file);
        attachedImages.push(imgRes);
      }
      renderAttachedImages();
      scheduleAutoSave();
    } catch (err) {
      console.error('Error processing media:', err);
      showToast('Gagal memproses media', 'danger');
    } finally {
      photoBtn.disabled = false;
      photoBtn.querySelector('span:last-child').textContent = '+ Tambah Foto / Media';
      photoInput.value = '';
    }
  });

  // Save handler
  saveBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text || currentMood === null) return;

    saveBtn.disabled = true;

    // ISO timestamp with timezone offset
    const dateObj = new Date();
    const tzo = -dateObj.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const pad = (num) => String(Math.floor(Math.abs(num))).padStart(2, '0');
    const isoWithOffset =
      dateObj.getFullYear() +
      '-' + pad(dateObj.getMonth() + 1) +
      '-' + pad(dateObj.getDate()) +
      'T' + pad(dateObj.getHours()) +
      ':' + pad(dateObj.getMinutes()) +
      ':' + pad(dateObj.getSeconds()) +
      dif + pad(tzo / 60) +
      ':' + pad(tzo % 60);

    const id = crypto.randomUUID();
    const matches = text.match(/(#[a-zA-Z0-9_\u00C0-\u024F]+|@[a-zA-Z0-9_\u00C0-\u024F]+)/g);
    const tags = matches ? Array.from(new Set(matches)) : [];

    const primaryImage = attachedImages[0] || null;

    const entry = {
      id,
      timestamp: isoWithOffset,
      mood: currentMood,
      tags,
      deleted: false,
      updatedAt: new Date().toISOString(),
      fileId: '',
      text,
      thumb: primaryImage ? primaryImage.thumb : '',
      imageHD: primaryImage ? primaryImage.imageHD : '',
    };

    try {
      const localEntry = { ...entry, imageHD: undefined };
      await saveEntry(localEntry);
      await enqueue('create', { entry });

      await draftStore.removeItem('currentDraft');
      if (draftSaveTimer) clearTimeout(draftSaveTimer);

      textarea.value = '';
      currentMood = null;
      attachedImages = [];
      moodPicker.setValue(null);
      renderAttachedImages();
      updateCounts();
      if (draftStatus) draftStatus.textContent = '';

      if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

      showToast('Cerita tersimpan di jurnal pribadi!', 'success');
      flushQueue();
      textarea.focus();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Gagal menyimpan cerita', 'danger');
      saveBtn.disabled = false;
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
