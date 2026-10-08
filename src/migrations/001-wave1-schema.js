/* ============================================================
   МИГРАЦИЯ: Волна 1 — все новые поля и таблицы
   Запуск: node src/migrations/001-wave1-schema.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция Wave 1...\n');

// ============================================================
// 1. PRODUCTS — управление остатками
// ============================================================
const productCols = db.prepare('PRAGMA table_info(products)').all();
const productColNames = productCols.map(c => c.name);

if (!productColNames.includes('track_stock')) {
  db.exec(`ALTER TABLE products ADD COLUMN track_stock INTEGER NOT NULL DEFAULT 1`);
  console.log('✅ products.track_stock добавлено');
} else {
  console.log('ℹ️  products.track_stock уже есть');
}

if (!productColNames.includes('low_stock_threshold')) {
  db.exec(`ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5`);
  console.log('✅ products.low_stock_threshold добавлено');
} else {
  console.log('ℹ️  products.low_stock_threshold уже есть');
}

// ============================================================
// 2. ACTIVITY_LOG — логи действий в БД
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    meta TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_activity_log_created
  ON activity_log(created_at DESC);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_activity_log_user
  ON activity_log(user_id, created_at DESC);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON activity_log(action, created_at DESC);
`);

console.log('✅ Таблица activity_log создана + индексы');

// ============================================================
// 3. ADMIN_NOTIFICATIONS — уведомления админу на сайте
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    text TEXT,
    link TEXT,
    entity_type TEXT,
    entity_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON admin_notifications(user_id, is_read, created_at DESC);
`);

console.log('✅ Таблица admin_notifications создана');

// ============================================================
// 4. FAVORITES — если захотим синхронизировать на сервере (пока не используется)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`);

console.log('✅ Таблица favorites создана (на будущее)');

// ============================================================
// 5. Показать итоговую структуру products
// ============================================================
console.log('\n📋 products:');
db.prepare('PRAGMA table_info(products)').all().forEach(c => {
  console.log(`   ${c.name.padEnd(22)} ${c.type || '—'}`);
});

console.log('\n📋 Новые таблицы:');
const tables = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name IN ('activity_log', 'admin_notifications', 'favorites')
`).all();
tables.forEach(t => console.log(`   ${t.name}`));

console.log('\n🎉 Миграция Wave 1 завершена!');
console.log('Перезапусти сервер: npm run dev');