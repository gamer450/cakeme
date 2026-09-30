/* ============================================
   ЗАГРУЗКА НАСТРОЕК САЙТА
   Подключается на всех страницах
   ============================================ */

window.SITE_SETTINGS = {
  loaded: false,
  site_name: 'Сладкий Дом',
  site_description: 'Торты и кофе на заказ с доставкой',
  phone: '+7 900 000-00-00',
  email: 'hello@cake.ru',
  address: 'г. Москва, ул. Сладкая, 1',
  instagram: '',
  telegram: '',
  delivery_price: '300',
  free_delivery_from: '3000'
};

// Загрузка настроек с сервера
async function loadSiteSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Ошибка загрузки настроек');

    const settings = await res.json();
    Object.assign(window.SITE_SETTINGS, settings);
    window.SITE_SETTINGS.loaded = true;

    applySettingsToDOM();
  } catch (err) {
    console.warn('Не удалось загрузить настройки, используем дефолтные:', err);
  }
}

// Подставляет настройки в DOM
function applySettingsToDOM() {
  const s = window.SITE_SETTINGS;

  document.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;
    const value = s[key];

    if (value === undefined) return;

    // Для полей ввода — value
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = value;
      return;
    }

    // Для ссылок — href и текст
    if (el.tagName === 'A') {
      if (el.dataset.type === 'phone') {
        el.href = `tel:${value.replace(/[^\d+]/g, '')}`;
        el.textContent = value;
      } else if (el.dataset.type === 'email') {
        el.href = `mailto:${value}`;
        el.textContent = value;
      } else if (el.dataset.type === 'social') {
        el.href = value || '#';
      } else {
        el.textContent = value;
      }
      return;
    }

    // Обычный текст
    el.textContent = value;
  });

  // Обновляем title страницы
  const title = document.title;
  if (title.includes('Сладкий Дом') && s.site_name !== 'Сладкий Дом') {
    document.title = title.replace('Сладкий Дом', s.site_name);
  }
}

// Автозагрузка
document.addEventListener('DOMContentLoaded', loadSiteSettings);