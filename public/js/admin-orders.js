/* ============================================
   АДМИН: УПРАВЛЕНИЕ ЗАКАЗАМИ
   ============================================ */

const ordersState = {
  all: [],
  filter: 'all',
  search: '',
  currentOrder: null
};

const statusLabels = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  baking: 'Готовится',
  delivering: 'В доставке',
  done: 'Выполнен',
  cancelled: 'Отменён'
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderOrders(container) {
  container.innerHTML = `
    <div class="orders-toolbar">
      <div class="orders-tabs" id="orders-tabs">
        <button class="orders-tab is-active" data-status="all">Все <span class="orders-tab__count" data-count="all">0</span></button>
        <button class="orders-tab" data-status="new">Новые <span class="orders-tab__count" data-count="new">0</span></button>
        <button class="orders-tab" data-status="confirmed">Подтверждённые <span class="orders-tab__count" data-count="confirmed">0</span></button>
        <button class="orders-tab" data-status="baking">Готовятся <span class="orders-tab__count" data-count="baking">0</span></button>
        <button class="orders-tab" data-status="delivering">В доставке <span class="orders-tab__count" data-count="delivering">0</span></button>
        <button class="orders-tab" data-status="done">Выполненные <span class="orders-tab__count" data-count="done">0</span></button>
        <button class="orders-tab" data-status="cancelled">Отменённые <span class="orders-tab__count" data-count="cancelled">0</span></button>
      </div>

      <div class="orders-search">
        <span class="orders-search__icon">🔍</span>
        <input type="text" id="orders-search-input" placeholder="Поиск по имени, телефону, № заказа..." />
      </div>
    </div>

    <div class="orders-table-wrap" id="orders-table-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем заказы...</span>
      </div>
    </div>
  `;

  initOrdersTabs();
  initOrdersSearch();
  await ordersLoad();
}

// ============================================
// 2. Загрузка заказов
// ============================================
async function ordersLoad() {
  try {
    const res = await fetch('/api/admin/orders', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    ordersState.all = await res.json();

    ordersUpdateCounts();
    ordersRenderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('orders-table-wrap').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить заказы</div>
      </div>
    `;
  }
}

// ============================================
// 3. Обновление счётчиков
// ============================================
function ordersUpdateCounts() {
  const counts = { all: ordersState.all.length };
  ['new', 'confirmed', 'baking', 'delivering', 'done', 'cancelled'].forEach(s => {
    counts[s] = ordersState.all.filter(o => o.status === s).length;
  });

  document.querySelectorAll('[data-count]').forEach(el => {
    const key = el.dataset.count;
    el.textContent = counts[key] || 0;
  });
}

// ============================================
// 4. Фильтрация
// ============================================
function getFiltered() {
  let list = [...ordersState.all];

  if (ordersState.filter !== 'all') {
    list = list.filter(o => o.status === ordersState.filter);
  }

  if (ordersState.search.trim()) {
    const q = ordersState.search.trim().toLowerCase();
    list = list.filter(o =>
      o.customer_name.toLowerCase().includes(q) ||
      (o.phone || '').toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  }

  return list;
}

// ============================================
// 5. Рендер таблицы
// ============================================
function ordersRenderTable() {
  const list = getFiltered();
  const wrap = document.getElementById('orders-table-wrap');

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">📭</div>
        <div class="orders-empty__title">Заказов не найдено</div>
        <p>Попробуйте изменить фильтр или поиск</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <table class="orders-table">
      <thead>
        <tr>
          <th>№</th>
          <th>Клиент</th>
          <th>Телефон</th>
          <th>Сумма</th>
          <th>Дата</th>
          <th>Статус</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${list.map(o => `
          <tr data-order-id="${o.id}">
            <td><span class="orders-table__id">№${o.id}</span></td>
            <td>
              <div class="orders-table__customer">${o.customer_name}</div>
            </td>
            <td>
              <span class="orders-table__phone">${o.phone || '—'}</span>
            </td>
            <td><span class="orders-table__total">${o.total.toLocaleString('ru-RU')} ₽</span></td>
            <td><span class="orders-table__date">${ordersFormatDate(o.created_at)}</span></td>
            <td><span class="order-badge order-badge--${o.status}">${statusLabels[o.status] || o.status}</span></td>
            <td class="orders-table__actions">
              <button class="orders-table__btn" data-open="${o.id}">Открыть</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Клики по строкам и кнопкам
  wrap.querySelectorAll('tr[data-order-id]').forEach(row => {
    row.addEventListener('click', () => openOrder(parseInt(row.dataset.orderId, 10)));
  });
}

// ============================================
// 6. Табы (фильтры)
// ============================================
function initOrdersTabs() {
  document.querySelectorAll('.orders-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.orders-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      ordersState.filter = tab.dataset.status;
      ordersRenderTable();
    });
  });
}

