/**
 * syncPill.js — Modern glassmorphism sync status pill indicator in header
 * States: 'synced' | 'syncing' | 'offline' | 'error' | 'auth_error'
 */
import { onSyncStateChange, flushQueue } from '../data/sync.js';

let hideSyncedTimer = null;

export function initSyncPill(containerId = 'sync-pill-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <button type="button" id="sync-pill-btn" role="status" aria-live="polite" data-state="synced"
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 cursor-pointer
             bg-white dark:bg-[#171A21] border border-black/[0.06] dark:border-white/[0.08] text-gray-800 dark:text-gray-200 shadow-2xs hover:bg-gray-50 active:scale-95
             data-[state=offline]:border-amber-400/40 data-[state=offline]:bg-amber-500/10 data-[state=offline]:text-amber-700
             data-[state=syncing]:border-sky-400/40 data-[state=syncing]:bg-sky-500/10 data-[state=syncing]:text-sky-700
             data-[state=error]:border-rose-400/40 data-[state=error]:bg-rose-500/10 data-[state=error]:text-rose-700
             data-[state=auth_error]:border-rose-400/40 data-[state=auth_error]:bg-rose-500/10 data-[state=auth_error]:text-rose-700">
      <span class="relative flex size-2">
        <span id="sync-pill-ping" class="absolute inline-flex size-full rounded-full opacity-75"></span>
        <span id="sync-pill-dot" class="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
      </span>
      <span id="sync-pill-text" class="leading-none text-[11px]">Tersinkron</span>
    </button>
  `;

  const btn = document.getElementById('sync-pill-btn');
  const label = document.getElementById('sync-pill-text');
  const dot = document.getElementById('sync-pill-dot');
  const ping = document.getElementById('sync-pill-ping');

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

    if (status.state === 'syncing') {
      dot.className = 'relative inline-flex size-2 rounded-full bg-sky-500';
      ping.className = 'absolute inline-flex size-full rounded-full bg-sky-400 animate-ping opacity-75';
    } else if (status.state === 'offline') {
      dot.className = 'relative inline-flex size-2 rounded-full bg-amber-500';
      ping.className = 'hidden';
    } else if (status.state === 'error' || status.state === 'auth_error') {
      dot.className = 'relative inline-flex size-2 rounded-full bg-rose-500';
      ping.className = 'hidden';
    } else {
      // Synced
      dot.className = 'relative inline-flex size-2 rounded-full bg-emerald-500';
      ping.className = 'hidden';
    }

    if (hideSyncedTimer) {
      clearTimeout(hideSyncedTimer);
      hideSyncedTimer = null;
    }

    if (status.state === 'synced' && status.pendingCount === 0) {
      btn.style.opacity = '1';
      hideSyncedTimer = setTimeout(() => {
        btn.style.opacity = '0.65';
      }, 3500);
    } else {
      btn.style.opacity = '1';
    }
  });
}
