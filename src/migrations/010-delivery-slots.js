/* ============================================================
   МИГРАЦИЯ: Слоты доставки + дата/время в заказе
   Запуск: node src/migrations/010-delivery-slots.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция слотов доставки...\n');

// ============================================================
// 1. Слоты доставки (настраиваются в админке)
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS delivery_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time_from TEXT NOT NULL,
    time_to TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('✅ Таблица delivery_slots создана');

// ============================================================
// 2. Поля в orders
// ============================================================
const orderCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);

if (!orderCols.includes('delivery_date')) {
  db.exec(`ALTER TABLE orders ADD COLUMN delivery_date TEXT`);
  console.log('✅ orders.delivery_date добавлено');
}

if (!orderCols.includes('delivery_time')) {
  db.exec(`ALTER TABLE orders ADD COLUMN delivery_time TEXT`);
  console.log('✅ orders.delivery_time добавлено');
}

if (!orderCols.includes('cake_inscription')) {
  db.exec(`ALTER TABLE orders ADD COLUMN cake_inscription TEXT`);
  console.log('✅ orders.cake_inscription добавлено (надпись на торте)');
}

if (!orderCols.includes('inscription_price')) {
  db.exec(`ALTER TABLE orders ADD COLUMN inscription_price REAL DEFAULT 0`);
  console.log('✅ orders.inscription_price добавлено');
}

if (!orderCols.includes('extras')) {
  db.exec(`ALTER TABLE orders ADD COLUMN extras TEXT`);
  console.log('✅ orders.extras добавлено (доп. услуги, JSON)');
}

if (!orderCols.includes('extras_total')) {
  db.exec(`ALTER TABLE orders ADD COLUMN extras_total REAL DEFAULT 0`);
  console.log('✅ orders.extras_total добавлено');
}

// ============================================================
// 3. Демо-слоты
// ============================================================
const slotsCount = db.prepare('SELECT COUNT(*) as c FROM delivery_slots').get().c;

if (slotsCount === 0) {
  const insert = db.prepare(`
    INSERT INTO delivery_slots (time_from, time_to, sort_order)
    VALUES (?, ?, ?)
  `);

  insert.run('10:00', '12:00', 1);
  insert.run('12:00', '14:00', 2);
  insert.run('14:00', '16:00', 3);
  insert.run('16:00', '18:00', 4);
  insert.run('18:00', '20:00', 5);
  insert.run('20:00', '22:00', 6);

  console.log('✅ Добавлено 6 слотов доставки');
} else {
  console.log(`ℹ️  Слотов уже: ${slotsCount}`);
}

console.log('\n🎉 Миграция слотов доставки завершена!');