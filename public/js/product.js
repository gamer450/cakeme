/* ============================================
   СТРАНИЦА ТОВАРА
   ============================================ */

const state = {
  product: null,
  quantity: 1
};

// ============================================
// 1. Загрузка товара из API
// ============================================
async function loadProduct() {
  const container = document.getElementById('product-container');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    showNotFound('Товар не указан');
    return;
  }

  try {
    const res = await fetch(`/api/products/${id}`);

    if (!res.ok) {
      showNotFound('Товар не найден');
      return;
    }

    state.product = await res.json();
    renderProduct();
    loadSimilar();
  } catch (err) {
    console.error('Ошибка загрузки товара:', err);
    showNotFound('Не удалось загрузить товар');
  }
}

// ============================================
// 2. Рендер страницы товара
// ============================================
function renderProduct() {
  const p = state.product;
  const container = document.getElementById('product-container');
  const isCoffee = p.category_type === 'coffee';
  const emoji = isCoffee ? '☕' : '🎂';

  // Обновляем title страницы
  document.title = `${p.name} — Сладкий Дом`;

  container.innerHTML = `
    <div class="product-view">
      <!-- Галерея -->
      <div class="product-gallery reveal">
        <div class="product-gallery__main ${isCoffee ? 'product-gallery__main--coffee' : ''}">
          <span class="product-gallery__emoji">${emoji}</span>
        </div>
        <div class="product-gallery__thumbs">
          <div class="product-gallery__thumb is-active">${emoji}</div>
          <div class="product-gallery__thumb">📸</div>
          <div class="product-gallery__thumb">🎨</div>
          <div class="product-gallery__thumb">✨</div>
        </div>
      </div>

      <!-- Информация -->
      <div class="product-info reveal reveal--right">
        <div class="product-info__breadcrumbs">
          <a href="/">Главная</a>
          <span class="sep">/</span>
          <a href="/catalog.html?type=${isCoffee ? 'coffee' : 'cake'}">${isCoffee ? 'Кофе и чай' : 'Торты и пирожные'}</a>
          <span class="sep">/</span>
          <span>${p.name}</span>
        </div>

        <span class="product-info__category ${isCoffee ? 'product-info__category--coffee' : ''}">
          ${p.category_name}
        </span>

        <h1 class="product-info__title">${p.name}</h1>
        <p class="product-info__desc">${p.description || ''}</p>

        <div class="product-info__meta">
          <div class="product-info__meta-item">
            <span class="product-info__meta-label">Вес</span>
            <span class="product-info__meta-value">${p.weight || '—'}</span>
          </div>
          <div class="product-info__meta-item">
            <span class="product-info__meta-label">В наличии</span>
            <span class="product-info__meta-value">${p.stock > 0 ? 'Да' : 'Нет'}</span>
          </div>
          <div class="product-info__meta-item">
            <span class="product-info__meta-label">Категория</span>
            <span class="product-info__meta-value">${p.category_name}</span>
          </div>
        </div>

        <div class="product-info__price-block">
          <span class="product-info__price" id="price-display">${p.price} ₽</span>
          <span class="product-info__price-unit">за ${p.weight || 'шт'}</span>
        </div>

        <div class="product-info__qty">
          <span class="product-info__qty-label">Количество:</span>
          <div class="qty-control">
            <button class="qty-control__btn" id="qty-minus" aria-label="Уменьшить">−</button>
            <span class="qty-control__value" id="qty-value">1</span>
            <button class="qty-control__btn" id="qty-plus" aria-label="Увеличить">+</button>
          </div>
        </div>

        <div class="product-info__actions">
          <button class="btn ${isCoffee ? 'btn-coffee' : 'btn-primary'} btn-lg" id="add-to-cart-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
            </svg>
            Добавить в корзину
          </button>
        </div>

        <div class="product-info__features">
          <div class="product-info__feature">
            <span class="product-info__feature-icon">🌿</span>
            <span class="product-info__feature-text">Натуральный состав</span>
          </div>
          <div class="product-info__feature">
            <span class="product-info__feature-icon">🚚</span>
            <span class="product-info__feature-text">Доставка 24ч</span>
          </div>
          <div class="product-info__feature">
            <span class="product-info__feature-icon">💝</span>
            <span class="product-info__feature-text">Свежая выпечка</span>
          </div>
        </div>
      </div>
    </div>

    <section class="similar" id="similar-section" style="display:none">
      <div class="similar__header">
        <span class="section__subtitle">может понравиться</span>
        <h2 class="section__title">Похожие товары</h2>
      </div>
      <div class="grid grid--4" id="similar-grid"></div>
    </section>
  `;

  // Обработчики
  initQty();
  initAddToCart();

  // Анимации появления
  requestAnimationFrame(() => {
    document.querySelectorAll('.reveal').forEach(el => {
      el.classList.add('is-visible');
    });
  });
}

