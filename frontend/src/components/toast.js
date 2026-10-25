/**
 * toast.js — Minimal accessible toast notifications
 */

let toastTimeout = null;

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  const bgStyles = {
    info: 'bg-ink text-cream border-line/20',
    success: 'bg-accent text-cream border-accent-soft/30',
    danger: 'bg-danger text-cream border-danger/30',
  }[type] || 'bg-ink text-cream';

  container.innerHTML = `
    <div class="toast flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium shadow-lg backdrop-blur border ${bgStyles}" role="status">
      <span>${message}</span>
    </div>
  `;

  toastTimeout = setTimeout(() => {
    const el = container.firstElementChild;
    if (el) {
      el.classList.add('toast-exit');
      setTimeout(() => {
        container.innerHTML = '';
      }, 200);
    }
  }, duration);
}
