/* ============================================================
   АДМИН: ПРОМОКОДЫ
   ============================================================ */

const promosState = {
  all: [],
  editingId: null
};

// ============================================================
// 1. Рендер страницы
// ============================================================
async function renderPromocodes(container) {
  container.innerHTML = `
    <div class="promos-header">
      <h2 class="promos-header__title">Промокоды <small id="promos-count"></small></h2>
      <button class="btn-add" id="add-promo-btn">
        <span>+</span> Добавить промокод
      </button>
    </div>

    <div id="promos-grid-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем промокоды...</span>
      </div>
    </div>
  `;

  document.getElementById('add-promo-btn').addEventListener('click', () => openPromoModal(null));
  await promosLoad();
}

// ============================================================
// 2. Загрузка
// ============================================================
async function promosLoad() {
  try {
    const res = await fetch('/api/admin/promocodes', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Ошибка загрузки');

    promosState.all = await res.json();
    document.getElementById('promos-count').textContent = `(${promosState.all.length})`;
    promosRenderGrid();
  } catch (err) {
    console.error(err);
    document.getElementById('promos-grid-wrap').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__title">Не удалось загрузить промокоды</div>
      </div>
    `;
  }
}

// ============================================================
// 3. Сетка
// ============================================================
function promosRenderGrid() {
  const wrap = document.getElementById('promos-grid-wrap');
  if (!wrap) return;

  if (promosState.all.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">🎟️</div>
        <div class="orders-empty__title">Промокодов пока нет</div>
        <p>Создайте первый промокод — например, «SALE10» со скидкой 10%</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="promos-grid">
      ${promosState.all.map(p => {
        const discountLabel = p.discount_type === 'percent'
          ? `−${p.discount_value}%`
          : `−${p.discount_value.toLocaleString('ru-RU')} ₽`;

        // Статус активности
        let status = 'active';
        let statusLabel = 'Активен';
        const now = new Date();

        if (!p.is_active) {
          status = 'disabled';
          statusLabel = 'Выключен';
        } else if (p.valid_until && new Date(p.valid_until + 'T23:59:59') < now) {
          status = 'expired';
          statusLabel = 'Истёк';
        } else if (p.uses_limit && p.uses_count >= p.uses_limit) {
          status = 'exhausted';
          statusLabel = 'Исчерпан';
        }

        const usesText = p.uses_limit
          ? `${p.uses_count} / ${p.uses_limit}`
          : `${p.uses_count}`;

        return `
          <div class="promo-card promo-card--${status}">
            <div class="promo-card__header">
              <div class="promo-card__code">${p.code}</div>
              <span class="promo-card__status promo-card__status--${status}">${statusLabel}</span>
            </div>

            <div class="promo-card__discount">${discountLabel}</div>

            ${p.description ? `<div class="promo-card__desc">${p.description}</div>` : ''}

            <div class="promo-card__meta">
              ${p.min_order_sum > 0 ? `
                <div class="promo-card__meta-item">
                  <span class="promo-card__meta-label">Мин. заказ:</span>
                  <span>${p.min_order_sum.toLocaleString('ru-RU')} ₽</span>
                </div>
              ` : ''}

              ${p.max_discount ? `
                <div class="promo-card__meta-item">
                  <span class="promo-card__meta-label">Макс. скидка:</span>
                  <span>${p.max_discount.toLocaleString('ru-RU')} ₽</span>
                </div>
              ` : ''}

              ${p.valid_until ? `
                <div class="promo-card__meta-item">
                  <span class="promo-card__meta-label">До:</span>
                  <span>${formatDate(p.valid_until)}</span>
                </div>
              ` : ''}
            </div>

            <div class="promo-card__stats">
              <div class="promo-card__stat">
                <div class="promo-card__stat-label">Использован</div>
                <div class="promo-card__stat-value">${usesText}</div>
              </div>
              <div class="promo-card__stat">
                <div class="promo-card__stat-label">Скидка всего</div>
                <div class="promo-card__stat-value">${(p.discount_total || 0).toLocaleString('ru-RU')} ₽</div>
              </div>
            </div>

            <div class="promo-card__actions">
              <button class="promo-card__btn" data-edit="${p.id}">Изменить</button>
              <button class="promo-card__btn" data-toggle="${p.id}">
                ${p.is_active ? 'Выключить' : 'Включить'}
              </button>
              <button class="promo-card__btn promo-card__btn--danger" data-delete="${p.id}">Удалить</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openPromoModal(parseInt(btn.dataset.edit, 10)));
  });
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => promosToggle(parseInt(btn.dataset.toggle, 10)));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => promosDelete(parseInt(btn.dataset.delete, 10)));
  });
}

