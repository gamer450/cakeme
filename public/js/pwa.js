/* ============================================================
   PWA — регистрация service worker + кнопка «Установить»
   ============================================================ */

(function() {
  'use strict';

  // ============================================
  // 1. Регистрация service worker
  // ============================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ PWA: Service Worker зарегистрирован'))
        .catch(err => console.warn('PWA: ошибка SW', err));
    });
  }

  // ============================================
  // 2. Отслеживаем установку
  // ============================================
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA установлено');
    hideInstallBanner();
    deferredPrompt = null;
    localStorage.setItem('pwa_installed', '1');
  });

  // ============================================
  // 3. Баннер «Установить приложение»
  // ============================================
  function showInstallBanner() {
    // Если уже установлено или закрыто — не показываем
    if (localStorage.getItem('pwa_installed')) return;
    if (localStorage.getItem('pwa_banner_closed')) return;
    if (document.getElementById('pwa-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-banner';
    banner.className = 'pwa-banner';
    banner.innerHTML = `
      <div class="pwa-banner__icon">🍰</div>
      <div class="pwa-banner__text">
        <div class="pwa-banner__title">Установить Cake.Me</div>
        <div class="pwa-banner__desc">Быстрый доступ с рабочего стола</div>
      </div>
      <button class="pwa-banner__btn" id="pwa-install">Установить</button>
      <button class="pwa-banner__close" id="pwa-close" aria-label="Закрыть">✕</button>
    `;
    document.body.appendChild(banner);

    requestAnimationFrame(() => banner.classList.add('is-visible'));

    document.getElementById('pwa-install').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('PWA install outcome:', outcome);
      deferredPrompt = null;
      hideInstallBanner();
    });

    document.getElementById('pwa-close').addEventListener('click', () => {
      localStorage.setItem('pwa_banner_closed', '1');
      hideInstallBanner();
    });
  }

  function hideInstallBanner() {
    const banner = document.getElementById('pwa-banner');
    if (!banner) return;
    banner.classList.remove('is-visible');
    setTimeout(() => banner.remove(), 300);
  }
})();