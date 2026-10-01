/* ============================================================
   СЛАДКИЙ ДОМ — главный скрипт
   Шапка, меню, анимации, hero-media, корзина, toast
   ============================================================ */

/* ============================================================
   1. ШАПКА ПРИ СКРОЛЛЕ
   ============================================================ */
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

/* ============================================================
   2. МОБИЛЬНОЕ МЕНЮ
   ============================================================ */
(function initBurger() {
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (!burger || !nav) return;

  burger.addEventListener('click', () => {
    burger.classList.toggle('is-open');
    nav.classList.toggle('is-open');
  });

  nav.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('is-open');
      nav.classList.remove('is-open');
    });
  });
})();

/* ============================================================
   3. ПЛАВНЫЙ СКРОЛЛ ДЛЯ ЯКОРЕЙ
   ============================================================ */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      const hash = href.startsWith('/#') ? href.slice(1) : href;
      if (!hash.startsWith('#')) return;

      const target = document.querySelector(hash);
      if (!target) return;

      e.preventDefault();
      const headerHeight = 90;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

/* ============================================================
   4. ЗАГРУЗКА КАТЕГОРИЙ (для главной страницы)
   ============================================================ */
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();

    const iconFor = (type) => {
      if (type === 'cake') return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/><path d="M10 15h4M10 18h4"/></svg>`;
      if (type === 'coffee') return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`;
      return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
    };

    grid.className = 'categories-grid';
    grid.innerHTML = categories.map((cat, i) => `
      <a href="/catalog.html?category=${cat.id}" class="category-card reveal" data-delay="${i + 1}" data-type="${cat.type}">
        <div class="category-card__icon">${iconFor(cat.type)}</div>
        <h3 class="category-card__title">${cat.name}</h3>
        <span class="category-card__arrow">
          Смотреть
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </span>
      </a>
    `).join('');

    // Анимация появления
    requestAnimationFrame(() => {
      grid.querySelectorAll('.reveal').forEach(el => {
        const obs = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });
        obs.observe(el);
      });
    });
  } catch (err) {
    console.error('Ошибка загрузки категорий:', err);
    grid.innerHTML = '<p class="text-center">Не удалось загрузить категории</p>';
  }
}

/* ============================================================
   5. ЗАГРУЗКА ТОВАРОВ (для главной)
   ============================================================ */
async function loadProducts() {
  const bestsellersGrid = document.getElementById('bestsellers-grid');
  const coffeeGrid = document.getElementById('coffee-grid');

  try {
    const res = await fetch('/api/products');
    const products = await res.json();

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

    requestAnimationFrame(() => {
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
    });

    updateCartBadge();
  } catch (err) {
    console.error('Ошибка загрузки товаров:', err);
  }
}

/* ============================================================
   6. ШАБЛОН КАРТОЧКИ ТОВАРА
   ============================================================ */
function renderCard(product, index, isCoffee) {
  const badge = product.stock < 10
    ? '<span class="product-card__badge product-card__badge--hot">Мало</span>'
    : (index === 0 ? '<span class="product-card__badge">Хит</span>' : '');

  const cardClass = isCoffee ? 'product-card product-card--coffee reveal' : 'product-card reveal';

  const imageHtml = product.image
    ? `<img src="${product.image}" alt="${product.name}" loading="lazy" />`
    : `<span class="product-card__image-fallback">
        ${isCoffee
          ? `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
          : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/><path d="M10 15h4M10 18h4"/></svg>`
        }
       </span>`;

  return `
    <a href="/product.html?id=${product.id}" class="${cardClass}" data-delay="${index + 1}">
      <div class="product-card__image">
        ${badge}
        ${imageHtml}
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

/* ============================================================
   7. КОРЗИНА
   ============================================================ */
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
  showToast('Добавлено в корзину');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add-to-cart]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const id = parseInt(btn.dataset.addToCart, 10);
  addToCart(id);
});

/* ============================================================
   8. TOAST
   ============================================================ */
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

/* ============================================================
   9. HERO: загрузка видео / постера из настроек
   ============================================================ */
async function initHeroMedia() {
  const videoEl = document.getElementById('hero-video');
  const posterEl = document.getElementById('hero-poster');
  const visualEl = document.getElementById('hero-visual');

  if (!videoEl || !posterEl) return;

  // Ждём, пока settings.js загрузит настройки
  await waitForSettings();

  const s = window.SITE_SETTINGS;

  // 1. Постер
  if (s.hero_poster) {
    posterEl.src = s.hero_poster;
    posterEl.style.display = 'block';
  }

  // 2. Видео
  if (s.hero_video) {
    videoEl.src = s.hero_video;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('loop', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.setAttribute('playsinline', '');

    videoEl.addEventListener('loadeddata', () => {
      videoEl.classList.add('is-ready');
      if (visualEl) visualEl.style.opacity = '0.15';

      videoEl.play().catch((err) => {
        console.warn('Автовоспроизведение заблокировано:', err);
      });
    });

    videoEl.addEventListener('ended', () => {
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});
    });

    videoEl.addEventListener('error', () => {
      console.warn('Не удалось загрузить видео:', s.hero_video);
      videoEl.style.display = 'none';
    });

    videoEl.play().catch((err) => {
      console.warn('Автовоспроизведение заблокировано:', err);
    });
  } else if (!s.hero_poster) {
    videoEl.style.display = 'none';
  }

  // 3. Параллакс при скролле
  if (s.hero_video || s.hero_poster) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          const shift = Math.min(scrolled * 0.15, 80);
          videoEl.style.transform = `translateY(${shift}px) scale(${1 + scrolled * 0.0002})`;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
}

// Ждём настройки
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

/* ============================================================
   10. СТАРТ
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  loadCategories();
  loadProducts();
  initHeroMedia();
});