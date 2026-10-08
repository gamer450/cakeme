/* ============================================================
   АДМИН: ИСТОРИЯ ДЕЙСТВИЙ (Логи)
   ============================================================ */

const logsState = {
  all: [],
  total: 0,
  limit: 100,
  offset: 0,
  filters: {
    user_id: '',
    action: '',
    entity_type: 'all',
    date_from: '',
    date_to: '',
    search: ''
  },
  users: []
};

// ============================================================
// 1. Рендер страницы
// ============================================================
async function renderLogs(container) {
  container.innerHTML = `
    <div class="logs-header">
      <h2 class="logs-header__title">История действий <small id="logs-total"></small></h2>
      <div class="logs-header__actions">
        <button class="btn-export" id="logs-export">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Экспорт
        </button>
        <button class="btn-admin btn-admin--ghost" id="logs-cleanup" title="Удалить логи старше 90 дней">
          🗑️ Очистить старые
        </button>
      </div>
    </div>

    <!-- Фильтры -->
    <div class="logs-filters">
      <div class="logs-filters__row">
        <div class="logs-filter">
          <label>Пользователь</label>
          <select id="log-user">
            <option value="">Все</option>
          </select>
        </div>

        <div class="logs-filter">
          <label>Тип объекта</label>
          <select id="log-entity">
            <option value="all">Все</option>
            <option value="product">Товар</option>
            <option value="category">Категория</option>
            <option value="order">Заказ</option>
            <option value="user">Пользователь</option>
            <option value="partner">Партнёр</option>
            <option value="review">Отзыв</option>
            <option value="settings">Настройки</option>
            <option value="constructor">Конструктор</option>
            <option value="media">Медиа</option>
            <option value="backup">Бэкап</option>
          </select>
        </div>

        <div class="logs-filter">
          <label>От</label>
          <input type="date" id="log-from" />
        </div>

        <div class="logs-filter">
          <label>До</label>
          <input type="date" id="log-to" />
        </div>
      </div>

      <div class="logs-filters__row">
        <div class="logs-filter logs-filter--wide">
          <label>Поиск</label>
          <input type="text" id="log-search" placeholder="По имени, действию, деталям..." />
        </div>

        <div class="logs-filter logs-filter--narrow">
          <label>&nbsp;</label>
          <button class="btn-admin btn-admin--ghost" id="logs-reset">Сбросить</button>
        </div>
      </div>
    </div>

    <!-- Таблица -->
    <div class="logs-table-wrap" id="logs-table-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем историю...</span>
      </div>
    </div>

    <!-- Пагинация -->
    <div class="logs-pagination" id="logs-pagination"></div>
  `;

  await logsLoadUsers();
  initLogsFilters();
  initLogsExport();
  initLogsCleanup();

  await logsLoad();
}

// ============================================================
// 2. Загрузка пользователей для фильтра
// ============================================================
async function logsLoadUsers() {
  try {
    const res = await fetch('/api/admin/logs/users', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) return;

    logsState.users = await res.json();

    const select = document.getElementById('log-user');
    if (select) {
      logsState.users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.user_id;
        opt.textContent = `${u.user_name} (${u.user_role})`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Ошибка загрузки пользователей:', err);
  }
}

// ============================================================
// 3. Загрузка логов
// ============================================================
async function logsLoad() {
  const wrap = document.getElementById('logs-table-wrap');
  if (!wrap) return;

  try {
    const params = new URLSearchParams();
    params.set('limit', logsState.limit);
    params.set('offset', logsState.offset);

    Object.entries(logsState.filters).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v);
    });

    const res = await fetch(`/api/admin/logs?${params}`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    const data = await res.json();

    logsState.all = data.logs;
    logsState.total = data.total;

    document.getElementById('logs-total').textContent = `(${data.total})`;
    logsRenderTable();
    logsRenderPagination();
  } catch (err) {
    console.error(err);
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить историю</div>
      </div>
    `;
  }
}

// ============================================================
// 4. Таблица
// ============================================================
function logsRenderTable() {
  const wrap = document.getElementById('logs-table-wrap');
  if (!wrap) return;

  if (logsState.all.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">📝</div>
        <div class="orders-empty__title">Записей не найдено</div>
        <p>Попробуйте изменить фильтры</p>
      </div>
    `;
    return;
  }

  const entityIcons = {
    product: '🎂',
    category: '🏷️',
    order: '📦',
    user: '👤',
    partner: '🤝',
    review: '⭐',
    settings: '⚙️',
    constructor: '🧁',
    media: '🖼️',
    backup: '💾',
    security: '🔒',
    activity: '📝'
  };

  wrap.innerHTML = `
    <table class="logs-table">
      <thead>
        <tr>
          <th style="width:160px">Когда</th>
          <th style="width:180px">Кто</th>
          <th>Действие</th>
          <th style="width:140px">IP</th>
        </tr>
      </thead>
      <tbody>
        ${logsState.all.map(l => {
          const icon = entityIcons[l.entity_type] || '•';
          const dateFormatted = logsFormatDate(l.created_at);

          return `
            <tr>
              <td>
                <div class="logs-date">${dateFormatted.date}</div>
                <div class="logs-time">${dateFormatted.time}</div>
              </td>
              <td>
                <div class="logs-user">
                  <span class="logs-user__name">${l.user_name || '—'}</span>
                  <span class="logs-user__role">${roleLabel(l.user_role)}</span>
                </div>
              </td>
              <td>
                <div class="logs-action">
                  <span class="logs-action__icon">${icon}</span>
                  <span class="logs-action__text">${l.action}</span>
                </div>
                ${l.meta_parsed ? `<details class="logs-meta"><summary>Детали</summary><pre>${JSON.stringify(l.meta_parsed, null, 2)}</pre></details>` : ''}
              </td>
              <td>
                <span class="logs-ip">${l.ip || '—'}</span>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ============================================================
