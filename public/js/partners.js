/* ============================================================
   СТРАНИЦА ПАРТНЁРОВ + КАРТА
   ============================================================ */

let partnersMap = null;
let partnerMarkers = {};
let shopMarker = null;
let activePartnerId = null;


// ============================================================
// 1. Загрузка
// ============================================================
async function initPartners() {
  const listEl = document.getElementById('partners-list');
  if (!listEl) return;

  try {
    const partnersRes = await fetch('/api/partners');
    const partners = await partnersRes.json();

    await waitForSettings();

    const countEl = document.getElementById('partners-count');
    if (countEl) countEl.textContent = `${partners.length} заведений`;

    initMap(partners);
    renderPartnersList(partners);
  } catch (err) {
    console.error('Ошибка загрузки партнёров:', err);
    listEl.innerHTML = `<div class="loading">Не удалось загрузить партнёров</div>`;
  }
}

// ============================================================
// 2. Карта
// ============================================================
function initMap(partners) {
  const mapEl = document.getElementById('partners-map');
  if (!mapEl || typeof L === 'undefined') return;

  const s = window.SITE_SETTINGS || {};

  const shopLat = parseFloat(s.map_latitude) || 55.755864;
  const shopLng = parseFloat(s.map_longitude) || 37.617698;
  const zoom = parseInt(s.map_zoom, 10) || 12;

  partnersMap = L.map('partners-map', {
    center: [shopLat, shopLng],
    zoom: zoom,
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true
  });

  // OpenStreetMap (бесплатно, без ключа)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(partnersMap);

  // Маркер магазина
  const shopIcon = L.divIcon({
    className: 'shop-marker',
    html: '<div class="shop-marker__dot"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16]
  });

  shopMarker = L.marker([shopLat, shopLng], { icon: shopIcon })
    .addTo(partnersMap)
    .bindPopup(`
      <div>
        <div class="partner-popup__name">${s.site_name || 'Cake.Me'}</div>
        <div class="partner-popup__address">${s.address || ''}</div>
        <div class="partner-popup__desc">Наш основной адрес. Приходите в гости!</div>
      </div>
    `);

  // Метки партнёров
  partners.forEach(p => {
    if (!p.latitude || !p.longitude) return;

    const icon = L.divIcon({
      className: 'partner-marker',
      html: '<div class="partner-marker__dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -12]
    });

    const marker = L.marker([p.latitude, p.longitude], { icon })
      .addTo(partnersMap)
      .bindPopup(`
        <div>
          <div class="partner-popup__name">${p.name}</div>
          <div class="partner-popup__address">${p.address}${p.city ? ', ' + p.city : ''}</div>
          ${p.description ? `<div class="partner-popup__desc">${p.description}</div>` : ''}
          ${p.hours ? `<div class="partner-popup__address">${p.hours}</div>` : ''}
          ${p.website ? `<a href="${p.website}" target="_blank" rel="noopener" class="partner-popup__link">Перейти на сайт →</a>` : ''}
        </div>
      `);

    partnerMarkers[p.id] = marker;

    marker.on('click', () => {
      highlightPartner(p.id);
    });
  });
}

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
          ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
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

  listEl.querySelectorAll('.partner-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.id, 10);
      focusPartner(id);
    });
  });

  requestAnimationFrame(() => {
    listEl.querySelectorAll('.reveal:not(.is-visible)').forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('is-visible');
      }, i * 80);
    });
  });
}

// ============================================================
// 4. Фокус на партнёре
// ============================================================
function focusPartner(id) {
  const marker = partnerMarkers[id];
  if (!marker || !partnersMap) return;

  const latlng = marker.getLatLng();
  partnersMap.flyTo(latlng, 16, {
    duration: 1.2,
    easeLinearity: 0.3
  });

  setTimeout(() => {
    marker.openPopup();
  }, 800);

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
document.addEventListener('DOMContentLoaded', initPartners);