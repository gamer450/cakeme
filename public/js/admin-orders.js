/* ============================================
   АДМИН: УПРАВЛЕНИЕ ЗАКАЗАМИ
   v1.1 — показ способа оплаты в модалке
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


const paymentLabels = {
  cash: 'При получении',
  card: 'Онлайн (карта)'
};
// ============================================
// 1. Рендер страницы
// ============================================
async function renderOrders(container) {
  container.innerHTML = `

      <div class="orders-topbar">
      <h2 class="orders-topbar__title">Заказы <small id="orders-total-count"></small></h2>
      <div class="orders-topbar__actions">
        <button class="btn-export" id="orders-export-excel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Экспорт в Excel
        </button>
      </div>
    </div>

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
  initOrdersExport();
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

  // ✅ Счётчик в верхней панели
  const totalEl = document.getElementById('orders-total-count');
  if (totalEl) {
    totalEl.textContent = `(${ordersState.all.length})`;
  }
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
  const wrap = document.getElementById('orders-table-wrap');

  // ✅ ФИКС: выходим, если таблицы нет в DOM (например, мы на канбане)
  if (!wrap) return;

  const list = getFiltered();

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
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
              <div class="orders-table__customer">${escapeHtml(o.customer_name)}</div>
            </td>
            <td>
              <span class="orders-table__phone">${escapeHtml(o.phone || '—')}</span>
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

  // ✅ Показываем способ + статус оплаты
  const paymentStatusLabels = {
    'pending': 'Ожидает оплаты',
    'succeeded': 'Оплачен',
    'canceled': 'Отменён',
    'refunded': 'Возврат',
    'cash_on_delivery': 'При получении'
  };

  const paymentStatusColors = {
    'pending': '#E0B878',
    'succeeded': '#6BBF87',
    'canceled': '#E07878',
    'refunded': '#78A8D8',
    'cash_on_delivery': '#A89888'
  };

  const paymentHtml = order.payment
    ? `
      <div class="modal__info-item">
        <div class="modal__info-label">Способ оплаты</div>
        <div class="modal__info-value">${paymentLabels[order.payment] || order.payment}</div>
      </div>
      <div class="modal__info-item">
        <div class="modal__info-label">Статус оплаты</div>
        <div class="modal__info-value" style="color:${paymentStatusColors[order.payment_status] || '#A89888'};">
          ${paymentStatusLabels[order.payment_status] || order.payment_status || '—'}
        </div>
      </div>
      ${order.paid_at ? `
        <div class="modal__info-item">
          <div class="modal__info-label">Оплачено</div>
          <div class="modal__info-value">${ordersFormatDate(order.paid_at)}</div>
        </div>
      ` : ''}
    `
    : '';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner">
      <div class="modal__header">
        <div class="modal__title">Заказ №${order.id}</div>
        <div style="display:flex; gap:8px; align-items:center;">
          ${order.payment_status === 'succeeded' && order.payment === 'card' ? `
            <button class="btn-refund-order" id="refund-order-btn" title="Вернуть деньги">
              ↩ Возврат
            </button>
          ` : ''}
          <button class="btn-print-order" id="print-order-btn" title="Печать чека">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Печать
          </button>
          <button class="modal__close" data-close>✕</button>
        </div>
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
            ${paymentHtml}
            <div class="modal__info-item">
              <div class="modal__info-label">Способ получения</div>
              <div class="modal__info-value">
                ${order.delivery_method === 'pickup' ? '🏬 Самовывоз' : '🚗 Доставка'}
              </div>
            </div>
            ${order.address && order.delivery_method !== 'pickup' ? `
              <div class="modal__info-item" style="grid-column: 1 / -1;">
                <div class="modal__info-label">Адрес доставки</div>
                <div class="modal__info-value">${order.address}</div>
              </div>
            ` : ''}
            ${order.delivery_method === 'pickup' ? `
              <div class="modal__info-item" style="grid-column: 1 / -1;">
                <div class="modal__info-label">Адрес самовывоза</div>
                <div class="modal__info-value">${window.SITE_SETTINGS?.address || 'г. Москва, ул. Сладкая, 1'}</div>
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
            ${order.items.map(i => {
              // ✅ Кастомный торт — специальная карточка
              if (i.is_custom === 1) {
                let params = {};
                try {
                  params = i.custom_params ? JSON.parse(i.custom_params) : {};
                } catch {}

                return `
                  <div class="modal-item modal-item--custom">
                    <div style="flex:1; min-width:0;">
                      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <strong>Индивидуальный торт</strong>
                        <span class="modal-item__qty">× ${i.quantity}</span>
                      </div>
                      <div style="display:flex; flex-direction:column; gap:3px; font-size:0.8rem; color:var(--admin-text-muted); padding-left:28px;">
                        ${params.shape ? `<div>• Форма: <strong style="color:var(--admin-text);">${params.shape}</strong></div>` : ''}
                        ${params.weight ? `<div>• Вес: <strong style="color:var(--admin-text);">${params.weight}</strong></div>` : ''}
                        ${params.filling ? `<div>• Начинка: <strong style="color:var(--admin-text);">${params.filling}</strong></div>` : ''}
                        ${params.decor ? `<div>• Декор: <strong style="color:var(--admin-text);">${params.decor}</strong></div>` : ''}
                      </div>
                    </div>
                    <div class="modal-item__price">${(i.price * i.quantity).toLocaleString('ru-RU')} ₽</div>
                  </div>
                `;
              }

              // Обычный товар
              return `
                <div class="modal-item">
                  <div>
                    <span class="modal-item__name">${i.product_name}</span>
                    <span class="modal-item__qty">× ${i.quantity}</span>
                  </div>
                  <div class="modal-item__price">${(i.price * i.quantity).toLocaleString('ru-RU')} ₽</div>
                </div>
              `;
            }).join('')}
          </div>

          ${order.cake_inscription ? `
            <div class="modal-inscription">
              <div class="modal-inscription__label">Надпись на торте</div>
              <div class="modal-inscription__text">«${order.cake_inscription}»</div>
            </div>
          ` : ''}

                    ${order.cake_photo ? `
            <div class="modal-photo" style="margin-top: 16px;">
              <div class="modal-inscription__label" style="margin-bottom: 12px;">🖼️ Фотопечать на торте</div>
              <div style="display: flex; gap: 16px; align-items: flex-start; padding: 14px; background: var(--admin-bg); border: 1px solid var(--admin-border-gold); border-radius: var(--admin-radius-md);">
                <a href="${order.cake_photo}" target="_blank" rel="noopener" style="flex-shrink: 0; display: block; width: 120px; height: 120px; border-radius: var(--admin-radius-sm); overflow: hidden; border: 1px solid var(--admin-border); transition: transform 0.2s ease;">
                  <img src="${order.cake_photo}" alt="Фото на торт" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
                </a>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                  <div style="font-size: 0.85rem; color: var(--admin-text);">
                    <strong>Цена:</strong> ${(order.cake_photo_price || 0).toLocaleString('ru-RU')} ₽
                  </div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <a href="${order.cake_photo}" target="_blank" rel="noopener" class="btn-print-order" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                      🔍 Открыть фото
                    </a>
                    <a href="${order.cake_photo}" download class="btn-print-order" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                      💾 Скачать
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          ${order.extras ? (() => {
            try {
              const extras = JSON.parse(order.extras);
              if (!extras.length) return '';
              return `
                <div class="modal-extras">
                  <div class="modal-extras__label">Доп. услуги</div>
                  ${extras.map(e => `
                    <div class="modal-extras__item">
                      <span>${e.name}</span>
                      <span>+${(e.price * (e.quantity || 1)).toLocaleString('ru-RU')} ₽</span>
                    </div>
                  `).join('')}
                </div>
              `;
            } catch { return ''; }
          })() : ''}
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

  requestAnimationFrame(() => modal.classList.add('is-open'));

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 250);
  };

  modal.querySelector('[data-close]').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

    // ✅ Кнопка печати
  document.getElementById('print-order-btn')?.addEventListener('click', () => {
    printOrder(order);
  });

    // ✅ Кнопка возврата
  document.getElementById('refund-order-btn')?.addEventListener('click', async () => {
    if (!confirm(`Вернуть ${order.total.toLocaleString('ru-RU')} ₽ по заказу №${order.id}?\n\nДеньги вернутся клиенту на карту в течение 3-5 дней.`)) return;

    const btn = document.getElementById('refund-order-btn');
    btn.disabled = true;
    btn.textContent = 'Возврат...';

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      showAdminToast('Возврат оформлен. Деньги придут клиенту в течение 3-5 дней');
      close();
      await ordersLoad();
    } catch (err) {
      showAdminToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Возврат';
    }
  });

  modal.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newStatus = btn.dataset.status;
      if (newStatus === order.status) return;

      // ✅ Индикация загрузки
      btn.disabled = true;
      btn.style.opacity = '0.6';
      const originalText = btn.textContent;
      btn.textContent = '...';

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

        // ✅ Оптимистичное обновление
        order.status = newStatus;
        const local = ordersState.all.find(o => o.id === order.id);
        if (local) local.status = newStatus;

        modal.querySelectorAll('[data-status]').forEach(b => {
          b.classList.toggle('is-current', b.dataset.status === newStatus);
        });

        ordersUpdateCounts();
        ordersRenderTable();

        // ✅ ФИКС: если открыт канбан — обновляем его
        if (typeof kanbanLoad === 'function' && document.getElementById('kanban-board')) {
          kanbanLoad();
        }

        showAdminToast(`Статус изменён: ${statusLabels[newStatus]}`);
      } catch (err) {
        console.error(err);
        showAdminToast('Не удалось изменить статус', 'error');
      } finally {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.textContent = originalText;
      }
    });
  });
}

// ============================================
// 9. Кнопки статусов
// ============================================
function renderStatusButtons(current) {
  const all = [
    { key: 'new', label: 'Новый' },
    { key: 'confirmed', label: 'Подтверждён' },
    { key: 'baking', label: 'Готовится' },
    { key: 'delivering', label: 'В доставке' },
    { key: 'done', label: 'Выполнен' },
    { key: 'cancelled', label: 'Отменён' }
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
// ============================================
// 11. ЭКСПОРТ В EXCEL
// ============================================
function initOrdersExport() {
  document.getElementById('orders-export-excel')?.addEventListener('click', exportOrdersToExcel);
}

function exportOrdersToExcel() {
  // Проверяем, что библиотека загрузилась
  if (typeof XLSX === 'undefined') {
    showAdminToast('Библиотека Excel не загрузилась. Проверьте интернет.', 'error');
    return;
  }

  const orders = ordersState.all;

  if (orders.length === 0) {
    showAdminToast('Нет заказов для экспорта', 'error');
    return;
  }

  // Определяем какой статус выгружаем — активный фильтр
  const filtered = ordersState.filter === 'all'
    ? orders
    : orders.filter(o => o.status === ordersState.filter);

  const data = filtered.map(o => {
    // Состав заказа одной строкой
    const itemsText = (o.items || [])
      .map(i => `${i.product_name} × ${i.quantity}`)
      .join('; ');

    // Общее количество позиций
    const totalItems = (o.items || []).reduce((s, i) => s + i.quantity, 0);

    // Способ оплаты расшифровка
    const paymentText = o.payment === 'card' ? 'Онлайн' : 'При получении';

    // Дата в удобном формате
    const dateFormatted = o.created_at
      ? new Date(o.created_at.replace(' ', 'T')).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';

    return {
      '№ заказа': o.id,
      'Дата': dateFormatted,
      'Статус': statusLabels[o.status] || o.status,
      'Клиент': o.customer_name,
      'Телефон': o.phone || '',
      'Email': o.email || '',
      'Адрес доставки': o.address || '',
      'Комментарий': o.comment || '',
      'Товары': itemsText,
      'Кол-во позиций': totalItems,
      'Сумма, ₽': o.total,
      'Способ оплаты': paymentText,
      'Надпись на торте': o.cake_inscription || '',
      'Фото на торте': o.cake_photo ? 'Да' : 'Нет',
      'Фото (URL)': o.cake_photo || ''
    };
  });

  // Итоговая строка
  const totalSum = data.reduce((s, r) => s + r['Сумма, ₽'], 0);
  const totalQty = data.reduce((s, r) => s + r['Кол-во позиций'], 0);

  data.push({
    '№ заказа': 'ИТОГО',
    'Дата': '',
    'Статус': '',
    'Клиент': '',
    'Телефон': '',
    'Email': '',
    'Адрес доставки': '',
    'Комментарий': '',
    'Товары': `${data.length - 1} заказов`,
    'Кол-во позиций': totalQty,
    'Сумма, ₽': totalSum,
    'Способ оплаты': ''
  });

  // Создаём книгу
  const ws = XLSX.utils.json_to_sheet(data);

  // Настраиваем ширину колонок
  ws['!cols'] = [
    { wch: 10 },  // №
    { wch: 18 },  // Дата
    { wch: 14 },  // Статус
    { wch: 22 },  // Клиент
    { wch: 18 },  // Телефон
    { wch: 24 },  // Email
    { wch: 30 },  // Адрес
    { wch: 30 },  // Комментарий
    { wch: 50 },  // Товары
    { wch: 12 },  // Кол-во
    { wch: 12 },  // Сумма
    { wch: 16 },  // Оплата
    { wch: 30 },  // Надпись
    { wch: 12 },  // Фото на торте
    { wch: 50 }   // Фото URL
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Заказы');

  // Имя файла с датой
  const dateStr = new Date().toISOString().slice(0, 10);
  const filterName = ordersState.filter === 'all' ? 'все' : statusLabels[ordersState.filter] || ordersState.filter;
  const fileName = `Заказы_${filterName}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);

  showAdminToast(`Экспортировано ${data.length - 1} заказов`);
}