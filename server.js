/* ============================================================
   Cake.Me — Главный сервер
   Express + SQLite + JWT + Multer (медиа) + Партнёры
   ============================================================ */

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const db = require('./src/db');
const {
  signToken,
  authRequired,
  authOptional,
  requireRole
} = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   MIDDLEWARE
   ============================================================ */
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   ЗАГРУЗКА ФАЙЛОВ (Multer)
   ============================================================ */
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Создаём папки, если их нет
['products', 'hero', 'banners', 'misc'].forEach(dir => {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif'
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Папка может прийти из query-параметра (надёжнее для multipart)
    const folder = req.query.folder || req.body.folder || req.params.folder || 'misc';
    const allowed = ['products', 'hero', 'banners', 'misc'];
    const target = allowed.includes(folder) ? folder : 'misc';
    cb(null, path.join(UPLOAD_DIR, target));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e6);
    cb(null, `${safeName || 'file'}-${timestamp}-${random}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла. Разрешены: JPG, PNG, WEBP, SVG, GIF, MP4, WEBM'));
    }
  }
});

/* ============================================================
   HEALTHCHECK
   ============================================================ */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/* ============================================================
   ПУБЛИЧНЫЕ API
   ============================================================ */

// Все категории
app.get('/api/categories', (req, res) => {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order'
  ).all();
  res.json(categories);
});

// Все товары (с фильтрами)
app.get('/api/products', (req, res) => {
  const { category_id, search } = req.query;

  let sql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.type AS category_type
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1
  `;
  const params = [];

  if (category_id) {
    sql += ' AND p.category_id = ?';
    params.push(category_id);
  }

  if (search) {
    sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY p.id DESC';

  const products = db.prepare(sql).all(...params);
  res.json(products);
});

// Один товар
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

// Настройки сайта (публичные)
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

// ============================================
// ПАРТНЁРЫ (публичный API)
// ============================================

// Все активные партнёры
app.get('/api/partners', (req, res) => {
  try {
    const partners = db.prepare(`
      SELECT * FROM partners
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `).all();
    res.json(partners);
  } catch (err) {
    console.error('Ошибка партнёров:', err);
    res.status(500).json({ error: 'Не удалось загрузить партнёров' });
  }
});

// Один партнёр
app.get('/api/partners/:id', (req, res) => {
  const partner = db.prepare('SELECT * FROM partners WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!partner) {
    return res.status(404).json({ error: 'Партнёр не найден' });
  }
  res.json(partner);
});

/* ============================================================
   КОНСТРУКТОР ТОРТА
   ============================================================ */

// Публичный: получить все опции, сгруппированные
app.get('/api/constructor/options', (req, res) => {
  try {
    const options = db.prepare(`
      SELECT * FROM constructor_options
      WHERE is_active = 1
      ORDER BY group_key ASC, sort_order ASC
    `).all();

    // Группируем по group_key
    const grouped = {
      shape: [],
      weight: [],
      filling: [],
      decor: []
    };

    options.forEach(opt => {
      if (grouped[opt.group_key]) {
        grouped[opt.group_key].push(opt);
      }
    });

    res.json(grouped);
  } catch (err) {
    console.error('Ошибка опций конструктора:', err);
    res.status(500).json({ error: 'Не удалось загрузить опции' });
  }
});

// Публичный: рассчитать цену собранного торта
app.post('/api/constructor/calculate', (req, res) => {
  try {
    const { shape_id, weight_id, filling_id, decor_ids = [] } = req.body;

    if (!shape_id || !weight_id || !filling_id) {
      return res.status(400).json({ error: 'Укажите форму, вес и начинку' });
    }

    // Получаем опции из БД
    const shape = db.prepare('SELECT * FROM constructor_options WHERE id = ? AND group_key = ?').get(shape_id, 'shape');
    const weight = db.prepare('SELECT * FROM constructor_options WHERE id = ? AND group_key = ?').get(weight_id, 'weight');
    const filling = db.prepare('SELECT * FROM constructor_options WHERE id = ? AND group_key = ?').get(filling_id, 'filling');

    if (!shape || !weight || !filling) {
      return res.status(400).json({ error: 'Опции не найдены' });
    }

    // Вес в кг (парсим из name — "2 кг" → 2)
    const weightKg = parseFloat(weight.name) || 1;

    // Считаем
    let total = 0;
    const breakdown = [];

    // Основа: цена за кг × вес
    const basePrice = weight.price_modifier * weightKg;
    total += basePrice;
    breakdown.push({ name: `Основа ${weight.name}`, price: basePrice });

    // Форма (fixed)
    if (shape.price_modifier > 0) {
      total += shape.price_modifier;
      breakdown.push({ name: `Форма: ${shape.name}`, price: shape.price_modifier });
    }

    // Начинка (fixed)
    if (filling.price_modifier > 0) {
      total += filling.price_modifier;
      breakdown.push({ name: `Начинка: ${filling.name}`, price: filling.price_modifier });
    }

    // Декор (по ids)
    if (Array.isArray(decor_ids) && decor_ids.length > 0) {
      const placeholders = decor_ids.map(() => '?').join(',');
      const decors = db.prepare(
        `SELECT * FROM constructor_options WHERE id IN (${placeholders}) AND group_key = 'decor' AND is_active = 1`
      ).all(...decor_ids);

      decors.forEach(d => {
        total += d.price_modifier;
        breakdown.push({ name: `Декор: ${d.name}`, price: d.price_modifier });
      });
    }

    res.json({
      success: true,
      total,
      breakdown,
      weightKg,
      shape: shape.name,
      filling: filling.name
    });
  } catch (err) {
    console.error('Ошибка расчёта:', err);
    res.status(500).json({ error: 'Не удалось рассчитать цену' });
  }
});

// Админ: все опции (включая скрытые)
app.get('/api/admin/constructor/options', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const options = db.prepare(`
      SELECT * FROM constructor_options
      ORDER BY group_key ASC, sort_order ASC
    `).all();

    const grouped = { shape: [], weight: [], filling: [], decor: [] };
    options.forEach(opt => {
      if (grouped[opt.group_key]) grouped[opt.group_key].push(opt);
    });

    res.json(grouped);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).json({ error: 'Не удалось загрузить опции' });
  }
});

