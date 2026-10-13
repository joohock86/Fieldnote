const customerSuggestions = (() => {
  const key = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();

  function matches(query, names) {
    const search = key(query);
    if (!search) return [];
    const customers = new Map();
    for (const value of names) {
      const name = String(value ?? '').trim();
      if (name && !customers.has(key(name))) customers.set(key(name), name);
    }
    const words = search.split(' ');
    return [...customers].filter(([name]) => words.every(word => name.includes(word)))
      .sort(([a], [b]) => Number(b.startsWith(search)) - Number(a.startsWith(search)) || a.localeCompare(b))
      .slice(0, 8).map(([, name]) => name);
  }

  function attach(input, names) {
    if (!input || input.dataset.customerSuggestions) return;
    input.dataset.customerSuggestions = 'true';
    const container = input.closest('.field');
    container.classList.add('customer-suggestion-field');
    const list = document.createElement('ul');
    list.id = input.id + '-suggestions';
    list.className = 'customer-suggestion-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Existing customers');
    list.hidden = true;
    input.after(list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');
    let suggestions = [], active = -1;

    function hide() {
      list.hidden = true;
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function highlight(index) {
      active = index;
      [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
      if (active >= 0) {
        input.setAttribute('aria-activedescendant', list.children[active].id);
        list.children[active].scrollIntoView({block:'nearest'});
      } else input.removeAttribute('aria-activedescendant');
    }

    function choose(index) {
      input.value = suggestions[index];
      input.focus();
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      hide();
    }

    function refresh() {
      suggestions = matches(input.value, names);
      list.replaceChildren();
      active = -1;
      input.removeAttribute('aria-activedescendant');
      suggestions.forEach((name, i) => {
        const option = document.createElement('li');
        option.id = list.id + '-' + i;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.textContent = name;
        option.addEventListener('click', () => choose(i));
        list.append(option);
      });
      list.hidden = suggestions.length === 0;
      input.setAttribute('aria-expanded', String(suggestions.length > 0));
    }

    list.addEventListener('mousedown', event => event.preventDefault());
    input.addEventListener('input', event => event.isComposing ? hide() : refresh());
    input.addEventListener('compositionend', refresh);
    input.addEventListener('focus', refresh);
    input.addEventListener('blur', () => setTimeout(() => {
      if (document.activeElement !== input) hide();
    }, 150));
    input.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (list.hidden) refresh();
        if (!suggestions.length) return;
        event.preventDefault();
        highlight(event.key === 'ArrowDown' ? (active + 1) % suggestions.length : (active <= 0 ? suggestions.length - 1 : active - 1));
      } else if (event.key === 'Enter' && !list.hidden && active >= 0) {
        event.preventDefault();
        choose(active);
      } else if (event.key === 'Escape' && !list.hidden) {
        event.preventDefault();
        event.stopPropagation();
        hide();
      } else if (event.key === 'Tab') hide();
    });
  }

  return {matches, attach};
})();
