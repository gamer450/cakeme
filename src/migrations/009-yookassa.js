/* ============================================================
   МИГРАЦИЯ: Онлайн-оплата ЮKassa
   Запуск: node src/migrations/009-yookassa.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция ЮKassa...\n');

const cols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);

// Статус оплаты
if (!cols.includes('payment_status')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'`);
  console.log('✅ orders.payment_status добавлено');
} else {
  console.log('ℹ️  orders.payment_status уже есть');
}

// ID платежа в ЮKassa
if (!cols.includes('payment_id')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_id TEXT`);
  console.log('✅ orders.payment_id добавлено');
} else {
  console.log('ℹ️️  orders.payment_id уже есть');
}

// Ссылка на оплату
if (!cols.includes('payment_url')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_url TEXT`);
  console.log('✅ orders.payment_url добавлено');
} else {
  console.log('ℹ️  orders.payment_url уже есть');
}

// Когда оплачено
if (!cols.includes('paid_at')) {
  db.exec(`ALTER TABLE orders ADD COLUMN paid_at TEXT`);
  console.log('✅ orders.paid_at добавлено');
} else {
  console.log('ℹ️  orders.paid_at уже есть');
}

// Способ оплаты теперь: cash | card | online
// ВАЖНО: payment_status для разных оплат:
// - cash → pending всегда, paid_at ставится вручную
// - online → pending → succeeded (через вебхук) | canceled

console.log('\n📋 Структура orders (поля оплаты):');
db.prepare('PRAGMA table_info(orders)').all()
  .filter(c => ['payment', 'payment_status', 'payment_id', 'payment_url', 'paid_at'].includes(c.name))
  .forEach(c => {
    console.log(`   ${c.name.padEnd(20)} ${c.type || '—'}${c.dflt_value ? ' DEFAULT ' + c.dflt_value : ''}`);
  });

console.log('\n🎉 Миграция ЮKassa завершена!');