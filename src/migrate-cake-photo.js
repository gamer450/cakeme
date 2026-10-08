/* ============================================================
   МИГРАЦИЯ: Фотопечать на торте
   Запуск: node src/migrate-cake-photo.js
   ============================================================ */

const db = require('./db');
const fs = require('fs');
const path = require('path');

console.log('🔧 Миграция: фотопечать на торте...');

// ============================================================
// 1. Добавляем колонки в orders
// ============================================================
const columns = db.prepare("PRAGMA table_info(orders)").all();
const hasCakePhoto = columns.some(c => c.name === 'cake_photo');
const hasPhotoPrice = columns.some(c => c.name === 'cake_photo_price');

if (!hasCakePhoto) {
  db.exec(`ALTER TABLE orders ADD COLUMN cake_photo TEXT;`);
  console.log('✅ Добавлена колонка orders.cake_photo');
} else {
  console.log('ℹ️  Колонка orders.cake_photo уже есть');
}

if (!hasPhotoPrice) {
  db.exec(`ALTER TABLE orders ADD COLUMN cake_photo_price REAL NOT NULL DEFAULT 0;`);
  console.log('✅ Добавлена колонка orders.cake_photo_price');
} else {
  console.log('ℹ️  Колонка orders.cake_photo_price уже есть');
}

// ============================================================
// 2. Создаём папку для фото тортов
// ============================================================
const dir = path.join(__dirname, '..', 'public', 'uploads', 'cakes');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('✅ Создана папка public/uploads/cakes/');
} else {
  console.log('ℹ️  Папка public/uploads/cakes/ уже есть');
}

// ============================================================
// 3. Добавляем настройку цены фотопечати
// ============================================================
const priceKey = db.prepare('SELECT key FROM settings WHERE key = ?').get('cake_photo_price');

if (!priceKey) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('cake_photo_price', '300');
  console.log('✅ Добавлена настройка cake_photo_price = 300');
} else {
  console.log('ℹ️  Настройка cake_photo_price уже есть');
}

console.log('\n🎉 Миграция завершена!');
console.log('\nДальнейшие шаги:');
console.log('  1. Патч server.js (endpoint + order обработка)');
console.log('  2. Патч checkout.js (UI загрузки)');
console.log('  3. Патч checkout.css (стили)');
console.log('  4. Патч admin-orders.js (показ в модалке)');