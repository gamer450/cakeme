/* ============================================================
   МИГРАЦИЯ: таблица partners (партнёрские кофейни)
   Запуск: node src/migrate-partners.js
   ============================================================ */

const db = require('./db');

console.log('🔧 Миграция: таблица partners...');

// 1. Создаём таблицу
db.exec(`
  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city TEXT,
    phone TEXT,
    hours TEXT,
    image TEXT,
    latitude REAL,
    longitude REAL,
    website TEXT,
    instagram TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log('✅ Таблица partners создана');

// 2. Добавляем координаты магазина в настройки (если нет)
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

insertSetting.run('map_latitude', '55.755864');   // Москва, Красная площадь (демо)
insertSetting.run('map_longitude', '37.617698');
insertSetting.run('map_zoom', '15');

console.log('✅ Координаты магазина добавлены в настройки');

// 3. Демо-партнёры (если таблица пустая)
const count = db.prepare('SELECT COUNT(*) as c FROM partners').get().c;

if (count === 0) {
  const insertPartner = db.prepare(`
    INSERT INTO partners (name, description, address, city, phone, hours, image, latitude, longitude, website, instagram, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPartner.run(
    'Кофейня «Утро»',
    'Уютная кофейня в центре города. Готовим кофе на нашей обжарке. Всегда свежие десерты и выпечка.',
    'ул. Тверская, 12',
    'Москва',
    '+7 900 111-22-33',
    'Пн–Вс: 8:00 – 22:00',
    '/uploads/misc/photo-2024-08-17-05-07-52-1790812934348-834406.jpg',
    55.764914,
    37.605556,
    'https://example.com',
    'https://instagram.com/',
    1
  );

  insertPartner.run(
    'Coffee Lab',
    'Лаборатория кофе. Альтернативные методы заваривания, дегустации каждую субботу.',
    'ул. Арбат, 24',
    'Москва',
    '+7 900 222-33-44',
    'Пн–Пт: 9:00 – 21:00, Сб–Вс: 10:00 – 22:00',
    '/uploads/misc/photo-2024-08-17-05-07-52-1790813672246-557285.jpg',
    55.751426,
    37.593261,
    'https://example.com',
    'https://instagram.com/',
    2
  );

  insertPartner.run(
    'Bake & Brew',
    'Пекарня-кофейня. Здесь можно попробовать десерты с нашего производства.',
    'Пресненская наб., 8',
    'Москва',
    '+7 900 333-44-55',
    'Пн–Вс: 7:30 – 23:00',
    '/uploads/misc/photo-2024-08-17-05-07-52-1790813782731-474362.jpg',
    55.749461,
    37.539234,
    'https://example.com',
    'https://instagram.com/',
    3
  );

  insertPartner.run(
    'Roast & Toast',
    'Обжарочный цех и кофейня. Можно посмотреть на процесс обжарки.',
    'Никольская ул., 10',
    'Москва',
    '+7 900 444-55-66',
    'Пн–Вс: 9:00 – 23:00',
    '/uploads/misc/photo-2024-08-17-05-07-52-1790813909886-629335.jpg',
    55.755862,
    37.624682,
    'https://example.com',
    'https://instagram.com/',
    4
  );

  insertPartner.run(
    'Вкусно и точка',
    'Партнёрская кофейня с лучшими десертами по нашему рецепту.',
    'Ленинградский пр., 30',
    'Москва',
    '+7 900 555-66-77',
    'Пн–Вс: 10:00 – 22:00',
    '/uploads/misc/photo-2024-08-17-05-07-52-1790814985185-421696.jpg',
    55.787384,
    37.561624,
    'https://example.com',
    'https://instagram.com/',
    5
  );

  console.log('✅ Добавлено 5 демо-партнёров');
} else {
  console.log(`ℹ️  Партнёров уже: ${count} — пропускаем демо`);
}

console.log('\n🎉 Миграция завершена!');
console.log('Теперь можно открыть админку → Партнёры');