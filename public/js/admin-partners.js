/* ============================================
   АДМИН: ПАРТНЁРЫ
   ============================================ */

const partnersState = {
  all: [],
  editingId: null,
  currentImage: ''
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderPartners(container) {
  container.innerHTML = `
    <div class="partners-header">
      <h2 class="partners-header__title">Партнёры <small id="partners-count"></small></h2>
      <button class="btn-add" id="add-partner-btn">
        <span>+</span> Добавить партнёра
      </button>
    </div>

    <div id="partners-grid-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем партнёров...</span>
      </div>
    </div>
  `;

  document.getElementById('add-partner-btn').addEventListener('click', () => openPartnerModal(null));

  await partnersLoad();
}

// ============================================
// 2. Загрузка
// ============================================
async function partnersLoad() {
  try {
    const res = await fetch('/api/admin/partners', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    partnersState.all = await res.json();

    document.getElementById('partners-count').textContent = `(${partnersState.all.length})`;
    partnersRenderGrid();
  } catch (err) {
    console.error(err);
    document.getElementById('partners-grid-wrap').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить партнёров</div>
      </div>
    `;
  }
}

// ============================================
// 3. Сетка карточек
// ============================================
function partnersRenderGrid() {
  const wrap = document.getElementById('partners-grid-wrap');
  if (!wrap) return;

  if (partnersState.all.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">🤝</div>
        <div class="orders-empty__title">Партнёров пока нет</div>
        <p>Добавьте первую кофейню</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="partners-grid">
      ${partnersState.all.map(p => `
        <div class="partner-card ${p.is_active ? '' : 'is-inactive'}">
          <div class="partner-card__image">
            ${p.image
              ? `<img src="${p.image}" alt="${p.name}" />`
              : `<div class="partner-card__image-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
                    <path d="M6 1v3M10 1v3M14 1v3"/>
                  </svg>
                 </div>`
            }
            ${!p.is_active ? '<span class="partner-card__badge partner-card__badge--inactive">Скрыт</span>' : ''}
          </div>

          <div class="partner-card__body">
            <div class="partner-card__name">${p.name}</div>
            <div class="partner-card__desc">${p.description || '—'}</div>

            <div class="partner-card__meta">
              <div class="partner-card__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>${p.address}${p.city ? ', ' + p.city : ''}</span>
              </div>
              ${p.phone ? `
                <div class="partner-card__meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span>${p.phone}</span>
                </div>
              ` : ''}
              ${p.hours ? `
                <div class="partner-card__meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 3"/>
                  </svg>
                  <span>${p.hours}</span>
                </div>
              ` : ''}
            </div>

            <div class="partner-card__actions">
              <button class="partner-card__btn" data-edit="${p.id}">Изменить</button>
              <button class="partner-card__btn" data-toggle="${p.id}">${p.is_active ? 'Скрыть' : 'Показать'}</button>
              <button class="partner-card__btn partner-card__btn--danger" data-delete="${p.id}">Удалить</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openPartnerModal(parseInt(btn.dataset.edit, 10)));
  });
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => partnersToggle(parseInt(btn.dataset.toggle, 10)));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => partnersDelete(parseInt(btn.dataset.delete, 10)));
  });
}

