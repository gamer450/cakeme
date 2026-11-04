/* ============================================
   ОФОРМЛЕНИЕ ЗАКАЗА — Cake.Me
   ============================================ */

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
  customItems: [],
  paymentMethod: 'cash',
  deliverySlots: [],
  extras: [],
  selectedExtras: [],
  deliveryMethod: 'delivery',
  uploadedCakePhoto: null
};

async function init() {
  await waitForSettings();
  updateDeliveryFromSettings();

  try {
    state.cart = JSON.parse(localStorage.getItem('cart') || '[]');
  } catch {
    state.cart = [];
  }

  if (state.cart.length === 0) {
    window.location.href = '/cart.html';
    return;
  }

  await loadDeliverySlots();
  await loadExtras();

  if (!state.deliverySlots || state.deliverySlots.length === 0) {
    state.deliverySlots = [
      { time_from: '10:00', time_to: '12:00' },
      { time_from: '12:00', time_to: '14:00' },
      { time_from: '14:00', time_to: '16:00' },
      { time_from: '16:00', time_to: '18:00' },
      { time_from: '18:00', time_to: '20:00' },
      { time_from: '20:00', time_to: '22:00' }
    ];
  }

  try {
    const res = await fetch('/api/products');
    const products = await res.json();

    state.customItems = [];
    state.items = [];

    state.cart.forEach(item => {
      if (item.customData) {
        state.customItems.push({
          ...item.customData,
          quantity: item.quantity
        });
        return;
      }

      const p = products.find(prod => prod.id === item.productId);
      if (!p) return;

      state.items.push({
        ...p,
        quantity: item.quantity,
        subtotal: p.price * item.quantity
      });
    });

    if (state.items.length === 0 && state.customItems.length === 0) {
      window.location.href = '/cart.html';
      return;
    }

    renderCheckout();
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    const container = document.getElementById('checkout-container');
    if (container) {
      container.innerHTML = `<p class="text-center">Не удалось загрузить данные. Обновите страницу.</p>`;
    }
  }
}

