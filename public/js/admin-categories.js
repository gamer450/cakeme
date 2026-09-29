/* ============================================
   АДМИН: КАТЕГОРИИ
   ============================================ */

const catsState = {
  all: [],
  editingId: null
};

const typeLabels = {
  cake: { icon: '🍰', label: 'Кондитерка' },
  coffee: { icon: '☕', label: 'Кофе / Чай' },
  other: { icon: '🎁', label: 'Прочее' }
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderCategories(container) {
  container.innerHTML = `
    <div class="cats-header">
      <h2 class="cats-header__title">Категории <small id="cats-count"></small></h2>
      <button class="btn-add" id="add-cat-btn">
        <span>+</span> Добавить категорию
      </button>
    </div>

    <div class="cats-table-wrap" id="cats-table-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем категории...</span>
      </div>
    </div>
  `;

  document.getElementById('add-cat-btn').addEventListener('click', () => openCategoryModal(null));

  await loadCategories();
}

// ============================================
// 2. Загрузка
// ============================================
async function loadCategories() {
  try {
    const res = await fetch('/api/admin/categories', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    catsState.all = await res.json();

    document.getElementById('cats-count').textContent = `(${catsState.all.length})`;
    renderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('cats-table-wrap').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить категории</div>
      </div>
    `;
  }
}

// ============================================
// 3. Таблица
// ============================================
function renderTable() {
  const wrap = document.getElementById('cats-table-wrap');

  if (catsState.all.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">🏷️</div>
        <div class="orders-empty__title">Категорий пока нет</div>
        <p>Добавьте первую категорию</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <table class="cats-table">
      <thead>
        <tr>
          <th>Название</th>
          <th>Slug</th>
          <th>Тип</th>
          <th>Товаров</th>
          <th>Статус</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${catsState.all.map(c => {
          const t = typeLabels[c.type] || typeLabels.other;
          return `
            <tr>
              <td><span class="cats-table__name">${c.name}</span></td>
              <td><span class="cats-table__slug">${c.slug}</span></td>
              <td><span class="cats-table__type">${t.icon} ${t.label}</span></td>
              <td><span class="cats-table__count">${c.products_count}</span></td>
              <td>
                <span class="cat-status ${c.is_active ? 'cat-status--active' : 'cat-status--hidden'}">
                  ${c.is_active ? 'Активна' : 'Скрыта'}
                </span>
              </td>
              <td>
                <div class="cats-table__actions">
                  <button class="cats-table__btn" data-edit="${c.id}" title="Редактировать">✏️</button>
                  <button class="cats-table__btn cats-table__btn--danger" data-delete="${c.id}" title="Удалить">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openCategoryModal(parseInt(btn.dataset.edit, 10)));
  });

  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(parseInt(btn.dataset.delete, 10)));
  });
}

// ============================================
// 4. Модалка создания/редактирования
// ============================================
function openCategoryModal(id) {
  catsState.editingId = id;
  const isEdit = id !== null;
  const cat = isEdit ? catsState.all.find(c => c.id === id) : null;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 520px;">
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Редактировать категорию' : 'Новая категория'}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <form class="admin-form" id="cat-form" novalidate>
          <div class="admin-form__error" id="cat-error"></div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="cat-name">
              Название <span class="req">*</span>
            </label>
            <input type="text" id="cat-name" class="admin-form__input" placeholder="Например: Торты" value="${cat ? cat.name : ''}" required />
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="cat-slug">
                Slug <span class="req">*</span>
              </label>
              <input type="text" id="cat-slug" class="admin-form__input" placeholder="torty" value="${cat ? cat.slug : ''}" required />
              <span class="admin-form__hint">Латиница, дефисы. Для URL.</span>
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="cat-sort">Порядок</label>
              <input type="number" id="cat-sort" class="admin-form__input" value="${cat ? cat.sort_order : 0}" />
            </div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="cat-type">
              Тип <span class="req">*</span>
            </label>
            <select id="cat-type" class="admin-form__select" required>
              <option value="cake" ${cat && cat.type === 'cake' ? 'selected' : ''}>🍰 Кондитерка</option>
              <option value="coffee" ${cat && cat.type === 'coffee' ? 'selected' : ''}>☕ Кофе / Чай</option>
              <option value="other" ${cat && cat.type === 'other' ? 'selected' : ''}>🎁 Прочее</option>
            </select>
          </div>

          ${isEdit ? `
            <label class="admin-checkbox">
              <input type="checkbox" id="cat-active" ${cat.is_active ? 'checked' : ''} />
              Показывать на сайте
            </label>
          ` : ''}

          <div class="admin-form__footer">
            <button type="button" class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button type="submit" class="btn-admin btn-admin--primary" id="cat-submit">
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

  // Автозаполнение slug из name (только при создании)
  if (!isEdit) {
    const nameInput = document.getElementById('cat-name');
    const slugInput = document.getElementById('cat-slug');
    let slugTouched = false;

    slugInput.addEventListener('input', () => { slugTouched = true; });

    nameInput.addEventListener('input', () => {
      if (slugTouched) return;
      slugInput.value = transliterate(nameInput.value);
    });
  }

  // Отправка
  document.getElementById('cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitCategory(isEdit, close);
  });
}

// ============================================
// 5. Отправка формы
// ============================================
async function submitCategory(isEdit, closeFn) {
  const errorBox = document.getElementById('cat-error');
  const submitBtn = document.getElementById('cat-submit');

  errorBox.classList.remove('is-visible');

  const payload = {
    name: document.getElementById('cat-name').value.trim(),
    slug: document.getElementById('cat-slug').value.trim().toLowerCase(),
    type: document.getElementById('cat-type').value,
    sort_order: parseInt(document.getElementById('cat-sort').value, 10) || 0
  };

  const activeCheckbox = document.getElementById('cat-active');
  if (activeCheckbox) {
    payload.is_active = activeCheckbox.checked;
  }

  if (!payload.name || !payload.slug || !payload.type) {
    errorBox.textContent = 'Заполните все обязательные поля';
    errorBox.classList.add('is-visible');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Сохраняем...' : 'Создаём...';

  try {
    const url = isEdit
      ? `/api/admin/categories/${catsState.editingId}`
      : '/api/admin/categories';
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
    await loadCategories();
    showAdminToast(isEdit ? 'Категория обновлена' : 'Категория создана');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('is-visible');
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Сохранить' : 'Создать';
  }
}

// ============================================
// 6. Удаление
// ============================================
async function deleteCategory(id) {
  const cat = catsState.all.find(c => c.id === id);
  if (!cat) return;

  if (cat.products_count > 0) {
    showAdminToast(`Нельзя удалить: в категории ${cat.products_count} товаров`, 'error');
    return;
  }

  if (!confirm(`Удалить категорию «${cat.name}»?`)) return;

  try {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка удаления');

    await loadCategories();
    showAdminToast('Категория удалена');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ============================================
// 7. Транслитерация (для авто-slug)
// ============================================
function transliterate(str) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return str
    .toLowerCase()
    .split('')
    .map(ch => map[ch] !== undefined ? map[ch] : ch)
    .join('')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}