/* ============================================
   ИЗБРАННОЕ (Wishlist)
   Хранится в localStorage как массив ID
   ============================================ */

const FAVORITES_KEY = 'favorites';


// ============================================
// 1. Хелперы
// ============================================
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFavorites(ids) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  updateFavoritesBadge();
}

function isFavorite(productId) {
  return getFavorites().includes(Number(productId));
}

function toggleFavorite(productId) {
  const id = Number(productId);
  const favorites = getFavorites();
  const index = favorites.indexOf(id);

  let action;
  if (index >= 0) {
    favorites.splice(index, 1);
    action = 'removed';
  } else {
    favorites.push(id);
    action = 'added';
  }

  saveFavorites(favorites);
  return action;
}

function updateFavoritesBadge() {
  const badge = document.getElementById('favorites-badge');
  if (!badge) return;

  const count = getFavorites().length;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ============================================
// 2. Глобальный обработчик кликов по ❤️
// ============================================
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-favorite]');
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const id = btn.dataset.favorite;
  const action = toggleFavorite(id);

  // Обновляем визуально ВСЕ кнопки для этого товара на странице
  document.querySelectorAll(`[data-favorite="${id}"]`).forEach(b => {
    b.classList.toggle('is-active', action === 'added');
  });

  // Если на странице избранного удалили — перерисовываем
  if (document.getElementById('favorites-grid') && action === 'removed') {
    renderFavoritesPage();
  }

  if (typeof showToast === 'function') {
    showToast(action === 'added' ? 'Добавлено в избранное' : 'Удалено из избранного');
  }
});

// ============================================
// 3. Страница избранного
// ============================================
async function renderFavoritesPage() {
  const grid = document.getElementById('favorites-grid');
  const countEl = document.getElementById('favorites-count');
  const clearBtn = document.getElementById('clear-favorites-btn');

  if (!grid) return;

  const favorites = getFavorites();

  if (favorites.length === 0) {
    countEl.innerHTML = 'Нет сохранённых товаров';
    if (clearBtn) clearBtn.classList.add('hidden');
    grid.className = '';
    grid.innerHTML = `
      <div class="empty">
        <h3 class="empty__title">В избранном пока пусто</h3>
        <p class="empty__text">Нажмите на сердечко на карточке товара, чтобы сохранить</p>
        <a href="/catalog.html" class="btn btn-primary btn-lg magnetic">Перейти в каталог</a>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch('/api/products');
    const allProducts = await res.json();
    const favoritesProducts = allProducts.filter(p => favorites.includes(p.id));

    if (favoritesProducts.length === 0) {
      // Товары удалены из БД — чистим
      saveFavorites([]);
      renderFavoritesPage();
      return;
    }

    countEl.innerHTML = `Сохранено: <strong>${favoritesProducts.length}</strong>`;
    if (clearBtn) clearBtn.classList.toggle('hidden', favoritesProducts.length === 0);

    grid.className = 'grid grid--4';
    grid.innerHTML = favoritesProducts.map(p => renderFavoriteCard(p)).join('');

    // Анимация появления
    requestAnimationFrame(() => {
      grid.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    });
  } catch (err) {
    console.error(err);
    countEl.textContent = 'Ошибка загрузки';
  }
}

function renderFavoriteCard(product) {
  const isCoffee = product.category_type === 'coffee';
  const isOutOfStock = product.track_stock === 1 && product.stock === 0;

  const imageHtml = product.image
    ? `<img src="${product.image}" alt="${product.name}" loading="lazy" />`
    : `<div class="product-card__placeholder">
        ${isCoffee
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/><path d="M10 15h4M10 18h4"/></svg>`
        }
       </div>`;

  const badgeHtml = isOutOfStock
    ? '<span class="badge badge--danger product-card__badge">Нет в наличии</span>'
    : '';

  return `
    <article class="product-card reveal" data-id="${product.id}">
      <a href="/product.html?id=${product.id}" class="product-card__link">
        <div class="product-card__image">
          ${badgeHtml}
          ${imageHtml}
        </div>
        <div class="product-card__body">
          <span class="product-card__category">${product.category_name || ''}</span>
          <h3 class="product-card__title">${product.name}</h3>
          ${product.description ? `<p class="product-card__desc">${product.description}</p>` : ''}
          <div class="product-card__footer">
            <div class="product-card__price-wrap">
              <div class="product-card__price">${Number(product.price).toLocaleString('ru-RU')} ₽</div>
              ${product.weight ? `<div class="product-card__weight">${product.weight}</div>` : ''}
            </div>
          </div>
        </div>
      </a>

      <button class="product-card__fav is-active"
              type="button"
              data-favorite="${product.id}"
              aria-label="Убрать из избранного">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </button>

      <button class="product-card__btn btn-add-to-cart"
              type="button"
              data-add-to-cart="${product.id}"
              ${isOutOfStock ? 'disabled' : ''}
              aria-label="В корзину">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </article>
  `;
}

// ============================================
// 4. Кнопка «Очистить всё»
// ============================================
document.addEventListener('click', (e) => {
  if (e.target.id !== 'clear-favorites-btn') return;
  if (!confirm('Убрать все товары из избранного?')) return;

  saveFavorites([]);
  renderFavoritesPage();
  if (typeof showToast === 'function') showToast('Избранное очищено');
});

// ============================================
// 5. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  updateFavoritesBadge();
  if (document.getElementById('favorites-grid')) {
    renderFavoritesPage();
  }
});