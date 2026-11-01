/**
 * write.js — TripGlide-inspired Modern Journal Writing View
 * Features:
 * - Clean iOS layout with personalized greeting "Halo, [Username] 👋"
 * - Pill-style date indicator
 * - Minimalist 5-mood selector
 * - Pure white modern-card editor with media gallery & attachments
 * - Solid obsidian pill action buttons
 */
import { renderMoodPicker } from '../components/moodPicker.js';
import { processImage } from '../media/image.js';
import { draftStore, saveEntry, getUserProfile } from '../data/db.js';
import { enqueue } from '../data/queue.js';
import { flushQueue } from '../data/sync.js';
import { showToast } from '../components/toast.js';

let draftSaveTimer = null;
let currentMood = null;
let attachedImages = [];

export async function renderWriteView(container) {
  const profile = await getUserProfile();
  const username = profile.username || 'Vanessa';

  // Format date: e.g. "Minggu, 1 November"
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const dateFormatted = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;

  container.innerHTML = `
    <div class="flex flex-col gap-5 pb-32 max-w-xl mx-auto">
      <!-- 1. Top Greeting & Date Pill Row -->
      <div class="flex items-center justify-between pt-1">
        <div class="flex flex-col">
          <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>Halo, ${escapeHtml(username)}</span>
            <span class="text-xl">👋</span>
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bagaimana perjalanan harimu sejauh ini?</p>
        </div>

        <div class="flex items-center gap-1.5 rounded-full bg-white dark:bg-[#171A21] px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 border border-black/[0.05] shadow-2xs">
          <span>📅</span> <span>${dateFormatted}</span>
        </div>
      </div>

      <!-- 2. Mood Selector Section -->
      <div class="flex flex-col gap-2.5">
        <label class="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Suasana Hati Hari Ini
        </label>
        <div id="write-mood-picker"></div>
      </div>

      <!-- 3. Modern Pure White Editor Card -->
      <div class="modern-card p-5 sm:p-6 flex flex-col gap-4">
        <textarea id="entry-textarea"
          placeholder="Tuliskan pengalaman atau rencanamu hari ini... Gunakan #topik untuk mengelompokkan."
          rows="6"
          class="w-full resize-none bg-transparent font-sans text-[16px] leading-[1.7] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden"></textarea>

        <!-- Attached Images Strip inside Editor -->
        <div id="media-strip" class="pt-3 border-t border-black/[0.05] dark:border-white/[0.08]">
          <div class="flex flex-wrap items-center gap-2.5">
            <div id="attached-images-container" class="flex flex-wrap gap-2.5"></div>

            <!-- "+ Tambah Media" Button -->
            <button type="button" id="btn-add-media-slot"
              class="flex flex-col items-center justify-center size-20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 hover:bg-gray-100 hover:border-gray-300 transition-all cursor-pointer">
              <span class="text-xl leading-none font-bold text-gray-400">+</span>
              <span class="text-[10px] font-medium mt-1">Foto</span>
            </button>
          </div>
        </div>

        <!-- Meta Bottom: Word count & Privacy Status -->
        <div class="flex items-center justify-between text-xs text-gray-400 pt-1">
          <div class="flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
            <span>🔒</span> <span>Privat</span>
          </div>
          <div class="flex items-center gap-3">
            <span id="draft-status" class="italic text-[11px] text-gray-400"></span>
            <span id="word-count" class="font-mono text-[11px] font-medium text-gray-600 dark:text-gray-300">0 kata</span>
          </div>
        </div>
      </div>

      <!-- 4. Action Buttons -->
      <div class="flex items-center justify-between pt-1 gap-3">
        <div>
          <input type="file" id="photo-file-input" accept="image/*" multiple class="hidden" />
          <button type="button" id="btn-attach-photo"
            class="chip-pill-inactive inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer">
            <span>📷</span>
            <span id="btn-photo-label">+ Foto / Media</span>
          </button>
        </div>

        <button type="button" id="btn-save-entry" disabled
          class="btn-obsidian flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-xs font-bold tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span>Simpan Catatan</span>
        </button>
      </div>
    </div>
  `;

  // Attach elements
  const textarea = document.getElementById('entry-textarea');
  const wordCountDisplay = document.getElementById('word-count');
  const saveBtn = document.getElementById('btn-save-entry');
  const photoInput = document.getElementById('photo-file-input');
  const photoBtn = document.getElementById('btn-attach-photo');
  const addMediaSlotBtn = document.getElementById('btn-add-media-slot');
  const imagesContainer = document.getElementById('attached-images-container');
  const draftStatus = document.getElementById('draft-status');

  const moodPicker = renderMoodPicker('write-mood-picker', null, (level) => {
    currentMood = level;
    validateForm();
    scheduleAutoSave();
  });

  function renderAttachedImages() {
    imagesContainer.innerHTML = attachedImages.map((img, idx) => `
      <div class="relative size-20 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xs group">
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

  // Restore draft
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
      photoBtn.querySelector('span:last-child').textContent = '+ Foto / Media';
      photoInput.value = '';
    }
  });

  // Save handler
  saveBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text || currentMood === null) return;

    saveBtn.disabled = true;

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

      showToast('Catatan berhasil disimpan!', 'success');
      flushQueue();
      textarea.focus();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Gagal menyimpan catatan', 'danger');
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
