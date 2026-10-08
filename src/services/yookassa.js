/* ============================================================
   ЮKassa — онлайн-оплата
   API: https://yookassa.ru/developers/api
   v2.0 — безопасный вебхук + null-safe items
   ============================================================ */

const logger = require('../middleware/logger');
const crypto = require('crypto');

// ============================================================
// Конфиг
// ============================================================
function isEnabled() {
  return !!(
    process.env.YOOKASSA_SHOP_ID &&
    process.env.YOOKASSA_SECRET_KEY
  );
}

function getAuthHeader() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  const encoded = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  return `Basic ${encoded}`;
}

// ============================================================
// Создать платёж
// ============================================================
async function createPayment({ orderId, amount, description, returnUrl, customerEmail, customerPhone, items }) {
  if (!isEnabled()) {
    const fakeId = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`💳 YOOKASSA [ЗАГЛУШКА] Платёж на ${amount} ₽ для заказа №${orderId}`);

    return {
      success: true,
      stub: true,
      payment_id: fakeId,
      confirmation_url: `${process.env.SITE_URL || 'http://localhost:3000'}/payment-stub.html?orderId=${orderId}&paymentId=${fakeId}`,
      status: 'pending'
    };
  }

  try {
    const hasCustomer = customerEmail || customerPhone;

    const body = {
      amount: {
        value: Number(amount || 0).toFixed(2),
        currency: 'RUB'
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl
      },
      description: String(description || `Заказ №${orderId} — Cake.Me`).slice(0, 128),
      metadata: {
        order_id: String(orderId)
      }
    };

    if (hasCustomer) {
      body.receipt = {
        customer: {
          email: customerEmail || undefined,
          phone: customerPhone || undefined
        },
        items: (Array.isArray(items) ? items : []).map(item => ({
          description: String(item.name || item.product_name || 'Товар').substring(0, 128),
          quantity: String(Number(item.quantity) || 1),
          amount: {
            value: Number(item.price || 0).toFixed(2),
            currency: 'RUB'
          },
          vat_code: 1,
          payment_subject: 'commodity',
          payment_mode: 'full_payment'
        }))
      };
    }

    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Idempotence-Key': crypto.randomUUID(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('💳 YOOKASSA ошибка:', data);
      logger.logError('Ошибка создания платежа ЮKassa', {
        orderId,
        error: data.description || data.type
      });
      return {
        success: false,
        error: data.description || 'Ошибка создания платежа'
      };
    }

    logger.logActivity('Создан платёж ЮKassa', {
      orderId,
      paymentId: data.id,
      amount
    });

    return {
      success: true,
      payment_id: data.id,
      confirmation_url: data.confirmation?.confirmation_url,
      status: data.status
    };
  } catch (err) {
    console.error('💳 YOOKASSA fetch error:', err.message);
    logger.logError('Ошибка сети ЮKassa', { error: err.message });
    return { success: false, error: err.message };
  }
}

// ============================================================
// Проверить статус платежа
// ============================================================
async function getPaymentStatus(paymentId) {
  if (!isEnabled()) {
    return { success: true, stub: true, status: 'pending' };
  }

  if (!paymentId) {
    return { success: false, error: 'Не указан paymentId' };
  }

  try {
    const res = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader()
      }
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.description };
    }

    return {
      success: true,
      status: data.status,
      paid: data.paid === true,
      amount: data.amount,
      metadata: data.metadata,
      payment_method: data.payment_method
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// ✅ NEW: Проверить платёж по вебхуку
// ============================================================
async function verifyWebhookPayment(paymentId) {
  const result = await getPaymentStatus(paymentId);
  if (!result.success) return false;
  return result.paid === true && result.status === 'succeeded';
}

// ============================================================
// Возврат платежа
// ============================================================
async function createRefund(paymentId, amount, description) {
  if (!isEnabled()) {
    console.log(`💳 YOOKASSA [ЗАГЛУШКА] Возврат ${amount} ₽ по платежу ${paymentId}`);
    return { success: true, stub: true };
  }

  if (!paymentId) {
    return { success: false, error: 'Не указан paymentId' };
  }

  try {
    const res = await fetch('https://api.yookassa.ru/v3/refunds', {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Idempotence-Key': crypto.randomUUID(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment_id: paymentId,
        amount: {
          value: Number(amount || 0).toFixed(2),
          currency: 'RUB'
        },
        description: String(description || 'Возврат по заказу').slice(0, 128)
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.description };
    }

    logger.logActivity('Создан возврат ЮKassa', {
      paymentId,
      refundId: data.id,
      amount
    });

    return { success: true, refund_id: data.id, status: data.status };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// Проверка IP вебхука
// ============================================================
function isAllowedWebhookIP(ip) {
  const allowedRanges = [
    '185.71.76.',
    '185.71.77.',
    '77.75.153.',
    '77.75.154.',
    '77.75.156.11',
    '77.75.156.35'
  ];

  const cleanIP = String(ip || '').replace('::ffff:', '').trim();

  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIP)) {
    return false;
  }

  return allowedRanges.some(range => cleanIP.startsWith(range));
}

module.exports = {
  isEnabled,
  createPayment,
  getPaymentStatus,
  verifyWebhookPayment,
  createRefund,
  isAllowedWebhookIP
};