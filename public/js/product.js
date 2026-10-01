/* ============================================
   СТРАНИЦА ТОВАРА
   ============================================ */

const state = {
  product: null,
  quantity: 1
};

// ============================================
// 1. Загрузка товара
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
// 2. Рендер
// ============================================
function renderProduct() {
  const p = state.product;
  const container = document.getElementById('product-container');
  const isCoffee = p.category_type === 'coffee';

  document.title = `${p.name} — Cake.Me`;

  // SVG-иконка (если нет фото)
  const svgIcon = isCoffee
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/><path d="M10 15h4M10 18h4"/></svg>`;

  const mainImage = p.image
    ? `<img src="${p.image}" alt="${p.name}" />`
    : `<div class="product-gallery__placeholder">${svgIcon}</div>`;

  // Миниатюры (4 — если фото есть, показываем одно и то же; если нет — SVG)
  const thumbs = p.image
    ? Array(4).fill(p.image).map((img, i) => `
        <div class="product-gallery__thumb ${i === 0 ? 'is-active' : ''}">
          <img src="${img}" alt="${p.name} ${i + 1}" />
        </div>
      `).join('')
    : Array(4).fill(0).map((_, i) => `
        <div class="product-gallery__thumb ${i === 0 ? 'is-active' : ''}">
          ${svgIcon}
        </div>
      `).join('');

  container.innerHTML = `
    <div class="product-view">
      <!-- ГАЛЕРЕЯ -->
      <div class="product-gallery reveal reveal--left">
        <div class="product-gallery__main" id="gallery-main">
          ${mainImage}
        </div>
        <div class="product-gallery__thumbs">
          ${thumbs}
        </div>
      </div>

      <!-- ИНФОРМАЦИЯ -->
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
          <button class="btn btn-primary btn-lg magnetic" id="add-to-cart-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
            </svg>
            Добавить в корзину
          </button>
        </div>

        <div class="product-info__features">
          <div class="product-info__feature">
            <div class="product-info__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
            </div>
            <span class="product-info__feature-text">Натуральный состав</span>
          </div>
          <div class="product-info__feature">
            <div class="product-info__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="8" x="2" y="3" rx="2"/>
                <path d="M6 3v8M10 3v8M14 3v8M18 3v8M6 11v10M14 11v10"/>
              </svg>
            </div>
            <span class="product-info__feature-text">Доставка 24ч</span>
          </div>
          <div class="product-info__feature">
            <div class="product-info__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            </div>
            <span class="product-info__feature-text">Свежая выпечка</span>
          </div>
        </div>
      </div>
    </div>

    <section class="similar" id="similar-section" style="display:none">
      <div class="similar__header">
        <span class="eyebrow eyebrow--center">может понравиться</span>
        <h2 class="similar__title">Похожие <em>товары</em></h2>
      </div>
      <div class="grid grid--4" id="similar-grid"></div>
    </section>
  `;

  initQty();
  initAddToCart();
  initGallery();
  initReveal();
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
      priceDisplay.textContent = `${state.product.price * state.quantity} ₽`;
    }
    minus.disabled = state.quantity <= 1;
  };

  minus.addEventListener('click', () => {
    if (state.quantity > 1) { state.quantity--; update(); }
  });
  plus.addEventListener('click', () => {
    if (state.quantity < 20) { state.quantity++; update(); }
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

  const badge = document.getElementById('cart-badge');
  if (badge) {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = count;
    badge.style.display = 'flex';
  }
}

// ============================================
// 5. Галерея (переключение)
// ============================================
function initGallery() {
  const main = document.getElementById('gallery-main');
  const thumbs = document.querySelectorAll('.product-gallery__thumb');
  if (!main || !thumbs.length) return;

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('is-active'));
      thumb.classList.add('is-active');

      // Если в миниатюре картинка — показываем её в главной
      const img = thumb.querySelector('img');
      if (img) {
        main.innerHTML = `<img src="${img.src}" alt="${img.alt}" />`;
      }
    });
  });
}

// ============================================
// 6. Похожие товары
// ============================================
async function loadSimilar() {
  try {
    const res = await fetch(`/api/products?category_id=${state.product.category_id}`);
    const products = await res.json();
    const similar = products.filter(p => p.id !== state.product.id).slice(0, 4);

    if (similar.length === 0) return;

    const section = document.getElementById('similar-section');
    const grid = document.getElementById('similar-grid');
    if (!section || !grid) return;

    section.style.display = 'block';

    grid.innerHTML = similar.map((p, i) => {
      const isCoffee = p.category_type === 'coffee';
      const imageHtml = p.image
        ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
        : `<span class="product-card__image-fallback">
            ${isCoffee
              ? `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
              : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/><path d="M10 15h4M10 18h4"/></svg>`
            }
           </span>`;

      return `
        <a href="/product.html?id=${p.id}" class="product-card ${isCoffee ? 'product-card--coffee' : ''} reveal" data-delay="${i + 1}">
          <div class="product-card__image">${imageHtml}</div>
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
      `;
    }).join('');

    initReveal();
  } catch (err) {
    console.error('Ошибка загрузки похожих:', err);
  }
}

// ============================================
// 7. Reveal-анимации
// ============================================
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

// ============================================
// 8. 404
// ============================================
function showNotFound(message) {
  const container = document.getElementById('product-container');
  if (!container) return;

  container.innerHTML = `
    <div class="not-found">
      <div class="not-found__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
      </div>
      <h1 class="not-found__title">${message}</h1>
      <p class="not-found__text">Проверьте ссылку или вернитесь в каталог</p>
      <a href="/catalog.html" class="btn btn-primary btn-lg magnetic">Перейти в каталог</a>
    </div>
  `;
}

// ============================================
// 9. Toast (если не определён)
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
// 10. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', loadProduct);