// Админ: создать опцию
app.post('/api/admin/constructor/options', authRequired, requireRole('admin'), (req, res) => {
  try {
    const {
      group_key, name, description, price_modifier, price_type, sort_order, is_active, is_default
    } = req.body;

    if (!group_key || !name) {
      return res.status(400).json({ error: 'Укажите группу и название' });
    }

    if (!['shape', 'weight', 'filling', 'decor'].includes(group_key)) {
      return res.status(400).json({ error: 'Недопустимая группа' });
    }

    const result = db.prepare(`
      INSERT INTO constructor_options
        (group_key, name, description, price_modifier, price_type, sort_order, is_active, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      group_key,
      name.trim(),
      (description || '').trim(),
      parseFloat(price_modifier) || 0,
      price_type || 'fixed',
      parseInt(sort_order, 10) || 0,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      is_default ? 1 : 0
    );

    const opt = db.prepare('SELECT * FROM constructor_options WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, option: opt });
  } catch (err) {
    console.error('Ошибка создания:', err);
    res.status(500).json({ error: 'Не удалось создать опцию' });
  }
});

// Админ: обновить опцию
app.patch('/api/admin/constructor/options/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const opt = db.prepare('SELECT * FROM constructor_options WHERE id = ?').get(req.params.id);
    if (!opt) {
      return res.status(404).json({ error: 'Опция не найдена' });
    }

    const {
      name, description, price_modifier, price_type, sort_order, is_active, is_default
    } = req.body;

    db.prepare(`
      UPDATE constructor_options
      SET name = ?, description = ?, price_modifier = ?, price_type = ?,
          sort_order = ?, is_active = ?, is_default = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : opt.name,
      description !== undefined ? description.trim() : opt.description,
      price_modifier !== undefined ? parseFloat(price_modifier) : opt.price_modifier,
      price_type !== undefined ? price_type : opt.price_type,
      sort_order !== undefined ? parseInt(sort_order, 10) : opt.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : opt.is_active,
      is_default !== undefined ? (is_default ? 1 : 0) : opt.is_default,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM constructor_options WHERE id = ?').get(req.params.id);
    res.json({ success: true, option: updated });
  } catch (err) {
    console.error('Ошибка обновления:', err);
    res.status(500).json({ error: 'Не удалось обновить опцию' });
  }
});

// Админ: удалить опцию
app.delete('/api/admin/constructor/options/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const opt = db.prepare('SELECT * FROM constructor_options WHERE id = ?').get(req.params.id);
    if (!opt) {
      return res.status(404).json({ error: 'Опция не найдена' });
    }

    db.prepare('DELETE FROM constructor_options WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления:', err);
    res.status(500).json({ error: 'Не удалось удалить опцию' });
  }
});

