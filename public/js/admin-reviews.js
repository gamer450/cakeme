/* ============================================
   АДМИН: ОТЗЫВЫ
   ============================================ */

const reviewsState = {
  all: [],
  filter: 'all'
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderReviews(container) {
  container.innerHTML = `
    <div class="reviews-header">
      <h2 class="reviews-header__title">Отзывы <small id="reviews-count"></small></h2>
    </div>

    <div class="reviews-tabs" id="reviews-tabs">
      <button class="reviews-tab is-active" data-filter="all">
        Все <span class="reviews-tab__count" data-count="all">0</span>
      </button>
      <button class="reviews-tab" data-filter="pending">
        ⏳ На модерации <span class="reviews-tab__count" data-count="pending">0</span>
      </button>
      <button class="reviews-tab" data-filter="approved">
        ✅ Одобренные <span class="reviews-tab__count" data-count="approved">0</span>
      </button>
      <button class="reviews-tab" data-filter="featured">
        ⭐ Избранные <span class="reviews-tab__count" data-count="featured">0</span>
      </button>
    </div>

    <div id="reviews-list-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем отзывы...</span>
      </div>
    </div>
  `;

  initTabs();
  await reviewsLoad();
}

// ============================================
// 2. Загрузка
// ============================================
async function reviewsLoad() {
  try {
    const res = await fetch('/api/admin/reviews', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    reviewsState.all = await res.json();

    const total = reviewsState.all.length;
    document.getElementById('reviews-count').textContent = `(${total})`;

    // Счётчики
    const counts = {
      all: total,
      pending: reviewsState.all.filter(r => !r.is_approved).length,
      approved: reviewsState.all.filter(r => r.is_approved).length,
      featured: reviewsState.all.filter(r => r.is_featured && r.is_approved).length
    };

    document.querySelectorAll('[data-count]').forEach(el => {
      el.textContent = counts[el.dataset.count] || 0;
    });

    reviewsRenderList();
  } catch (err) {
    console.error(err);
    document.getElementById('reviews-list-wrap').innerHTML = `
      <div class="reviews-empty">
        <div class="reviews-empty__icon">😕</div>
        <div class="reviews-empty__title">Не удалось загрузить отзывы</div>
      </div>
    `;
  }
}

// ============================================
// 3. Список
// ============================================
function reviewsRenderList() {
  const wrap = document.getElementById('reviews-list-wrap');
  if (!wrap) return;

  let list = [...reviewsState.all];

  if (reviewsState.filter === 'pending') {
    list = list.filter(r => !r.is_approved);
  } else if (reviewsState.filter === 'approved') {
    list = list.filter(r => r.is_approved);
  } else if (reviewsState.filter === 'featured') {
    list = list.filter(r => r.is_featured && r.is_approved);
  }

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="reviews-empty">
        <div class="reviews-empty__icon">📭</div>
        <div class="reviews-empty__title">Отзывов пока нет</div>
        <div class="reviews-empty__text">Как только клиенты оставят отзывы — они появятся здесь</div>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="reviews-list">
      ${list.map(r => reviewsRenderCard(r)).join('')}
    </div>
  `;

  // Обработчики
  wrap.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', () => reviewsToggleApprove(parseInt(btn.dataset.approve, 10)));
  });
  wrap.querySelectorAll('[data-feature]').forEach(btn => {
    btn.addEventListener('click', () => reviewsToggleFeature(parseInt(btn.dataset.feature, 10)));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => reviewsDelete(parseInt(btn.dataset.delete, 10)));
  });
}

// ============================================
// 4. Карточка отзыва
// ============================================
function reviewsRenderCard(r) {
  const stars = Array(5).fill(0).map((_, i) =>
    `<span class="review-card__star ${i < r.rating ? 'review-card__star--active' : ''}">★</span>`
  ).join('');

  const date = new Date(r.created_at.replace(' ', 'T')).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let cardClass = 'review-card';
  if (!r.is_approved) cardClass += ' is-pending';
  else cardClass += ' is-approved';
  if (r.is_featured && r.is_approved) cardClass += ' is-featured';

  return `
    <div class="${cardClass}">
      <div class="review-card__header">
        <div class="review-card__author">
          <div class="review-card__name">
            ${r.author_name}
            <div class="review-card__badges">
              ${!r.is_approved ? '<span class="review-badge review-badge--pending">На модерации</span>' : ''}
              ${r.is_approved ? '<span class="review-badge review-badge--approved">Одобрен</span>' : ''}
              ${r.is_featured && r.is_approved ? '<span class="review-badge review-badge--featured">⭐ Избранный</span>' : ''}
            </div>
          </div>
          <div class="review-card__date">${date}</div>
        </div>
        <div class="review-card__rating">${stars}</div>
      </div>

      <div class="review-card__text">
        «${r.text}»
      </div>

      ${r.product_name ? `
        <div class="review-card__product">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/>
          </svg>
          ${r.product_name}
        </div>
      ` : ''}

      <div class="review-card__actions">
        ${!r.is_approved ? `
          <button class="review-btn review-btn--approve" data-approve="${r.id}">
            ✓ Одобрить
          </button>
        ` : `
          <button class="review-btn" data-approve="${r.id}">
            🙈 Скрыть
          </button>
        `}
        ${r.is_approved ? `
          <button class="review-btn review-btn--feature ${r.is_featured ? 'is-active' : ''}" data-feature="${r.id}">
            ⭐ ${r.is_featured ? 'Убрать из избранных' : 'В избранное'}
          </button>
        ` : ''}
        <button class="review-btn review-btn--danger" data-delete="${r.id}">
          🗑️ Удалить
        </button>
      </div>
    </div>
  `;
}

// ============================================
// 5. Табы
// ============================================
function initTabs() {
  document.querySelectorAll('.reviews-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.reviews-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      reviewsState.filter = tab.dataset.filter;
      reviewsRenderList();
    });
  });
}

// ============================================
// 6. Действия
// ============================================
async function reviewsToggleApprove(id) {
  const r = reviewsState.all.find(x => x.id === id);
  if (!r) return;

  try {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_approved: !r.is_approved })
    });

    if (!res.ok) throw new Error('Ошибка');

    await reviewsLoad();
    showAdminToast(r.is_approved ? 'Отзыв скрыт' : 'Отзыв одобрен');
  } catch (err) {
    showAdminToast('Не удалось изменить отзыв', 'error');
  }
}

async function reviewsToggleFeature(id) {
  const r = reviewsState.all.find(x => x.id === id);
  if (!r) return;

  try {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_featured: !r.is_featured })
    });

    if (!res.ok) throw new Error('Ошибка');

    await reviewsLoad();
    showAdminToast(r.is_featured ? 'Убран из избранных' : 'Добавлен в избранные ⭐');
  } catch (err) {
    showAdminToast('Не удалось изменить отзыв', 'error');
  }
}

async function reviewsDelete(id) {
  const r = reviewsState.all.find(x => x.id === id);
  if (!r) return;

  if (!confirm(`Удалить отзыв от «${r.author_name}»?`)) return;

  try {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка удаления');

    await reviewsLoad();
    showAdminToast('Отзыв удалён');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}