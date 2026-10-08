/* ============================================================
   МИГРАЦИЯ: Больше опций конструктора
   Запуск: node src/migrations/018-constructor-more-options.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Добавляем новые опции конструктора...\n');

// ============================================
// Новые формы
// ============================================
const newShapes = [
  { name: 'Овал', description: 'Удлинённая форма', price: 300, sort: 4, is_default: 0 },
  { name: 'Шестиугольник', description: 'Современная геометрия', price: 350, sort: 5, is_default: 0 },
  { name: 'Цветок', description: '8 лепестков', price: 500, sort: 6, is_default: 0 }
];

// ============================================
// Новые начинки
// ============================================
const newFillings = [
  { name: 'Красный бархат', description: 'Классический вкус с крем-чизом', price: 500, sort: 6, is_default: 0 },
  { name: 'Тирамису', description: 'Кофе + маскарпоне', price: 550, sort: 7, is_default: 0 },
  { name: 'Лимон', description: 'Цитрусовый крем', price: 450, sort: 8, is_default: 0 },
  { name: 'Кокос', description: 'Нежный кокосовый крем', price: 400, sort: 9, is_default: 0 }
];

// ============================================
// Новый декор
// ============================================
const newDecor = [
  { name: 'Маршмэллоу', description: 'Воздушные зефирки', price: 250, sort: 6, is_default: 0 },
  { name: 'Шоколадные фигурки', description: 'Ручная работа', price: 600, sort: 7, is_default: 0 },
  { name: 'Съедобные цветы', description: 'Живые цветы', price: 800, sort: 8, is_default: 0 },
  { name: 'Орехи', description: 'Грецкие, миндаль, фундук', price: 350, sort: 9, is_default: 0 }
];

// ============================================
// Добавляем в БД
// ============================================
const insert = db.prepare(`
  INSERT INTO constructor_options
    (group_key, name, description, price_modifier, price_type, sort_order, is_default, is_active)
  VALUES (?, ?, ?, ?, 'fixed', ?, ?, 1)
`);

const checkExists = db.prepare(`
  SELECT id FROM constructor_options
  WHERE group_key = ? AND name = ?
`);

let added = 0;

const addOptions = (group, options) => {
  options.forEach(opt => {
    const exists = checkExists.get(group, opt.name);
    if (!exists) {
      insert.run(group, opt.name, opt.description, opt.price, opt.sort, opt.is_default);
      added++;
    }
  });
};

addOptions('shape', newShapes);
addOptions('filling', newFillings);
addOptions('decor', newDecor);

console.log(`✅ Добавлено ${added} новых опций`);

// ============================================
// Показать итог
// ============================================
const counts = db.prepare(`
  SELECT group_key, COUNT(*) as count
  FROM constructor_options
  WHERE is_active = 1
  GROUP BY group_key
`).all();

console.log('\n📋 Опций по группам:');
counts.forEach(c => {
  console.log(`   ${c.group_key.padEnd(10)} ${c.count}`);
});

console.log('\n🎉 Готово!');