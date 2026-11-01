/**
 * moodPicker.js — Redesigned liquid 5-level mood selector with fluid feedback
 * Features:
 * - Expressive emoji icons with liquid bounce interaction
 * - No truncated labels (multi-line balanced typography)
 * - Dynamic mood reaction card with comforting context
 * - Full accessibility (radiogroup, aria-checked, keyboard focus)
 */

export const MOODS = [
  {
    level: 1,
    label: 'Sangat buruk',
    shortLabel: 'Sangat<br>Buruk',
    icon: '😞',
    color: '#B8644F',
    glowColor: 'rgba(184, 100, 79, 0.35)',
    twColor: 'bg-mood-1',
    hint: 'Hari terasa berat? Tuliskan, tak perlu dipendam.',
  },
  {
    level: 2,
    label: 'Kurang baik',
    shortLabel: 'Kurang<br>Baik',
    icon: '🙁',
    color: '#D99A6C',
    glowColor: 'rgba(217, 154, 108, 0.35)',
    twColor: 'bg-mood-2',
    hint: 'Kurang bersemangat? Ceritakan perlahan di sini.',
  },
  {
    level: 3,
    label: 'Biasa saja',
    shortLabel: 'Biasa<br>Saja',
    icon: '😐',
    color: '#E6D3A3',
    glowColor: 'rgba(230, 211, 163, 0.4)',
    twColor: 'bg-mood-3',
    hint: 'Hari yang tenang dan stabil. Ada hal menarik hari ini?',
  },
  {
    level: 4,
    label: 'Baik',
    shortLabel: 'Hari<br>Baik',
    icon: '🙂',
    color: '#A9C08F',
    glowColor: 'rgba(169, 192, 143, 0.35)',
    twColor: 'bg-mood-4',
    hint: 'Suasana hati menyenangkan! Abadikan momen ini.',
  },
  {
    level: 5,
    label: 'Sangat baik',
    shortLabel: 'Sangat<br>Baik',
    icon: '😄',
    color: '#6E9F7A',
    glowColor: 'rgba(110, 159, 122, 0.35)',
    twColor: 'bg-mood-5',
    hint: 'Luar biasa! Energi positif siap mengisi lembaranmu.',
  },
];

export function renderMoodPicker(containerId, initialValue = null, onChange = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let currentMood = initialValue;

  function getActiveMoodObj() {
    return MOODS.find((m) => m.level === currentMood) || null;
  }

  function renderHTML() {
    const activeObj = getActiveMoodObj();

    container.innerHTML = `
      <div class="flex flex-col gap-2.5">
        <!-- 5 Mood Buttons Row -->
        <div role="radiogroup" aria-label="Pilih suasana hati" class="grid grid-cols-5 gap-2 select-none">
          ${MOODS.map((m) => {
            const isSelected = currentMood === m.level;
            return `
              <button type="button" role="radio"
                aria-checked="${isSelected ? 'true' : 'false'}"
                aria-label="${m.label}"
                data-mood="${m.level}"
                class="mood-btn group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-2.5 px-1
                       transition-all duration-300 cursor-pointer overflow-hidden
                       ${isSelected
                         ? 'border-transparent font-semibold shadow-md transform -translate-y-1 scale-[1.03]'
                         : 'border-line/70 bg-paper/80 text-ink-muted hover:border-line hover:bg-sand/40 hover:text-ink hover:-translate-y-0.5'
                       }"
                style="${isSelected ? `background: linear-gradient(145deg, var(--color-paper), ${m.color}15); border-color: ${m.color}; box-shadow: 0 4px 14px ${m.glowColor};` : ''}">

                <!-- Subtle selected ambient glow pill behind emoji -->
                ${isSelected ? `<span class="absolute -top-3 size-12 rounded-full blur-md opacity-40 pointer-events-none" style="background: ${m.color}"></span>` : ''}

                <!-- Emoji Icon -->
                <span class="relative text-2xl sm:text-3xl leading-none transition-transform duration-300 group-hover:scale-115 ${isSelected ? 'scale-115' : ''}" aria-hidden="true">
                  ${m.icon}
                </span>

                <!-- Multi-line Label (Never truncated) -->
                <span class="relative text-[11px] leading-[1.15] text-center tracking-tight transition-colors duration-200 ${isSelected ? 'text-ink font-semibold' : 'text-ink-muted'}">
                  ${m.shortLabel}
                </span>

                <!-- Active Indicator Dot -->
                ${isSelected ? `
                  <span class="absolute bottom-1 size-1 rounded-full" style="background-color: ${m.color}"></span>
                ` : ''}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Dynamic Mood Reaction / Helper Message -->
        <div id="mood-hint-banner"
          class="flex items-center gap-2 rounded-xl border border-line/50 bg-paper/60 px-3 py-2 text-xs transition-all duration-300 backdrop-blur-xs">
          ${activeObj ? `
            <span class="text-base leading-none">${activeObj.icon}</span>
            <div class="flex flex-col min-w-0">
              <span class="font-semibold text-ink leading-tight">${activeObj.label}</span>
              <span class="text-[11px] text-ink-muted leading-tight truncate">${activeObj.hint}</span>
            </div>
          ` : `
            <span class="text-base leading-none text-accent">💭</span>
            <span class="text-ink-muted text-[11px]">Pilih salah satu suasana hati untuk mulai mencatat.</span>
          `}
        </div>
      </div>
    `;

    // Attach click events
    container.querySelectorAll('.mood-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const level = parseInt(btn.dataset.mood, 10);
        currentMood = level;

        if (navigator.vibrate) navigator.vibrate(12);

        renderHTML();

        if (onChange) onChange(level);
      });
    });
  }

  renderHTML();

  return {
    getValue: () => currentMood,
    setValue: (val) => {
      currentMood = val;
      renderHTML();
    },
  };
}
