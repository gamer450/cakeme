/* ============================================
   РЕГИСТРАЦИЯ
   ============================================ */

document.getElementById('toggle-password')?.addEventListener('click', () => {
  const input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  errorBox.classList.remove('is-visible');
  document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

  if (!name) return showError('Укажите имя', 'name');
  if (!email) return showError('Укажите email', 'email');
  if (password.length < 6) return showError('Пароль должен быть минимум 6 символов', 'password');

  submitBtn.classList.add('is-loading');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Не удалось зарегистрироваться');

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    window.location.href = '/account.html';
  } catch (err) {
    showError(err.message);
    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;
  }

  function showError(message, fieldId) {
    errorBox.textContent = message;
    errorBox.classList.add('is-visible');
    if (fieldId) {
      const field = document.getElementById(fieldId);
      if (field) {
        field.classList.add('is-invalid');
        field.focus();
      }
    }
    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;
  }
});