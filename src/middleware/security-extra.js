/* ============================================================
   БЕЗОПАСНОСТЬ — расширенный middleware
   1. Honeypot-защита (для форм)
   2. IP-блокировка
   3. Лог подозрительных событий
   ============================================================ */

const db = require('../db');
const logger = require('./logger');

// ============================================================
// 1. HELPER — получить IP
// ✅ ФИКС: не доверяем заголовкам, если TRUST_PROXY не включён в .env
// ============================================================
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

function getClientIP(req) {
  let ip;

  // ✅ Только если явно разрешено (за nginx / Cloudflare)
  if (TRUST_PROXY) {
    ip =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-real-ip'] ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  }

  // ✅ Fallback — всегда берём реальный socket
  if (!ip) {
    ip = req.socket?.remoteAddress
      || req.connection?.remoteAddress
      || req.ip
      || 'unknown';
  }

  return String(ip).replace('::ffff:', '').replace('::1', '127.0.0.1');
}

// ============================================================
// 2. ЛОГ СОБЫТИЯ
// ============================================================
function logSecurityEvent(eventType, req, meta = {}) {
  try {
    const ip = getClientIP(req);

    // ✅ Проверяем существование таблицы (без кэша)
    const hasTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='security_events'"
    ).get();

    if (hasTable) {
      db.prepare(`
        INSERT INTO security_events (event_type, ip, user_id, url, user_agent, meta)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        eventType,
        ip,
        req.user?.id || null,
        req.originalUrl ? String(req.originalUrl).slice(0, 500) : null,
        req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 500) : null,
        Object.keys(meta).length ? JSON.stringify(meta).slice(0, 5000) : null
      );
    }

    logger.logSecurity(eventType, { ip, ...meta });
  } catch (err) {
    console.error('Ошибка записи security_events:', err.message);
  }
}

// ============================================================
// 3. HONEYPOT — защита от ботов
// Использование: router.post('/api/something', honeypot('website_hp'), handler)
// Если поле заполнено → считаем что это бот
// ============================================================
function honeypot(fieldName = 'website_hp') {
  return (req, res, next) => {
    const value = req.body?.[fieldName];

    if (value && String(value).trim() !== '') {
      // Бот заполнил скрытое поле — логируем
      logSecurityEvent('honeypot_triggered', req, {
        field: fieldName,
        value: String(value).slice(0, 100)
      });

      // ✅ ФИКС: возвращаем «успех», НЕ палим себя полем _hp
      return res.status(200).json({
        success: true,
        message: 'Заявка принята'
      });
    }

    next();
  };
}

// ============================================================
// 4. IP-БЛОКИРОВКА
// Проверяет, не заблокирован ли IP
// ============================================================
function checkIPBlocked(req, res, next) {
  try {
    const ip = getClientIP(req);

    // ✅ Проверяем существование таблицы
    const hasTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='blocked_ips'"
    ).get();

    if (!hasTable) {
      return next();
    }

    const blocked = db.prepare(`
      SELECT * FROM blocked_ips
      WHERE ip = ? AND blocked_until > datetime('now')
    `).get(ip);

    if (blocked) {
      logSecurityEvent('blocked_ip_attempt', req, {
        reason: blocked.reason,
        until: blocked.blocked_until
      });

      return res.status(429).json({
        error: 'Доступ временно ограничен. Попробуйте позже.',
        retry_after: blocked.blocked_until
      });
    }

    next();
  } catch (err) {
    // В случае ошибки — пропускаем (не блокируем всё)
    next();
  }
}

// ============================================================
// 5. ЗАБЛОКИРОВАТЬ IP
// ============================================================
function blockIP(ip, reason, minutes = 60) {
  try {
    const until = new Date(Date.now() + minutes * 60 * 1000)
      .toISOString().replace('T', ' ').slice(0, 19);

    const existing = db.prepare('SELECT * FROM blocked_ips WHERE ip = ?').get(ip);

    if (existing) {
      // Увеличиваем попытки и срок
      const newAttempts = existing.attempts + 1;
      const newMinutes = Math.min(minutes * newAttempts, 60 * 24); // макс 24 часа

      const newUntil = new Date(Date.now() + newMinutes * 60 * 1000)
        .toISOString().replace('T', ' ').slice(0, 19);

      db.prepare(`
        UPDATE blocked_ips
        SET attempts = ?, blocked_until = ?, reason = ?
        WHERE ip = ?
      `).run(newAttempts, newUntil, reason, ip);

      logger.logSecurity(`IP повторно заблокирован: ${ip}`, {
        attempts: newAttempts,
        until: newUntil,
        reason
      });
    } else {
      db.prepare(`
        INSERT INTO blocked_ips (ip, reason, attempts, blocked_until)
        VALUES (?, ?, 1, ?)
      `).run(ip, reason, until);

      logger.logSecurity(`IP заблокирован: ${ip}`, {
        until,
        reason,
        minutes
      });
    }
  } catch (err) {
    console.error('Ошибка блокировки IP:', err.message);
  }
}

// ============================================================
// 6. РАЗБЛОКИРОВАТЬ IP
// ============================================================
function unblockIP(ip) {
  try {
    db.prepare('DELETE FROM blocked_ips WHERE ip = ?').run(ip);
    logger.logActivity(`IP разблокирован: ${ip}`, {});
    return true;
  } catch (err) {
    console.error('Ошибка разблокировки IP:', err.message);
    return false;
  }
}

// ============================================================
// 7. ОЧИСТКА ИСТЁКШИХ БЛОКИРОВОК
// ============================================================
function cleanupExpiredBlocks() {
  try {
    const result = db.prepare(`
      DELETE FROM blocked_ips
      WHERE blocked_until < datetime('now')
    `).run();

    if (result.changes > 0) {
      console.log(`🧹 Очищено ${result.changes} истёкших блокировок IP`);
    }

    return result.changes;
  } catch (err) {
    console.error('Ошибка очистки блокировок:', err.message);
    return 0;
  }
}

// ============================================================
// 8. МОНИТОРИНГ ПОДОЗРИТЕЛЬНОЙ АКТИВНОСТИ
// Следит за частыми ошибками с одного IP
// ============================================================
function autoBlockByAttempts(maxAttempts = 10, windowMinutes = 15) {
  return (req, res, next) => {
    // Проверяем только после ответа
    res.on('finish', () => {
      // Нас интересуют только 4xx ошибки (кроме 401 — их отдельно)
      if (res.statusCode < 400 || res.statusCode >= 500) return;

      const ip = getClientIP(req);

      try {
        // Считаем события этого типа за окно
        const since = new Date(Date.now() - windowMinutes * 60 * 1000)
          .toISOString().replace('T', ' ').slice(0, 19);

        const count = db.prepare(`
          SELECT COUNT(*) as c FROM security_events
          WHERE ip = ? AND created_at > ?
            AND event_type LIKE 'http_%'
        `).get(ip, since).c;

        // Если > maxAttempts ошибок — блокируем
        if (count >= maxAttempts) {
          blockIP(ip, `Слишком много ошибок (${count} за ${windowMinutes} мин)`, 60);
        }
      } catch {}
    });

    next();
  };
}

// ============================================================
// ЭКСПОРТ
// ============================================================
module.exports = {
  getClientIP,
  logSecurityEvent,
  honeypot,
  checkIPBlocked,
  blockIP,
  unblockIP,
  cleanupExpiredBlocks,
  autoBlockByAttempts
};