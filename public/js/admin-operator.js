/* ============================================================
   АДМИН: ЗАЯВКИ ОПЕРАТОРУ
   ============================================================ */

const operatorState = {
  requests: [],
  counts: { new_count: 0, in_progress: 0, answered: 0, closed: 0, total: 0 },
  filter: 'all',
  search: '',
  currentId: null
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderOperator(container) {
  container.innerHTML = `
    <div class="operator-admin-header" style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
      <div>
        <h2 style="font-family:var(--admin-font-display);font-size:1.5rem;font-weight:400;color:var(--admin-text);letter-spacing:-0.02em;margin:0 0 4px;">
          Заявки оператору <small id="operator-total" style="font-family:var(--admin-font-mono);font-size:0.85rem;color:var(--admin-text-muted);font-weight:400;"></small>
        </h2>
        <p style="font-size:0.85rem;color:var(--admin-text-muted);margin:0;">
          Заявки с формы «Связаться с оператором» на сайте
        </p>
      </div>
    </div>

    <!-- Табы -->
    <div class="operator-tabs" style="display:flex;gap:4px;background:var(--admin-card);padding:4px;border-radius:var(--admin-radius-md);border:1px solid var(--admin-border);margin-bottom:24px;overflow-x:auto;scrollbar-width:none;">
      <button class="operator-tab is-active" data-filter="all">
        Все <span class="operator-tab__count" data-count="total">0</span>
      </button>
      <button class="operator-tab" data-filter="new">
        🆕 Новые <span class="operator-tab__count" data-count="new">0</span>
      </button>
      <button class="operator-tab" data-filter="in_progress">
        ⏳ В работе <span class="operator-tab__count" data-count="in_progress">0</span>
      </button>
      <button class="operator-tab" data-filter="answered">
        ✅ Отвечено <span class="operator-tab__count" data-count="answered">0</span>
      </button>
      <button class="operator-tab" data-filter="closed">
        📁 Закрыто <span class="operator-tab__count" data-count="closed">0</span>
      </button>
    </div>

    <!-- Поиск -->
    <div style="margin-bottom:20px;">
      <input type="text"
             id="operator-search"
             placeholder="Поиск по имени, телефону, email, тексту..."
             style="width:100%;max-width:500px;padding:10px 14px;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:var(--admin-radius-md);color:var(--admin-text);font-family:inherit;font-size:0.9rem;" />
    </div>

    <!-- Список -->
    <div id="operator-list">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем заявки...</span>
      </div>
    </div>
  `;

  initOperatorTabs();
  initOperatorSearch();
  await operatorLoad();
}

// ============================================
// 2. Загрузка
// ============================================
async function operatorLoad() {
  try {
    const params = new URLSearchParams();
    if (operatorState.filter !== 'all') {
      params.set('status', operatorState.filter);
    }
    if (operatorState.search.trim()) {
      params.set('search', operatorState.search.trim());
    }

    const res = await fetch(`/api/admin/operator-requests?${params}`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    const data = await res.json();

    operatorState.requests = data.requests;
    operatorState.counts = data.counts;

    // Обновляем счётчики в табах
    document.getElementById('operator-total').textContent = `(${data.counts.total})`;
    document.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.count;
      const map = {
        total: data.counts.total,
        new: data.counts.new_count,
        in_progress: data.counts.progress_count,
        answered: data.counts.answered_count,
        closed: data.counts.closed_count
      };
      el.textContent = map[key] || 0;
    });

    operatorRenderList();
  } catch (err) {
    console.error('Ошибка загрузки заявок:', err);
    document.getElementById('operator-list').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить заявки</div>
      </div>
    `;
  }
}

// ============================================
// 3. Список
// ============================================
function operatorRenderList() {
  const list = document.getElementById('operator-list');
  if (!list) return;

  if (operatorState.requests.length === 0) {
    list.innerHTML = `
      <div class="orders-empty" style="background:var(--admin-card);border:1px dashed var(--admin-border);border-radius:var(--admin-radius-lg);padding:80px 20px;">
        <div class="orders-empty__icon">💬</div>
        <div class="orders-empty__title">Заявок пока нет</div>
        <p style="color:var(--admin-text-muted);font-size:0.9rem;">
          ${operatorState.filter === 'all' ? 'Когда клиенты оставят заявку — они появятся здесь' : 'В этом фильтре заявок нет'}
        </p>
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${operatorState.requests.map(r => operatorRenderCard(r)).join('')}
    </div>
  `;

  // Обработчики
  list.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      operatorOpenModal(parseInt(btn.dataset.open, 10));
    });
  });
}

// ============================================
// 4. Карточка заявки
// ============================================
function operatorRenderCard(r) {
  const statusMap = {
    new:          { label: 'Новая',      color: '#E0B878', bg: 'rgba(224, 184, 120, 0.15)', border: 'rgba(224, 184, 120, 0.3)' },
    in_progress:  { label: 'В работе',   color: '#78A8D8', bg: 'rgba(120, 168, 216, 0.15)', border: 'rgba(120, 168, 216, 0.3)' },
    answered:     { label: 'Отвечено',   color: '#6BBF87', bg: 'rgba(107, 191, 135, 0.15)', border: 'rgba(107, 191, 135, 0.3)' },
    closed:       { label: 'Закрыто',    color: '#A89888', bg: 'rgba(168, 152, 136, 0.15)', border: 'rgba(168, 152, 136, 0.3)' }
  };
  const st = statusMap[r.status] || statusMap.new;

  const date = new Date(r.created_at.replace(' ', 'T')).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return `
    <div class="operator-card" style="background:var(--admin-card);border:1px solid var(--admin-border);border-radius:var(--admin-radius-lg);padding:20px 24px;transition:all 0.2s ease;position:relative;overflow:hidden;">
      <!-- Цветная полоска статуса слева -->
      <div style="position:absolute;top:0;left:0;width:3px;height:100%;background:${st.color};"></div>

      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="display:flex;flex-direction:column;gap:4px;min-width:0;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <strong style="font-size:1.05rem;color:var(--admin-text);font-weight:600;">
              ${escapeHtml(r.name)}
            </strong>
            <span style="display:inline-block;padding:3px 10px;border-radius:100px;font-family:var(--admin-font-mono);font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;background:${st.bg};color:${st.color};border:1px solid ${st.border};">
              ${st.label}
            </span>
          </div>
          <div style="display:flex;gap:16px;font-size:0.85rem;color:var(--admin-text-muted);flex-wrap:wrap;">
            <span>📞 ${escapeHtml(r.phone)}</span>
            ${r.email ? `<span>📧 ${escapeHtml(r.email)}</span>` : ''}
          </div>
        </div>
        <div style="font-family:var(--admin-font-mono);font-size:0.75rem;color:var(--admin-text-muted);white-space:nowrap;text-align:right;">
          ${date}
        </div>
      </div>

      ${r.message ? `
        <div style="padding:12px 16px;background:var(--admin-bg);border-radius:var(--admin-radius-md);font-size:0.9rem;color:var(--admin-text);line-height:1.6;margin-bottom:14px;border-left:2px solid var(--admin-border);">
          ${escapeHtml(r.message)}
        </div>
      ` : ''}

      ${r.page_url ? `
        <div style="font-family:var(--admin-font-mono);font-size:0.7rem;color:var(--admin-text-dim);margin-bottom:14px;">
          📍 ${escapeHtml(r.page_url)}
        </div>
      ` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--admin-border);">
        <button data-open="${r.id}"
                style="padding:8px 16px;background:linear-gradient(135deg,var(--admin-accent) 0%,var(--admin-accent-2) 100%);color:var(--admin-sidebar);border:none;border-radius:var(--admin-radius-md);font-family:inherit;font-size:0.8rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          Открыть
        </button>
        ${r.status !== 'closed' ? `
          <button data-quick-status="answered" data-id="${r.id}"
                  style="padding:8px 16px;background:var(--admin-success-bg);color:var(--admin-success);border:1px solid rgba(107,191,135,0.3);border-radius:var(--admin-radius-md);font-family:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;">
            ✅ Отвечено
          </button>
        ` : ''}
        ${r.status !== 'closed' ? `
          <button data-quick-status="closed" data-id="${r.id}"
                  style="padding:8px 16px;background:var(--admin-elevated);color:var(--admin-text-muted);border:1px solid var(--admin-border);border-radius:var(--admin-radius-md);font-family:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;">
            📁 Закрыть
          </button>
        ` : ''}
      </div>
    </div>
  `;

  // Прикрепим обработчики — сделаем в родителе
}

// ============================================
// 5. Табы
// ============================================
function initOperatorTabs() {
  document.querySelectorAll('.operator-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.operator-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      operatorState.filter = tab.dataset.filter;
      operatorLoad();
    });
  });
}

// ============================================
// 6. Поиск
// ============================================
let operatorSearchTimer;
function initOperatorSearch() {
  document.getElementById('operator-search')?.addEventListener('input', (e) => {
    clearTimeout(operatorSearchTimer);
    operatorSearchTimer = setTimeout(() => {
      operatorState.search = e.target.value;
      operatorLoad();
    }, 300);
  });
}

// ============================================
// 7. Модалка заявки
// ============================================
function operatorOpenModal(id) {
  const r = operatorState.requests.find(x => x.id === id);
  if (!r) return;

  operatorState.currentId = id;

  const statusMap = {
    new: 'Новая',
    in_progress: 'В работе',
    answered: 'Отвечено',
    closed: 'Закрыто'
  };

  const date = new Date(r.created_at.replace(' ', 'T')).toLocaleString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 600px;">
      <div class="modal__header">
        <div class="modal__title">Заявка №${r.id}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <div class="modal__section">
          <div class="modal__section-title">Клиент</div>
          <div class="modal__info-grid">
            <div class="modal__info-item">
              <div class="modal__info-label">Имя</div>
              <div class="modal__info-value">${escapeHtml(r.name)}</div>
            </div>
            <div class="modal__info-item">
              <div class="modal__info-label">Телефон</div>
              <div class="modal__info-value">
                <a href="tel:${r.phone.replace(/\D/g, '')}" style="color:var(--admin-gold-bright);text-decoration:none;">
                  ${escapeHtml(r.phone)}
                </a>
              </div>
            </div>
            ${r.email ? `
              <div class="modal__info-item">
                <div class="modal__info-label">Email</div>
                <div class="modal__info-value">
                  <a href="mailto:${escapeHtml(r.email)}" style="color:var(--admin-gold-bright);text-decoration:none;">
                    ${escapeHtml(r.email)}
                  </a>
                </div>
              </div>
            ` : ''}
            <div class="modal__info-item">
              <div class="modal__info-label">Дата</div>
              <div class="modal__info-value">${date}</div>
            </div>
            ${r.page_url ? `
              <div class="modal__info-item" style="grid-column: 1 / -1;">
                <div class="modal__info-label">Откуда пришла</div>
                <div class="modal__info-value" style="font-family:var(--admin-font-mono);font-size:0.75rem;color:var(--admin-text-muted);word-break:break-all;">
                  ${escapeHtml(r.page_url)}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        ${r.message ? `
          <div class="modal__section">
            <div class="modal__section-title">Сообщение</div>
            <div style="padding:16px;background:var(--admin-bg);border-radius:var(--admin-radius-md);border-left:3px solid var(--admin-accent);font-size:0.95rem;color:var(--admin-text);line-height:1.7;white-space:pre-wrap;">
              ${escapeHtml(r.message)}
            </div>
          </div>
        ` : ''}

        <div class="modal__section">
          <div class="modal__section-title">Статус</div>
          <div class="status-actions">
            <button class="status-btn ${r.status === 'new' ? 'is-current status-btn--new' : ''}" data-status="new">
              🆕 Новая
            </button>
            <button class="status-btn ${r.status === 'in_progress' ? 'is-current status-btn--confirmed' : ''}" data-status="in_progress">
              ⏳ В работе
            </button>
            <button class="status-btn ${r.status === 'answered' ? 'is-current status-btn--done' : ''}" data-status="answered">
              ✅ Отвечено
            </button>
            <button class="status-btn ${r.status === 'closed' ? 'is-current status-btn--cancelled' : ''}" data-status="closed">
              📁 Закрыто
            </button>
          </div>
        </div>

        <div class="modal__section">
          <div class="modal__section-title">Заметка менеджера</div>
          <textarea id="operator-comment"
                    style="width:100%;padding:12px 16px;background:var(--admin-elevated);border:1px solid var(--admin-border);border-radius:var(--admin-radius-md);color:var(--admin-text);font-family:inherit;font-size:0.9rem;min-height:80px;resize:vertical;"
                    placeholder="Например: «Позвонили, уточнили детали. Клиент закажет завтра»">${r.admin_comment || ''}</textarea>
        </div>

        <div class="modal__section" style="display:flex;gap:12px;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid var(--admin-border);">
          <button class="btn-danger" id="operator-delete-btn" style="padding:10px 16px;font-size:0.8rem;">
            🗑️ Удалить
          </button>
          <div style="display:flex;gap:12px;">
            <button class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button class="btn-admin btn-admin--primary" id="operator-save-btn">
              💾 Сохранить
            </button>
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

  // Закрытие
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => e.target === modal && close());

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // ============ Смена статуса ============
  let selectedStatus = r.status;
  modal.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('[data-status]').forEach(b => b.classList.remove('is-current'));
      btn.classList.add('is-current');
      selectedStatus = btn.dataset.status;
    });
  });

  // ============ Сохранить ============
  document.getElementById('operator-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('operator-save-btn');
    const comment = document.getElementById('operator-comment').value.trim();

    btn.disabled = true;
    btn.textContent = 'Сохраняем...';

    try {
      const res = await fetch(`/api/admin/operator-requests/${r.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`
        },
        body: JSON.stringify({
          status: selectedStatus,
          admin_comment: comment
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      showAdminToast('Заявка обновлена');
      close();
      await operatorLoad();
      updateOperatorBadge();
    } catch (err) {
      showAdminToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '💾 Сохранить';
    }
  });

  // ============ Удалить ============
  document.getElementById('operator-delete-btn').addEventListener('click', async () => {
    if (!confirm(`Удалить заявку №${r.id} от «${r.name}»?`)) return;

    try {
      const res = await fetch(`/api/admin/operator-requests/${r.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${state.token}` }
      });

      if (!res.ok) throw new Error('Ошибка удаления');

      showAdminToast('Заявка удалена');
      close();
      await operatorLoad();
      updateOperatorBadge();
    } catch (err) {
      showAdminToast(err.message, 'error');
    }
  });
}

// ============================================
// 8. Быстрая смена статуса (кнопки в карточке)
// ✅ ФИКС: обработчик ставится один раз
// ============================================
if (!window.__operatorQuickStatusBound) {
  window.__operatorQuickStatusBound = true;

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick-status]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = parseInt(btn.dataset.id, 10);
    const newStatus = btn.dataset.quickStatus;

    try {
      const res = await fetch(`/api/admin/operator-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Ошибка');

      const labels = { answered: 'Отвечено', closed: 'Закрыто' };
      showAdminToast(`Заявка №${id}: ${labels[newStatus] || newStatus}`);
      await operatorLoad();
      updateOperatorBadge();
    } catch (err) {
      showAdminToast('Не удалось изменить статус', 'error');
    }
  });
}

// ============================================
// 9. Badge — счётчик новых заявок
// ============================================
async function updateOperatorBadge() {
  try {
    const res = await fetch('/api/admin/operator-requests/count', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) return;
    const data = await res.json();

    const badge = document.getElementById('operator-badge');
    if (!badge) return;

    if (data.count > 0) {
      badge.textContent = data.count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch {}
}

// ============================================
// 10. Утилита — escape HTML
// ============================================
