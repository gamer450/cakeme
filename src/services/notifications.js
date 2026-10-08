/* ============================================================
   УВЕДОМЛЕНИЯ — Email, SMS, Telegram
   Могут работать в режиме "заглушки" (пишут в консоль),
   если сервис не настроен.
   ============================================================ */

const logger = require('../middleware/logger');

// ============================================================
// ✅ ФИКС: HTML-escape для безопасной вставки в email и Telegram
// ============================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// 1. EMAIL — через nodemailer
// ============================================================
let transporter = null;

function getTransporter() {
  if (transporter !== null) return transporter;

  const enabled = process.env.EMAIL_ENABLED === 'true';
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!enabled || !host || !user || !pass) {
    console.log('📧 EMAIL: сервис отключён или не настроен');
    transporter = false;
    return transporter;
  }

  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: process.env.SMTP_SECURE !== 'false',
      auth: { user, pass }
    });
    console.log('📧 EMAIL: подключение установлено');
  } catch (err) {
    console.error('📧 EMAIL: ошибка подключения:', err.message);
    transporter = false;
  }

  return transporter;
}

// ============================================================
// 2. SMS — через SMS.RU
// ============================================================
async function sendSMS(phone, message) {
  const enabled = process.env.SMS_ENABLED === 'true';
  const apiId = process.env.SMSRU_API_ID;

  if (!enabled || !apiId) {
    console.log(`📱 SMS [ЗАГЛУШКА] → ${phone}: ${message.substring(0, 100)}`);
    return { success: true, stub: true };
  }

  try {
    const cleanPhone = String(phone).replace(/\D/g, '');

    const url = new URL('https://sms.ru/sms/send');
    url.searchParams.append('api_id', apiId);
    url.searchParams.append('to', cleanPhone);
    url.searchParams.append('msg', message);
    url.searchParams.append('json', '1');

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status === 'OK' && data.sms[cleanPhone]?.status === 'OK') {
      logger.logActivity('SMS отправлено', {
        phone: `+${cleanPhone}`,
        textLength: message.length
      });
      return { success: true };
    } else {
      console.error('📱 SMS ошибка:', data);
      return { success: false, error: data.status_text || 'Ошибка отправки' };
    }
  } catch (err) {
    console.error('📱 SMS ошибка:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 3. TELEGRAM — через Bot API
// ============================================================
async function sendTelegram(message) {
  const enabled = process.env.TELEGRAM_ENABLED === 'true';
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!enabled || !token || !chatId) {
    console.log(`💬 TG [ЗАГЛУШКА] → ${message.substring(0, 100)}`);
    return { success: true, stub: true };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const data = await res.json();

    if (data.ok) {
      logger.logActivity('Telegram-уведомление отправлено', {});
      return { success: true };
    } else {
      console.error('💬 TG ошибка:', data);
      return { success: false, error: data.description || 'Ошибка Telegram' };
    }
  } catch (err) {
    console.error('💬 TG ошибка:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 4. EMAIL — отправка
// ============================================================
async function sendEmail(to, subject, html) {
  const t = getTransporter();

  if (!t) {
    console.log(`📧 EMAIL [ЗАГЛУШКА] → ${to}: "${subject}"`);
    return { success: true, stub: true };
  }

  try {
    const from = process.env.MAIL_FROM || 'Cake.Me <noreply@cake.ru>';

    const info = await t.sendMail({
      from,
      to,
      subject,
      html
    });

    logger.logActivity('Email отправлен', {
      to,
      subject,
      messageId: info.messageId
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('📧 EMAIL ошибка:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 5. HTML-ШАБЛОНЫ для email
// ============================================================
function emailTemplate(title, content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #0E0A08; margin: 0; padding: 40px 20px; color: #F5EDE4; }
        .container { max-width: 600px; margin: 0 auto; background: #1A1310; border-radius: 16px; overflow: hidden; border: 1px solid rgba(201,169,97,0.2); }
        .header { background: linear-gradient(135deg, #E8A87C 0%, #C87A4D 100%); padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; color: #16100C; }
        .header__icon { font-size: 40px; margin-bottom: 8px; }
        .body { padding: 32px; }
        .body h2 { color: #F5EDE4; font-size: 20px; margin-top: 0; }
        .body p { color: #A89888; line-height: 1.6; }
        .total { background: #241A15; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #C9A961; }
        .total strong { font-size: 24px; color: #E5C57A; }
        .items { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .items th { text-align: left; padding: 10px 0; color: #6B5D52; font-size: 12px; text-transform: uppercase; }
        .items td { padding: 10px 0; border-top: 1px solid rgba(245,237,228,0.1); color: #F5EDE4; }
        .footer { padding: 24px 32px; background: #0E0A08; text-align: center; color: #6B5D52; font-size: 12px; }
        .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #E8A87C 0%, #C87A4D 100%); color: #16100C !important; text-decoration: none; border-radius: 10px; font-weight: bold; margin: 16px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header__icon">🍰</div>
          <h1>Cake.Me</h1>
        </div>
        <div class="body">
          <h2>${title}</h2>
          ${content}
        </div>
        <div class="footer">
          <p>© 2026 Cake.Me — торты и кофе на заказ</p>
          <p>Это автоматическое письмо, не отвечайте на него.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================
// 6. ПУБЛИЧНЫЕ ФУНКЦИИ
// ============================================================

// Новый заказ — письмо клиенту
async function notifyOrderCreated(order, items) {
  const itemsHtml = items.map(i => `
    <tr>
      <td>${escapeHtml(i.product_name)} × ${escapeHtml(i.quantity)}</td>
      <td style="text-align:right;">${escapeHtml((i.price * i.quantity).toLocaleString('ru-RU'))} ₽</td>
    </tr>
  `).join('');

  const content = `
    <p>Спасибо за заказ! Мы уже начали его готовить.</p>
    <p><strong>Номер заказа:</strong> №${escapeHtml(order.id)}</p>

    <table class="items">
      <thead>
        <tr><th>Товар</th><th style="text-align:right;">Сумма</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    ${order.discount_amount > 0 ? `
      <p style="color: #6BBF87;">Скидка по промокоду ${escapeHtml(order.promocode)}: −${escapeHtml(order.discount_amount.toLocaleString('ru-RU'))} ₽</p>
    ` : ''}

    <div class="total">
      <span>Итого к оплате:</span><br>
      <strong>${escapeHtml(order.total.toLocaleString('ru-RU'))} ₽</strong>
    </div>

    ${order.address ? `<p><strong>Адрес доставки:</strong> ${escapeHtml(order.address)}</p>` : ''}
    <p>Менеджер свяжется с вами в течение 15 минут для подтверждения.</p>
  `;

  // 1. Письмо клиенту
  if (order.email) {
    await sendEmail(
      order.email,
      `Заказ №${order.id} принят — Cake.Me`,
      emailTemplate(`Заказ №${order.id} принят!`, content)
    );
  }

  // 2. Письмо админу
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const adminContent = `
      <p><strong>🔔 Новый заказ!</strong></p>
      <p>Клиент: ${escapeHtml(order.customer_name)}</p>
      <p>Телефон: ${escapeHtml(order.phone)}</p>
      ${order.email ? `<p>Email: ${escapeHtml(order.email)}</p>` : ''}
      <p>Сумма: <strong>${escapeHtml(order.total.toLocaleString('ru-RU'))} ₽</strong></p>
      ${order.promocode ? `<p>Промокод: ${escapeHtml(order.promocode)}</p>` : ''}
      <a href="${escapeHtml(process.env.SITE_URL || 'http://localhost:3000')}/admin/" class="btn">Открыть в админке</a>
    `;
    await sendEmail(
      adminEmail,
      `🔔 Новый заказ №${order.id} на ${order.total.toLocaleString('ru-RU')} ₽`,
      emailTemplate('Новый заказ', adminContent)
    );
  }

  // 3. Telegram админу
  const tgMessage = `
🍰 <b>Новый заказ №${escapeHtml(order.id)}</b>

👤 ${escapeHtml(order.customer_name)}
📞 ${escapeHtml(order.phone)}
${order.email ? `📧 ${escapeHtml(order.email)}\n` : ''}💰 <b>${escapeHtml(order.total.toLocaleString('ru-RU'))} ₽</b>

📦 Товары:
${items.map(i => `• ${escapeHtml(i.product_name)} × ${escapeHtml(i.quantity)}`).join('\n')}

${order.address ? `📍 ${escapeHtml(order.address)}\n` : ''}
${order.promocode ? `🎟️ Промокод: ${escapeHtml(order.promocode)}\n` : ''}

<a href="${escapeHtml(process.env.SITE_URL || 'http://localhost:3000')}/admin/">Открыть админку</a>
  `.trim();

  await sendTelegram(tgMessage);
}

// Заказ выполнен — SMS + email клиенту
async function notifyOrderCompleted(order) {
  const message = `Cake.Me: Заказ №${order.id} выполнен! Спасибо за покупку. Оставьте отзыв в личном кабинете — нам важно ваше мнение 🍰`;

  // SMS
  if (order.phone) {
    await sendSMS(order.phone, message);
  }

  // Email
  if (order.email) {
    const content = `
      <p>Ваш заказ №${order.id} выполнен!</p>
      <p>Спасибо, что выбрали Cake.Me 🍰</p>
      <p>Будем рады, если оставите отзыв о заказе — это помогает нам становиться лучше.</p>
      <p style="text-align:center;">
        <a href="${process.env.SITE_URL || 'http://localhost:3000'}/account.html" class="btn">Оставить отзыв</a>
      </p>
    `;
    await sendEmail(
      order.email,
      `Заказ №${order.id} выполнен — Cake.Me`,
      emailTemplate('Заказ выполнен!', content)
    );
  }
}

// Заказ отменён
async function notifyOrderCancelled(order) {
  if (order.phone) {
    await sendSMS(order.phone, `Cake.Me: Заказ №${order.id} отменён. Если это ошибка — свяжитесь с нами.`);
  }
  if (order.email) {
    const content = `<p>Ваш заказ №${order.id} был отменён.</p><p>Если это ошибка — свяжитесь с нами.</p>`;
    await sendEmail(
      order.email,
      `Заказ №${order.id} отменён`,
      emailTemplate('Заказ отменён', content)
    );
  }
}

// Заказ подтверждён
async function notifyOrderConfirmed(order) {
  if (order.phone) {
    await sendSMS(order.phone, `Cake.Me: Заказ №${order.id} подтверждён! Мы уже готовим.`);
  }
}

// Статус изменён — универсальный
async function notifyOrderStatusChange(order, newStatus, previousStatus = null) {
  const statusText = {
    confirmed: 'подтверждён',
    baking: 'готовится',
    delivering: 'в доставке',
    done: 'выполнен',
    cancelled: 'отменён'
  }[newStatus] || newStatus;

  // ✅ ФИКС: не отправляем SMS, если статус возвращается (например, confirmed → new → confirmed)
  const isGoingBack = previousStatus && (
    (newStatus === 'new' && previousStatus !== 'new') ||
    (newStatus === 'confirmed' && previousStatus === 'baking')
  );

  // SMS только для ключевых статусов
  if (newStatus === 'confirmed' && order.phone && !isGoingBack) {
    await sendSMS(order.phone, `Cake.Me: Заказ №${order.id} подтверждён! Мы уже готовим.`);
  }

  if (newStatus === 'delivering' && order.phone && previousStatus !== 'delivering') {
    await sendSMS(order.phone, `Cake.Me: Заказ №${order.id} в доставке! Курьер свяжется с вами.`);
  }

  if (newStatus === 'done' && previousStatus !== 'done') {
    await notifyOrderCompleted(order);
  }

  if (newStatus === 'cancelled' && previousStatus !== 'cancelled') {
    await notifyOrderCancelled(order);
  }
}

module.exports = {
  sendEmail,
  sendSMS,
  sendTelegram,
  notifyOrderCreated,
  notifyOrderCompleted,
  notifyOrderCancelled,
  notifyOrderConfirmed,
  notifyOrderStatusChange
};