/* ============================================
   ЛИЧНЫЙ КАБИНЕТ
   ============================================ */



const statusLabels = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  baking: 'Готовится',
  delivering: 'В доставке',
  done: 'Выполнен',
  cancelled: 'Отменён'
};


function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
// ============================================
// 1. Загрузка
// ============================================
async function init() {
  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = '/login.html?redirect=/account.html';
    return;
  }

  try {
    const [meRes, ordersRes] = await Promise.all([
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/auth/my-orders', { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (meRes.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return;
    }

    const me = await meRes.json();
    const orders = await ordersRes.json();

    render(me.user, orders);
  } catch (err) {
    console.error('Ошибка загрузки кабинета:', err);
    document.getElementById('account-container').innerHTML = `
      <p class="text-center">Не удалось загрузить данные. <a href="/login.html">Войти снова</a></p>
    `;
  }
}

// ============================================
// 2. Рендер кабинета
// ============================================
function render(user, orders) {
  const container = document.getElementById('account-container');
  const initial = user.name.charAt(0).toUpperCase();

  container.innerHTML = `
    <div class="account-layout">
      <aside class="account-sidebar">
        <div class="account-user">
          <div class="account-user__avatar">${initial}</div>
          <div class="account-user__name">${escapeHtml(user.name)}</div>
          <div class="account-user__email">${escapeHtml(user.email)}</div>
          <span class="account-user__role">${user.role}</span>
        </div>

        <div class="account-menu">
          <button class="account-menu__item is-active" data-tab="orders">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
            </svg>
            Мои заказы
          </button>
          <button class="account-menu__item" data-tab="profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Профиль
          </button>
            <button class="account-menu__item" data-tab="security">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Безопасность
            </button>
          ${user.role === 'admin' ? `
            <a href="/admin/" class="account-menu__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 20h20l-2-9-4 3-4-7-4 7-4-3z"/>
              </svg>
              Админ-панель
            </a>
          ` : ''}
          ${user.role === 'manager' ? `
            <a href="/admin/" class="account-menu__item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="14" x="2" y="7" rx="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              Панель менеджера
            </a>
          ` : ''}
          <button class="account-menu__item account-menu__item--danger" id="logout-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Выйти
          </button>
        </div>
      </aside>

      <div class="account-content">
        <div class="account-tab is-active" data-tab="orders">
          <h2 class="account-tab__title">История заказов</h2>
          ${renderOrders(orders)}
        </div>

        <div class="account-tab" data-tab="profile">
          <h2 class="account-tab__title">Профиль</h2>
          <div class="profile-grid">
            <div class="profile-field">
              <span class="profile-field__label">Имя</span>
              <div class="profile-field__value">${user.name}</div>
            </div>
            <div class="profile-field">
              <span class="profile-field__label">Email</span>
              <div class="profile-field__value">${user.email}</div>
            </div>
            <div class="profile-field">
              <span class="profile-field__label">Телефон</span>
              <div class="profile-field__value">${user.phone || '—'}</div>
            </div>
            <div class="profile-field">
              <span class="profile-field__label">Роль</span>
              <div class="profile-field__value">${user.role}</div>
            </div>
          </div>
        </div>

        <div class="account-tab" data-tab="security">
          <h2 class="account-tab__title">Безопасность</h2>
          <div id="security-content">
            <div class="loading">
              <div class="loading__spinner"></div>
              Загружаем...
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  initTabs();
  initLogout();
  initReviewButtons();
  initSecurityTab();
}

// ============================================
// 3. Список заказов
// ============================================
function renderOrders(orders) {
  if (!orders.length) {
    return `
      <div class="account-empty">
        <div class="account-empty__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
          </svg>
        </div>
        <div class="account-empty__title">Заказов пока нет</div>
        <p class="account-empty__text">Загляните в каталог и выберите что-нибудь вкусное</p>
        <a href="/catalog.html" class="btn btn-primary btn-lg magnetic">Перейти в каталог</a>
      </div>
    `;
  }

  // Проверяем, оставлен ли уже отзыв для каждого заказа
  const reviewStatuses = JSON.parse(localStorage.getItem('reviewed_orders') || '{}');

  return `
    <div class="orders-list">
      ${orders.map(o => {
        const canReview = o.status === 'done';
        const alreadyReviewed = reviewStatuses[o.id];

        return `
        <div class="order-card">
          <div class="order-card__header">
            <div>
              <div class="order-card__id">Заказ №${o.id}</div>
              <div class="order-card__date">${formatDate(o.created_at)}</div>
            </div>
            <span class="order-card__status order-status--${o.status}">${statusLabels[o.status] || o.status}</span>
          </div>
          <div class="order-card__items">
            ${o.items.map(i => `
              <div class="order-card__item">
                <span>${escapeHtml(i.product_name)} × ${i.quantity}</span>
                <span>${(i.price * i.quantity).toLocaleString('ru-RU')} ₽</span>
              </div>
            `).join('')}
          </div>
          <div class="order-card__total">
            <span class="order-card__total-label">Итого</span>
            <span class="order-card__total-value">${o.total.toLocaleString('ru-RU')} ₽</span>
          </div>

          ${canReview ? `
            <div class="order-card__actions">
              ${alreadyReviewed
                ? `<div class="order-card__review-done">
                     ✓ Спасибо за отзыв!
                   </div>`
                : `<button class="btn btn-secondary order-card__review-btn" data-review-order="${o.id}">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>
                     </svg>
                     Оставить отзыв
                   </button>`
              }
            </div>
          ` : ''}
        </div>
      `}).join('')}
    </div>
  `;
}

function formatDate(str) {
  try {
    const d = new Date(str.replace(' ', 'T'));
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return str;
  }
}

// ============================================
// 4. Вкладки
// ============================================
function initTabs() {
  const menu = document.querySelectorAll('.account-menu__item[data-tab]');
  const tabs = document.querySelectorAll('.account-tab');

  menu.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      menu.forEach(m => m.classList.remove('is-active'));
      item.classList.add('is-active');
      tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabName));
    });
  });
}

// ============================================
// 5. Выход
// ============================================
function initLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (!confirm('Выйти из аккаунта?')) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    window.location.href = '/';
  });
}

// ============================================
// 6. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', init);
// ============================================
// 7. Кнопка «Оставить отзыв»
// ============================================
function initReviewButtons() {
  document.querySelectorAll('[data-review-order]').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = parseInt(btn.dataset.reviewOrder, 10);
      openReviewModal(orderId);
    });
  });
}

// ============================================
// Модалка отзыва
// ============================================
function openReviewModal(orderId) {
  // Удаляем старую если есть
  document.getElementById('review-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'review-modal';
  modal.className = 'modal review-modal';

  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 600px;">
      <div class="modal__header">
        <div class="modal__title">Отзыв о заказе №${orderId}</div>
        <button class="modal__close" data-close>✕</button>
      </div>

      <div class="modal__body">
        <form class="review-form" id="account-review-form" novalidate>
          <div class="review-form__stars">
            <button type="button" class="review-form__star" data-value="1">★</button>
            <button type="button" class="review-form__star" data-value="2">★</button>
            <button type="button" class="review-form__star" data-value="3">★</button>
            <button type="button" class="review-form__star" data-value="4">★</button>
            <button type="button" class="review-form__star" data-value="5">★</button>
          </div>

          <div class="review-form__field">
            <label class="review-form__label" for="acc-review-text">
              Ваш отзыв <span class="req">*</span>
            </label>
            <textarea class="review-form__textarea" id="acc-review-text" name="text" placeholder="Что вам понравилось?" required></textarea>
          </div>

          <div class="review-form__field">
            <label class="review-form__label">Фото (до 3 штук)</label>
            <div class="review-form__photos" id="acc-review-photos">
              <input type="file" id="acc-review-photos-input" accept="image/*" multiple hidden />
              <div class="review-form__photos-preview" id="acc-review-photos-preview"></div>
              <button type="button" class="review-form__photos-add" id="acc-review-photos-add">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                Добавить фото
              </button>
            </div>
            <div class="review-form__hint">Фото появятся после модерации</div>
          </div>

          <div class="review-form__message"></div>

          <div style="display:flex; gap:12px; margin-top:16px;">
            <button type="button" class="btn btn-ghost" data-close style="flex:1;">Отмена</button>
            <button type="submit" class="btn btn-primary" id="acc-review-submit" style="flex:1;">Отправить отзыв</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('is-open'));

  // Закрытие
  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 250);
    document.removeEventListener('keydown', escHandler);
  };

  const escHandler = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', escHandler);

  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => e.target === modal && close());

  // ============================================
  // Логика формы
  // ============================================
  const form = modal.querySelector('#account-review-form');
  let selectedRating = 0;
  let selectedPhotos = [];

  // Звёзды
  form.querySelectorAll('.review-form__star').forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value, 10);
      form.querySelectorAll('.review-form__star').forEach(s => {
        s.classList.toggle('is-active', parseInt(s.dataset.value, 10) <= selectedRating);
      });
    });
    star.addEventListener('mouseenter', () => {
      const hover = parseInt(star.dataset.value, 10);
      form.querySelectorAll('.review-form__star').forEach(s => {
        s.style.color = parseInt(s.dataset.value, 10) <= hover ? 'var(--gold-bright)' : 'var(--border-strong)';
      });
    });
  });

  form.querySelector('.review-form__stars')?.addEventListener('mouseleave', () => {
    form.querySelectorAll('.review-form__star').forEach(s => {
      s.style.color = '';
      s.classList.toggle('is-active', parseInt(s.dataset.value, 10) <= selectedRating);
    });
  });

  // Фото
  const photoInput = modal.querySelector('#acc-review-photos-input');
  const photoAdd = modal.querySelector('#acc-review-photos-add');
  const photoPreview = modal.querySelector('#acc-review-photos-preview');

  photoAdd?.addEventListener('click', () => photoInput.click());

  photoInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (selectedPhotos.length + files.length > 3) {
      showMsg('Максимум 3 фото', 'error');
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showMsg('Файл больше 5 МБ', 'error');
        continue;
      }
      selectedPhotos.push(file);
    }

    renderPhotoPreview();
    photoInput.value = '';
  });

  function renderPhotoPreview() {
    if (!photoPreview) return;
    photoPreview.innerHTML = selectedPhotos.map((file, idx) => `
      <div class="review-form__photo-item">
        <img src="${URL.createObjectURL(file)}" alt="Фото ${idx + 1}" />
        <button type="button" class="review-form__photo-remove" data-idx="${idx}">✕</button>
      </div>
    `).join('');

    photoPreview.querySelectorAll('.review-form__photo-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPhotos.splice(parseInt(btn.dataset.idx, 10), 1);
        renderPhotoPreview();
      });
    });

    if (photoAdd) photoAdd.style.display = selectedPhotos.length >= 3 ? 'none' : 'flex';
  }

  // Отправка
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = modal.querySelector('#acc-review-submit');

    if (selectedRating === 0) {
      showMsg('Поставьте оценку', 'error');
      return;
    }

    const text = form.querySelector('#acc-review-text').value.trim();
    if (text.length < 10) {
      showMsg('Напишите отзыв (мин. 10 символов)', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const formData = new FormData();
      formData.append('author_name', user.name || 'Клиент');
      formData.append('author_email', user.email || '');
      formData.append('rating', selectedRating);
      formData.append('text', text);
      formData.append('order_id', orderId);

      selectedPhotos.forEach(f => formData.append('photos', f));

      const res = await fetch('/api/reviews', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      // Помечаем заказ как "отзыв оставлен"
      const reviewed = JSON.parse(localStorage.getItem('reviewed_orders') || '{}');
      reviewed[orderId] = true;
      localStorage.setItem('reviewed_orders', JSON.stringify(reviewed));

      close();
      showToast('Спасибо за отзыв! Он появится после модерации.');

      // Обновляем кабинет
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      showMsg(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить отзыв';
    }
  });

  function showMsg(text, type) {
    const msg = form.querySelector('.review-form__message');
    msg.textContent = text;
    msg.className = `review-form__message is-${type}`;
  }
}
// ============================================
// 8. Безопасность (2FA)
// ============================================
async function initSecurityTab() {
  const content = document.getElementById('security-content');
  if (!content) return;

  // Загружаем статус 2FA
  await load2FAStatus();
}

async function load2FAStatus() {
  const content = document.getElementById('security-content');
  if (!content) return;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/2fa/status', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Ошибка');

    const status = await res.json();
    render2FACard(status);
  } catch (err) {
    content.innerHTML = `
      <p style="color:var(--text-muted);">Не удалось загрузить статус 2FA</p>
    `;
  }
}

function render2FACard(status) {
  const content = document.getElementById('security-content');

  content.innerHTML = `
    <div class="security-card ${status.enabled ? 'is-enabled' : 'is-disabled'}">
      <div class="security-card__header">
        <div class="security-card__icon">
          ${status.enabled ? '🔐' : '🔓'}
        </div>
        <div class="security-card__title-wrap">
          <h3 class="security-card__title">Двухфакторная аутентификация</h3>
          <p class="security-card__subtitle">
            ${status.enabled
              ? '✅ Включена — ваш аккаунт защищён'
              : '⚠️ Выключена — рекомендуем включить'}
          </p>
        </div>
      </div>

      <div class="security-card__body">
        ${status.enabled ? `
          <div class="security-info">
            <div class="security-info__row">
              <span>Резервных кодов осталось:</span>
              <strong>${status.backup_codes_remaining}</strong>
            </div>
            ${status.last_used ? `
              <div class="security-info__row">
                <span>Последний вход с 2FA:</span>
                <strong>${formatDate2FA(status.last_used)}</strong>
              </div>
            ` : ''}
          </div>
          <p class="security-card__hint">
            При входе нужно будет вводить код из Google Authenticator или Authy
          </p>
        ` : `
          <p class="security-card__hint">
            2FA защищает аккаунт даже если пароль украдут.
            Каждый раз при входе нужно будет вводить код из приложения
            Google Authenticator или Authy.
          </p>
        `}
      </div>

      <div class="security-card__actions">
        ${status.enabled ? `
          <button class="btn btn-secondary" id="regen-backup-btn">Перегенерировать коды</button>
          <button class="btn btn-ghost" id="disable-2fa-btn" style="color:var(--danger);">Отключить 2FA</button>
        ` : `
          <button class="btn btn-primary btn-lg magnetic" id="enable-2fa-btn">
            🔐 Включить 2FA
          </button>
        `}
      </div>
    </div>
  `;

  if (status.enabled) {
    document.getElementById('regen-backup-btn')?.addEventListener('click', regenerateBackupCodes);
    document.getElementById('disable-2fa-btn')?.addEventListener('click', disable2FA);
  } else {
    document.getElementById('enable-2fa-btn')?.addEventListener('click', start2FASetup);
  }
}

// ============================================
// Начать настройку 2FA
// ============================================
async function start2FASetup() {
  const content = document.getElementById('security-content');
  content.innerHTML = `
    <div class="loading">
      <div class="loading__spinner"></div>
      Генерируем QR-код...
    </div>
  `;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/2fa/setup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    render2FASetup(data);
  } catch (err) {
    content.innerHTML = `
      <div class="security-error">${err.message}</div>
      <button class="btn btn-secondary" onclick="load2FAStatus()">Назад</button>
    `;
  }
}

function render2FASetup(data) {
  const content = document.getElementById('security-content');

  content.innerHTML = `
    <div class="security-setup">
      <h3 class="security-setup__title">Настройка 2FA</h3>

      <div class="security-setup__steps">
        <div class="security-step">
          <div class="security-step__num">1</div>
          <div class="security-step__text">
            <strong>Установите приложение</strong>
            <p>Google Authenticator, Authy, Microsoft Authenticator или любое другое TOTP-приложение</p>
          </div>
        </div>

        <div class="security-step">
          <div class="security-step__num">2</div>
          <div class="security-step__text">
            <strong>Отсканируйте QR-код</strong>
            <p>Откройте приложение → «Добавить аккаунт» → «Сканировать QR»</p>
          </div>
        </div>

        <div class="security-step">
          <div class="security-step__num">3</div>
          <div class="security-step__text">
            <strong>Введите код из приложения</strong>
            <p>Введите 6-значный код, который покажет приложение</p>
          </div>
        </div>
      </div>

      <div class="security-setup__qr">
        <img src="${data.qr_code}" alt="QR-код для 2FA" />
      </div>

      <details class="security-setup__manual">
        <summary>Не получается отсканировать? Введите код вручную</summary>
        <div class="security-setup__secret">${data.secret}</div>
      </details>

      <div class="security-setup__form">
        <label class="security-form__label">Код из приложения</label>
        <div class="security-form__input-wrap">
          <input type="text" id="2fa-setup-code" class="security-form__input"
                 placeholder="000 000" maxlength="7" autocomplete="off" inputmode="numeric" />
        </div>
        <div class="security-error" id="2fa-setup-error"></div>
      </div>

      <div class="security-setup__actions">
        <button class="btn btn-ghost" onclick="load2FAStatus()">Отмена</button>
        <button class="btn btn-primary" id="2fa-confirm-btn">Подтвердить и включить</button>
      </div>
    </div>
  `;

  // Автоформат ввода с пробелом
  const codeInput = document.getElementById('2fa-setup-code');
  codeInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (v.length > 3) v = v.slice(0, 3) + ' ' + v.slice(3);
    e.target.value = v;
  });

  codeInput.focus();

  document.getElementById('2fa-confirm-btn').addEventListener('click', confirm2FASetup);
}

async function confirm2FASetup() {
  const btn = document.getElementById('2fa-confirm-btn');
  const errorBox = document.getElementById('2fa-setup-error');
  const code = document.getElementById('2fa-setup-code').value.replace(/\s/g, '');

  errorBox.classList.remove('is-visible');

  if (code.length !== 6) {
    errorBox.textContent = 'Введите 6 цифр';
    errorBox.classList.add('is-visible');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Проверяем...';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/2fa/enable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Показываем резервные коды
    render2FABackupCodes(data.backup_codes);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('is-visible');
    btn.disabled = false;
    btn.textContent = 'Подтвердить и включить';
  }
}

function render2FABackupCodes(codes) {
  const content = document.getElementById('security-content');

  content.innerHTML = `
    <div class="security-backup">
      <div class="security-backup__icon">✅</div>
      <h3 class="security-backup__title">2FA включена!</h3>
      <p class="security-backup__subtitle">
        Сохраните резервные коды в безопасном месте.
        Каждый код можно использовать <strong>один раз</strong>, если вы потеряете телефон.
      </p>

      <div class="security-backup__codes">
        ${codes.map(c => `<div class="security-backup__code">${c}</div>`).join('')}
      </div>

      <div class="security-backup__actions">
        <button class="btn btn-secondary" id="download-codes-btn">
          💾 Скачать как TXT
        </button>
        <button class="btn btn-secondary" id="copy-codes-btn">
          📋 Скопировать все
        </button>
        <button class="btn btn-primary" onclick="load2FAStatus()">
          Понятно, продолжить
        </button>
      </div>
    </div>
  `;

  document.getElementById('download-codes-btn').addEventListener('click', () => {
    const text = `Резервные коды Cake.Me 2FA\n\nДата: ${new Date().toLocaleString('ru-RU')}\n\n${codes.join('\n')}\n\nКаждый код можно использовать один раз.\nХраните в безопасном месте.`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cake-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('copy-codes-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(codes.join('\n')).then(() => {
      showToast('Коды скопированы в буфер');
    });
  });
}

// ============================================
// Отключить 2FA
// ============================================
function disable2FA() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 480px;">
      <div class="modal__header">
        <div class="modal__title">Отключить 2FA</div>
        <button class="modal__close" data-close>✕</button>
      </div>
      <div class="modal__body">
        <p style="color:var(--text-secondary);margin-bottom:16px;">
          Для отключения введите пароль и код из приложения (или резервный код).
        </p>

        <div class="review-form__field">
          <label class="review-form__label">Пароль</label>
          <input type="password" class="review-form__input" id="disable-password" />
        </div>

        <div class="review-form__field">
          <label class="review-form__label">Код из приложения</label>
          <input type="text" class="review-form__input" id="disable-code" placeholder="000 000" maxlength="9" />
        </div>

        <div class="security-error" id="disable-error"></div>

        <div style="display:flex;gap:12px;margin-top:16px;">
          <button class="btn btn-ghost" data-close style="flex:1;">Отмена</button>
          <button class="btn btn-primary" id="disable-confirm" style="flex:1;">Отключить</button>
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

  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => e.target === modal && close());

  document.getElementById('disable-confirm').addEventListener('click', async () => {
    const password = document.getElementById('disable-password').value;
    const code = document.getElementById('disable-code').value.replace(/\s/g, '');
    const errorBox = document.getElementById('disable-error');

    errorBox.classList.remove('is-visible');

    if (!password || !code) {
      errorBox.textContent = 'Заполните все поля';
      errorBox.classList.add('is-visible');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password, code })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      close();
      showToast('2FA отключена');
      load2FAStatus();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('is-visible');
    }
  });
}

// ============================================
// Перегенерировать резервные коды
// ============================================
function regenerateBackupCodes() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 480px;">
      <div class="modal__header">
        <div class="modal__title">Новые резервные коды</div>
        <button class="modal__close" data-close>✕</button>
      </div>
      <div class="modal__body">
        <p style="color:var(--text-secondary);margin-bottom:16px;">
          Введите код из приложения. <strong>Старые коды перестанут работать.</strong>
        </p>

        <div class="review-form__field">
          <label class="review-form__label">Код из приложения</label>
          <input type="text" class="review-form__input" id="regen-code" placeholder="000 000" maxlength="7" />
        </div>

        <div class="security-error" id="regen-error"></div>

        <div style="display:flex;gap:12px;margin-top:16px;">
          <button class="btn btn-ghost" data-close style="flex:1;">Отмена</button>
          <button class="btn btn-primary" id="regen-confirm" style="flex:1;">Перегенерировать</button>
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

  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => e.target === modal && close());

  document.getElementById('regen-confirm').addEventListener('click', async () => {
    const code = document.getElementById('regen-code').value.replace(/\s/g, '');
    const errorBox = document.getElementById('regen-error');
    errorBox.classList.remove('is-visible');

    if (code.length !== 6) {
      errorBox.textContent = 'Введите 6 цифр';
      errorBox.classList.add('is-visible');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/2fa/regenerate-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      close();
      render2FABackupCodes(data.backup_codes);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('is-visible');
    }
  });
}

function formatDate2FA(str) {
  try {
    const d = new Date(str.replace(' ', 'T'));
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return str; }
}