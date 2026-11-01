/**
 * main.js — Application entrypoint, Desktop Sidebar, Aurora Active Tabs, Profile & Routing
 */
import './styles/app.css';
import { getSetting, setSetting, getUserProfile } from './data/db.js';
import { checkAndShowLock, initAutoLock, isLocked } from './lock/autolock.js';
import { initSyncPill } from './components/syncPill.js';
import { flushQueue } from './data/sync.js';
import { hasUserKey } from './data/key.js';
import { renderOnboardingModal } from './components/onboarding.js';
import { checkAndProcessInviteLink } from './components/invite.js';
import { showSplashScreen } from './components/splash.js';
import { openProfileModal } from './components/profileModal.js';
import { showToast } from './components/toast.js';
import './pwa.js';

// Views
import { renderWriteView } from './views/write.js';
import { renderTimelineView } from './views/timeline.js';
import { renderDetailView } from './views/detail.js';
import { renderAnalyticsView } from './views/analytics.js';
import { renderSettingsView } from './views/settings.js';

const mainContent = document.getElementById('main-content');

const TAB_INDICES = {
  write: 0,
  timeline: 1,
  analytics: 2,
  settings: 3,
};

let currentTabIndex = 0;
let isNavigating = false;

async function initTheme() {
  const theme = await getSetting('theme');
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  await setSetting('theme', next);
  if (next === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    showToast('Tema Dark aktif', 'info');
  } else {
    document.documentElement.removeAttribute('data-theme');
    showToast('Tema Light aktif', 'info');
  }
}

function updateNavigation(activeTab) {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    const tabName = tab.dataset.tab;
    if (tabName === activeTab) {
      tab.setAttribute('aria-current', 'page');
      tab.classList.add('nav-item-active');
      tab.classList.remove('nav-item-inactive');
    } else {
      tab.removeAttribute('aria-current');
      tab.classList.remove('nav-item-active');
      tab.classList.add('nav-item-inactive');
    }
  });
}

async function updateProfileUI() {
  const profile = await getUserProfile();
  const username = profile.username || 'Vanessa';
  const initial = username[0].toUpperCase();

  const headerCircle = document.getElementById('header-avatar-circle');
  const headerUsername = document.getElementById('header-username-badge');
  if (headerCircle) {
    if (profile.avatar) {
      headerCircle.innerHTML = `<img src="${profile.avatar}" alt="${username}" class="size-full object-cover" />`;
    } else {
      headerCircle.textContent = initial;
    }
  }
  if (headerUsername) headerUsername.textContent = username;
}

async function handleRouting() {
  if (isLocked() || isNavigating) return;

  const hash = window.location.hash || '#/write';

  let targetTab = 'write';
  let isDetail = false;
  let detailId = null;

  if (hash.startsWith('#/detail/')) {
    isDetail = true;
    detailId = hash.replace('#/detail/', '');
    targetTab = null;
  } else {
    targetTab = hash.replace('#/', '').split('/')[0] || 'write';
  }

  const targetIndex = isDetail ? 99 : (TAB_INDICES[targetTab] ?? 0);

  // Directional Liquid Transitions
  let exitClass = 'view-liquid-exit-fade';
  let enterClass = 'view-liquid-fade';

  if (!isDetail && targetTab) {
    if (targetIndex > currentTabIndex) {
      exitClass = 'view-liquid-exit-left';
      enterClass = 'view-liquid-right';
    } else if (targetIndex < currentTabIndex) {
      exitClass = 'view-liquid-exit-right';
      enterClass = 'view-liquid-left';
    }
  } else if (isDetail) {
    exitClass = 'view-liquid-exit-fade';
    enterClass = 'view-liquid-right';
  }

  updateNavigation(targetTab);

  isNavigating = true;

  try {
    if (mainContent && mainContent.firstElementChild) {
      mainContent.classList.remove('view-liquid-right', 'view-liquid-left', 'view-liquid-fade');
      mainContent.classList.add(exitClass);
      await new Promise((r) => setTimeout(r, 140));
    }

    if (isDetail) {
      await renderDetailView(mainContent, detailId);
    } else {
      switch (targetTab) {
        case 'timeline':
          await renderTimelineView(mainContent);
          break;
        case 'analytics':
          await renderAnalyticsView(mainContent);
          break;
        case 'settings':
          await renderSettingsView(mainContent);
          break;
        case 'write':
        default:
          await renderWriteView(mainContent);
          break;
      }
      currentTabIndex = targetIndex;
    }

    mainContent.classList.remove('view-liquid-exit-left', 'view-liquid-exit-right', 'view-liquid-exit-fade');
    mainContent.classList.add(enterClass);

    window.scrollTo({ top: 0, behavior: 'instant' });

    setTimeout(() => {
      mainContent.classList.remove(enterClass);
    }, 320);
  } finally {
    isNavigating = false;
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });

          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              reg.update().catch(() => {});
            }
          });

          setInterval(() => {
            reg.update().catch(() => {});
          }, 30 * 60 * 1000);
        })
        .catch((err) => {
          console.debug('Service Worker registration failed:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_SYNC') {
          flushQueue();
        }
      });
    });
  }

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persistent) => {
      console.debug('Persistent storage granted:', persistent);
    });
  }
}

function updateHeaderDate() {
  const el = document.getElementById('header-live-date');
  if (!el) return;
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  el.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
}

const INSPIRATION_PROMPTS = [
  'Apa satu hal kecil yang membuatmu tersenyum hari ini? ✨',
  'Tuliskan hal terbaik atau pelajaran berharga yang kamu dapatkan hari ini. 📝',
  'Bagaimana perasaanmu sekarang? Luapkan ceritamu dengan jujur. 💭',
  'Catat satu kemenangan kecil yang kamu raih hari ini. 🏆',
  'Semua catatan tersimpan rapi, privat, dan terenkripsi aman di perangkatmu. 🔒',
];

// App Initialization
async function initApp() {
  await initTheme();
  initSyncPill();
  updateHeaderDate();
  registerServiceWorker();
  await updateProfileUI();

  // Profile modal click handlers
  document.getElementById('btn-header-profile')?.addEventListener('click', openProfileModal);
  document.getElementById('sidebar-user-capsule')?.addEventListener('click', openProfileModal);

  // Theme button
  document.getElementById('btn-header-theme')?.addEventListener('click', toggleTheme);

  // Notification button with inspiration prompt
  document.getElementById('btn-header-notif')?.addEventListener('click', () => {
    const randomPrompt = INSPIRATION_PROMPTS[Math.floor(Math.random() * INSPIRATION_PROMPTS.length)];
    showToast(randomPrompt, 'info');
  });

  // Listen for profile changes
  window.addEventListener('profile-updated', () => {
    updateProfileUI();
    const hash = window.location.hash || '#/write';
    if (hash === '#/write' || hash === '' || hash === '#/') {
      renderWriteView(mainContent);
    }
  });

  await checkAndProcessInviteLink();

  const keyExists = await hasUserKey();
  if (!keyExists) {
    renderOnboardingModal(() => {
      handleRouting();
    });
  }

  window.addEventListener('hashchange', handleRouting);
  await handleRouting();

  if (keyExists) {
    flushQueue();
  }
}

// Startup Sequence with Splash Screen
async function boot() {
  await initTheme();
  await showSplashScreen('splash-screen', 1300);

  checkAndShowLock(() => {
    initApp();
    initAutoLock(() => {
      handleRouting();
    });
  });
}

boot();
