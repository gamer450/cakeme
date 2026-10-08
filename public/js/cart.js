/* ============================================
   КОРЗИНА
   ============================================ */

// Значения доставки (обновляются из настроек)
let DELIVERY_PRICE = 300;
let FREE_DELIVERY_FROM = 3000;

function updateDeliveryFromSettings() {
  if (window.SITE_SETTINGS && window.SITE_SETTINGS.loaded) {
    DELIVERY_PRICE = parseInt(window.SITE_SETTINGS.delivery_price, 10) || 300;
    FREE_DELIVERY_FROM = parseInt(window.SITE_SETTINGS.free_delivery_from, 10) || 3000;
  }
}

function waitForSettings() {
  return new Promise((resolve) => {
    if (window.SITE_SETTINGS && window.SITE_SETTINGS.loaded) {
      resolve();
      return;
    }
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      if ((window.SITE_SETTINGS && window.SITE_SETTINGS.loaded) || checks > 30) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

// Состояние
const state = {
  cart: [],
  products: [],
  items: [],
  customItems: []
};


// ============================================
// 1. Инициализация
// ============================================
async function init() {
  await waitForSettings();
  updateDeliveryFromSettings();

  try {
    state.cart = JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    state.cart = [];
  }

  if (state.cart.length === 0) {
    renderEmpty();
    return;
  }

  try {
    const res = await fetch('/api/products');
    state.products = await res.json();

    // ✅ Разделяем: обычные товары и кастомные торты
    state.items = [];
    state.customItems = [];

    state.cart.forEach(item => {
      // 🎂 Кастомный торт из конструктора
      if (item.customData) {
        state.customItems.push({
          id: item.productId,
          quantity: item.quantity,
          subtotal: (item.customData.price || 0) * item.quantity,
          isCustom: true,
          ...item.customData
        });
        return;
      }

      // 🍰 Обычный товар
      const product = state.products.find(p => p.id === item.productId);
      if (!product) return;

      state.items.push({
        ...product,
        quantity: item.quantity,
        subtotal: product.price * item.quantity
      });
    });

    if (state.items.length === 0 && state.customItems.length === 0) {
      renderEmpty();
      return;
    }

    renderCart();
  } catch (err) {
    console.error('Ошибка загрузки корзины:', err);
    document.getElementById('cart-container').innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        <h2 class="cart-empty__title">Не удалось загрузить корзину</h2>
        <p class="cart-empty__text">Проверьте соединение и обновите страницу</p>
        <a href="/catalog.html" class="btn btn-primary btn-lg magnetic">Перейти в каталог</a>
      </div>
    `;
  }
}
// ============================================
// 2. Пустая корзина
// ============================================
function renderEmpty() {
  const container = document.getElementById('cart-container');
  container.innerHTML = `
    <div class="cart-empty">
      <div class="cart-empty__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="21" r="1"></circle>
          <circle cx="19" cy="21" r="1"></circle>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
        </svg>
      </div>
      <h2 class="cart-empty__title">Корзина пуста</h2>
      <p class="cart-empty__text">Загляните в каталог — там много вкусного</p>
      <a href="/catalog.html" class="btn btn-primary btn-lg magnetic">Перейти в каталог</a>
    </div>
  `;
}

// ============================================
// 3. Рендер корзины
// ============================================
function renderCart() {
  const container = document.getElementById('cart-container');

  // ✅ Учитываем и обычные, и кастомные
  const itemsCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const customCount = state.customItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalCount = itemsCount + customCount;

  const itemsSubtotal = state.items.reduce((sum, i) => sum + i.subtotal, 0);
  const customSubtotal = state.customItems.reduce((sum, i) => sum + i.subtotal, 0);
  const subtotal = itemsSubtotal + customSubtotal;

  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;

  // ✅ Промокод из localStorage
  const appliedPromo = JSON.parse(localStorage.getItem('applied_promo') || 'null');
  const discount = appliedPromo ? appliedPromo.discount : 0;
  const total = subtotal + delivery - discount;
  const toFree = Math.max(0, FREE_DELIVERY_FROM - subtotal);
  const progress = Math.min(100, (subtotal / FREE_DELIVERY_FROM) * 100);

  container.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items" id="cart-items">
        ${state.items.map(item => renderCartItem(item)).join('')}
        ${state.customItems.map(item => renderCustomCartItem(item)).join('')}
      </div>

      <aside class="cart-summary">
        <h2 class="cart-summary__title">Ваш заказ</h2>

        <div class="cart-summary__row cart-summary__row--muted">
          <span>Товаров:</span>
          <span>${totalCount} шт</span>
        </div>

        <div class="cart-summary__row">
          <span>Сумма:</span>
          <strong>${subtotal.toLocaleString('ru-RU')} ₽</strong>
        </div>

        <div class="cart-summary__row">
          <span>Доставка:</span>
          ${delivery === 0
            ? '<span class="cart-summary__free">Бесплатно</span>'
            : `<strong>${delivery} ₽</strong>`
          }
        </div>
                ${appliedPromo ? `
          <div class="cart-summary__row cart-summary__row--discount">
            <span>Скидка (${appliedPromo.code}):</span>
            <strong class="cart-summary__discount-value">−${discount.toLocaleString('ru-RU')} ₽</strong>
          </div>
        ` : ''}

        ${toFree > 0 ? `
          <div class="cart-summary__progress">
            <div class="cart-summary__progress-text">
              До бесплатной доставки: <strong>${toFree.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div class="cart-summary__progress-bar">
              <div class="cart-summary__progress-fill" style="width:${progress}%"></div>
            </div>
          </div>
        ` : ''}

        <!-- ПРОМОКОД -->
        <div class="cart-summary__promo" id="cart-promo-block">
          <div class="cart-summary__promo-row">
            <input type="text" id="cart-promo-input" placeholder="Промокод" />
            <button class="cart-summary__promo-apply" id="cart-promo-apply">Применить</button>
          </div>
          <div class="cart-summary__promo-result" id="cart-promo-result"></div>
        </div>

        <div class="cart-summary__divider"></div>

        <div class="cart-summary__total">
          <span class="cart-summary__total-label">К оплате</span>
          <span class="cart-summary__total-value">${total.toLocaleString('ru-RU')} ₽</span>
        </div>

        <a href="/checkout.html" class="btn btn-primary btn-lg cart-summary__btn magnetic">
          Оформить заказ
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </a>

        <p class="cart-summary__note">
          Нажимая «Оформить заказ», вы соглашаетесь с условиями обработки персональных данных
        </p>
      </aside>
    </div>

    <!-- ✅ UPSELL -->
    <div class="cart-upsell" id="cart-upsell" style="display:none;">
      <div class="cart-upsell__header">
        <span class="eyebrow">дополните заказ</span>
        <h3 class="cart-upsell__title">Часто берут <em>вместе с тортом</em></h3>
      </div>
      <div class="grid grid--4" id="cart-upsell-grid"></div>
    </div>
  `;

  // ✅ Загружаем upsell-товары
  setTimeout(loadUpsell, 100);
  bindCartEvents();
    // ✅ Промокод
  initPromoBlock();
}

// ============================================
// 4. Один элемент
// ============================================
function renderCartItem(item) {
  const isCoffee = item.category_type === 'coffee';

  const svgIcon = isCoffee
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/><path d="M10 15h4M10 18h4"/></svg>`;

  const imageHtml = item.image
    ? `<img src="${item.image}" alt="${item.name}" />`
    : svgIcon;

  return `
    <div class="cart-item ${isCoffee ? 'is-coffee' : ''}" data-id="${item.id}">
      <div class="cart-item__image">${imageHtml}</div>

      <div class="cart-item__info">
        <span class="cart-item__category">${escapeHtml(item.category_name)}</span>
        <a href="/product.html?id=${item.id}" class="cart-item__title">${escapeHtml(item.name)}</a>
        <span class="cart-item__meta">${escapeHtml(item.weight || '')}</span>
        <span class="cart-item__price">${item.price} ₽ × ${item.quantity} шт</span>
      </div>

      <div class="cart-item__actions">
        <div class="cart-item__qty">
          <button data-action="minus" ${item.quantity <= 1 ? 'disabled' : ''} aria-label="Уменьшить">−</button>
          <span class="cart-item__qty-value">${item.quantity}</span>
          <button data-action="plus" aria-label="Увеличить">+</button>
        </div>

        <span class="cart-item__subtotal">${item.subtotal.toLocaleString('ru-RU')} ₽</span>

        <button class="cart-item__remove" data-action="remove" aria-label="Удалить">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// ============================================
// 5. Обработчики
// ============================================
function bindCartEvents() {
  document.querySelectorAll('.cart-item').forEach(el => {
    const idRaw = el.dataset.id;
    // ✅ Если ID начинается с "custom-" — оставляем строкой
    const id = String(idRaw).startsWith('custom-') ? idRaw : parseInt(idRaw, 10);

    el.querySelector('[data-action="plus"]')?.addEventListener('click', () => changeQty(id, +1));
    el.querySelector('[data-action="minus"]')?.addEventListener('click', () => changeQty(id, -1));
    el.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeItem(id));
  });
}

async function changeQty(productId, delta) {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const item = cart.find(i => i.productId === productId);
  if (!item) return;

  item.quantity = Math.max(1, Math.min(20, item.quantity + delta));
  localStorage.setItem('cart', JSON.stringify(cart));

  // Обновляем в обычных товарах
  const local = state.items.find(i => i.id === productId);
  if (local) {
    local.quantity = item.quantity;
    local.subtotal = local.price * item.quantity;
  }

  // Обновляем в кастомных
  const customLocal = state.customItems.find(i => i.id === productId);
  if (customLocal) {
    customLocal.quantity = item.quantity;
    customLocal.subtotal = customLocal.price * item.quantity;
  }

  // ✅ ФИКС: пересчитываем промокод при изменении количества
  await recalcPromo();

  renderCart();
  updateBadge();
}

function removeItem(productId) {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const filtered = cart.filter(i => i.productId !== productId);
  localStorage.setItem('cart', JSON.stringify(filtered));

  state.items = state.items.filter(i => i.id !== productId);
  state.customItems = state.customItems.filter(i => i.id !== productId);
  state.cart = filtered;

  if (state.items.length === 0 && state.customItems.length === 0) {
    renderEmpty();
  } else {
    renderCart();
  }
  updateBadge();
}

async function removeItem(productId) {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const filtered = cart.filter(i => i.productId !== productId);
  localStorage.setItem('cart', JSON.stringify(filtered));

  state.items = state.items.filter(i => i.id !== productId);
  state.cart = filtered;

  // ✅ Пересчитываем промокод, потом рендерим
  await recalcPromo();

  if (state.items.length === 0) {
    renderEmpty();
  } else {
    renderCart();
  }
  updateBadge();
}

function updateBadge() {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ============================================
// Рендер кастомного торта
// ============================================
function renderCustomCartItem(item) {
  return `
    <div class="cart-item cart-item--custom" data-id="${item.id}">
      <div class="cart-item__image">
        <div style="font-size:2.5rem;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">🎂</div>
      </div>

      <div class="cart-item__info">
        <span class="cart-item__category">Индивидуальный заказ</span>
        <a href="/constructor.html" class="cart-item__title">${item.name || 'Индивидуальный торт'}</a>
        <span class="cart-item__meta">${item.description || ''}</span>
        <span class="cart-item__price">${item.price} ₽ × ${item.quantity} шт</span>
      </div>

      <div class="cart-item__actions">
        <div class="cart-item__qty">
          <button data-action="minus" ${item.quantity <= 1 ? 'disabled' : ''} aria-label="Уменьшить">−</button>
          <span class="cart-item__qty-value">${item.quantity}</span>
          <button data-action="plus" aria-label="Увеличить">+</button>
        </div>

        <span class="cart-item__subtotal">${item.subtotal.toLocaleString('ru-RU')} ₽</span>

        <button class="cart-item__remove" data-action="remove" aria-label="Удалить">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// ============================================
// 6. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', init);

// ============================================
// 7. Промокод
// ============================================
function initPromoBlock() {
  const applyBtn = document.getElementById('cart-promo-apply');
  const input = document.getElementById('cart-promo-input');
  const resultBox = document.getElementById('cart-promo-result');
  const block = document.getElementById('cart-promo-block');

  if (!applyBtn || !input) return;

  // Если промокод уже применён — показываем
  const savedPromo = JSON.parse(localStorage.getItem('applied_promo') || 'null');
  if (savedPromo) {
    showAppliedPromo(savedPromo);
  }

  applyBtn.addEventListener('click', async () => {
    const code = input.value.trim();
    if (!code) {
      showPromoError('Введите промокод');
      return;
    }

    applyBtn.disabled = true;
    applyBtn.textContent = '...';

    try {
      const subtotal = state.items.reduce((s, i) => s + i.subtotal, 0);

      const res = await fetch('/api/promocodes/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, order_sum: subtotal })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('applied_promo', JSON.stringify(data));
      showToast(`Промокод применён: −${data.discount.toLocaleString('ru-RU')} ₽`);
      renderCart();
    } catch (err) {
      showPromoError(err.message);
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = 'Применить';
    }
  });

  function showAppliedPromo(promo) {
    if (!resultBox) return;
    resultBox.innerHTML = `
      <div class="cart-summary__promo-tag">
        <span>✓ ${promo.code} — скидка ${promo.discount.toLocaleString('ru-RU')} ₽</span>
        <button class="cart-summary__promo-remove" id="cart-promo-remove">Убрать</button>
      </div>
    `;
    document.getElementById('cart-promo-remove')?.addEventListener('click', () => {
      localStorage.removeItem('applied_promo');
      showToast('Промокод убран');
      renderCart();
    });
  }

  function showPromoError(msg) {
    if (!resultBox) return;
    resultBox.innerHTML = `<div class="cart-summary__promo-error">${msg}</div>`;
    setTimeout(() => {
      if (resultBox) resultBox.innerHTML = '';
    }, 3000);
  }
}
async function recalcPromo() {
  const savedPromo = JSON.parse(localStorage.getItem('applied_promo') || 'null');
  if (!savedPromo) return;

  const subtotal = state.items.reduce((s, i) => s + i.subtotal, 0);

  // Если корзина пуста — удаляем промокод
  if (subtotal === 0) {
    localStorage.removeItem('applied_promo');
    return;
  }

  // Пересчитываем промокод через API
  try {
    const res = await fetch('/api/promocodes/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: savedPromo.code, order_sum: subtotal })
    });

    if (!res.ok) {
      // Промокод больше не подходит — удаляем
      localStorage.removeItem('applied_promo');
      return;
    }

    const data = await res.json();
    // Обновляем скидку в localStorage
    localStorage.setItem('applied_promo', JSON.stringify(data));
  } catch {
    // При ошибке сети — не трогаем промокод
  }
}
// ============================================
// 8. Upsell — «Часто берут вместе»
// ============================================
async function loadUpsell() {
  const wrap = document.getElementById('cart-upsell');
  const grid = document.getElementById('cart-upsell-grid');
  if (!wrap || !grid) return;

  // Собираем ID товаров, уже в корзине
  const inCart = state.items.map(i => i.id);

  try {
    const res = await fetch('/api/products');
    if (!res.ok) return;

    const all = await res.json();

    // Берём 4 товара, которых НЕТ в корзине, с высоким рейтингом (или просто популярные)
    const candidates = all
      .filter(p => !inCart.includes(p.id) && p.is_active !== 0)
      .filter(p => p.track_stock !== 1 || p.stock > 0)
      .slice(0, 4);

    if (candidates.length === 0) return;

    wrap.style.display = 'block';

    grid.innerHTML = candidates.map(p => {
      const isCoffee = p.category_type === 'coffee';
      const imageHtml = p.image
        ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
        : `<div class="product-card__placeholder">
            ${isCoffee
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/><path d="M10 15h4M10 18h4"/></svg>`
            }
          </div>`;

      return `
        <article class="product-card product-card--compact" data-id="${p.id}">
          <a href="/product.html?id=${p.id}" class="product-card__link">
            <div class="product-card__image">${imageHtml}</div>
            <div class="product-card__body">
              <span class="product-card__category">${p.category_name || ''}</span>
              <h4 class="product-card__title" style="font-size:1.05rem;">${p.name}</h4>
              <div class="product-card__footer">
                <div class="product-card__price-wrap">
                  <div class="product-card__price" style="font-size:1.1rem;">${Number(p.price).toLocaleString('ru-RU')} ₽</div>
                </div>
              </div>
            </div>
          </a>
          <button class="product-card__btn btn-add-to-cart"
                  type="button"
                  data-add-to-cart="${p.id}"
                  aria-label="В корзину">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </article>
      `;
    }).join('');

    // Перерисовываем корзину при добавлении upsell-товара
    grid.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const id = parseInt(btn.dataset.addToCart, 10);
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const existing = cart.find(i => i.productId === id);

        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({ productId: id, quantity: 1 });
        }
        localStorage.setItem('cart', JSON.stringify(cart));

        showToast('Добавлено в корзину');
        // Перезагружаем страницу корзины
        setTimeout(() => window.location.reload(), 500);
      });
    });
  } catch (err) {
    console.error('Upsell ошибка:', err);
  }
}