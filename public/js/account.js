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
      <!-- SIDEBAR -->
      <aside class="account-sidebar">
        <div class="account-user">
          <div class="account-user__avatar">${initial}</div>
          <div class="account-user__name">${user.name}</div>
          <div class="account-user__email">${user.email}</div>
          <span class="account-user__role">${user.role}</span>
        </div>

        <div class="account-menu">
          <button class="account-menu__item is-active" data-tab="orders">
            📦 Мои заказы
          </button>
          <button class="account-menu__item" data-tab="profile">
            👤 Профиль
          </button>
          ${user.role === 'admin' ? `
            <a href="/admin/" class="account-menu__item">
              👑 Админ-панель
            </a>
          ` : ''}
          ${user.role === 'manager' ? `
            <a href="/admin/" class="account-menu__item">
              🧑‍💼 Панель менеджера
            </a>
          ` : ''}
          <button class="account-menu__item account-menu__item--danger" id="logout-btn">
            🚪 Выйти
          </button>
        </div>
      </aside>

      <!-- CONTENT -->
      <div class="account-content">
        <div class="account-tab is-active" data-tab="orders">
          <h2 class="account-tab__title">История заказов</h2>
          ${renderOrders(orders)}
        </div>

        <div class="account-tab" data-tab="profile">
          <h2 class="account-tab__title">Профиль</h2>
          <div class="checkout-form__grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="checkout-form__field">
              <span class="checkout-form__label">Имя</span>
              <div style="padding:14px 16px;background:var(--cream);border-radius:var(--r-md);color:var(--choco);font-weight:600;">${user.name}</div>
            </div>
            <div class="checkout-form__field">
              <span class="checkout-form__label">Email</span>
              <div style="padding:14px 16px;background:var(--cream);border-radius:var(--r-md);color:var(--choco);font-weight:600;">${user.email}</div>
            </div>
            <div class="checkout-form__field">
              <span class="checkout-form__label">Телефон</span>
              <div style="padding:14px 16px;background:var(--cream);border-radius:var(--r-md);color:var(--choco);font-weight:600;">${user.phone || '—'}</div>
            </div>
            <div class="checkout-form__field">
              <span class="checkout-form__label">Роль</span>
              <div style="padding:14px 16px;background:var(--cream);border-radius:var(--r-md);color:var(--choco);font-weight:600;">${user.role}</div>
            </div>
          </div>
          <p style="margin-top:24px;color:var(--text-muted);font-size:0.9rem;">
            Редактирование профиля появится в следующих обновлениях.
          </p>
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
        <div class="account-empty__icon">📦</div>
        <div class="account-empty__title">Заказов пока нет</div>
        <p class="account-empty__text">Загляните в каталог и выберите что-нибудь вкусное!</p>
        <a href="/catalog.html" class="btn btn-primary">Перейти в каталог</a>
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
            ${o.items.map(i => `<span>${i.product_name} × ${i.quantity} — ${i.price * i.quantity} ₽</span>`).join('')}
          </div>
          <div class="order-card__total">
            <span class="order-card__total-label">Итого:</span>
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  });
}

// ============================================
// 6. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', init);