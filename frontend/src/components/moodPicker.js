/**
 * moodPicker.js — Clean Nordic / iOS Minimalist Mood Selector
 * Inspired by TripGlide card & pill components
 */

export const MOODS = [
  {
    level: 1,
    label: 'Buruk',
    fullLabel: 'Sangat Buruk',
    icon: '😞',
    color: '#EF4444',
    hint: 'Sedang berat hari ini? Tuliskan, tak perlu dipendam.',
  },
  {
    level: 2,
    label: 'Kurang',
    fullLabel: 'Kurang Baik',
    icon: '🙁',
    color: '#F97316',
    hint: 'Kurang bersemangat? Ceritakan perlahan di lembaran ini.',
  },
  {
    level: 3,
    label: 'Biasa',
    fullLabel: 'Biasa Saja',
    icon: '😐',
    color: '#EAB308',
    hint: 'Hari yang tenang dan santai. Ada momen kecil yang menarik?',
  },
  {
    level: 4,
    label: 'Baik',
    fullLabel: 'Hari Baik',
    icon: '🙂',
    color: '#22C55E',
    hint: 'Suasana hati menyenangkan! Abadikan momen indah ini.',
  },
  {
    level: 5,
    label: 'Hebat',
    fullLabel: 'Sangat Baik',
    icon: '😄',
    color: '#10B981',
    hint: 'Luar biasa! Energi positif siap mengisi lembaran ceritamu.',
  },
];

export function renderMoodPicker(containerId, initialValue = null, onChange = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let currentMood = initialValue;

  function renderHTML() {
    const activeObj = MOODS.find((m) => m.level === currentMood) || null;

    container.innerHTML = `
      <div class="flex flex-col gap-2.5">
        <!-- 5 Clean Nordic Minimalist Cards Row -->
        <div role="radiogroup" aria-label="Pilih suasana hati" class="grid grid-cols-5 gap-2 select-none">
          ${MOODS.map((m) => {
            const isSelected = currentMood === m.level;
            return `
              <button type="button" role="radio"
                aria-checked="${isSelected ? 'true' : 'false'}"
                aria-label="${m.fullLabel}"
                data-mood="${m.level}"
                class="mood-btn group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-1
                       transition-all duration-200 cursor-pointer overflow-hidden
                       ${isSelected
                         ? 'bg-[#181B20] text-white shadow-md scale-[1.04] border-transparent dark:bg-white dark:text-[#11141A]'
                         : 'bg-white border border-black/[0.06] text-gray-700 hover:bg-gray-50 hover:border-black/10 dark:bg-[#171A21] dark:border-white/[0.08] dark:text-gray-300'
                       }">

                <!-- Emoji Icon -->
                <span class="text-2xl leading-none transition-transform duration-200 group-hover:scale-110" aria-hidden="true">
                  ${m.icon}
                </span>

                <!-- Clean Single Word Label -->
                <span class="text-[11px] font-semibold tracking-tight text-center leading-tight">
                  ${m.label}
                </span>

                <!-- Active Dot Indicator -->
                ${isSelected ? `
                  <span class="size-1 rounded-full bg-white dark:bg-[#11141A] mt-0.5"></span>
                ` : ''}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Dynamic Contextual Helper Banner -->
        <div class="flex items-center gap-2 rounded-xl bg-white border border-black/[0.05] px-3.5 py-2 text-xs text-gray-600 shadow-2xs dark:bg-[#171A21] dark:border-white/[0.08] dark:text-gray-400">
          ${activeObj ? `
            <span class="text-base">${activeObj.icon}</span>
            <span class="font-semibold text-gray-900 dark:text-white">${activeObj.fullLabel}</span>
            <span class="text-gray-400">&bull;</span>
            <span class="truncate">${activeObj.hint}</span>
          ` : `
            <span class="text-gray-400">💭</span>
            <span>Pilih salah satu suasana hati untuk mulai mencatat.</span>
          `}
        </div>
      </div>
    `;

    container.querySelectorAll('.mood-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const level = parseInt(btn.dataset.mood, 10);
        currentMood = level;

        if (navigator.vibrate) navigator.vibrate(10);

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
