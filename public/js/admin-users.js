/* ============================================
   АДМИН: ПОЛЬЗОВАТЕЛИ
   ============================================ */

const usersState = {
  all: [],
  filterRole: 'all',
  search: '',
  editingId: null
};

const roleInfo = {
  admin: { icon: '👑', label: 'Администратор' },
  manager: { icon: '🧑‍💼', label: 'Менеджер' },
  client: { icon: '👤', label: 'Клиент' }
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderUsers(container) {
  container.innerHTML = `
    <div class="users-header">
      <h2 class="users-header__title">Пользователи <small id="users-count"></small></h2>
    </div>

    <div class="users-filters">
      <div class="users-search">
        <span class="users-search__icon">🔍</span>
        <input type="text" id="users-search-input" placeholder="Поиск по имени, email, телефону..." />
      </div>
      <div class="users-roles" id="users-roles">
        <button class="users-role is-active" data-role="all">Все</button>
        <button class="users-role" data-role="client">Клиенты</button>
        <button class="users-role" data-role="manager">Менеджеры</button>
        <button class="users-role" data-role="admin">Админы</button>
      </div>
    </div>

    <div class="users-table-wrap" id="users-table-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем пользователей...</span>
      </div>
    </div>
  `;

  initRoleFilters();
  initUsersSearch();
  await usersLoad();
}

// ============================================
// 2. Загрузка
// ============================================
async function usersLoad() {
  try {
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    usersState.all = await res.json();

    document.getElementById('users-count').textContent = `(${usersState.all.length})`;
    usersRenderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('users-table-wrap').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__title">Не удалось загрузить пользователей</div>
      </div>
    `;
  }
}

// ============================================
// 3. Фильтр по роли
// ============================================
function initRoleFilters() {
  document.querySelectorAll('.users-role').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.users-role').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      usersState.filterRole = btn.dataset.role;
      usersRenderTable();
    });
  });
}

// ============================================
// 4. Поиск
// ============================================
let usersSearchTimer;
function initUsersSearch() {
  document.getElementById('users-search-input')?.addEventListener('input', (e) => {
    clearTimeout(usersSearchTimer);
    usersSearchTimer = setTimeout(() => {
      usersState.search = e.target.value;
      usersRenderTable();
    }, 250);
  });
}

// ============================================
// 5. Фильтрация
// ============================================
function usersGetFiltered() {
  let list = [...usersState.all];

  if (usersState.filterRole !== 'all') {
    list = list.filter(u => u.role === usersState.filterRole);
  }

  if (usersState.search.trim()) {
    const q = usersState.search.trim().toLowerCase();
    list = list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  }

  return list;
}

// ============================================
// 6. Таблица
// ============================================
function usersRenderTable() {
  const list = usersGetFiltered();
  const wrap = document.getElementById('users-table-wrap');
  const meId = state.user.id;

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__title">Пользователи не найдены</div>
        <p>Измените фильтр или поиск</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <table class="users-table">
      <thead>
        <tr>
          <th>Пользователь</th>
          <th>Телефон</th>
          <th>Роль</th>
          <th>Заказов</th>
          <th>Статус</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${list.map(u => {
          const role = roleInfo[u.role] || roleInfo.client;
          const initial = u.name.charAt(0).toUpperCase();
          const isMe = String(u.id) === String(meId);
          return `
            <tr class="${u.is_active ? '' : 'is-inactive'}">
              <td>
                <div style="display:flex;align-items:center;gap:12px;">
                  <div class="users-table__avatar users-table__avatar--${u.role}">${initial}</div>
                  <div>
                    <div class="users-table__name">
                      ${u.name} ${isMe ? '<small style="color:var(--admin-text-muted);font-weight:400">(вы)</small>' : ''}
                    </div>
                    <div class="users-table__email">${u.email}</div>
                  </div>
                </div>
              </td>
              <td><span class="users-table__phone">${u.phone || '—'}</span></td>
              <td><span class="role-badge role-badge--${u.role}">${role.icon} ${role.label}</span></td>
              <td><strong>${u.orders_count}</strong></td>
              <td>
                <span class="status-badge ${u.is_active ? 'status-badge--active' : 'status-badge--blocked'}">
                  ${u.is_active ? 'Активен' : 'Заблокирован'}
                </span>
              </td>
              <td>
                <div class="users-table__actions">
                  <button class="users-table__btn" data-edit="${u.id}" title="Изменить роль">✏️</button>
                  <button class="users-table__btn" data-toggle="${u.id}" title="${u.is_active ? 'Заблокировать' : 'Разблокировать'}" ${isMe ? 'disabled' : ''}>
                    ${u.is_active ? '🚫' : '✅'}
                  </button>
                  <button class="users-table__btn users-table__btn--danger" data-delete="${u.id}" title="Удалить" ${isMe ? 'disabled' : ''}>
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => usersOpenModal(parseInt(btn.dataset.edit, 10)));
  });
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => usersToggleActive(parseInt(btn.dataset.toggle, 10)));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => usersDelete(parseInt(btn.dataset.delete, 10)));
  });
}

