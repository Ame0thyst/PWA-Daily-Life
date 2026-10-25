/**
 * syncPill.js — Sync status indicator in header
 * States: 'synced' | 'syncing' | 'offline' | 'error' | 'auth_error'
 */
import { onSyncStateChange, flushQueue } from '../data/sync.js';

let hideSyncedTimer = null;

export function initSyncPill(containerId = 'sync-pill-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <button type="button" id="sync-pill-btn" role="status" aria-live="polite" data-state="synced"
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer
             bg-sand text-ink-muted border border-line/60
             data-[state=offline]:bg-accent-soft data-[state=offline]:text-ink data-[state=offline]:border-accent/30
             data-[state=syncing]:motion-safe:animate-pulse data-[state=syncing]:bg-sand data-[state=syncing]:text-ink
             data-[state=error]:bg-danger/10 data-[state=error]:text-danger data-[state=error]:border-danger/30
             data-[state=auth_error]:bg-danger/10 data-[state=auth_error]:text-danger data-[state=auth_error]:border-danger/30">
      <span class="size-1.5 rounded-full bg-current"></span>
      <span id="sync-pill-text">Tersinkron</span>
    </button>
  `;

  const btn = document.getElementById('sync-pill-btn');
  const label = document.getElementById('sync-pill-text');

  btn.addEventListener('click', () => {
    const currentState = btn.getAttribute('data-state');
    if (currentState === 'auth_error') {
      window.location.hash = '#/settings';
    } else {
      flushQueue();
    }
  });

  onSyncStateChange((status) => {
    btn.setAttribute('data-state', status.state);
    label.textContent = status.message || 'Tersinkron';

    if (hideSyncedTimer) {
      clearTimeout(hideSyncedTimer);
      hideSyncedTimer = null;
    }

    if (status.state === 'synced' && status.pendingCount === 0) {
      btn.style.opacity = '1';
      hideSyncedTimer = setTimeout(() => {
        btn.style.opacity = '0.35';
      }, 3000);
    } else {
      btn.style.opacity = '1';
    }
  });
}
