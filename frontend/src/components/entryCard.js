/**
 * entryCard.js — Entry card component for Timeline view
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

  const hasThumb = !!entry.thumb;
  const thumbSrc = hasThumb
    ? (entry.thumb.startsWith('data:') ? entry.thumb : `data:image/jpeg;base64,${entry.thumb}`)
    : null;

  return `
    <article data-id="${entry.id}"
      class="entry-card group relative flex flex-col rounded-card border bg-paper p-4 shadow-card transition-all duration-200 cursor-pointer
             hover:border-accent/40 hover:shadow-md active:scale-[0.99]">
      <header class="flex items-center justify-between text-xs text-ink-muted">
        <div class="flex items-center gap-2">
          <time datetime="${entry.timestamp}">${formatDateShort(entry.timestamp)}</time>
          ${isPendingSync ? `
            <span class="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
              <span class="size-1 rounded-full bg-accent"></span> Belum tersinkron
            </span>
          ` : ''}
        </div>
        <div class="flex items-center gap-1.5" title="${moodObj.label}">
          <span class="text-sm" aria-hidden="true">${moodObj.icon}</span>
          <span class="size-2 rounded-full ${moodObj.twColor}" role="img" aria-label="Mood ${entry.mood}: ${moodObj.label}"></span>
        </div>
      </header>

      <div class="mt-2.5 flex items-start gap-3">
        ${thumbSrc ? `
          <div class="size-16 shrink-0 overflow-hidden rounded-field border bg-sand/50">
            <img src="${thumbSrc}" alt="Thumbnail" class="size-full object-cover" loading="lazy" />
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
            <span class="inline-flex items-center rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
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
