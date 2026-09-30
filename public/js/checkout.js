/* ============================================
   ОФОРМЛЕНИЕ ЗАКАЗА
   ============================================ */

/* ============================================
   ОФОРМЛЕНИЕ ЗАКАЗА
   ============================================ */

// Константы доставки (обновляются из настроек сайта)
let DELIVERY_PRICE = 300;
let FREE_DELIVERY_FROM = 3000;

function updateDeliveryFromSettings() {
  if (window.SITE_SETTINGS && window.SITE_SETTINGS.loaded) {
    DELIVERY_PRICE = parseInt(window.SITE_SETTINGS.delivery_price, 10) || 300;
    FREE_DELIVERY_FROM = parseInt(window.SITE_SETTINGS.free_delivery_from, 10) || 3000;
  }
}

function waitForSettings() {
  return new Promise((resolve) => {
    if (window.SITE_SETTINGS && window.SITE_SETTINGS.loaded) {
      resolve();
      return;
    }
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      if ((window.SITE_SETTINGS && window.SITE_SETTINGS.loaded) || checks > 30) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

const state = {
  cart: [],
  items: [],
  paymentMethod: 'cash'
};

// ============================================
// 1. Загрузка
// ============================================
async function init() {
  await waitForSettings();
  updateDeliveryFromSettings();
  // Читаем корзину
  try {
    state.cart = JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    state.cart = [];
  }

  // Пустая корзина → на страницу корзины
  if (state.cart.length === 0) {
    window.location.href = '/cart.html';
    return;
  }

  // Грузим товары
  try {
    const res = await fetch('/api/products');
    const products = await res.json();

    state.items = state.cart.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (!p) return null;
      return {
        ...p,
        quantity: item.quantity,
        subtotal: p.price * item.quantity
      };
    }).filter(Boolean);

    if (state.items.length === 0) {
      window.location.href = '/cart.html';
      return;
    }

    renderCheckout();
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    document.getElementById('checkout-container').innerHTML = `
      <p class="text-center">Не удалось загрузить данные. Обновите страницу.</p>
    `;
  }
}

// ============================================
// 2. Рендер
// ============================================
function renderCheckout() {
  const container = document.getElementById('checkout-container');

  const subtotal = state.items.reduce((s, i) => s + i.subtotal, 0);
  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
  const total = subtotal + delivery;
  const totalCount = state.items.reduce((s, i) => s + i.quantity, 0);

  container.innerHTML = `
    <div class="checkout-layout">
      <!-- ФОРМА -->
      <form class="checkout-form" id="order-form" novalidate>
        <div class="checkout-form__error" id="form-error"></div>

        <div class="checkout-form__section">
          <h2 class="checkout-form__heading">
            <span class="checkout-form__heading-num">1</span>
            Контактные данные
          </h2>
          <div class="checkout-form__grid">
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label" for="f-name">
                Имя <span class="req">*</span>
              </label>
              <input type="text" id="f-name" name="customer_name" class="checkout-form__input" placeholder="Иван Иванов" required />
            </div>
            <div class="checkout-form__field">
              <label class="checkout-form__label" for="f-phone">
                Телефон <span class="req">*</span>
              </label>
              <input type="tel" id="f-phone" name="phone" class="checkout-form__input" placeholder="+7 900 000-00-00" required />
            </div>
            <div class="checkout-form__field">
              <label class="checkout-form__label" for="f-email">Email</label>
              <input type="email" id="f-email" name="email" class="checkout-form__input" placeholder="you@example.com" />
            </div>
          </div>
        </div>

        <div class="checkout-form__section">
          <h2 class="checkout-form__heading">
            <span class="checkout-form__heading-num">2</span>
            Доставка
          </h2>
          <div class="checkout-form__grid">
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label" for="f-address">Адрес доставки</label>
              <input type="text" id="f-address" name="address" class="checkout-form__input" placeholder="Город, улица, дом, квартира" />
            </div>
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label" for="f-date">Желаемая дата</label>
              <input type="date" id="f-date" name="delivery_date" class="checkout-form__input" />
            </div>
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label" for="f-comment">Комментарий</label>
              <textarea id="f-comment" name="comment" class="checkout-form__textarea" placeholder="Надпись на торте, пожелания по декору, время доставки..."></textarea>
            </div>
          </div>
        </div>

        <div class="checkout-form__section">
          <h2 class="checkout-form__heading">
            <span class="checkout-form__heading-num">3</span>
            Способ оплаты
          </h2>
          <div class="payment-options">
            <label class="payment-option is-selected" data-payment="cash">
              <input type="radio" name="payment" value="cash" checked />
              <span class="payment-option__icon">💵</span>
              <span class="payment-option__text">
                <span class="payment-option__title">При получении</span>
                <span class="payment-option__desc">Наличными или картой курьеру</span>
              </span>
            </label>

            <label class="payment-option" data-payment="card">
              <input type="radio" name="payment" value="card" />
              <span class="payment-option__icon">💳</span>
              <span class="payment-option__text">
                <span class="payment-option__title">Онлайн</span>
                <span class="payment-option__desc">Ссылка на оплату придёт после подтверждения</span>
              </span>
            </label>
          </div>
        </div>

        <div class="checkout-form__section">
          <label class="checkout-form__agree">
            <input type="checkbox" id="f-agree" required />
            <span>
              Я согласен с <a href="#">политикой конфиденциальности</a> и обработкой персональных данных <span class="req">*</span>
            </span>
          </label>
        </div>
      </form>

      <!-- СВОДКА -->
      <aside class="checkout-summary">
        <h2 class="checkout-summary__title">Ваш заказ</h2>

        <div class="checkout-summary__items">
          ${state.items.map(item => `
            <div class="checkout-summary__item">
              <div class="checkout-summary__item-info">
                <span class="checkout-summary__item-name">${item.name}</span>
                <span class="checkout-summary__item-meta">${item.quantity} × ${item.price} ₽</span>
              </div>
              <span class="checkout-summary__item-price">${item.subtotal.toLocaleString('ru-RU')} ₽</span>
            </div>
          `).join('')}
        </div>

        <div class="checkout-summary__divider"></div>

        <div class="checkout-summary__row checkout-summary__row--muted">
          <span>Товаров:</span>
          <span>${totalCount} шт</span>
        </div>
        <div class="checkout-summary__row">
          <span>Сумма:</span>
          <span>${subtotal.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div class="checkout-summary__row">
          <span>Доставка:</span>
          <span>
            ${delivery === 0
              ? '<span class="checkout-summary__free">Бесплатно</span>'
              : `${delivery} ₽`
            }
          </span>
        </div>

        <div class="checkout-summary__total">
          <span class="checkout-summary__total-label">Итого:</span>
          <span class="checkout-summary__total-value">${total.toLocaleString('ru-RU')} ₽</span>
        </div>

        <button type="submit" form="order-form" class="btn btn-primary btn-lg checkout-summary__btn" id="submit-btn">
          Подтвердить заказ
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </button>

        <a href="/cart.html" class="checkout-summary__back">← Вернуться в корзину</a>
      </aside>
    </div>
  `;

  // Обработчики
  initPaymentOptions();
  initDateMin();
  prefillFromUser(); // ← добавили
  initFormSubmit(total);
}

// ============================================
// 3. Выбор способа оплаты
// ============================================
function initPaymentOptions() {
  document.querySelectorAll('.payment-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      state.paymentMethod = opt.dataset.payment;
    });
  });
}