// ============================================
// 7. Модалка редактирования
// ============================================
function usersOpenModal(id) {
  usersState.editingId = id;
  const u = usersState.all.find(x => x.id === id);
  if (!u) return;

  const isMe = String(u.id) === String(state.user.id);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 520px;">
      <div class="modal__header">
        <div class="modal__title">Пользователь: ${u.name}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <form class="admin-form" id="user-form" novalidate>
          <div class="admin-form__error" id="user-error"></div>

          <div class="admin-form__field">
            <label class="admin-form__label">Email</label>
            <input type="email" class="admin-form__input" value="${u.email}" disabled style="opacity:0.6;" />
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="u-name">Имя</label>
            <input type="text" id="u-name" class="admin-form__input" value="${u.name}" />
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="u-phone">Телефон</label>
            <input type="tel" id="u-phone" class="admin-form__input" value="${u.phone || ''}" />
          </div>

                    <div class="admin-form__field">
            <label class="admin-form__label" for="u-password">
              Новый пароль <span style="color:var(--admin-text-dim);font-weight:400;text-transform:none;letter-spacing:0;">(оставьте пустым, чтобы не менять)</span>
            </label>
            <input type="password" id="u-password" class="admin-form__input"
                   placeholder="Минимум 6 символов"
                   autocomplete="new-password" />
            <span class="admin-form__hint" id="u-password-hint">
              Пароль будет изменён после сохранения. Минимум 6 символов.
            </span>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">Роль</label>
            <div class="role-options" id="role-options">
              <button type="button" class="role-option ${u.role === 'client' ? 'is-selected' : ''}" data-role="client" ${isMe ? 'disabled' : ''}>
                <div class="role-option__text">
                  <span class="role-option__title">Клиент</span>
                  <span class="role-option__desc">Может заказывать товары</span>
                </div>
              </button>
              <button type="button" class="role-option ${u.role === 'manager' ? 'is-selected' : ''}" data-role="manager" ${isMe ? 'disabled' : ''}>
                <div class="role-option__text">
                  <span class="role-option__title">Менеджер</span>
                  <span class="role-option__desc">Видит и обрабатывает заказы</span>
                </div>
              </button>
              <button type="button" class="role-option ${u.role === 'admin' ? 'is-selected' : ''}" data-role="admin" ${isMe ? 'disabled' : ''}>
                <div class="role-option__text">
                  <span class="role-option__title">Администратор</span>
                  <span class="role-option__desc">Полный доступ</span>
                </div>
              </button>
            </div>
            ${isMe ? '<p class="admin-form__hint" style="margin-top:8px;">Нельзя изменить свою роль</p>' : ''}
          </div>

          <label class="admin-checkbox">
            <input type="checkbox" id="u-active" ${u.is_active ? 'checked' : ''} ${isMe ? 'disabled' : ''} />
            Активен (может входить)
          </label>

          <div class="admin-form__footer">
            <button type="button" class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button type="submit" class="btn-admin btn-admin--primary" id="user-submit">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('is-open'));

  let selectedRole = u.role;

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 250);
    document.removeEventListener('keydown', escHandler);
  };

  const escHandler = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', escHandler);

  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => e.target === modal && close());

  // Выбор роли
  modal.querySelectorAll('.role-option').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      modal.querySelectorAll('.role-option').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      selectedRole = btn.dataset.role;
    });
  });

  // Отправка
  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await usersSubmit(close, selectedRole, isMe);
  });

  // ✅ Новое: показываем, что пароль будет изменён
  const passwordInput = document.getElementById('u-password');
  const passwordHint = document.getElementById('u-password-hint');

  passwordInput?.addEventListener('input', () => {
    const val = passwordInput.value;
    if (val.length === 0) {
      passwordHint.textContent = 'Пароль будет изменён после сохранения. Минимум 6 символов.';
      passwordHint.style.color = 'var(--admin-text-dim)';
    } else if (val.length < 6) {
      passwordHint.textContent = `⚠️ Слишком короткий (${val.length}/6)`;
      passwordHint.style.color = 'var(--admin-danger)';
    } else {
      passwordHint.textContent = `✅ Пароль будет изменён (${val.length} символов)`;
      passwordHint.style.color = 'var(--admin-success)';
    }
  });
}

