/* ============================================================
   КАРТА МАГАЗИНА (Яндекс.Карты) — главная страница
   ============================================================ */

let shopMap = null;

// ============================================================
// Инициализация — вызывается после ymaps.ready()
// ============================================================
window.initShopMap = async function() {
  const mapEl = document.getElementById('shop-map');
  if (!mapEl) return;

  await waitForSettings();

  const s = window.SITE_SETTINGS || {};
  const shopLat = parseFloat(s.map_latitude) || 55.755864;
  const shopLng = parseFloat(s.map_longitude) || 37.617698;
  const zoom = parseInt(s.map_zoom, 10) || 16;

  // Создаём карту
shopMap = new ymaps.Map('shop-map', {
  center: [shopLat, shopLng],
  zoom: zoom,
  controls: ['zoomControl', 'fullscreenControl'],
  type: 'yandex#dark'      // ← добавили эту строку
});

  // ✅ Метка магазина
  const placemark = new ymaps.Placemark([shopLat, shopLng], {
    balloonContentHeader: escapeHtml(s.site_name || 'Cake.Me'),
    balloonContentBody: `
      <div style="font-family: -apple-system, sans-serif; line-height: 1.5;">
        <div style="color: #6B5D52; font-size: 13px; margin-bottom: 8px;">
          ${escapeHtml(s.address || '')}
        </div>
        <div style="color: #A89888; font-size: 12px;">
          Приходите в гости!
        </div>
      </div>
    `,
    hintContent: escapeHtml(s.site_name || 'Cake.Me')
  }, {
    preset: 'islands#darkGreenIcon',
    iconColor: '#C9A961'
  });

  shopMap.geoObjects.add(placemark);
};

// ============================================================
// Ждём настройки
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