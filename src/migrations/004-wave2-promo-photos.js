/* ============================================================
   МИГРАЦИЯ: Волна 2 — промокоды + фото в отзывах
   Запуск: node src/migrations/004-wave2-promo-photos.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция Wave 2...\n');

// ============================================================
// 1. PROMOCODES — промокоды
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS promocodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percent' CHECK(discount_type IN ('percent', 'fixed')),
    discount_value REAL NOT NULL DEFAULT 0,
    min_order_sum REAL NOT NULL DEFAULT 0,
    max_discount REAL,
    uses_limit INTEGER,
    uses_count INTEGER NOT NULL DEFAULT 0,
    valid_from TEXT,
    valid_until TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_promocodes_code ON promocodes(code, is_active);
`);

console.log('✅ Таблица promocodes создана');

// ============================================================
// 2. PROMOCODE_USES — кто использовал
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS promocode_uses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promocode_id INTEGER NOT NULL,
    order_id INTEGER,
    user_id INTEGER,
    code TEXT NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (promocode_id) REFERENCES promocodes(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_promo_uses_code ON promocode_uses(promocode_id);
  CREATE INDEX IF NOT EXISTS idx_promo_uses_order ON promocode_uses(order_id);
`);

console.log('✅ Таблица promocode_uses создана');

// ============================================================
// 3. ORDERS — поля для промокода и скидки
// ============================================================
const orderCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);

if (!orderCols.includes('promocode')) {
  db.exec(`ALTER TABLE orders ADD COLUMN promocode TEXT`);
  console.log('✅ orders.promocode добавлено');
} else {
  console.log('ℹ️  orders.promocode уже есть');
}

if (!orderCols.includes('discount_amount')) {
  db.exec(`ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0`);
  console.log('✅ orders.discount_amount добавлено');
} else {
  console.log('ℹ️  orders.discount_amount уже есть');
}

// ============================================================
// 4. REVIEWS — фото в отзывах
// ============================================================
const reviewCols = db.prepare('PRAGMA table_info(reviews)').all().map(c => c.name);

if (!reviewCols.includes('photos')) {
  // JSON-массив путей к фото: ["/uploads/reviews/1.jpg", ...]
  db.exec(`ALTER TABLE reviews ADD COLUMN photos TEXT`);
  console.log('✅ reviews.photos добавлено');
} else {
  console.log('ℹ️  reviews.photos уже есть');
}

// ============================================================
// 5. Проверка структуры
// ============================================================
console.log('\n📋 Структура promocodes:');
db.prepare('PRAGMA table_info(promocodes)').all().forEach(c => {
  console.log(`   ${c.name.padEnd(20)} ${c.type}`);
});

console.log('\n📋 orders (новые поля):');
const newOrderCols = db.prepare('PRAGMA table_info(orders)').all()
  .filter(c => ['promocode', 'discount_amount'].includes(c.name));
newOrderCols.forEach(c => {
  console.log(`   ${c.name.padEnd(20)} ${c.type}`);
});

console.log('\n📋 reviews.photos:');
const photoCol = db.prepare('PRAGMA table_info(reviews)').all().find(c => c.name === 'photos');
if (photoCol) console.log(`   ${photoCol.name.padEnd(20)} ${photoCol.type}`);

console.log('\n🎉 Миграция Wave 2 завершена!');
console.log('Перезапусти сервер: npm run dev');