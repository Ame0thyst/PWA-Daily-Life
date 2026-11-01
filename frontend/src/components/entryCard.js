/**
 * entryCard.js — Enhanced Entry card component for Timeline view
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
      class="entry-card group relative flex flex-col rounded-2xl border border-line/70 bg-paper p-4 shadow-sm transition-all duration-300 cursor-pointer
             hover:border-accent/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.985]"
      style="border-left-width: 4px; border-left-color: ${moodObj.color};">
      <header class="flex items-center justify-between text-xs text-ink-muted">
        <div class="flex items-center gap-2">
          <time datetime="${entry.timestamp}" class="font-medium font-sans">${formatDateShort(entry.timestamp)}</time>
          ${isPendingSync ? `
            <span class="inline-flex items-center gap-1 rounded-full bg-accent-soft/80 border border-accent/30 px-2 py-0.5 text-[10px] font-semibold text-accent shadow-2xs">
              <span class="size-1 rounded-full bg-accent animate-ping"></span> Belum tersinkron
            </span>
          ` : ''}
        </div>
        <div class="flex items-center gap-1.5" title="${moodObj.label}">
          <span class="text-base transition-transform group-hover:scale-120 duration-200" aria-hidden="true">${moodObj.icon}</span>
          <span class="text-[11px] font-medium text-ink-muted">${moodObj.label}</span>
        </div>
      </header>

      <div class="mt-2.5 flex items-start gap-3">
        ${thumbSrc ? `
          <div class="size-16 shrink-0 overflow-hidden rounded-xl border border-line/80 bg-sand/40 shadow-2xs">
            <img src="${thumbSrc}" alt="Thumbnail" class="size-full object-cover" loading="lazy"
                 onerror="this.parentElement.style.display='none'" />
          </div>
        ` : ''}
        <div class="min-w-0 flex-1">
          <p class="line-clamp-2 font-serif text-[16px] leading-[1.65] text-ink text-left">
            ${escapeHtml(entry.text || '(Entri kosong)')}
          </p>
        </div>
      </div>

      ${tags.length > 0 ? `
        <div class="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-line/40">
          ${tags.map((tag) => `
            <span class="inline-flex items-center rounded-full bg-sand/60 border border-line/50 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
              ${escapeHtml(tag)}
            </span>
          `).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
