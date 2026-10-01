/* ============================================
   ЛИЧНЫЙ КАБИНЕТ
   ============================================ */

const statusLabels = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  baking: 'Готовится',
  delivering: 'В доставке',
  done: 'Выполнен',
  cancelled: 'Отменён'
};

// ============================================
// 1. Загрузка
// ============================================
async function init() {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = '/login.html?redirect=/account.html';
    return;
  }

  try {
    const [meRes, ordersRes] = await Promise.all([
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/auth/my-orders', { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (meRes.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return;
    }

    const me = await meRes.json();
    const orders = await ordersRes.json();

    render(me.user, orders);
  } catch (err) {
    console.error('Ошибка загрузки кабинета:', err);
    document.getElementById('account-container').innerHTML = `
      <p class="text-center">Не удалось загрузить данные. <a href="/login.html">Войти снова</a></p>
    `;
  }
}

// ============================================
// 2. Рендер кабинета
// ============================================
function render(user, orders) {
  const container = document.getElementById('account-container');
  const initial = user.name.charAt(0).toUpperCase();

  container.innerHTML = `
    <div class="account-layout">
      <aside class="account-sidebar">
        <div class="account-user">
          <div class="account-user__avatar">${initial}</div>
          <div class="account-user__name">${user.name}</div>
          <div class="account-user__email">${user.email}</div>
          <span class="account-user__role">${user.role}</span>
        </div>

        <div class="account-menu">
          <button class="account-menu__item is-active" data-tab="orders">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
            </svg>
            Мои заказы
          </button>
          <button class="account-menu__item" data-tab="profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Профиль
          </button>
          ${user.role === 'admin' ? `
            <a href="/admin/" class="account-menu__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 20h20l-2-9-4 3-4-7-4 7-4-3z"/>
              </svg>
              Админ-панель
            </a>
          ` : ''}
          ${user.role === 'manager' ? `
            <a href="/admin/" class="account-menu__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="14" x="2" y="7" rx="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              Панель менеджера
            </a>
          ` : ''}
          <button class="account-menu__item account-menu__item--danger" id="logout-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Выйти
          </button>
        </div>
      </aside>

      <div class="account-content">
        <div class="account-tab is-active" data-tab="orders">
          <h2 class="account-tab__title">История заказов</h2>
          ${renderOrders(orders)}
        </div>

        <div class="account-tab" data-tab="profile">
          <h2 class="account-tab__title">Профиль</h2>
          <div class="profile-grid">
            <div class="profile-field">
              <span class="profile-field__label">Имя</span>
              <div class="profile-field__value">${user.name}</div>
            </div>
            <div class="profile-field">
              <span class="profile-field__label">Email</span>
              <div class="profile-field__value">${user.email}</div>
            </div>
            <div class="profile-field">
              <span class="profile-field__label">Телефон</span>
              <div class="profile-field__value">${user.phone || '—'}</div>
            </div>
            <div class="profile-field">
              <span class="profile-field__label">Роль</span>
              <div class="profile-field__value">${user.role}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  initTabs();
  initLogout();
}

// ============================================
// 3. Список заказов
// ============================================
function renderOrders(orders) {
  if (!orders.length) {
    return `
      <div class="account-empty">
        <div class="account-empty__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
          </svg>
        </div>
        <div class="account-empty__title">Заказов пока нет</div>
        <p class="account-empty__text">Загляните в каталог и выберите что-нибудь вкусное</p>
        <a href="/catalog.html" class="btn btn-primary btn-lg magnetic">Перейти в каталог</a>
      </div>
    `;
  }

  return `
    <div class="orders-list">
      ${orders.map(o => `
        <div class="order-card">
          <div class="order-card__header">
            <div>
              <div class="order-card__id">Заказ №${o.id}</div>
              <div class="order-card__date">${formatDate(o.created_at)}</div>
            </div>
            <span class="order-card__status order-status--${o.status}">${statusLabels[o.status] || o.status}</span>
          </div>
          <div class="order-card__items">
            ${o.items.map(i => `
              <div class="order-card__item">
                <span>${i.product_name} × ${i.quantity}</span>
                <span>${(i.price * i.quantity).toLocaleString('ru-RU')} ₽</span>
              </div>
            `).join('')}
          </div>
          <div class="order-card__total">
            <span class="order-card__total-label">Итого</span>
            <span class="order-card__total-value">${o.total.toLocaleString('ru-RU')} ₽</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function formatDate(str) {
  try {
    const d = new Date(str.replace(' ', 'T'));
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return str;
  }
}

// ============================================
// 4. Вкладки
// ============================================
function initTabs() {
  const menu = document.querySelectorAll('.account-menu__item[data-tab]');
  const tabs = document.querySelectorAll('.account-tab');

  menu.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      menu.forEach(m => m.classList.remove('is-active'));
      item.classList.add('is-active');
      tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabName));
    });
  });
}

// ============================================
// 5. Выход
// ============================================
function initLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (!confirm('Выйти из аккаунта?')) return;
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