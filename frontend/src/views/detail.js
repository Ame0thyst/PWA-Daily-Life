/**
 * detail.js — TripGlide-inspired Detail View
 * Screen 2 Layout: Hero Image with Floating Action Buttons & Curving Bottom Sheet
 */
import { getEntry, saveEntry, deleteEntryLocal } from '../data/db.js';
import { MOODS, renderMoodPicker } from '../components/moodPicker.js';
import { apiGetImage } from '../data/api.js';
import { b64ToBlobUrl } from '../media/image.js';
import { enqueue } from '../data/queue.js';
import { flushQueue } from '../data/sync.js';
import { showToast } from '../components/toast.js';

export async function renderDetailView(container, entryId) {
  const entry = await getEntry(entryId);

  if (!entry || entry.deleted) {
    container.innerHTML = `
      <div class="modern-card p-12 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
        <p class="font-bold text-gray-900 dark:text-white">Catatan tidak ditemukan</p>
        <a href="#/timeline" class="btn-obsidian mt-4 inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold">
          &larr; Kembali ke Timeline
        </a>
      </div>
    `;
    return;
  }

  const moodObj = MOODS.find((m) => m.level === entry.mood) || MOODS[2];
  const dateObj = new Date(entry.timestamp);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fullDateStr = `${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()} &bull; ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  const tags = Array.isArray(entry.tags)
    ? entry.tags
    : typeof entry.tags === 'string'
    ? entry.tags.split(',').filter(Boolean)
    : [];

  const thumbSrc = entry.thumb
    ? (entry.thumb.startsWith('data:') ? entry.thumb : `data:image/jpeg;base64,${entry.thumb}`)
    : null;

  container.innerHTML = `
    <div class="flex flex-col pb-28 max-w-xl mx-auto">
      
      <!-- Top Floating Navigation Bar -->
      <div class="flex items-center justify-between py-2 mb-2">
        <a href="#/timeline"
          class="size-10 rounded-full bg-white dark:bg-[#171A21] border border-black/[0.06] shadow-xs flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 active:scale-95 transition-all">
          <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </a>

        <div class="flex items-center gap-2">
          <button type="button" id="btn-edit-entry"
            class="size-10 rounded-full bg-white dark:bg-[#171A21] border border-black/[0.06] shadow-xs flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer" title="Edit">
            ✏️
          </button>
          <button type="button" id="btn-delete-entry"
            class="size-10 rounded-full bg-white dark:bg-[#171A21] border border-black/[0.06] shadow-xs flex items-center justify-center text-rose-600 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer" title="Hapus">
            🗑️
          </button>
        </div>
      </div>

      <!-- Hero Image (If photo exists) -->
      ${thumbSrc || entry.fileId ? `
        <div class="relative overflow-hidden rounded-[32px] shadow-sm bg-gray-100 dark:bg-gray-800 border border-black/[0.06] max-h-80 mb-4">
          <img id="detail-image" src="${thumbSrc || ''}" alt="Foto Jurnal"
            class="w-full h-72 sm:h-80 object-cover transition-all duration-300 ${entry.fileId ? 'filter blur-[1px]' : ''}" />
          <div id="image-hd-badge" class="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
            ${entry.fileId ? 'Memuat HD...' : 'Foto'}
          </div>
        </div>
      ` : ''}

      <!-- Main Content Sheet -->
      <div class="modern-card p-6 sm:p-7 flex flex-col gap-4">
        <!-- Date & Mood Header -->
        <div class="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.08] pb-3">
          <span class="text-xs font-semibold text-gray-500">${fullDateStr}</span>
          <div class="flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200">
            <span>${moodObj.icon}</span>
            <span>${moodObj.fullLabel || moodObj.label}</span>
          </div>
        </div>

        <!-- View Mode: Journal Text -->
        <div id="entry-content-view" class="text-[16px] leading-[1.75] text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans">
          ${escapeHtml(entry.text || '')}
        </div>

        <!-- Edit Mode Form (Hidden by default) -->
        <div id="entry-content-edit" class="hidden flex flex-col gap-3">
          <label class="text-xs font-bold uppercase tracking-wider text-gray-400">Ubah Suasana Hati</label>
          <div id="edit-mood-picker"></div>

          <label class="text-xs font-bold uppercase tracking-wider text-gray-400 mt-2">Ubah Teks</label>
          <textarea id="edit-textarea" rows="7"
            class="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-[15px] leading-[1.65] text-gray-900 dark:text-white focus:outline-hidden">${escapeHtml(entry.text || '')}</textarea>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button type="button" id="btn-cancel-edit"
              class="chip-pill-inactive rounded-full px-5 py-2.5 text-xs font-semibold">
              Batal
            </button>
            <button type="button" id="btn-save-edit"
              class="btn-obsidian rounded-full px-6 py-2.5 text-xs font-bold">
              Simpan Perubahan
            </button>
          </div>
        </div>

        <!-- Tags Row -->
        ${tags.length > 0 ? `
          <div class="flex flex-wrap gap-1.5 pt-4 border-t border-black/[0.05] dark:border-white/[0.08]">
            ${tags.map((t) => `
              <span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                ${escapeHtml(t)}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // HD Image progressive loader
  if (entry.fileId) {
    const imgEl = document.getElementById('detail-image');
    const badgeEl = document.getElementById('image-hd-badge');

    if (navigator.onLine) {
      apiGetImage(entry.fileId)
        .then((res) => {
          if (res && res.ok && res.base64 && imgEl) {
            const hdUrl = b64ToBlobUrl(res.base64);
            imgEl.src = hdUrl;
            imgEl.classList.remove('blur-[1px]');
            if (badgeEl) badgeEl.textContent = 'HD';
          }
        })
        .catch(() => {});
    }
  }

  const editBtn = document.getElementById('btn-edit-entry');
  const deleteBtn = document.getElementById('btn-delete-entry');
  const viewMode = document.getElementById('entry-content-view');
  const editMode = document.getElementById('entry-content-edit');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const saveEditBtn = document.getElementById('btn-save-edit');
  const editTextarea = document.getElementById('edit-textarea');

  let editMood = entry.mood;

  editBtn.addEventListener('click', () => {
    viewMode.classList.add('hidden');
    editMode.classList.remove('hidden');
    editBtn.classList.add('hidden');

    renderMoodPicker('edit-mood-picker', entry.mood, (lvl) => {
      editMood = lvl;
    });
  });

  cancelEditBtn.addEventListener('click', () => {
    editMode.classList.add('hidden');
    viewMode.classList.remove('hidden');
    editBtn.classList.remove('hidden');
  });

  saveEditBtn.addEventListener('click', async () => {
    const updatedText = editTextarea.value.trim();
    if (!updatedText) return;

    const matches = updatedText.match(/(#[a-zA-Z0-9_\u00C0-\u024F]+|@[a-zA-Z0-9_\u00C0-\u024F]+)/g);
    const updatedTags = matches ? Array.from(new Set(matches)) : [];

    const updatedEntry = {
      ...entry,
      text: updatedText,
      mood: editMood,
      tags: updatedTags,
      updatedAt: new Date().toISOString(),
    };

    await saveEntry(updatedEntry);
    await enqueue('update', { entry: updatedEntry });
    flushQueue();

    showToast('Perubahan tersimpan!', 'success');
    renderDetailView(container, entryId);
  });

  deleteBtn.addEventListener('click', async () => {
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus catatan ini?');
    if (!confirmed) return;

    await deleteEntryLocal(entry.id);
    await enqueue('delete', { id: entry.id });
    flushQueue();

    showToast('Catatan dihapus', 'info');
    window.location.hash = '#/timeline';
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
