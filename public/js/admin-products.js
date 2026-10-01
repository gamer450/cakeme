/* ============================================
   АДМИН: ТОВАРЫ
   ============================================ */

const prodsState = {
  all: [],
  categories: [],
  filterCat: 'all',
  search: '',
  editingId: null,
  currentImage: ''
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderProducts(container) {
  container.innerHTML = `
    <div class="prods-header">
      <h2 class="prods-header__title">Товары <small id="prods-count"></small></h2>
      <button class="btn-add" id="add-prod-btn">
        <span>+</span> Добавить товар
      </button>
    </div>

    <div class="prods-filters">
      <div class="prods-search">
        <span class="prods-search__icon">🔍</span>
        <input type="text" id="prods-search-input" placeholder="Поиск по названию..." />
      </div>
      <div class="prods-cats" id="prods-cats"></div>
    </div>

    <div class="prods-table-wrap" id="prods-table-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем товары...</span>
      </div>
    </div>
  `;

  document.getElementById('add-prod-btn').addEventListener('click', () => openProductModal(null));

  await Promise.all([prodsLoad(), prodsLoadCategories()]);
}

// ============================================
// 2. Загрузка товаров
// ============================================
async function prodsLoad() {
  try {
    const res = await fetch('/api/admin/products', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Ошибка загрузки');
    prodsState.all = await res.json();

    document.getElementById('prods-count').textContent = `(${prodsState.all.length})`;
    prodsRenderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('prods-table-wrap').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить товары</div>
      </div>
    `;
  }
}

// ============================================
// 3. Загрузка категорий для фильтра
// ============================================
async function prodsLoadCategories() {
  try {
    const res = await fetch('/api/admin/categories', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) return;
    prodsState.categories = await res.json();
    prodsRenderCatFilters();
  } catch {}
}

function prodsRenderCatFilters() {
  const container = document.getElementById('prods-cats');
  if (!container) return;

  container.innerHTML = `
    <button class="prods-cat is-active" data-cat="all">Все</button>
    ${prodsState.categories.map(c => `
      <button class="prods-cat" data-cat="${c.id}">${c.name}</button>
    `).join('')}
  `;

  container.querySelectorAll('.prods-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.prods-cat').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      prodsState.filterCat = btn.dataset.cat;
      prodsRenderTable();
    });
  });
}

// ============================================
// 4. Фильтрация
// ============================================
function prodsGetFiltered() {
  let list = [...prodsState.all];

  if (prodsState.filterCat !== 'all') {
    list = list.filter(p => String(p.category_id) === String(prodsState.filterCat));
  }

  if (prodsState.search.trim()) {
    const q = prodsState.search.trim().toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q));
  }

  return list;
}

// ============================================
// 5. Таблица
// ============================================
function prodsRenderTable() {
  const list = prodsGetFiltered();
  const wrap = document.getElementById('prods-table-wrap');
  if (!wrap) return;

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">📦</div>
        <div class="orders-empty__title">Товаров не найдено</div>
        <p>Измените фильтр или добавьте новый товар</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <table class="prods-table">
      <thead>
        <tr>
          <th></th>
          <th>Название</th>
          <th>Категория</th>
          <th>Цена</th>
          <th>Остаток</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${list.map(p => {
          const isCoffee = p.category_type === 'coffee';
          const stockClass = p.stock === 0 ? 'prods-table__stock--zero'
                            : p.stock < 10 ? 'prods-table__stock--low' : '';
          return `
            <tr class="${p.is_active ? '' : 'is-inactive'}">
              <td>
                <div class="prods-table__image ${isCoffee ? 'prods-table__image--coffee' : ''}">
                  ${p.image
                    ? `<img src="${p.image}" alt="${p.name}" />`
                    : (isCoffee
                      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
                      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v4M8 6h8v4H8zM6 10h12l-1 10H7L6 10z"/></svg>`)
                  }
                </div>
              </td>
              <td>
                <div class="prods-table__name">${p.name}</div>
                <div class="prods-table__desc">${p.description || ''}</div>
              </td>
              <td><span class="prods-table__cat">${p.category_name}</span></td>
              <td>
                <div class="prods-table__price">${p.price.toLocaleString('ru-RU')} ₽</div>
                <div class="prods-table__weight">${p.weight || ''}</div>
              </td>
              <td><span class="prods-table__stock ${stockClass}">${p.stock}</span></td>
              <td>
                <div class="prods-table__actions">
                  <button class="prods-table__btn" data-edit="${p.id}" title="Редактировать">✏️</button>
                  <button class="prods-table__btn" data-toggle="${p.id}" title="${p.is_active ? 'Скрыть' : 'Показать'}">
                    ${p.is_active ? '👁️' : '🙈'}
                  </button>
                  <button class="prods-table__btn prods-table__btn--danger" data-delete="${p.id}" title="Удалить">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(parseInt(btn.dataset.edit, 10)));
  });
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => prodsToggle(parseInt(btn.dataset.toggle, 10)));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => prodsDelete(parseInt(btn.dataset.delete, 10)));
  });
}

