/**
 * moodPicker.js — 5-level accessible mood selector component
 * role="radiogroup" with 44px touch targets and full accessible labels.
 */

export const MOODS = [
  { level: 1, label: 'Sangat buruk', icon: '😞', color: '#B8644F', twColor: 'bg-mood-1' },
  { level: 2, label: 'Kurang baik',  icon: '🙁', color: '#D99A6C', twColor: 'bg-mood-2' },
  { level: 3, label: 'Biasa saja',   icon: '😐', color: '#E6D3A3', twColor: 'bg-mood-3' },
  { level: 4, label: 'Baik',         icon: '🙂', color: '#A9C08F', twColor: 'bg-mood-4' },
  { level: 5, label: 'Sangat baik',  icon: '😄', color: '#6E9F7A', twColor: 'bg-mood-5' },
];

export function renderMoodPicker(containerId, initialValue = null, onChange = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div role="radiogroup" aria-label="Mood hari ini" class="grid grid-cols-5 gap-1.5 sm:gap-2">
      ${MOODS.map(
        (m) => `
        <button type="button" role="radio" aria-checked="${initialValue === m.level ? 'true' : 'false'}"
          data-mood="${m.level}"
          class="mood-btn flex min-h-12 flex-col items-center justify-center gap-1 rounded-field border bg-paper py-2 px-1
                 text-xs text-ink-muted transition-all duration-150 cursor-pointer
                 hover:bg-sand/60 hover:text-ink
                 aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:text-ink aria-checked:font-semibold aria-checked:shadow-xs
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span class="text-2xl leading-none" aria-hidden="true">${m.icon}</span>
          <span class="text-[11px] leading-tight text-center truncate max-w-full">${m.label}</span>
        </button>
      `
      ).join('')}
    </div>
  `;

  let currentMood = initialValue;

  container.querySelectorAll('.mood-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const level = parseInt(btn.dataset.mood, 10);
      currentMood = level;

      container.querySelectorAll('.mood-btn').forEach((b) => {
        const isSelected = parseInt(b.dataset.mood, 10) === level;
        b.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });

      if (navigator.vibrate) navigator.vibrate(10);
      if (onChange) onChange(level);
    });
  });

  return {
    getValue: () => currentMood,
    setValue: (val) => {
      currentMood = val;
      container.querySelectorAll('.mood-btn').forEach((b) => {
        const isSelected = parseInt(b.dataset.mood, 10) === val;
        b.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });
    },
  };
}
