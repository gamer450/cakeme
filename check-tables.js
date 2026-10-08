// check-tables.js — проверка таблиц в БД
const db = require('./src/db');

const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

console.log('\n📋 Таблицы в БД:');
tables.forEach(t => console.log('   ✅ ' + t.name));
console.log(`\n📊 Всего таблиц: ${tables.length}\n`);

// Проверка колонок в orders
console.log('📋 Колонки orders:');
const orderCols = db.prepare('PRAGMA table_info(orders)').all();
orderCols.forEach(c => console.log('   • ' + c.name));
console.log(`\n📊 Всего колонок в orders: ${orderCols.length}\n`);

// Проверка колонок в users (2FA)
console.log('📋 Колонки users:');
const userCols = db.prepare('PRAGMA table_info(users)').all();
userCols.forEach(c => console.log('   • ' + c.name));
console.log(`\n📊 Всего колонок в users: ${userCols.length}\n`);