// ============================================
// 8. Отправка
// ============================================
async function usersSubmit(closeFn, role, isMe) {
  const errorBox = document.getElementById('user-error');
  const submitBtn = document.getElementById('user-submit');

  errorBox.classList.remove('is-visible');

  const payload = {
    name: document.getElementById('u-name').value.trim(),
    phone: document.getElementById('u-phone').value.trim()
  };

  if (!isMe) {
    payload.role = role;
    payload.is_active = document.getElementById('u-active').checked;
  }

  // ✅ Новое: считываем пароль
  const passwordInput = document.getElementById('u-password');
  const passwordValue = passwordInput ? passwordInput.value : '';

  if (passwordValue && passwordValue.length > 0) {
    if (passwordValue.length < 6) {
      errorBox.textContent = 'Пароль должен быть минимум 6 символов';
      errorBox.classList.add('is-visible');
      passwordInput.focus();
      return;
    }
    if (passwordValue.length > 100) {
      errorBox.textContent = 'Пароль слишком длинный (макс 100 символов)';
      errorBox.classList.add('is-visible');
      passwordInput.focus();
      return;
    }
    payload.password = passwordValue;
  }

  if (!payload.name) {
    errorBox.textContent = 'Имя не может быть пустым';
    errorBox.classList.add('is-visible');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Сохраняем...';
  // ... остальное без изменений

  try {
    const res = await fetch(`/api/admin/users/${usersState.editingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');

    closeFn();
    await usersLoad();

    // ✅ Разный toast, если пароль менялся
    if (payload.password) {
      showAdminToast('Пароль изменён');
    } else {
      showAdminToast('Пользователь обновлён');
    }
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('is-visible');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Сохранить';
  }
}

// ============================================
// 9. Блокировка
// ============================================
async function usersToggleActive(id) {
  const u = usersState.all.find(x => x.id === id);
  if (!u) return;

  if (!confirm(`${u.is_active ? 'Заблокировать' : 'Разблокировать'} пользователя «${u.name}»?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_active: !u.is_active })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    await usersLoad();
    showAdminToast(u.is_active ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ============================================
// 10. Удаление
// ============================================
async function usersDelete(id) {
  const u = usersState.all.find(x => x.id === id);
  if (!u) return;

  if (!confirm(`Удалить пользователя «${u.name}»?\n\nЭто действие необратимо. Заказы останутся в БД, но потеряют привязку.`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка удаления');

    await usersLoad();
    showAdminToast('Пользователь удалён');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}