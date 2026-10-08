/* ============================================
   СЛАЙДЕР БАННЕРОВ НА ГЛАВНОЙ
   Использует banner_1, banner_2, banner_3 из settings
   ============================================ */

const bannersState = {
  banners: [],
  current: 0,
  intervalId: null,
  duration: 6000
};

async function initBanners() {
  const section = document.getElementById('banners-section');
  if (!section) return;

  // Ждём настройки
  await waitForSettings();

  const s = window.SITE_SETTINGS || {};
  const banners = [
    s.banner_1 && { url: s.banner_1, title: '', subtitle: '' },
    s.banner_2 && { url: s.banner_2, title: '', subtitle: '' },
    s.banner_3 && { url: s.banner_3, title: '', subtitle: '' }
  ].filter(Boolean);

  if (banners.length === 0) {
    section.style.display = 'none';
    return;
  }

  // ✅ ФИКС: показываем секцию, когда баннеры есть
  section.style.display = 'block';

  bannersState.banners = banners;
  renderSlider(section);
}
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

function renderSlider(section) {
  const banners = bannersState.banners;

  section.innerHTML = `
    <div class="container">
      <div class="banners-slider" id="banners-slider">
        ${banners.map((b, i) => `
          <div class="banners-slide ${i === 0 ? 'is-active' : ''}" data-index="${i}">
            <img src="${b.url.replace(/"/g, '&quot;')}" alt="Баннер ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" />
          </div>
        `).join('')}

        ${banners.length > 1 ? `
          <button class="banners-nav banners-nav--prev" id="banners-prev" aria-label="Назад">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <button class="banners-nav banners-nav--next" id="banners-next" aria-label="Вперёд">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>

          <div class="banners-dots" id="banners-dots">
            ${banners.map((_, i) => `
              <button class="banners-dot ${i === 0 ? 'is-active' : ''}" data-index="${i}" aria-label="Слайд ${i + 1}"></button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  if (banners.length > 1) {
    initSliderControls();
    startAutoPlay();
  }
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.banners-slide');
  const dots = document.querySelectorAll('.banners-dot');

  if (slides.length === 0) return;

  // Зацикливаем
  if (index < 0) index = slides.length - 1;
  if (index >= slides.length) index = 0;

  slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
  dots.forEach((d, i) => d.classList.toggle('is-active', i === index));

  bannersState.current = index;
}

function nextSlide() {
  goToSlide(bannersState.current + 1);
}

function prevSlide() {
  goToSlide(bannersState.current - 1);
}

function startAutoPlay() {
  stopAutoPlay();
  bannersState.intervalId = setInterval(nextSlide, bannersState.duration);
}

function stopAutoPlay() {
  if (bannersState.intervalId) {
    clearInterval(bannersState.intervalId);
    bannersState.intervalId = null;
  }
}

function initSliderControls() {
  document.getElementById('banners-prev')?.addEventListener('click', () => {
    prevSlide();
    startAutoPlay();
  });

  document.getElementById('banners-next')?.addEventListener('click', () => {
    nextSlide();
    startAutoPlay();
  });

  document.querySelectorAll('.banners-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      goToSlide(parseInt(dot.dataset.index, 10));
      startAutoPlay();
    });
  });

  // Пауза при наведении
  const slider = document.getElementById('banners-slider');
  if (slider) {
    slider.addEventListener('mouseenter', stopAutoPlay);
    slider.addEventListener('mouseleave', startAutoPlay);
  }

  // Свайп
  let startX = 0;
  let isDragging = false;

  slider?.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
    stopAutoPlay();
  }, { passive: true });

  slider?.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextSlide() : prevSlide();
    }
    startAutoPlay();
  });
}

// ============================================
// СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', initBanners);