function renderCheckout() {
  const container = document.getElementById('checkout-container');

  const itemsSubtotal = state.items.reduce((s, i) => s + i.subtotal, 0);
  const customSubtotal = state.customItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const subtotal = itemsSubtotal + customSubtotal;
  const baseDelivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
  const delivery = state.deliveryMethod === 'pickup' ? 0 : baseDelivery;

  const appliedPromo = JSON.parse(localStorage.getItem('applied_promo') || 'null');
  const discount = appliedPromo ? appliedPromo.discount : 0;
  const total = subtotal + delivery - discount;
  const totalCount = state.items.reduce((s, i) => s + i.quantity, 0)
    + state.customItems.reduce((s, i) => s + i.quantity, 0);

  const pickupAddress = (window.SITE_SETTINGS && window.SITE_SETTINGS.address)
    || 'г. Москва, ул. Сладкая, 1';
  const pickupHours = (window.SITE_SETTINGS && window.SITE_SETTINGS.working_hours)
    || 'Ежедневно 10:00 – 21:00';

  const paymentMode = window.SITE_SETTINGS?.payment_mode || 'yookassa';
  const isManual = paymentMode === 'manual';

  container.innerHTML = `
    <div class="checkout-layout">
      <form class="checkout-form" id="order-form" novalidate>
        <div class="checkout-form__error" id="form-error"></div>

        <div class="checkout-form__section">
          <h2 class="checkout-form__heading"><span class="checkout-form__heading-num">1</span> Контактные данные</h2>
          <div class="checkout-form__grid">
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label" for="f-name">Имя <span class="req">*</span></label>
              <input type="text" id="f-name" name="customer_name" class="checkout-form__input" placeholder="Иван Иванов" required />
            </div>
            <div class="checkout-form__field">
              <label class="checkout-form__label" for="f-phone">Телефон <span class="req">*</span></label>
              <input type="tel" id="f-phone" name="phone" class="checkout-form__input" placeholder="+7 900 000-00-00" required />
            </div>
            <div class="checkout-form__field">
              <label class="checkout-form__label" for="f-email">Email</label>
              <input type="email" id="f-email" name="email" class="checkout-form__input" placeholder="you@example.com" />
            </div>
          </div>
        </div>

        <div class="checkout-form__section">
          <h2 class="checkout-form__heading"><span class="checkout-form__heading-num">2</span> Получение заказа</h2>
          <div class="checkout-form__grid">
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label">Способ получения <span class="req">*</span></label>
              <div class="delivery-methods">
                <label class="delivery-method is-selected" data-method="delivery">
                  <input type="radio" name="delivery_method" value="delivery" checked />
                  <span class="delivery-method__icon">🚗</span>
                  <span class="delivery-method__text">
                    <span class="delivery-method__title">Доставка курьером</span>
                    <span class="delivery-method__desc">Привезём по указанному адресу</span>
                  </span>
                </label>
                <label class="delivery-method" data-method="pickup">
                  <input type="radio" name="delivery_method" value="pickup" />
                  <span class="delivery-method__icon">🏬</span>
                  <span class="delivery-method__text">
                    <span class="delivery-method__title">Самовывоз</span>
                    <span class="delivery-method__desc">Забрать из кондитерской — бесплатно</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div class="checkout-form__grid" id="delivery-block">
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label" for="f-address">Адрес доставки <span class="req">*</span></label>
              <input type="text" id="f-address" name="address" class="checkout-form__input" placeholder="Город, улица, дом, квартира" required />
            </div>
          </div>

          <div class="checkout-form__grid" id="pickup-block" style="display:none;">
            <div class="checkout-form__field checkout-form__field--full">
              <div class="pickup-address">
                <div class="pickup-address__icon">📍</div>
                <div class="pickup-address__text">
                  <div class="pickup-address__label">Адрес кондитерской</div>
                  <div class="pickup-address__value">${pickupAddress}</div>
                  <div class="pickup-address__hours">${pickupHours}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="checkout-form__grid">
            <div class="checkout-form__field">
              <label class="checkout-form__label" for="f-date"><span id="date-label">Дата доставки</span> <span class="req">*</span></label>
              <input type="date" id="f-date" name="delivery_date" class="checkout-form__input" required />
            </div>
            <div class="checkout-form__field">
              <label class="checkout-form__label" for="f-time"><span id="time-label">Время доставки</span> <span class="req">*</span></label>
              <select id="f-time" name="delivery_time" class="checkout-form__input" required>
                <option value="">Выберите время</option>
                ${state.deliverySlots.map(s => `<option value="${s.time_from}–${s.time_to}">${s.time_from} – ${s.time_to}</option>`).join('')}
              </select>
            </div>
            <div class="checkout-form__field checkout-form__field--full">
              <label class="checkout-form__label" for="f-comment">Комментарий к заказу</label>
              <textarea id="f-comment" name="comment" class="checkout-form__textarea" placeholder="Пожелания по доставке, время звонка и т.д."></textarea>
            </div>
          </div>
        </div>

        <div class="checkout-form__section">
          <label class="checkout-form__agree" style="cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 16px; background: var(--bg-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <input type="checkbox" id="f-inscription" />
            <span><strong>Добавить надпись на торте</strong> <span style="color: var(--gold-100); font-weight: 600;">+150 ₽</span></span>
          </label>
          <div class="checkout-form__field checkout-form__field--full" id="inscription-field" style="display:none; margin-top: 12px;">
            <label class="checkout-form__label" for="f-inscription-text">Текст надписи</label>
            <input type="text" id="f-inscription-text" class="checkout-form__input" placeholder="С днём рождения, Аня!" maxlength="50" />
            <span style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">До 50 символов. Сделаем шоколадом или кремом — на выбор кондитера.</span>
          </div>
        </div>

        <div class="checkout-form__section">
          <label class="checkout-form__agree" style="cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 16px; background: var(--bg-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <input type="checkbox" id="f-photo" />
            <span><strong>🖼️ Фотопечать на торте</strong> <span style="color: var(--gold-100); font-weight: 600;">+${parseInt(window.SITE_SETTINGS?.cake_photo_price, 10) || 300} ₽</span></span>
          </label>
          <div class="checkout-form__field checkout-form__field--full" id="photo-field" style="display:none; margin-top: 12px;">
            <label class="checkout-form__label">Загрузите фото</label>
            <div class="cake-photo-upload" id="cake-photo-upload">
              <input type="file" id="cake-photo-input" accept="image/*" hidden />
              <div class="cake-photo-upload__placeholder" id="cake-photo-placeholder">
                <span style="font-size: 2rem;">📸</span>
                <div class="cake-photo-upload__text">
                  <strong>Нажмите или перетащите фото</strong>
                  <span>JPG, PNG, WEBP — до 10 МБ</span>
                </div>
              </div>
              <div class="cake-photo-upload__preview" id="cake-photo-preview" style="display:none;">
                <img id="cake-photo-img" src="" alt="Фото на торт" />
                <div class="cake-photo-upload__info">
                  <div class="cake-photo-upload__info-row"><span>Файл:</span><strong id="cake-photo-name">—</strong></div>
                  <div class="cake-photo-upload__info-row"><span>Размер:</span><strong id="cake-photo-size">—</strong></div>
                </div>
                <button type="button" class="cake-photo-upload__remove" id="cake-photo-remove">✕ Удалить</button>
              </div>
              <div class="cake-photo-upload__progress" id="cake-photo-progress" style="display:none;">
                <div class="cake-photo-upload__progress-text">Загрузка...</div>
                <div class="cake-photo-upload__progress-bar">
                  <div class="cake-photo-upload__progress-fill" id="cake-photo-progress-fill"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${state.extras.length > 0 ? `
          <div class="checkout-form__section">
            <h2 class="checkout-form__heading"><span class="checkout-form__heading-num">3</span> Дополнительно</h2>
            <div class="checkout-extras">
              ${state.extras.map(extra => `
                <label class="checkout-extra">
                  <input type="checkbox" data-extra-id="${extra.id}" data-extra-price="${extra.price}" data-extra-name="${extra.name}" />
                  <span class="checkout-extra__icon">${extra.icon || '✨'}</span>
                  <span class="checkout-extra__info">
                    <span class="checkout-extra__name">${extra.name}</span>
                    ${extra.description ? `<span class="checkout-extra__desc">${extra.description}</span>` : ''}
                  </span>
                  <span class="checkout-extra__price">+${extra.price} ₽</span>
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="checkout-form__section">
          <h2 class="checkout-form__heading"><span class="checkout-form__heading-num">4</span> Способ оплаты</h2>
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
                <span class="payment-option__title">${isManual ? 'Перевод по реквизитам' : 'Онлайн (карта)'}</span>
                <span class="payment-option__desc">${isManual ? 'Покажем реквизиты после оформления' : 'Переход на защищённую страницу ЮKassa'}</span>
              </span>
            </label>
          </div>
        </div>

        <div class="checkout-form__section">
          <label class="checkout-form__agree"><input type="checkbox" id="f-agree" required /> <span>Я согласен с <a href="/privacy.html" target="_blank">политикой конфиденциальности</a> и обработкой персональных данных <span class="req">*</span></span></label>
          <label class="checkout-form__agree" style="margin-top: 8px;"><input type="checkbox" id="f-subscribe" /> <span>Согласен получать SMS-уведомления о статусе заказа и акциях</span></label>
          <label class="checkout-form__agree" style="margin-top: 8px;"><input type="checkbox" id="f-offer" required /> <span>Ознакомлен с <a href="/offer.html" target="_blank">публичной офертой</a> и <a href="/returns.html" target="_blank">правилами возврата</a> <span class="req">*</span></span></label>
        </div>
      </form>

      <aside class="checkout-summary">
        <h2 class="checkout-summary__title">Ваш заказ</h2>
        <div class="checkout-summary__items">
          ${state.items.map(item => `<div class="checkout-summary__item"><div class="checkout-summary__item-info"><span class="checkout-summary__item-name">${escapeHtml(item.name)}</span><span class="checkout-summary__item-meta">${item.quantity} × ${item.price} ₽</span></div><span class="checkout-summary__item-price">${item.subtotal.toLocaleString('ru-RU')} ₽</span></div>`).join('')}
          ${state.customItems.map(item => `<div class="checkout-summary__item"><div class="checkout-summary__item-info"><span class="checkout-summary__item-name">🎂 ${escapeHtml(item.name)}</span><span class="checkout-summary__item-meta">${escapeHtml(item.description || item.quantity + ' шт')}</span></div><span class="checkout-summary__item-price">${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</span></div>`).join('')}
        </div>
        <div class="checkout-summary__divider"></div>
        <div class="checkout-summary__row checkout-summary__row--muted"><span>Товаров:</span><span>${totalCount} шт</span></div>
        <div class="checkout-summary__row"><span>Сумма:</span><strong>${subtotal.toLocaleString('ru-RU')} ₽</strong></div>
        <div class="checkout-summary__row" id="delivery-summary-row"><span id="delivery-summary-label">Доставка:</span>${delivery === 0 ? '<span class="checkout-summary__free">Бесплатно</span>' : `<strong>${delivery} ₽</strong>`}</div>
        ${appliedPromo ? `<div class="checkout-summary__row checkout-summary__row--discount"><span>Промокод (${appliedPromo.code}):</span><strong class="checkout-summary__discount-value">−${discount.toLocaleString('ru-RU')} ₽</strong></div>` : ''}
        <div class="checkout-summary__total"><span class="checkout-summary__total-label">Итого</span><span class="checkout-summary__total-value">${total.toLocaleString('ru-RU')} ₽</span></div>
        <button type="submit" form="order-form" class="btn btn-primary btn-lg checkout-summary__btn magnetic" id="submit-btn">Оформить заказ</button>
        <a href="/cart.html" class="checkout-summary__back">← Вернуться в корзину</a>
      </aside>
    </div>
  `;

  initPaymentOptions();
  initDateMin();
  prefillFromUser();
  initFormSubmit(total);
  initInscription();
  initCakePhoto();
  initExtras();
  initDeliveryMethod();
}

function initPaymentOptions() {
  const paymentMode = window.SITE_SETTINGS?.payment_mode || 'yookassa';
  const paymentOptions = document.querySelectorAll('.payment-option');

  if (paymentMode === 'manual') {
    const cardOption = document.querySelector('.payment-option[data-payment="card"]');
    if (cardOption) {
      cardOption.querySelector('.payment-option__title').textContent = 'Перевод по реквизитам';
      cardOption.querySelector('.payment-option__desc').textContent = 'Покажем реквизиты после оформления';
    }
  }

  paymentOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      paymentOptions.forEach(o => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      state.paymentMethod = opt.dataset.payment;
    });
  });
}

