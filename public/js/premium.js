/* ============================================================
   PREMIUM EFFECTS — Awwwards-уровень (JS)
   Кастомный курсор, reveal, parallax, magnetic, tilt
   ============================================================ */

(function() {
  'use strict';

  const isTouchDevice = window.matchMedia('(hover: none)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // 1. КАСТОМНЫЙ КУРСОР
  // ============================================================
  function initCustomCursor() {
    if (isTouchDevice || prefersReducedMotion) return;

    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    const circle = document.createElement('div');
    circle.className = 'cursor-circle';

    document.body.appendChild(dot);
    document.body.appendChild(circle);
    document.body.classList.add('has-custom-cursor');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let circleX = mouseX;
    let circleY = mouseY;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    });

    // Плавное следование круга
    function animate() {
      circleX += (mouseX - circleX) * 0.15;
      circleY += (mouseY - circleY) * 0.15;
      circle.style.transform = `translate(${circleX}px, ${circleY}px) translate(-50%, -50%)`;
      requestAnimationFrame(animate);
    }
    animate();

    // Ховер на интерактив
    const hoverables = 'a, button, .btn, input, textarea, select, [data-cursor-hover]';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverables)) {
        document.body.classList.add('cursor-hover');
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverables)) {
        document.body.classList.remove('cursor-hover');
      }
    });

    // Клик
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-click'));

    // Скрыть на уходе
    document.addEventListener('mouseleave', () => {
      dot.style.opacity = '0';
      circle.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      dot.style.opacity = '1';
      circle.style.opacity = '1';
    });
  }

  // ============================================================
  // 2. REVEAL ON SCROLL
  // ============================================================
  function initReveal() {
    const elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -80px 0px' }
    );

    elements.forEach((el) => observer.observe(el));
  }

  // ============================================================
  // 3. MAGNETIC (магнитные элементы)
  // ============================================================
  function initMagnetic() {
    if (isTouchDevice || prefersReducedMotion) return;

    document.querySelectorAll('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const strength = 0.25;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  // ============================================================
  // 4. TILT (наклон карточек)
  // ============================================================
  function initTilt() {
    if (isTouchDevice || prefersReducedMotion) return;

    document.querySelectorAll('.tilt').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const tiltX = (y - 0.5) * 12;
        const tiltY = (x - 0.5) * -12;
        el.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  // ============================================================
  // 5. PARALLAX (лёгкий параллакс)
  // ============================================================
  function initParallax() {
    if (prefersReducedMotion) return;

    const elements = document.querySelectorAll('[data-parallax]');
    if (!elements.length) return;

    let ticking = false;

    function updateParallax() {
      const scrollY = window.scrollY;
      elements.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0.3;
        const rect = el.getBoundingClientRect();
        const offset = (rect.top + scrollY) * speed;
        el.style.transform = `translateY(${-offset * 0.05}px)`;
      });
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }

  // ============================================================
  // 6. SMOOTH SCROLL для якорей
  // ============================================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href === '#' || href.length < 2) return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        const headerHeight = 90;
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  // ============================================================
  // 7. MARQUEE дублирование контента
  // ============================================================
  function initMarquee() {
    document.querySelectorAll('.marquee').forEach((el) => {
      const inner = el.querySelector('.marquee__inner');
      if (!inner) return;

      // Дублируем контент для бесконечной прокрутки
      const clone = inner.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      el.appendChild(clone);
    });
  }

  // ============================================================
  // 8. КНОПКИ — микровзаимодействие
  // ============================================================
  function initButtonRipple() {
    document.querySelectorAll('.btn').forEach((btn) => {
      btn.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.style.cssText = `
          position: absolute;
          left: ${x}px;
          top: ${y}px;
          width: 0;
          height: 0;
          background: rgba(255,255,255,0.35);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 3;
        `;
        this.appendChild(ripple);

        requestAnimationFrame(() => {
          ripple.style.transition = 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
          ripple.style.width = `${Math.max(rect.width, rect.height) * 2.5}px`;
          ripple.style.height = `${Math.max(rect.width, rect.height) * 2.5}px`;
          ripple.style.opacity = '0';
        });

        setTimeout(() => ripple.remove(), 750);
      });
    });
  }

  // ============================================================
  // 9. СТАГГЕР ДЛЯ ДЕТЕЙ (data-stagger)
  // ============================================================
  function initStagger() {
    document.querySelectorAll('[data-stagger]').forEach((parent) => {
      const delay = parseFloat(parent.dataset.stagger) || 0.08;
      const children = parent.children;
      Array.from(children).forEach((child, i) => {
        if (child.classList.contains('reveal')) {
          child.style.transitionDelay = `${i * delay}s`;
        }
      });
    });
  }

  // ============================================================
  // 10. СЧЁТЧИКИ (data-count)
  // ============================================================
  function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const duration = 1800;
        const start = performance.now();

        function update(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.floor(target * eased).toLocaleString('ru-RU');
          if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    counters.forEach((el) => observer.observe(el));
  }

  // ============================================================
  // ЗАПУСК
  // ============================================================
  function init() {
    initCustomCursor();
    initReveal();
    initMagnetic();
    initTilt();
    initParallax();
    initSmoothScroll();
    initMarquee();
    initButtonRipple();
    initStagger();
    initCounters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();