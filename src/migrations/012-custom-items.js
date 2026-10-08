/* ============================================================
   МИГРАЦИЯ: Кастомные товары (из конструктора)
   Запуск: node src/migrations/012-custom-items.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция кастомных товаров...\n');

const cols = db.prepare('PRAGMA table_info(order_items)').all().map(c => c.name);

// Флаг: кастомный товар или обычный
if (!cols.includes('is_custom')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0`);
  console.log('✅ order_items.is_custom добавлено');
} else {
  console.log('ℹ️  order_items.is_custom уже есть');
}

// JSON с параметрами кастомного торта
if (!cols.includes('custom_params')) {
  db.exec(`ALTER TABLE order_items ADD COLUMN custom_params TEXT`);
  console.log('✅ order_items.custom_params добавлено');
} else {
  console.log('ℹ️  order_items.custom_params уже есть');
}

console.log('\n📋 Структура order_items:');
db.prepare('PRAGMA table_info(order_items)').all().forEach(c => {
  const marker = ['is_custom', 'custom_params'].includes(c.name) ? ' ← новое' : '';
  console.log(`   ${c.name.padEnd(18)} ${(c.type || '—').padEnd(12)}${marker}`);
});

console.log('\n🎉 Готово');