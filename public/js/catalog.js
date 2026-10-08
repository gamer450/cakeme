/* ============================================
   КАТАЛОГ — Фильтры, сортировка, поиск
   ============================================ */

const state = {
  allProducts: [],
  categories: [],
  activeCategory: 'all',
  activeType: null,
  search: '',
  sort: 'new'
};

// ============================================
// 1. Загрузка данных
// ============================================
async function loadData() {
  const grid = document.getElementById('products-grid');

  try {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/categories')
    ]);

    state.allProducts = await productsRes.json();
    // ✅ ФИКС: кэш для проверки остатков
    window.__PRODUCTS_CACHE = state.allProducts;
    state.categories = await categoriesRes.json();

    renderCategoryFilters();
    applyUrlParams();
    applyFilters();
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    if (grid) {
      grid.innerHTML = '<p class="text-center">Не удалось загрузить товары. Обновите страницу.</p>';
    }
  }
}

// ============================================
// 2. Параметры из URL (?type=cake, ?category=1)
// ============================================
function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);

  const type = params.get('type');
  if (type) {
    state.activeType = type;
    state.activeCategory = 'all';

    const title = document.getElementById('page-title');
    const desc = document.getElementById('page-desc');
    const breadcrumb = document.getElementById('breadcrumb-current');

    if (type === 'cake') {
      if (title) title.textContent = 'Торты и пирожные';
      if (desc) desc.textContent = 'Домашние торты и пирожные на заказ. Готовим вручную из натуральных ингредиентов.';
      if (breadcrumb) breadcrumb.textContent = 'Торты и пирожные';
    } else if (type === 'coffee') {
      if (title) title.textContent = 'Кофе и чай';
      if (desc) desc.textContent = 'Свежеобжаренный кофе и отборный чай. Обжариваем небольшими партиями.';
      if (breadcrumb) breadcrumb.textContent = 'Кофе и чай';
    }

    document.querySelectorAll('.filter-cat').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.type === type);
    });
  }

  const categoryId = params.get('category');
  if (categoryId) {
    state.activeCategory = categoryId;
    document.querySelectorAll('.filter-cat').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.cat === categoryId);
    });
  }

  const searchParam = params.get('search');
  if (searchParam) {
    state.search = searchParam;
    const input = document.getElementById('search-input');
    if (input) input.value = searchParam;
  }
}

// ============================================
// 3. Рендер кнопок категорий
// ============================================
function renderCategoryFilters() {
  const container = document.getElementById('filters-cats');
  if (!container) return;

  const buttons = state.categories.map(cat => `
    <button class="filter-cat" data-cat="${cat.id}" data-type="${cat.type}">
      ${cat.name}
    </button>
  `).join('');

  container.innerHTML = `
    <button class="filter-cat is-active" data-cat="all">Все</button>
    ${buttons}
  `;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-cat');
    if (!btn) return;

    container.querySelectorAll('.filter-cat').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    state.activeCategory = btn.dataset.cat;
    state.activeType = null;
    applyFilters();
  });
}

// ============================================
// 4. Основная логика фильтрации + сортировки
// ============================================
function applyFilters() {
  let result = [...state.allProducts];

  if (state.activeCategory && state.activeCategory !== 'all') {
    result = result.filter(p => String(p.category_id) === String(state.activeCategory));
  }

  if (state.activeType) {
    result = result.filter(p => p.category_type === state.activeType);
  }

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  switch (state.sort) {
    case 'price-asc':
      result.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      result.sort((a, b) => b.price - a.price);
      break;
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      break;
    case 'new':
    default:
      result.sort((a, b) => b.id - a.id);
  }

  renderProducts(result);
  updateCount(result.length);
  updateResetButton();
}