// ============================================
// 4. Модалка создания/редактирования
// ============================================
function openPartnerModal(id) {
  partnersState.editingId = id;
  const isEdit = id !== null;
  const p = isEdit ? partnersState.all.find(x => x.id === id) : null;
  partnersState.currentImage = p && p.image ? p.image : '';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 640px;">
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Редактировать партнёра' : 'Новый партнёр'}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <form class="admin-form" id="partner-form" novalidate>
          <div class="admin-form__error" id="partner-error"></div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="pt-name">
              Название <span class="req">*</span>
            </label>
            <input type="text" id="pt-name" class="admin-form__input" placeholder="Кофейня «Утро»" value="${p ? p.name : ''}" required />
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="pt-desc">Описание</label>
            <textarea id="pt-desc" class="admin-form__textarea" placeholder="Краткое описание партнёра">${p ? p.description || '' : ''}</textarea>
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-address">
                Адрес <span class="req">*</span>
              </label>
              <input type="text" id="pt-address" class="admin-form__input" placeholder="ул. Тверская, 12" value="${p ? p.address : ''}" required />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-city">Город</label>
              <input type="text" id="pt-city" class="admin-form__input" placeholder="Москва" value="${p ? p.city || '' : ''}" />
            </div>
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-phone">Телефон</label>
              <input type="tel" id="pt-phone" class="admin-form__input" placeholder="+7 900 000-00-00" value="${p ? p.phone || '' : ''}" />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-hours">Часы работы</label>
              <input type="text" id="pt-hours" class="admin-form__input" placeholder="Пн–Вс: 8:00 – 22:00" value="${p ? p.hours || '' : ''}" />
            </div>
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-lat">Широта (latitude)</label>
              <input type="number" id="pt-lat" class="admin-form__input" placeholder="55.755864" step="0.000001" value="${p && p.latitude ? p.latitude : ''}" />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-lng">Долгота (longitude)</label>
              <input type="number" id="pt-lng" class="admin-form__input" placeholder="37.617698" step="0.000001" value="${p && p.longitude ? p.longitude : ''}" />
            </div>
          </div>

          <div class="admin-form__row">
            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-website">Сайт</label>
              <input type="url" id="pt-website" class="admin-form__input" placeholder="https://example.com" value="${p ? p.website || '' : ''}" />
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label" for="pt-instagram">Instagram</label>
              <input type="url" id="pt-instagram" class="admin-form__input" placeholder="https://instagram.com/..." value="${p ? p.instagram || '' : ''}" />
            </div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">Фото партнёра</label>
            <div class="partner-image-upload">
              <div class="partner-image-upload__preview" id="partner-image-preview">
                ${partnersState.currentImage
                  ? `<img src="${partnersState.currentImage}" alt="preview" />`
                  : `<span class="partner-image-upload__placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                     </span>`
                }
              </div>
              <div class="partner-image-upload__actions">
                <button type="button" class="btn-admin btn-admin--ghost" id="partner-image-upload-btn">
                  ${partnersState.currentImage ? 'Заменить фото' : 'Загрузить фото'}
                </button>
                ${partnersState.currentImage ? `<button type="button" class="btn-admin btn-admin--ghost" id="partner-image-remove-btn">Удалить</button>` : ''}
              </div>
              <input type="file" id="partner-image-file-input" accept="image/*" hidden />
            </div>
            <span class="admin-form__hint">JPG, PNG, WEBP. До 20 МБ</span>
          </div>

          ${isEdit ? `
            <label class="admin-checkbox">
              <input type="checkbox" id="pt-active" ${p.is_active ? 'checked' : ''} />
              Показывать на сайте
            </label>
          ` : ''}

          <div class="admin-form__footer">
            <button type="button" class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button type="submit" class="btn-admin btn-admin--primary" id="partner-submit">
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
  const fileInput = document.getElementById('partner-image-file-input');
  const uploadBtn = document.getElementById('partner-image-upload-btn');
  const preview = document.getElementById('partner-image-preview');

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Загрузка...';

    try {
      const url = await uploadPartnerImage(file);
      partnersState.currentImage = url;
      preview.innerHTML = `<img src="${url}" alt="preview" />`;
      uploadBtn.textContent = 'Заменить фото';

      if (!document.getElementById('partner-image-remove-btn')) {
        const actions = modal.querySelector('.partner-image-upload__actions');
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'btn-admin btn-admin--ghost';
        rm.id = 'partner-image-remove-btn';
        rm.textContent = 'Удалить';
        rm.addEventListener('click', () => {
          partnersState.currentImage = '';
          preview.innerHTML = `<span class="partner-image-upload__placeholder">
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

  document.getElementById('partner-image-remove-btn')?.addEventListener('click', () => {
    partnersState.currentImage = '';
    preview.innerHTML = `<span class="partner-image-upload__placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
    </span>`;
    document.getElementById('partner-image-remove-btn').remove();
    uploadBtn.textContent = 'Загрузить фото';
  });

  // Отправка
  document.getElementById('partner-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await partnersSubmit(isEdit, close);
  });
}

// ============================================
// 5. Отправка формы
// ============================================
async function partnersSubmit(isEdit, closeFn) {
  const errorBox = document.getElementById('partner-error');
  const submitBtn = document.getElementById('partner-submit');

  errorBox.classList.remove('is-visible');

  const payload = {
    name: document.getElementById('pt-name').value.trim(),
    description: document.getElementById('pt-desc').value.trim(),
    address: document.getElementById('pt-address').value.trim(),
    city: document.getElementById('pt-city').value.trim(),
    phone: document.getElementById('pt-phone').value.trim(),
    hours: document.getElementById('pt-hours').value.trim(),
    latitude: document.getElementById('pt-lat').value,
    longitude: document.getElementById('pt-lng').value,
    website: document.getElementById('pt-website').value.trim(),
    instagram: document.getElementById('pt-instagram').value.trim(),
    image: partnersState.currentImage || ''
  };

  const activeCheckbox = document.getElementById('pt-active');
  if (activeCheckbox) payload.is_active = activeCheckbox.checked;

  if (!payload.name || !payload.address) {
    errorBox.textContent = 'Заполните название и адрес';
    errorBox.classList.add('is-visible');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Сохраняем...' : 'Создаём...';

  try {
    const url = isEdit
      ? `/api/admin/partners/${partnersState.editingId}`
      : '/api/admin/partners';
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
    await partnersLoad();
    showAdminToast(isEdit ? 'Партнёр обновлён' : 'Партнёр создан');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('is-visible');
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Сохранить' : 'Создать';
  }
}

// ============================================
// 6. Скрыть/показать
// ============================================
async function partnersToggle(id) {
  const p = partnersState.all.find(x => x.id === id);
  if (!p) return;

  try {
    const res = await fetch(`/api/admin/partners/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_active: !p.is_active })
    });

    if (!res.ok) throw new Error('Ошибка');
    p.is_active = p.is_active ? 0 : 1;
    partnersRenderGrid();
    showAdminToast(p.is_active ? 'Партнёр показан' : 'Партнёр скрыт');
  } catch (err) {
    showAdminToast('Не удалось изменить видимость', 'error');
  }
}

// ============================================
// 7. Удаление
// ============================================
async function partnersDelete(id) {
  const p = partnersState.all.find(x => x.id === id);
  if (!p) return;

  if (!confirm(`Удалить партнёра «${p.name}»?\n\nЭто действие необратимо.`)) return;

  try {
    const res = await fetch(`/api/admin/partners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка удаления');

    await partnersLoad();
    showAdminToast('Партнёр удалён');
  } catch (err) {
    showAdminToast(err.message, 'error');
  }
}

// ============================================
// 8. Загрузка фото партнёра
// ============================================
async function uploadPartnerImage(file) {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Файл больше 20 МБ');
  }

  const formData = new FormData();
  formData.append('file', file);

  // Отправляем в папку banners
  const res = await fetch('/api/admin/media/upload?folder=banners', {
    method: 'POST',
    headers: { Authorization: `Bearer ${state.token}` },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');

  return data.file.url;
}