/* ============================================================
   ЕДИНЫЙ TOAST — для всего проекта
   Использование: showToast('Текст', 'success' | 'error' | 'warning' | 'info')
   ============================================================ */

(function() {
  'use strict';

  // ✅ Глобальный escapeHtml — один раз для всего проекта
  if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = function(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
  }

  // Определяем, куда положить toast — body
  function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        pointer-events: none;
        max-width: 90vw;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  // Показываем toast
  function showToast(message, type = 'success', duration = 2500) {
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast-v2 toast-v2--${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast-v2--visible');
    });

    setTimeout(() => {
      toast.classList.remove('toast-v2--visible');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }


  // Экспортируем глобально
  window.showToast = showToast;
  window.showAdminToast = showToast;
  window.showMediaToast = showToast;
})();