// 5. Пагинация
// ============================================================
function logsRenderPagination() {
  const wrap = document.getElementById('logs-pagination');
  if (!wrap) return;

  const { total, limit, offset } = logsState;
  const pages = Math.ceil(total / limit);
  const current = Math.floor(offset / limit) + 1;

  if (pages <= 1) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = `
    <button class="logs-page-btn" id="logs-prev" ${current <= 1 ? 'disabled' : ''}>← Назад</button>
    <span class="logs-page-info">Страница <strong>${current}</strong> из ${pages}</span>
    <button class="logs-page-btn" id="logs-next" ${current >= pages ? 'disabled' : ''}>Вперёд →</button>
  `;

  document.getElementById('logs-prev')?.addEventListener('click', () => {
    if (current <= 1) return;
    logsState.offset = Math.max(0, offset - limit);
    logsLoad();
  });

  document.getElementById('logs-next')?.addEventListener('click', () => {
    if (current >= pages) return;
    logsState.offset = offset + limit;
    logsLoad();
  });
}

// ============================================================
// 6. Фильтры
// ============================================================
function initLogsFilters() {
  const select = document.getElementById('log-user');
  const entity = document.getElementById('log-entity');
  const from = document.getElementById('log-from');
  const to = document.getElementById('log-to');
  const search = document.getElementById('log-search');

  select?.addEventListener('change', () => {
    logsState.filters.user_id = select.value;
    logsState.offset = 0;
    logsLoad();
  });

  entity?.addEventListener('change', () => {
    logsState.filters.entity_type = entity.value;
    logsState.offset = 0;
    logsLoad();
  });

  from?.addEventListener('change', () => {
    logsState.filters.date_from = from.value;
    logsState.offset = 0;
    logsLoad();
  });

  to?.addEventListener('change', () => {
    logsState.filters.date_to = to.value;
    logsState.offset = 0;
    logsLoad();
  });

  let searchTimer;
  search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      logsState.filters.search = search.value;
      logsState.offset = 0;
      logsLoad();
    }, 400);
  });

  document.getElementById('logs-reset')?.addEventListener('click', () => {
    logsState.filters = {
      user_id: '',
      action: '',
      entity_type: 'all',
      date_from: '',
      date_to: '',
      search: ''
    };
    logsState.offset = 0;

    if (select) select.value = '';
    if (entity) entity.value = 'all';
    if (from) from.value = '';
    if (to) to.value = '';
    if (search) search.value = '';

    logsLoad();
  });
}

// ============================================================
// 7. Экспорт в Excel
// ============================================================
function initLogsExport() {
  document.getElementById('logs-export')?.addEventListener('click', () => {
    if (typeof XLSX === 'undefined') {
      showAdminToast('Библиотека Excel не загрузилась', 'error');
      return;
    }

    if (logsState.all.length === 0) {
      showAdminToast('Нет данных для экспорта', 'error');
      return;
    }

    const data = logsState.all.map(l => ({
      'Дата': l.created_at,
      'Пользователь': l.user_name || '—',
      'Роль': roleLabel(l.user_role),
      'Действие': l.action,
      'Тип объекта': l.entity_type || '—',
      'ID объекта': l.entity_id || '—',
      'IP': l.ip || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 40 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'История');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `История_${dateStr}.xlsx`);

    showAdminToast(`Экспортировано ${data.length} записей`);
  });
}

// ============================================================
// 8. Очистка старых логов
// ============================================================
function initLogsCleanup() {
  document.getElementById('logs-cleanup')?.addEventListener('click', async () => {
    if (!confirm('Удалить все записи старше 90 дней?\n\nЭто действие необратимо.')) return;

    try {
      const res = await fetch('/api/admin/logs/cleanup?days=90', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${state.token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showAdminToast(`Удалено ${data.deleted} записей`);
      logsState.offset = 0;
      await logsLoad();
    } catch (err) {
      showAdminToast(err.message || 'Ошибка очистки', 'error');
    }
  });
}

// ============================================================
// 9. Утилиты
// ============================================================
function logsFormatDate(str) {
  try {
    const d = new Date(str.replace(' ', 'T'));
    return {
      date: d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };
  } catch {
    return { date: str, time: '' };
  }
}

function roleLabel(role) {
  const map = { admin: 'Админ', manager: 'Менеджер', client: 'Клиент' };
  return map[role] || role || '—';
}