/**
 * config.js — Application configuration
 * Default backend configuration so users don't need to manually type API URL & Token!
 */

// URL deployment Google Apps Script terpusat milik Anda
export const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbxF-yEnnArO6ptTMg7jxg9HPCWeh2jcw_HtPO7bwhKOUQbHdodRoesfPNlzELGyX2OM/exec';

// API Token terpusat (Shared Secret)
export const DEFAULT_API_TOKEN = 'JournalGilangErika!2026#020226';

// Auto-lock timeout in ms (default 60 seconds)
export const AUTO_LOCK_TIMEOUT = 60_000;

// Draft autosave debounce in ms
export const DRAFT_SAVE_DELAY = 2000;

// Image processing
export const HD_MAX_SIDE = 1080;
export const HD_QUALITY = 0.8;
export const THUMB_MAX_SIDE = 150;
export const THUMB_QUALITY = 0.5;

// Pagination
export const PAGE_SIZE = 50;

// Sync
export const MAX_RETRY_ATTEMPTS = 5;
export const RETRY_BASE_DELAY = 5000; // 5s, doubles each attempt
