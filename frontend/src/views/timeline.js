/**
 * timeline.js — Timeline view with monthly grouping, search, tag filter, and offline cache
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
    <div class="flex flex-col gap-4 pb-8">
      <!-- Search and Filter Bar -->
      <div class="flex flex-col gap-2.5">
        <div class="relative">
          <input type="text" id="timeline-search-input"
            placeholder="Cari dalam catatan..."
            class="w-full rounded-field border bg-paper py-2.5 pl-9 pr-4 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-hidden focus:ring-1 focus:ring-accent" />
          <svg class="absolute left-3 top-3 size-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>

        <!-- Tag Chips Filter Bar -->
        <div id="timeline-tags-filter" class="flex items-center gap-1.5 overflow-x-auto py-1 text-xs"></div>
      </div>

      <!-- Entries Container -->
      <div id="timeline-entries-list" class="flex flex-col gap-4">
        <!-- Skeleton initially -->
        <div class="space-y-3">
          <div class="h-28 skeleton rounded-card"></div>
          <div class="h-28 skeleton rounded-card"></div>
          <div class="h-28 skeleton rounded-card"></div>
        </div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('timeline-search-input');
  const tagsContainer = document.getElementById('timeline-tags-filter');
  const entriesList = document.getElementById('timeline-entries-list');

  // Load from local IndexedDB first (Instant / Offline)
  await loadAndRenderLocal(entriesList, tagsContainer);

  // Background revalidation (Stale-while-revalidate)
  if (navigator.onLine) {
    revalidateFromServer(entriesList, tagsContainer);
  }

  // Search event
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderFilteredEntries(entriesList);
  });
}

async function loadAndRenderLocal(entriesList, tagsContainer) {
  cachedEntries = await getAllEntries();
  const queueItems = await listAllQueue();
  pendingQueueIds = new Set(queueItems.map((q) => q.payload?.entry?.id || q.id));

  buildTagsFilter(tagsContainer, entriesList);
  renderFilteredEntries(entriesList);
}

async function revalidateFromServer(entriesList, tagsContainer) {
  try {
    const res = await apiListEntries(50, null);
    if (res && res.ok && Array.isArray(res.items)) {
      await mergeServerEntries(res.items);
      cachedEntries = await getAllEntries();
      buildTagsFilter(tagsContainer, entriesList);
      renderFilteredEntries(entriesList);
    }
  } catch (err) {
    // Offline or server unreachable, silent failover to cache
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
      class="tag-filter-btn shrink-0 rounded-full px-3 py-1 font-medium transition cursor-pointer
             ${!activeTagFilter ? 'bg-accent text-cream' : 'bg-sand text-ink-muted hover:text-ink'}">
      Semua
    </button>
    ${Array.from(allTags)
      .map(
        (tag) => `
        <button type="button" data-tag="${tag}"
          class="tag-filter-btn shrink-0 rounded-full px-3 py-1 font-medium transition cursor-pointer
                 ${activeTagFilter === tag ? 'bg-accent text-cream' : 'bg-sand text-ink-muted hover:text-ink'}">
          ${tag}
        </button>
      `
      )
      .join('')}
  `;

  container.querySelectorAll('.tag-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTagFilter = btn.dataset.tag || null;
      buildTagsFilter(container, entriesList);
      renderFilteredEntries(entriesList);
    });
  });
}

function renderFilteredEntries(container) {
  let filtered = cachedEntries;

  // Apply search query
  if (searchQuery) {
    filtered = filtered.filter((e) => {
      const matchText = (e.text || '').toLowerCase().includes(searchQuery);
      const matchTags = Array.isArray(e.tags)
        ? e.tags.some((t) => t.toLowerCase().includes(searchQuery))
        : String(e.tags || '').toLowerCase().includes(searchQuery);
      return matchText || matchTags;
    });
  }

  // Apply tag filter
  if (activeTagFilter) {
    filtered = filtered.filter((e) => {
      if (Array.isArray(e.tags)) return e.tags.includes(activeTagFilter);
      return String(e.tags || '').split(',').includes(activeTagFilter);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center rounded-card border border-dashed py-12 px-4 text-center">
        <svg class="size-12 text-ink-muted/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <p class="font-medium text-ink">Belum ada catatan</p>
        <p class="mt-1 text-xs text-ink-muted max-w-xs">Tuliskan pemikiran dan momen berharga Anda hari ini.</p>
        <a href="#/write" class="mt-4 inline-flex items-center gap-1.5 rounded-field bg-accent px-4 py-2 text-xs font-semibold text-cream hover:opacity-90">
          + Tulis Jurnal
        </a>
      </div>
    `;
    return;
  }

  // Group entries by Month & Year
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
      <section class="flex flex-col gap-2.5">
        <h3 class="sticky top-14 z-10 bg-cream/90 py-1 font-serif text-sm font-semibold text-ink-muted backdrop-blur">
          ${monthYear}
        </h3>
        <div class="flex flex-col gap-3">
          ${items.map((entry) => renderEntryCard(entry, pendingQueueIds.has(entry.id))).join('')}
        </div>
      </section>
    `;
  });

  container.innerHTML = html;

  // Add click listener to navigate to Detail
  container.querySelectorAll('.entry-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      window.location.hash = `#/detail/${id}`;
    });
  });
}