// ============================================
// 3. Количество
// ============================================
function initQty() {
  const minus = document.getElementById('qty-minus');
  const plus = document.getElementById('qty-plus');
  const value = document.getElementById('qty-value');
  const priceDisplay = document.getElementById('price-display');

  if (!minus || !plus || !value) return;

  const update = () => {
    value.textContent = state.quantity;
    if (priceDisplay && state.product) {
      const total = state.product.price * state.quantity;
      priceDisplay.textContent = `${total} ₽`;
    }
    minus.disabled = state.quantity <= 1;
  };

  minus.addEventListener('click', () => {
    if (state.quantity > 1) {
      state.quantity--;
      update();
    }
  });

  plus.addEventListener('click', () => {
    if (state.quantity < 20) {
      state.quantity++;
      update();
    }
  });

  update();
}

// ============================================
// 4. Добавление в корзину
// ============================================
function initAddToCart() {
  const btn = document.getElementById('add-to-cart-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    addToCartWithQty(state.product.id, state.quantity);
    showToast(`Добавлено в корзину: ${state.quantity} шт`);
  });
}

function addToCartWithQty(productId, quantity) {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  localStorage.setItem('cart', JSON.stringify(cart));

  // Обновляем бейдж
  const badge = document.getElementById('cart-badge');
  if (badge) {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = count;
    badge.style.display = 'flex';
  }
}

// ============================================
// 5. Похожие товары
// ============================================
async function loadSimilar() {
  try {
    const res = await fetch(`/api/products?category_id=${state.product.category_id}`);
    const products = await res.json();

    // Убираем текущий товар и берём первые 4
    const similar = products.filter(p => p.id !== state.product.id).slice(0, 4);

    if (similar.length === 0) return;

    const section = document.getElementById('similar-section');
    const grid = document.getElementById('similar-grid');
    if (!section || !grid) return;

    section.style.display = 'block';
    const isCoffee = state.product.category_type === 'coffee';

    grid.innerHTML = similar.map((p, i) => `
      <a href="/product.html?id=${p.id}" class="product-card ${isCoffee ? 'product-card--coffee' : ''} reveal" data-delay="${i + 1}">
        <div class="product-card__image">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:4rem;">
            ${isCoffee ? '☕' : '🎂'}
          </div>
        </div>
        <div class="product-card__body">
          <span class="product-card__category">${p.category_name}</span>
          <h3 class="product-card__title">${p.name}</h3>
          <div class="product-card__footer">
            <div>
              <div class="product-card__price">${p.price} ₽</div>
              <div class="product-card__weight">${p.weight || ''}</div>
            </div>
          </div>
        </div>
      </a>
    `).join('');

    // Анимация
    requestAnimationFrame(() => {
      grid.querySelectorAll('.reveal').forEach(el => {
        const obs = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.05 });
        obs.observe(el);
      });
    });
  } catch (err) {
    console.error('Ошибка загрузки похожих:', err);
  }
}

// ============================================
// 6. 404
// ============================================
function showNotFound(message) {
  const container = document.getElementById('product-container');
  if (!container) return;

  container.innerHTML = `
    <div class="not-found">
      <div class="not-found__icon">🔍</div>
      <h1 class="not-found__title">${message}</h1>
      <p class="not-found__text">Проверьте ссылку или вернитесь в каталог</p>
      <a href="/catalog.html" class="btn btn-primary btn-lg">Перейти в каталог</a>
    </div>
  `;
}

// ============================================
// 7. Toast (если ещё не определён)
// ============================================
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

// ============================================
// 8. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', loadProduct);