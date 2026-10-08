/* ============================================================
   COOKIE-БАННЕР — согласие на использование cookie
   ============================================================ */

(function() {
  'use strict';

  const CONSENT_KEY = 'cookie_consent_v1';

  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  }

  function acceptConsent() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    localStorage.setItem(CONSENT_KEY + '_date', new Date().toISOString());
  }

  function showBanner() {
    if (hasConsent()) return;
    if (document.getElementById('cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.innerHTML = `
      <div class="cookie-banner__inner">
        <div class="cookie-banner__icon">🍪</div>
        <div class="cookie-banner__text">
          <div class="cookie-banner__title">Мы используем cookie</div>
          <div class="cookie-banner__desc">
            Для работы корзины, сохранения настроек и аналитики.
            Продолжая использовать сайт, вы соглашаетесь с
            <a href="/privacy.html" target="_blank">политикой конфиденциальности</a>.
          </div>
        </div>
        <button class="cookie-banner__btn" id="cookie-accept">Принять</button>
      </div>
    `;

    document.body.appendChild(banner);

    requestAnimationFrame(() => {
      banner.classList.add('cookie-banner--visible');
    });

    document.getElementById('cookie-accept').addEventListener('click', () => {
      acceptConsent();
      banner.classList.remove('cookie-banner--visible');
      setTimeout(() => banner.remove(), 400);
    });
  }

  // Показываем через 1 секунду после загрузки
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(showBanner, 1000));
  } else {
    setTimeout(showBanner, 1000);
  }
})();