/**
 * syncPill.js — Minimalist Ambient Pulsing Sync Indicator
 * States: 'synced' (gentle green glow) | 'syncing' (pulsing blue) | 'offline' (amber) | 'error' (rose)
 */
import { onSyncStateChange, flushQueue } from '../data/sync.js';
import { showToast } from './toast.js';

let currentStatus = { state: 'synced', message: 'Tersinkron' };

export function initSyncPill(containerId = 'sync-pill-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <button type="button" id="sync-pill-btn" role="status" aria-label="Status Sinkronisasi"
      class="relative flex size-8 sm:size-8.5 items-center justify-center rounded-full bg-white dark:bg-[#171A21] border border-black/[0.06] dark:border-white/[0.08] shadow-2xs hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-90 transition-all cursor-pointer">
      
      <!-- Outer Gentle Pulsing Glow Ring -->
      <span id="sync-pill-ping" class="absolute size-4 rounded-full bg-emerald-400/30 animate-pulse"></span>
      
      <!-- Central Ambient Status Dot -->
      <span id="sync-pill-dot" class="relative size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"></span>
    </button>
  `;

  const btn = document.getElementById('sync-pill-btn');
  const dot = document.getElementById('sync-pill-dot');
  const ping = document.getElementById('sync-pill-ping');

  btn.addEventListener('click', () => {
    if (currentStatus.state === 'auth_error') {
      window.location.hash = '#/settings';
      showToast('Periksa konfigurasi API Token di Pengaturan', 'error');
    } else if (currentStatus.state === 'offline') {
      showToast('Mode Offline — Catatan disimpan aman di perangkat', 'info');
    } else if (currentStatus.state === 'syncing') {
      showToast('Sedang menyinkronkan data dengan Google Sheets...', 'info');
    } else if (currentStatus.state === 'error') {
      showToast('Mencoba sinkronisasi ulang...', 'info');
      flushQueue();
    } else {
      showToast('Tersinkron rapi dengan Google Sheets', 'success');
      flushQueue();
    }
  });

  onSyncStateChange((status) => {
    currentStatus = status;

    if (status.state === 'syncing') {
      dot.className = 'relative size-2.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]';
      ping.className = 'absolute size-4 rounded-full bg-sky-400 animate-ping opacity-75';
      btn.title = 'Sedang menyinkronkan...';
    } else if (status.state === 'offline') {
      dot.className = 'relative size-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
      ping.className = 'hidden';
      btn.title = 'Offline';
    } else if (status.state === 'error' || status.state === 'auth_error') {
      dot.className = 'relative size-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]';
      ping.className = 'absolute size-4 rounded-full bg-rose-400/40 animate-pulse';
      btn.title = 'Eror Sinkronisasi';
    } else {
      // Synced: gentle emerald light
      dot.className = 'relative size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]';
      ping.className = 'absolute size-4 rounded-full bg-emerald-400/30 animate-pulse';
      btn.title = 'Tersinkron';
    }
  });
}