function initDateMin() {
  const dateInput = document.getElementById('f-date');
  if (!dateInput) return;
  const today = new Date();
  today.setDate(today.getDate() + 1);
  const minDate = today.toISOString().split('T')[0];
  dateInput.min = minDate;
  dateInput.value = minDate;
}

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

function initFormSubmit(total) {
  const form = document.getElementById('order-form');
  const submitBtn = document.getElementById('submit-btn');
  const errorBox = document.getElementById('form-error');

  if (!form || !submitBtn || !errorBox) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('is-visible');

    const name = document.getElementById('f-name').value.trim();
    const phone = document.getElementById('f-phone').value.trim();
    const email = document.getElementById('f-email').value.trim();
    const deliveryMethod = state.deliveryMethod;
    const addressInput = document.getElementById('f-address');
    const address = deliveryMethod === 'pickup' ? '' : (addressInput ? addressInput.value.trim() : '');
    const comment = document.getElementById('f-comment').value.trim();
    const deliveryDate = document.getElementById('f-date').value;
    const deliveryTime = document.getElementById('f-time').value;
    const agree = document.getElementById('f-agree').checked;
    const offerAgree = document.getElementById('f-offer').checked;
    const smsSubscribe = document.getElementById('f-subscribe')?.checked || false;

    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

    if (!name) return showError('Укажите имя', 'f-name');
    if (!phone || phone.replace(/\D/g, '').length < 10) return showError('Укажите корректный телефон', 'f-phone');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Некорректный email', 'f-email');
    if (deliveryMethod === 'delivery' && !address) return showError('Укажите адрес доставки', 'f-address');
    if (!deliveryDate) return showError('Укажите дату', 'f-date');
    if (!deliveryTime) return showError('Выберите время', 'f-time');
    if (!agree) return showError('Подтвердите согласие с политикой конфиденциальности');
    if (!offerAgree) return showError('Ознакомьтесь с офертой и правилами возврата');

    const inscriptionChecked = document.getElementById('f-inscription')?.checked || false;
    const inscriptionText = document.getElementById('f-inscription-text')?.value.trim() || '';
    if (inscriptionChecked && !inscriptionText) return showError('Введите текст надписи или отключите опцию', 'f-inscription-text');
    if (inscriptionText.length > 50) return showError('Надпись не должна быть длиннее 50 символов', 'f-inscription-text');

    const photoChecked = document.getElementById('f-photo')?.checked || false;
    const uploadedPhoto = state.uploadedCakePhoto || null;
    if (photoChecked && !uploadedPhoto) return showError('Загрузите фото для печати или отключите опцию');

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const appliedPromo = JSON.parse(localStorage.getItem('applied_promo') || 'null');
      const itemsSubtotal = state.items.reduce((s, i) => s + i.subtotal, 0);
      const customSubtotal = state.customItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const subtotal = itemsSubtotal + customSubtotal;
      const deliveryPrice = deliveryMethod === 'pickup' ? 0 : (subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE);

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer_name: name, phone, email, address, comment,
          payment: state.paymentMethod,
          promocode: appliedPromo ? appliedPromo.code : null,
          sms_subscribe: smsSubscribe,
          delivery_date: deliveryDate, delivery_time: deliveryTime,
          delivery_method: deliveryMethod, delivery_price: deliveryPrice,
          cake_inscription: inscriptionChecked ? inscriptionText : null,
          inscription_price: inscriptionChecked ? 150 : 0,
          cake_photo: photoChecked ? uploadedPhoto : null,
          cake_photo_price: photoChecked ? (parseInt(window.SITE_SETTINGS?.cake_photo_price, 10) || 300) : 0,
          extras: Array.from(document.querySelectorAll('.checkout-extra input:checked')).map(cb => ({ id: parseInt(cb.dataset.extraId, 10), name: cb.dataset.extraName, price: parseFloat(cb.dataset.extraPrice), quantity: 1 })),
          items: state.items.map(i => ({ productId: i.id, quantity: i.quantity })),
          custom_items: state.customItems.map(c => ({ name: c.name || 'Индивидуальный торт', description: c.description || '', price: c.price, quantity: c.quantity, params: c.params || {} }))
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось оформить заказ');

      localStorage.removeItem('cart');
      localStorage.removeItem('applied_promo');

      const paymentMode = window.SITE_SETTINGS?.payment_mode || 'yookassa';
      if (paymentMode === 'manual' && state.paymentMethod === 'card') {
        showManualPaymentModal(data.orderId, data.total);
        return;
      }

      if (data.payment === 'card' && data.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      window.location.href = `/thanks.html?orderId=${data.orderId}`;

    } catch (err) {
      console.error('Ошибка заказа:', err);
      showError(err.message || 'Что-то пошло не так. Попробуйте ещё раз.');
    }

    function showError(message, fieldId) {
      errorBox.textContent = message;
      errorBox.classList.add('is-visible');
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (fieldId) {
        const field = document.getElementById(fieldId);
        if (field) { field.classList.add('is-invalid'); field.focus(); }
      }
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
      return false;
    }
  });
}

