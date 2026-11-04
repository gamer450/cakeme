/* ============================================================
   МИГРАЦИЯ: Гибкая система оплаты
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция системы оплаты...\n');

const orderCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);

if (!orderCols.includes('payment_receipt')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_receipt TEXT`);
  console.log('✅ orders.payment_receipt добавлено');
}

if (!orderCols.includes('payment_confirmed_by_admin')) {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_confirmed_by_admin INTEGER NOT NULL DEFAULT 0`);
  console.log('✅ orders.payment_confirmed_by_admin добавлено');
}

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('payment_mode', 'yookassa');
insertSetting.run('payment_details', 'СБП: +7 900 000-00-00\nКарта: 2200 0000 0000 0000\nПолучатель: Иван И.');
insertSetting.run('payment_manual_instructions', 'Переведите сумму на реквизиты и прикрепите чек.');

console.log('✅ Настройки оплаты добавлены');
console.log('\n🎉 Готово!');