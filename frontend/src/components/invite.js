/**
 * invite.js — Parse and process invite / connect links
 * Supports:
 * - ?connect=BASE64_PAYLOAD
 * - ?apiUrl=...&token=...
 * - #/connect?url=...&token=...
 */
import { setSetting, getSetting } from '../data/db.js';
import { showToast } from './toast.js';
import { flushQueue } from '../data/sync.js';

export async function checkAndProcessInviteLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';
  
  let targetUrl = '';
  let targetToken = '';
  let shouldCleanUrl = false;

  // 1. Cek parameter query biasa: ?apiUrl=...&token=...
  if (urlParams.has('apiUrl') || urlParams.has('token')) {
    targetUrl = urlParams.get('apiUrl') || '';
    targetToken = urlParams.get('token') || '';
    shouldCleanUrl = true;
  }
  // 2. Cek base64 connect query: ?connect=...
  else if (urlParams.has('connect')) {
    try {
      const decoded = atob(urlParams.get('connect'));
      const parsed = JSON.parse(decoded);
      targetUrl = parsed.u || parsed.apiUrl || '';
      targetToken = parsed.t || parsed.token || '';
      shouldCleanUrl = true;
    } catch (_) {}
  }
  // 3. Cek format hash: #/connect?url=...&token=...
  else if (hash.includes('connect')) {
    const queryPart = hash.split('?')[1];
    if (queryPart) {
      const hashParams = new URLSearchParams(queryPart);
      targetUrl = hashParams.get('url') || hashParams.get('apiUrl') || '';
      targetToken = hashParams.get('token') || '';
      shouldCleanUrl = true;
    }
  }

  // Jika parameter invite terdeteksi, simpan otomatis!
  if (targetUrl || targetToken) {
    if (targetUrl) await setSetting('apiUrl', targetUrl);
    if (targetToken) await setSetting('apiToken', targetToken);

    showToast('Tersambung ke Google Apps Script via Invite Link! ⚡', 'success');

    // Bersihkan URL dari browser address bar agar token tidak terpampang terus
    if (shouldCleanUrl) {
      const cleanPath = window.location.pathname + (window.location.hash.split('?')[0] === '#/connect' ? '#/write' : window.location.hash.split('?')[0]);
      window.history.replaceState({}, document.title, cleanPath);
    }

    flushQueue();
    return true;
  }

  return false;
}

/**
 * Generate shareable invite link with current configuration
 */
export async function generateInviteLink() {
  const currentUrl = (await getSetting('apiUrl')) || '';
  const currentToken = (await getSetting('apiToken')) || '';

  if (!currentUrl) return '';

  const payload = JSON.stringify({ u: currentUrl, t: currentToken });
  const encoded = btoa(payload);
  const origin = window.location.origin + window.location.pathname;
  return `${origin}?connect=${encoded}`;
}
