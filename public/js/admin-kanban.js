/* ============================================================
   АДМИН: КАНБАН ЗАКАЗОВ
   Визуальное управление статусами с drag & drop
   ============================================================ */

const kanbanState = {
  orders: [],
  draggedId: null,
  columns: [
    { key: 'new',        label: 'Новые',          color: '#E0B878' },
    { key: 'confirmed',  label: 'Подтверждённые',  color: '#78A8D8' },
    { key: 'baking',     label: 'Готовятся',       color: '#E8A87C' },
    { key: 'delivering', label: 'В доставке',      color: '#78D8D8' },
    { key: 'done',       label: 'Выполнены',       color: '#6BBF87' }
  ]
};

// ============================================================
// 1. Рендер страницы
// ============================================================
async function renderKanban(container) {
  container.innerHTML = `
    <div class="kanban-header">
      <div>
        <h2 class="kanban-header__title">Заказы — Канбан</h2>
        <p class="kanban-header__subtitle">Перетаскивайте карточки между статусами</p>
      </div>
      <div class="kanban-header__actions">
        <button class="btn-admin btn-admin--ghost" id="kanban-refresh">
          🔄 Обновить
        </button>
      </div>
    </div>

    <div class="kanban-board" id="kanban-board">
      <div class="admin-loading" style="min-height:400px;grid-column:1/-1;">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем заказы...</span>
      </div>
    </div>
  `;

  document.getElementById('kanban-refresh')?.addEventListener('click', () => kanbanLoad());
  await kanbanLoad();
}

// ============================================================
// 2. Загрузка заказов
// ============================================================
async function kanbanLoad() {
  const board = document.getElementById('kanban-board');
  if (!board) return;

  try {
    const res = await fetch('/api/admin/orders', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    const all = await res.json();

    // ✅ Исключаем отменённые (они отдельно)
    kanbanState.orders = all.filter(o => o.status !== 'cancelled');

    kanbanRenderBoard();
  } catch (err) {
    console.error(err);
    board.innerHTML = `
      <div class="orders-empty" style="grid-column:1/-1;">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить заказы</div>
      </div>
    `;
  }
}

// ============================================================
// 3. Рендер доски
// ============================================================
function kanbanRenderBoard() {
  const board = document.getElementById('kanban-board');
  if (!board) return;

  board.innerHTML = kanbanState.columns.map(col => {
    const orders = kanbanState.orders.filter(o => o.status === col.key);

    return `
      <div class="kanban-column" data-status="${col.key}">
        <div class="kanban-column__header" style="border-top-color: ${col.color};">
          <div class="kanban-column__title">
            <span class="kanban-column__dot" style="background: ${col.color};"></span>
            <span>${col.label}</span>
            <span class="kanban-column__count">${orders.length}</span>
          </div>
        </div>

        <div class="kanban-column__body" data-dropzone="${col.key}">
          ${orders.length === 0
            ? `<div class="kanban-empty">Нет заказов</div>`
            : orders.map(o => kanbanRenderCard(o)).join('')
          }
        </div>
      </div>
    `;
  }).join('');

  kanbanInitDragDrop();
  kanbanInitCardClicks();
}

// ============================================================
// 4. Карточка заказа
// ============================================================
function kanbanRenderCard(order) {
  const itemsCount = (order.items || []).reduce((s, i) => s + i.quantity, 0);

  // Время с момента создания
  const timeAgo = kanbanTimeAgo(order.created_at);

  // Есть ли кастомный торт?
  const hasCustom = (order.items || []).some(i => i.is_custom === 1);

  // Статус оплаты
  const paymentStatusText = order.payment_status === 'succeeded' ? 'Оплачен' :
                           order.payment_status === 'pending' ? 'Ожидает' : 'При получении';

  // Срочность — если заказ новый и создан > 30 мин назад
  const isUrgent = order.status === 'new' && kanbanMinutesSince(order.created_at) > 30;

  return `
    <div class="kanban-card ${isUrgent ? 'is-urgent' : ''}" draggable="true" data-id="${order.id}">
      <div class="kanban-card__header">
        <div class="kanban-card__id">№${order.id}</div>
        <div class="kanban-card__time">${timeAgo}</div>
      </div>

      <div class="kanban-card__customer">
        <div class="kanban-card__name">${kanbanEscape(order.customer_name)}</div>
        <div class="kanban-card__phone">${order.phone || ''}</div>
      </div>

      ${order.delivery_date || order.delivery_time ? `
        <div class="kanban-card__delivery">
          📅 ${order.delivery_date || '—'}${order.delivery_time ? ` · ${order.delivery_time}` : ''}
        </div>
      ` : ''}

      <div class="kanban-card__footer">
        <div class="kanban-card__meta">
          <span title="Позиций">${itemsCount} поз.</span>
          ${hasCustom ? '<span class="kanban-card__badge">ИНД</span>' : ''}
        </div>
        <div class="kanban-card__total">${order.total.toLocaleString('ru-RU')} ₽</div>
      </div>
    </div>
  `;
}

// ============================================================
// 5. Drag & Drop
// ============================================================
function kanbanInitDragDrop() {
  // Карточки — draggable
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      kanbanState.draggedId = parseInt(card.dataset.id, 10);
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      kanbanState.draggedId = null;
      document.querySelectorAll('.kanban-column__body').forEach(z => z.classList.remove('is-dragover'));
    });
  });

  // Зоны приёма
  document.querySelectorAll('.kanban-column__body').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('is-dragover');
    });

    zone.addEventListener('dragleave', (e) => {
      // Если ушли за пределы зоны
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('is-dragover');
      }
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragover');

      const newStatus = zone.dataset.dropzone;
      const orderId = kanbanState.draggedId;

      if (!orderId || !newStatus) return;

      const order = kanbanState.orders.find(o => o.id === orderId);
      if (!order || order.status === newStatus) return;

      // ✅ Оптимистичное обновление
      const oldStatus = order.status;
      order.status = newStatus;

      // Перерисовываем
      kanbanRenderBoard();

      try {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`
          },
          body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error('Ошибка');

        showAdminToast(`Заказ №${orderId}: ${kanbanStatusLabel(newStatus)}`);
      } catch (err) {
        // Откат
        order.status = oldStatus;
        kanbanRenderBoard();
        showAdminToast('Не удалось изменить статус', 'error');
      }
    });
  });
}

// ============================================================
// 6. Клик по карточке — открыть модалку заказа
// ============================================================
function kanbanInitCardClicks() {
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Если был drag — не открываем
      if (e.defaultPrevented) return;

      const id = parseInt(card.dataset.id, 10);
      // Используем существующую функцию из admin-orders.js
      if (typeof openOrder === 'function') {
        openOrder(id);
      }
    });
  });
}

// ============================================================
// 7. Утилиты
// ============================================================
function kanbanMinutesSince(dateStr) {
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    return Math.floor((Date.now() - d.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function kanbanTimeAgo(dateStr) {
  const min = kanbanMinutesSince(dateStr);

  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} ч назад`;
  return `${Math.floor(min / (24 * 60))} дн назад`;
}

function kanbanStatusLabel(status) {
  const map = {
    new: 'Новый',
    confirmed: 'Подтверждён',
    baking: 'Готовится',
    delivering: 'В доставке',
    done: 'Выполнен',
    cancelled: 'Отменён'
  };
  return map[status] || status;
}

function kanbanEscape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
