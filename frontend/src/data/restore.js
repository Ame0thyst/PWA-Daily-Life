/**
 * restore.js — Restore and fetch all diary entries from server for a given User Key
 */
import { apiListEntries, apiGetProfile } from './api.js';
import { mergeServerEntries, getAllEntries, setUserProfile } from './db.js';
import { getSettings } from './db.js';

export async function restoreUserEntries() {
  const { apiUrl, token } = await getSettings();
  if (!apiUrl || !token) {
    return { ok: false, error: 'NO_API_CONFIGURED', count: 0 };
  }

  try {
    // 1. Pulihkan profil jika ada di server
    try {
      const profRes = await apiGetProfile();
      if (profRes && profRes.ok && profRes.profile) {
        await setUserProfile({
          username: profRes.profile.username || 'Alif',
          avatar: profRes.profile.avatarBase64 || '',
        });
      }
    } catch (_) {}

    // 2. Pulihkan catatan
    const res = await apiListEntries(500); // Ambil hingga 500 catatan terbaru milik user ini
    if (res && res.ok && Array.isArray(res.items)) {
      if (res.items.length > 0) {
        await mergeServerEntries(res.items);
      }
      return { ok: true, count: res.items.length };
    }
    return { ok: false, error: res?.error || 'UNKNOWN_ERROR', count: 0 };
  } catch (err) {
    return { ok: false, error: err.message, count: 0 };
  }
}

