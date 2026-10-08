const db = require('./db');
const bcrypt = require('bcryptjs');

console.log('🔧 Инициализация базы данных...');

// ========== ТАБЛИЦЫ ==========

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client', 'manager', 'admin')),
    is_active INTEGER NOT NULL DEFAULT 1,
    twofa_enabled INTEGER NOT NULL DEFAULT 0,
    twofa_secret TEXT,
    twofa_backup_codes TEXT,
    twofa_last_used TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cake', 'coffee', 'other')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    weight TEXT,
    image TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    track_stock INTEGER NOT NULL DEFAULT 1,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    portions TEXT,
    ingredients TEXT,
    storage_info TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    comment TEXT,
    total REAL NOT NULL DEFAULT 0,
    payment TEXT NOT NULL DEFAULT 'cash' CHECK(payment IN ('cash', 'card')),
    status TEXT NOT NULL DEFAULT 'new'
      CHECK(status IN ('new', 'confirmed', 'baking', 'delivering', 'done', 'cancelled')),
    promocode TEXT,
    discount_amount REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'cash_on_delivery',
    payment_id TEXT,
    payment_url TEXT,
    paid_at TEXT,
    delivery_date TEXT,
    delivery_time TEXT,
    delivery_method TEXT NOT NULL DEFAULT 'delivery'
      CHECK(delivery_method IN ('delivery', 'pickup')),
    cake_inscription TEXT,
    inscription_price REAL NOT NULL DEFAULT 0,
    extras TEXT,
    extras_total REAL NOT NULL DEFAULT 0,
    cake_photo TEXT,
    cake_photo_price REAL NOT NULL DEFAULT 0,
    seen_by_admin INTEGER NOT NULL DEFAULT 0,
    seen_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL,
    is_custom INTEGER NOT NULL DEFAULT 0,
    custom_params TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

console.log('✅ Таблицы созданы');

/* ============================================================
   ДОПОЛНИТЕЛЬНЫЕ ТАБЛИЦЫ (v2.0)
   Все таблицы, которые использует server.js
   ============================================================ */

// ✅ ПРОМОКОДЫ
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

// ✅ КОНСТРУКТОР
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

// ✅ ОТЗЫВЫ
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
    photos TEXT,
    is_approved INTEGER NOT NULL DEFAULT 0,
    is_featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );
`);

// ✅ ПАРТНЁРЫ
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

// ✅ ЗАЯВКИ ОПЕРАТОРУ
db.exec(`
  CREATE TABLE IF NOT EXISTS operator_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    message TEXT,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'new'
      CHECK(status IN ('new', 'in_progress', 'answered', 'closed')),
    admin_comment TEXT,
    handled_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    handled_at TEXT,
    FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// ✅ БЕЗОПАСНОСТЬ
db.exec(`
  CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL UNIQUE,
    reason TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    blocked_until TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    ip TEXT,
    user_id INTEGER,
    url TEXT,
    user_agent TEXT,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ✅ ЛОГИ
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    meta TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ✅ УВЕДОМЛЕНИЯ
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    text TEXT,
    link TEXT,
    entity_type TEXT,
    entity_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ✅ ИЗБРАННОЕ
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`);

// ✅ ПОДПИСЧИКИ
db.exec(`
  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    promocode TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    source TEXT DEFAULT 'footer',
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ✅ ДОП. УСЛУГИ
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

// ✅ СЛОТЫ ДОСТАВКИ
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

// ✅ FAQ
db.exec(`
  CREATE TABLE IF NOT EXISTS faq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/* ============================================================
   ИНДЕКСЫ
   ============================================================ */
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_products_stock ON products(track_stock, stock);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, id DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_seen ON orders(seen_by_admin, status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_operator_requests_status ON operator_requests(status, created_at DESC);
`);

console.log('✅ Дополнительные таблицы созданы');

// ========== ДЕМО-ДАННЫЕ ==========

// ========== ДЕМО-ДАННЫЕ (только если БД пустая) ==========
const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

if (usersCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `);
  const hash = (pwd) => bcrypt.hashSync(pwd, 10);

  insertUser.run('Администратор', 'admin@cake.ru', '+7 900 000-00-01', hash('admin123'), 'admin');
  insertUser.run('Менеджер Ольга', 'manager@cake.ru', '+7 900 000-00-02', hash('manager123'), 'manager');
  insertUser.run('Иван Клиентов', 'client@cake.ru', '+7 900 000-00-03', hash('client123'), 'client');
  console.log('✅ Пользователи созданы');
} else {
  console.log(`ℹ️  Пользователи уже есть (${usersCount}) — пропускаем`);
}

