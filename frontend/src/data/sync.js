/**
 * sync.js — Offline queue synchronization with multi-layered triggers
 * Triggers: online event, visibilitychange, after save, manual retry
 */
import { callApi } from './api.js';
import * as queue from './queue.js';
import { getSettings } from './db.js';

let flushing = false;
let currentState = {
  state: 'synced', // 'synced' | 'syncing' | 'offline' | 'error' | 'auth_error'
  pendingCount: 0,
  message: '',
};

const listeners = new Set();

export function getSyncState() {
  return currentState;
}

export function onSyncStateChange(fn) {
  listeners.add(fn);
  fn(currentState);
  return () => listeners.delete(fn);
}

export function setSyncState(state, customMessage = '') {
  queue.getPendingCount().then((count) => {
    let message = customMessage;
    if (!message) {
      if (state === 'offline') {
        message = count > 0 ? `Disimpan di perangkat (${count})` : 'Offline';
      } else if (state === 'syncing') {
        message = 'Menyinkronkan...';
      } else if (state === 'synced') {
        message = 'Tersinkron';
      } else if (state === 'auth_error') {
        message = 'Token salah. Cek Pengaturan';
      } else if (state === 'error') {
        message = 'Gagal. Ketuk untuk coba lagi';
      }
    }

    currentState = {
      state,
      pendingCount: count,
      message,
    };

    listeners.forEach((fn) => {
      try {
        fn(currentState);
      } catch (e) {
        console.error('Sync listener error:', e);
      }
    });
  });
}

export async function flushQueue() {
  if (flushing) return;

  const { apiUrl, token } = await getSettings();
  if (!apiUrl || !token) {
    // If not configured, we keep items offline without showing error spam
    const count = await queue.getPendingCount();
    if (count > 0) {
      setSyncState('offline', `Disimpan di perangkat (${count})`);
    } else {
      setSyncState('synced');
    }
    return;
  }

  if (!navigator.onLine) {
    const count = await queue.getPendingCount();
    setSyncState('offline', count > 0 ? `Disimpan di perangkat (${count})` : 'Offline');
    return;
  }

  const pendingItems = await queue.listPending();
  if (pendingItems.length === 0) {
    setSyncState('synced');
    return;
  }

  flushing = true;
  setSyncState('syncing');

  try {
    for (const item of pendingItems) {
      try {
        await queue.markSyncing(item.id);
        const r = await callApi(item.op, item.payload);

        if (r.ok) {
          await queue.remove(item.id);
          continue;
        }

        if (r.error === 'unauthorized') {
          await queue.markFailed(item.id, 'unauthorized');
          setSyncState('auth_error');
          return;
        }

        await queue.markFailed(item.id, r.error || 'unknown_error');
      } catch (netErr) {
        // Network failure during send
        await queue.bumpAttempts(item.id);
        const count = await queue.getPendingCount();
        setSyncState('offline', `Disimpan di perangkat (${count})`);
        return;
      }
    }

    const remaining = await queue.getPendingCount();
    if (remaining === 0) {
      setSyncState('synced');
    } else {
      setSyncState('error');
    }
  } catch (err) {
    console.error('flushQueue fatal error:', err);
    setSyncState('error');
  } finally {
    flushing = false;
  }
}

// Layered triggers
window.addEventListener('online', () => {
  flushQueue();
});

window.addEventListener('offline', () => {
  queue.getPendingCount().then((count) => {
    setSyncState('offline', count > 0 ? `Disimpan di perangkat (${count})` : 'Offline');
  });
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && navigator.onLine) {
    flushQueue();
  }
});

// Periodic check every 60s
setInterval(() => {
  if (!document.hidden && navigator.onLine) {
    flushQueue();
  }
}, 60000);
