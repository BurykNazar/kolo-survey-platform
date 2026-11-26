import { closeDialog, icon, openDialog, showToast } from './core.js';

/* ── Response drawer ────────────────────────────────────────────────────── */

const drawer = document.getElementById('responseDrawer');

document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-open-response]');
  if (!trigger || !drawer) return;

  const content = drawer.querySelector('[data-drawer-content]');
  content.innerHTML = `<div class="empty-state" style="padding:48px 0;"><span class="empty-state__mark">${icon('inbox', 22)}</span><p>Завантажуємо відповіді…</p></div>`;
  openDialog(drawer);

  try {
    const response = await fetch(trigger.dataset.endpoint, {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' }
    });
    const data = await response.json();
    if (!response.ok || !data.html) throw new Error(data.message || 'failed');
    content.innerHTML = data.html;
  } catch {
    closeDialog(drawer);
    showToast('Не вдалося завантажити відповіді.', 'error');
  }
});
