/* ============================================================
   SERVICE WORKER — PWA
   Кэширует основные файлы, работает офлайн
   ============================================================ */

const CACHE_NAME = 'cakeme-v2';
const CACHE_URLS = [
  '/',
  '/catalog.html',
  '/cart.html',
  '/constructor.html',
  '/partners.html',
  '/css/design-system.css',
  '/css/header-footer.css',
  '/css/components.css',
  '/css/home.css',
  '/css/catalog.css',
  '/js/main.js',
  '/js/settings.js',
  '/js/product-card.js',
  '/js/cart.js',
  '/js/seo.js',
  '/js/pwa.js'
];

// ============================================================
// Установка — кэшируем основные файлы
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// Активация — удаляем старые кэши
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
// Fetch — стратегия: сеть → кэш
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API — только сеть
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Загрузка файлов — только сеть
  if (url.pathname.startsWith('/uploads/')) {
    return;
  }

  // GET-запросы — сеть с fallback на кэш
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Кэшируем свежий ответ
          if (response.ok && url.origin === location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          // Сеть не работает — берём из кэша
          return caches.match(request).then(cached => {
            if (cached) return cached;
            // Если это HTML — показываем главную из кэша
            if (request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/');
            }
            return new Response('Offline', { status: 503 });
          });
        })
    );
  }
});

// ============================================================
// Push-уведомления (пока не используется, но готово)
// ============================================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Cake.Me';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});