/**
 * main.js — Application entrypoint and Hash Router
 */
import './styles/app.css';
import { getSetting } from './data/db.js';
import { checkAndShowLock, initAutoLock, isLocked } from './lock/autolock.js';
import { initSyncPill } from './components/syncPill.js';
import { flushQueue } from './data/sync.js';

// Views
import { renderWriteView } from './views/write.js';
import { renderTimelineView } from './views/timeline.js';
import { renderDetailView } from './views/detail.js';
import { renderAnalyticsView } from './views/analytics.js';
import { renderSettingsView } from './views/settings.js';

const mainContent = document.getElementById('main-content');
const headerTitle = document.getElementById('header-title');

const TITLES = {
  write: 'Daily Journal',
  timeline: 'Timeline',
  analytics: 'Analitik Jurnal',
  settings: 'Pengaturan',
};

// PWA Install Prompt State
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-ready'));
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent('pwa-installed'));
});

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredInstallPrompt = null;
}

async function initTheme() {
  const theme = await getSetting('theme');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function updateNavigation(activeTab) {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    const tabName = tab.dataset.tab;
    if (tabName === activeTab) {
      tab.setAttribute('aria-current', 'page');
      tab.classList.add('bg-accent-soft', 'text-accent', 'font-medium');
      tab.classList.remove('text-ink-muted');
    } else {
      tab.removeAttribute('aria-current');
      tab.classList.remove('bg-accent-soft', 'text-accent', 'font-medium');
      tab.classList.add('text-ink-muted');
    }
  });
}

async function handleRouting() {
  if (isLocked()) return;

  const hash = window.location.hash || '#/write';

  if (hash.startsWith('#/detail/')) {
    const id = hash.replace('#/detail/', '');
    if (headerTitle) headerTitle.textContent = 'Detail Catatan';
    updateNavigation(null);
    await renderDetailView(mainContent, id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const route = hash.replace('#/', '') || 'write';
  const tabName = route.split('/')[0];

  if (headerTitle) {
    headerTitle.textContent = TITLES[tabName] || 'Daily Journal';
  }

  updateNavigation(tabName);

  switch (tabName) {
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

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          console.debug('Service Worker registered:', reg.scope);

          // Listen for incoming new worker
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Prompt worker to activate immediately
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });

          // Check for service worker updates whenever app is reopened or focused
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              reg.update().catch(() => {});
            }
          });

          // Periodic background check every 30 minutes
          setInterval(() => {
            reg.update().catch(() => {});
          }, 30 * 60 * 1000);
        })
        .catch((err) => {
          console.debug('Service Worker registration failed:', err);
        });

      // Reload smoothly when new Service Worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Listen for message from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_SYNC') {
          flushQueue();
        }
      });
    });
  }

  // Request persistent storage if available
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persistent) => {
      console.debug('Persistent storage granted:', persistent);
    });
  }
}

// App Initialization
async function initApp() {
  await initTheme();
  initSyncPill();
  registerServiceWorker();

  window.addEventListener('hashchange', handleRouting);
  await handleRouting();

  // Trigger sync on boot
  flushQueue();
}

// Security Check: Lock screen always precedes any data rendering
checkAndShowLock(() => {
  initApp();
  initAutoLock(() => {
    handleRouting();
  });
});
