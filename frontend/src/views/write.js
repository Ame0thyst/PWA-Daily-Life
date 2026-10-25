/**
 * write.js — Main journal writing view
 * Features:
 * - 5-level mood picker
 * - Live tag detection (#hashtag, @mention)
 * - Auto-save draft every 2s
 * - Photo attachment with client-side dual-image processing (HD + thumb)
 * - Word counter
 * - Offline-first instant save to IndexedDB + queue
 */
import { renderMoodPicker } from '../components/moodPicker.js';
import { processImage } from '../media/image.js';
import { draftStore, saveEntry } from '../data/db.js';
import { enqueue } from '../data/queue.js';
import { flushQueue } from '../data/sync.js';
import { showToast } from '../components/toast.js';

let draftSaveTimer = null;
let currentMood = null;
let currentImageData = null; // { imageHD, thumb, previewUrl }

export async function renderWriteView(container) {
  // Format today date in Indonesian
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const dateFormatted = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;

  container.innerHTML = `
    <div class="view-enter flex flex-col gap-5 pb-6">
      <!-- Date Banner -->
      <div class="flex items-center justify-between border-b pb-2">
        <h2 class="font-serif text-xl font-bold text-ink">${dateFormatted}</h2>
        <span id="draft-status" class="text-xs text-ink-muted"></span>
      </div>

      <!-- Mood Section -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium uppercase tracking-wider text-ink-muted">Bagaimana harimu?</label>
        <div id="write-mood-picker"></div>
      </div>

      <!-- Editor Section -->
      <div class="flex flex-col gap-2">
        <div class="relative rounded-card border bg-paper p-3 shadow-card focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          <textarea id="entry-textarea"
            placeholder="Tulis sesuatu... Gunakan #topik atau @orang"
            rows="8"
            class="w-full resize-none bg-transparent font-serif text-[17px] leading-[1.7] text-ink placeholder:font-sans placeholder:text-sm placeholder:text-ink-muted/60 focus:outline-hidden"></textarea>

          <!-- Photo preview inside editor if attached -->
          <div id="photo-preview-box" class="hidden mt-3 relative inline-block">
            <div class="relative size-24 overflow-hidden rounded-field border bg-sand/40">
              <img id="photo-preview-img" src="" alt="Pratinjau Foto" class="size-full object-cover" />
              <button type="button" id="btn-remove-photo" aria-label="Hapus foto"
                class="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink/75 text-cream transition hover:bg-danger">
                <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Meta info: Tags and word count -->
        <div class="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-ink-muted">
          <div id="tag-chips-container" class="flex flex-wrap gap-1.5 min-h-6"></div>
          <span id="word-count" class="shrink-0 font-medium">0 kata</span>
        </div>
      </div>

      <!-- Bottom Actions -->
      <div class="flex items-center justify-between pt-2">
        <div>
          <input type="file" id="photo-file-input" accept="image/*" class="hidden" />
          <button type="button" id="btn-attach-photo"
            class="inline-flex min-h-11 items-center gap-2 rounded-field border bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand focus-visible:outline-2 focus-visible:outline-accent cursor-pointer">
            <svg class="size-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <span id="btn-photo-label">+ Foto</span>
          </button>
        </div>

        <button type="button" id="btn-save-entry" disabled
          class="inline-flex min-h-11 items-center justify-center rounded-field bg-accent px-6 py-2 text-sm font-semibold text-cream transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer">
          Simpan
        </button>
      </div>
    </div>
  `;

  // Attach elements
  const textarea = document.getElementById('entry-textarea');
  const tagChips = document.getElementById('tag-chips-container');
  const wordCountDisplay = document.getElementById('word-count');
  const saveBtn = document.getElementById('btn-save-entry');
  const photoInput = document.getElementById('photo-file-input');
  const photoBtn = document.getElementById('btn-attach-photo');
  const photoPreviewBox = document.getElementById('photo-preview-box');
  const photoPreviewImg = document.getElementById('photo-preview-img');
  const removePhotoBtn = document.getElementById('btn-remove-photo');
  const draftStatus = document.getElementById('draft-status');

  // Init mood picker
  const moodPicker = renderMoodPicker('write-mood-picker', null, (level) => {
    currentMood = level;
    validateForm();
    scheduleAutoSave();
  });

  // Extract tags: #tag and @mention
  function extractTags(text) {
    if (!text) return [];
    const matches = text.match(/(#[a-zA-Z0-9_\u00C0-\u024F]+|@[a-zA-Z0-9_\u00C0-\u024F]+)/g);
    return matches ? Array.from(new Set(matches)) : [];
  }

  function updateTagsAndCounts() {
    const text = textarea.value.trim();
    const tags = extractTags(text);

    // Tags display
    tagChips.innerHTML = tags
      .map(
        (t) =>
          `<span class="inline-flex items-center rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-ink">${t}</span>`
      )
      .join('');

    // Words count
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    wordCountDisplay.textContent = `${words} kata`;

    validateForm();
  }

  function validateForm() {
    const text = textarea.value.trim();
    const isValid = text.length > 0 && currentMood !== null;
    saveBtn.disabled = !isValid;
  }

  function scheduleAutoSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(async () => {
      const text = textarea.value;
      if (text.trim() || currentMood || currentImageData) {
        await draftStore.setItem('currentDraft', {
          text,
          mood: currentMood,
          imageHD: currentImageData ? currentImageData.imageHD : null,
          thumb: currentImageData ? currentImageData.thumb : null,
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
    if (savedDraft.thumb) {
      currentImageData = {
        imageHD: savedDraft.imageHD,
        thumb: savedDraft.thumb,
        previewUrl: `data:image/jpeg;base64,${savedDraft.thumb}`,
      };
      photoPreviewImg.src = currentImageData.previewUrl;
      photoPreviewBox.classList.remove('hidden');
    }
    updateTagsAndCounts();
    if (draftStatus) draftStatus.textContent = 'Draf dipulihkan';
  }

  // Textarea input event
  textarea.addEventListener('input', () => {
    updateTagsAndCounts();
    scheduleAutoSave();
    if (draftStatus) draftStatus.textContent = '';
  });

  // Photo handlers
  photoBtn.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    photoBtn.disabled = true;
    photoBtn.querySelector('span').textContent = 'Memproses...';

    try {
      const imgRes = await processImage(file);
      currentImageData = imgRes;
      photoPreviewImg.src = imgRes.previewUrl;
      photoPreviewBox.classList.remove('hidden');
      scheduleAutoSave();
    } catch (err) {
      console.error('Error processing photo:', err);
      showToast('Gagal memproses gambar', 'danger');
    } finally {
      photoBtn.disabled = false;
      photoBtn.querySelector('span').textContent = '+ Foto';
      photoInput.value = '';
    }
  });

  removePhotoBtn.addEventListener('click', () => {
    currentImageData = null;
    photoPreviewBox.classList.add('hidden');
    photoPreviewImg.src = '';
    scheduleAutoSave();
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
    const tags = extractTags(text);

    const entry = {
      id,
      timestamp: isoWithOffset,
      mood: currentMood,
      tags,
      deleted: false,
      updatedAt: new Date().toISOString(),
      fileId: '',
      text,
      thumb: currentImageData ? currentImageData.thumb : '',
      imageHD: currentImageData ? currentImageData.imageHD : '',
    };

    try {
      // 1. Save directly to local IndexedDB (without HD image to keep db fast)
      const localEntry = { ...entry, imageHD: undefined };
      await saveEntry(localEntry);

      // 2. Enqueue for backend synchronization (includes HD image)
      await enqueue('create', { entry });

      // 3. Clear draft
      await draftStore.removeItem('currentDraft');
      if (draftSaveTimer) clearTimeout(draftSaveTimer);

      // 4. Reset UI
      textarea.value = '';
      currentMood = null;
      currentImageData = null;
      moodPicker.setValue(null);
      photoPreviewBox.classList.add('hidden');
      updateTagsAndCounts();
      if (draftStatus) draftStatus.textContent = '';

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate([15, 30, 15]);

      // Show toast
      if (navigator.onLine) {
        showToast('Tersimpan di perangkat', 'success');
      } else {
        showToast('Disimpan di perangkat (offline)', 'info');
      }

      // 5. Trigger sync
      flushQueue();

      // Return focus to textarea
      textarea.focus();
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Gagal menyimpan entri', 'danger');
      saveBtn.disabled = false;
    }
  });
}
