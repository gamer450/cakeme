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
    status TEXT NOT NULL DEFAULT 'new'
      CHECK(status IN ('new', 'confirmed', 'baking', 'delivering', 'done', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

console.log('✅ Таблицы созданы');

// ========== ДЕМО-ДАННЫЕ ==========

const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (usersCount > 0) {
  console.log('ℹ️  Данные уже есть, пропускаем наполнение');
  process.exit(0);
}

const insertUser = db.prepare(`
  INSERT INTO users (name, email, phone, password_hash, role)
  VALUES (?, ?, ?, ?, ?)
`);
const hash = (pwd) => bcrypt.hashSync(pwd, 10);

insertUser.run('Администратор', 'admin@cake.ru', '+7 900 000-00-01', hash('admin123'), 'admin');
insertUser.run('Менеджер Ольга', 'manager@cake.ru', '+7 900 000-00-02', hash('manager123'), 'manager');
insertUser.run('Иван Клиентов', 'client@cake.ru', '+7 900 000-00-03', hash('client123'), 'client');

console.log('✅ Пользователи созданы');

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

const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

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