// ============================================
// 4. Минимальная дата — сегодня
// ============================================
function initDateMin() {
  const dateInput = document.getElementById('f-date');
  if (!dateInput) return;
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  dateInput.value = today;
}

// ============================================
// 4.5. Предзаполнение формы из профиля
// ============================================
function prefillFromUser() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;

    const nameInput = document.getElementById('f-name');
    const phoneInput = document.getElementById('f-phone');
    const emailInput = document.getElementById('f-email');

    if (nameInput && !nameInput.value) nameInput.value = user.name || '';
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
    if (emailInput && !emailInput.value) emailInput.value = user.email || '';
  } catch {}
}

// ============================================
// 5. Отправка формы
// ============================================
function initFormSubmit(total) {
  const form = document.getElementById('order-form');
  const submitBtn = document.getElementById('submit-btn');
  const errorBox = document.getElementById('form-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('is-visible');

    // Валидация
    const name = document.getElementById('f-name').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const address = document.getElementById('f-address').value.trim();
    const comment = document.getElementById('f-comment').value.trim();
    const agree = document.getElementById('f-agree').checked;

    // Сброс подсветки
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

    if (!name) {
      return showError('Укажите имя', 'f-name');
    }
    if (!phone || phone.length < 10) {
      return showError('Укажите корректный телефон', 'f-phone');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError('Некорректный email', 'f-email');
    }
    if (!agree) {
      return showError('Подтвердите согласие с политикой конфиденциальности');
    }

    // Отправка
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer_name: name,
          phone,
          email,
          address,
          comment,
          payment: state.paymentMethod,
          items: state.cart.map(i => ({ productId: i.productId, quantity: i.quantity }))
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Не удалось оформить заказ');
      }

      // Успех — чистим корзину и переходим на thanks
      localStorage.removeItem('cart');
      window.location.href = `/thanks.html?orderId=${data.orderId}`;
    } catch (err) {
      console.error(err);
      showError(err.message || 'Что-то пошло не так. Попробуйте ещё раз.');
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  function showError(message, fieldId) {
    errorBox.textContent = message;
    errorBox.classList.add('is-visible');
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (fieldId) {
      const field = document.getElementById(fieldId);
      if (field) {
        field.classList.add('is-invalid');
        field.focus();
      }
    }
    return false;
  }
}

// ============================================
// 6. СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', init);