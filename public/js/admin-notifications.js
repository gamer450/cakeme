/* ============================================================
   АДМИН: УВЕДОМЛЕНИЯ — Email, SMS, Telegram
   ============================================================ */

const notifState = {
  status: null,
  testing: { email: false, sms: false, telegram: false }
};

// ============================================================
// 1. Рендер страницы
// ============================================================
async function renderNotifications(container) {
  container.innerHTML = `
    <div class="notif-header">
      <h2 class="notif-header__title">Уведомления</h2>
      <p class="notif-header__subtitle">
        Настройки Email, SMS и Telegram — статус и тесты
      </p>
    </div>

    <div id="notif-content">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем статус сервисов...</span>
      </div>
    </div>
  `;

  await notifLoad();
}

// ============================================================
// 2. Загрузка статуса
// ============================================================
async function notifLoad() {
  const wrap = document.getElementById('notif-content');
  if (!wrap) return;

  try {
    const res = await fetch('/api/admin/notifications/status', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    notifState.status = await res.json();

    notifRender();
  } catch (err) {
    console.error(err);
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить статус</div>
      </div>
    `;
  }
}

// ============================================================
// 3. Рендер карточек
// ============================================================
function notifRender() {
  const wrap = document.getElementById('notif-content');
  const s = notifState.status;

  wrap.innerHTML = `
    <!-- EMAIL -->
    <div class="notif-card ${s.email.enabled && s.email.configured ? 'is-active' : ''}">
      <div class="notif-card__header">
        <div class="notif-card__icon">📧</div>
        <div class="notif-card__title-wrap">
          <h3 class="notif-card__title">Email-уведомления</h3>
          <span class="notif-card__status">
            ${notifStatusBadge(s.email)}
          </span>
        </div>
      </div>

      <div class="notif-card__body">
        <p class="notif-card__desc">
          Письма клиенту о создании заказа и админу о новых заказах.
          Через SMTP: Яндекс, Mail.ru, Gmail и др.
        </p>

        <div class="notif-card__field">
          <label class="notif-card__label">Email для теста</label>
          <input type="email" id="test-email-input" class="admin-form__input"
                 placeholder="you@example.com"
                 value="${state.user?.email || ''}" />
        </div>

        ${!s.email.configured ? `
          <div class="notif-card__hint">
            ⚠️ Настройки SMTP не заполнены в <code>.env</code>.
            Укажите <code>SMTP_USER</code>, <code>SMTP_PASS</code> и <code>EMAIL_ENABLED=true</code>.
            Пока что письма будут писаться в консоль сервера.
          </div>
        ` : ''}
      </div>

      <div class="notif-card__actions">
        <button class="notif-card__btn notif-card__btn--test" id="test-email-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2 11 13"/>
            <path d="m22 2-7 20-4-9-9-4Z"/>
          </svg>
          Отправить тест
        </button>
      </div>
    </div>

    <!-- SMS -->
    <div class="notif-card ${s.sms.enabled && s.sms.configured ? 'is-active' : ''}">
      <div class="notif-card__header">
        <div class="notif-card__icon">📱</div>
        <div class="notif-card__title-wrap">
          <h3 class="notif-card__title">SMS-уведомления</h3>
          <span class="notif-card__status">
            ${notifStatusBadge(s.sms)}
          </span>
        </div>
      </div>

      <div class="notif-card__body">
        <p class="notif-card__desc">
          SMS клиенту при смене статуса заказа.
          Через сервис <a href="https://sms.ru" target="_blank">SMS.RU</a>.
        </p>

        <div class="notif-card__field">
          <label class="notif-card__label">Номер телефона для теста</label>
          <input type="tel" id="test-phone-input" class="admin-form__input"
                 placeholder="+7 900 000-00-00" />
        </div>

        ${!s.sms.configured ? `
          <div class="notif-card__hint">
            ⚠️ Не указан <code>SMSRU_API_ID</code> в <code>.env</code>.
            Зарегистрируйтесь на sms.ru → получите API-ключ → добавьте в .env → <code>SMS_ENABLED=true</code>.
            Пока что SMS будут писаться в консоль сервера.
          </div>
        ` : ''}
      </div>

      <div class="notif-card__actions">
        <button class="notif-card__btn notif-card__btn--test" id="test-sms-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2 11 13"/>
            <path d="m22 2-7 20-4-9-9-4Z"/>
          </svg>
          Отправить тест
        </button>
      </div>
    </div>

    <!-- TELEGRAM -->
    <div class="notif-card ${s.telegram.enabled && s.telegram.configured ? 'is-active' : ''}">
      <div class="notif-card__header">
        <div class="notif-card__icon">💬</div>
        <div class="notif-card__title-wrap">
          <h3 class="notif-card__title">Telegram-бот</h3>
          <span class="notif-card__status">
            ${notifStatusBadge(s.telegram)}
          </span>
        </div>
      </div>

      <div class="notif-card__body">
        <p class="notif-card__desc">
          Мгновенные уведомления админу о новых заказах в Telegram.
        </p>

        ${!s.telegram.configured ? `
          <div class="notif-card__hint">
            <strong>Как настроить:</strong><br>
            1. Откройте <a href="https://t.me/BotFather" target="_blank">@BotFather</a> в Telegram<br>
            2. Отправьте <code>/newbot</code> → получите токен<br>
            3. Вставьте в <code>.env</code>: <code>TELEGRAM_BOT_TOKEN=...</code><br>
            4. Откройте своего бота, отправьте <code>/start</code><br>
            5. Узнайте свой chat_id через <a href="https://t.me/userinfobot" target="_blank">@userinfobot</a><br>
            6. Вставьте в <code>.env</code>: <code>TELEGRAM_ADMIN_CHAT_ID=...</code><br>
            7. Поставьте <code>TELEGRAM_ENABLED=true</code>
          </div>
        ` : ''}
      </div>

      <div class="notif-card__actions">
        <button class="notif-card__btn notif-card__btn--test" id="test-telegram-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2 11 13"/>
            <path d="m22 2-7 20-4-9-9-4Z"/>
          </svg>
          Отправить тест
        </button>
      </div>
    </div>
  `;

  // Обработчики
  document.getElementById('test-email-btn')?.addEventListener('click', testEmail);
  document.getElementById('test-sms-btn')?.addEventListener('click', testSMS);
  document.getElementById('test-telegram-btn')?.addEventListener('click', testTelegram);
}

function notifStatusBadge(service) {
  if (service.enabled && service.configured) {
    return '<span class="notif-badge notif-badge--active">✅ Активно</span>';
  }
  if (service.configured) {
    return '<span class="notif-badge notif-badge--warning">⚠️ Готово, но выключено</span>';
  }
  return '<span class="notif-badge notif-badge--inactive">⏸ Не настроено</span>';
}

// ============================================================
// 4. Тесты
// ============================================================
async function testEmail() {
  const email = document.getElementById('test-email-input').value.trim();
  if (!email) {
    showAdminToast('Укажите email', 'error');
    return;
  }

  const btn = document.getElementById('test-email-btn');
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  try {
    const res = await fetch('/api/admin/notifications/test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');

    if (data.stub) {
      showAdminToast('Режим заглушки — проверьте консоль сервера', 'warning');
    } else {
      showAdminToast(`Email отправлен на ${email}`);
    }
  } catch (err) {
    showAdminToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 2 11 13"/>
        <path d="m22 2-7 20-4-9-9-4Z"/>
      </svg>
      Отправить тест
    `;
  }
}

async function testSMS() {
  const phone = document.getElementById('test-phone-input').value.trim();
  if (!phone) {
    showAdminToast('Укажите номер телефона', 'error');
    return;
  }

  const btn = document.getElementById('test-sms-btn');
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  try {
    const res = await fetch('/api/admin/notifications/test-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');

    if (data.stub) {
      showAdminToast('Режим заглушки — проверьте консоль сервера', 'warning');
    } else {
      showAdminToast(`SMS отправлено на ${phone}`);
    }
  } catch (err) {
    showAdminToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 2 11 13"/>
        <path d="m22 2-7 20-4-9-9-4Z"/>
      </svg>
      Отправить тест
    `;
  }
}

async function testTelegram() {
  const btn = document.getElementById('test-telegram-btn');
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  try {
    const res = await fetch('/api/admin/notifications/test-telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка');

    if (data.stub) {
      showAdminToast('Режим заглушки — проверьте консоль сервера', 'warning');
    } else {
      showAdminToast('Сообщение отправлено в Telegram');
    }
  } catch (err) {
    showAdminToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 2 11 13"/>
        <path d="m22 2-7 20-4-9-9-4Z"/>
      </svg>
      Отправить тест
    `;
  }
}