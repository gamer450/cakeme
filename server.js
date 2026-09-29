require('dotenv').config();

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
app.post('/api/orders', (req, res) => {
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
        null, // user_id — пока null, добавим при авторизации
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

app.listen(PORT, () => {
  console.log(`\n🍰 Сервер запущен: http://localhost:${PORT}\n`);
});