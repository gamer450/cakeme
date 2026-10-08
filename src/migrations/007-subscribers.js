const db = require('../db');
console.log('🔧 Миграция подписчиков...');

db.exec(`
  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    promocode TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    source TEXT DEFAULT 'footer',
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_subs_email ON subscribers(email);`);

console.log('✅ Таблица subscribers создана');
console.log('🎉 Готово');