// ============================================
// 6. Поиск
// ============================================
let prodSearchTimer;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'prods-search-input') return;
  clearTimeout(prodSearchTimer);
  prodSearchTimer = setTimeout(() => {
    prodsState.search = e.target.value;
    prodsRenderTable();
  }, 250);
});

// ============================================
// 7. Модалка создания/редактирования
// ============================================
function openProductModal(id) {
  prodsState.editingId = id;
  const isEdit = id !== null;
  const p = isEdit ? prodsState.all.find(x => x.id === id) : null;
  prodsState.currentImage = p && p.image ? p.image : '';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 640px;">
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Редактировать товар' : 'Новый товар'}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <form class="admin-form" id="prod-form" novalidate>
          <div class="admin-form__error" id="prod-error"></div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="p-name">
              Название <span class="req">*</span>
            </label>
            <input type="text" id="p-name" class="admin-form__input" placeholder="Например: Наполеон" value="${p ? p.name : ''}" required />
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="p-category">
                Категория <span class="req">*</span>
              </label>
              <select id="p-category" class="admin-form__select" required>
                ${prodsState.categories.map(c => `
                  <option value="${c.id}" ${p && p.category_id === c.id ? 'selected' : ''}>${c.name}</option>
                `).join('')}
              </select>
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="p-price">
                Цена, ₽ <span class="req">*</span>
              </label>
              <input type="number" id="p-price" class="admin-form__input" placeholder="2500" min="0" step="1" value="${p ? p.price : ''}" required />
            </div>
          </div>

          <div class="prod-form-row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="p-weight">Вес / объём</label>
              <input type="text" id="p-weight" class="admin-form__input" placeholder="1 кг / 250 г" value="${p ? p.weight || '' : ''}" />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="p-stock">Остаток, шт</label>
              <input type="number" id="p-stock" class="admin-form__input" min="0" value="${p ? p.stock : 0}" />
            </div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="p-desc">Описание</label>
            <textarea id="p-desc" class="admin-form__textarea" placeholder="Краткое описание товара">${p ? p.description || '' : ''}</textarea>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">Фото товара</label>
            <div class="product-image-upload">
              <div class="product-image-upload__preview" id="product-image-preview">
                ${prodsState.currentImage
                  ? `<img src="${prodsState.currentImage}" alt="preview" />`
                  : `<span class="product-image-upload__placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                     </span>`
                }
              </div>
              <div class="product-image-upload__actions">
                <button type="button" class="btn-admin btn-admin--ghost" id="image-upload-btn">
                  ${prodsState.currentImage ? 'Заменить фото' : 'Загрузить фото'}
                </button>
                ${prodsState.currentImage ? `<button type="button" class="btn-admin btn-admin--ghost" id="image-remove-btn">Удалить</button>` : ''}
              </div>
              <input type="file" id="image-file-input" accept="image/*" hidden />
            </div>
            <span class="admin-form__hint">JPG, PNG, WEBP. До 20 МБ. Если нет — покажем иконку категории</span>
          </div>

          ${isEdit ? `
            <label class="admin-checkbox">
              <input type="checkbox" id="p-active" ${p.is_active ? 'checked' : ''} />
              Показывать на сайте
            </label>
          ` : ''}

          <div class="admin-form__footer">
            <button type="button" class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button type="submit" class="btn-admin btn-admin--primary" id="prod-submit">
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

  // Загрузка фото
  const fileInput = document.getElementById('image-file-input');
  const uploadBtn = document.getElementById('image-upload-btn');
  const preview = document.getElementById('product-image-preview');

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Загрузка...';

    try {
      const url = await uploadProductImage(file);
      prodsState.currentImage = url;
      preview.innerHTML = `<img src="${url}" alt="preview" />`;
      uploadBtn.textContent = 'Заменить фото';

      if (!document.getElementById('image-remove-btn')) {
        const actions = modal.querySelector('.product-image-upload__actions');
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'btn-admin btn-admin--ghost';
        rm.id = 'image-remove-btn';
        rm.textContent = 'Удалить';
        rm.addEventListener('click', () => {
          prodsState.currentImage = '';
          preview.innerHTML = `<span class="product-image-upload__placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </span>`;
          rm.remove();
          uploadBtn.textContent = 'Загрузить фото';
        });
        actions.appendChild(rm);
      }
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message);
    } finally {
      uploadBtn.disabled = false;
    }
  });

  document.getElementById('image-remove-btn')?.addEventListener('click', () => {
    prodsState.currentImage = '';
    preview.innerHTML = `<span class="product-image-upload__placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
    </span>`;
    document.getElementById('image-remove-btn').remove();
    uploadBtn.textContent = 'Загрузить фото';
  });

  // Отправка
  document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await prodsSubmit(isEdit, close);
  });
}

