/* ============================================================
   МИГРАЦИЯ: Улучшения безопасности
   Запуск: node src/migrate-security.js
   ============================================================ */

const db = require('./db');

console.log('🔧 Миграция: безопасность...');

// ============================================================
// 1. Таблица blocked_ips — блокировка по IP
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL UNIQUE,
    reason TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    blocked_until TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('✅ Таблица blocked_ips создана');

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_blocked_ips_until
  ON blocked_ips(blocked_until);
`);

// ============================================================
// 2. Таблица security_events — лог подозрительных действий
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    ip TEXT,
    user_id INTEGER,
    url TEXT,
    user_agent TEXT,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('✅ Таблица security_events создана');

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_security_events_type
  ON security_events(event_type, created_at DESC);
`);

// ============================================================
// 3. Проверка
// ============================================================
console.log('\n🎉 Миграция завершена!');
console.log('\nДальше: патч server.js и middleware.');