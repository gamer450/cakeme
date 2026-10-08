/* ============================================================
   АДМИН: ЖИВЫЕ УВЕДОМЛЕНИЯ О НОВЫХ ЗАКАЗАХ
   ============================================================ */

const notifLive = {
  lastCount: 0,
  lastIds: [],
  intervalId: null,
  audioEnabled: true,
  notificationSound: null
};

// ============================================================
// 1. Звук — создаём через Web Audio API (без mp3-файла)
// ============================================================
function notifPlaySound() {
  if (!notifLive.audioEnabled) return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Три ноты: до-ми-соль (мажорный аккорд)
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  } catch (err) {
    console.warn('Не удалось проиграть звук:', err);
  }
}

// ============================================================
// 2. Проверка новых заказов
// ============================================================
async function notifCheck() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const res = await fetch('/api/admin/notifications/count', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;
    const data = await res.json();

    // Находим НОВЫЕ ID, которых не было раньше
    const newIds = data.ids.filter(id => !notifLive.lastIds.includes(id));
    const firstLoad = notifLive.lastIds.length === 0;

    // Обновляем бейдж на пункте меню
    notifUpdateOrdersBadge(data.count);

    // Проигрываем звук при НОВЫХ заказах (не при первом запуске)
    if (!firstLoad && newIds.length > 0) {
      notifPlaySound();

      // Показываем всплывашку
      newIds.slice(0, 3).forEach(id => {
        const order = data.orders.find(o => o.id === id);
        if (order) {
          showNewOrderPopup(order);
        }
      });
    }

    notifLive.lastCount = data.count;
    notifLive.lastIds = data.ids;
  } catch (err) {
    console.warn('Notification check failed:', err);
  }
}

// ============================================================
// 3. Обновляем бейдж на меню «Заказы»
// ============================================================
function notifUpdateOrdersBadge(count) {
  const badge = document.getElementById('orders-badge');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
    badge.classList.add('is-pulsing');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('is-pulsing');
  }

  // Обновляем также бейдж на канбане, если есть
  const kanbanBadge = document.querySelector('[data-tab="kanban"] .admin-menu__item-badge');
  if (kanbanBadge) {
    if (count > 0) {
      kanbanBadge.textContent = count;
      kanbanBadge.classList.remove('hidden');
    } else {
      kanbanBadge.classList.add('hidden');
    }
  }
}

// ============================================================
// 4. Всплывашка в правом верхнем углу
// ============================================================
function showNewOrderPopup(order) {
  // Контейнер
  let container = document.getElementById('new-order-popups');
  if (!container) {
    container = document.createElement('div');
    container.id = 'new-order-popups';
    container.className = 'new-order-popups';
    document.body.appendChild(container);
  }

  const popup = document.createElement('div');
  popup.className = 'new-order-popup';
  popup.innerHTML = `
    <div class="new-order-popup__icon">🔔</div>
    <div class="new-order-popup__body">
      <div class="new-order-popup__title">Новый заказ №${order.id}</div>
      <div class="new-order-popup__text">
        ${order.customer_name} · ${order.total.toLocaleString('ru-RU')} ₽
      </div>
    </div>
    <button class="new-order-popup__close" aria-label="Закрыть">✕</button>
  `;

  container.appendChild(popup);

  requestAnimationFrame(() => popup.classList.add('is-visible'));

  // Авто-скрытие через 8 секунд
  const timeout = setTimeout(() => {
    popup.classList.remove('is-visible');
    setTimeout(() => popup.remove(), 300);
  }, 8000);

  // Клик по попапу — открыть заказ
  popup.addEventListener('click', (e) => {
    if (e.target.closest('.new-order-popup__close')) {
      clearTimeout(timeout);
      popup.classList.remove('is-visible');
      setTimeout(() => popup.remove(), 300);
      return;
    }

    // Переход в заказы
    if (typeof navigate === 'function') {
      navigate('orders');
      setTimeout(() => {
        if (typeof openOrder === 'function') {
          openOrder(order.id);
        }
      }, 300);
    }
    clearTimeout(timeout);
    popup.remove();
  });

  // Закрытие
  popup.querySelector('.new-order-popup__close').addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(timeout);
    popup.classList.remove('is-visible');
    setTimeout(() => popup.remove(), 300);
  });
}

// ============================================================
// 5. Старт
// ============================================================
function initLiveNotifications() {
  // Проверяем сразу
  notifCheck();

  // И потом каждые 15 секунд
  notifLive.intervalId = setInterval(notifCheck, 15000);
}

// Стартуем, только если мы в админке
if (window.location.pathname.startsWith('/admin')) {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initLiveNotifications, 1500);
  });
}