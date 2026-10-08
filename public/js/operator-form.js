/* ============================================================
   СВЯЗАТЬСЯ С ОПЕРАТОРОМ
   Плавающая кнопка + модалка с формой
   ============================================================ */

(function() {
  'use strict';

  // ============================================
  // 1. Настройки
  // ============================================
  const CONFIG = {
    buttonText: '💬 Связаться',
    modalTitle: 'Связаться с оператором',
    modalSubtitle: 'Ответим в течение 15 минут в рабочее время',
    thankYou: 'Спасибо! Мы свяжемся с вами в ближайшее время.',
    position: 'bottom-right',  // bottom-right | bottom-left
    hideOnPages: ['/admin/']   // на этих страницах кнопка не показывается
  };

  // ============================================
  // 2. Проверки — где показывать
  // ============================================
  function shouldShow() {
    const path = window.location.pathname;
    return !CONFIG.hideOnPages.some(p => path.startsWith(p));
  }

  if (!shouldShow()) return;

  // ============================================
  // 3. Внедряем кнопку после загрузки DOM
  // ============================================
  function init() {
    // Проверяем, не добавлена ли уже
    if (document.getElementById('operator-btn')) return;

    // ============ Кнопка ============
    const btn = document.createElement('button');
    btn.id = 'operator-btn';
    btn.className = 'operator-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', CONFIG.buttonText);
    btn.innerHTML = `
      <span class="operator-btn__icon">💬</span>
      <span class="operator-btn__text">${CONFIG.buttonText.replace('💬 ', '')}</span>
    `;
    document.body.appendChild(btn);

    btn.addEventListener('click', openModal);

    // ============ Модалка ============
    const modal = document.createElement('div');
    modal.id = 'operator-modal';
    modal.className = 'operator-modal';
    modal.innerHTML = `
      <div class="operator-modal__backdrop" data-close></div>
      <div class="operator-modal__inner">
        <div class="operator-modal__header">
          <div class="operator-modal__title-wrap">
            <div class="operator-modal__title">${CONFIG.modalTitle}</div>
            <div class="operator-modal__subtitle">${CONFIG.modalSubtitle}</div>
          </div>
          <button type="button" class="operator-modal__close" data-close aria-label="Закрыть">✕</button>
        </div>

        <form class="operator-form" id="operator-form" novalidate>
          <!-- Honeypot для ботов -->
          <input type="text"
                 name="website_hp"
                 tabindex="-1"
                 autocomplete="off"
                 style="position:absolute;left:-9999px;opacity:0;pointer-events:none;"
                 aria-hidden="true" />

          <div class="operator-form__field">
            <label class="operator-form__label" for="op-name">
              Имя <span class="req">*</span>
            </label>
            <input type="text"
                   id="op-name"
                   name="name"
                   class="operator-form__input"
                   placeholder="Как к вам обращаться?"
                   autocomplete="name"
                   required />
          </div>

          <div class="operator-form__field">
            <label class="operator-form__label" for="op-phone">
              Телефон <span class="req">*</span>
            </label>
            <input type="tel"
                   id="op-phone"
                   name="phone"
                   class="operator-form__input"
                   placeholder="+7 900 000-00-00"
                   autocomplete="tel"
                   required />
          </div>

          <div class="operator-form__field">
            <label class="operator-form__label" for="op-email">Email</label>
            <input type="email"
                   id="op-email"
                   name="email"
                   class="operator-form__input"
                   placeholder="you@example.com"
                   autocomplete="email" />
          </div>

          <div class="operator-form__field">
            <label class="operator-form__label" for="op-message">Сообщение</label>
            <textarea id="op-message"
                      name="message"
                      class="operator-form__textarea"
                      placeholder="Опишите вопрос — например, хотите уточнить состав торта или обсудить индивидуальный заказ"></textarea>
          </div>

          <div class="operator-form__error" id="op-error"></div>

          <div class="operator-form__footer">
            <button type="button" class="operator-form__btn-cancel" data-close>
              Отмена
            </button>
            <button type="submit" class="operator-form__btn-submit" id="op-submit">
              <span>Отправить заявку</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          <div class="operator-form__privacy">
            Нажимая «Отправить», вы соглашаетесь с
            <a href="/privacy.html" target="_blank">политикой конфиденциальности</a>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    // ============ Обработчики ============
    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });

    // ============ Отправка формы ============
    const form = document.getElementById('operator-form');
    const submitBtn = document.getElementById('op-submit');
    const errorBox = document.getElementById('op-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      errorBox.classList.remove('is-visible');
      form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

      const name = form.querySelector('[name="name"]').value.trim();
      const phone = form.querySelector('[name="phone"]').value.trim();
      const email = form.querySelector('[name="email"]').value.trim();
      const message = form.querySelector('[name="message"]').value.trim();
      const honeypot = form.querySelector('[name="website_hp"]').value;

      // Валидация
      if (!name || name.length < 2) {
        return showError('Укажите имя (мин. 2 символа)', 'name');
      }
      if (!phone || phone.replace(/\D/g, '').length < 10) {
        return showError('Укажите корректный телефон', 'phone');
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return showError('Некорректный email', 'email');
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');

      try {
        const res = await fetch('/api/operator-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone,
            email,
            message,
            website_hp: honeypot,
            page_url: window.location.href
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Не удалось отправить заявку');

        // ============ Показываем благодарность ============
        showThankYou();
      } catch (err) {
        showError(err.message);
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    });

    function showError(text, fieldName) {
      errorBox.textContent = text;
      errorBox.classList.add('is-visible');

      if (fieldName) {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field) {
          field.classList.add('is-invalid');
          field.focus();
        }
      }
    }

    function showThankYou() {
      modal.querySelector('.operator-modal__inner').innerHTML = `
        <div class="operator-success">
          <div class="operator-success__icon">✓</div>
          <div class="operator-success__title">Заявка отправлена!</div>
          <div class="operator-success__text">${CONFIG.thankYou}</div>
          <button type="button" class="operator-success__btn" data-close>
            Хорошо
          </button>
        </div>
      `;

      modal.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', closeModal);
      });
    }

    // ============ Открытие/закрытие ============
    function openModal() {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      // Автофокус на первое поле
      setTimeout(() => {
        const nameField = modal.querySelector('[name="name"]');
        if (nameField) nameField.focus();
      }, 200);
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';

      // Если форма была заменена на благодарность — не сбрасываем
      // (при следующем открытии проверим и перезагрузим страницу, если нужно)
    }

    // Экспортируем для внешних вызовов
    window.openOperatorModal = openModal;

    // ============ Клик по существующим ссылкам «Связаться с оператором» ============
    // Любой <a data-operator-open> или <button data-operator-open> откроет модалку
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-operator-open]');
      if (trigger) {
        e.preventDefault();
        openModal();
      }
    });
  }

  // ============================================
  // 4. Запуск
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();