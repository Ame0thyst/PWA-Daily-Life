/**
 * api.js — Simple request via POST text/plain;charset=utf-8
 * Token and User_Key sent in body for multi-user isolation.
 */
import { getSettings } from './db.js';
import { getStoredUserKey } from './key.js';

export async function callApi(op, payload = {}) {
  const { apiUrl, token } = await getSettings();
  if (!apiUrl) {
    throw new Error('API_URL_NOT_CONFIGURED');
  }

  const userKey = await getStoredUserKey();

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, userKey, op, ...payload }),
  });

  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }

  const data = await res.json();
  return data;
}

/**
 * Convenience API wrappers
 */
export async function apiCreateEntry(entry) {
  return callApi('create', { entry });
}

export async function apiUpdateEntry(entry) {
  return callApi('update', { entry });
}

export async function apiDeleteEntry(id) {
  return callApi('delete', { id });
}

export async function apiListEntries(limit = 30) {
  return callApi('list', { limit });
}

export async function apiGetStats() {
  return callApi('stats');
}

export async function apiGetImage(fileId) {
  return callApi('image', { fileId });
}

export async function apiGetProfile() {
  return callApi('get_profile');
}

export async function apiSetProfile(profile) {
  return callApi('set_profile', { profile });
}
