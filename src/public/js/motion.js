const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(element) {
  const raw = element.textContent.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(raw)) return;

  const target = Number(raw);
  const decimals = (raw.split('.')[1] || '').length;
  const started = performance.now();
  const duration = 650;

  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = (target * eased).toFixed(decimals);
    if (progress < 1) requestAnimationFrame(tick);
  };

  element.textContent = (0).toFixed(decimals);
  requestAnimationFrame(tick);
}

if (!reduceMotion) {
  document.querySelectorAll('.stat__value').forEach(countUp);
}
