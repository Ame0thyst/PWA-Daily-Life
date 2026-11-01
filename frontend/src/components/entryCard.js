/**
 * entryCard.js — Clean Nordic / iOS Luxury Entry Card
 * Inspired by TripGlide's Schedule & Feature cards
 */
import { MOODS } from './moodPicker.js';

export function formatDateShort(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

export function renderEntryCard(entry, isPendingSync = false) {
  const moodObj = MOODS.find((m) => m.level === entry.mood) || MOODS[2];
  const tags = Array.isArray(entry.tags)
    ? entry.tags
    : typeof entry.tags === 'string'
    ? entry.tags.split(',').filter(Boolean)
    : [];

  const hasThumb = !!entry.thumb && typeof entry.thumb === 'string' && entry.thumb.trim().length > 30;
  const thumbSrc = hasThumb
    ? (entry.thumb.startsWith('data:') ? entry.thumb : `data:image/jpeg;base64,${entry.thumb}`)
    : null;

  return `
    <article data-id="${entry.id}"
      class="entry-card group relative flex flex-col rounded-[24px] bg-white dark:bg-[#171A21] p-4 sm:p-5 shadow-xs border border-black/[0.04] dark:border-white/[0.06] transition-all duration-200 cursor-pointer
             hover:shadow-md hover:-translate-y-0.5 active:scale-[0.985]">
      
      <!-- Top Row: Date & Mood Pill -->
      <header class="flex items-center justify-between text-xs text-gray-500">
        <div class="flex items-center gap-2">
          <time datetime="${entry.timestamp}" class="font-medium text-gray-700 dark:text-gray-300">${formatDateShort(entry.timestamp)}</time>
          ${isPendingSync ? `
            <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              <span class="size-1 rounded-full bg-amber-500 animate-ping"></span> Belum sinkron
            </span>
          ` : ''}
        </div>
        
        <!-- Mood Tag Pill -->
        <div class="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          <span>${moodObj.icon}</span>
          <span>${moodObj.fullLabel || moodObj.label}</span>
        </div>
      </header>

      <!-- Center Content: Thumbnail & Text snippet -->
      <div class="mt-3 flex items-start gap-3.5">
        ${thumbSrc ? `
          <div class="size-18 shrink-0 overflow-hidden rounded-[18px] border border-black/[0.06] bg-gray-100 dark:bg-gray-800 shadow-2xs">
            <img src="${thumbSrc}" alt="Thumbnail" class="size-full object-cover" loading="lazy"
                 onerror="this.parentElement.style.display='none'" />
          </div>
        ` : ''}
        
        <div class="min-w-0 flex-1">
          <p class="line-clamp-2 text-[15px] leading-[1.6] text-gray-900 dark:text-gray-100 text-left font-normal">
            ${escapeHtml(entry.text || '(Entri kosong)')}
          </p>
        </div>

        <!-- Circular Arrow Indicator Button -->
        <div class="self-center shrink-0 size-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-[#181B20] group-hover:text-white transition-colors">
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>

      <!-- Bottom Tags Row -->
      ${tags.length > 0 ? `
        <div class="mt-3 flex flex-wrap gap-1.5 pt-2.5 border-t border-black/[0.04] dark:border-white/[0.06]">
          ${tags.map((tag) => `
            <span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
              ${escapeHtml(tag)}
            </span>
          `).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
