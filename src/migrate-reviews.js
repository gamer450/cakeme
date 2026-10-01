/* ============================================================
   МИГРАЦИЯ: таблица reviews (отзывы)
   Запуск: node src/migrate-reviews.js
   ============================================================ */

const db = require('./db');

console.log('🔧 Миграция: таблица reviews...');

// ============================================================
// 1. Создаём таблицу
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    order_id INTEGER,
    product_id INTEGER,
    author_name TEXT NOT NULL,
    author_email TEXT,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    text TEXT NOT NULL,
    is_approved INTEGER NOT NULL DEFAULT 0,
    is_featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );
`);

console.log('✅ Таблица reviews создана');

// ============================================================
// 2. Индексы
// ============================================================
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_reviews_approved
  ON reviews(is_approved, created_at DESC);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_reviews_product
  ON reviews(product_id, is_approved);
`);

console.log('✅ Индексы созданы');

// ============================================================
// 3. Демо-отзывы
// ============================================================
const count = db.prepare('SELECT COUNT(*) as c FROM reviews').get().c;

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO reviews
      (author_name, author_email, rating, text, is_approved, is_featured, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const reviews = [
    {
      name: 'Анна Петрова',
      email: 'anna@example.com',
      rating: 5,
      text: 'Торт был просто бомба! Свежий, нежный, все гости в восторге. Особенно понравился крем — не приторный. Обязательно закажем ещё!',
      approved: 1,
      featured: 1,
      offset: '-3 days'
    },
    {
      name: 'Дмитрий Соколов',
      email: 'dmitry@example.com',
      rating: 5,
      text: 'Заказывали Наполеон на юбилей мамы. Привезли точно в срок, торт был свежайший. Спасибо огромное!',
      approved: 1,
      featured: 1,
      offset: '-5 days'
    },
    {
      name: 'Елена Ким',
      email: 'elena@example.com',
      rating: 5,
      text: 'Лучший кофе в городе! Обжарка свежая, аромат потрясающий. Теперь заказываю только здесь.',
      approved: 1,
      featured: 1,
      offset: '-7 days'
    },
    {
      name: 'Игорь Волков',
      email: 'igor@example.com',
      rating: 4,
      text: 'Хорошие пирожные, но хотелось бы больше начинки. В остальном всё вкусно и красиво упаковано.',
      approved: 1,
      featured: 0,
      offset: '-10 days'
    },
    {
      name: 'Мария Иванова',
      email: 'maria@example.com',
      rating: 5,
      text: 'Использовала конструктор торта — собрала торт мечты для дочки! Форма сердечко, шоколадная начинка, свечи. Дочка была в восторге!',
      approved: 1,
      featured: 1,
      offset: '-2 days'
    },
    {
      name: 'Сергей Новиков',
      email: 'sergey@example.com',
      rating: 5,
      text: 'Отличный сервис и вкусные торты. Заказываю уже третий раз — всегда на высоте.',
      approved: 0,
      featured: 0,
      offset: '-1 days'
    },
    {
      name: 'Ольга Смирнова',
      email: 'olga@example.com',
      rating: 4,
      text: 'Понравилось всё, кроме времени доставки — приехали на 30 минут позже. Но торт компенсировал всё!',
      approved: 0,
      featured: 0,
      offset: 'now'
    }
  ];

  for (const r of reviews) {
    insert.run(
      r.name,
      r.email,
      r.rating,
      r.text,
      r.approved,
      r.featured,
      r.offset
    );
  }

  console.log('✅ Добавлено 7 демо-отзывов');
} else {
  console.log(`ℹ️  Отзывов уже: ${count} — пропускаем демо`);
}

console.log('\n🎉 Миграция завершена!');
console.log('Админка → ⭐ Отзывы (модерация)');