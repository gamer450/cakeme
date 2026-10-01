/* ============================================
   АДМИН: НАСТРОЙКИ САЙТА
   ============================================ */

const settingsState = {
  current: {},
  hasChanges: false
};

// ============================================
// 1. Рендер страницы
// ============================================
async function renderSettings(container) {
  container.innerHTML = `
    <div class="settings-page" id="settings-page">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем настройки...</span>
      </div>
    </div>
  `;

  await settingsLoad();
}

// ============================================
// 2. Загрузка
// ============================================
async function settingsLoad() {
  try {
    const res = await fetch('/api/admin/settings', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    settingsState.current = await res.json();

    renderForm();
  } catch (err) {
    console.error(err);
    document.getElementById('settings-page').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить настройки</div>
      </div>
    `;
  }
}

// ============================================
// 3. Форма
// ============================================
function renderForm() {
  const s = settingsState.current;
  const page = document.getElementById('settings-page');

  page.innerHTML = `
    <!-- ОСНОВНОЕ -->
    <div class="settings-section">
      <div class="settings-section__header">
        <div class="settings-section__icon">📋</div>
        <div>
          <div class="settings-section__title">Основное</div>
          <div class="settings-section__desc">Название и описание сайта</div>
        </div>
      </div>

      <div class="settings-grid">
        <div class="settings-field settings-field--full">
          <label class="settings-field__label" for="s-site_name">Название сайта</label>
          <input type="text" id="s-site_name" class="settings-field__input" value="${escapeAttr(s.site_name || '')}" data-setting="site_name" />
        </div>
        <div class="settings-field settings-field--full">
          <label class="settings-field__label" for="s-site_description">Описание</label>
          <textarea id="s-site_description" class="settings-field__textarea" data-setting="site_description">${escapeHtml(s.site_description || '')}</textarea>
        </div>
      </div>
    </div>

    <!-- МЕДИА САЙТА -->
    <div class="settings-section">
      <div class="settings-section__header">
        <div class="settings-section__icon">🖼️</div>
        <div>
          <div class="settings-section__title">Медиа сайта</div>
          <div class="settings-section__desc">Логотип, видео для главной и баннеры</div>
        </div>
      </div>

      <div class="settings-grid">
        ${renderMediaField('logo', 'Логотип сайта', 'SVG или PNG. Показывается в шапке и подвале', s.logo)}
        ${renderMediaField('hero_poster', 'Постер Hero', 'Статичное фото. Показывается, пока грузится видео или вместо него', s.hero_poster)}
        ${renderMediaField('hero_video', 'Видео для главной', 'MP4 или WEBM. Автоплей без звука, зациклено', s.hero_video, 'video')}
        ${renderMediaField('banner_1', 'Баннер 1', 'Промо-фото для главной', s.banner_1)}
        ${renderMediaField('banner_2', 'Баннер 2', 'Промо-фото для главной', s.banner_2)}
        ${renderMediaField('banner_3', 'Баннер 3', 'Промо-фото для главной', s.banner_3)}
      </div>
    </div>

    <!-- КОНТАКТЫ -->
    <div class="settings-section">
      <div class="settings-section__header">
        <div class="settings-section__icon">📞</div>
        <div>
          <div class="settings-section__title">Контакты</div>
          <div class="settings-section__desc">Как с вами связаться</div>
        </div>
      </div>

      <div class="settings-grid">
        <div class="settings-field">
          <label class="settings-field__label" for="s-phone">Телефон</label>
          <input type="tel" id="s-phone" class="settings-field__input" value="${escapeAttr(s.phone || '')}" data-setting="phone" placeholder="+7 900 000-00-00" />
        </div>
        <div class="settings-field">
          <label class="settings-field__label" for="s-email">Email</label>
          <input type="email" id="s-email" class="settings-field__input" value="${escapeAttr(s.email || '')}" data-setting="email" placeholder="hello@cake.ru" />
        </div>
        <div class="settings-field settings-field--full">
          <label class="settings-field__label" for="s-address">Адрес</label>
          <input type="text" id="s-address" class="settings-field__input" value="${escapeAttr(s.address || '')}" data-setting="address" placeholder="г. Москва, ул. Сладкая, 1" />
        </div>
      </div>
    </div>

    <!-- ДОСТАВКА -->
    <div class="settings-section">
      <div class="settings-section__header">
        <div class="settings-section__icon">🚚</div>
        <div>
          <div class="settings-section__title">Доставка</div>
          <div class="settings-section__desc">Стоимость и порог бесплатной доставки</div>
        </div>
      </div>

      <div class="settings-grid">
        <div class="settings-field">
          <label class="settings-field__label" for="s-delivery_price">Стоимость доставки</label>
          <div class="settings-field__wrapper">
            <input type="number" id="s-delivery_price" class="settings-field__input" value="${escapeAttr(s.delivery_price || '300')}" data-setting="delivery_price" min="0" step="10" />
            <span class="settings-field__suffix">₽</span>
          </div>
          <span class="settings-field__hint">Применяется, если заказ меньше порога</span>
        </div>
        <div class="settings-field">
          <label class="settings-field__label" for="s-free_delivery_from">Бесплатно от</label>
          <div class="settings-field__wrapper">
            <input type="number" id="s-free_delivery_from" class="settings-field__input" value="${escapeAttr(s.free_delivery_from || '3000')}" data-setting="free_delivery_from" min="0" step="100" />
            <span class="settings-field__suffix">₽</span>
          </div>
          <span class="settings-field__hint">От этой суммы — доставка бесплатна</span>
        </div>
      </div>
    </div>

    <!-- СОЦСЕТИ -->
    <div class="settings-section">
      <div class="settings-section__header">
        <div class="settings-section__icon">🔗</div>
        <div>
          <div class="settings-section__title">Соцсети</div>
          <div class="settings-section__desc">Ссылки на соцсети в подвале сайта</div>
        </div>
      </div>

      <div class="settings-grid">
        <div class="settings-field">
          <label class="settings-field__label" for="s-instagram">Instagram</label>
          <input type="url" id="s-instagram" class="settings-field__input" value="${escapeAttr(s.instagram || '')}" data-setting="instagram" placeholder="https://instagram.com/..." />
        </div>
        <div class="settings-field">
          <label class="settings-field__label" for="s-telegram">Telegram</label>
          <input type="url" id="s-telegram" class="settings-field__input" value="${escapeAttr(s.telegram || '')}" data-setting="telegram" placeholder="https://t.me/..." />
        </div>
      </div>
    </div>

    <!-- ОПАСНАЯ ЗОНА -->
    <div class="settings-section danger-zone">
      <div class="settings-section__header">
        <div class="settings-section__icon">⚠️</div>
        <div>
          <div class="settings-section__title">Опасная зона</div>
          <div class="settings-section__desc">Действия, которые нельзя отменить</div>
        </div>
      </div>

      <div class="danger-zone__content">
        <div class="danger-zone__text">
          <strong>Очистить все заказы.</strong> Удалит историю заказов и позиций. Товары, категории и пользователи останутся.
        </div>
        <button class="btn-danger" id="reset-orders-btn">Очистить заказы</button>
      </div>
    </div>

    <!-- ФУТЕР -->
    <div class="settings-footer">
      <div class="settings-footer__status" id="settings-status">Все изменения сохранены</div>
      <div class="settings-footer__actions">
        <button class="btn-admin btn-admin--ghost" id="reload-btn">Отменить</button>
        <button class="btn-admin btn-admin--primary" id="save-btn" disabled>Сохранить изменения</button>
      </div>
    </div>
  `;

  initFormHandlers();
  initMediaUploads();
  initDangerZone();
}

// ============================================
// 4. Обработчики формы
// ============================================
function initFormHandlers() {
  const inputs = document.querySelectorAll('[data-setting]');
  const saveBtn = document.getElementById('save-btn');
  const reloadBtn = document.getElementById('reload-btn');
  const status = document.getElementById('settings-status');

  inputs.forEach(input => {
    input.addEventListener('input', () => {
      settingsState.hasChanges = true;
      saveBtn.disabled = false;
      status.textContent = 'Есть несохранённые изменения';
      status.classList.remove('is-saved');
    });
  });

  saveBtn.addEventListener('click', async () => {
    const payload = {};
    inputs.forEach(input => {
      payload[input.dataset.setting] = input.value;
    });

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем...';

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');

      settingsState.hasChanges = false;
      settingsState.current = data.settings;

      status.textContent = '✓ Изменения сохранены';
      status.classList.add('is-saved');
      saveBtn.textContent = 'Сохранить изменения';
      saveBtn.disabled = true;

      showAdminToast('Настройки сохранены');

      setTimeout(() => {
        if (!settingsState.hasChanges) {
          status.textContent = 'Все изменения сохранены';
        }
      }, 3000);
    } catch (err) {
      status.textContent = 'Ошибка сохранения';
      showAdminToast(err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить изменения';
    }
  });

  reloadBtn.addEventListener('click', async () => {
    if (settingsState.hasChanges && !confirm('Отменить несохранённые изменения?')) return;
    settingsState.hasChanges = false;
    await settingsLoad();
    showAdminToast('Изменения отменены');
  });
}

// ============================================
// 5. Опасная зона
// ============================================
function initDangerZone() {
  const btn = document.getElementById('reset-orders-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const confirmText = prompt(
      'ВНИМАНИЕ! Все заказы будут удалены безвозвратно.\n\nДля подтверждения введите слово: УДАЛИТЬ'
    );

    if (confirmText !== 'УДАЛИТЬ') {
      showAdminToast('Действие отменено', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Удаляем...';

    try {
      const res = await fetch('/api/admin/settings/reset-demo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      showAdminToast(data.message);
      btn.textContent = 'Очистить заказы';
      btn.disabled = false;
    } catch (err) {
      showAdminToast(err.message, 'error');
      btn.textContent = 'Очистить заказы';
      btn.disabled = false;
    }
  });
}

// ============================================
// 6. Медиа-поля (загрузка с ПРАВИЛЬНОЙ папкой через query)
// ============================================
function renderMediaField(key, label, hint, currentValue, type = 'image') {
  return `
    <div class="settings-field settings-field--full">
      <label class="settings-field__label">${label}</label>
      <div class="media-field" data-key="${key}" data-type="${type}">
        <div class="media-field__preview">
          ${currentValue
            ? (type === 'video'
                ? `<video src="${currentValue}" muted></video>`
                : `<img src="${currentValue}" alt="${label}" />`)
            : `<span class="media-field__placeholder">Нет файла</span>`
          }
        </div>
        <div class="media-field__actions">
          <button type="button" class="btn-admin btn-admin--ghost media-field__upload">Загрузить</button>
          ${currentValue ? `<button type="button" class="btn-admin btn-admin--ghost media-field__remove">Удалить</button>` : ''}
        </div>
        <input type="file"
          class="media-field__input"
          accept="${type === 'video' ? 'video/mp4,video/webm' : 'image/*'}"
          hidden />
        <input type="hidden"
          class="media-field__value"
          data-setting="${key}"
          value="${escapeAttr(currentValue || '')}" />
      </div>
      <span class="settings-field__hint">${hint}</span>
    </div>
  `;
}

function initMediaUploads() {
  document.querySelectorAll('.media-field').forEach(field => {
    const key = field.dataset.key;
    const type = field.dataset.type;
    const fileInput = field.querySelector('.media-field__input');
    const uploadBtn = field.querySelector('.media-field__upload');
    const removeBtn = field.querySelector('.media-field__remove');
    const preview = field.querySelector('.media-field__preview');
    const valueInput = field.querySelector('.media-field__value');
    const status = document.getElementById('settings-status');
    const saveBtn = document.getElementById('save-btn');

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Загрузка...';

      try {
        // Определяем папку в зависимости от типа и ключа
        let folderName = 'banners'; // по умолчанию
        if (type === 'video' || key === 'hero_video') {
          folderName = 'hero';
        } else if (key === 'logo') {
          folderName = 'banners';
        } else if (key.startsWith('banner_')) {
          folderName = 'banners';
        }

        const formData = new FormData();
        formData.append('file', file);
        // ВАЖНО: папка передаётся через query-параметр (надёжнее в multipart)
        // а НЕ через formData, чтобы Multer успел её прочитать

        const res = await fetch(`/api/admin/media/upload?folder=${folderName}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.token}` },
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');

        const url = data.file.url;
        valueInput.value = url;

        if (type === 'video') {
          preview.innerHTML = `<video src="${url}" muted></video>`;
        } else {
          preview.innerHTML = `<img src="${url}" alt="${key}" />`;
        }

        uploadBtn.textContent = 'Заменить';

        if (!field.querySelector('.media-field__remove')) {
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'btn-admin btn-admin--ghost media-field__remove';
          rm.textContent = 'Удалить';
          rm.addEventListener('click', () => clearMediaField(field));
          field.querySelector('.media-field__actions').appendChild(rm);
        }

        status.textContent = 'Есть несохранённые изменения';
        status.classList.remove('is-saved');
        saveBtn.disabled = false;
      } catch (err) {
        alert('Ошибка: ' + err.message);
      } finally {
        uploadBtn.disabled = false;
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', () => clearMediaField(field));
    }
  });
}

function clearMediaField(field) {
  const preview = field.querySelector('.media-field__preview');
  const valueInput = field.querySelector('.media-field__value');
  const uploadBtn = field.querySelector('.media-field__upload');
  const removeBtn = field.querySelector('.media-field__remove');

  valueInput.value = '';
  preview.innerHTML = `<span class="media-field__placeholder">Нет файла</span>`;
  uploadBtn.textContent = 'Загрузить';
  if (removeBtn) removeBtn.remove();

  const status = document.getElementById('settings-status');
  const saveBtn = document.getElementById('save-btn');
  status.textContent = 'Есть несохранённые изменения';
  status.classList.remove('is-saved');
  saveBtn.disabled = false;
}

// ============================================
// 7. Хелперы
// ============================================
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}