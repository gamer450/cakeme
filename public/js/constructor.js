/* ============================================================
   КОНСТРУКТОР ТОРТА — публичная страница
   ============================================================ */

const cState = {
  grouped: { shape: [], weight: [], filling: [], decor: [] },
  selected: {
    shape: null,
    weight: null,
    filling: null,
    decor: []
  },
  total: 0,
  breakdown: []
};

// ============================================================
// 1. Загрузка
// ============================================================
async function initConstructor() {
  const container = document.getElementById('constructor-container');
  if (!container) return;

  try {
    const res = await fetch('/api/constructor/options');
    if (!res.ok) throw new Error('Ошибка загрузки');

    cState.grouped = await res.json();

    // Выбираем по умолчанию или первый
    ['shape', 'weight', 'filling'].forEach(groupKey => {
      const items = cState.grouped[groupKey] || [];
      if (items.length === 0) return;

      const defaultItem = items.find(i => i.is_default === 1) || items[0];
      cState.selected[groupKey] = defaultItem.id;
    });

    renderConstructor();
    recalculate();
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="loading">Не удалось загрузить конструктор</div>
    `;
  }
}

// ============================================================
// 2. Рендер страницы
// ============================================================
function renderConstructor() {
  const container = document.getElementById('constructor-container');
  const g = cState.grouped;

  container.innerHTML = `
    <div class="constructor-layout">
      <!-- ВИЗУАЛИЗАЦИЯ -->
      <aside class="constructor-preview reveal reveal--left">
        <div class="constructor-preview__cake">
          ${renderCakeSvg()}
        </div>

        <div class="constructor-total">
          <span class="constructor-total__label">Итого</span>
          <span class="constructor-total__value" id="total-value">0 ₽</span>
          <span class="constructor-total__hint" id="total-hint">Выберите параметры</span>
          <button class="btn btn-primary btn-lg constructor-total__btn magnetic" id="add-to-cart-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
            </svg>
            Добавить в корзину
          </button>
        </div>
      </aside>

      <!-- ОПЦИИ -->
      <div class="constructor-options reveal reveal--right">
        ${renderGroup('shape', '1', 'Форма', 'Выберите одну', 'radio')}
        ${renderGroup('weight', '2', 'Вес', 'Выберите один', 'radio')}
        ${renderGroup('filling', '3', 'Начинка', 'Выберите одну', 'radio')}
        ${renderGroup('decor', '4', 'Декор', 'Можно несколько', 'checkbox')}
        <div id="check-block"></div>
      </div>
    </div>
  `;

  initOptionEvents();
  initCartBtn();
  initReveal();
}

// ============================================================
// 3. Группа опций
// ============================================================
function renderGroup(groupKey, num, title, hint, type) {
  const items = cState.grouped[groupKey] || [];
  if (items.length === 0) return '';

  return `
    <div class="constructor-group">
      <div class="constructor-group__header">
        <span class="constructor-group__num">${num}</span>
        <h2 class="constructor-group__title">${title}</h2>
        <span class="constructor-group__hint">${hint}</span>
      </div>
      <div class="constructor-group__body">
        ${items.map(item => renderOption(groupKey, item, type)).join('')}
      </div>
    </div>
  `;
}

function renderOption(groupKey, item, type) {
  const isSelected = type === 'radio'
    ? cState.selected[groupKey] === item.id
    : cState.selected[groupKey].includes(item.id);

  const priceText = item.price_modifier > 0
    ? `+${item.price_modifier.toLocaleString('ru-RU')} ₽${item.price_type === 'per_kg' ? '/кг' : ''}`
    : 'Включено';

  return `
    <div class="constructor-option ${isSelected ? 'is-selected' : ''}"
         data-group="${groupKey}"
         data-id="${item.id}"
         data-type="${type}">
      <span class="constructor-option__control ${type === 'checkbox' ? 'constructor-option__control--checkbox' : ''}"></span>
      <div class="constructor-option__info">
        <div class="constructor-option__name">${item.name}</div>
        ${item.description ? `<div class="constructor-option__desc">${item.description}</div>` : ''}
      </div>
      <span class="constructor-option__price ${item.price_modifier === 0 ? 'constructor-option__price--free' : ''}">
        ${priceText}
      </span>
    </div>
  `;
}

// ============================================================
// 4. События выбора
// ============================================================
function initOptionEvents() {
  document.querySelectorAll('.constructor-option').forEach(el => {
    el.addEventListener('click', () => {
      const groupKey = el.dataset.group;
      const id = parseInt(el.dataset.id, 10);
      const type = el.dataset.type;

      if (type === 'radio') {
        // Снимаем выделение с других
        document.querySelectorAll(`.constructor-option[data-group="${groupKey}"]`).forEach(o => {
          o.classList.remove('is-selected');
        });
        el.classList.add('is-selected');
        cState.selected[groupKey] = id;
      } else {
        // Чекбокс — toggle
        const arr = cState.selected[groupKey];
        const idx = arr.indexOf(id);
        if (idx >= 0) {
          arr.splice(idx, 1);
          el.classList.remove('is-selected');
        } else {
          arr.push(id);
          el.classList.add('is-selected');
        }
      }

      // Обновляем SVG (для формы)
      if (groupKey === 'shape' || groupKey === 'filling') {
        const svgEl = document.querySelector('.constructor-preview__svg');
        if (svgEl) {
          svgEl.outerHTML = renderCakeSvg();
        }
      }

      recalculate();
    });
  });
}

// ============================================================
// 5. SVG-торт (динамический)
// ============================================================
function renderCakeSvg() {
  const shapeId = cState.selected.shape;
  const fillingId = cState.selected.filling;
  const decorIds = cState.selected.decor || [];

  // Определяем форму
  const shapeItem = cState.grouped.shape.find(s => s.id === shapeId);
  const shapeName = shapeItem ? shapeItem.name.toLowerCase() : 'круглая';

  // Определяем цвет начинки
  const fillingItem = cState.grouped.filling.find(f => f.id === fillingId);
  const fillingName = fillingItem ? fillingItem.name.toLowerCase() : 'ваниль';

  let cakeColor = '#E8C99B';   // ваниль
  let creamColor = '#F5EDE4';

  if (fillingName.includes('шоколад')) {
    cakeColor = '#5C3A2A';
    creamColor = '#8B6F47';
  } else if (fillingName.includes('фрукт')) {
    cakeColor = '#F0C9A8';
    creamColor = '#FFD5B0';
  } else if (fillingName.includes('орех')) {
    cakeColor = '#A67C4A';
    creamColor = '#D4B36A';
  } else if (fillingName.includes('карамель')) {
    cakeColor = '#C88A4E';
    creamColor = '#E5C57A';
  }

  // Форма
  const isHeart = shapeName.includes('сердц');
  const isSquare = shapeName.includes('квадрат');

  if (isHeart) {
    return `
      <svg class="constructor-preview__svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${creamColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${cakeColor};stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M100,180 C40,130 20,90 40,60 C55,40 80,40 100,65 C120,40 145,40 160,60 C180,90 160,130 100,180 Z"
              fill="url(#topGrad)" stroke="#C9A961" stroke-width="1.5" />
        <path d="M100,150 C60,120 45,95 55,75 C65,60 80,60 100,80 C120,60 135,60 145,75 C155,95 140,120 100,150 Z"
              fill="${creamColor}" opacity="0.5" />
        ${decorIds.length > 0 ? renderDecorDecorations(decorIds) : ''}
      </svg>
    `;
  }

  if (isSquare) {
    return `
      <svg class="constructor-preview__svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:${creamColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${cakeColor};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="40" y="50" width="120" height="120" rx="6"
              fill="url(#topGrad)" stroke="#C9A961" stroke-width="1.5" />
        <rect x="55" y="65" width="90" height="90" rx="4"
              fill="${creamColor}" opacity="0.4" />
        ${decorIds.length > 0 ? renderDecorDecorations(decorIds) : ''}
      </svg>
    `;
  }

  // Круглая (по умолчанию)
  return `
    <svg class="constructor-preview__svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${creamColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${cakeColor};stop-opacity:1" />
        </linearGradient>
        <radialGradient id="topLight" cx="50%" cy="30%" r="50%">
          <stop offset="0%" style="stop-color:#FFF;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#FFF;stop-opacity:0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="145" rx="70" ry="30" fill="${cakeColor}" opacity="0.4" />
      <rect x="30" y="80" width="140" height="65" rx="8"
            fill="url(#topGrad)" stroke="#C9A961" stroke-width="1.5" />
      <ellipse cx="100" cy="80" rx="70" ry="25"
               fill="${creamColor}" stroke="#C9A961" stroke-width="1.5" />
      <ellipse cx="100" cy="80" rx="70" ry="25" fill="url(#topLight)" />
      ${decorIds.length > 0 ? renderDecorDecorations(decorIds) : ''}
    </svg>
  `;
}

function renderDecorDecorations(decorIds) {
  let svg = '';
  const decorItems = cState.grouped.decor.filter(d => decorIds.includes(d.id));

  decorItems.forEach(item => {
    const name = item.name.toLowerCase();

    if (name.includes('свеч')) {
      svg += `
        <rect x="95" y="40" width="4" height="30" fill="#F5EDE4" />
        <ellipse cx="97" cy="38" rx="3" ry="5" fill="#FF8C42" />
        <ellipse cx="97" cy="36" rx="1.5" ry="3" fill="#FFD166" />
      `;
    }
    if (name.includes('ягод')) {
      svg += `
        <circle cx="60" cy="75" r="5" fill="#C84A4A" />
        <circle cx="140" cy="75" r="5" fill="#C84A4A" />
        <circle cx="100" cy="70" r="5" fill="#C84A4A" />
      `;
    }
    if (name.includes('золот')) {
      svg += `
        <circle cx="80" cy="80" r="2" fill="#E5C57A" />
        <circle cx="120" cy="80" r="2" fill="#E5C57A" />
        <circle cx="100" cy="90" r="2" fill="#E5C57A" />
      `;
    }
    if (name.includes('надпис')) {
      svg += `
        <text x="100" y="85" text-anchor="middle" font-family="Georgia, serif" font-size="12"
              font-style="italic" fill="#C87A4D">С праздником!</text>
      `;
    }
  });

  return svg;
}

// ============================================================
// 6. Пересчёт цены
// ============================================================
async function recalculate() {
  const { shape, weight, filling, decor } = cState.selected;

  if (!shape || !weight || !filling) {
    document.getElementById('total-value').textContent = '0 ₽';
    document.getElementById('total-hint').textContent = 'Выберите все параметры';
    return;
  }

  try {
    const res = await fetch('/api/constructor/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shape_id: shape,
        weight_id: weight,
        filling_id: filling,
        decor_ids: decor
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка расчёта');

    cState.total = data.total;
    cState.breakdown = data.breakdown;

    updateTotalDisplay();
    updateCheckBlock();
  } catch (err) {
    console.error('Ошибка расчёта:', err);
  }
}

function updateTotalDisplay() {
  const valueEl = document.getElementById('total-value');
  const hintEl = document.getElementById('total-hint');

  valueEl.classList.add('is-updating');
  valueEl.textContent = `${cState.total.toLocaleString('ru-RU')} ₽`;

  const weightName = cState.grouped.weight.find(w => w.id === cState.selected.weight)?.name || '';
  hintEl.textContent = `Торт ${weightName}`;

  setTimeout(() => valueEl.classList.remove('is-updating'), 300);
}

function updateCheckBlock() {
  const block = document.getElementById('check-block');
  if (!block) return;

  if (cState.breakdown.length === 0) {
    block.innerHTML = '';
    return;
  }

  block.innerHTML = `
    <div class="constructor-check">
      <div class="constructor-check__title">Детали расчёта</div>
      ${cState.breakdown.map(item => `
        <div class="constructor-check__row">
          <span>${item.name}</span>
          <strong>${item.price.toLocaleString('ru-RU')} ₽</strong>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// 7. Добавление в корзину
// ============================================================
function initCartBtn() {
  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
    if (!cState.selected.shape || !cState.selected.weight || !cState.selected.filling) {
      showToast('Выберите форму, вес и начинку');
      return;
    }

    // Собираем название торта
    const shapeName = cState.grouped.shape.find(s => s.id === cState.selected.shape)?.name || '';
    const weightName = cState.grouped.weight.find(w => w.id === cState.selected.weight)?.name || '';
    const fillingName = cState.grouped.filling.find(f => f.id === cState.selected.filling)?.name || '';
    const decorNames = cState.grouped.decor
      .filter(d => cState.selected.decor.includes(d.id))
      .map(d => d.name)
      .join(', ');

    const customCake = {
      id: 'custom-' + Date.now(),
      name: `Индивидуальный торт`,
      description: `Форма: ${shapeName} · Вес: ${weightName} · Начинка: ${fillingName}${decorNames ? ' · Декор: ' + decorNames : ''}`,
      price: cState.total,
      weight: weightName,
      image: '',
      isCustom: true,
      params: {
        shape: shapeName,
        weight: weightName,
        filling: fillingName,
        decor: decorNames
      }
    };

    // Кладём в localStorage корзины
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push({
      productId: customCake.id,
      quantity: 1,
      customData: customCake
    });
    localStorage.setItem('cart', JSON.stringify(cart));

    // Обновляем бейдж
    const badge = document.getElementById('cart-badge');
    if (badge) {
      const count = cart.reduce((s, i) => s + i.quantity, 0);
      badge.textContent = count;
      badge.style.display = 'flex';
    }

    showToast('Индивидуальный торт добавлен в корзину');
  });
}

// ============================================================
// 8. Reveal
// ============================================================
function initReveal() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      obs.observe(el);
    });
  });
}

// ============================================================
// 9. Toast (если не определён)
// ============================================================
if (typeof showToast !== 'function') {
  window.showToast = function(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  };
}

// ============================================================
// 10. СТАРТ
// ============================================================
document.addEventListener('DOMContentLoaded', initConstructor);