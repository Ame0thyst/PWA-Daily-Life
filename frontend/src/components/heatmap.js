/**
 * heatmap.js — 53-week x 7-day activity & mood heatmap (GitHub-style)
 * Uses explicit Tailwind utility classes: bg-heat-empty, bg-mood-1..5
 */

// Full class names required for Tailwind 4 scanner
const HEAT_COLORS = [
  'bg-heat-empty',
  'bg-mood-1',
  'bg-mood-2',
  'bg-mood-3',
  'bg-mood-4',
  'bg-mood-5',
];

export function renderHeatmap(containerId, entries = [], onSelectDate = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Map entries by YYYY-MM-DD -> average mood
  const dateMap = new Map();
  entries.forEach((e) => {
    if (!e.timestamp) return;
    const dateStr = e.timestamp.substring(0, 10);
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, []);
    }
    dateMap.get(dateStr).push(e.mood);
  });

  // Calculate 52-53 weeks ending on today
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...
  // Normalize Monday as day 0
  const adjustedTodayDay = (dayOfWeek + 6) % 7;

  const totalDays = 52 * 7 + (adjustedTodayDay + 1);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - totalDays + 1);

  // Generate day cells
  const cells = [];
  const curr = new Date(startDate);

  while (curr <= today) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const moods = dateMap.get(dateStr);
    let level = 0;
    let label = `${dd}/${mm}/${yyyy}: Belum ada jurnal`;

    if (moods && moods.length > 0) {
      const avg = Math.round(moods.reduce((a, b) => a + b, 0) / moods.length);
      level = Math.max(1, Math.min(5, avg));
      const moodNames = ['', 'Sangat buruk', 'Kurang baik', 'Biasa saja', 'Baik', 'Sangat baik'];
      label = `${dd}/${mm}/${yyyy}: ${moods.length} entri (Mood: ${moodNames[level]})`;
    }

    cells.push({
      date: dateStr,
      level,
      label,
    });

    curr.setDate(curr.getDate() + 1);
  }

  container.innerHTML = `
    <div class="rounded-card border bg-paper p-4 shadow-card">
      <div class="flex items-center justify-between pb-3 text-xs text-ink-muted">
        <span class="font-medium text-ink">Aktivitas & Mood (1 Tahun)</span>
        <div class="flex items-center gap-1.5 text-[11px]">
          <span>Sedikit</span>
          <span class="size-2.5 rounded-xs bg-heat-empty"></span>
          <span class="size-2.5 rounded-xs bg-mood-1"></span>
          <span class="size-2.5 rounded-xs bg-mood-3"></span>
          <span class="size-2.5 rounded-xs bg-mood-5"></span>
          <span>Banyak</span>
        </div>
      </div>

      <div class="overflow-x-auto pb-2 pt-1">
        <div class="grid grid-flow-col grid-rows-7 gap-[3px] w-max min-w-full">
          ${cells.map(
            (c) => `
            <button type="button" data-date="${c.date}" aria-label="${c.label}" title="${c.label}"
              class="heatmap-cell size-3 rounded-xs ${HEAT_COLORS[c.level]} transition-transform hover:scale-125 hover:z-10 focus-visible:outline-1 focus-visible:outline-accent"></button>
          `
          ).join('')}
        </div>
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-ink-muted">
        <span>Sen</span>
        <span>Rab</span>
        <span>Jum</span>
        <span>Min</span>
      </div>
    </div>
  `;

  if (onSelectDate) {
    container.querySelectorAll('.heatmap-cell').forEach((btn) => {
      btn.addEventListener('click', () => {
        onSelectDate(btn.dataset.date);
      });
    });
  }
}