// ============================================
// МОДАЛКА РУЧНОЙ ОПЛАТЫ
// ============================================
function showManualPaymentModal(orderId, totalAmount) {
  const paymentDetails = window.SITE_SETTINGS?.payment_details || 'Реквизиты не заданы';
  const instructions = window.SITE_SETTINGS?.payment_manual_instructions || '';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 520px;">
      <div class="modal__header">
        <div class="modal__title">Заказ №${orderId} оформлен! 🎉</div>
      </div>
      <div class="modal__body" style="text-align:center;">
        <p style="font-size: 1.1rem; margin-bottom: 16px;">Итого к оплате: <strong style="color: var(--gold-100);">${totalAmount.toLocaleString('ru-RU')} ₽</strong></p>
        
        <div style="background: var(--bg-elevated); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-gold); margin-bottom: 20px;">
          <h4 style="font-family: var(--font-display); font-size: 1.1rem; margin-bottom: 12px; color: var(--gold-100);">Реквизиты для перевода</h4>
          <pre style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.9rem; color: var(--text-primary); line-height: 1.6; margin: 0;">${escapeHtml(paymentDetails)}</pre>
        </div>
        
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px;">${escapeHtml(instructions)}</p>

        <label class="btn btn-secondary" style="cursor:pointer; display:inline-flex; align-items:center; gap:8px;">
          📸 Загрузить чек об оплате
          <input type="file" id="modal-receipt-input" accept="image/*" style="display:none;" />
        </label>
        <div id="modal-receipt-status" style="margin-top: 12px; font-size: 0.9rem;"></div>
        
        <div style="margin-top: 24px; display:flex; gap: 12px;">
          <a href="/thanks.html?orderId=${orderId}" class="btn btn-primary" style="flex:1; text-decoration:none; justify-content:center;">Завершить</a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('is-open'));

  const input = modal.querySelector('#modal-receipt-input');
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      showToast('Файл больше 10 МБ', 'error');
      return;
    }
    
    const formData = new FormData();
    formData.append('receipt', file);
    
    const status = modal.querySelector('#modal-receipt-status');
    status.textContent = 'Загрузка...';
    status.style.color = 'var(--text-muted)';
    
    try {
      const res = await fetch('/api/upload/payment-receipt', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      await fetch(`/api/orders/${orderId}/attach-receipt`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_receipt: data.url })
      });
      
      status.textContent = '✅ Чек загружен! Менеджер проверит его.';
      status.style.color = 'var(--success)';
    } catch (err) {
      status.textContent = '❌ Ошибка: ' + err.message;
      status.style.color = 'var(--danger)';
    }
  });
}

