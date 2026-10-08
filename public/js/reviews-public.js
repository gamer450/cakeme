/* ============================================================
   ОТЗЫВЫ — публичная часть
   ============================================================ */

const reviewsPublicState = {
  all: [],
  stats: null,
  currentSlide: 0,
  perView: 3
};



// ============================================================
// 1. Инициализация на главной
// ============================================================
async function initReviewsSection() {
  const section = document.getElementById('reviews-section');
  if (!section) return;

  try {
const [reviewsRes, statsRes] = await Promise.all([
  fetch('/api/reviews?featured=true&limit=12'),
  fetch('/api/reviews/stats')
]);

let reviews = await reviewsRes.json();
reviewsPublicState.stats = await statsRes.json();

// ✅ ФИКС: если featured мало (< 6) — добираем все одобренные
if (reviews.length < 6) {
  const allRes = await fetch('/api/reviews?limit=12');
  const all = await allRes.json();

  // Мержим: сначала featured, потом остальные без дубликатов
  const featuredIds = new Set(reviews.map(r => r.id));
  const extra = all.filter(r => !featuredIds.has(r.id));

  reviews = [...reviews, ...extra].slice(0, 12);
}

    if (reviews.length === 0) {
      section.style.display = 'none';
      return;
    }

    reviewsPublicState.all = reviews;
    renderReviewsSection(section);
  } catch (err) {
    console.error('Ошибка загрузки отзывов:', err);
    section.style.display = 'none';
  }
}

// ============================================================
// 2. Рендер секции
// ============================================================
function renderReviewsSection(section) {
  const stats = reviewsPublicState.stats || { total: 0, avgRating: 0 };

  section.innerHTML = `
    <div class="container">
      <div class="reviews-header reveal">
        <div>
          <span class="eyebrow">что говорят клиенты</span>
          <h2 class="section__title mt-5">Отзывы <em>и впечатления</em></h2>
          <p class="section__desc mt-4">
            Мы гордимся тем, что делаем — и наши клиенты это подтверждают.
          </p>
        </div>

        <div class="reviews-header__stats">
          <div class="reviews-stat">
            <div class="reviews-stat__value">${stats.avgRating}</div>
            <div class="reviews-stat__stars">${renderStars(Math.round(stats.avgRating))}</div>
            <div class="reviews-stat__label">Средняя оценка</div>
          </div>
          <div class="reviews-stat">
            <div class="reviews-stat__value">${stats.total}+</div>
            <div class="reviews-stat__label">Отзывов</div>
          </div>
        </div>
      </div>

      <div class="reviews-carousel reveal">
        <div class="reviews-track" id="reviews-track">
          ${reviewsPublicState.all.map(r => renderReviewCard(r)).join('')}
        </div>
      </div>

      <div class="reviews-nav">
        <button class="reviews-nav__btn" id="reviews-prev" aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div class="reviews-nav__dots" id="reviews-dots"></div>
        <button class="reviews-nav__btn" id="reviews-next" aria-label="Вперёд">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  `;

    initCarousel();

    // ✅ ФИКС: сразу показываем — не ждём IntersectionObserver
    requestAnimationFrame(() => {
      section.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    });
  }

