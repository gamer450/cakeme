/* ============================================================
   КАРТА МАГАЗИНА (на главной, в секции «Контакты»)
   ============================================================ */

let shopMap = null;

// ============================================================
// 1. Инициализация
// ============================================================
async function initShopMap() {
  const mapEl = document.getElementById('shop-map');
  if (!mapEl || typeof L === 'undefined') return;

  await waitForSettings();

  const s = window.SITE_SETTINGS || {};
  const shopLat = parseFloat(s.map_latitude) || 55.755864;
  const shopLng = parseFloat(s.map_longitude) || 37.617698;
  const zoom = parseInt(s.map_zoom, 10) || 16;

  // Создаём карту
  shopMap = L.map('shop-map', {
    center: [shopLat, shopLng],
    zoom: zoom,
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true
  });

  // OpenStreetMap
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(shopMap);

  // Маркер магазина
  const shopIcon = L.divIcon({
    className: 'shop-marker',
    html: '<div class="shop-marker__dot"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16]
  });

  L.marker([shopLat, shopLng], { icon: shopIcon })
    .addTo(shopMap)
    .bindPopup(`
      <div>
        <div class="partner-popup__name">${s.site_name || 'Cake.Me'}</div>
        <div class="partner-popup__address">${s.address || ''}</div>
        <div class="partner-popup__desc">Приходите в гости!</div>
      </div>
    `)
    .openPopup();
}

// ============================================================
// 2. Ждём настройки
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
// 3. СТАРТ
// ============================================================
document.addEventListener('DOMContentLoaded', initShopMap);