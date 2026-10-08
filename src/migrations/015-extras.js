/* ============================================================
   МИГРАЦИЯ: Доп. услуги (свечи, открытки, шарики)
   Запуск: node src/migrations/015-extras.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция доп. услуг...\n');

db.exec(`
  CREATE TABLE IF NOT EXISTS extras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('✅ Таблица extras создана');

const count = db.prepare('SELECT COUNT(*) as c FROM extras').get().c;

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO extras (name, description, price, icon, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  insert.run('Свечи для торта', 'Набор из 5 свечей', 100, '🕯️', 1);
  insert.run('Открытка', 'Рукописная открытка с пожеланием', 150, '💌', 2);
  insert.run('Воздушные шарики', 'Набор из 3 шариков', 300, '🎈', 3);
  insert.run('Хлопушка', 'Праздничная хлопушка', 200, '🎉', 4);
  insert.run('Подарочная упаковка', 'Премиум-упаковка торта', 250, '🎁', 5);
  insert.run('Удлинённые свечи-фейерверк', 'Бенгальские свечи', 350, '✨', 6);

  console.log('✅ Добавлено 6 доп. услуг');
}

console.log('\n🎉 Готово');