// ============================================================
// 3. Карточка отзыва
// ============================================================
function renderReviewCard(r) {
  const initial = r.author_name.charAt(0).toUpperCase();
  const date = new Date(r.created_at.replace(' ', 'T')).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
    <div class="review-card-public">
      <span class="review-card-public__quote">"</span>
      <div class="review-card-public__stars">${renderStars(r.rating)}</div>
      <p class="review-card-public__text">${escapeHtml(r.text)}</p>
          ${r.photos ? renderReviewPhotos(r.photos) : ''}
      <div class="review-card-public__author">
        <div class="review-card-public__avatar">${initial}</div>
        <div class="review-card-public__info">
          <div class="review-card-public__name">${escapeHtml(r.author_name)}</div>
          ${r.product_name
            ? `<div class="review-card-public__product">${escapeHtml(r.product_name)}</div>`
            : `<div class="review-card-public__product">Cake.Me</div>`
          }
        </div>
        <div class="review-card-public__date">${date}</div>
      </div>
    </div>
  `;
}

function renderStars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// ============================================================
// 4. Карусель
// ============================================================
function initCarousel() {
  const track = document.getElementById('reviews-track');
  const dots = document.getElementById('reviews-dots');
  const prevBtn = document.getElementById('reviews-prev');
  const nextBtn = document.getElementById('reviews-next');

  if (!track || !dots) return;

  const cards = track.querySelectorAll('.review-card-public');
  const total = cards.length;

  // Определяем сколько показывать
  const updatePerView = () => {
    if (window.innerWidth < 640) reviewsPublicState.perView = 1;
    else if (window.innerWidth < 1024) reviewsPublicState.perView = 2;
    else reviewsPublicState.perView = 3;
  };

  updatePerView();
  window.addEventListener('resize', () => {
    updatePerView();
    goTo(0);
  });

  const getMaxSlide = () => Math.max(0, total - reviewsPublicState.perView);

  // Точки
  const renderDots = () => {
    const maxSlide = getMaxSlide();
    dots.innerHTML = '';
    for (let i = 0; i <= maxSlide; i++) {
      const dot = document.createElement('button');
      dot.className = 'reviews-nav__dot' + (i === reviewsPublicState.currentSlide ? ' is-active' : '');
      dot.addEventListener('click', () => goTo(i));
      dots.appendChild(dot);
    }
  };

  // Переход
  const goTo = (index) => {
    const maxSlide = getMaxSlide();
    reviewsPublicState.currentSlide = Math.max(0, Math.min(index, maxSlide));

    const cardWidth = cards[0]?.offsetWidth || 0;
    const gap = 24;
    const offset = -(cardWidth + gap) * reviewsPublicState.currentSlide;

    track.style.transform = `translateX(${offset}px)`;

    prevBtn.disabled = reviewsPublicState.currentSlide === 0;
    nextBtn.disabled = reviewsPublicState.currentSlide >= maxSlide;

    // Обновляем точки
    dots.querySelectorAll('.reviews-nav__dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === reviewsPublicState.currentSlide);
    });
  };

  prevBtn.addEventListener('click', () => goTo(reviewsPublicState.currentSlide - 1));
  nextBtn.addEventListener('click', () => goTo(reviewsPublicState.currentSlide + 1));

  // Свайп
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - currentX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goTo(reviewsPublicState.currentSlide + 1);
      else goTo(reviewsPublicState.currentSlide - 1);
    }
  });

  renderDots();
  goTo(0);
}

// ============================================================
// 5. Форма отзыва
// ============================================================
function initReviewForm() {
  const form = document.getElementById('review-form');
  if (!form) return;

  let selectedRating = 0;
  let selectedPhotos = [];

  const stars = form.querySelectorAll('.review-form__star');

  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value, 10);
      stars.forEach(s => {
        s.classList.toggle('is-active', parseInt(s.dataset.value, 10) <= selectedRating);
      });
    });

    star.addEventListener('mouseenter', () => {
      const hoverValue = parseInt(star.dataset.value, 10);
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value, 10) <= hoverValue
          ? 'var(--gold-bright)'
          : 'var(--border-strong)';
      });
    });
  });

  form.querySelector('.review-form__stars')?.addEventListener('mouseleave', () => {
    stars.forEach(s => {
      s.style.color = '';
      s.classList.toggle('is-active', parseInt(s.dataset.value, 10) <= selectedRating);
    });
  });

  // ============================================
  // Фото
  // ============================================
  const photoInput = document.getElementById('review-photos-input');
  const photoAdd = document.getElementById('review-photos-add');
  const photoPreview = document.getElementById('review-photos-preview');

  photoAdd?.addEventListener('click', () => photoInput.click());

  photoInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (selectedPhotos.length + files.length > 3) {
      showMessage('Максимум 3 фото', 'error');
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showMessage(`Файл больше 5 МБ`, 'error');
        continue;
      }
      selectedPhotos.push(file);
    }

    renderPhotosPreview();
    photoInput.value = '';
  });

  function renderPhotosPreview() {
    if (!photoPreview) return;

    photoPreview.innerHTML = selectedPhotos.map((file, idx) => {
      const url = URL.createObjectURL(file);
      return `
        <div class="review-form__photo-item">
          <img src="${url}" alt="Фото ${idx + 1}" />
          <button type="button" class="review-form__photo-remove" data-idx="${idx}" aria-label="Удалить">✕</button>
        </div>
      `;
    }).join('');

    photoPreview.querySelectorAll('.review-form__photo-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        selectedPhotos.splice(idx, 1);
        renderPhotosPreview();
      });
    });

    if (photoAdd) {
      photoAdd.style.display = selectedPhotos.length >= 3 ? 'none' : 'flex';
    }
  }

  // ============================================
  // Отправка
  // ============================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');

    if (selectedRating === 0) {
      showMessage('Поставьте оценку', 'error');
      return;
    }

    const name = form.querySelector('[name="author_name"]').value.trim();
    const text = form.querySelector('[name="text"]').value.trim();
    const email = form.querySelector('[name="author_email"]')?.value.trim() || '';

    if (name.length < 2) {
      showMessage('Укажите имя (минимум 2 символа)', 'error');
      return;
    }

    if (text.length < 10) {
      showMessage('Напишите отзыв (минимум 10 символов)', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get('orderId');

      // ✅ FormData для отправки фото
      const formData = new FormData();
      formData.append('author_name', name);
      formData.append('author_email', email);
      formData.append('rating', selectedRating);
      formData.append('text', text);
      if (orderId) formData.append('order_id', orderId);

      selectedPhotos.forEach(file => {
        formData.append('photos', file);
      });

      const res = await fetch('/api/reviews', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки');

      form.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="width:80px;height:80px;margin:0 auto 24px;border-radius:50%;background:rgba(201,169,97,0.1);border:1px solid var(--border-gold);color:var(--gold-bright);display:flex;align-items:center;justify-content:center;font-size:2rem;">✓</div>
          <h3 style="font-family:var(--font-display);font-size:1.75rem;font-weight:400;color:var(--text-primary);margin-bottom:12px;">Спасибо за отзыв!</h3>
          <p style="color:var(--text-secondary);">Он появится на сайте после проверки модератором.</p>
        </div>
      `;
    } catch (err) {
      showMessage(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить отзыв';
    }
  });

  function showMessage(text, type) {
    const messageEl = form.querySelector('.review-form__message');
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = `review-form__message is-${type}`;
  }
}


