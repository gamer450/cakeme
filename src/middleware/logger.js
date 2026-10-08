/* ============================================================
   ЛОГГЕР ДЕЙСТВИЙ
   v2.0 — пишет в файл + в БД (activity_log)
   ============================================================ */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const SECURITY_LOG = path.join(LOG_DIR, 'security.log');
const ACTIVITY_LOG = path.join(LOG_DIR, 'activity.log');

// ============================================================
// Запись в файл
// ============================================================
function writeToFile(file, level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const safeMessage = String(message).slice(0, 500);

  // ✅ Обрезаем потенциально чувствительные поля
  const safeMeta = { ...meta };
  ['password', 'secret', 'token', 'jwt'].forEach(key => {
    if (safeMeta[key]) safeMeta[key] = '***';
  });

  const line = JSON.stringify({ timestamp, level, message: safeMessage, ...safeMeta }) + '\n';

  // ✅ Асинхронная запись (не блокирует event loop)
  fs.appendFile(file, line, (err) => {
    if (err) console.error('Ошибка записи лога:', err.message);
  });
}

// ============================================================
// Запись в БД (activity_log)
// Не падает, если таблицы нет (например, до миграции)
// ============================================================
function writeToDb(level, message, meta = {}) {
  try {
    const db = require('../db');

    // ✅ ФИКС: НЕ кэшируем результат. Better-sqlite3 кэширует prepared statements сам.
    // Раньше _hasTable = false оставался навсегда → логи не писались даже после миграции.
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='activity_log'"
    ).get();

    if (!tableExists) return;

    // ✅ Проверяем наличие user_agent (совместимость со старыми БД)
    const hasUserAgent = db.prepare("PRAGMA table_info(activity_log)").all()
      .some(c => c.name === 'user_agent');

    if (hasUserAgent) {
      db.prepare(`
        INSERT INTO activity_log
          (user_id, user_name, user_role, action, entity_type, entity_id, meta, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        meta.userId || null,
        meta.userName || null,
        meta.role || null,
        String(message).slice(0, 500),
        meta.entityType || null,
        meta.entityId || null,
        meta.meta ? JSON.stringify(meta.meta).slice(0, 5000) : null,
        meta.ip ? String(meta.ip).slice(0, 45) : null,
        meta.userAgent ? String(meta.userAgent).slice(0, 500) : null
      );
    } else {
      db.prepare(`
        INSERT INTO activity_log
          (user_id, user_name, user_role, action, entity_type, entity_id, meta, ip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        meta.userId || null,
        meta.userName || null,
        meta.role || null,
        String(message).slice(0, 500),
        meta.entityType || null,
        meta.entityId || null,
        meta.meta ? JSON.stringify(meta.meta).slice(0, 5000) : null,
        meta.ip ? String(meta.ip).slice(0, 45) : null
      );
    }
  } catch (err) {
    console.error('Ошибка записи лога в БД:', err.message);
  }
}

// ============================================================
// Публичные функции
// ============================================================
function logSecurity(message, meta = {}) {
  console.warn(`🔒 [SECURITY] ${message}`, meta);
  writeToFile(SECURITY_LOG, 'security', message, meta);
  // security-логи тоже полезно видеть в activity_log
  writeToDb('security', message, meta);
}

function logActivity(message, meta = {}) {
  console.log(`📝 [ACTIVITY] ${message}`, meta);
  writeToFile(ACTIVITY_LOG, 'activity', message, meta);
  writeToDb('activity', message, meta);
}

function logError(message, meta = {}) {
  console.error(`❌ [ERROR] ${message}`, meta);
  writeToFile(SECURITY_LOG, 'error', message, meta);
}

// ============================================================
// Middleware — логирует действия админов
// action = короткое название, entityType/entityId — из req
// ============================================================
function activityLogger(action, options = {}) {
  return (req, res, next) => {
    res.on('finish', () => {
      // Логируем только успешные изменения
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      if (!req.user) return;

      // Определяем entity и id
      const entityType = options.entityType || guessEntityType(req.originalUrl);
      const entityId = options.entityId
        ? options.entityId(req)
        : (parseInt(req.params.id, 10) || req.body?.id || null);

      logActivity(action, {
        userId: req.user.id,
        userName: req.user.name,
        role: req.user.role,
        entityType,
        entityId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    });
    next();
  };
}

function guessEntityType(url) {
  if (url.includes('/products')) return 'product';
  if (url.includes('/categories')) return 'category';
  if (url.includes('/orders')) return 'order';
  if (url.includes('/users')) return 'user';
  if (url.includes('/partners')) return 'partner';
  if (url.includes('/reviews')) return 'review';
  if (url.includes('/settings')) return 'settings';
  if (url.includes('/constructor')) return 'constructor';
  if (url.includes('/media')) return 'media';
  if (url.includes('/backups')) return 'backup';
  return null;
}

module.exports = {
  logSecurity,
  logActivity,
  logError,
  activityLogger
};