/* ============================================================
   ЗАКАЗЫ (публичные)
   ============================================================ */

// Создать заказ
app.post('/api/orders', authOptional, (req, res) => {
  try {
    const { customer_name, phone, email, address, comment, items } = req.body;

    if (!customer_name || !phone || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

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

    const createOrder = db.transaction(() => {
      const orderStmt = db.prepare(`
        INSERT INTO orders (user_id, customer_name, phone, email, address, comment, total, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
      `);

      const result = orderStmt.run(
        req.user?.id || null,
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

// Получить заказ по ID
app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.json({ ...order, items });
});

/* ============================================================
   АВТОРИЗАЦИЯ
   ============================================================ */

// Регистрация
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Заполните имя, email и пароль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

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

// Вход
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

// Текущий пользователь
app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// Мои заказы
app.get('/api/auth/my-orders', authRequired, (req, res) => {
  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE user_id = ? OR phone = ?
    ORDER BY id DESC
  `).all(req.user.id, req.user.phone || '');

  const withItems = orders.map(order => ({
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
  }));

  res.json(withItems);
});

/* ============================================================
   АДМИН — СТАТИСТИКА
   ============================================================ */
app.get('/api/admin/stats', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const newOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'new'").get().c;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status != 'cancelled'").get().s;
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = 1').get().c;

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

    const recentOrders = db.prepare(`
      SELECT id, customer_name, phone, total, status, created_at
      FROM orders
      ORDER BY id DESC
      LIMIT 5
    `).all();

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

/* ============================================================
   АДМИН — ЗАКАЗЫ
   ============================================================ */

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

/* ============================================================
   АДМИН — КАТЕГОРИИ
   ============================================================ */

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

app.post('/api/admin/categories', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { name, slug, type, sort_order } = req.body;

    if (!name || !slug || !type) {
      return res.status(400).json({ error: 'Заполните название, slug и тип' });
    }

    if (!['cake', 'coffee', 'other'].includes(type)) {
      return res.status(400).json({ error: 'Недопустимый тип категории' });
    }

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

app.patch('/api/admin/categories/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { name, slug, type, sort_order, is_active } = req.body;

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

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

app.delete('/api/admin/categories/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }

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

/* ============================================================
   АДМИН — ТОВАРЫ
   ============================================================ */

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

app.post('/api/admin/products', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { category_id, name, description, price, weight, image, stock } = req.body;

    if (!category_id || !name || price === undefined) {
      return res.status(400).json({ error: 'Заполните категорию, название и цену' });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Цена должна быть положительным числом' });
    }

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
      (image || '').trim(),
      parseInt(stock, 10) || 0
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Не удалось создать товар' });
  }
});

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

app.delete('/api/admin/products/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const inOrders = db.prepare('SELECT COUNT(*) as c FROM order_items WHERE product_id = ?').get(req.params.id).c;
    if (inOrders > 0) {
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

/* ============================================================
   АДМИН — ПОЛЬЗОВАТЕЛИ
   ============================================================ */

app.get('/api/admin/users', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { role, search } = req.query;

    let sql = `
      SELECT
        id, name, email, phone, role, is_active, created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as orders_count
      FROM users
      WHERE 1=1
    `;
    const params = [];

    if (role && role !== 'all') {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (search && search.trim()) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }

    sql += ' ORDER BY id ASC';

    const users = db.prepare(sql).all(...params);
    res.json(users);
  } catch (err) {
    console.error('Ошибка списка пользователей:', err);
    res.status(500).json({ error: 'Не удалось загрузить пользователей' });
  }
});

app.patch('/api/admin/users/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const { name, phone, role, is_active } = req.body;

    if (role && !['client', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }

    if (String(user.id) === String(req.user.id)) {
      if (role && role !== 'admin') {
        return res.status(400).json({ error: 'Нельзя изменить свою роль' });
      }
      if (is_active !== undefined && !is_active) {
        return res.status(400).json({ error: 'Нельзя заблокировать себя' });
      }
    }

    db.prepare(`
      UPDATE users
      SET name = ?, phone = ?, role = ?, is_active = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : user.name,
      phone !== undefined ? phone.trim() : user.phone,
      role !== undefined ? role : user.role,
      is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Ошибка обновления пользователя:', err);
    res.status(500).json({ error: 'Не удалось обновить пользователя' });
  }
});

app.delete('/api/admin/users/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (String(user.id) === String(req.user.id)) {
      return res.status(400).json({ error: 'Нельзя удалить себя' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления пользователя:', err);
    res.status(500).json({ error: 'Не удалось удалить пользователя' });
  }
});

/* ============================================================
   АДМИН — ПАРТНЁРЫ (CRUD)
   ============================================================ */

app.get('/api/admin/partners', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const partners = db.prepare(`
      SELECT * FROM partners
      ORDER BY sort_order ASC, id ASC
    `).all();
    res.json(partners);
  } catch (err) {
    console.error('Ошибка партнёров:', err);
    res.status(500).json({ error: 'Не удалось загрузить партнёров' });
  }
});

app.post('/api/admin/partners', authRequired, requireRole('admin'), (req, res) => {
  try {
    const {
      name, description, address, city, phone, hours,
      image, latitude, longitude, website, instagram, sort_order
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Заполните название и адрес' });
    }

    const result = db.prepare(`
      INSERT INTO partners
        (name, description, address, city, phone, hours, image, latitude, longitude, website, instagram, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      (description || '').trim(),
      address.trim(),
      (city || '').trim(),
      (phone || '').trim(),
      (hours || '').trim(),
      (image || '').trim(),
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      (website || '').trim(),
      (instagram || '').trim(),
      parseInt(sort_order, 10) || 0
    );

    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, partner });
  } catch (err) {
    console.error('Ошибка создания партнёра:', err);
    res.status(500).json({ error: 'Не удалось создать партнёра' });
  }
});

app.patch('/api/admin/partners/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
    if (!partner) {
      return res.status(404).json({ error: 'Партнёр не найден' });
    }

    const {
      name, description, address, city, phone, hours,
      image, latitude, longitude, website, instagram, sort_order, is_active
    } = req.body;

    db.prepare(`
      UPDATE partners
      SET name = ?, description = ?, address = ?, city = ?, phone = ?, hours = ?,
          image = ?, latitude = ?, longitude = ?, website = ?, instagram = ?,
          sort_order = ?, is_active = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : partner.name,
      description !== undefined ? description.trim() : partner.description,
      address !== undefined ? address.trim() : partner.address,
      city !== undefined ? city.trim() : partner.city,
      phone !== undefined ? phone.trim() : partner.phone,
      hours !== undefined ? hours.trim() : partner.hours,
      image !== undefined ? image.trim() : partner.image,
      latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : partner.latitude,
      longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : partner.longitude,
      website !== undefined ? website.trim() : partner.website,
      instagram !== undefined ? instagram.trim() : partner.instagram,
      sort_order !== undefined ? parseInt(sort_order, 10) : partner.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : partner.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
    res.json({ success: true, partner: updated });
  } catch (err) {
    console.error('Ошибка обновления партнёра:', err);
    res.status(500).json({ error: 'Не удалось обновить партнёра' });
  }
});

app.delete('/api/admin/partners/:id', authRequired, requireRole('admin'), (req, res) => {
  try {
    const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
    if (!partner) {
      return res.status(404).json({ error: 'Партнёр не найден' });
    }

    db.prepare('DELETE FROM partners WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления партнёра:', err);
    res.status(500).json({ error: 'Не удалось удалить партнёра' });
  }
});



/* ============================================================
   АДМИН — НАСТРОЙКИ САЙТА
   ============================================================ */

app.get('/api/admin/settings', authRequired, requireRole('admin'), (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    console.error('Ошибка настроек:', err);
    res.status(500).json({ error: 'Не удалось загрузить настройки' });
  }
});

app.patch('/api/admin/settings', authRequired, requireRole('admin'), (req, res) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    const allowedKeys = [
      'site_name', 'site_description',
      'phone', 'email', 'address',
      'instagram', 'telegram',
      'delivery_price', 'free_delivery_from',
      'logo',
      'hero_video',
      'hero_poster',
      'banner_1',
      'banner_2',
      'banner_3',
      // Карта магазина
      'map_latitude',
      'map_longitude',
      'map_zoom'
    ];

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    const save = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (allowedKeys.includes(key)) {
          stmt.run(key, String(value ?? ''));
        }
      }
    });

    save();

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);

    res.json({ success: true, settings });
  } catch (err) {
    console.error('Ошибка сохранения настроек:', err);
    res.status(500).json({ error: 'Не удалось сохранить настройки' });
  }
});