// ============================================
// 5. Отрисовка товаров
// ============================================
function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (products.length === 0) {
    grid.className = '';
    grid.innerHTML = `
      <div class="empty">
        <div class="empty__icon">🔍</div>
        <h3 class="empty__title">Ничего не найдено</h3>
        <p class="empty__text">Попробуйте изменить фильтры или сбросить поиск</p>
        <button class="btn btn-primary" id="empty-reset">Сбросить фильтры</button>
      </div>
    `;
    document.getElementById('empty-reset')?.addEventListener('click', resetFilters);
    return;
  }

  grid.className = 'grid grid--4';
  grid.innerHTML = products.map((p, i) => {
    const isCoffee = p.category_type === 'coffee';
        // ✅ Проверяем избранное
    let isFav = false;
    try {
      const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
      isFav = favs.includes(p.id);
    } catch {}

        // ✅ ФИКС: проверяем остаток
    const isOutOfStock = p.track_stock === 1 && p.stock === 0;
    const stockBadge = isOutOfStock
      ? '<span class="badge badge--danger product-card__badge">Нет в наличии</span>'
      : '';
    // Фото или SVG-иконка
    const imageHtml = p.image
      ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
      : `<span class="product-card__image-fallback">
          ${isCoffee
            ? `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
                 <path d="M6 1v3M10 1v3M14 1v3"/>
               </svg>`
            : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/>
                 <path d="M10 15h4M10 18h4"/>
               </svg>`
          }
         </span>`;

    return `
      <a href="/product.html?id=${p.id}" class="product-card ${isCoffee ? 'product-card--coffee' : ''} reveal" data-delay="${Math.min(i + 1, 6)}">
        <div class="product-card__image">
          ${stockBadge}
          ${imageHtml}
        </div>
        <div class="product-card__body">
          <span class="product-card__category">${escapeHtml(p.category_name)}</span>
          <h3 class="product-card__title">${escapeHtml(p.name)}</h3>
          <p class="product-card__desc">${escapeHtml(p.description || '')}</p>
          <div class="product-card__footer">
            <div>
              <div class="product-card__price">${p.price} ₽</div>
              <div class="product-card__weight">${p.weight || ''}</div>
            </div>
                        <button class="product-card__fav ${isFav ? 'is-active' : ''}" data-favorite="${p.id}" aria-label="В избранное">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            </button>
            <button class="product-card__btn" data-add-to-cart="${p.id}" ${isOutOfStock ? 'disabled' : ''} aria-label="В корзину">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>
            </button>
          </div>
        </div>
      </a>
    `;
  }).join('');

  // Анимация появления
  // ✅ ФИКС: сразу показываем
  requestAnimationFrame(() => {
    grid.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
  });
}

// ============================================
// 6. Счётчик и кнопка сброса
// ============================================
function updateCount(count) {
  const el = document.getElementById('catalog-count');
  if (!el) return;

  const word = declOfNum(count, ['товар', 'товара', 'товаров']);
  el.innerHTML = `Найдено: <strong>${count}</strong> ${word}`;
}

function updateResetButton() {
  const btn = document.getElementById('reset-btn');
  if (!btn) return;

  const hasFilters =
    state.activeCategory !== 'all' ||
    state.activeType !== null ||
    state.search.trim() !== '';

  btn.classList.toggle('hidden', !hasFilters);
}

function declOfNum(n, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[
    (n % 100 > 4 && n % 100 < 20) ? 2 : cases[(n % 10 < 5) ? n % 10 : 5]
  ];
}

// ============================================
// 7. События
// ============================================

// Поиск (с задержкой 300мс, чтобы не дёргать на каждый символ)
let searchTimer;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'search-input') return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value;
    applyFilters();
  }, 300);
});

// Сортировка
document.addEventListener('change', (e) => {
  if (e.target.id !== 'sort-select') return;
  state.sort = e.target.value;
  applyFilters();
});

// Кнопка сброса
document.addEventListener('click', (e) => {
  if (e.target.id === 'reset-btn') {
    resetFilters();
  }
});

function resetFilters() {
  state.activeCategory = 'all';
  state.activeType = null;
  state.search = '';
  state.sort = 'new';

  const input = document.getElementById('search-input');
  if (input) input.value = '';

  const sort = document.getElementById('sort-select');
  if (sort) sort.value = 'new';

  document.querySelectorAll('.filter-cat').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.cat === 'all');
  });

  // Очищаем URL
  window.history.replaceState({}, '', '/catalog.html');

  // Сброс заголовка
  const title = document.getElementById('page-title');
  const desc = document.getElementById('page-desc');
  const breadcrumb = document.getElementById('breadcrumb-current');
  if (title) title.textContent = 'Каталог';
  if (desc) desc.textContent = 'Все наши торты, пирожные и свежеобжаренный кофе в одном месте';
  if (breadcrumb) breadcrumb.textContent = 'Каталог';

  applyFilters();
}

// ============================================
// 8. Скролл — стики-эффект фильтров
// ============================================
(function initFiltersSticky() {
  const filters = document.getElementById('filters');
  if (!filters) return;

  window.addEventListener('scroll', () => {
    const rect = filters.getBoundingClientRect();
    filters.classList.toggle('is-stuck', rect.top <= 80 && rect.bottom > 0);
  }, { passive: true });
})();

// ============================================
// 9. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', loadData);