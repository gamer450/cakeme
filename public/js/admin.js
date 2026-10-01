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

    // Проверка роли
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
      <!-- SIDEBAR -->
      <aside class="admin-sidebar">
        <div class="admin-sidebar__logo">
          <span class="admin-sidebar__logo-icon">🍰</span>
          <div class="admin-sidebar__logo-text">
            <span class="admin-sidebar__logo-name">Cake.Me</span>
            <span class="admin-sidebar__logo-sub">админ-панель</span>
          </div>
        </div>

        <nav class="admin-menu">
          <button class="admin-menu__item is-active" data-tab="dashboard">
            <span class="admin-menu__item-icon">📊</span>
            Дашборд
          </button>
          <button class="admin-menu__item" data-tab="orders">
            <span class="admin-menu__item-icon">📦</span>
            Заказы
            <span class="admin-menu__item-badge hidden" id="orders-badge">0</span>
          </button>
          <button class="admin-menu__item" data-tab="products">
            <span class="admin-menu__item-icon">🎂</span>
            Товары
          </button>
          <button class="admin-menu__item" data-tab="categories">
            <span class="admin-menu__item-icon">🏷️</span>
            Категории
          </button>
          <button class="admin-menu__item" data-tab="constructor">
            <span class="admin-menu__item-icon">🧁</span>
            Конструктор
          </button>
          <button class="admin-menu__item" data-tab="partners">
            <span class="admin-menu__item-icon">🤝</span>
            Партнёры
          </button>
          <button class="admin-menu__item" data-tab="media">
            <span class="admin-menu__item-icon">🖼️</span>
            Медиа
          </button>
          ${user.role === 'admin' ? `
            <button class="admin-menu__item" data-tab="users">
              <span class="admin-menu__item-icon">👥</span>
              Пользователи
            </button>
            <button class="admin-menu__item" data-tab="settings">
              <span class="admin-menu__item-icon">⚙️</span>
              Настройки
            </button>
          ` : ''}

          <div class="admin-menu__divider"></div>

          <a href="/" class="admin-menu__item admin-menu__item--exit">
            <span class="admin-menu__item-icon">🌐</span>
            Перейти на сайт
          </a>
          <button class="admin-menu__item admin-menu__item--exit" id="logout-btn">
            <span class="admin-menu__item-icon">🚪</span>
            Выйти
          </button>
        </nav>
      </aside>

      <!-- MAIN -->
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

        <div class="admin-content" id="admin-content">
          <!-- Сюда рендерится контент вкладки -->
        </div>
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
  products: 'Товары',
  categories: 'Категории',
  constructor: 'Конструктор',
  partners: 'Партнёры',
  media: 'Медиа',
  users: 'Пользователи',
  settings: 'Настройки'
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

  // Активная кнопка
  document.querySelectorAll('.admin-menu__item[data-tab]').forEach(i => {
    i.classList.toggle('is-active', i.dataset.tab === tab);
  });

  // Заголовок
  const title = document.getElementById('tab-title');
  if (title) title.textContent = tabTitles[tab] || tab;

  // Контент
  const content = document.getElementById('admin-content');
  if (!content) return;

  // Роутинг
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

    case 'users':
      renderUsers(content);
      break;

    case 'settings':
      renderSettings(content);
      break;

    default:
      content.innerHTML = `
        <div class="admin-placeholder">
          <div class="admin-placeholder__icon">🚧</div>
          <h2 class="admin-placeholder__title">${tabTitles[tab] || tab}</h2>
          <p class="admin-placeholder__text">Раздел в разработке</p>
        </div>
      `;
  }

  // Обновляем бейдж новых заказов
  if (tab === 'dashboard') {
    updateOrdersBadge();
  }
}

