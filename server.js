require('dotenv').config();

const { signToken, authRequired, authOptional } = require('./src/middleware/auth');
const bcrypt = require('bcryptjs');
const express = require('express');
const path = require('path');
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: проверка что сервер работает
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API: категории
app.get('/api/categories', (req, res) => {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order'
  ).all();
  res.json(categories);
});

// API: товары
app.get('/api/products', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name, c.type AS category_type
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
    ORDER BY p.id DESC
  `).all();
  res.json(products);
});

// API: один товар по ID
app.get('/api/products/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name AS category_name, c.type AS category_type
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? AND p.is_active = 1
  `).get(req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Товар не найден' });
  }
  res.json(product);
});

// API: настройки сайта
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

// ============================================
// ЗАКАЗЫ
// ============================================

// API: создать заказ
app.post('/api/orders', authOptional, (req, res) => {
  try {
    const { customer_name, phone, email, address, comment, items } = req.body;

    // Валидация
    if (!customer_name || !phone || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    // Считаем сумму на сервере (не доверяем клиенту!)
    let total = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.productId);
      if (!product) {
        return res.status(400).json({ error: `Товар с ID ${item.productId} не найден` });
      }
      const qty = Math.max(1, Math.min(20, parseInt(item.quantity, 10) || 1));
      const subtotal = product.price * qty;
      total += subtotal;

      orderItemsData.push({
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        price: product.price
      });
    }

    // Сохраняем заказ в транзакции
    const createOrder = db.transaction(() => {
      const orderStmt = db.prepare(`
        INSERT INTO orders (user_id, customer_name, phone, email, address, comment, total, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
      `);

      const result = orderStmt.run(
        req.user?.id || null, // user_id — если вошёл, привязываем
        customer_name.trim(),
        phone.trim(),
        (email || '').trim(),
        (address || '').trim(),
        (comment || '').trim(),
        total
      );

      const orderId = result.lastInsertRowid;

      const itemStmt = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of orderItemsData) {
        itemStmt.run(orderId, item.product_id, item.product_name, item.quantity, item.price);
      }

      return orderId;
    });

    const orderId = createOrder();

    res.status(201).json({
      success: true,
      orderId,
      total,
      message: 'Заказ успешно создан!'
    });
  } catch (err) {
    console.error('Ошибка создания заказа:', err);
    res.status(500).json({ error: 'Не удалось создать заказ' });
  }
});

// API: получить заказ по ID
app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.json({ ...order, items });
});

// ============================================
// АВТОРИЗАЦИЯ
// ============================================

// POST /api/auth/register — регистрация
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Валидация
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Заполните имя, email и пароль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    // Проверка: email уже занят?
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
    }

    // Хешируем пароль
    const password_hash = bcrypt.hashSync(password, 10);

    // Создаём
    const result = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, 'client')
    `).run(
      name.trim(),
      email.trim().toLowerCase(),
      (phone || '').trim(),
      password_hash
    );

    const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = signToken(user);

    res.status(201).json({
      success: true,
      token,
      user,
      message: 'Добро пожаловать!'
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Не удалось зарегистрироваться' });
  }
});

// POST /api/auth/login — вход
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Укажите email и пароль' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const { password_hash, ...safeUser } = user;
    const token = signToken(safeUser);

    res.json({
      success: true,
      token,
      user: safeUser,
      message: 'С возвращением!'
    });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Не удалось войти' });
  }
});

// GET /api/auth/me — текущий пользователь
app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/my-orders — мои заказы (для личного кабинета)
app.get('/api/auth/my-orders', authRequired, (req, res) => {
  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ? OR phone = ?
    ORDER BY id DESC
  `).all(req.user.id, req.user.phone || '');

  // Добавляем позиции к каждому заказу
  const withItems = orders.map(order => ({
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
  }));

  res.json(withItems);
});

app.listen(PORT, () => {
  console.log(`\n🍰 Сервер запущен: http://localhost:${PORT}\n`);
});