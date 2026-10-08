/* ============================================
   MIDDLEWARE — проверка JWT и ролей
   ============================================ */

const jwt = require('jsonwebtoken');
const db = require('../db');

// ✅ ФИКС: валидация JWT_SECRET при старте (без дефолта!)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET не задан в .env');
  console.error('   Сгенерируй: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.error(`❌ FATAL: JWT_SECRET слишком короткий (${JWT_SECRET.length} < 32)`);
  process.exit(1);
}

const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// Генерируем токен
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// Проверка токена (для защищённых маршрутов)
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, phone, role, is_active FROM users WHERE id = ?').get(payload.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

// Проверка роли
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

// Опциональная авторизация — если токен есть, добавляем user, но не блокируем
function authOptional(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, phone, role, is_active FROM users WHERE id = ?').get(payload.id);
    if (user && user.is_active) {
      req.user = user;
    }
  } catch {
    // Игнорируем ошибку — гость
  }
  next();
}

// ============================================================
// Проверка — требуется ли 2FA для пользователя
// ============================================================
function checkTwoFA(user) {
  return user.twofa_enabled === 1;
}

module.exports.checkTwoFA = checkTwoFA;

module.exports = { signToken, authRequired, requireRole, authOptional, checkTwoFA };