import { icon } from './core.js';

/* ── Date picker ────────────────────────────────────────────────────────── */

const UA_MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const UA_WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function initDatepicker(root) {
  if (root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';

  const input = root.querySelector('[data-date-value]') || root.querySelector('.date__input');
  const display = root.querySelector('[data-date-display]') || input;
  const trigger = root.querySelector('[data-date-toggle]');
  let popover = null;
  let view = new Date();

  const pretty = (value) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  };

  const commit = (value) => {
    input.value = value;
    display.value = pretty(value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const close = () => {
    popover?.remove();
    popover = null;
  };

  const render = () => {
    if (!popover) return;
    const selected = input.value;
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const today = iso(new Date());

    let cells = '';
    for (let i = 0; i < startOffset; i += 1) cells += '<span></span>';
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(year, month, day);
      const value = iso(date);
      const classes = ['calendar__day'];
      if (value === selected) classes.push('is-selected');
      if (value === today) classes.push('is-today');
      const isPast = value < today;
      const label = `${day} ${UA_MONTHS[month]} ${year}`;
      cells += `<button class="${classes.join(' ')}" type="button" data-day="${value}" aria-label="${label}" aria-pressed="${value === selected}" ${isPast ? 'disabled' : ''}>${day}</button>`;
    }

    popover.innerHTML = `
      <div class="calendar__head">
        <span class="calendar__month">${UA_MONTHS[month]} ${year}</span>
        <span class="calendar__nav">
          <button class="icon-btn" type="button" data-nav="-1" aria-label="Попередній місяць">${icon('chevron-left', 16)}</button>
          <button class="icon-btn" type="button" data-nav="1" aria-label="Наступний місяць">${icon('chevron-right', 16)}</button>
        </span>
      </div>
      <div class="calendar__week">${UA_WEEK.map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="calendar__grid">${cells}</div>
      <div class="calendar__foot">
        <button class="calendar__link" type="button" data-clear>Очистити</button>
        <button class="calendar__link" type="button" data-today>Сьогодні</button>
      </div>`;

    popover.querySelectorAll('[data-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        view = new Date(year, month + Number(button.dataset.nav), 1);
        render();
      });
    });
    popover.querySelectorAll('[data-day]').forEach((button) => {
      button.addEventListener('click', () => {
        commit(button.dataset.day);
        close();
      });
    });
    popover.querySelector('[data-clear]').addEventListener('click', () => {
      commit('');
      close();
    });
    popover.querySelector('[data-today]').addEventListener('click', () => {
      commit(iso(new Date()));
      close();
    });
  };

  const open = () => {
    close();
    const value = input.value ? new Date(`${input.value}T12:00:00`) : new Date();
    view = Number.isNaN(value.getTime()) ? new Date() : value;
    popover = document.createElement('div');
    popover.className = 'calendar';
    root.appendChild(popover);
    const rect = root.getBoundingClientRect();
    if (rect.bottom + 336 > window.innerHeight && rect.top > 360) {
      popover.classList.add('calendar--up');
    }
    render();
  };

  trigger?.addEventListener('click', () => (popover ? close() : open()));
  display.addEventListener('click', () => (popover ? close() : open()));
  document.addEventListener('click', (event) => {
    if (popover && !root.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && popover) close();
  });
}

document.querySelectorAll('[data-datepicker]').forEach(initDatepicker);
