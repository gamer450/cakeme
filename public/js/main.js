/* ============================================
   СЛАДКИЙ ДОМ — главный скрипт
   ============================================ */

// ============================================
// 1. ШАПКА ПРИ СКРОЛЛЕ
// ============================================
(function initHeaderScroll() {
  const header = document.getElementById('header');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ============================================
// 2. МОБИЛЬНОЕ МЕНЮ
// ============================================
(function initBurger() {
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (!burger || !nav) return;

  burger.addEventListener('click', () => {
    burger.classList.toggle('is-open');
    nav.classList.toggle('is-open');
  });

  // Закрываем при клике по ссылке
  nav.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('is-open');
      nav.classList.remove('is-open');
    });
  });
})();

// ============================================
// 3. АНИМАЦИЯ ПОЯВЛЕНИЯ ПРИ СКРОЛЛЕ
// ============================================
(function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  elements.forEach(el => observer.observe(el));
})();

// ============================================
// 4. ПЛАВНЫЙ СКРОЛЛ ДЛЯ ЯКОРЕЙ (#about, #contacts)
// ============================================
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      const hash = href.startsWith('/#') ? href.slice(1) : href;
      if (!hash.startsWith('#')) return;

      const target = document.querySelector(hash);
      if (!target) return;

      e.preventDefault();
      const headerHeight = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

// ============================================
// 5. ЗАГРУЗКА КАТЕГОРИЙ
// ============================================
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();

    const iconFor = (type) => {
      if (type === 'cake') return '🍰';
      if (type === 'coffee') return '☕';
      return '🎁';
    };

    grid.className = 'categories-grid';
    grid.innerHTML = categories.map((cat, i) => `
      <a href="/catalog.html?category=${cat.id}" class="category-card reveal" data-delay="${i + 1}" data-type="${cat.type}">
        <div class="category-card__icon">${iconFor(cat.type)}</div>
        <h3 class="category-card__title">${cat.name}</h3>
        <span class="category-card__arrow">→</span>
      </a>
    `).join('');

    // Перезапускаем observer для новых элементов
    document.querySelectorAll('.category-card.reveal').forEach(el => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      observer.observe(el);
    });
  } catch (err) {
    console.error('Ошибка загрузки категорий:', err);
    grid.innerHTML = '<p class="text-center">Не удалось загрузить категории</p>';
  }
}

// ============================================
// 6. ЗАГРУЗКА ТОВАРОВ
// ============================================
async function loadProducts() {
  const bestsellersGrid = document.getElementById('bestsellers-grid');
  const coffeeGrid = document.getElementById('coffee-grid');

  try {
    const res = await fetch('/api/products');
    const products = await res.json();

    // Разделяем на торты и кофе
    const cakes = products.filter(p => p.category_type === 'cake').slice(0, 4);
    const coffee = products.filter(p => p.category_type === 'coffee').slice(0, 4);

    if (bestsellersGrid) {
      bestsellersGrid.className = 'grid grid--4';
      bestsellersGrid.innerHTML = cakes.map((p, i) => renderCard(p, i, false)).join('');
    }

    if (coffeeGrid) {
      coffeeGrid.className = 'grid grid--4';
      coffeeGrid.innerHTML = coffee.map((p, i) => renderCard(p, i, true)).join('');
    }

    // Анимация появления для новых карточек
    document.querySelectorAll('.product-card.reveal').forEach(el => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      observer.observe(el);
    });

    // Обновляем бейдж корзины
    updateCartBadge();
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
    if (bestsellersGrid) bestsellersGrid.innerHTML = '<p class="text-center">Не удалось загрузить товары</p>';
    if (coffeeGrid) coffeeGrid.innerHTML = '<p class="text-center">Не удалось загрузить товары</p>';
  }
}

// ============================================
// 7. ШАБЛОН КАРТОЧКИ ТОВАРА
// ============================================
function renderCard(product, index, isCoffee) {
  const badge = product.stock < 10
    ? '<span class="product-card__badge product-card__badge--hot">Мало!</span>'
    : (index === 0 ? '<span class="product-card__badge">Хит</span>' : '');

  const cardClass = isCoffee ? 'product-card product-card--coffee reveal' : 'product-card reveal';

  return `
    <a href="/product.html?id=${product.id}" class="${cardClass}" data-delay="${index + 1}">
      <div class="product-card__image">
        ${badge}
        <div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:4rem;">
          ${isCoffee ? '☕' : '🎂'}
        </div>
      </div>
      <div class="product-card__body">
        <span class="product-card__category">${product.category_name}</span>
        <h3 class="product-card__title">${product.name}</h3>
        <p class="product-card__desc">${product.description || ''}</p>
        <div class="product-card__footer">
          <div>
            <div class="product-card__price">${product.price} ₽</div>
            <div class="product-card__weight">${product.weight || ''}</div>
          </div>
          <button class="product-card__btn" data-add-to-cart="${product.id}" aria-label="В корзину">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14"></path>
              <path d="M5 12h14"></path>
            </svg>
          </button>
        </div>
      </div>
    </a>
  `;
}

// ============================================
// 8. КОРЗИНА (localStorage)
// ============================================
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  saveCart(cart);
  showToast('Добавлено в корзину ✨');
}

// Делегирование клика по кнопке "в корзину"
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add-to-cart]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const id = parseInt(btn.dataset.addToCart, 10);
  addToCart(id);
});

// ============================================
// 9. ПРОСТОЙ TOAST
// ============================================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// ============================================
// 10. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  loadCategories();
  loadProducts();
});