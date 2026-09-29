/* ============================================
   АДМИН-ПАНЕЛЬ — каркас
   ============================================ */

const state = {
  user: null,
  currentTab: 'dashboard',
  token: null
};

// ============================================
// 1. Загрузка
// ============================================
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

// ============================================
// 2. Рендер каркаса
// ============================================
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
            <span class="admin-sidebar__logo-name">Сладкий Дом</span>
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

  // Открыть первую вкладку
  navigate('dashboard');
}

// ============================================
// 3. Навигация по вкладкам
// ============================================
const tabTitles = {
  dashboard: 'Дашборд',
  orders: 'Заказы',
  products: 'Товары',
  categories: 'Категории',
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

  // Пока все вкладки — заглушки. В следующих подспринтах заменим.
  content.innerHTML = `
    <div class="admin-placeholder">
      <div class="admin-placeholder__icon">🚧</div>
      <h2 class="admin-placeholder__title">${tabTitles[tab] || tab}</h2>
      <p class="admin-placeholder__text">Раздел в разработке — появится в следующих обновлениях</p>
    </div>
  `;

  // Обновляем бейдж с новыми заказами
  if (tab === 'dashboard') {
    updateOrdersBadge();
  }
}

// ============================================
// 4. Бейдж новых заказов
// ============================================
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

// ============================================
// 5. Выход
// ============================================
function initLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (!confirm('Выйти из админ-панели?')) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    window.location.href = '/';
  });
}

// ============================================
// 6. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', init);