/**
 * queue.js — Offline sync queue management
 * Items: { id, op, payload, status, attempts, createdAt, error }
 */
import { queueStore } from './db.js';

export async function enqueue(op, payload) {
  const item = {
    id: payload.entry?.id || payload.id || crypto.randomUUID(),
    op,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    error: null,
  };
  await queueStore.setItem(item.id, item);
  return item;
}

export async function listPending() {
  const items = [];
  await queueStore.iterate((value) => {
    if (value.status === 'pending' || value.status === 'failed') {
      items.push(value);
    }
  });
  // Sort by creation time (oldest first)
  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return items;
}

export async function listAll() {
  const items = [];
  await queueStore.iterate((value) => {
    items.push(value);
  });
  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return items;
}

export async function remove(id) {
  await queueStore.removeItem(id);
}

export async function markFailed(id, error) {
  const item = await queueStore.getItem(id);
  if (item) {
    item.status = 'failed';
    item.error = error;
    await queueStore.setItem(id, item);
  }
}

export async function markSyncing(id) {
  const item = await queueStore.getItem(id);
  if (item) {
    item.status = 'syncing';
    await queueStore.setItem(id, item);
  }
}

export async function bumpAttempts(id) {
  const item = await queueStore.getItem(id);
  if (item) {
    item.attempts += 1;
    item.status = 'pending'; // reset to pending for retry
    await queueStore.setItem(id, item);
  }
}

export async function getPendingCount() {
  let count = 0;
  await queueStore.iterate((value) => {
    if (value.status !== 'synced') count++;
  });
  return count;
}

export async function isInQueue(id) {
  const item = await queueStore.getItem(id);
  return !!item;
}