// ============================================================
// 4. Модалка создания/редактирования
// ============================================================
function openPromoModal(id) {
  promosState.editingId = id;
  const isEdit = id !== null;
  const p = isEdit ? promosState.all.find(x => x.id === id) : null;

  const today = new Date().toISOString().slice(0, 10);

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 620px;">
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Редактировать промокод' : 'Новый промокод'}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <form class="admin-form" id="promo-form" novalidate>
          <div class="admin-form__error" id="promo-error"></div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="promo-code">
                Код <span class="req">*</span>
              </label>
              <input type="text" id="promo-code" class="admin-form__input"
                     placeholder="SALE10"
                     value="${p ? p.code : ''}"
                     style="text-transform:uppercase;font-family:monospace;letter-spacing:0.08em;"
                     ${isEdit ? 'readonly' : ''} required />
              <span class="admin-form__hint">${isEdit ? 'Код изменить нельзя' : 'Латиница, цифры, дефисы. Автоматически в верхний регистр'}</span>
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label">Тип скидки <span class="req">*</span></label>
              <select id="promo-type" class="admin-form__select">
                <option value="percent" ${p && p.discount_type === 'percent' ? 'selected' : ''}>Процент (%)</option>
                <option value="fixed" ${p && p.discount_type === 'fixed' ? 'selected' : ''}>Фикс. сумма (₽)</option>
              </select>
            </div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="promo-desc">Описание (для админа)</label>
            <input type="text" id="promo-desc" class="admin-form__input"
                   placeholder="Например: Акция к 8 марта"
                   value="${p ? p.description || '' : ''}" />
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="promo-value">
                Размер скидки <span class="req">*</span>
              </label>
              <input type="number" id="promo-value" class="admin-form__input"
                     min="0" step="0.01"
                     value="${p ? p.discount_value : 10}" required />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="promo-max">Макс. скидка, ₽</label>
              <input type="number" id="promo-max" class="admin-form__input"
                     min="0"
                     value="${p && p.max_discount ? p.max_discount : ''}"
                     placeholder="Без ограничений" />
            </div>
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="promo-min-sum">Мин. сумма заказа, ₽</label>
              <input type="number" id="promo-min-sum" class="admin-form__input"
                     min="0"
                     value="${p ? p.min_order_sum : 0}" />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="promo-limit">Лимит использований</label>
              <input type="number" id="promo-limit" class="admin-form__input"
                     min="1"
                     value="${p && p.uses_limit ? p.uses_limit : ''}"
                     placeholder="Без ограничений" />
            </div>
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="promo-from">Действует с</label>
              <input type="date" id="promo-from" class="admin-form__input"
                     value="${p && p.valid_from ? p.valid_from : today}" />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="promo-until">Действует до</label>
              <input type="date" id="promo-until" class="admin-form__input"
                     value="${p && p.valid_until ? p.valid_until : ''}" />
            </div>
          </div>

          ${isEdit ? `
            <label class="admin-checkbox">
              <input type="checkbox" id="promo-active" ${p.is_active ? 'checked' : ''} />
              Активен
            </label>
          ` : ''}

          <div class="admin-form__footer">
            <button type="button" class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button type="submit" class="btn-admin btn-admin--primary" id="promo-submit">
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

  // Автоматическая транслитерация кода
  const codeInput = document.getElementById('promo-code');
  if (!isEdit) {
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    });
  }

  // Отправка
  document.getElementById('promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await promosSubmit(isEdit, close);
  });
}

// ============================================================
// 5. Отправка
// ============================================================
async function promosSubmit(isEdit, closeFn) {
  const errorBox = document.getElementById('promo-error');
  const submitBtn = document.getElementById('promo-submit');
  errorBox.classList.remove('is-visible');

  const payload = {
    code: document.getElementById('promo-code').value.trim().toUpperCase(),
    description: document.getElementById('promo-desc').value.trim(),
    discount_type: document.getElementById('promo-type').value,
    discount_value: parseFloat(document.getElementById('promo-value').value),
    min_order_sum: parseFloat(document.getElementById('promo-min-sum').value) || 0,
    max_discount: document.getElementById('promo-max').value || null,
    uses_limit: document.getElementById('promo-limit').value || null,
    valid_from: document.getElementById('promo-from').value || null,
    valid_until: document.getElementById('promo-until').value || null
  };

  const activeCb = document.getElementById('promo-active');
  if (activeCb) payload.is_active = activeCb.checked;

  if (!payload.code || !payload.discount_value) {
    errorBox.textContent = 'Заполните код и размер скидки';
    errorBox.classList.add('is-visible');
    return;
  }

  if (payload.discount_type === 'percent' && payload.discount_value > 100) {
    errorBox.textContent = 'Процент не может быть больше 100';
    errorBox.classList.add('is-visible');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Сохраняем...' : 'Создаём...';

  try {
    const url = isEdit
      ? `/api/admin/promocodes/${promosState.editingId}`
      : '/api/admin/promocodes';
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
    await promosLoad();
    showAdminToast(isEdit ? 'Промокод обновлён' : 'Промокод создан');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('is-visible');
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Сохранить' : 'Создать';
  }
}

// ============================================================
// 6. Скрыть/показать
// ============================================================
async function promosToggle(id) {
  const p = promosState.all.find(x => x.id === id);
  if (!p) return;

  try {
    const res = await fetch(`/api/admin/promocodes/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_active: !p.is_active })
    });

    if (!res.ok) throw new Error('Ошибка');
    await promosLoad();
    showAdminToast(p.is_active ? 'Промокод выключен' : 'Промокод включён');
  } catch (err) {
    showAdminToast('Не удалось изменить', 'error');
  }
}

// ============================================================
// 7. Удаление
// ============================================================
async function promosDelete(id) {
  const p = promosState.all.find(x => x.id === id);
  if (!p) return;

  if (!confirm(`Удалить промокод «${p.code}»?\n\nЭто действие необратимо. История использования тоже удалится.`)) return;

  try {
    const res = await fetch(`/api/admin/promocodes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка удаления');

    await promosLoad();
    showAdminToast('Промокод удалён');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ============================================================
// 8. Утилита — форматирование даты
// ============================================================
function formatDate(str) {
  try {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return str;
  }
}