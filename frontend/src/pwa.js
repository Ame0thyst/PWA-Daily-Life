/**
 * pwa.js — PWA lifecycle, installation prompt, and state management
 */

let deferredInstallPrompt = null;

// Listen for the browser install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-install-ready'));
});

// Reset prompt when app is successfully installed
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

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}
