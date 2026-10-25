/**
 * api.js — Simple request via POST text/plain;charset=utf-8
 * Token sent in body to avoid preflight and query string logging.
 */
import { getSettings } from './db.js';

export async function callApi(op, payload = {}) {
  const { apiUrl, token } = await getSettings();
  if (!apiUrl) {
    throw new Error('API_URL_NOT_CONFIGURED');
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, op, ...payload }),
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

export async function apiListEntries(limit = 20, cursor = null) {
  return callApi('list', { limit, cursor });
}

export async function apiGetStats() {
  return callApi('stats');
}

export async function apiGetImage(fileId) {
  return callApi('image', { fileId });
}
