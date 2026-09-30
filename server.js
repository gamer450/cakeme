require('dotenv').config();

const { signToken, authRequired, authOptional, requireRole } = require('./src/middleware/auth');
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
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
// АДМИН-ПАНЕЛЬ
// ============================================

// GET /api/admin/stats — статистика для дашборда
app.get('/api/admin/stats', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const newOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'new'").get().c;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status != 'cancelled'").get().s;
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = 1').get().c;

    // Продажи по дням (последние 7 дней)
    const salesByDay = db.prepare(`
      SELECT
        date(created_at) as day,
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= date('now', '-7 days') AND status != 'cancelled'
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all();

    // Последние 5 заказов
    const recentOrders = db.prepare(`
      SELECT id, customer_name, phone, total, status, created_at
      FROM orders
      ORDER BY id DESC
      LIMIT 5
    `).all();

    // Топ-5 товаров
    const topProducts = db.prepare(`
      SELECT
        oi.product_name,
        SUM(oi.quantity) as sold,
        SUM(oi.quantity * oi.price) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'cancelled'
      GROUP BY oi.product_name
      ORDER BY sold DESC
      LIMIT 5
    `).all();

    res.json({
      totalOrders,
      newOrders,
      totalRevenue,
      totalUsers,
      totalProducts,
      salesByDay,
      recentOrders,
      topProducts
    });
  } catch (err) {
    console.error('Ошибка статистики:', err);
    res.status(500).json({ error: 'Не удалось загрузить статистику' });
  }
});

// GET /api/admin/orders — все заказы (для админки)
app.get('/api/admin/orders', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const { status, search } = req.query;

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      sql += ' AND (customer_name LIKE ? OR phone LIKE ? OR id = ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, parseInt(search, 10) || 0);
    }

    sql += ' ORDER BY id DESC LIMIT 200';

    const orders = db.prepare(sql).all(...params);

    // Прикрепляем позиции к каждому заказу
    const withItems = orders.map(o => ({
      ...o,
      items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id)
    }));

    res.json(withItems);
  } catch (err) {
    console.error('Ошибка списка заказов:', err);
    res.status(500).json({ error: 'Не удалось загрузить заказы' });
  }
});

// PATCH /api/admin/orders/:id/status — смена статуса заказа
app.patch('/api/admin/orders/:id/status', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['new', 'confirmed', 'baking', 'delivering', 'done', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);

    res.json({ success: true, status });
  } catch (err) {
    console.error('Ошибка смены статуса:', err);
    res.status(500).json({ error: 'Не удалось обновить статус' });
  }
});

// ============================================
// АДМИН: КАТЕГОРИИ
// ============================================

// GET /api/admin/categories — все категории (включая скрытые)
app.get('/api/admin/categories', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM products WHERE category_id = c.id) as products_count
      FROM categories c
      ORDER BY c.sort_order ASC, c.id ASC
    `).all();
    res.json(categories);
  } catch (err) {
    console.error('Ошибка категорий:', err);
    res.status(500).json({ error: 'Не удалось загрузить категории' });
  }
});

// POST /api/admin/categories — создать категорию
app.post('/api/admin/categories', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { name, slug, type, sort_order } = req.body;

    if (!name || !slug || !type) {
      return res.status(400).json({ error: 'Заполните название, slug и тип' });
    }

    if (!['cake', 'coffee', 'other'].includes(type)) {
      return res.status(400).json({ error: 'Недопустимый тип категории' });
    }

    // Проверка уникальности slug
    const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug.trim());
    if (existing) {
      return res.status(409).json({ error: 'Категория с таким slug уже существует' });
    }

    const result = db.prepare(`
      INSERT INTO categories (name, slug, type, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(
      name.trim(),
      slug.trim().toLowerCase(),
      type,
      parseInt(sort_order, 10) || 0
    );

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, category });
  } catch (err) {
    console.error('Ошибка создания категории:', err);
    res.status(500).json({ error: 'Не удалось создать категорию' });
  }
});

// PATCH /api/admin/categories/:id — обновить категорию
app.patch('/api/admin/categories/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { name, slug, type, sort_order, is_active } = req.body;

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    // Проверка slug на уникальность (кроме самого себя)
    if (slug && slug !== category.slug) {
      const existing = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug.trim(), req.params.id);
      if (existing) {
        return res.status(409).json({ error: 'Категория с таким slug уже существует' });
      }
    }

    db.prepare(`
      UPDATE categories
      SET name = ?, slug = ?, type = ?, sort_order = ?, is_active = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : category.name,
      slug !== undefined ? slug.trim().toLowerCase() : category.slug,
      type !== undefined ? type : category.type,
      sort_order !== undefined ? parseInt(sort_order, 10) : category.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : category.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json({ success: true, category: updated });
  } catch (err) {
    console.error('Ошибка обновления категории:', err);
    res.status(500).json({ error: 'Не удалось обновить категорию' });
  }
});

