/* ============================================================
   МИГРАЦИЯ: Способ получения заказа
   Запуск: node src/migrations/019-delivery-method.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция способа получения...\n');

const cols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);

if (!cols.includes('delivery_method')) {
  db.exec(`ALTER TABLE orders ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'delivery'`);
  console.log('✅ orders.delivery_method добавлено');
} else {
  console.log('ℹ️  orders.delivery_method уже есть');
}

console.log('\n🎉 Готово');