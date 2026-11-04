async function renderPayments(container) {
  container.innerHTML = `<div class="admin-loading" style="min-height:200px"><div class="admin-loading__spinner"></div><span>Загружаем платежи...</span></div>`;

  try {
    const res = await fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) throw new Error('Ошибка загрузки');
    const all = await res.json();
    const pending = all.filter(o => o.payment_receipt && o.payment_confirmed_by_admin === 0);

    if (pending.length === 0) {
      container.innerHTML = `<div class="orders-empty"><div class="orders-empty__title">Нет чеков на проверку 🎉</div></div>`;
      return;
    }

    container.innerHTML = `
      <h2 style="font-family: var(--admin-font-display); font-size: 1.5rem; margin-bottom: 24px;">Чеки на проверку (${pending.length})</h2>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${pending.map(o => `
          <div style="background: var(--admin-card); border: 1px solid var(--admin-border); border-radius: var(--admin-radius-lg); padding: 20px; display: flex; gap: 20px; align-items: flex-start;">
            <div style="flex-shrink: 0;"><a href="${o.payment_receipt}" target="_blank"><img src="${o.payment_receipt}" style="width: 120px; height: 120px; object-fit: cover; border-radius: var(--admin-radius-md); border: 1px solid var(--admin-border);" /></a></div>
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><strong>Заказ №${o.id} от ${o.customer_name}</strong><span style="font-family: var(--admin-font-mono); font-size: 1.1rem; color: var(--admin-gold-bright);">${o.total.toLocaleString('ru-RU')} ₽</span></div>
              <div style="font-size: 0.85rem; color: var(--admin-text-muted); margin-bottom: 16px;">📞 ${o.phone} | ${o.email || '—'}</div>
              <div style="display: flex; gap: 12px;">
                <button class="btn-admin btn-admin--primary" style="background: var(--admin-success); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;" onclick="confirmPayment(${o.id})">✅ Подтвердить</button>
                <button class="btn-danger" style="padding: 8px 16px; border-radius: 8px; cursor: pointer;" onclick="rejectPayment(${o.id})">❌ Отклонить</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="orders-empty">Ошибка: ${err.message}</div>`;
  }
}

async function confirmPayment(orderId) {
  if (!confirm('Подтвердить оплату?')) return;
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/confirm-payment`, { method: 'PATCH', headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) throw new Error('Ошибка');
    showAdminToast('Оплата подтверждена');
    navigate('payments');
  } catch (err) { showAdminToast(err.message, 'error'); }
}

async function rejectPayment(orderId) {
  if (!confirm('Отклонить оплату?')) return;
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/reject-payment`, { method: 'PATCH', headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) throw new Error('Ошибка');
    showAdminToast('Оплата отклонена', 'warning');
    navigate('payments');
  } catch (err) { showAdminToast(err.message, 'error'); }
}