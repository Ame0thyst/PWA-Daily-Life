/**
 * heatmap.js — 53-week x 7-day Activity & Mood Heatmap (GitHub-style)
 * Always visible with explicit classes, contrast borders, stats, and auto-scroll to today
 */

const HEAT_LEVEL_CLASSES = [
  'bg-slate-200/70 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700/80 hover:border-slate-500', // 0: empty
  'bg-rose-500 border border-rose-600 shadow-2xs',                                                              // 1: sangat buruk
  'bg-orange-400 border border-orange-500 shadow-2xs',                                                          // 2: kurang baik
  'bg-amber-400 border border-amber-500 shadow-2xs',                                                            // 3: biasa saja
  'bg-emerald-400 border border-emerald-500 shadow-2xs',                                                        // 4: baik
  'bg-emerald-600 border border-emerald-700 shadow-2xs',                                                        // 5: sangat baik
];

export function renderHeatmap(containerId, entries = [], onSelectDate = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Map entries by YYYY-MM-DD -> array of moods
  const dateMap = new Map();
  let totalEntriesInYear = 0;

  entries.forEach((e) => {
    if (!e.timestamp) return;
    const dateStr = e.timestamp.substring(0, 10);
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, []);
    }
    dateMap.get(dateStr).push(e.mood);
  });

  // Calculate 52 weeks ending on today
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...
  const adjustedTodayDay = (dayOfWeek + 6) % 7; // Mon = 0, Sun = 6

  const totalDays = 52 * 7 + (adjustedTodayDay + 1);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - totalDays + 1);

  // Generate day cells
  const cells = [];
  const curr = new Date(startDate);
  let activeDaysCount = 0;

  while (curr <= today) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const moods = dateMap.get(dateStr);
    let level = 0;
    let label = `${dd}/${mm}/${yyyy}: Belum ada catatan`;

    if (moods && moods.length > 0) {
      activeDaysCount += 1;
      totalEntriesInYear += moods.length;
      const avg = Math.round(moods.reduce((a, b) => a + b, 0) / moods.length);
      level = Math.max(1, Math.min(5, avg));
      const moodNames = ['', 'Sangat Buruk 😞', 'Kurang Baik 🙁', 'Biasa Saja 😐', 'Baik 🙂', 'Sangat Baik 😄'];
      label = `${dd}/${mm}/${yyyy}: ${moods.length} catatan (Mood: ${moodNames[level]})`;
    }

    cells.push({
      date: dateStr,
      level,
      label,
      month: curr.getMonth(),
      dayOfMonth: curr.getDate(),
      dayOfWeek: (curr.getDay() + 6) % 7,
    });

    curr.setDate(curr.getDate() + 1);
  }

  const activePercent = Math.round((activeDaysCount / Math.max(1, cells.length)) * 100);

  container.innerHTML = `
    <div class="modern-card p-5 flex flex-col gap-3">
      <!-- Heatmap Header -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="flex size-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-sm">🟩</span>
          <div>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white leading-tight">Aktivitas & Mood Harian</h3>
            <p class="text-[11px] text-gray-500 dark:text-gray-400">${activeDaysCount} hari aktif (${activePercent}%) • ${totalEntriesInYear} catatan dalam 1 tahun</p>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <span>Kosong</span>
          <span class="size-2.5 rounded-[3px] bg-slate-200/70 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700/80" title="Kosong"></span>
          <span class="size-2.5 rounded-[3px] bg-rose-500" title="Sangat Buruk"></span>
          <span class="size-2.5 rounded-[3px] bg-orange-400" title="Kurang Baik"></span>
          <span class="size-2.5 rounded-[3px] bg-amber-400" title="Biasa Saja"></span>
          <span class="size-2.5 rounded-[3px] bg-emerald-400" title="Baik"></span>
          <span class="size-2.5 rounded-[3px] bg-emerald-600" title="Sangat Baik"></span>
          <span>Hebat</span>
        </div>
      </div>

      <!-- Scrollable Grid of Squares -->
      <div class="heatmap-scroll-area overflow-x-auto pb-2 pt-1 no-scrollbar select-none">
        <div class="grid grid-flow-col grid-rows-7 gap-[3.5px] w-max min-w-full">
          ${cells.map(
            (c) => `
            <button type="button" data-date="${c.date}" aria-label="${c.label}" title="${c.label}"
              class="heatmap-cell size-3.5 rounded-[3.5px] ${HEAT_LEVEL_CLASSES[c.level]} transition-transform hover:scale-135 hover:z-10 focus:outline-none cursor-pointer"></button>
          `
          ).join('')}
        </div>
      </div>

      <!-- Heatmap Footer with Day Labels & Hint -->
      <div class="flex items-center justify-between text-[11px] text-gray-400 font-medium px-1 pt-0.5 border-t border-black/5 dark:border-white/5">
        <div class="flex items-center gap-3">
          <span>Sen</span>
          <span>Rab</span>
          <span>Jum</span>
          <span>Min</span>
        </div>
        <div id="heatmap-info-pill" class="text-[11px] text-gray-500 dark:text-gray-400 italic truncate max-w-[200px]">
          Ketuk kotak untuk melihat detail
        </div>
      </div>
    </div>
  `;

  // Auto-scroll to today (right side)
  requestAnimationFrame(() => {
    const scrollArea = container.querySelector('.heatmap-scroll-area');
    if (scrollArea) {
      scrollArea.scrollLeft = scrollArea.scrollWidth;
    }
  });

  // Tap handler to update info pill or navigate
  const infoPill = container.querySelector('#heatmap-info-pill');
  container.querySelectorAll('.heatmap-cell').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dateStr = btn.dataset.date;
      const label = btn.getAttribute('title');
      if (infoPill) {
        infoPill.innerHTML = `<span class="text-gray-900 dark:text-white font-semibold not-italic">${label}</span>`;
      }
      if (onSelectDate) {
        onSelectDate(dateStr);
      }
    });
  });
}
