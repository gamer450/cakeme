/* ============================================================
   АНАЛИТИКА — Яндекс.Метрика + Google Analytics 4
   ============================================================ */

(function() {
  'use strict';

  // ============================================
  // 1. Загрузка ID из бэкенда
  // ============================================
  async function initAnalytics() {
    try {
      const res = await fetch('/api/analytics/config');
      if (!res.ok) return;

      const config = await res.json();

      if (config.ym) loadYandexMetrika(config.ym);
      if (config.ga) loadGoogleAnalytics(config.ga);
    } catch (err) {
      console.warn('Analytics: не удалось загрузить конфиг');
    }
  }

  // ============================================
  // 2. Яндекс.Метрика
  // ============================================
  function loadYandexMetrika(counterId) {
    (function(m, e, t, r, i, k, a) {
      m[i] = m[i] || function() { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) return;
      }
      k = e.createElement(t);
      a = e.getElementsByTagName(t)[0];
      k.async = 1;
      k.src = r;
      a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    window.ym(counterId, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
      ecommerce: 'dataLayer'
    });

    // Уведомляем PWA-оболочку
    console.log('Яндекс.Метрика: счётчик', counterId);
  }

  // ============================================
  // 3. Google Analytics 4
  // ============================================
  function loadGoogleAnalytics(measurementId) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', measurementId, {
      send_page_view: true
    });

    console.log('GA4: ', measurementId);
  }

  // ============================================
  // 4. Отслеживание событий (для обеих систем)
  // ============================================
  function trackEvent(name, params = {}) {
    // ЯМ
    if (window.ym && window.YM_ID) {
      window.ym(window.YM_ID, 'reachGoal', name, params);
    }

    // GA4
    if (window.gtag) {
      window.gtag('event', name, params);
    }

    console.log('Event:', name, params);
  }

  // Экспортируем
  window.trackEvent = trackEvent;

  // ============================================
  // 5. Авто-события
  // ============================================
  window.addEventListener('load', () => {
    setTimeout(() => {
      // Событие: добавил в корзину
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add-to-cart]');
        if (btn) {
          trackEvent('add_to_cart', {
            product_id: btn.dataset.addToCart
          });
        }
      });

      // Событие: клик «Оформить заказ»
      document.addEventListener('click', (e) => {
        if (e.target.closest('a[href="/checkout.html"]')) {
          trackEvent('begin_checkout');
        }
      });
    }, 500);
  });

  // ============================================
  // 6. Старт
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
  } else {
    initAnalytics();
  }
})();