function initInscription() {
  const checkbox = document.getElementById('f-inscription');
  const field = document.getElementById('inscription-field');
  const text = document.getElementById('f-inscription-text');
  if (!checkbox || !field || !text) return;
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) { field.style.display = 'flex'; text.focus(); }
    else { field.style.display = 'none'; text.value = ''; }
    recalcCheckoutTotal();
  });
  text.addEventListener('input', recalcCheckoutTotal);
}

function initCakePhoto() {
  const checkbox = document.getElementById('f-photo');
  const field = document.getElementById('photo-field');
  const uploadBox = document.getElementById('cake-photo-upload');
  const fileInput = document.getElementById('cake-photo-input');
  const placeholder = document.getElementById('cake-photo-placeholder');
  const preview = document.getElementById('cake-photo-preview');
  const previewImg = document.getElementById('cake-photo-img');
  const nameEl = document.getElementById('cake-photo-name');
  const sizeEl = document.getElementById('cake-photo-size');
  const removeBtn = document.getElementById('cake-photo-remove');
  const progressBox = document.getElementById('cake-photo-progress');
  const progressFill = document.getElementById('cake-photo-progress-fill');

  if (!checkbox || !field) return;

  checkbox.addEventListener('change', () => {
    field.style.display = checkbox.checked ? 'flex' : 'none';
    recalcCheckoutTotal();
  });

  placeholder?.addEventListener('click', () => fileInput.click());
  uploadBox?.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('is-dragover'); });
  uploadBox?.addEventListener('dragleave', () => uploadBox.classList.remove('is-dragover'));
  uploadBox?.addEventListener('drop', (e) => { e.preventDefault(); uploadBox.classList.remove('is-dragover'); const file = e.dataTransfer.files[0]; if (file) handleFile(file); });
  fileInput?.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) handleFile(file); e.target.value = ''; });
  removeBtn?.addEventListener('click', (e) => { e.stopPropagation(); state.uploadedCakePhoto = null; preview.style.display = 'none'; placeholder.style.display = 'flex'; recalcCheckoutTotal(); });

  async function handleFile(file) {
    if (!file.type.startsWith('image/')) return showToast('Только изображения (JPG, PNG, WEBP)', 'error');
    if (file.size > 10 * 1024 * 1024) return showToast('Файл больше 10 МБ', 'error');

    previewImg.src = URL.createObjectURL(file);
    nameEl.textContent = file.name;
    sizeEl.textContent = formatBytes(file.size);
    progressBox.style.display = 'block';
    progressFill.style.width = '10%';

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 90);
          progressFill.style.width = `${pct + 10}%`;
        }
      });

      const result = await new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Ошибка парсинга ответа')); }
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error || 'Ошибка загрузки')); } catch { reject(new Error('Ошибка загрузки')); }
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Ошибка сети')));
        xhr.open('POST', '/api/upload/cake-photo');
        xhr.send(formData);
      });

      progressFill.style.width = '100%';
      state.uploadedCakePhoto = result.url;
      placeholder.style.display = 'none';
      preview.style.display = 'flex';
      setTimeout(() => { progressBox.style.display = 'none'; progressFill.style.width = '0%'; }, 500);
    } catch (err) {
      showToast(err.message, 'error');
      progressBox.style.display = 'none';
      progressFill.style.width = '0%';
      placeholder.style.display = 'flex';
      preview.style.display = 'none';
      state.uploadedCakePhoto = null;
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
  }
}

