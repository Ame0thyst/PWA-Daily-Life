/**
 * moodPicker.js — 5 Frosted Glass Cards matching reference aesthetic
 */

export const MOODS = [
  {
    level: 1,
    label: 'Sangat Buruk',
    icon: '😭',
    color: '#EF4444',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    hint: 'Sedang berat hari ini? Tuangkan semuanya di sini, tak perlu dipendam.',
  },
  {
    level: 2,
    label: 'Kurang Baik',
    icon: '🙁',
    color: '#F97316',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    hint: 'Kurang bersemangat? Ceritakan perlahan, luapkan bebanmu.',
  },
  {
    level: 3,
    label: 'Biasa Saja',
    icon: '😐',
    color: '#EAB308',
    glowColor: 'rgba(234, 179, 8, 0.4)',
    hint: 'Hari yang tenang dan santai. Ada momen kecil yang menarik?',
  },
  {
    level: 4,
    label: 'Hari Baik',
    icon: '😊',
    color: '#22C55E',
    glowColor: 'rgba(34, 197, 94, 0.4)',
    hint: 'Suasana hati menyenangkan! Abadikan apa yang membuatmu tersenyum.',
  },
  {
    level: 5,
    label: 'Sangat Baik',
    icon: '🤩',
    color: '#F97316',
    glowColor: 'rgba(249, 115, 22, 0.45)',
    hint: 'Luar biasa! Energi positif siap mengisi lembaran jurnalmu hari ini.',
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
        <!-- 5 Frosted Glass Cards Row -->
        <div role="radiogroup" aria-label="Pilih suasana hati" class="grid grid-cols-5 gap-2 sm:gap-3 select-none">
          ${MOODS.map((m) => {
            const isSelected = currentMood === m.level;
            return `
              <button type="button" role="radio"
                aria-checked="${isSelected ? 'true' : 'false'}"
                aria-label="${m.label}"
                data-mood="${m.level}"
                class="mood-btn group relative flex flex-col items-center justify-center gap-2 rounded-2xl p-3 sm:py-4
                       transition-all duration-300 cursor-pointer overflow-hidden
                       ${isSelected
                         ? 'mood-card-selected'
                         : 'glass-card text-white/70 hover:text-white'
                       }">

                <!-- Emoji Icon -->
                <span class="text-3xl sm:text-4xl leading-none transition-transform duration-300 group-hover:scale-115 ${isSelected ? 'scale-110 drop-shadow-[0_0_12px_rgba(249,115,22,0.5)]' : ''}" aria-hidden="true">
                  ${m.icon}
                </span>

                <!-- Single line clean label -->
                <span class="text-xs sm:text-[13px] font-medium tracking-tight text-center whitespace-nowrap ${isSelected ? 'text-white font-semibold' : 'text-white/80'}">
                  ${m.label}
                </span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Dynamic Contextual Helper Banner -->
        <div class="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs backdrop-blur-md text-white/70">
          ${activeObj ? `
            <span class="text-base">${activeObj.icon}</span>
            <span class="font-medium text-white">${activeObj.label}</span> &bull; 
            <span class="text-white/60 truncate">${activeObj.hint}</span>
          ` : `
            <span class="text-white/50">💬</span>
            <span class="text-white/60">Pilih salah satu suasana hati untuk mulai mencatat.</span>
          `}
        </div>
      </div>
    `;

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