// ============================================================
// 6. СТАРТ
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initReviewsSection();
  initReviewForm();
});

// ============================================================
// Рендер фото в отзыве (скрыты до клика)
// ============================================================
function renderReviewPhotos(photosJson) {
  let photos = [];
  try {
    photos = typeof photosJson === 'string' ? JSON.parse(photosJson) : photosJson;
  } catch {
    return '';
  }

  if (!Array.isArray(photos) || photos.length === 0) return '';

  return `
    <div class="review-card-public__photos" data-photos='${JSON.stringify(photos).replace(/'/g, '&apos;')}'>
      <button class="review-photos-toggle" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        Фото (${photos.length})
      </button>
      <div class="review-photos-thumbs" style="display:none;">
        ${photos.map((url, i) => `
          <img src="${url}" alt="Фото ${i + 1}" class="review-photo-thumb" data-idx="${i}" loading="lazy" />
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// Раскрытие фото и галерея
// ============================================================
document.addEventListener('click', (e) => {
  // Кнопка «Фото (N)» — раскрывает миниатюры
  const toggleBtn = e.target.closest('.review-photos-toggle');
  if (toggleBtn) {
    e.preventDefault();
    e.stopPropagation();
    const wrap = toggleBtn.closest('.review-card-public__photos');
    const thumbs = wrap.querySelector('.review-photos-thumbs');
    const isHidden = thumbs.style.display === 'none';
    thumbs.style.display = isHidden ? 'grid' : 'none';
    toggleBtn.classList.toggle('is-open', isHidden);
    return;
  }

  // Клик по миниатюре — открыть большую галерею
  const thumb = e.target.closest('.review-photo-thumb');
  if (thumb) {
    e.preventDefault();
    e.stopPropagation();
    const wrap = thumb.closest('.review-card-public__photos');
    try {
      const photos = JSON.parse(wrap.dataset.photos.replace(/&apos;/g, "'"));
      openPhotoGallery(photos, parseInt(thumb.dataset.idx, 10));
    } catch {}
    return;
  }

  // Клик по модалке галереи — закрыть
  if (e.target.id === 'photo-gallery-modal' || e.target.closest('.photo-gallery-close')) {
    document.getElementById('photo-gallery-modal')?.remove();
    return;
  }

  // Стрелки галереи
  const navBtn = e.target.closest('.photo-gallery-nav');
  if (navBtn) {
    e.preventDefault();
    const modal = document.getElementById('photo-gallery-modal');
    if (!modal) return;
    let currentIdx = parseInt(modal.dataset.currentIdx, 10);
    const total = parseInt(modal.dataset.total, 10);
    const dir = navBtn.dataset.dir;

    currentIdx = dir === 'next' ? (currentIdx + 1) % total : (currentIdx - 1 + total) % total;
    modal.dataset.currentIdx = currentIdx;

    const img = modal.querySelector('.photo-gallery-img');
    const counter = modal.querySelector('.photo-gallery-counter');
    const photos = JSON.parse(modal.dataset.photos.replace(/&apos;/g, "'"));
    img.src = photos[currentIdx];
    counter.textContent = `${currentIdx + 1} / ${total}`;
  }
});

function openPhotoGallery(photos, startIdx) {
  // Удаляем старую
  document.getElementById('photo-gallery-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'photo-gallery-modal';
  modal.className = 'photo-gallery-modal';
  modal.dataset.currentIdx = startIdx;
  modal.dataset.total = photos.length;
  modal.dataset.photos = JSON.stringify(photos).replace(/'/g, '&apos;');

  modal.innerHTML = `
    <button class="photo-gallery-close" aria-label="Закрыть">✕</button>
    ${photos.length > 1 ? `
      <button class="photo-gallery-nav photo-gallery-nav--prev" data-dir="prev" aria-label="Назад">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      <button class="photo-gallery-nav photo-gallery-nav--next" data-dir="next" aria-label="Вперёд">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
    ` : ''}
    <img class="photo-gallery-img" src="${photos[startIdx]}" alt="Фото" />
    ${photos.length > 1 ? `<div class="photo-gallery-counter">${startIdx + 1} / ${photos.length}</div>` : ''}
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('is-open'));

  // Закрытие по Esc
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}