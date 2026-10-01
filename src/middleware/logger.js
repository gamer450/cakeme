/* ============================================================
   ЛОГГЕР ДЕЙСТВИЙ
   ============================================================ */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'logs');

// Создаём папку для логов
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const SECURITY_LOG = path.join(LOG_DIR, 'security.log');
const ACTIVITY_LOG = path.join(LOG_DIR, 'activity.log');

// ============================================================
// Запись в лог
// ============================================================
function writeLog(file, level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const line = JSON.stringify({
    timestamp,
    level,
    message,
    ...meta
  }) + '\n';

  try {
    fs.appendFileSync(file, line);
  } catch (err) {
    console.error('Ошибка записи лога:', err);
  }
}

// ============================================================
// Логи безопасности (подозрительные действия)
// ============================================================
function logSecurity(message, meta = {}) {
  console.warn(`🔒 [SECURITY] ${message}`, meta);
  writeLog(SECURITY_LOG, 'security', message, meta);
}

// ============================================================
// Логи действий админа
// ============================================================
function logActivity(message, meta = {}) {
  console.log(`📝 [ACTIVITY] ${message}`, meta);
  writeLog(ACTIVITY_LOG, 'activity', message, meta);
}

// ============================================================
// Логи ошибок
// ============================================================
function logError(message, meta = {}) {
  console.error(`❌ [ERROR] ${message}`, meta);
  writeLog(SECURITY_LOG, 'error', message, meta);
}

// ============================================================
// Middleware — логируем действия админа
// ============================================================
function activityLogger(action) {
  return (req, res, next) => {
    // Логируем только успешные изменения (2xx)
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        logActivity(`${action}`, {
          userId: req.user.id,
          userName: req.user.name,
          role: req.user.role,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          ip: req.ip
        });
      }
    });
    next();
  };
}

module.exports = {
  logSecurity,
  logActivity,
  logError,
  activityLogger
};