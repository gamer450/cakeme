/* ============================================================
   АДМИН: FAQ
   ============================================================ */

const faqState = { all: [], editingId: null };

async function renderFAQ(container) {
  container.innerHTML = `
    <div class="faq-header-admin" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <h2 style="font-size:1.05rem;font-weight:700;color:var(--admin-text);">FAQ <small id="faq-count" style="color:var(--admin-text-muted);"></small></h2>
      <button class="btn-add" id="add-faq-btn"><span>+</span> Добавить вопрос</button>
    </div>
    <div id="faq-table-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем вопросы...</span>
      </div>
    </div>
  `;

  document.getElementById('add-faq-btn').addEventListener('click', () => openFAQModal(null));
  await faqLoad();
}

async function faqLoad() {
  try {
    const res = await fetch('/api/admin/faq', {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Ошибка');

    faqState.all = await res.json();
    document.getElementById('faq-count').textContent = `(${faqState.all.length})`;
    faqRenderTable();
  } catch (err) {
    console.error(err);
    document.getElementById('faq-table-wrap').innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">😕</div>
        <div class="orders-empty__title">Не удалось загрузить FAQ</div>
      </div>
    `;
  }
}

function faqRenderTable() {
  const wrap = document.getElementById('faq-table-wrap');
  if (!wrap) return;

  if (faqState.all.length === 0) {
    wrap.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty__icon">❓</div>
        <div class="orders-empty__title">Вопросов пока нет</div>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div style="background:var(--admin-card);border:1px solid var(--admin-border);border-radius:16px;overflow:hidden;">
      <table class="cats-table">
        <thead>
          <tr>
            <th style="width:60px;">№</th>
            <th>Вопрос</th>
            <th>Ответ</th>
            <th style="width:100px;">Статус</th>
            <th style="width:120px;"></th>
          </tr>
        </thead>
        <tbody>
          ${faqState.all.map(f => `
            <tr class="${f.is_active ? '' : 'is-inactive'}">
              <td><strong>${f.sort_order}</strong></td>
              <td><span class="cats-table__name">${f.question}</span></td>
              <td style="color:var(--admin-text-muted);font-size:0.85rem;max-width:300px;">
                ${f.answer.substring(0, 100)}${f.answer.length > 100 ? '...' : ''}
              </td>
              <td>
                <span class="cat-status ${f.is_active ? 'cat-status--active' : 'cat-status--hidden'}">
                  ${f.is_active ? 'Активен' : 'Скрыт'}
                </span>
              </td>
              <td>
                <div class="cats-table__actions">
                  <button class="cats-table__btn" data-edit="${f.id}" title="Изменить">✏️</button>
                  <button class="cats-table__btn" data-toggle="${f.id}" title="${f.is_active ? 'Скрыть' : 'Показать'}">${f.is_active ? '👁️' : '🙈'}</button>
                  <button class="cats-table__btn cats-table__btn--danger" data-delete="${f.id}">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openFAQModal(parseInt(btn.dataset.edit, 10)));
  });
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => faqToggle(parseInt(btn.dataset.toggle, 10)));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => faqDelete(parseInt(btn.dataset.delete, 10)));
  });
}

function openFAQModal(id) {
  faqState.editingId = id;
  const isEdit = id !== null;
  const f = isEdit ? faqState.all.find(x => x.id === id) : null;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__inner" style="max-width: 600px;">
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Изменить вопрос' : 'Новый вопрос'}</div>
        <button class="modal__close" data-close>✕</button>
      </div>
      <div class="modal__body">
        <form class="admin-form" id="faq-form" novalidate>
          <div class="admin-form__error" id="faq-error"></div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="faq-q">Вопрос <span class="req">*</span></label>
            <input type="text" id="faq-q" class="admin-form__input" value="${f ? f.question : ''}" required />
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="faq-a">Ответ <span class="req">*</span></label>
            <textarea id="faq-a" class="admin-form__textarea" style="min-height:120px;" required>${f ? f.answer : ''}</textarea>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="faq-sort">Порядок</label>
            <input type="number" id="faq-sort" class="admin-form__input" value="${f ? f.sort_order : 0}" />
          </div>

          ${isEdit ? `
            <label class="admin-checkbox">
              <input type="checkbox" id="faq-active" ${f.is_active ? 'checked' : ''} />
              Показывать на сайте
            </label>
          ` : ''}

          <div class="admin-form__footer">
            <button type="button" class="btn-admin btn-admin--ghost" data-close>Отмена</button>
            <button type="submit" class="btn-admin btn-admin--primary" id="faq-submit">
              ${isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('is-open'));

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 250);
  };

  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e) => e.target === modal && close());

  document.getElementById('faq-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('faq-error');
    const submitBtn = document.getElementById('faq-submit');

    const payload = {
      question: document.getElementById('faq-q').value.trim(),
      answer: document.getElementById('faq-a').value.trim(),
      sort_order: parseInt(document.getElementById('faq-sort').value, 10) || 0
    };

    const activeCb = document.getElementById('faq-active');
    if (activeCb) payload.is_active = activeCb.checked;

    if (!payload.question || !payload.answer) {
      errorBox.textContent = 'Заполните вопрос и ответ';
      errorBox.classList.add('is-visible');
      return;
    }

    submitBtn.disabled = true;

    try {
      const url = isEdit ? `/api/admin/faq/${faqState.editingId}` : '/api/admin/faq';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      close();
      await faqLoad();
      showAdminToast(isEdit ? 'Обновлено' : 'Создано');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('is-visible');
      submitBtn.disabled = false;
    }
  });
}

async function faqToggle(id) {
  const f = faqState.all.find(x => x.id === id);
  if (!f) return;

  try {
    await fetch(`/api/admin/faq/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`
      },
      body: JSON.stringify({ is_active: !f.is_active })
    });

    await faqLoad();
    showAdminToast(f.is_active ? 'Скрыто' : 'Показано');
  } catch (err) {
    showAdminToast('Ошибка', 'error');
  }
}

async function faqDelete(id) {
  const f = faqState.all.find(x => x.id === id);
  if (!f) return;

  if (!confirm(`Удалить вопрос «${f.question}»?`)) return;

  try {
    await fetch(`/api/admin/faq/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    await faqLoad();
    showAdminToast('Удалено');
  } catch (err) {
    showAdminToast('Ошибка', 'error');
  }
}