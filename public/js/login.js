/* ============================================
   ЛОГИН
   ============================================ */

const DEMO_ACCOUNTS = {
  client:  { email: 'client@cake.ru',  password: 'client123'  },
  manager: { email: 'manager@cake.ru', password: 'manager123' },
  admin:   { email: 'admin@cake.ru',   password: 'admin123'   }
};

// Показать/скрыть пароль
document.getElementById('toggle-password')?.addEventListener('click', () => {
  const input = document.getElementById('password');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// Демо-аккаунты
document.querySelectorAll('.demo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const acc = DEMO_ACCOUNTS[btn.dataset.demo];
    if (!acc) return;
    document.getElementById('email').value = acc.email;
    document.getElementById('password').value = acc.password;
    showToast(`Вставлены данные ${btn.dataset.demo}`);
  });
});

// Отправка
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorBox = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  errorBox.classList.remove('is-visible');
  document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

  if (!email || !password) {
    return showError('Заполните email и пароль');
  }

  submitBtn.classList.add('is-loading');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Не удалось войти');
    }

    // Сохраняем токен
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Редирект
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');

    if (data.user.role === 'admin' || data.user.role === 'manager') {
      window.location.href = redirect || '/account.html';
    } else {
      window.location.href = redirect || '/account.html';
    }
  } catch (err) {
    showError(err.message);
    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('is-visible');
    submitBtn.classList.remove('is-loading');
    submitBtn.disabled = false;
  }
});

// Вспомогательный toast
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}