app.post('/api/admin/settings/reset-demo', authRequired, requireRole('admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('orders', 'order_items')").run();

    res.json({ success: true, message: 'Заказы удалены. Товары и пользователи сохранены.' });
  } catch (err) {
    console.error('Ошибка сброса:', err);
    res.status(500).json({ error: 'Не удалось сбросить данные' });
  }
});

/* ============================================================
   АДМИН — МЕДИА-БИБЛИОТЕКА
   ============================================================ */

app.get('/api/admin/media', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const folders = ['products', 'hero', 'banners', 'misc'];
    const files = [];

    folders.forEach(folder => {
      const dir = path.join(UPLOAD_DIR, folder);
      if (!fs.existsSync(dir)) return;

      fs.readdirSync(dir).forEach(filename => {
        const filePath = path.join(dir, filename);
        const stat = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();

        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(ext);
        const isVideo = ['.mp4', '.webm'].includes(ext);

        files.push({
          name: filename,
          folder,
          url: `/uploads/${folder}/${filename}`,
          size: stat.size,
          type: isImage ? 'image' : (isVideo ? 'video' : 'other'),
          modified: stat.mtime
        });
      });
    });

    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    res.json(files);
  } catch (err) {
    console.error('Ошибка загрузки медиа:', err);
    res.status(500).json({ error: 'Не удалось загрузить файлы' });
  }
});

