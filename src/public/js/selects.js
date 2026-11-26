const SELECT_ICON = '<svg class="icon select__chevron" width="16" height="16" aria-hidden="true"><use href="/img/icons.svg#i-chevron-down"></use></svg>';
const CHECK_ICON = '<svg class="icon" width="16" height="16" aria-hidden="true"><use href="/img/icons.svg#i-check"></use></svg>';

/* ── Custom selects ─────────────────────────────────────────────────────── */

function refreshSelect(select) {
  const wrap = select.closest('.select');
  if (!wrap) return;
  const label = wrap.querySelector('[data-select-label]');
  const selected = select.options[select.selectedIndex];
  if (label) label.textContent = selected ? selected.textContent : '';
  wrap.querySelectorAll('.select__option').forEach((option) => {
    option.setAttribute('aria-selected', String(option.dataset.value === select.value));
  });
}

function buildSelect(select) {
  if (select.dataset.enhanced === 'true') return;
  select.dataset.enhanced = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'select';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  let labelId = '';
  const label = document.querySelector(`label[for="${select.id}"]`);
  if (label) {
    if (!label.id) label.id = `${select.id}Label`;
    labelId = label.id;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'select__button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  if (labelId) button.setAttribute('aria-labelledby', labelId);
  button.innerHTML = `<span class="select__label" data-select-label></span>${SELECT_ICON}`;
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  const popover = document.createElement('div');
  popover.className = 'select__popover';
  popover.setAttribute('role', 'listbox');
  popover.hidden = true;

  const rebuild = () => {
    popover.replaceChildren();
    Array.from(select.options).forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'select__option';
      item.setAttribute('role', 'option');
      item.dataset.value = option.value;
      item.innerHTML = `<span></span><span class="select__tick">${CHECK_ICON}</span>`;
      item.querySelector('span').textContent = option.textContent;
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        refreshSelect(select);
        close();
      });
      popover.appendChild(item);
    });
  };

  const open = () => {
    document.querySelectorAll('.select[data-open="true"]').forEach((other) => {
      other.dataset.open = 'false';
      other.querySelector('.select__popover').hidden = true;
      other.querySelector('.select__button').setAttribute('aria-expanded', 'false');
    });
    rebuild();
    refreshSelect(select);
    wrap.dataset.open = 'true';
    popover.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    popover.querySelector('.select__option[aria-selected="true"]')?.focus();
  };

  const close = () => {
    wrap.dataset.open = 'false';
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', () => (popover.hidden ? open() : close()));
  button.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      open();
    }
    if (event.key === 'Escape') close();
  });
  popover.addEventListener('keydown', (event) => {
    const options = [...popover.querySelectorAll('.select__option')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      options[Math.max(index - 1, 0)]?.focus();
    } else if (event.key === 'Escape') {
      close();
      button.focus();
    }
  });
  select.addEventListener('change', () => refreshSelect(select));

  wrap.appendChild(button);
  wrap.appendChild(popover);
  refreshSelect(select);
}

document.querySelectorAll('select[data-select]').forEach(buildSelect);

document.addEventListener('click', (event) => {
  document.querySelectorAll('.select[data-open="true"]').forEach((wrap) => {
    if (!wrap.contains(event.target)) {
      wrap.dataset.open = 'false';
      const popover = wrap.querySelector('.select__popover');
      if (popover) popover.hidden = true;
      wrap.querySelector('.select__button')?.setAttribute('aria-expanded', 'false');
    }
  });
});
export { refreshSelect };

