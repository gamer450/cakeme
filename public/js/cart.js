/* ============================================
   КОРЗИНА
   ============================================ */

// Константы
// Константы доставки (обновляются из настроек сайта)
let DELIVERY_PRICE = 300;
let FREE_DELIVERY_FROM = 3000;

// Обновляем из настроек, если загружены
function updateDeliveryFromSettings() {
  if (window.SITE_SETTINGS && window.SITE_SETTINGS.loaded) {
    DELIVERY_PRICE = parseInt(window.SITE_SETTINGS.delivery_price, 10) || 300;
    FREE_DELIVERY_FROM = parseInt(window.SITE_SETTINGS.free_delivery_from, 10) || 3000;
  }
}

// Ждём загрузки настроек
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
  cart: [],         // [{ productId, quantity }]
  products: [],     // полные данные товаров
  items: []         // объединённые данные
};

// ============================================
// 1. Загрузка
// ============================================
async function init() {
  // Читаем корзину из localStorage
  try {
    state.cart = JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    state.cart = [];
  }
    try {
    state.cart = JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    state.cart = [];
  }

  // Пустая корзина
  if (state.cart.length === 0) {
    renderEmpty();
    return;
  }

  // Загружаем все товары
  try {
    const res = await fetch('/api/products');
    state.products = await res.json();

    // Собираем данные для корзины
    state.items = state.cart
      .map(item => {
        const product = state.products.find(p => p.id === item.productId);
        if (!product) return null;
        return {
          ...product,
          quantity: item.quantity,
          subtotal: product.price * item.quantity
        };
      })
      .filter(Boolean);

    // Если ничего не нашли — значит товары удалены
    if (state.items.length === 0) {
      renderEmpty();
      return;
    }

    renderCart();
  } catch (err) {
    console.error('Ошибка загрузки корзины:', err);
    document.getElementById('cart-container').innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty__icon">😕</div>
        <h2 class="cart-empty__title">Не удалось загрузить корзину</h2>
        <p class="cart-empty__text">Проверьте соединение и обновите страницу</p>
        <a href="/catalog.html" class="btn btn-primary btn-lg">Перейти в каталог</a>
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
      <div class="cart-empty__icon">🛒</div>
      <h2 class="cart-empty__title">Корзина пуста</h2>
      <p class="cart-empty__text">Загляните в каталог — там много вкусного!</p>
      <a href="/catalog.html" class="btn btn-primary btn-lg">Перейти в каталог</a>
    </div>
  `;
}

// ============================================
// 3. Рендер корзины
// ============================================
function renderCart() {
  const container = document.getElementById('cart-container');

  const totalCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce((sum, i) => sum + i.subtotal, 0);
  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
  const total = subtotal + delivery;
  const toFree = Math.max(0, FREE_DELIVERY_FROM - subtotal);
  const progress = Math.min(100, (subtotal / FREE_DELIVERY_FROM) * 100);

  container.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items" id="cart-items">
        ${state.items.map(item => renderCartItem(item)).join('')}
      </div>

      <aside class="cart-summary">
        <h2 class="cart-summary__title">Итого</h2>

        <div class="cart-summary__row cart-summary__row--muted">
          <span>Товаров:</span>
          <span>${totalCount} шт</span>
        </div>

        <div class="cart-summary__row">
          <span>Сумма заказа:</span>
          <span><strong>${subtotal.toLocaleString('ru-RU')} ₽</strong></span>
        </div>

        <div class="cart-summary__row">
          <span>Доставка:</span>
          <span>
            ${delivery === 0
              ? '<span class="cart-summary__free">Бесплатно</span>'
              : `<strong>${delivery} ₽</strong>`
            }
          </span>
        </div>

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

        <div class="cart-summary__divider"></div>

        <div class="cart-summary__total">
          <span class="cart-summary__total-label">К оплате:</span>
          <span class="cart-summary__total-value">${total.toLocaleString('ru-RU')} ₽</span>
        </div>

        <a href="/checkout.html" class="btn btn-primary btn-lg cart-summary__btn">
          Оформить заказ
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </a>

        <p class="cart-summary__note">
          Нажимая «Оформить заказ», вы соглашаетесь с условиями обработки персональных данных
        </p>
      </aside>
    </div>
  `;

  // Обработчики
  bindCartEvents();
}

// ============================================
// 4. Один элемент корзины
// ============================================
function renderCartItem(item) {
  const isCoffee = item.category_type === 'coffee';
  const emoji = isCoffee ? '☕' : '🎂';

  return `
    <div class="cart-item ${isCoffee ? 'is-coffee' : ''}" data-id="${item.id}">
      <div class="cart-item__image">${emoji}</div>

      <div class="cart-item__info">
        <span class="cart-item__category">${item.category_name}</span>
        <a href="/product.html?id=${item.id}" class="cart-item__title">${item.name}</a>
        <span class="cart-item__weight">${item.weight || ''}</span>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    const id = parseInt(el.dataset.id, 10);

    el.querySelector('[data-action="plus"]')?.addEventListener('click', () => changeQty(id, +1));
    el.querySelector('[data-action="minus"]')?.addEventListener('click', () => changeQty(id, -1));
    el.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeItem(id));
  });
}

function changeQty(productId, delta) {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const item = cart.find(i => i.productId === productId);
  if (!item) return;

  item.quantity = Math.max(1, Math.min(20, item.quantity + delta));
  localStorage.setItem('cart', JSON.stringify(cart));

  // Обновляем локально
  const local = state.items.find(i => i.id === productId);
  if (local) {
    local.quantity = item.quantity;
    local.subtotal = local.price * item.quantity;
  }

  renderCart();
  updateBadge();
}

function removeItem(productId) {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const filtered = cart.filter(i => i.productId !== productId);
  localStorage.setItem('cart', JSON.stringify(filtered));

  state.items = state.items.filter(i => i.id !== productId);
  state.cart = filtered;

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
// 6. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', init);