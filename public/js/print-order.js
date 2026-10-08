/* ============================================
   ПЕЧАТЬ ЗАКАЗА (чек + лист курьера)
   ============================================ */


function printOrder(order) {
  // Создаём скрытый iframe или новое окно для печати
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    showAdminToast('Разрешите всплывающие окна для печати', 'error');
    return;
  }

  const statusLabels = {
    new: 'Новый',
    confirmed: 'Подтверждён',
    baking: 'Готовится',
    delivering: 'В доставке',
    done: 'Выполнен',
    cancelled: 'Отменён'
  };

  const paymentText = order.payment === 'card' ? 'Оплата онлайн (уже оплачен)' : 'Оплата при получении';

  const dateFormatted = new Date(order.created_at.replace(' ', 'T')).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const itemsHtml = order.items.map(item => {
    // ✅ Кастомный торт — отдельный блок
    if (item.is_custom === 1) {
      let params = {};
      try {
        params = item.custom_params ? JSON.parse(item.custom_params) : {};
      } catch {}

      return `
        <tr style="background: #fafafa;">
          <td colspan="4" style="padding: 12px 12px 8px; border-bottom: none;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.25rem;">🎂</span>
              <strong style="font-size:14px;">Индивидуальный торт</strong>
            </div>
            <div style="margin-top:8px; padding-left:32px; font-size:12px; color:#555; line-height:1.6;">
              ${params.shape ? `<div>• Форма: <strong>${escapeHtml(params.shape)}</strong></div>` : ''}
              ${params.weight ? `<div>• Вес: <strong>${escapeHtml(params.weight)}</strong></div>` : ''}
              ${params.filling ? `<div>• Начинка: <strong>${escapeHtml(params.filling)}</strong></div>` : ''}
              ${params.decor ? `<div>• Декор: <strong>${escapeHtml(params.decor)}</strong></div>` : ''}
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="text-align:right; font-size:12px; color:#666; border-top:none;">Кол-во: ${item.quantity}</td>
          <td colspan="2" style="text-align:right; font-weight:700; border-top:none;">${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</td>
        </tr>
      `;
    }

    // Обычный товар
    return `
      <tr>
        <td>${escapeHtml(item.product_name)}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">${item.price.toLocaleString('ru-RU')} ₽</td>
        <td style="text-align:right;">${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Заказ №${order.id} — Cake.Me</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
          color: #000;
          background: #fff;
          font-size: 13px;
          line-height: 1.5;
        }

        .header {
          border-bottom: 3px solid #000;
          padding-bottom: 16px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header__logo {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header__logo-icon {
          font-size: 32px;
        }

        .header__meta {
          text-align: right;
          font-size: 12px;
          line-height: 1.6;
        }

        .header__meta-label {
          color: #666;
          font-size: 11px;
        }

        .order-id {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        /* Блоки */
        .row {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }

        .block {
          flex: 1;
          border: 1px solid #ccc;
          border-radius: 6px;
          padding: 14px 16px;
          background: #fafafa;
        }

        .block--full { flex: none; width: 100%; }

        .block__title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #666;
          font-weight: 600;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px dashed #ccc;
        }

        .block__row {
          display: flex;
          margin-bottom: 6px;
        }

        .block__row:last-child { margin-bottom: 0; }

        .block__label {
          color: #666;
          min-width: 110px;
          font-size: 12px;
        }

        .block__value {
          font-weight: 600;
          flex: 1;
          word-break: break-word;
        }

        /* Таблица состава */
        .items {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }

        .items th {
          background: #f0f0f0;
          padding: 10px 12px;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #333;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          font-weight: 700;
        }

        .items td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e5e5;
        }

        .items tr:last-child td {
          border-bottom: 2px solid #000;
        }

        /* Итог */
        .total {
          background: #000;
          color: #fff;
          padding: 16px 20px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .total__label {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .total__value {
          font-size: 24px;
          font-weight: 800;
        }

        /* Подписи для курьера */
        .signatures {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px dashed #000;
        }

        .signatures__title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 20px;
        }

        .signatures__row {
          display: flex;
          gap: 40px;
          margin-bottom: 24px;
        }

        .signature-line {
          flex: 1;
          border-bottom: 1px solid #000;
          padding-bottom: 4px;
          margin-top: 32px;
          font-size: 10px;
          color: #666;
        }

        /* Статус */
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          background: #000;
          color: #fff;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        /* Хинт-бар наверху */
        .hint {
          background: #f0f0f0;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 11px;
          color: #666;
          margin-bottom: 20px;
          text-align: center;
        }

        /* Кнопка печати на экране */
        .print-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 24px;
          background: #000;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          z-index: 100;
        }

        @media print {
          .print-btn { display: none; }
          body { font-size: 12px; }
          .hint { display: none; }
        }
      </style>
    </head>
    <body>

      <button class="print-btn" onclick="window.print()">🖨️ Распечатать</button>

      <div class="hint">Нажмите «Распечатать» или Ctrl+P → сохранить как PDF</div>

      <!-- ШАПКА -->
      <div class="header">
        <div class="header__logo">
          <span class="header__logo-icon">🍰</span>
          <span>Cake.Me</span>
        </div>
        <div class="header__meta">
          <div class="order-id">Заказ №${order.id}</div>
          <div class="header__meta-label">от ${dateFormatted}</div>
        </div>
      </div>

      <!-- СТАТУС + ОПЛАТА -->
      <div class="row">
        <div class="block">
          <div class="block__title">Статус заказа</div>
          <span class="status-badge">${statusLabels[order.status] || order.status}</span>
        </div>
        <div class="block">
          <div class="block__title">Способ оплаты</div>
          <div style="font-weight:600; font-size:13px;">${paymentText}</div>
        </div>
      </div>

      <!-- КЛИЕНТ + ДОСТАВКА -->
      <div class="row">
        <div class="block">
          <div class="block__title">Получатель</div>
          <div class="block__row">
            <span class="block__label">Имя:</span>
            <span class="block__value">${escapeHtml(order.customer_name)}</span>
          </div>
          <div class="block__row">
            <span class="block__label">Телефон:</span>
            <span class="block__value">${escapeHtml(order.phone) || '—'}</span>
          </div>
          ${order.email ? `
            <div class="block__row">
              <span class="block__label">Email:</span>
              <span class="block__value">${escapeHtml(order.email)}</span>
            </div>
          ` : ''}
        </div>

        <div class="block">
          <div class="block__title">Доставка</div>
          <div class="block__row">
            <span class="block__label">Адрес:</span>
            <span class="block__value">${escapeHtml(order.address) || 'Самовывоз'}</span>
          </div>
          ${order.comment ? `
            <div class="block__row">
              <span class="block__label">Комментарий:</span>
              <span class="block__value">${escapeHtml(order.comment)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- СОСТАВ -->
      <table class="items">
        <thead>
          <tr>
            <th>Наименование</th>
            <th style="text-align:center; width: 80px;">Кол-во</th>
            <th style="text-align:right; width: 110px;">Цена</th>
            <th style="text-align:right; width: 130px;">Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      ${order.extras ? (() => {
        try {
          const extras = JSON.parse(order.extras);
          if (!extras.length) return '';
          return `
            <div style="margin: 20px 0; padding: 14px 16px; background: #f0f0f0; border-radius: 6px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 600; margin-bottom: 10px;">
                🎁 Дополнительные услуги
              </div>
              ${extras.map(e => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
                  <span>${escapeHtml(e.name)}</span>
                  <span style="font-weight: 600;">+${(e.price * (e.quantity || 1)).toLocaleString('ru-RU')} ₽</span>
                </div>
              `).join('')}
            </div>
          `;
        } catch { return ''; }
      })() : ''}


      <!-- ИТОГО -->
      <div class="total">
        <span class="total__label">Итого к оплате:</span>
        <span class="total__value">${order.total.toLocaleString('ru-RU')} ₽</span>
      </div>

      ${order.cake_inscription ? `
        <div style="margin-top: 24px; padding: 16px; background: #fff9e6; border: 2px dashed #E0B878; border-radius: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #856404; font-weight: 700; margin-bottom: 8px;">
            ✍️ Надпись на торте
          </div>
          <div style="font-family: Georgia, serif; font-size: 18px; font-style: italic; color: #000;">
            "${escapeHtml(order.cake_inscription)}"
          </div>
        </div>
      ` : ''}

      <!-- ✅ НАДПИСЬ НА ТОРТЕ -->
      ${order.cake_inscription ? `
        <div style="margin-top: 24px; padding: 16px; background: #fff9e6; border: 2px dashed #E0B878; border-radius: 8px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #856404; font-weight: 700; margin-bottom: 8px;">
            ✍️ Надпись на торте
          </div>
          <div style="font-family: Georgia, serif; font-size: 18px; font-style: italic; color: #000;">
            "${escapeHtml(order.cake_inscription)}"
          </div>
        </div>
      ` : ''}

      <!-- ✅ ДОП. УСЛУГИ -->
      ${order.extras ? (() => {
        try {
          const extras = JSON.parse(order.extras);
          if (!extras.length) return '';
          return `
            <div style="margin: 20px 0; padding: 14px 16px; background: #f0f0f0; border-radius: 6px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 600; margin-bottom: 10px;">
                🎁 Дополнительные услуги
              </div>
              ${extras.map(e => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
                  <span>${escapeHtml(e.name)}</span>
                  <span style="font-weight: 600;">+${(e.price * (e.quantity || 1)).toLocaleString('ru-RU')} ₽</span>
                </div>
              `).join('')}
            </div>
          `;
        } catch { return ''; }
      })() : ''}


      <!-- ПОДПИСИ ДЛЯ КУРЬЕРА -->
      <div class="signatures">
        <div class="signatures__title">Подписи сторон</div>

        <div class="signatures__row">
          <div class="signature-line">Курьер (ФИО, подпись)</div>
          <div class="signature-line">Получатель (ФИО, подпись)</div>
        </div>

        <div style="font-size: 11px; color: #666; margin-top: 12px;">
          Проверьте состав заказа при получении. Претензии по качеству принимаются в течение 24 часов.
        </div>
      </div>

      <script>
        // Автозапуск печати через 500 мс (после загрузки)
        window.addEventListener('load', () => {
          setTimeout(() => {
            // Закомментируй, если не хочешь автопечать
            // window.print();
          }, 500);
        });
      <\/script>

    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}