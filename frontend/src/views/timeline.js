/**
 * timeline.js — TripGlide-inspired Timeline View
 */
import { getAllEntries, mergeServerEntries } from '../data/db.js';
import { renderEntryCard } from '../components/entryCard.js';
import { listAll as listAllQueue } from '../data/queue.js';
import { apiListEntries } from '../data/api.js';

let cachedEntries = [];
let pendingQueueIds = new Set();
let activeTagFilter = null;
let searchQuery = '';

export async function renderTimelineView(container) {
  container.innerHTML = `
    <div class="flex flex-col gap-5 pb-32 max-w-xl mx-auto">
      <!-- Top Title -->
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Timeline Catatan</h2>
        <span class="text-xs text-gray-500 font-medium" id="timeline-total-badge">Memuat...</span>
      </div>

      <!-- Search Pill Bar -->
      <div class="search-pill flex items-center px-4 py-3 gap-3">
        <svg class="size-4.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input type="text" id="timeline-search-input"
          placeholder="Cari dalam catatan atau tag..."
          class="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden" />
      </div>

      <!-- Tag Filter Pills -->
      <div id="timeline-tags-filter" class="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar"></div>

      <!-- Entries Container -->
      <div id="timeline-entries-list" class="flex flex-col gap-4">
        <div class="space-y-3">
          <div class="h-28 skeleton rounded-[24px]"></div>
          <div class="h-28 skeleton rounded-[24px]"></div>
          <div class="h-28 skeleton rounded-[24px]"></div>
        </div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('timeline-search-input');
  const tagsContainer = document.getElementById('timeline-tags-filter');
  const entriesList = document.getElementById('timeline-entries-list');

  await loadAndRenderLocal(entriesList, tagsContainer);

  if (navigator.onLine) {
    revalidateFromServer(entriesList, tagsContainer);
  }

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderFilteredEntries(entriesList);
  });
}

async function loadAndRenderLocal(entriesList, tagsContainer) {
  cachedEntries = await getAllEntries();
  const queueItems = await listAllQueue();
  pendingQueueIds = new Set(queueItems.map((q) => q.payload?.entry?.id || q.id));

  const totalBadge = document.getElementById('timeline-total-badge');
  if (totalBadge) totalBadge.textContent = `${cachedEntries.length} entri`;

  buildTagsFilter(tagsContainer, entriesList);
  renderFilteredEntries(entriesList);
}

async function revalidateFromServer(entriesList, tagsContainer) {
  try {
    const res = await apiListEntries(50, null);
    if (res && res.ok && Array.isArray(res.items)) {
      await mergeServerEntries(res.items);
      cachedEntries = await getAllEntries();
      const totalBadge = document.getElementById('timeline-total-badge');
      if (totalBadge) totalBadge.textContent = `${cachedEntries.length} entri`;
      buildTagsFilter(tagsContainer, entriesList);
      renderFilteredEntries(entriesList);
    }
  } catch (err) {
    console.debug('Background sync list failed, using cached entries:', err);
  }
}

function buildTagsFilter(container, entriesList) {
  const allTags = new Set();
  cachedEntries.forEach((e) => {
    const tags = Array.isArray(e.tags)
      ? e.tags
      : typeof e.tags === 'string'
      ? e.tags.split(',').filter(Boolean)
      : [];
    tags.forEach((t) => allTags.add(t));
  });

  if (allTags.size === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button type="button" data-tag=""
      class="chip-pill ${!activeTagFilter ? 'chip-pill-active' : 'chip-pill-inactive'} shrink-0">
      Semua
    </button>
    ${Array.from(allTags)
      .map(
        (tag) => `
        <button type="button" data-tag="${tag}"
          class="chip-pill ${activeTagFilter === tag ? 'chip-pill-active' : 'chip-pill-inactive'} shrink-0">
          ${tag}
        </button>
      `
      )
      .join('')}
  `;

  container.querySelectorAll('.chip-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTagFilter = btn.dataset.tag || null;
      buildTagsFilter(container, entriesList);
      renderFilteredEntries(entriesList);
    });
  });
}

function renderFilteredEntries(container) {
  let filtered = cachedEntries;

  if (searchQuery) {
    filtered = filtered.filter((e) => {
      const matchText = (e.text || '').toLowerCase().includes(searchQuery);
      const matchTags = Array.isArray(e.tags)
        ? e.tags.some((t) => t.toLowerCase().includes(searchQuery))
        : String(e.tags || '').toLowerCase().includes(searchQuery);
      return matchText || matchTags;
    });
  }

  if (activeTagFilter) {
    filtered = filtered.filter((e) => {
      if (Array.isArray(e.tags)) return e.tags.includes(activeTagFilter);
      return String(e.tags || '').split(',').includes(activeTagFilter);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="modern-card p-10 flex flex-col items-center justify-center text-center">
        <span class="text-4xl mb-3">📖</span>
        <h4 class="font-bold text-gray-900 dark:text-white">Belum ada catatan</h4>
        <p class="text-xs text-gray-500 mt-1 max-w-xs">Mulai tuliskan momen berhargamu hari ini.</p>
        <a href="#/write" class="btn-obsidian mt-5 inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold">
          + Tulis Cerita Baru
        </a>
      </div>
    `;
    return;
  }

  const groups = new Map();
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  filtered.forEach((e) => {
    const d = new Date(e.timestamp);
    const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(e);
  });

  let html = '';
  groups.forEach((items, monthYear) => {
    html += `
      <section class="flex flex-col gap-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">
          ${monthYear}
        </h3>
        <div class="flex flex-col gap-3">
          ${items.map((entry) => renderEntryCard(entry, pendingQueueIds.has(entry.id))).join('')}
        </div>
      </section>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.entry-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      window.location.hash = `#/detail/${id}`;
    });
  });
}
