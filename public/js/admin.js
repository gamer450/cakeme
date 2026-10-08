/* ============================================================
   АДМИН-ПАНЕЛЬ — каркас + роутинг
   ============================================================ */

const state = {
  user: null,
  currentTab: 'dashboard',
  token: null
};

// ============================================================
// 1. Загрузка
// ============================================================
async function init() {
  state.token = localStorage.getItem('token');

  if (!state.token) {
    window.location.href = '/login.html?redirect=/admin/';
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html?redirect=/admin/';
      return;
    }

    const data = await res.json();
    state.user = data.user;

    if (state.user.role !== 'admin' && state.user.role !== 'manager') {
      document.getElementById('admin-root').innerHTML = `
        <div class="admin-loading">
          <div style="font-size:4rem;">🚫</div>
          <h1 style="color:var(--admin-text);font-size:1.5rem;margin-top:16px;">Доступ запрещён</h1>
          <p style="color:var(--admin-text-muted);">Эта страница только для администраторов и менеджеров</p>
          <a href="/" style="margin-top:16px;padding:12px 24px;background:var(--admin-accent);color:#fff;border-radius:100px;text-decoration:none;font-weight:700;">
            На главную
          </a>
        </div>
      `;
      return;
    }

    renderShell();
  } catch (err) {
    console.error('Ошибка загрузки админки:', err);
    window.location.href = '/login.html';
  }
}

