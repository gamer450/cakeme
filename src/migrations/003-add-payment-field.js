/* ============================================================
   МИГРАЦИЯ: колонка payment в таблице orders
   Запуск: node src/migrations/003-add-payment-field.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция: колонка payment в orders...');

// Проверяем, есть ли уже колонка
const columns = db.prepare('PRAGMA table_info(orders)').all();
const hasPayment = columns.some(col => col.name === 'payment');

if (hasPayment) {
  console.log('ℹ️  Колонка payment уже существует — пропускаем');
  console.log('\n🎉 Миграция не требуется.');
  process.exit(0);
}

// Добавляем колонку
try {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN payment TEXT NOT NULL DEFAULT 'cash'
  `);

  console.log('✅ Колонка payment добавлена в orders');
  console.log('   Значения: cash (при получении) | card (онлайн)');
  console.log('   По умолчанию для старых заказов: cash');
} catch (err) {
  console.error('❌ Ошибка миграции:', err.message);
  process.exit(1);
}

// Показать финальную структуру таблицы
const finalColumns = db.prepare('PRAGMA table_info(orders)').all();
console.log('\n📋 Структура orders после миграции:');
finalColumns.forEach(c => {
  console.log(`   ${c.name.padEnd(18)} ${c.type || '—'}${c.notnull ? ' NOT NULL' : ''}${c.dflt_value ? ` DEFAULT ${c.dflt_value}` : ''}`);
});

console.log('\n🎉 Миграция завершена!');
console.log('Перезапусти сервер: npm run dev');