function initExtras() {
  document.querySelectorAll('.checkout-extra input').forEach(cb => cb.addEventListener('change', recalcCheckoutTotal));
}

function recalcCheckoutTotal() {
  const itemsSubtotal = state.items.reduce((s, i) => s + i.subtotal, 0);
  const customSubtotal = state.customItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const subtotal = itemsSubtotal + customSubtotal;
  const baseDelivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE;
  const delivery = state.deliveryMethod === 'pickup' ? 0 : baseDelivery;
  const appliedPromo = JSON.parse(localStorage.getItem('applied_promo') || 'null');
  let discount = 0;

  if (appliedPromo) {
    if (appliedPromo.discount_type === 'percent') {
      discount = subtotal * (appliedPromo.discount_value / 100);
      if (appliedPromo.max_discount && discount > appliedPromo.max_discount) discount = appliedPromo.max_discount;
    } else { discount = appliedPromo.discount_value; }
    discount = Math.min(Math.round(discount), subtotal);
  }

  const inscriptionPrice = document.getElementById('f-inscription')?.checked ? 150 : 0;
  const photoChecked = document.getElementById('f-photo')?.checked;
  const photoPrice = photoChecked ? (parseInt(window.SITE_SETTINGS?.cake_photo_price, 10) || 300) : 0;
  const extrasTotal = Array.from(document.querySelectorAll('.checkout-extra input:checked')).reduce((sum, cb) => sum + (parseFloat(cb.dataset.extraPrice) || 0), 0);
  const total = subtotal + delivery - discount + inscriptionPrice + photoPrice + extrasTotal;

  const totalEl = document.querySelector('.checkout-summary__total-value');
  if (totalEl) totalEl.textContent = total.toLocaleString('ru-RU') + ' ₽';

  const deliveryRow = document.getElementById('delivery-summary-row');
  if (deliveryRow) {
    const label = document.getElementById('delivery-summary-label');
    if (label) label.textContent = state.deliveryMethod === 'pickup' ? 'Самовывоз:' : 'Доставка:';
    const valueEl = deliveryRow.querySelector('strong, .checkout-summary__free');
    if (valueEl) {
      if (delivery === 0) valueEl.outerHTML = '<span class="checkout-summary__free">Бесплатно</span>';
      else valueEl.outerHTML = `<strong>${delivery} ₽</strong>`;
    }
  }

  const summaryDivider = document.querySelector('.checkout-summary__divider');
  let inscriptionRow = document.getElementById('inscription-summary-row');
  if (inscriptionPrice > 0 && !inscriptionRow && summaryDivider) {
    inscriptionRow = document.createElement('div');
    inscriptionRow.id = 'inscription-summary-row';
    inscriptionRow.className = 'checkout-summary__row';
    inscriptionRow.innerHTML = `<span>Надпись на торте:</span><strong>150 ₽</strong>`;
    summaryDivider.parentNode.insertBefore(inscriptionRow, summaryDivider);
  } else if (inscriptionPrice === 0 && inscriptionRow) {
    inscriptionRow.remove();
  }
}

