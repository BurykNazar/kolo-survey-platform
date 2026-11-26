import { icon } from './core.js';

/* ── Header & navigation ────────────────────────────────────────────────── */

const head = document.querySelector('.site-head');
if (head) {
  const onScroll = () => head.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

const menuToggle = document.querySelector('[data-menu-toggle]');
const siteNav = document.getElementById('site-nav');
if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    menuToggle.innerHTML = icon(open ? 'x' : 'menu', 22);
  });
  siteNav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      siteNav.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

document.addEventListener('click', (event) => {
  document.querySelectorAll('details.user-menu[open]').forEach((menu) => {
    if (!menu.contains(event.target)) menu.removeAttribute('open');
  });
});

/* ── Password visibility ────────────────────────────────────────────────── */

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-password-toggle]');
  if (!toggle) return;
  const input = toggle.closest('.password')?.querySelector('input');
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  toggle.setAttribute('aria-label', reveal ? 'Сховати пароль' : 'Показати пароль');
  toggle.innerHTML = icon(reveal ? 'eye-off' : 'eye', 17);
});
