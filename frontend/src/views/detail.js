/**
 * detail.js — Single journal entry detail view with progressive HD image loading
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
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <p class="font-serif text-lg font-semibold text-ink">Catatan tidak ditemukan</p>
        <a href="#/timeline" class="mt-4 inline-flex items-center gap-1.5 rounded-field bg-accent px-4 py-2 text-xs font-semibold text-cream">
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
  const fullDateStr = `${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()} · ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  const tags = Array.isArray(entry.tags)
    ? entry.tags
    : typeof entry.tags === 'string'
    ? entry.tags.split(',').filter(Boolean)
    : [];

  const thumbSrc = entry.thumb
    ? (entry.thumb.startsWith('data:') ? entry.thumb : `data:image/jpeg;base64,${entry.thumb}`)
    : null;

  container.innerHTML = `
    <div class="flex flex-col gap-5 pb-8 max-w-2xl mx-auto">
      <!-- Top Bar: Back and Actions -->
      <div class="flex items-center justify-between border-b pb-3">
        <a href="#/timeline" class="inline-flex items-center gap-1.5 rounded-field px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-sand hover:text-ink transition cursor-pointer">
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Kembali
        </a>

        <div class="flex items-center gap-2">
          <button type="button" id="btn-edit-entry"
            class="rounded-field border bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-sand cursor-pointer">
            Edit
          </button>
          <button type="button" id="btn-delete-entry"
            class="rounded-field border border-danger/30 bg-paper px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10 cursor-pointer">
            Hapus
          </button>
        </div>
      </div>

      <!-- Date & Mood Info -->
      <div class="flex flex-col gap-1.5">
        <time class="text-xs font-medium text-ink-muted">${fullDateStr}</time>
        <div class="flex items-center gap-2">
          <span class="text-2xl" aria-hidden="true">${moodObj.icon}</span>
          <span class="font-serif text-lg font-bold text-ink">${moodObj.label}</span>
          <span class="size-2 rounded-full ${moodObj.twColor}"></span>
        </div>
      </div>

      <!-- Photo Display with progressive loading -->
      ${thumbSrc || entry.fileId ? `
        <div class="relative overflow-hidden rounded-card border bg-sand/30 shadow-card">
          <img id="detail-image" src="${thumbSrc || ''}" alt="Foto Jurnal"
            class="w-full max-h-[480px] object-contain transition-all duration-300 ${entry.fileId ? 'filter blur-[1px]' : ''}" />
          <div id="image-hd-badge" class="absolute bottom-2 right-2 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-medium text-cream backdrop-blur">
            ${entry.fileId ? 'Memuat HD...' : 'Thumbnail'}
          </div>
        </div>
      ` : ''}

      <!-- Main Text Content (View mode) -->
      <div id="entry-content-view" class="font-serif text-[17px] leading-[1.8] text-ink whitespace-pre-wrap">
        ${escapeHtml(entry.text || '')}
      </div>

      <!-- Edit Form (Hidden by default) -->
      <div id="entry-content-edit" class="hidden flex flex-col gap-3">
        <label class="text-xs font-medium text-ink-muted">Ubah Mood</label>
        <div id="edit-mood-picker"></div>
        <label class="text-xs font-medium text-ink-muted">Ubah Teks</label>
        <textarea id="edit-textarea" rows="8"
          class="w-full rounded-card border bg-paper p-3 font-serif text-[17px] leading-[1.7] text-ink focus:border-accent focus:outline-hidden focus:ring-1 focus:ring-accent">${escapeHtml(entry.text || '')}</textarea>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" id="btn-cancel-edit" class="rounded-field border bg-paper px-4 py-2 text-xs font-medium text-ink hover:bg-sand">
            Batal
          </button>
          <button type="button" id="btn-save-edit" class="rounded-field bg-accent px-4 py-2 text-xs font-semibold text-cream hover:opacity-90">
            Simpan Perubahan
          </button>
        </div>
      </div>

      <!-- Tag Chips -->
      ${tags.length > 0 ? `
        <div class="flex flex-wrap gap-2 pt-4 border-t">
          ${tags.map((t) => `
            <span class="inline-flex items-center rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink">
              ${escapeHtml(t)}
            </span>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // Progressive image loading: fetch HD from Drive if fileId is present
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
        .catch((err) => {
          console.debug('Failed to fetch HD image:', err);
          if (badgeEl) badgeEl.textContent = 'HD tersedia saat online';
        });
    } else if (badgeEl) {
      badgeEl.textContent = 'HD tersedia saat online';
    }
  }

  // Edit / Delete button handlers
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

    showToast('Perubahan tersimpan', 'success');
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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
