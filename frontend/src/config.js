/**
 * config.js — Application configuration
 * Token is NOT stored here; it's stored in IndexedDB via settings.
 */

// This will be set by the user during onboarding in Settings
export const DEFAULT_API_URL = '';

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
export const PAGE_SIZE = 20;

// Sync
export const MAX_RETRY_ATTEMPTS = 5;
export const RETRY_BASE_DELAY = 5000; // 5s, doubles each attempt