// ========== КАТЕГОРИИ И ТОВАРЫ ==========
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;

if (catCount === 0) {
  const insertCategory = db.prepare(`
    INSERT INTO categories (name, slug, type, sort_order) VALUES (?, ?, ?, ?)
  `);

  const catCakes = insertCategory.run('Торты', 'torts', 'cake', 1).lastInsertRowid;
  const catPastry = insertCategory.run('Пирожные', 'pirozhnye', 'cake', 2).lastInsertRowid;
  const catCoffee = insertCategory.run('Кофе', 'kofe', 'coffee', 3).lastInsertRowid;
  const catTea = insertCategory.run('Чай', 'chay', 'coffee', 4).lastInsertRowid;

  console.log('✅ Категории созданы');

  const insertProduct = db.prepare(`
    INSERT INTO products (category_id, name, description, price, weight, image, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertProduct.run(catCakes, 'Наполеон', 'Классический слоёный торт с заварным кремом.', 2500, '1 кг', '/images/napoleon.jpg', 10);
  insertProduct.run(catCakes, 'Красный бархат', 'Нежный бисквит с крем-чизом.', 3200, '1.2 кг', '/images/redvelvet.jpg', 8);
  insertProduct.run(catCakes, 'Медовик', 'Домашний медовый торт со сметанным кремом.', 2200, '1 кг', '/images/medovik.jpg', 12);
  insertProduct.run(catCakes, 'Шоколадный трюфель', 'Насыщенный шоколадный бисквит с ганашем.', 3500, '1.5 кг', '/images/choco.jpg', 6);
  insertProduct.run(catPastry, 'Эклер с ванилью', 'Классический французский эклер.', 150, '80 г', '/images/eclair.jpg', 50);
  insertProduct.run(catPastry, 'Макарон (набор 6 шт)', 'Французские миндальные пирожные.', 900, '120 г', '/images/macaron.jpg', 20);
  insertProduct.run(catCoffee, 'Кофе Ethiopia Yirgacheffe', 'Светлая обжарка. Ноты жасмина и цитруса.', 1100, '250 г', '/images/coffee-ethiopia.jpg', 30);
  insertProduct.run(catCoffee, 'Кофе Brazil Santos', 'Средняя обжарка. Орех и шоколад.', 850, '250 г', '/images/coffee-brazil.jpg', 40);
  insertProduct.run(catCoffee, 'Кофе Colombia Supremo', 'Карамель, орех, лёгкая кислотность.', 950, '250 г', '/images/coffee-colombia.jpg', 35);
  insertProduct.run(catTea, 'Чай Earl Grey', 'Чёрный чай с бергамотом.', 400, '100 г', '/images/tea-earlgrey.jpg', 25);

  console.log('✅ Товары созданы');
} else {
  console.log(`ℹ️  Категории уже есть (${catCount}) — пропускаем`);
}

// ========== НАСТРОЙКИ ==========
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

const settings = {
  site_name: 'Сладкий Дом',
  site_description: 'Торты и кофе на заказ с доставкой',
  phone: '+7 900 000-00-00',
  email: 'hello@cake.ru',
  address: 'г. Москва, ул. Сладкая, 1',
  delivery_price: '300',
  free_delivery_from: '3000'
};

for (const [key, value] of Object.entries(settings)) {
  insertSetting.run(key, value);
}

console.log('✅ Настройки добавлены');
console.log('\n🎉 База данных готова!');
console.log('\n📋 Демо-аккаунты:');
console.log('   admin@cake.ru    / admin123    (админ)');
console.log('   manager@cake.ru  / manager123  (менеджер)');
console.log('   client@cake.ru   / client123   (клиент)');