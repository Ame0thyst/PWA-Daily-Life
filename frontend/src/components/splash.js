/**
 * splash.js — Opening/Splash screen with liquid water ripple animation
 */

export function showSplashScreen(containerId = 'splash-screen', minDurationMs = 1400) {
  return new Promise((resolve) => {
    const splashEl = document.getElementById(containerId);
    if (!splashEl) {
      resolve();
      return;
    }

    splashEl.innerHTML = `
      <div class="relative flex flex-col items-center justify-center text-center px-6 select-none">
        <!-- Minimalist Ripple Rings -->
        <div class="relative flex items-center justify-center">
          <div class="splash-ripple-ring size-28 rounded-full border border-black/10 dark:border-white/10 absolute"></div>
          <div class="splash-ripple-ring splash-ripple-delay size-36 rounded-full border border-black/5 dark:border-white/5 absolute"></div>

          <!-- Central App Icon -->
          <div class="relative z-10 flex size-20 items-center justify-center rounded-[24px] bg-white dark:bg-[#171A21] shadow-xl border border-black/[0.06] dark:border-white/10 overflow-hidden transform transition-transform duration-700">
            <img src="icons/icon-192.png" alt="Daily Journal" class="size-full object-cover" />
          </div>
        </div>

        <!-- App Brand Typography -->
        <div class="mt-6 flex flex-col items-center">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <span>Daily Journal</span>
          </h1>
          <p class="mt-1 text-xs text-gray-500 tracking-wide font-medium">
            Ruang Cerita & Refleksi Pribadi
          </p>
        </div>

        <!-- Progress Indicator -->
        <div class="mt-8 flex items-center gap-1.5">
          <span class="size-1.5 rounded-full bg-[#181B20] dark:bg-white animate-ping"></span>
          <div class="h-1 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div class="splash-liquid-bar h-full rounded-full bg-[#181B20] dark:bg-white"></div>
          </div>
        </div>

        <button type="button" id="btn-skip-splash" class="mt-6 text-[11px] text-gray-400 hover:text-gray-600 transition">
          Ketuk untuk melewati
        </button>
      </div>
    `;

    splashEl.classList.remove('hidden');

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;

      // Liquid fade-out animation
      splashEl.classList.add('splash-exit');
      setTimeout(() => {
        splashEl.classList.add('hidden');
        splashEl.classList.remove('splash-exit');
        resolve();
      }, 350);
    };

    // Auto-dismiss after minDurationMs
    const timer = setTimeout(dismiss, minDurationMs);

    // Skip on tap
    splashEl.addEventListener('click', () => {
      clearTimeout(timer);
      dismiss();
    }, { once: true });
  });
}