async function loadExtras() {
  try {
    const res = await fetch('/api/extras');
    if (!res.ok) throw new Error();
    state.extras = await res.json();
  } catch { state.extras = []; }
}

async function loadDeliverySlots() {
  try {
    const res = await fetch('/api/delivery-slots');
    if (!res.ok) throw new Error('Ошибка загрузки слотов');
    state.deliverySlots = await res.json();
  } catch (err) {
    console.warn('Не удалось загрузить слоты доставки:', err);
    state.deliverySlots = [];
  }
}

function initDeliveryMethod() {
  const methods = document.querySelectorAll('.delivery-method');
  const deliveryBlock = document.getElementById('delivery-block');
  const pickupBlock = document.getElementById('pickup-block');
  const dateLabel = document.getElementById('date-label');
  const timeLabel = document.getElementById('time-label');
  const addressInput = document.getElementById('f-address');
  if (!methods.length) return;

  methods.forEach(method => {
    method.addEventListener('click', () => {
      const type = method.dataset.method;
      state.deliveryMethod = type;
      methods.forEach(m => m.classList.remove('is-selected'));
      method.classList.add('is-selected');
      const radio = method.querySelector('input');
      if (radio) radio.checked = true;

      if (type === 'pickup') {
        if (deliveryBlock) deliveryBlock.style.display = 'none';
        if (pickupBlock) pickupBlock.style.display = 'grid';
        if (dateLabel) dateLabel.textContent = 'Дата самовывоза';
        if (timeLabel) timeLabel.textContent = 'Время самовывоза';
        if (addressInput) { addressInput.required = false; addressInput.value = ''; addressInput.classList.remove('is-invalid'); }
      } else {
        if (deliveryBlock) deliveryBlock.style.display = 'grid';
        if (pickupBlock) pickupBlock.style.display = 'none';
        if (dateLabel) dateLabel.textContent = 'Дата доставки';
        if (timeLabel) timeLabel.textContent = 'Время доставки';
        if (addressInput) addressInput.required = true;
      }
      recalcCheckoutTotal();
    });
  });

  if (state.deliveryMethod === 'pickup') {
    const pickupEl = document.querySelector('.delivery-method[data-method="pickup"]');
    if (pickupEl) pickupEl.click();
  }
}

document.addEventListener('DOMContentLoaded', init);