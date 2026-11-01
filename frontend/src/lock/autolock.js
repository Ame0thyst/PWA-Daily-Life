/**
 * autolock.js — Lock screen controller and background auto-lock monitor
 * Automatically locks the app when backgrounded beyond the configured timeout.
 */
import { isPinSet, getPinLength, verifyPin, getLockoutRemaining } from './pin.js';
import { isWebAuthnSupported, isWebAuthnEnabled, authenticateWebAuthn } from './webauthn.js';
import { getSetting } from '../data/db.js';

let locked = true;
let hiddenTime = 0;
let unlockCallback = null;
let currentEnteredPin = '';
let lockoutTimer = null;

export function isLocked() {
  return locked;
}

export function lockNow() {
  locked = true;
  document.getElementById('lock-screen')?.classList.remove('hidden');
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('bottom-nav')?.classList.add('hidden');
  renderLockScreen();
}

export function unlockApp() {
  locked = false;
  document.getElementById('lock-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  document.getElementById('bottom-nav')?.classList.remove('hidden');
  currentEnteredPin = '';
  if (lockoutTimer) {
    clearInterval(lockoutTimer);
    lockoutTimer = null;
  }
  if (unlockCallback) {
    const cb = unlockCallback;
    unlockCallback = null;
    cb();
  }
}

export async function checkAndShowLock(onUnlocked) {
  const pinExists = await isPinSet();
  if (!pinExists) {
    // No PIN set, directly unlock
    unlockApp();
    if (onUnlocked) onUnlocked();
    return;
  }

  locked = true;
  unlockCallback = onUnlocked;
  document.getElementById('lock-screen')?.classList.remove('hidden');
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('bottom-nav')?.classList.add('hidden');
  renderLockScreen();

  // Try biometric auto-prompt if available
  const hasBiometric = await isWebAuthnEnabled();
  if (hasBiometric) {
    setTimeout(async () => {
      const bioOk = await authenticateWebAuthn();
      if (bioOk) unlockApp();
    }, 200);
  }
}

export function initAutoLock(onUnlocked) {
  // Listen for visibility changes
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      hiddenTime = Date.now();
    } else {
      if (!locked) {
        const timeoutSetting = (await getSetting('autoLockTimeout')) ?? 60000;
        const elapsed = Date.now() - hiddenTime;
        if (elapsed > timeoutSetting) {
          const pinExists = await isPinSet();
          if (pinExists) {
            checkAndShowLock(onUnlocked);
          }
        }
      }
    }
  });
}

async function renderLockScreen() {
  const container = document.getElementById('lock-screen');
  if (!container) return;

  const pinLength = await getPinLength();
  const lockoutSecs = await getLockoutRemaining();
  const biometricEnabled = await isWebAuthnEnabled();
  const biometricSupported = await isWebAuthnSupported();

  currentEnteredPin = '';

  const dotsHtml = Array.from({ length: pinLength })
    .map(
      (_, i) =>
        `<span class="pin-dot inline-block size-3.5 rounded-full border border-ink/40 transition-all duration-150" data-index="${i}"></span>`
    )
    .join('');

  container.innerHTML = `
    <div class="flex w-full max-w-xs flex-col items-center px-4 py-8 text-center animate-fade-in">
      <div class="mb-4 flex size-20 items-center justify-center rounded-[24px] bg-white dark:bg-[#171A21] shadow-md overflow-hidden border border-black/[0.06]">
        <img src="icons/icon-192.png" alt="Daily Journal" class="size-full object-cover" />
      </div>
      <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Daily Journal</h2>
      <p class="mt-1 text-sm text-gray-500" id="pin-prompt-text">Masukkan PIN untuk masuk</p>

      <!-- PIN Dots Indicator -->
      <div class="my-6 flex items-center justify-center gap-4" id="pin-dots" role="status" aria-label="PIN terisi">
        ${dotsHtml}
      </div>

      <!-- Lockout warning -->
      <div id="lockout-warning" class="${lockoutSecs > 0 ? '' : 'hidden'} mb-4 rounded-field bg-danger/10 p-3 text-xs text-danger font-medium">
        Terlalu banyak percobaan. Tunggu <span id="lockout-timer-display">${lockoutSecs}</span> detik.
      </div>

      <!-- Error feedback -->
      <div id="pin-error-feedback" class="hidden mb-4 text-xs font-semibold text-danger">
        PIN salah
      </div>

      <!-- Keypad -->
      <div class="grid grid-cols-3 gap-4" id="pin-keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => `
          <button type="button" class="pin-btn" data-key="${num}" aria-label="${num}">${num}</button>
        `).join('')}
        
        <!-- Left bottom: Biometric or empty -->
        ${biometricEnabled && biometricSupported ? `
          <button type="button" class="pin-btn text-accent" id="btn-biometric" aria-label="Gunakan Biometrik">
            <svg class="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a1.5 1.5 0 011.5 1.5v2.25m-3-2.25v2.25" />
            </svg>
          </button>
        ` : `<div class="size-[72px]"></div>`}

        <!-- Center bottom: 0 -->
        <button type="button" class="pin-btn" data-key="0" aria-label="0">0</button>

        <!-- Right bottom: Backspace -->
        <button type="button" class="pin-btn text-ink-muted" id="btn-backspace" aria-label="Hapus">
          <svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
          </svg>
        </button>
      </div>
    </div>
  `;

  // Attach event handlers
  setupKeypadEvents(pinLength);

  // If currently locked out, start timer
  if (lockoutSecs > 0) {
    disableKeypad(true);
    startLockoutCountdown(lockoutSecs, pinLength);
  }
}

