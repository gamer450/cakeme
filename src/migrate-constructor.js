/* ============================================================
   МИГРАЦИЯ: Конструктор торта
   Запуск: node src/migrate-constructor.js
   ============================================================ */

const db = require('./db');

console.log('🔧 Миграция: Конструктор торта...');

// 1. Таблица опций конструктора
db.exec(`
  CREATE TABLE IF NOT EXISTS constructor_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_modifier REAL NOT NULL DEFAULT 0,
    price_type TEXT NOT NULL DEFAULT 'fixed',
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('✅ Таблица constructor_options создана');

// 2. Демо-данные (если таблица пустая)
const count = db.prepare('SELECT COUNT(*) as c FROM constructor_options').get().c;

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO constructor_options
      (group_key, name, description, price_modifier, price_type, sort_order, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // ---------- ФОРМА ----------
  insert.run('shape', 'Круглая', 'Классическая форма', 0, 'fixed', 1, 1);
  insert.run('shape', 'Квадратная', 'Строгая форма', 200, 'fixed', 2, 0);
  insert.run('shape', 'Сердце', 'Для романтического повода', 400, 'fixed', 3, 0);

  // ---------- ВЕС ----------
  insert.run('weight', '1 кг', 'На 6–8 человек', 800, 'per_kg', 1, 0);
  insert.run('weight', '1.5 кг', 'На 8–12 человек', 800, 'per_kg', 2, 0);
  insert.run('weight', '2 кг', 'На 12–16 человек', 800, 'per_kg', 3, 1);
  insert.run('weight', '3 кг', 'На 16–24 человек', 800, 'per_kg', 4, 0);

  // ---------- НАЧИНКА ----------
  insert.run('filling', 'Ваниль', 'Классическая ваниль', 0, 'fixed', 1, 1);
  insert.run('filling', 'Шоколад', 'Бельгийский шоколад', 300, 'fixed', 2, 0);
  insert.run('filling', 'Фрукты', 'Свежие фрукты', 450, 'fixed', 3, 0);
  insert.run('filling', 'Орехи', 'Грецкий орех, миндаль', 400, 'fixed', 4, 0);
  insert.run('filling', 'Карамель', 'Солёная карамель', 350, 'fixed', 5, 0);

  // ---------- ДЕКОР ----------
  insert.run('decor', 'Надпись', 'Индивидуальная надпись', 200, 'fixed', 1, 0);
  insert.run('decor', 'Свечи', 'Набор свечей', 100, 'fixed', 2, 0);
  insert.run('decor', 'Ягоды', 'Свежие ягоды', 350, 'fixed', 3, 0);
  insert.run('decor', 'Фигурки', 'Съедобные фигурки', 500, 'fixed', 4, 0);
  insert.run('decor', 'Золото', 'Съедобное золото', 700, 'fixed', 5, 0);

  console.log('✅ Добавлено 17 опций конструктора');
} else {
  console.log(`ℹ️  Опций уже: ${count} — пропускаем демо`);
}

console.log('\n🎉 Миграция завершена!');