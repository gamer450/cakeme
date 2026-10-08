/* ============================================================
   УНИВЕРСАЛЬНЫЙ РЕНДЕР КАРТОЧКИ ТОВАРА
   - Умные SVG-заглушки по типу категории (cake/coffee/tea/...)
   - Единый HTML для main.js, catalog.js, product.js
   ============================================================ */

(function () {
  'use strict';

  const PLACEHOLDER_SVG = {
    cake: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/>
        <path d="M10 15h4M10 18h4"/>
      </svg>
    `,
    coffee: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
        <path d="M6 1v3M10 1v3M14 1v3"/>
      </svg>
    `,
    tea: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
        <path d="M6 1v3M10 1v3M14 1v3"/>
      </svg>
    `,
    default: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
      </svg>
    `
  };

  function formatPrice(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('ru-RU') + ' ₽';
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getProductType(product) {
    const catType = (product.category_type || '').toLowerCase();
    if (catType === 'cake' || catType === 'coffee' || catType === 'tea') {
      return catType;
    }
    const catSlug = (product.category_slug || '').toLowerCase();
    if (catSlug.includes('tort') || catSlug.includes('pirozh')) return 'cake';
    if (catSlug.includes('kofe') || catSlug.includes('coffee')) return 'coffee';
    if (catSlug.includes('chay') || catSlug.includes('tea')) return 'tea';
    return 'default';
  }

  function renderProductCard(product, opts) {
    opts = opts || {};
    const type = getProductType(product);
    const hasImage = product.image && product.image.trim() !== '';
    const imgHtml = hasImage
      ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
      : `<div class="product-card__placeholder">${PLACEHOLDER_SVG[type]}</div>`;
        // ✅ Проверяем, в избранном ли товар
    let isFav = false;
    try {
      const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
      isFav = favs.includes(product.id);
    } catch {}
    // ✅ ФИКС: учитываем остаток
    let badgeHtml = '';
    if (product.track_stock === 1 && product.stock === 0) {
      badgeHtml = `<span class="badge badge--danger product-card__badge">Нет в наличии</span>`;
    } else if (product.is_hit) {
      badgeHtml = `<span class="badge badge--gold product-card__badge">Хит</span>`;
    }

    return `
      <article class="product-card" data-id="${product.id}" data-type="${type}">
        <a href="/product.html?id=${product.id}" class="product-card__link">
          <div class="product-card__image">
            ${badgeHtml}
            ${imgHtml}
          </div>
          <div class="product-card__body">
            ${opts.showCategory !== false
              ? `<span class="product-card__category">${escapeHtml(product.category_name || '')}</span>`
              : ''}
            <h3 class="product-card__title">${escapeHtml(product.name)}</h3>
            ${product.description
              ? `<p class="product-card__desc">${escapeHtml(product.description)}</p>`
              : ''}
            <div class="product-card__footer">
              <div class="product-card__price-wrap">
                <div class="product-card__price">${formatPrice(product.price)}</div>
                ${product.weight
                  ? `<div class="product-card__weight">${escapeHtml(product.weight)}</div>`
                  : ''}
              </div>
            </div>
          </div>
        </a>
                <button class="product-card__fav ${isFav ? 'is-active' : ''}"
                type="button"
                data-favorite="${product.id}"
                aria-label="В избранное">
          <svg width="18" height="18" viewBox="0 0 24 24"
               fill="${isFav ? 'currentColor' : 'none'}"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </button>

        <button class="product-card__btn btn-add-to-cart"
                type="button"
                data-add-to-cart="${product.id}"
                ${product.track_stock === 1 && product.stock === 0 ? 'disabled title="Нет в наличии"' : ''}
                aria-label="В корзину">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </article>
    `;
  }

  function renderProductList(container, products, opts) {
    if (!container) return;
    if (!products || !products.length) {
      container.innerHTML = `
        <div class="empty" style="grid-column: 1 / -1;">
          <div class="empty__title">Товары не найдены</div>
          <p class="empty__text">Попробуйте изменить фильтры или поиск</p>
        </div>
      `;
      return;
    }
    container.innerHTML = products.map(p => renderProductCard(p, opts)).join('');
  }

  window.ProductCard = {
    render: renderProductCard,
    renderList: renderProductList,
    formatPrice,
    escapeHtml,
    getProductType,
    PLACEHOLDER_SVG
  };
})();