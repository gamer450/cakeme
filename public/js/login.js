/* ============================================
   ЛОГИН
   ============================================ */

// ✅ Демо-аккаунты работают ТОЛЬКО на localhost
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const DEMO_ACCOUNTS = IS_LOCAL ? {
  client:  { email: 'client@cake.ru',  password: 'client123'  },
  manager: { email: 'manager@cake.ru', password: 'manager123' },
  admin:   { email: 'admin@cake.ru',   password: 'admin123'   }
} : {};

document.querySelectorAll('.demo-btn[data-demo]').forEach(btn => {
  btn.addEventListener('click', () => {
    const role = btn.dataset.demo;
    const account = DEMO_ACCOUNTS[role];
    if (!account) return;

    // ... остальной код
  });
});
// Показать/скрыть пароль
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

    // ✅ ПРОВЕРКА 2FA
    if (data.requires_2fa) {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
      show2FAModal(data.temp_token);
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');

    window.location.href = redirect || '/account.html';
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

// ============================================
// 2FA-модалка при входе
// ============================================
function show2FAModal(tempToken) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = '2fa-login-modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 420px;">
      <div class="modal__header">
        <div class="modal__title">🔐 Двухфакторная аутентификация</div>
      </div>
      <div class="modal__body">
        <p style="color:var(--text-secondary);margin-bottom:20px;text-align:center;">
          Введите код из приложения<br>
          <small style="color:var(--text-muted);">Google Authenticator, Authy или другого</small>
        </p>

        <div class="security-form__input-wrap" style="margin-bottom:16px;">
          <input type="text" id="login-2fa-code" class="security-form__input"
                 placeholder="000 000" maxlength="9" autocomplete="off" inputmode="numeric"
                 style="font-size:1.75rem;text-align:center;letter-spacing:0.3em;font-family:var(--font-mono);" />
        </div>

        <div class="security-error" id="2fa-login-error"></div>

        <div style="text-align:center;margin:16px 0;">
          <button type="button" class="link-btn" id="use-backup-btn">
            Использовать резервный код
          </button>
        </div>

        <button class="btn btn-primary btn-lg" id="verify-2fa-btn" style="width:100%;">
          Подтвердить
        </button>

        <div style="text-align:center;margin-top:16px;">
          <a href="/login.html" class="link-btn" onclick="location.reload();return false;">
            ← Вернуться ко входу
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('is-open'));

  let useBackup = false;

  const input = document.getElementById('login-2fa-code');
  input.focus();

  input.addEventListener('input', (e) => {
    let v = e.target.value.replace(useBackup ? /[^A-Za-z0-9-]/g : /\D/g, '');

    if (!useBackup) {
      v = v.slice(0, 6);
      if (v.length > 3) v = v.slice(0, 3) + ' ' + v.slice(3);
    } else {
      v = v.slice(0, 9).toUpperCase();
      if (v.length > 4 && !v.includes('-')) v = v.slice(0, 4) + '-' + v.slice(4);
    }
    e.target.value = v;
  });

  document.getElementById('use-backup-btn').addEventListener('click', () => {
    useBackup = !useBackup;
    input.value = '';
    input.placeholder = useBackup ? 'XXXX-XXXX' : '000 000';
    input.style.letterSpacing = useBackup ? '0.1em' : '0.3em';
    input.style.fontSize = useBackup ? '1.35rem' : '1.75rem';
    input.focus();

    document.getElementById('use-backup-btn').textContent = useBackup
      ? 'Вернуться к коду из приложения'
      : 'Использовать резервный код';
  });

  const verify = async () => {
    const code = input.value.replace(/\s/g, '');
    const errorBox = document.getElementById('2fa-login-error');
    errorBox.classList.remove('is-visible');

    if (!code) {
      errorBox.textContent = 'Введите код';
      errorBox.classList.add('is-visible');
      return;
    }

    const btn = document.getElementById('verify-2fa-btn');
    btn.disabled = true;
    btn.textContent = 'Проверяем...';

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temp_token: tempToken,
          code,
          use_backup: useBackup
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.used_backup) {
        showToast('Вход выполнен с резервным кодом');
      }

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');

      window.location.href = redirect || '/account.html';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('is-visible');
      btn.disabled = false;
      btn.textContent = 'Подтвердить';
      input.select();
    }
  };

  document.getElementById('verify-2fa-btn').addEventListener('click', verify);

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verify();
  });
}