// ============================================================
// 2. Рендер каркаса
// ============================================================
function renderShell() {
  const root = document.getElementById('admin-root');
  const user = state.user;
  const initial = user.name.charAt(0).toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Администратор' : 'Менеджер';

  root.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-sidebar__logo">
          <span class="admin-sidebar__logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
              <rect x="4" y="10" width="16" height="11" />
              <path d="M4 14h16" />
              <path d="M8 10V6h8v4" />
              <path d="M12 6V3" />
              <path d="M10 3h4" />
            </svg>
          </span>
          <div class="admin-sidebar__logo-text">
            <span class="admin-sidebar__logo-name">Cake.Me</span>
            <span class="admin-sidebar__logo-sub">админ-панель</span>
          </div>
        </div>

        <nav class="admin-menu">
          <button class="admin-menu__item is-active" data-tab="dashboard">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="13" width="5" height="8" />
                <rect x="10" y="6" width="5" height="15" />
                <rect x="17" y="10" width="5" height="11" />
              </svg>
            </span>
            Дашборд
          </button>
          <button class="admin-menu__item" data-tab="orders">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="6" width="18" height="14" />
                <path d="M3 6l9-3 9 3" />
                <path d="M12 10v4" />
              </svg>
            </span>
            Заказы
            <span class="admin-menu__item-badge hidden" id="orders-badge">0</span>
          </button>
          <button class="admin-menu__item" data-tab="kanban">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="3" width="5" height="18" />
                <rect x="10" y="3" width="5" height="12" />
                <rect x="17" y="3" width="4" height="8" />
              </svg>
            </span>
            Канбан
          </button>
          <button class="admin-menu__item" data-tab="products">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="4" y="10" width="16" height="11" />
                <path d="M4 14h16" />
                <path d="M8 10V6h8v4" />
              </svg>
            </span>
            Товары
          </button>
          <button class="admin-menu__item" data-tab="categories">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="5" width="8" height="8" />
                <rect x="13" y="5" width="8" height="8" />
                <rect x="3" y="15" width="8" height="4" />
                <rect x="13" y="15" width="8" height="4" />
              </svg>
            </span>
            Категории
          </button>
          <button class="admin-menu__item" data-tab="constructor">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="5" y="10" width="14" height="11" />
                <path d="M5 15h14" />
                <path d="M12 3v7" />
              </svg>
            </span>
            Конструктор
          </button>
          <button class="admin-menu__item" data-tab="partners">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="5" width="8" height="8" />
                <rect x="13" y="11" width="8" height="8" />
                <path d="M11 9h2" />
                <path d="M12 11v2" />
              </svg>
            </span>
            Партнёры
          </button>
          <button class="admin-menu__item" data-tab="media">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="5" width="18" height="14" />
                <path d="M3 14l5-4 4 3 3-2 6 5" />
                <rect x="7" y="8" width="2" height="2" />
              </svg>
            </span>
            Медиа
          </button>
          <button class="admin-menu__item" data-tab="reviews">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <path d="M12 3l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" />
              </svg>
            </span>
            Отзывы
            <span class="admin-menu__item-badge hidden" id="reviews-badge">0</span>
          </button>
          <button class="admin-menu__item" data-tab="logs">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="4" y="3" width="16" height="18" />
                <path d="M8 8h8M8 12h8M8 16h5" />
              </svg>
            </span>
            История действий
          </button>
          <button class="admin-menu__item" data-tab="operator">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </span>
            Заявки
            <span class="admin-menu__item-badge hidden" id="operator-badge">0</span>
          </button>
          <button class="admin-menu__item" data-tab="notifications">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <path d="M6 17V10a6 6 0 1 1 12 0v7" />
                <path d="M3 17h18M10 20h4" />
              </svg>
            </span>
            Уведомления
          </button>
          <button class="admin-menu__item" data-tab="faq">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="5" y="8" width="14" height="12" />
                <path d="M9 8V5h6v3M12 12v3" />
                <rect x="11.5" y="16" width="1" height="1" />
              </svg>
            </span>
            FAQ
          </button>
          <button class="admin-menu__item" data-tab="promocodes">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <path d="M3 8h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" />
                <path d="M9 8v12" />
              </svg>
            </span>
            Промокоды
          </button>
          <button class="admin-menu__item" data-tab="users">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="9" width="6" height="6" />
                <rect x="15" y="9" width="6" height="6" />
                <path d="M9 12h6M6 15v3h12v-3" />
              </svg>
            </span>
            Пользователи
          </button>
          <button class="admin-menu__item" data-tab="settings">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="9" y="9" width="6" height="6" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
              </svg>
            </span>
            Настройки
          </button>

          <div class="admin-menu__divider"></div>

          <a href="/" class="admin-menu__item admin-menu__item--exit">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <rect x="3" y="3" width="18" height="18" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </span>
            Перейти на сайт
          </a>
          <button class="admin-menu__item admin-menu__item--exit" id="logout-btn">
            <span class="admin-menu__item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter">
                <path d="M9 3H4v18h5M12 12h9M18 8l4 4-4 4" />
              </svg>
            </span>
            Выйти
          </button>
        </nav>
      </aside>

      <div class="admin-main">
        <header class="admin-topbar">
          <h1 class="admin-topbar__title" id="tab-title">Дашборд</h1>
          <div class="admin-topbar__user">
            <div class="admin-topbar__user-info">
              <span class="admin-topbar__user-name">${user.name}</span>
              <span class="admin-topbar__user-role">${roleLabel}</span>
            </div>
            <div class="admin-topbar__user-avatar">${initial}</div>
          </div>
        </header>

        <div class="admin-content" id="admin-content"></div>
      </div>
    </div>
  `;

  initTabs();
  initLogout();

  navigate('dashboard');
}

// ============================================================
// 3. Навигация
// ============================================================
const tabTitles = {
  dashboard: 'Дашборд',
  orders: 'Заказы',
  logs: 'История действий',
  products: 'Товары',
  categories: 'Категории',
  constructor: 'Конструктор',
  partners: 'Партнёры',
  media: 'Медиа',
  reviews: 'Отзывы',
  users: 'Пользователи',
  settings: 'Настройки',
  promocodes: 'Промокоды',
  notifications: 'Уведомления',
  faq: 'FAQ',
  kanban: 'Канбан заказов',
  operator: 'Заявки',
};

function initTabs() {
  document.querySelectorAll('.admin-menu__item[data-tab]').forEach(item => {
    item.addEventListener('click', () => {
      navigate(item.dataset.tab);
    });
  });
}

function navigate(tab) {
  state.currentTab = tab;

  document.querySelectorAll('.admin-menu__item[data-tab]').forEach(i => {
    i.classList.toggle('is-active', i.dataset.tab === tab);
  });

  const title = document.getElementById('tab-title');
  if (title) title.textContent = tabTitles[tab] || tab;

  const content = document.getElementById('admin-content');
  if (!content) return;

  switch (tab) {
    case 'dashboard':
      renderDashboard(content);
      break;

    case 'orders':
      renderOrders(content);
      break;

    case 'categories':
      renderCategories(content);
      break;

    case 'products':
      renderProducts(content);
      break;

    case 'constructor':
      renderConstructor(content);
      break;

    case 'partners':
      renderPartners(content);
      break;

    case 'media':
      renderMedia(content);
      break;

    case 'reviews':
      renderReviews(content);
      break;

    case 'logs':
      renderLogs(content);
      break;
    case 'operator':
      renderOperator(content);
      break;

    case 'users':
      renderUsers(content);
      break;

    case 'settings':
      renderSettings(content);
      break;
    case 'promocodes':
      renderPromocodes(content);
      break;
    case 'notifications':
      renderNotifications(content);
      break;
    case 'faq': 
      renderFAQ(content); 
      break;
    case 'kanban':
      renderKanban(content);
      break;

    default:
      content.innerHTML = `
        <div class="admin-placeholder">
          <h2 class="admin-placeholder__title">${tabTitles[tab] || tab}</h2>
          <p class="admin-placeholder__text">Раздел в разработке</p>
        </div>
      `;
  }

  if (tab === 'dashboard') {
    updateOrdersBadge();
    updateReviewsBadge();
    if (typeof updateOperatorBadge === 'function') updateOperatorBadge();
  }
}

// ============================================================
// 4. Бейджи
// ============================================================
async function updateOrdersBadge() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) return;

    const stats = await res.json();
    const badge = document.getElementById('orders-badge');
    if (!badge) return;

    if (stats.newOrders > 0) {
      badge.textContent = stats.newOrders;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch {}
}

async function updateReviewsBadge() {
  try {
    const res = await fetch('/api/admin/reviews?filter=pending', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) return;

    const pending = await res.json();
    const badge = document.getElementById('reviews-badge');
    if (!badge) return;

    if (pending.length > 0) {
      badge.textContent = pending.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch {}
}

// ============================================================
// 5. Выход
// ============================================================
function initLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (!confirm('Выйти из админ-панели?')) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    window.location.href = '/';
  });
}

// ============================================================
// 6. ДАШБОРД
// ============================================================
// Функция renderDashboard теперь в admin-dashboard.js
// (загружается через <script> в admin/index.html)

// ============================================================
// 7. СТАРТ
// ============================================================
document.addEventListener('DOMContentLoaded', init);