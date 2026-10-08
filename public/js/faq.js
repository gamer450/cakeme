/* ============================================================
   FAQ — раскрывающийся список вопросов
   ============================================================ */

async function initFAQ() {
  const section = document.getElementById('faq-section');
  if (!section) return;

  try {
    const res = await fetch('/api/faq');
    if (!res.ok) return;

    const faq = await res.json();

    if (faq.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.innerHTML = `
      <div class="container">
        <div class="section__header section__header--center reveal">
          <span class="eyebrow eyebrow--center">частые вопросы</span>
          <h2 class="section__title">Что вас <em>интересует?</em></h2>
          <p class="section__desc">Собрали самые популярные вопросы наших клиентов</p>
        </div>

        <div class="faq-list reveal">
          ${faq.map(item => `
            <details class="faq-item">
              <summary class="faq-item__question">
                <span>${escapeHtml(item.question)}</span>
                <svg class="faq-item__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </summary>
              <div class="faq-item__answer">
                ${escapeHtml(item.answer).replace(/\n/g, '<br>')}
              </div>
            </details>
          `).join('')}
        </div>

        <div class="faq-footer reveal">
          <p class="faq-footer__text">Не нашли ответ на свой вопрос?</p>
          <a href="/#contacts" class="btn btn-secondary magnetic">
            Свяжитесь с нами
          </a>
        </div>
      </div>
    `;

    // Reveal-анимация
    // ✅ ФИКС: сразу показываем
    requestAnimationFrame(() => {
      section.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    });
  } catch (err) {
    console.error('FAQ ошибка:', err);
  }
}


document.addEventListener('DOMContentLoaded', initFAQ);