/**
 * db.js — IndexedDB layer via localforage
 * Four stores: entries, queue, draft, settings
 */
import localforage from 'localforage';

// Entries cache (key: UUID)
export const entriesStore = localforage.createInstance({
  name: 'dailyJournal',
  storeName: 'entries',
});

// Sync queue
export const queueStore = localforage.createInstance({
  name: 'dailyJournal',
  storeName: 'queue',
});

// Draft (single item)
export const draftStore = localforage.createInstance({
  name: 'dailyJournal',
  storeName: 'draft',
});

// Settings (token, PIN hash, preferences)
export const settingsStore = localforage.createInstance({
  name: 'dailyJournal',
  storeName: 'settings',
});

/**
 * Settings helpers
 */
export async function getSetting(key) {
  return settingsStore.getItem(key);
}

export async function setSetting(key, value) {
  return settingsStore.setItem(key, value);
}

export async function getSettings() {
  const apiUrl = await getSetting('apiUrl') || '';
  const token = await getSetting('apiToken') || '';
  return { apiUrl, token };
}

/**
 * Entries helpers
 */
export async function getAllEntries() {
  const entries = [];
  await entriesStore.iterate((value) => {
    if (!value.deleted) entries.push(value);
  });
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return entries;
}

export async function getEntry(id) {
  return entriesStore.getItem(id);
}

export async function saveEntry(entry) {
  return entriesStore.setItem(entry.id, entry);
}

export async function deleteEntryLocal(id) {
  const entry = await entriesStore.getItem(id);
  if (entry) {
    entry.deleted = true;
    entry.updatedAt = new Date().toISOString();
    await entriesStore.setItem(id, entry);
  }
}

export async function mergeServerEntries(items) {
  for (const item of items) {
    const existing = await entriesStore.getItem(item.id);
    if (!existing || (item.updatedAt && item.updatedAt > (existing.updatedAt || ''))) {
      await entriesStore.setItem(item.id, item);
    }
  }
}

export async function clearAllData() {
  await entriesStore.clear();
  await queueStore.clear();
  await draftStore.clear();
}
