const db = require('../db');
console.log('🔧 Миграция уведомлений о заказах...\n');

const cols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);

if (!cols.includes('seen_by_admin')) {
  db.exec(`ALTER TABLE orders ADD COLUMN seen_by_admin INTEGER NOT NULL DEFAULT 0`);
  console.log('✅ orders.seen_by_admin добавлено');
} else {
  console.log('ℹ️  orders.seen_by_admin уже есть');
}

if (!cols.includes('seen_at')) {
  db.exec(`ALTER TABLE orders ADD COLUMN seen_at TEXT`);
  console.log('✅ orders.seen_at добавлено');
}

console.log('\n🎉 Готово');