// DELETE /api/admin/categories/:id — удалить категорию
app.delete('/api/admin/categories/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

    // Проверка: есть ли товары в категории
    const productsCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(req.params.id).c;
    if (productsCount > 0) {
      return res.status(400).json({
        error: `В категории ${productsCount} товаров. Сначала перенесите или удалите их.`
      });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления категории:', err);
    res.status(500).json({ error: 'Не удалось удалить категорию' });
  }
});

// ============================================
// АДМИН: ТОВАРЫ
// ============================================

// GET /api/admin/products — все товары (включая скрытые)
app.get('/api/admin/products', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        p.*,
        c.name AS category_name,
        c.type AS category_type
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ORDER BY p.id DESC
    `).all();
    res.json(products);
  } catch (err) {
    console.error('Ошибка товаров:', err);
    res.status(500).json({ error: 'Не удалось загрузить товары' });
  }
});

// POST /api/admin/products — создать товар
app.post('/api/admin/products', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { category_id, name, description, price, weight, image, stock } = req.body;

    if (!category_id || !name || price === undefined) {
      return res.status(400).json({ error: 'Заполните категорию, название и цену' });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Цена должна быть положительным числом' });
    }

    // Проверка категории
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
    if (!category) {
      return res.status(400).json({ error: 'Категория не найдена' });
    }

    const result = db.prepare(`
      INSERT INTO products (category_id, name, description, price, weight, image, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      category_id,
      name.trim(),
      (description || '').trim(),
      parseFloat(price),
      (weight || '').trim(),
      (image || '/images/default.jpg').trim(),
      parseInt(stock, 10) || 0
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Не удалось создать товар' });
  }
});

// PATCH /api/admin/products/:id — обновить товар
app.patch('/api/admin/products/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const {
      category_id, name, description, price, weight, image, stock, is_active
    } = req.body;

    db.prepare(`
      UPDATE products
      SET category_id = ?,
          name = ?,
          description = ?,
          price = ?,
          weight = ?,
          image = ?,
          stock = ?,
          is_active = ?
      WHERE id = ?
    `).run(
      category_id !== undefined ? category_id : product.category_id,
      name !== undefined ? name.trim() : product.name,
      description !== undefined ? description.trim() : product.description,
      price !== undefined ? parseFloat(price) : product.price,
      weight !== undefined ? weight.trim() : product.weight,
      image !== undefined ? image.trim() : product.image,
      stock !== undefined ? parseInt(stock, 10) : product.stock,
      is_active !== undefined ? (is_active ? 1 : 0) : product.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ success: true, product: updated });
  } catch (err) {
    console.error('Ошибка обновления товара:', err);
    res.status(500).json({ error: 'Не удалось обновить товар' });
  }
});

// DELETE /api/admin/products/:id — удалить товар
app.delete('/api/admin/products/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // Проверка: есть ли товар в заказах
    const inOrders = db.prepare('SELECT COUNT(*) as c FROM order_items WHERE product_id = ?').get(req.params.id).c;
    if (inOrders > 0) {
      // Не удаляем, а скрываем
      db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
      return res.json({
        success: true,
        softDeleted: true,
        message: `Товар встречается в ${inOrders} заказах. Мы его скрыли, но не удалили.`
      });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления товара:', err);
    res.status(500).json({ error: 'Не удалось удалить товар' });
  }
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