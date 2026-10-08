/* ============================================
   АДМИН: КОНСТРУКТОР ТОРТА
   v1.1 — фикс editingId при редактировании
   ============================================ */

const constructorState = {
  grouped: { shape: [], weight: [], filling: [], decor: [] },
  editingId: null
};

const GROUP_LABELS = {
  shape: { icon: '🎂', title: 'Форма' },
  weight: { icon: '⚖️', title: 'Вес' },
  filling: { icon: '🍫', title: 'Начинка' },
  decor: { icon: '🎨', title: 'Декор' }
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderConstructor(container) {
  container.innerHTML = `
    <div class="constructor-header">
      <h2 class="constructor-header__title">Конструктор торта <small id="constructor-count"></small></h2>
    </div>

    <div class="constructor-groups" id="constructor-groups">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем опции...</span>
      </div>
    </div>
  `;

  await constructorLoad();
}

// ============================================
// 2. Загрузка
// ============================================
async function constructorLoad() {
  try {
    const res = await fetch('/api/admin/constructor/options', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    constructorState.grouped = await res.json();

    const total = Object.values(constructorState.grouped).reduce((s, arr) => s + arr.length, 0);
    document.getElementById('constructor-count').textContent = `(${total})`;

    constructorRenderGroups();
  } catch (err) {
    console.error(err);
    document.getElementById('constructor-groups').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить опции</div>
      </div>
    `;
  }
}

// ============================================
// 3. Рендер групп
// ============================================
function constructorRenderGroups() {
  const wrap = document.getElementById('constructor-groups');
  if (!wrap) return;

  const groups = ['shape', 'weight', 'filling', 'decor'];

  wrap.innerHTML = groups.map(groupKey => {
    const label = GROUP_LABELS[groupKey];
    const items = constructorState.grouped[groupKey] || [];

    return `
      <div class="constructor-group">
        <div class="constructor-group__header">
          <div class="constructor-group__title">
            <span class="constructor-group__icon">${label.icon}</span>
            ${label.title}
            <span class="constructor-group__count">${items.length}</span>
          </div>
          <button class="btn-add-option" data-add-group="${groupKey}">
            + Добавить
          </button>
        </div>
        <div class="constructor-group__body">
          ${items.length === 0
            ? `<div style="padding:24px;text-align:center;color:var(--admin-text-muted);font-size:0.9rem;">Нет опций — добавьте первую</div>`
            : items.map(opt => constructorRenderOption(opt)).join('')
          }
        </div>
      </div>
    `;
  }).join('');

  // Обработчики
  wrap.querySelectorAll('[data-add-group]').forEach(btn => {
    btn.addEventListener('click', () => openConstructorModal(btn.dataset.addGroup, null));
  });
  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openConstructorModal(null, parseInt(btn.dataset.edit, 10)));
  });
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => constructorToggle(parseInt(btn.dataset.toggle, 10)));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => constructorDelete(parseInt(btn.dataset.delete, 10)));
  });
}

// ============================================
// 4. Одна опция
// ============================================
function constructorRenderOption(opt) {
  const priceDisplay = opt.price_modifier > 0
    ? `+${opt.price_modifier.toLocaleString('ru-RU')} ₽${opt.price_type === 'per_kg' ? '/кг' : ''}`
    : 'Бесплатно';

  return `
    <div class="option-item ${opt.is_active ? '' : 'is-inactive'}">
      <div class="option-item__info">
        <div class="option-item__name">
          ${opt.name}
          ${opt.is_default ? '<span class="option-item__badge">По умолчанию</span>' : ''}
          ${!opt.is_active ? '<span class="option-item__badge">Скрыта</span>' : ''}
        </div>
        ${opt.description ? `<div class="option-item__desc">${opt.description}</div>` : ''}
      </div>
      <div class="option-item__price ${opt.price_modifier === 0 ? 'option-item__price--zero' : ''}">
        ${priceDisplay}
      </div>
      <div class="option-item__actions">
        <button class="option-item__btn" data-edit="${opt.id}" title="Изменить">✏️</button>
        <button class="option-item__btn" data-toggle="${opt.id}" title="${opt.is_active ? 'Скрыть' : 'Показать'}">
          ${opt.is_active ? '👁️' : '🙈'}
        </button>
        <button class="option-item__btn option-item__btn--danger" data-delete="${opt.id}" title="Удалить">🗑️</button>
      </div>
    </div>
  `;
}

// ============================================
// 5. Модалка создания/редактирования
// ============================================
function openConstructorModal(groupKey, id) {
  // ✅ ФИКС: запоминаем id для последующего PATCH
  constructorState.editingId = id;

  let opt = null;
  let actualGroupKey = groupKey;

  if (id !== null) {
    // Найдём опцию во всех группах
    for (const gk of Object.keys(constructorState.grouped)) {
      const found = constructorState.grouped[gk].find(o => o.id === id);
      if (found) {
        opt = found;
        actualGroupKey = gk;
        break;
      }
    }
  }

  const isEdit = opt !== null;
  const label = GROUP_LABELS[actualGroupKey] || { title: 'Опция' };

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 520px;">
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Редактировать опцию' : `Новая опция — ${label.title}`}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <form class="admin-form" id="constructor-form" novalidate>
          <div class="admin-form__error" id="constructor-error"></div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="opt-name">
              Название <span class="req">*</span>
            </label>
            <input type="text" id="opt-name" class="admin-form__input" placeholder="Например: Шоколад" value="${opt ? opt.name : ''}" required />
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="opt-desc">Описание</label>
            <input type="text" id="opt-desc" class="admin-form__input" placeholder="Краткое описание" value="${opt ? opt.description || '' : ''}" />
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="opt-price">
                Цена, ₽ <span class="req">*</span>
              </label>
              <input type="number" id="opt-price" class="admin-form__input" min="0" step="10" value="${opt ? opt.price_modifier : 0}" />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="opt-sort">Порядок</label>
              <input type="number" id="opt-sort" class="admin-form__input" value="${opt ? opt.sort_order : 0}" />
            </div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="opt-type">Тип цены</label>
            <select id="opt-type" class="admin-form__select">
              <option value="fixed" ${opt && opt.price_type === 'fixed' ? 'selected' : ''}>Фиксированная</option>
              <option value="per_kg" ${opt && opt.price_type === 'per_kg' ? 'selected' : ''}>За килограмм</option>
            </select>
          </div>

          ${isEdit ? `
            <label class="admin-checkbox">
              <input type="checkbox" id="opt-active" ${opt.is_active ? 'checked' : ''} />
              Показывать на сайте
            </label>

            <label class="admin-checkbox">
              <input type="checkbox" id="opt-default" ${opt.is_default ? 'checked' : ''} />
              По умолчанию (выбрано сразу)
            </label>
          ` : ''}

          <div class="admin-form__footer">
            <button type="button" class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button type="submit" class="btn-admin btn-admin--primary" id="constructor-submit">
              ${isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('is-open'));

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 250);
    document.removeEventListener('keydown', escHandler);
  };

  const escHandler = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', escHandler);

  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => e.target === modal && close());

  // Отправка
  document.getElementById('constructor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await constructorSubmit(isEdit, actualGroupKey, close);
  });
}

// ============================================
// 6. Отправка
// ============================================
async function constructorSubmit(isEdit, groupKey, closeFn) {
  const errorBox = document.getElementById('constructor-error');
  const submitBtn = document.getElementById('constructor-submit');

  errorBox.classList.remove('is-visible');

  const payload = {
    name: document.getElementById('opt-name').value.trim(),
    description: document.getElementById('opt-desc').value.trim(),
    price_modifier: parseFloat(document.getElementById('opt-price').value) || 0,
    price_type: document.getElementById('opt-type').value,
    sort_order: parseInt(document.getElementById('opt-sort').value, 10) || 0
  };

  if (!isEdit) {
    payload.group_key = groupKey;
  } else {
    const activeCb = document.getElementById('opt-active');
    const defaultCb = document.getElementById('opt-default');
    if (activeCb) payload.is_active = activeCb.checked;
    if (defaultCb) payload.is_default = defaultCb.checked;
  }

  if (!payload.name) {
    errorBox.textContent = 'Укажите название';
    errorBox.classList.add('is-visible');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Сохраняем...' : 'Создаём...';

  try {
    const url = isEdit
      ? `/api/admin/constructor/options/${constructorState.editingId}`
      : '/api/admin/constructor/options';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');

    closeFn();
    await constructorLoad();
    showAdminToast(isEdit ? 'Опция обновлена' : 'Опция создана');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('is-visible');
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Сохранить' : 'Создать';
  }
}

// ============================================
// 7. Скрыть/показать
// ============================================
async function constructorToggle(id) {
  let opt = null;
  for (const gk of Object.keys(constructorState.grouped)) {
    const found = constructorState.grouped[gk].find(o => o.id === id);
    if (found) { opt = found; break; }
  }
  if (!opt) return;

  try {
    const res = await fetch(`/api/admin/constructor/options/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_active: !opt.is_active })
    });

    if (!res.ok) throw new Error('Ошибка');
    await constructorLoad();
    showAdminToast(opt.is_active ? 'Опция скрыта' : 'Опция показана');
  } catch (err) {
    showAdminToast('Не удалось изменить', 'error');
  }
}

// ============================================
// 8. Удаление
// ============================================
async function constructorDelete(id) {
  let opt = null;
  for (const gk of Object.keys(constructorState.grouped)) {
    const found = constructorState.grouped[gk].find(o => o.id === id);
    if (found) { opt = found; break; }
  }
  if (!opt) return;

  if (!confirm(`Удалить опцию «${opt.name}»?`)) return;

  try {
    const res = await fetch(`/api/admin/constructor/options/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка удаления');

    await constructorLoad();
    showAdminToast('Опция удалена');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}