// ============================================
// 8. Отправка формы товара
// ============================================
async function prodsSubmit(isEdit, closeFn) {
  const errorBox = document.getElementById('prod-error');
  const submitBtn = document.getElementById('prod-submit');

  errorBox.classList.remove('is-visible');

  const payload = {
    category_id: parseInt(document.getElementById('p-category').value, 10),
    name: document.getElementById('p-name').value.trim(),
    price: parseFloat(document.getElementById('p-price').value),
    weight: document.getElementById('p-weight').value.trim(),
    stock: parseInt(document.getElementById('p-stock').value, 10) || 0,
    description: document.getElementById('p-desc').value.trim(),
    image: prodsState.currentImage || ''
  };

  const activeCheckbox = document.getElementById('p-active');
  if (activeCheckbox) payload.is_active = activeCheckbox.checked;

  if (!payload.name || !payload.category_id || isNaN(payload.price)) {
    errorBox.textContent = 'Заполните название, категорию и цену';
    errorBox.classList.add('is-visible');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Сохраняем...' : 'Создаём...';

  try {
    const url = isEdit
      ? `/api/admin/products/${prodsState.editingId}`
      : '/api/admin/products';
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
    await prodsLoad();
    showAdminToast(isEdit ? 'Товар обновлён' : 'Товар создан');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('is-visible');
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Сохранить' : 'Создать';
  }
}

// ============================================
// 9. Скрыть/показать
// ============================================
async function prodsToggle(id) {
  const p = prodsState.all.find(x => x.id === id);
  if (!p) return;

  try {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_active: !p.is_active })
    });

    if (!res.ok) throw new Error('Ошибка');
    p.is_active = p.is_active ? 0 : 1;
    prodsRenderTable();
    showAdminToast(p.is_active ? 'Товар показан' : 'Товар скрыт');
  } catch (err) {
    showAdminToast('Не удалось изменить видимость', 'error');
  }
}

// ============================================
// 10. Удаление
// ============================================
async function prodsDelete(id) {
  const p = prodsState.all.find(x => x.id === id);
  if (!p) return;

  if (!confirm(`Удалить товар «${p.name}»?\n\nЕсли товар уже в заказах — он будет скрыт, но не удалён.`)) return;

  try {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка удаления');

    await prodsLoad();
    showAdminToast(data.softDeleted ? data.message : 'Товар удалён');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ============================================
// 11. Загрузка фото товара
// ============================================
async function uploadProductImage(file) {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Файл больше 20 МБ');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'products');

  const res = await fetch('/api/admin/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${state.token}` },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');

  return data.file.url;
}