app.post('/api/admin/media/upload',
  authRequired,
  requireRole('admin', 'manager'),
  upload.single('file'),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не получен' });
      }

      // Определяем папку из query или body
      const folder = req.query.folder || req.body.folder || 'misc';
      const url = `/uploads/${folder}/${req.file.filename}`;

      res.status(201).json({
        success: true,
        file: {
          name: req.file.filename,
          url,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (err) {
      console.error('Ошибка загрузки файла:', err);
      res.status(500).json({ error: err.message || 'Не удалось загрузить файл' });
    }
  }
);

app.delete('/api/admin/media', authRequired, requireRole('admin'), (req, res) => {
  try {
    const { folder, filename } = req.query;

    if (!folder || !filename) {
      return res.status(400).json({ error: 'Укажите folder и filename' });
    }

    const allowed = ['products', 'hero', 'banners', 'misc'];
    if (!allowed.includes(folder)) {
      return res.status(400).json({ error: 'Недопустимая папка' });
    }

    const safeName = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, folder, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка удаления файла:', err);
    res.status(500).json({ error: 'Не удалось удалить файл' });
  }
});

/* ============================================================
   START
   ============================================================ */
app.listen(PORT, () => {
  console.log(`\n🍰 Сервер запущен: http://localhost:${PORT}`);
  console.log(`📦 База: data/shop.db`);
  console.log(`🖼️  Медиа: public/uploads/\n`);
});