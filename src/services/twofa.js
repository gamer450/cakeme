/* ============================================================
   2FA — генерация секрета, проверка кода, резервные коды
   ============================================================ */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

// ============================================================
// 1. Генерация секрета + QR-код
// ============================================================
async function generateSecret(user) {
  const secret = speakeasy.generateSecret({
    name: `Cake.Me (${user.email})`,
    issuer: 'Cake.Me',
    length: 32
  });

  // Генерируем QR-код в base64
  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
    qr_code: qrDataUrl
  };
}

// ============================================================
// 2. Проверка TOTP-кода
// ============================================================
function verifyToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: String(token).replace(/\s/g, ''),
    window: 2  // допуск ±1 минута
  });
}

// ============================================================
// 3. Генерация резервных кодов
// ============================================================
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Формат: XXXX-XXXX (8 символов)
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

// ============================================================
// 4. Проверка резервного кода
// ============================================================
function verifyBackupCode(storedCodesJson, inputCode) {
  if (!storedCodesJson) return { valid: false, remaining: null };

  let codes = [];
  try {
    codes = JSON.parse(storedCodesJson);
  } catch {
    return { valid: false, remaining: null };
  }

  const clean = String(inputCode).trim().toUpperCase().replace(/\s/g, '');
  const index = codes.indexOf(clean);

  if (index === -1) {
    return { valid: false, remaining: null };
  }

  // Удаляем использованный код
  codes.splice(index, 1);

  return {
    valid: true,
    remaining: codes,
    remaining_count: codes.length
  };
}

module.exports = {
  generateSecret,
  verifyToken,
  generateBackupCodes,
  verifyBackupCode
};