// ============================================
// 7. Поиск
// ============================================
let searchTimer;
function initOrdersSearch() {
  document.getElementById('orders-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      ordersState.search = e.target.value;
      ordersRenderTable();
    }, 250);
  });
}

// ============================================
// 8. Модалка заказа
// ============================================
function openOrder(id) {
  const order = ordersState.all.find(o => o.id === id);
  if (!order) return;

  ordersState.currentOrder = order;

  // Создаём модалку
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner">
      <div class="modal__header">
        <div class="modal__title">Заказ №${order.id}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <div class="modal__section">
          <div class="modal__section-title">Клиент</div>
          <div class="modal__info-grid">
            <div class="modal__info-item">
              <div class="modal__info-label">Имя</div>
              <div class="modal__info-value">${order.customer_name}</div>
            </div>
            <div class="modal__info-item">
              <div class="modal__info-label">Телефон</div>
              <div class="modal__info-value">${order.phone || '—'}</div>
            </div>
            ${order.email ? `
              <div class="modal__info-item">
                <div class="modal__info-label">Email</div>
                <div class="modal__info-value">${order.email}</div>
              </div>
            ` : ''}
            <div class="modal__info-item">
              <div class="modal__info-label">Дата</div>
              <div class="modal__info-value">${ordersFormatDate(order.created_at)}</div>
            </div>
            ${order.address ? `
              <div class="modal__info-item" style="grid-column: 1 / -1;">
                <div class="modal__info-label">Адрес доставки</div>
                <div class="modal__info-value">${order.address}</div>
              </div>
            ` : ''}
            ${order.comment ? `
              <div class="modal__info-item" style="grid-column: 1 / -1;">
                <div class="modal__info-label">Комментарий</div>
                <div class="modal__info-value">${order.comment}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="modal__section">
          <div class="modal__section-title">Состав заказа</div>
          <div class="modal-items">
            ${order.items.map(i => `
              <div class="modal-item">
                <div>
                  <span class="modal-item__name">${i.product_name}</span>
                  <span class="modal-item__qty">× ${i.quantity}</span>
                </div>
                <div class="modal-item__price">${(i.price * i.quantity).toLocaleString('ru-RU')} ₽</div>
              </div>
            `).join('')}
          </div>
          <div class="modal-total">
            <span class="modal-total__label">Итого:</span>
            <span class="modal-total__value">${order.total.toLocaleString('ru-RU')} ₽</span>
          </div>
        </div>

        <div class="modal__section">
          <div class="modal__section-title">Изменить статус</div>
          <div class="status-actions">
            ${renderStatusButtons(order.status)}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Открытие с анимацией
  requestAnimationFrame(() => modal.classList.add('is-open'));

  // Закрытие
  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 250);
  };

  modal.querySelector('[data-close]').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Кнопки смены статуса
  modal.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newStatus = btn.dataset.status;
      if (newStatus === order.status) return;

      btn.disabled = true;
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`
          },
          body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error('Ошибка обновления');

        // Обновляем локально
        order.status = newStatus;
        const local = ordersState.all.find(o => o.id === order.id);
        if (local) local.status = newStatus;

        // Обновляем UI модалки
        modal.querySelectorAll('[data-status]').forEach(b => {
          b.classList.toggle('is-current', b.dataset.status === newStatus);
        });

        ordersUpdateCounts();
        ordersRenderTable();

        showAdminToast(`Статус изменён: ${statusLabels[newStatus]}`);
      } catch (err) {
        console.error(err);
        showAdminToast('Не удалось изменить статус', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ============================================
// 9. Кнопки статусов
// ============================================
function renderStatusButtons(current) {
  const all = [
    { key: 'new', label: '🆕 Новый' },
    { key: 'confirmed', label: '✅ Подтверждён' },
    { key: 'baking', label: '🎂 Готовится' },
    { key: 'delivering', label: '🚚 В доставке' },
    { key: 'done', label: '🎉 Выполнен' },
    { key: 'cancelled', label: '❌ Отменён' }
  ];

  return all.map(s => `
    <button class="status-btn status-btn--${s.key} ${s.key === current ? 'is-current' : ''}" data-status="${s.key}">
      ${s.label}
    </button>
  `).join('');
}

// ============================================
// 10. Хелперы
// ============================================
function ordersFormatDate(str) {
  try {
    const d = new Date(str.replace(' ', 'T'));
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return str; }
}

function showAdminToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: ${type === 'error' ? '#ef4444' : '#1a1d2e'};
    color: #fff; padding: 12px 24px; border-radius: 100px;
    font-weight: 600; font-family: 'Manrope', sans-serif; font-size: 0.9rem;
    box-shadow: 0 20px 40px rgba(0,0,0,0.2); opacity: 0;
    transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1); z-index: 9999;
    pointer-events: none;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}