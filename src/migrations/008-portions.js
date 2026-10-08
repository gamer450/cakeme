/* ============================================================
   МИГРАЦИЯ: размеры тортов (на сколько человек)
   Запуск: node src/migrations/008-portions.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция размеров тортов...\n');

const cols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);

if (!cols.includes('portions')) {
  db.exec(`ALTER TABLE products ADD COLUMN portions TEXT`);
  console.log('✅ products.portions добавлено');
} else {
  console.log('ℹ️  products.portions уже есть');
}

if (!cols.includes('ingredients')) {
  db.exec(`ALTER TABLE products ADD COLUMN ingredients TEXT`);
  console.log('✅ products.ingredients добавлено (состав/аллергены)');
} else {
  console.log('ℹ️  products.ingredients уже есть');
}

if (!cols.includes('storage_info')) {
  db.exec(`ALTER TABLE products ADD COLUMN storage_info TEXT`);
  console.log('✅ products.storage_info добавлено (срок хранения)');
} else {
  console.log('ℹ️  products.storage_info уже есть');
}

// Автозаполнение для существующих товаров
const products = db.prepare('SELECT id, weight FROM products').all();

const update = db.prepare(`
  UPDATE products
  SET portions = ?, ingredients = ?, storage_info = ?
  WHERE id = ?
`);

products.forEach(p => {
  // Определяем по весу
  const weight = String(p.weight || '').toLowerCase();
  let portions = '';

  if (weight.includes('100 г') || weight.includes('80 г')) portions = '1-2 человека';
  else if (weight.includes('150 г')) portions = '1 человек';
  else if (weight.includes('250 г')) portions = '1-2 человека (кофе)';
  else if (weight.includes('500 г')) portions = '3-4 человека';
  else if (weight.includes('1 кг') && !weight.includes('1.5') && !weight.includes('1,5')) portions = '6-8 человек';
  else if (weight.includes('1.2 кг') || weight.includes('1,2')) portions = '7-9 человек';
  else if (weight.includes('1.5 кг') || weight.includes('1,5')) portions = '10-12 человек';
  else if (weight.includes('2 кг')) portions = '14-16 человек';
  else if (weight.includes('3 кг')) portions = '20-24 человека';
  else portions = '';

  update.run(portions, null, null, p.id);
});

console.log(`✅ Заполнено порций для ${products.length} товаров`);
console.log('\n🎉 Готово');