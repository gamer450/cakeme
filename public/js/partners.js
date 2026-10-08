/* ============================================================
   ПАРТНЁРЫ + КАРТА (Яндекс.Карты)
   ============================================================ */

let partnersMap = null;
let partnerPlacemarks = {};
let shopPlacemark = null;
let activePartnerId = null;

// ============================================================
// 1. Загрузка партнёров (сразу)
// ============================================================
async function loadPartnersData() {
  const listEl = document.getElementById('partners-list');
  if (!listEl) return;

  try {
    const res = await fetch('/api/partners');
    const partners = await res.json();

    await waitForSettings();

    const countEl = document.getElementById('partners-count');
    if (countEl) countEl.textContent = `${partners.length} заведений`;

    window.__PARTNERS_DATA = partners;
    renderPartnersList(partners);
  } catch (err) {
    console.error('Ошибка загрузки партнёров:', err);
    listEl.innerHTML = `<div class="loading">Не удалось загрузить партнёров</div>`;
  }
}

// ============================================================
// 2. Инициализация карты (после ymaps.ready)
// ============================================================
window.initPartners = function() {
  const mapEl = document.getElementById('partners-map');
  if (!mapEl) return;

  const partners = window.__PARTNERS_DATA || [];
  const s = window.SITE_SETTINGS || {};

  const shopLat = parseFloat(s.map_latitude) || 55.755864;
  const shopLng = parseFloat(s.map_longitude) || 37.617698;

  const withCoords = partners.filter(p => p.latitude && p.longitude);

  // Центр карты
  let centerLat = shopLat;
  let centerLng = shopLng;
  let zoom = 12;

  if (withCoords.length > 0) {
    centerLat = withCoords.reduce((sum, p) => sum + parseFloat(p.latitude), 0) / withCoords.length;
    centerLng = withCoords.reduce((sum, p) => sum + parseFloat(p.longitude), 0) / withCoords.length;
    if (withCoords.length === 1) zoom = 15;
  }

partnersMap = new ymaps.Map('partners-map', {
  center: [centerLat, centerLng],
  zoom: zoom,
  controls: ['zoomControl', 'fullscreenControl'],
  // ✅ Тёмная тема из коробки
  type: 'yandex#dark'
});

  // ✅ Метка магазина (золотая)
  shopPlacemark = new ymaps.Placemark([shopLat, shopLng], {
    balloonContentHeader: escapeHtml(s.site_name || 'Cake.Me'),
    balloonContentBody: `
      <div style="font-family: -apple-system, sans-serif;">
        <div style="color: #6B5D52; font-size: 13px; margin-bottom: 6px;">
          ${escapeHtml(s.address || '')}
        </div>
        <div style="color: #A89888; font-size: 12px;">
          Наш основной адрес.
        </div>
      </div>
    `,
    hintContent: escapeHtml(s.site_name || 'Cake.Me')
  }, {
    preset: 'islands#yellowIcon',
    iconColor: '#C9A961'
  });

  partnersMap.geoObjects.add(shopPlacemark);

  // ✅ Метки партнёров
  partners.forEach(p => {
    if (!p.latitude || !p.longitude) return;

    const placemark = new ymaps.Placemark(
      [parseFloat(p.latitude), parseFloat(p.longitude)],
      {
        balloonContentHeader: escapeHtml(p.name),
        balloonContentBody: `
          <div style="font-family: -apple-system, sans-serif; max-width: 260px;">
            <div style="color: #6B5D52; font-size: 12px; margin-bottom: 8px;">
              ${escapeHtml(p.address)}${p.city ? ', ' + escapeHtml(p.city) : ''}
            </div>
            ${p.description ? `<div style="color: #3D2B2A; font-size: 13px; line-height: 1.5; margin-bottom: 8px;">${escapeHtml(p.description)}</div>` : ''}
            ${p.hours ? `<div style="color: #A89888; font-size: 12px; margin-bottom: 8px;">🕐 ${escapeHtml(p.hours)}</div>` : ''}
            ${p.website ? `<a href="${escapeHtml(p.website)}" target="_blank" rel="noopener" style="color: #C9A961; font-size: 12px; text-decoration: none;">Перейти на сайт →</a>` : ''}
          </div>
        `,
        hintContent: escapeHtml(p.name)
      },
      {
        preset: 'islands#blueIcon',
        iconColor: '#E8A87C'
      }
    );

    partnerPlacemarks[p.id] = placemark;

    placemark.events.add('click', () => {
      highlightPartner(p.id);
    });

    partnersMap.geoObjects.add(placemark);
  });

  // ✅ Авто-зум на партнёров
  if (withCoords.length > 1) {
    const lats = withCoords.map(p => parseFloat(p.latitude));
    const lngs = withCoords.map(p => parseFloat(p.longitude));
    partnersMap.setBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { checkZoomRange: true, zoomMargin: 50 }
    );
  }

  // ✅ Клик по карточке → фокус на маркер
  document.querySelectorAll('.partner-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.id, 10);
      focusPartner(id);
    });
  });
};

// ============================================================
// 3. Список партнёров
// ============================================================
function renderPartnersList(partners) {
  const listEl = document.getElementById('partners-list');
  if (!listEl) return;

  if (partners.length === 0) {
    listEl.innerHTML = `<div class="loading">Партнёров пока нет</div>`;
    return;
  }

  listEl.innerHTML = partners.map(p => `
    <div class="partner-item reveal" data-id="${p.id}">
      <div class="partner-item__image">
        ${p.image
          ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" />`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/></svg>`
        }
      </div>
      <div class="partner-item__body">
        <div class="partner-item__name">${escapeHtml(p.name)}</div>
        <div class="partner-item__address">${escapeHtml(p.address)}${p.city ? ', ' + escapeHtml(p.city) : ''}</div>
        ${p.hours ? `
          <div class="partner-item__hours">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 3"/>
            </svg>
            ${escapeHtml(p.hours)}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  requestAnimationFrame(() => {
    listEl.querySelectorAll('.reveal:not(.is-visible)').forEach((el, i) => {
      setTimeout(() => el.classList.add('is-visible'), i * 80);
    });
  });
}

// ============================================================
// 4. Фокус на партнёре
// ============================================================
function focusPartner(id) {
  if (!partnersMap || !partnerPlacemarks[id]) return;

  const placemark = partnerPlacemarks[id];
  const coords = placemark.geometry.getCoordinates();

  partnersMap.setCenter(coords, 16, { duration: 600 });
  placemark.balloon.open();

  highlightPartner(id);
}

function highlightPartner(id) {
  document.querySelectorAll('.partner-item').forEach(el => {
    el.classList.toggle('is-active', parseInt(el.dataset.id, 10) === id);
  });
  activePartnerId = id;
}

// ============================================================
// 5. Ждём настройки
// ============================================================
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

// ============================================================
// 6. СТАРТ
// ============================================================
document.addEventListener('DOMContentLoaded', loadPartnersData);