/* ============================================================
   ПОДПИСКА НА EMAIL — «-10% за подписку»
   ============================================================ */

function initSubscribeForm() {
  const form = document.getElementById('subscribe-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = form.querySelector('[name="email"]');
    const email = emailInput.value.trim();

    if (!email) {
      showToast('Введите email', 'error');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.already) {
        showToast(`Вы уже подписаны! Промокод: ${data.promocode}`, 'info');
      } else {
        form.innerHTML = `
          <div class="subscribe-success">
            <div class="subscribe-success__icon">✓</div>
            <div class="subscribe-success__text">
              Промокод <strong>${data.promocode}</strong> отправлен на ${email}
            </div>
          </div>
        `;
        showToast('Проверьте почту!', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Подписаться';
    }
  });
}

document.addEventListener('DOMContentLoaded', initSubscribeForm);