// ============================================================
// 4. Бейдж новых заказов
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
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="admin-loading" style="min-height:200px">
      <div class="admin-loading__spinner"></div>
      <span>Считаем цифры...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    const stats = await res.json();

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--orders">📦</div>
          <div class="stat-card__label">Всего заказов</div>
          <div class="stat-card__value">${stats.totalOrders}</div>
          <div class="stat-card__hint">за всё время</div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--new">🔔</div>
          <div class="stat-card__label">Новых заказов</div>
          <div class="stat-card__value">${stats.newOrders}</div>
          <div class="stat-card__hint">требуют обработки</div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--revenue">💰</div>
          <div class="stat-card__label">Выручка</div>
          <div class="stat-card__value">${formatMoney(stats.totalRevenue)}</div>
          <div class="stat-card__hint">без отменённых</div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon stat-card__icon--users">👥</div>
          <div class="stat-card__label">Покупателей</div>
          <div class="stat-card__value">${stats.totalUsers}</div>
          <div class="stat-card__hint">в базе</div>
        </div>
      </div>

      <div class="dashboard-row">
        <div class="dashboard-panel">
          <div class="dashboard-panel__header">
            <h3 class="dashboard-panel__title">📈 Продажи за 7 дней</h3>
          </div>
          ${renderChart(stats.salesByDay)}
        </div>

        <div class="dashboard-panel">
          <div class="dashboard-panel__header">
            <h3 class="dashboard-panel__title">🏆 Топ товаров</h3>
          </div>
          ${renderTopProducts(stats.topProducts)}
        </div>
      </div>

      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <h3 class="dashboard-panel__title">📋 Последние заказы</h3>
          <a href="#" class="dashboard-panel__link" id="go-orders">Все заказы →</a>
        </div>
        ${renderRecentOrders(stats.recentOrders)}
      </div>
    `;

    document.getElementById('go-orders')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('orders');
    });

    document.querySelectorAll('.recent-order').forEach(el => {
      el.addEventListener('click', () => navigate('orders'));
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="admin-placeholder">
        <div class="admin-placeholder__icon">😕</div>
        <h2 class="admin-placeholder__title">Не удалось загрузить статистику</h2>
        <p class="admin-placeholder__text">Обновите страницу или попробуйте позже</p>
      </div>
    `;
  }
}

// График продаж
function renderChart(salesByDay) {
  if (!salesByDay || salesByDay.length === 0) {
    return `<div class="chart__empty">Пока нет продаж 📉</div>`;
  }

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const found = salesByDay.find(s => s.day === key);
    days.push({
      day: key,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      revenue: found ? found.revenue : 0,
      orders: found ? found.orders : 0
    });
  }

  const maxRevenue = Math.max(...days.map(d => d.revenue), 1);

  return `
    <div class="chart">
      ${days.map(d => {
        const height = d.revenue === 0 ? 4 : Math.max(8, (d.revenue / maxRevenue) * 100);
        return `
          <div class="chart__bar-wrap">
            <div class="chart__bar" style="height:${height}%">
              <span class="chart__bar-value">${formatMoney(d.revenue)} ₽</span>
            </div>
            <span class="chart__label">${d.label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Топ товаров
function renderTopProducts(products) {
  if (!products || products.length === 0) {
    return `<div class="top-list__empty">Пока нет продаж</div>`;
  }

  return `
    <div class="top-list">
      ${products.map((p, i) => `
        <div class="top-item">
          <div class="top-item__rank">${i + 1}</div>
          <div class="top-item__info">
            <div class="top-item__name">${p.product_name}</div>
            <div class="top-item__meta">Продано: ${p.sold} шт</div>
          </div>
          <div class="top-item__revenue">${formatMoney(p.revenue)} ₽</div>
        </div>
      `).join('')}
    </div>
  `;
}

// Последние заказы
function renderRecentOrders(orders) {
  if (!orders || orders.length === 0) {
    return `<div class="recent-orders__empty">Заказов пока нет 📭</div>`;
  }

  const statusLabels = {
    new: 'Новый',
    confirmed: 'Подтверждён',
    baking: 'Готовится',
    delivering: 'В доставке',
    done: 'Выполнен',
    cancelled: 'Отменён'
  };

  return `
    <div class="recent-orders">
      ${orders.map(o => `
        <div class="recent-order">
          <div class="recent-order__id">№${o.id}</div>
          <div>
            <div class="recent-order__customer">${o.customer_name}</div>
            <div class="recent-order__phone">${o.phone || ''}</div>
          </div>
          <span class="order-badge order-badge--${o.status}">${statusLabels[o.status] || o.status}</span>
          <div class="recent-order__total">${formatMoney(o.total)} ₽</div>
        </div>
      `).join('')}
    </div>
  `;
}

// Вспомогательное
function formatMoney(n) {
  return Math.round(n).toLocaleString('ru-RU');
}

// ============================================================
// 7. СТАРТ
// ============================================================
document.addEventListener('DOMContentLoaded', init);