function updateDots(length) {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < length) {
      dot.classList.add('bg-ink', 'scale-110');
      dot.classList.remove('bg-transparent');
    } else {
      dot.classList.remove('bg-ink', 'scale-110');
      dot.classList.add('bg-transparent');
    }
  });
}

function disableKeypad(disabled) {
  const buttons = document.querySelectorAll('#pin-keypad button');
  buttons.forEach((btn) => {
    btn.disabled = disabled;
    btn.classList.toggle('opacity-40', disabled);
  });
}

function startLockoutCountdown(seconds, pinLength) {
  let remaining = seconds;
  const warning = document.getElementById('lockout-warning');
  const timerDisplay = document.getElementById('lockout-timer-display');

  if (warning) warning.classList.remove('hidden');
  if (timerDisplay) timerDisplay.textContent = remaining;

  if (lockoutTimer) clearInterval(lockoutTimer);

  lockoutTimer = setInterval(() => {
    remaining -= 1;
    if (timerDisplay) timerDisplay.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(lockoutTimer);
      lockoutTimer = null;
      if (warning) warning.classList.add('hidden');
      disableKeypad(false);
    }
  }, 1000);
}

function setupKeypadEvents(pinLength) {
  const keypad = document.getElementById('pin-keypad');
  if (!keypad) return;

  keypad.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;

    if (btn.dataset.key !== undefined) {
      if (currentEnteredPin.length < pinLength) {
        currentEnteredPin += btn.dataset.key;
        updateDots(currentEnteredPin.length);

        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(10);

        if (currentEnteredPin.length === pinLength) {
          await handlePinSubmit(currentEnteredPin, pinLength);
        }
      }
    } else if (btn.id === 'btn-backspace') {
      if (currentEnteredPin.length > 0) {
        currentEnteredPin = currentEnteredPin.slice(0, -1);
        updateDots(currentEnteredPin.length);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    } else if (btn.id === 'btn-biometric') {
      const bioOk = await authenticateWebAuthn();
      if (bioOk) unlockApp();
    }
  });

  // Physical keyboard support
  window.onkeydown = async (e) => {
    if (!locked) return;
    if (e.key >= '0' && e.key <= '9') {
      if (currentEnteredPin.length < pinLength) {
        currentEnteredPin += e.key;
        updateDots(currentEnteredPin.length);
        if (currentEnteredPin.length === pinLength) {
          await handlePinSubmit(currentEnteredPin, pinLength);
        }
      }
    } else if (e.key === 'Backspace') {
      if (currentEnteredPin.length > 0) {
        currentEnteredPin = currentEnteredPin.slice(0, -1);
        updateDots(currentEnteredPin.length);
      }
    }
  };
}

async function handlePinSubmit(pin, pinLength) {
  disableKeypad(true);
  const result = await verifyPin(pin);

  if (result.ok) {
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    unlockApp();
  } else {
    // Show error
    if (navigator.vibrate) navigator.vibrate([80, 50, 80]);

    const errorFeedback = document.getElementById('pin-error-feedback');
    const dotsContainer = document.getElementById('pin-dots');

    if (errorFeedback) errorFeedback.classList.remove('hidden');
    if (dotsContainer) {
      dotsContainer.classList.add('animate-shake');
      setTimeout(() => dotsContainer.classList.remove('animate-shake'), 400);
    }

    if (result.lockedOut) {
      startLockoutCountdown(result.remainingSecs, pinLength);
    } else {
      setTimeout(() => {
        currentEnteredPin = '';
        updateDots(0);
        if (errorFeedback) errorFeedback.classList.add('hidden');
        disableKeypad(false);
      }, 600);
    }
  }
}
