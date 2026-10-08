/* ============================================================
   Cake.Me — Главный сервер
   Express + SQLite + JWT + Multer + Helmet + Rate limit + Бэкапы + Отзывы
   v1.1 — принимаем payment в заказах
   ============================================================ */

require('dotenv').config();

// ✅ ФИКС: валидация критичных переменных окружения
const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const MIN_SECRET_LENGTH = 32;

for (const key of REQUIRED_ENV) {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ FATAL: ${key} не задан в .env`);
    console.error('   Сгенерируй: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
  }
  if (value.length < MIN_SECRET_LENGTH) {
    console.error(`❌ FATAL: ${key} слишком короткий (< ${MIN_SECRET_LENGTH} символов)`);
    process.exit(1);
  }
}

if (!process.env.SITE_URL) {
  console.warn('⚠️  SITE_URL не задан — редиректы ЮKassa и ссылки в письмах будут использовать localhost');
}

const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { body } = require('express-validator');

const db = require('./src/db');
const {
  signToken,
  authRequired,
  authOptional,
  requireRole
} = require('./src/middleware/auth');

const security = require('./src/middleware/security');
const rateLimit = require('express-rate-limit');
const logger = require('./src/middleware/logger');
const securityExtra = require('./src/middleware/security-extra');
const backup = require('./src/services/backup');
const notifications = require('./src/services/notifications');
const yookassa = require('./src/services/yookassa');

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   ✅ ФИКС: HTML-escape — защита от XSS в письмах
   ============================================================ */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   ✅ TRUST PROXY — важен для правильной работы rate-limit и IP
   Включай ТОЛЬКО если сайт за nginx / Cloudflare
   ============================================================ */
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

/* ============================================================
   БЕЗОПАСНОСТЬ И MIDDLEWARE
   ============================================================ */

app.use(security.helmetConfig);
app.use(security.corsConfig);
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// ✅ Проверка IP-блокировки (для всех /api/)
app.use('/api/', securityExtra.checkIPBlocked);

if (process.env.RATE_LIMIT_ENABLED !== 'false') {
  app.use('/api/', security.generalLimiter);
}

app.use(express.static(path.join(__dirname, 'public')));

// ✅ Three.js — раздаём локально
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));

// ✅ ФИКС: rate-limit на CSP-report (защита от спама)
const cspReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: '',
  statusCode: 204,
  standardHeaders: false,
  legacyHeaders: false
});

app.post('/api/csp-report',
  cspReportLimiter,
  express.json({ type: ['application/json', 'application/csp-report'], limit: '10kb' }),
  security.cspReportHandler
);
/* ============================================================
   ЗАГРУЗКА ФАЙЛОВ (Multer)
   ============================================================ */
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

['products', 'hero', 'banners', 'misc', 'reviews', 'cakes'].forEach(dir => {
  const fullPath = path.join(UPLOAD_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// ✅ ФИКС: расширенный список MIME-типов
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  // ⚠️ image/svg+xml УБРАН: SVG может содержать <script> → XSS
  // Если нужен SVG-логотип — загружай его вручную в папку banners
  'image/gif',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/heic',
  'image/heif',
  'image/avif'
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',     // .mov (iPhone)
  'video/x-msvideo',     // .avi
  'video/x-matroska'     // .mkv
];

const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ✅ ФИКС: req.query доступен ДО парсинга — только он надёжен
    // req.body.folder — НЕ работает (multer парсит body позже)
    const folder = req.query.folder || 'misc';
    const allowed = ['products', 'hero', 'banners', 'misc', 'reviews', 'cakes'];
    const target = allowed.includes(folder) ? folder : 'misc';

    // ✅ Создаём папку, если её нет
    const fullPath = path.join(UPLOAD_DIR, target);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Только расширение оставляем от оригинала — остальное генерим сами
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e6);
    // Красивое имя: photo-1712345678901-456789.jpg
    cb(null, `photo-${timestamp}-${random}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // ✅ ФИКС: показываем реальный mimetype в ошибке (для отладки)
      console.warn(`❌ Отклонён файл: ${file.originalname} | MIME: ${file.mimetype}`);
      cb(new Error(`Недопустимый тип файла (${file.mimetype}). Разрешены: JPG, PNG, WEBP, SVG, GIF, MP4, WEBM`));
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

app.get('/api/categories', (req, res) => {
  const categories = db.prepare(
    'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order'
  ).all();
  res.json(categories);
});

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

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);

  // ✅ ФИКС: передаём API-ключ Яндекс.Карт на фронтенд
  settings.yandex_maps_api_key = process.env.YANDEX_MAPS_API_KEY || '';

  res.json(settings);
});
/* ============================================================
   ЗАГРУЗКА ФОТО НА ТОРТ (публичный — из checkout)
   Не требует авторизации: клиент на checkout не залогинен
   ============================================================ */
const cakeUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 час
  max: 10,                     // 10 загрузок в час с одного IP
  message: { error: 'Слишком много загрузок. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/upload/cake-photo',
  cakeUploadLimiter,
  (req, res, next) => {
    // ✅ Принудительно указываем папку 'cakes'
    req.query.folder = 'cakes';
    next();
  },
  upload.single('photo'),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не получен' });
      }

      // Только изображения
      if (!req.file.mimetype.startsWith('image/')) {
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(400).json({ error: 'Только изображения (JPG, PNG, WEBP)' });
      }

      // Максимум 10 МБ для фото на торт
      if (req.file.size > 10 * 1024 * 1024) {
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(400).json({ error: 'Файл больше 10 МБ' });
      }

      const url = `/uploads/cakes/${req.file.filename}`;

      logger.logActivity('Загрузка фото на торт', {
        filename: req.file.filename,
        size: req.file.size,
        ip: req.ip
      });

      res.json({
        success: true,
        url,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (err) {
      console.error('Ошибка загрузки фото на торт:', err);
      res.status(500).json({ error: 'Не удалось загрузить фото' });
    }
  }
);

/* ============================================================
   ПАРТНЁРЫ
   ============================================================ */

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

app.get('/api/constructor/options', (req, res) => {
  try {
    const options = db.prepare(`
      SELECT * FROM constructor_options
      WHERE is_active = 1
      ORDER BY group_key ASC, sort_order ASC
    `).all();

    const grouped = { shape: [], weight: [], filling: [], decor: [] };
    options.forEach(opt => {
      if (grouped[opt.group_key]) grouped[opt.group_key].push(opt);
    });

    res.json(grouped);
  } catch (err) {
    console.error('Ошибка опций конструктора:', err);
    res.status(500).json({ error: 'Не удалось загрузить опции' });
  }
});

app.post('/api/constructor/calculate', (req, res) => {
  try {
    const { shape_id, weight_id, filling_id, decor_ids = [] } = req.body;

    if (!shape_id || !weight_id || !filling_id) {
      return res.status(400).json({ error: 'Укажите форму, вес и начинку' });
    }

    const shape = db.prepare('SELECT * FROM constructor_options WHERE id = ? AND group_key = ?').get(shape_id, 'shape');
    const weight = db.prepare('SELECT * FROM constructor_options WHERE id = ? AND group_key = ?').get(weight_id, 'weight');
    const filling = db.prepare('SELECT * FROM constructor_options WHERE id = ? AND group_key = ?').get(filling_id, 'filling');

    if (!shape || !weight || !filling) {
      return res.status(400).json({ error: 'Опции не найдены' });
    }

    // ✅ ФИКС: заменяем запятую на точку для корректного парсинга
    const weightKg = parseFloat(String(weight.name).replace(',', '.')) || 1;

    let total = 0;
    const breakdown = [];

    const basePrice = weight.price_modifier * weightKg;
    total += basePrice;
    breakdown.push({ name: `Основа ${weight.name}`, price: basePrice });

    if (shape.price_modifier > 0) {
      total += shape.price_modifier;
      breakdown.push({ name: `Форма: ${shape.name}`, price: shape.price_modifier });
    }

    if (filling.price_modifier > 0) {
      total += filling.price_modifier;
      breakdown.push({ name: `Начинка: ${filling.name}`, price: filling.price_modifier });
    }

    if (Array.isArray(decor_ids) && decor_ids.length > 0 && decor_ids.length <= 20) {
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

/* ============================================================
   ОТЗЫВЫ (публичный API)
   ============================================================ */

app.get('/api/reviews', (req, res) => {
  try {
    const { featured, limit = 20 } = req.query;

    let sql = `
      SELECT
        r.id, r.author_name, r.rating, r.text, r.photos,
        r.is_featured, r.created_at,
        p.name AS product_name,
        p.image AS product_image
      FROM reviews r
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.is_approved = 1
    `;
    const params = [];

    if (featured === 'true') {
      sql += ' AND r.is_featured = 1';
    }

    sql += ' ORDER BY r.is_featured DESC, r.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10) || 20);

    const reviews = db.prepare(sql).all(...params);
    res.json(reviews);
  } catch (err) {
    console.error('Ошибка отзывов:', err);
    res.status(500).json({ error: 'Не удалось загрузить отзывы' });
  }
});

app.get('/api/reviews/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as avg_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM reviews
      WHERE is_approved = 1
    `).get();

    res.json({
      total: stats.total,
      avgRating: Math.round(stats.avg_rating * 10) / 10,
      distribution: {
        5: stats.five_stars,
        4: stats.four_stars,
        3: stats.three_stars,
        2: stats.two_stars,
        1: stats.one_star
      }
    });
  } catch (err) {
    console.error('Ошибка статистики отзывов:', err);
    res.status(500).json({ error: 'Не удалось загрузить статистику' });
  }
});

app.get('/api/products/:id/reviews', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT id, author_name, rating, text, photos, created_at
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).all(req.params.id);

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as avg_rating
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
    `).get(req.params.id);

    res.json({
      reviews,
      stats: {
        total: stats.total,
        avgRating: Math.round(stats.avg_rating * 10) / 10
      }
    });
  } catch (err) {
    console.error('Ошибка отзывов товара:', err);
    res.status(500).json({ error: 'Не удалось загрузить отзывы' });
  }
});

app.post('/api/reviews',
  security.generalLimiter,
  // ✅ ФИКС: принудительно сохраняем в папку reviews
  (req, res, next) => {
    req.query.folder = 'reviews';
    next();
  },
  upload.array('photos', 3),
  body('author_name').trim().isLength({ min: 2, max: 100 }).escape(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('text').trim().isLength({ min: 10, max: 2000 }).escape(),
  security.handleValidationErrors,
  (req, res) => {
    try {
      const { author_name, author_email, rating, text, order_id, product_id } = req.body;

      let orderUserId = null;
      if (order_id) {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
        if (!order) {
          return res.status(400).json({ error: 'Заказ не найден' });
        }

        // ✅ ФИКС: один отзыв на один заказ
        const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(order_id);
        if (existing) {
          return res.status(409).json({ error: 'Отзыв на этот заказ уже оставлен' });
        }

        orderUserId = order.user_id;
      }

      // ✅ ФИКС: путь формируем от РЕАЛЬНОЙ папки сохранения
      const photos = (req.files || []).map(f => {
      // Извлекаем папку из пути к файлу
      const fullPath = f.path.replace(/\\/g, '/');  // Windows → Unix
      const match = fullPath.match(/\/uploads\/([^/]+)\/[^/]+$/);
      const folder = match ? match[1] : 'reviews';
        return `/uploads/${folder}/${f.filename}`;
      });
      const photosJson = photos.length > 0 ? JSON.stringify(photos) : null;

      const result = db.prepare(`
        INSERT INTO reviews
          (user_id, order_id, product_id, author_name, author_email, rating, text, photos, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        orderUserId,
        order_id || null,
        product_id || null,
        author_name.trim(),
        (author_email || '').trim(),
        parseInt(rating, 10),
        text.trim(),
        photosJson
      );

      logger.logActivity('Новый отзыв (на модерации)', {
        reviewId: result.lastInsertRowid,
        author: author_name,
        rating,
        photos: photos.length
      });

      res.status(201).json({
        success: true,
        message: 'Спасибо за отзыв! Он появится после проверки модератором.'
      });
    } catch (err) {
      console.error('Ошибка создания отзыва:', err);
      res.status(500).json({ error: 'Не удалось сохранить отзыв' });
    }
  }
);

/* ============================================================
   ЗАКАЗЫ (публичные)
   ============================================================ */

app.post('/api/orders',
  authOptional,
  security.orderLimiter,
  securityExtra.honeypot('website_hp'),   // ✅ Honeypot (для заказов тоже)
  security.validateOrder,
  security.handleValidationErrors,
  async (req, res) => {
    try {
      // ✅ ФИКС: принимаем payment (cash | card), по умолчанию cash
      const {
        customer_name, phone, email, address, comment, items, promocode, sms_subscribe,
        delivery_date, delivery_time,
        cake_inscription, inscription_price,
        extras,
        custom_items,
        delivery_method,  // ✅ Новое — delivery | pickup
        cake_photo,         // ✅ URL фото на торт
        cake_photo_price    // ✅ Цена фотопечати
      } = req.body;
const payment = ['card', 'cash'].includes(req.body.payment) ? req.body.payment : 'cash';

      let total = 0;
      const orderItemsData = [];

      // ✅ Обычные товары
      if (Array.isArray(items)) {
        for (const item of items) {
          const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.productId);
          if (!product) {
            return res.status(400).json({ error: `Товар с ID ${item.productId} не найден` });
          }

          const qty = Math.max(1, Math.min(20, parseInt(item.quantity, 10) || 1));

          if (product.track_stock === 1 && product.stock < qty) {
            return res.status(400).json({
              error: `Товар «${product.name}» — недостаточно на складе (доступно: ${product.stock})`
            });
          }

          const subtotal = product.price * qty;
          total += subtotal;

          orderItemsData.push({
            product_id: product.id,
            product_name: product.name,
            quantity: qty,
            price: product.price,
            is_custom: 0,
            custom_params: null
          });
        }
      }

// ✅ Кастомные торты из конструктора — пересчитываем цену на сервере
if (Array.isArray(custom_items) && custom_items.length > 0) {
  for (const custom of custom_items) {
    // Валидация обязательных полей
    if (!custom.name) {
      return res.status(400).json({ error: 'Некорректные данные кастомного торта' });
    }

    const qty = Math.max(1, Math.min(5, parseInt(custom.quantity, 10) || 1));

    // ✅ ФИКС: цену пересчитываем на сервере через конструктор
    const params = custom.params || {};
    let serverPrice = 0;

    // Ищем опции в БД по названию (то, что клиент передал в params)
    const shapeOpt = params.shape
      ? db.prepare(`SELECT * FROM constructor_options WHERE group_key = 'shape' AND name = ? AND is_active = 1`).get(params.shape)
      : null;

    const weightOpt = params.weight
      ? db.prepare(`SELECT * FROM constructor_options WHERE group_key = 'weight' AND name = ? AND is_active = 1`).get(params.weight)
      : null;

    const fillingOpt = params.filling
      ? db.prepare(`SELECT * FROM constructor_options WHERE group_key = 'filling' AND name = ? AND is_active = 1`).get(params.filling)
      : null;

    if (!shapeOpt || !weightOpt || !fillingOpt) {
      return res.status(400).json({
        error: 'Некорректные параметры кастомного торта. Соберите заказ заново в конструкторе.'
      });
    }

    // Считаем базу по весу
    const weightKg = parseFloat(String(weightOpt.name).replace(',', '.')) || 1;
    serverPrice = weightOpt.price_modifier * weightKg;

    // Добавляем форму и начинку
    serverPrice += shapeOpt.price_modifier || 0;
    serverPrice += fillingOpt.price_modifier || 0;

    // Декор — массив названий
    if (params.decor && typeof params.decor === 'string') {
      const decorNames = params.decor.split(',').map(s => s.trim()).filter(Boolean);

      for (const decorName of decorNames) {
        const decorOpt = db.prepare(`
          SELECT * FROM constructor_options
          WHERE group_key = 'decor' AND name = ? AND is_active = 1
        `).get(decorName);

        if (decorOpt) {
          serverPrice += decorOpt.price_modifier || 0;
        }
      }
    }

    // ✅ Минимум 500 ₽, чтобы отсечь откровенный абьюз
    if (serverPrice < 500) {
      return res.status(400).json({ error: 'Минимальная цена торта — 500 ₽' });
    }

    const subtotal = serverPrice * qty;
    total += subtotal;

    // Собираем описание кастомного торта
    const description = [
      params.shape ? `Форма: ${params.shape}` : null,
      params.weight ? `Вес: ${params.weight}` : null,
      params.filling ? `Начинка: ${params.filling}` : null,
      params.decor ? `Декор: ${params.decor}` : null,
      custom.description ? custom.description : null
    ].filter(Boolean).join(' · ');

    orderItemsData.push({
      product_id: null,
      product_name: `🎂 Индивидуальный торт: ${description}`,
      quantity: qty,
      price: serverPrice,   // ✅ Пересчитанная цена
      is_custom: 1,
      custom_params: JSON.stringify(params)
    });
  }
}

      // Проверка, что корзина не пуста
      if (orderItemsData.length === 0) {
        return res.status(400).json({ error: 'Корзина пуста' });
      }

            // ============================================
      // ПРОМОКОД
      // ============================================
      let appliedPromo = null;
      let discountAmount = 0;

      if (promocode && String(promocode).trim()) {
        const cleanCode = String(promocode).trim().toUpperCase();

        const promo = db.prepare(`
          SELECT * FROM promocodes
          WHERE code = ? AND is_active = 1
        `).get(cleanCode);

        if (promo) {
          let valid = true;

          if (promo.valid_from) {
            const from = new Date(promo.valid_from + 'T00:00:00');
            if (new Date() < from) valid = false;
          }
          if (promo.valid_until) {
            const until = new Date(promo.valid_until + 'T23:59:59');
            if (new Date() > until) valid = false;
          }
          if (promo.uses_limit && promo.uses_count >= promo.uses_limit) valid = false;
          if (promo.min_order_sum && total < promo.min_order_sum) valid = false;

          if (valid) {
            let discount = 0;
            if (promo.discount_type === 'percent') {
              discount = total * (promo.discount_value / 100);
              if (promo.max_discount && discount > promo.max_discount) {
                discount = promo.max_discount;
              }
            } else {
              discount = promo.discount_value;
            }

            discountAmount = Math.min(Math.round(discount), total);
            appliedPromo = promo;
          }
        }
      }

const totalAfterDiscount = total - discountAmount;

// ✅ Доп. услуги
let extrasTotal = 0;
let extrasJson = null;

if (Array.isArray(extras) && extras.length > 0) {
  extrasJson = JSON.stringify(extras);
  extras.forEach(e => {
    extrasTotal += (parseFloat(e.price) || 0) * (parseInt(e.quantity, 10) || 1);
  });
}

// ✅ Цены доп. услуг — из БД, не с клиента
const settingsRows = db.prepare('SELECT key, value FROM settings').all();
const settingsMap = {};
settingsRows.forEach(r => settingsMap[r.key] = r.value);

const serverInscriptionPrice = cake_inscription ? 150 : 0;
const serverCakePhotoPrice = cake_photo
  ? (parseInt(settingsMap.cake_photo_price, 10) || 300)
  : 0;

// ✅ Доставка — считаем сами
const deliveryMethodSafe = ['delivery', 'pickup'].includes(delivery_method) ? delivery_method : 'delivery';
const deliveryPriceNum = parseInt(settingsMap.delivery_price, 10) || 300;
const freeFromNum = parseInt(settingsMap.free_delivery_from, 10) || 3000;

const serverDeliveryPrice = deliveryMethodSafe === 'pickup'
  ? 0
  : (totalAfterDiscount >= freeFromNum ? 0 : deliveryPriceNum);

const finalTotal = totalAfterDiscount + extrasTotal + serverInscriptionPrice + serverCakePhotoPrice + serverDeliveryPrice;

      const createOrder = db.transaction(() => {
        // ✅ ФИКС: перепроверка лимита промокода ВНУТРИ транзакции (race condition)
        if (appliedPromo) {
          const fresh = db.prepare('SELECT uses_count, uses_limit FROM promocodes WHERE id = ?').get(appliedPromo.id);
          if (fresh.uses_limit && fresh.uses_count >= fresh.uses_limit) {
            throw new Error('Промокод исчерпан');
          }
        }

        const orderStmt = db.prepare(`
          INSERT INTO orders (
            user_id, customer_name, phone, email, address, comment,
            total, payment, status, promocode, discount_amount, payment_status,
            delivery_date, delivery_time,
            cake_inscription, inscription_price,
            extras, extras_total,
            delivery_method,
            cake_photo, cake_photo_price
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Для оплаты «при получении» — статус «ожидает оплаты курьеру»
        // Для «онлайн» — ждём оплаты через ЮKassa
        const initialPaymentStatus = payment === 'card' ? 'pending' : 'cash_on_delivery';

        const result = orderStmt.run(
          req.user?.id || null,
          customer_name.trim(),
          phone.trim(),
          (email || '').trim(),
          (address || '').trim(),
          (comment || '').trim(),
          finalTotal,
          payment,
          appliedPromo ? appliedPromo.code : null,
          discountAmount,
          initialPaymentStatus,
          (delivery_date || '').trim() || null,
          (delivery_time || '').trim() || null,
          (cake_inscription || '').trim() || null,
          serverInscriptionPrice,   // ← пересчитанная
          extrasJson,
          extrasTotal,
          ['delivery', 'pickup'].includes(delivery_method) ? delivery_method : 'delivery',
          (cake_photo || '').trim() || null,
          serverCakePhotoPrice      // ← пересчитанная
        );

        const orderId = result.lastInsertRowid;

        const itemStmt = db.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, quantity, price, is_custom, custom_params)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of orderItemsData) {
          itemStmt.run(
            orderId,
            item.product_id,
            item.product_name,
            item.quantity,
            item.price,
            item.is_custom || 0,
            item.custom_params || null
          );

          // ✅ Авто-списание остатка — ТОЛЬКО для обычных товаров
          if (item.is_custom !== 1 && item.product_id > 0) {
            db.prepare(`
              UPDATE products
              SET stock = MAX(0, stock - ?)
              WHERE id = ? AND track_stock = 1
            `).run(item.quantity, item.product_id);
          }
        }

        // ✅ Учёт промокода
        if (appliedPromo) {
          db.prepare(`
            UPDATE promocodes
            SET uses_count = uses_count + 1
            WHERE id = ?
          `).run(appliedPromo.id);

          db.prepare(`
            INSERT INTO promocode_uses
              (promocode_id, order_id, user_id, code, discount_amount, ip)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            appliedPromo.id,
            orderId,
            req.user?.id || null,
            appliedPromo.code,
            discountAmount,
            req.ip || null
          );
        }

        return orderId;
      });

      let orderId;
      try {
        orderId = createOrder();
      } catch (err) {
        if (err.message === 'Промокод исчерпан') {
          return res.status(400).json({ error: 'Промокод уже использован' });
        }
        throw err;
      }

      // ✅ Уведомления (email + telegram)
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

      // Асинхронно — не блокируем ответ
      notifications.notifyOrderCreated(order, orderItems).catch(err => {
        logger.logError('Ошибка уведомлений о заказе', { error: err.message });
      });

      // ✅ Для онлайн-оплаты — сразу создаём платёж
      let paymentUrl = null;
      let paymentId = null;

if (payment === 'card') {
  try {
    const payResult = await yookassa.createPayment({
      orderId,
      amount: finalTotal,
      description: `Заказ №${orderId} — Cake.Me`,
      returnUrl: `${process.env.SITE_URL || 'http://localhost:' + PORT}/thanks.html?orderId=${orderId}&paid=1`,
      customerEmail: email,
      customerPhone: phone,
      items: orderItemsData
    });

    if (payResult.success) {
      paymentUrl = payResult.confirmation_url;
      paymentId = payResult.payment_id;

      db.prepare(`
        UPDATE orders
        SET payment_id = ?, payment_url = ?
        WHERE id = ?
      `).run(paymentId, paymentUrl, orderId);
    } else {
      // ✅ ФИКС: если платёж не создался — отменяем заказ
      db.prepare(`UPDATE orders SET status = 'cancelled', payment_status = 'canceled' WHERE id = ?`).run(orderId);

      logger.logError('Платёж ЮKassa не создан, заказ отменён', {
        orderId,
        error: payResult.error
      });

      return res.status(500).json({
        success: false,
        error: 'Платёжная система временно недоступна. Попробуйте оплатить при получении или позвоните нам.'
      });
    }
  } catch (err) {
    db.prepare(`UPDATE orders SET status = 'cancelled', payment_status = 'canceled' WHERE id = ?`).run(orderId);

    console.error('Не удалось создать платёж:', err);
    logger.logError('Ошибка сети при создании платежа, заказ отменён', {
      orderId,
      error: err.message
    });

    return res.status(500).json({
      success: false,
      error: 'Платёжная система временно недоступна. Попробуйте позже.'
    });
  }
}

            // ✅ Если клиент согласился на SMS-рассылку — добавляем в подписчики
      if (sms_subscribe && phone) {
        try {
          const phoneClean = String(phone).replace(/\D/g, '');
          const subscriberKey = `phone_${phoneClean}`;

          // Проверяем, есть ли уже
          const existingSub = db.prepare(`
            SELECT id FROM subscribers WHERE email = ?
          `).get(subscriberKey);

          if (!existingSub) {
            db.prepare(`
              INSERT INTO subscribers (email, name, source, ip)
              VALUES (?, ?, 'order_sms', ?)
            `).run(subscriberKey, customer_name.trim(), req.ip || null);
          }
        } catch (err) {
          console.error('Ошибка добавления SMS-подписчика:', err);
        }
      }

      res.status(201).json({
        success: true,
        orderId,
        total: finalTotal,
        subtotal: total,
        discount: discountAmount,
        promocode: appliedPromo ? appliedPromo.code : null,
        payment,
        payment_url: paymentUrl,
        payment_id: paymentId,
        message: 'Заказ успешно создан!'
      });
    } catch (err) {
      logger.logError('Ошибка создания заказа', { error: err.message });
      res.status(500).json({ error: 'Не удалось создать заказ' });
    }
  }
);

// ✅ ФИКС: заказ виден только владельцу, стаффу или по секретному токену
app.get('/api/orders/:id', authOptional, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  const isStaff = req.user && ['admin', 'manager'].includes(req.user.role);
  const isOwner = req.user && (
    String(order.user_id) === String(req.user.id) ||
    (order.phone && req.user.phone && order.phone === req.user.phone)
  );

  // ✅ ФИКС: гость может получить заказ только со подтверждением (last 4 цифры телефона)
  let isGuestConfirmed = false;
  if (!order.user_id && req.query.phone_tail) {
    const orderTail = String(order.phone || '').replace(/\D/g, '').slice(-4);
    const queryTail = String(req.query.phone_tail).replace(/\D/g, '').slice(-4);
    isGuestConfirmed = orderTail.length === 4 && orderTail === queryTail;
  }

  if (!isOwner && !isStaff && !isGuestConfirmed) {
    return res.status(403).json({ error: 'Нет доступа к этому заказу' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.json({ ...order, items });
});

/* ============================================================
   АВТОРИЗАЦИЯ
   ============================================================ */

app.post('/api/auth/register',
  security.authLimiter,
  security.validateRegister,
  security.handleValidationErrors,
  (req, res) => {
    try {
      const { name, email, phone, password } = req.body;

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

      logger.logActivity('Регистрация пользователя', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        token,
        user,
        message: 'Добро пожаловать!'
      });
    } catch (err) {
      logger.logError('Ошибка регистрации', { error: err.message });
      res.status(500).json({ error: 'Не удалось зарегистрироваться' });
    }
  }
);

app.post('/api/auth/login',
  security.authLimiter,
  security.validateLogin,
  security.handleValidationErrors,
  (req, res) => {
    try {
      const { email, password } = req.body;

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

      if (!user) {
        // ✅ Логируем
        securityExtra.logSecurityEvent('login_failed_unknown_email', req, {
          email
        });

        // ✅ Тоже считаем попытки
        const ip = securityExtra.getClientIP(req);
        const recentFailed = db.prepare(`
          SELECT COUNT(*) as c FROM security_events
          WHERE ip = ? AND event_type LIKE 'login_failed%'
            AND created_at > datetime('now', '-15 minutes')
        `).get(ip).c;

        if (recentFailed >= 10) {
          securityExtra.blockIP(ip, `10 неудачных входов за 15 минут`, 60);
          return res.status(429).json({
            error: 'Слишком много попыток. Попробуйте через час.'
          });
        }

        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      if (!user.is_active) {
        logger.logSecurity('Попытка входа в заблокированный аккаунт', {
          userId: user.id, ip: req.ip
        });
        return res.status(403).json({ error: 'Аккаунт заблокирован' });
      }

      const ok = bcrypt.compareSync(password, user.password_hash);
      if (!ok) {
        // ✅ Логируем в security_events + считаем попытки
        securityExtra.logSecurityEvent('login_failed', req, {
          email: user.email,
          userId: user.id
        });

        // ✅ Автоблокировка после 5 неудач с одного IP
        const ip = securityExtra.getClientIP(req);
        const recentFailed = db.prepare(`
          SELECT COUNT(*) as c FROM security_events
          WHERE ip = ? AND event_type = 'login_failed'
            AND created_at > datetime('now', '-15 minutes')
        `).get(ip).c;

        if (recentFailed >= 5) {
          securityExtra.blockIP(ip, `5 неудачных входов за 15 минут`, 60);
          return res.status(429).json({
            error: 'Слишком много неудачных попыток. Попробуйте через час.'
          });
        }

        return res.status(401).json({ error: 'Неверный email или пароль' });
      }

      // ✅ ПРОВЕРКА 2FA
      if (user.twofa_enabled === 1) {
        // Пароль верный, но нужно проверить 2FA
        // Выдаём временный токен (действует 5 минут)
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

        const tempToken = jwt.sign(
          { id: user.id, purpose: '2fa_pending' },
          JWT_SECRET,
          { expiresIn: '5m' }
        );

        logger.logActivity('Запрос 2FA при входе', {
          userId: user.id, email: user.email, ip: req.ip
        });

        return res.json({
          success: true,
          requires_2fa: true,
          temp_token: tempToken,
          message: 'Введите код из Google Authenticator'
        });
      }

      // Обычный вход без 2FA
      const { password_hash, twofa_secret, twofa_backup_codes, ...safeUser } = user;
      const token = signToken(safeUser);

      logger.logActivity('Успешный вход', {
        userId: user.id, email: user.email, role: user.role, ip: req.ip
      });

      res.json({
        success: true,
        token,
        user: safeUser,
        message: 'С возвращением!'
      });
    } catch (err) {
      logger.logError('Ошибка входа', { error: err.message });
      res.status(500).json({ error: 'Не удалось войти' });
    }
  }
);

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/auth/my-orders', authRequired, (req, res) => {
  // ✅ ФИКС: не искать по пустому телефону
  const userPhone = (req.user.phone || '').trim();

  const orders = userPhone
    ? db.prepare(`
        SELECT * FROM orders
        WHERE user_id = ? OR phone = ?
        ORDER BY id DESC
      `).all(req.user.id, userPhone)
    : db.prepare(`
        SELECT * FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
      `).all(req.user.id);

  const withItems = orders.map(order => ({
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
  }));

  res.json(withItems);
});

/* ============================================================
   ОПЛАТА ЮKASSA
   ============================================================ */

// Создать платёж для заказа
app.post('/api/orders/:id/pay',
  authOptional,
  async (req, res) => {
    try {
      const orderId = req.params.id;

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      if (order.payment !== 'card') {
        return res.status(400).json({ error: 'Этот заказ не оплачивается онлайн' });
      }

      if (order.payment_status === 'succeeded') {
        return res.json({
          success: true,
          already_paid: true,
          payment_url: order.payment_url
        });
      }

      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

      const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
      const returnUrl = `${siteUrl}/thanks.html?orderId=${orderId}&paid=1`;

      const result = await yookassa.createPayment({
        orderId,
        amount: order.total,
        description: `Заказ №${orderId} — Cake.Me`,
        returnUrl,
        customerEmail: order.email,
        customerPhone: order.phone,
        items
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Сохраняем данные платежа
      db.prepare(`
        UPDATE orders
        SET payment_id = ?, payment_url = ?, payment_status = 'pending'
        WHERE id = ?
      `).run(result.payment_id, result.confirmation_url, orderId);

      res.json({
        success: true,
        payment_id: result.payment_id,
        payment_url: result.confirmation_url,
        stub: result.stub || false
      });
    } catch (err) {
      console.error('Ошибка создания платежа:', err);
      res.status(500).json({ error: 'Не удалось создать платёж' });
    }
  }
);

// Проверить статус платежа вручную (для фронтенда)
app.get('/api/orders/:id/payment-status',
  authOptional,
  async (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      // Если уже оплачен — возвращаем сразу
      if (order.payment_status === 'succeeded') {
        return res.json({
          success: true,
          status: 'succeeded',
          paid: true,
          paid_at: order.paid_at
        });
      }

      // Если нет payment_id — ещё не начинали оплату
      if (!order.payment_id) {
        return res.json({
          success: true,
          status: 'pending',
          paid: false
        });
      }

      // Запрашиваем у ЮKassa
      const result = await yookassa.getPaymentStatus(order.payment_id);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Если статус изменился — обновляем БД
      if (result.status === 'succeeded' && order.payment_status !== 'succeeded') {
        db.prepare(`
          UPDATE orders
          SET payment_status = 'succeeded', paid_at = datetime('now')
          WHERE id = ?
        `).run(order.id);

        logger.logActivity('Заказ оплачен через ЮKassa', {
          orderId: order.id,
          paymentId: order.payment_id,
          amount: order.total
        });

        // ✅ ФИКС: убрано повторное notifyOrderCreated — оно уже отправлено при создании заказа.
        // Если нужна отдельная функция notifyOrderPaid — добавь её в notifications.js.
      } else if (result.status === 'canceled' && order.payment_status !== 'canceled') {
        db.prepare(`UPDATE orders SET payment_status = 'canceled' WHERE id = ?`).run(order.id);
      }

      res.json({
        success: true,
        status: result.status,
        paid: result.status === 'succeeded'
      });
    } catch (err) {
      console.error('Ошибка проверки статуса:', err);
      res.status(500).json({ error: 'Не удалось проверить статус' });
    }
  }
);

// ============================================================
// ВЕБХУК от ЮKassa
// Документация: https://yookassa.ru/developers/using-api/webhooks
// ============================================================
app.post('/api/yookassa/webhook',
  express.json(),
  async (req, res) => {
    try {
      const event = req.body;

      // ✅ ФИКС: берём реальный IP из socket, а не из заголовков
      const clientIP = (req.socket.remoteAddress || '').replace('::ffff:', '');
      const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1';

      console.log('💳 YOOKASSA WEBHOOK:', event.event, '| IP:', clientIP);

      if (!isLocalhost && !yookassa.isAllowedWebhookIP(clientIP)) {
        logger.logSecurity('Подозрительный вебхук ЮKassa (неверный IP)', {
          ip: clientIP,
          event: event.event
        });
        return res.status(403).send('Forbidden');
      }

      // Обрабатываем событие
      const paymentObject = event.object;

      if (!paymentObject || !paymentObject.metadata?.order_id) {
        console.warn('💳 Вебхук без order_id');
        return res.status(200).send('OK');
      }

      const orderId = paymentObject.metadata.order_id;

      if (event.event === 'payment.succeeded') {
        // ✅ ФИКС: проверяем статус через API (не доверяем вебхуку)
        const verify = await yookassa.getPaymentStatus(paymentObject.id);

        if (!verify.success || verify.status !== 'succeeded') {
          logger.logSecurity('Подозрение: вебхук утверждает succeeded, но API — нет', {
            orderId,
            paymentId: paymentObject.id,
            apiStatus: verify.status
          });
          return res.status(200).send('OK');
        }

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

        // ✅ ФИКС: идемпотентность — обновляем только если статус ещё не succeeded
        if (order && order.payment_status !== 'succeeded') {
          db.prepare(`
            UPDATE orders
            SET payment_status = 'succeeded', paid_at = datetime('now')
            WHERE id = ?
          `).run(orderId);

          logger.logActivity('Вебхук: заказ оплачен', {
            orderId,
            paymentId: paymentObject.id,
            amount: paymentObject.amount?.value
          });

          // ✅ ФИКС: НЕ отправляем повторно — уведомления уже ушли при создании заказа.
          // Если нужно отдельное уведомление об оплате — добавь функцию notifyOrderPaid.
        }
      } else if (event.event === 'payment.canceled') {
        db.prepare(`
          UPDATE orders
          SET payment_status = 'canceled'
          WHERE id = ?
        `).run(orderId);

        logger.logActivity('Вебхук: оплата отменена', {
          orderId,
          paymentId: paymentObject.id
        });
      } else if (event.event === 'refund.succeeded') {
        logger.logActivity('Вебхук: возврат выполнен', {
          orderId,
          refundId: paymentObject.id
        });
      }

      res.status(200).send('OK');
    } catch (err) {
      console.error('Ошибка вебхука:', err);
      res.status(200).send('OK'); // Всегда 200, чтобы ЮKassa не повторяла
    }
  }
);

// Возврат по заказу (для админки)
app.post('/api/admin/orders/:id/refund',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Возврат по заказу'),
  async (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      if (order.payment_status !== 'succeeded') {
        return res.status(400).json({ error: 'Заказ не был оплачен' });
      }

      if (!order.payment_id) {
        return res.status(400).json({ error: 'Нет ID платежа' });
      }

      const result = await yookassa.createRefund(
        order.payment_id,
        order.total,
        `Возврат по заказу №${order.id}`
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      db.prepare(`UPDATE orders SET payment_status = 'refunded' WHERE id = ?`).run(order.id);

      res.json({ success: true, refund: result });
    } catch (err) {
      console.error('Ошибка возврата:', err);
      res.status(500).json({ error: 'Не удалось сделать возврат' });
    }
  }
);


/* ============================================================
   2FA — Двухфакторная аутентификация
   ============================================================ */
const twofa = require('./src/services/twofa');

// ============================================
// 1. Начать настройку — сгенерировать секрет
// ============================================
app.post('/api/auth/2fa/setup',
  authRequired,
  (req, res) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (user.twofa_enabled) {
        return res.status(400).json({ error: '2FA уже включена' });
      }

      // Генерируем секрет и QR
      twofa.generateSecret(user).then(({ secret, qr_code, otpauth_url }) => {
        // Сохраняем секрет ВРЕМЕННО (без включения)
        db.prepare('UPDATE users SET twofa_secret = ? WHERE id = ?').run(secret, user.id);

        res.json({
          success: true,
          secret,
          qr_code,
          otpauth_url,
          message: 'Отсканируйте QR-код в приложении Google Authenticator или Authy'
        });
      }).catch(err => {
        console.error('Ошибка генерации 2FA:', err);
        res.status(500).json({ error: 'Не удалось сгенерировать секрет' });
      });
    } catch (err) {
      console.error('Ошибка setup 2FA:', err);
      res.status(500).json({ error: 'Ошибка настройки 2FA' });
    }
  }
);

// ============================================
// 2. Подтвердить код и включить 2FA
// ============================================
app.post('/api/auth/2fa/enable',
  authRequired,
  (req, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Укажите код из приложения' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (user.twofa_enabled) {
        return res.status(400).json({ error: '2FA уже включена' });
      }

      if (!user.twofa_secret) {
        return res.status(400).json({ error: 'Сначала сгенерируйте секрет (setup)' });
      }

      // Проверяем код
      const valid = twofa.verifyToken(user.twofa_secret, code);
      if (!valid) {
        return res.status(400).json({ error: 'Неверный код. Проверьте время на телефоне' });
      }

      // Генерируем резервные коды
      const backupCodes = twofa.generateBackupCodes(10);

      // Включаем 2FA
      db.prepare(`
        UPDATE users
        SET twofa_enabled = 1, twofa_backup_codes = ?
        WHERE id = ?
      `).run(JSON.stringify(backupCodes), user.id);

      logger.logActivity('2FA включена', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.json({
        success: true,
        backup_codes: backupCodes,
        message: '2FA успешно включена! Сохраните резервные коды в безопасном месте'
      });
    } catch (err) {
      console.error('Ошибка enable 2FA:', err);
      res.status(500).json({ error: 'Не удалось включить 2FA' });
    }
  }
);

// ============================================
// 3. Выключить 2FA
// ============================================
app.post('/api/auth/2fa/disable',
  authRequired,
  (req, res) => {
    try {
      const { code, password } = req.body;

      if (!code || !password) {
        return res.status(400).json({ error: 'Укажите пароль и код' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (!user.twofa_enabled) {
        return res.status(400).json({ error: '2FA не включена' });
      }

      // Проверяем пароль
      // Проверяем пароль (bcrypt уже импортирован в начале файла)
      if (!bcrypt.compareSync(password, user.password_hash)) {
        logger.logSecurity('Попытка выключить 2FA с неверным паролем', {
          userId: user.id, ip: req.ip
        });
        return res.status(401).json({ error: 'Неверный пароль' });
      }

      // Проверяем код (TOTP или резервный)
      const validTotp = twofa.verifyToken(user.twofa_secret, code);
      const backupResult = twofa.verifyBackupCode(user.twofa_backup_codes, code);

      if (!validTotp && !backupResult.valid) {
        return res.status(400).json({ error: 'Неверный код' });
      }

      // Выключаем 2FA
      db.prepare(`
        UPDATE users
        SET twofa_enabled = 0, twofa_secret = NULL, twofa_backup_codes = NULL
        WHERE id = ?
      `).run(user.id);

      logger.logActivity('2FA выключена', {
        userId: user.id,
        email: user.email,
        method: validTotp ? 'totp' : 'backup',
        ip: req.ip
      });

      res.json({ success: true, message: '2FA отключена' });
    } catch (err) {
      console.error('Ошибка disable 2FA:', err);
      res.status(500).json({ error: 'Не удалось выключить 2FA' });
    }
  }
);

// ============================================
// 4. Проверка статуса 2FA
// ============================================
app.get('/api/auth/2fa/status',
  authRequired,
  (req, res) => {
    try {
      const user = db.prepare(`
        SELECT twofa_enabled, twofa_backup_codes, twofa_last_used
        FROM users WHERE id = ?
      `).get(req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      let backupCount = 0;
      if (user.twofa_backup_codes) {
        try {
          backupCount = JSON.parse(user.twofa_backup_codes).length;
        } catch {}
      }

      res.json({
        enabled: user.twofa_enabled === 1,
        backup_codes_remaining: backupCount,
        last_used: user.twofa_last_used
      });
    } catch (err) {
      console.error('Ошибка status 2FA:', err);
      res.status(500).json({ error: 'Не удалось получить статус' });
    }
  }
);

// ============================================
// 5. Верификация 2FA при входе
// ============================================
app.post('/api/auth/2fa/verify',
  security.authLimiter,
  (req, res) => {
    try {
      const { temp_token, code, use_backup } = req.body;

      if (!temp_token || !code) {
        return res.status(400).json({ error: 'Укажите код' });
      }

      // Проверяем временный токен
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

      let payload;
      try {
        payload = jwt.verify(temp_token, JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Сессия истекла. Войдите заново' });
      }

      if (payload.purpose !== '2fa_pending') {
        return res.status(400).json({ error: 'Неверный токен' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Пользователь недоступен' });
      }

      let verified = false;
      let usedBackup = false;

      if (use_backup) {
        // Проверяем резервный код
        const result = twofa.verifyBackupCode(user.twofa_backup_codes, code);
        if (result.valid) {
          verified = true;
          usedBackup = true;

          // Обновляем список резервных кодов
          db.prepare('UPDATE users SET twofa_backup_codes = ? WHERE id = ?')
            .run(JSON.stringify(result.remaining), user.id);
        }
      } else {
        // Проверяем TOTP
        verified = twofa.verifyToken(user.twofa_secret, code);
      }

      if (!verified) {
        logger.logSecurity('Неудачная попытка 2FA', {
          userId: user.id, email: user.email, ip: req.ip
        });
        return res.status(401).json({ error: 'Неверный код' });
      }

      // Обновляем время
      db.prepare("UPDATE users SET twofa_last_used = datetime('now') WHERE id = ?").run(user.id);

      // Выдаём полный токен
      const { password_hash, twofa_secret, twofa_backup_codes, ...safeUser } = user;
      const token = signToken(safeUser);

      logger.logActivity('Успешный вход с 2FA', {
        userId: user.id,
        email: user.email,
        method: usedBackup ? 'backup_code' : 'totp',
        ip: req.ip
      });

      res.json({
        success: true,
        token,
        user: safeUser,
        used_backup: usedBackup,
        message: usedBackup ? 'Вход выполнен (резервный код)' : 'Вход выполнен'
      });
    } catch (err) {
      console.error('Ошибка verify 2FA:', err);
      res.status(500).json({ error: 'Не удалось проверить код' });
    }
  }
);

// ============================================
// 6. Перегенерировать резервные коды
// ============================================
app.post('/api/auth/2fa/regenerate-backup',
  authRequired,
  (req, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Укажите код из приложения' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      if (!user || !user.twofa_enabled) {
        return res.status(400).json({ error: '2FA не включена' });
      }

      const valid = twofa.verifyToken(user.twofa_secret, code);
      if (!valid) {
        return res.status(400).json({ error: 'Неверный код' });
      }

      const backupCodes = twofa.generateBackupCodes(10);
      db.prepare('UPDATE users SET twofa_backup_codes = ? WHERE id = ?')
        .run(JSON.stringify(backupCodes), user.id);

      logger.logActivity('Перегенерированы резервные коды 2FA', {
        userId: user.id, ip: req.ip
      });

      res.json({ success: true, backup_codes: backupCodes });
    } catch (err) {
      console.error('Ошибка regen 2FA:', err);
      res.status(500).json({ error: 'Не удалось перегенерировать коды' });
    }
  }
);

/* ============================================================
   УВЕДОМЛЕНИЯ АДМИНУ — новые заказы
   ============================================================ */

// Получить счётчик непрочитанных + список новых
app.get('/api/admin/notifications/count',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const newOrders = db.prepare(`
        SELECT id, customer_name, total, created_at
        FROM orders
        WHERE seen_by_admin = 0 AND status = 'new'
        ORDER BY id DESC
        LIMIT 10
      `).all();

      const total = db.prepare(`
        SELECT COUNT(*) as c FROM orders
        WHERE seen_by_admin = 0 AND status = 'new'
      `).get().c;

      // Все новые без ограничения
      const newOrderIds = db.prepare(`
        SELECT id FROM orders WHERE seen_by_admin = 0 AND status = 'new'
      `).all().map(o => o.id);

      res.json({
        count: total,
        orders: newOrders,
        ids: newOrderIds
      });
    } catch (err) {
      console.error('Ошибка счётчика уведомлений:', err);
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

// Пометить заказ как просмотренный
app.patch('/api/admin/orders/:id/seen',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      db.prepare(`
        UPDATE orders
        SET seen_by_admin = 1, seen_at = datetime('now')
        WHERE id = ?
      `).run(req.params.id);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

// Пометить ВСЕ как просмотренные
// ✅ ФИКС: получаем список ID явно (защита от race condition)
app.patch('/api/admin/orders/mark-all-seen',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const ids = db.prepare(`SELECT id FROM orders WHERE seen_by_admin = 0`).all().map(o => o.id);

      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`
          UPDATE orders
          SET seen_by_admin = 1, seen_at = datetime('now')
          WHERE id IN (${placeholders})
        `).run(...ids);
      }

      res.json({ success: true, marked: ids.length });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);


/* ============================================================
   АДМИН — СТАТИСТИКА
   ============================================================ */
/* ============================================================
   АДМИН — СТАТИСТИКА (расширенная)
   ============================================================ */
app.get('/api/admin/stats', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    // ============================================
    // Общие цифры
    // ============================================
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const newOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'new'").get().c;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status != 'cancelled'").get().s;
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = 1').get().c;

    // ============================================
    // Тренды: текущая неделя vs прошлая
    // ============================================
    const currentWeek = db.prepare(`
      SELECT
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= date('now', '-7 days')
        AND status != 'cancelled'
    `).get();

    const prevWeek = db.prepare(`
      SELECT
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= date('now', '-14 days')
        AND created_at < date('now', '-7 days')
        AND status != 'cancelled'
    `).get();

    const newThisWeek = db.prepare(`
      SELECT COUNT(*) as c FROM users
      WHERE created_at >= date('now', '-7 days')
    `).get().c;

    const trend = (current, prev) => {
      if (!prev || prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    };

    // ============================================
    // Средний чек
    // ============================================
    const avgCheckRow = db.prepare(`
      SELECT COALESCE(AVG(total), 0) as avg
      FROM orders
      WHERE status != 'cancelled'
    `).get();
    const avgCheck = Math.round(avgCheckRow.avg);

    // ============================================
    // Продажи за 30 дней (для графика)
    // ============================================
    const salesByDay = db.prepare(`
      SELECT
        date(created_at) as day,
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= date('now', '-30 days')
        AND status != 'cancelled'
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all();

    // ============================================
    // Заказы по статусам
    // ============================================
    const ordersByStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `).all();

    // ============================================
    // Продажи по категориям
    // ============================================
    const salesByCategory = db.prepare(`
      SELECT
        c.name as category,
        c.type as type,
        COUNT(oi.id) as count,
        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE o.status != 'cancelled'
      GROUP BY c.id
      ORDER BY revenue DESC
    `).all();

    // ============================================
    // Топ товаров
    // ============================================
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

    // ============================================
    // Товары с низким остатком (требуют пополнения)
    // ============================================
    const lowStockProducts = db.prepare(`
      SELECT id, name, stock, low_stock_threshold
      FROM products
      WHERE is_active = 1
        AND track_stock = 1
        AND stock <= low_stock_threshold
      ORDER BY stock ASC
      LIMIT 5
    `).all();

    // ============================================
    // Последние заказы
    // ============================================
    const recentOrders = db.prepare(`
      SELECT id, customer_name, phone, total, status, payment, created_at
      FROM orders
      ORDER BY id DESC
      LIMIT 7
    `).all();

    // ============================================
    // Отзывы на модерации
    // ============================================
    const pendingReviews = db.prepare(`
      SELECT COUNT(*) as c FROM reviews WHERE is_approved = 0
    `).get().c;

    res.json({
      // Общие
      totalOrders,
      newOrders,
      totalRevenue,
      totalUsers,
      totalProducts,

      // Тренды (в %)
      trends: {
        orders: trend(currentWeek.orders, prevWeek.orders),
        revenue: trend(currentWeek.revenue, prevWeek.revenue),
        newUsers: trend(newThisWeek, 0)
      },

      // Средний чек
      avgCheck,

      // Массивы для графиков
      salesByDay,          // 30 дней
      ordersByStatus,
      salesByCategory,
      topProducts,
      lowStockProducts,
      recentOrders,
      pendingReviews
    });
  } catch (err) {
    console.error('Ошибка статистики:', err);
    res.status(500).json({ error: 'Не удалось загрузить статистику' });
  }
});

/* ============================================================
   АНАЛИТИКА — конфиг для фронтенда
   ============================================================ */
app.get('/api/analytics/config', (req, res) => {
  res.json({
    ym: process.env.YM_COUNTER_ID || null,
    ga: process.env.GA_MEASUREMENT_ID || null
  });
});

/* ============================================================
   ПОДПИСКА НА EMAIL — «-10% за подписку»
   ============================================================ */
app.post('/api/subscribe',
  security.generalLimiter,
  securityExtra.honeypot('website_hp'),   // ✅ Honeypot
  async (req, res) => {
    try {
      const { email, name, source } = req.body;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Укажите корректный email' });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Проверка на существование
      const existing = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(cleanEmail);

      if (existing) {
        return res.json({
          success: true,
          already: true,
          promocode: existing.promocode,
          message: 'Вы уже подписаны. Ваш промокод — ' + existing.promocode
        });
      }

      // Генерируем промокод WELCOME + 4 цифры
      let promocode;
      let attempts = 0;
      do {
        const num = Math.floor(1000 + Math.random() * 9000);
        promocode = `WELCOME${num}`;
        attempts++;
      } while (db.prepare('SELECT id FROM promocodes WHERE code = ?').get(promocode) && attempts < 10);

      // Создаём промокод на -10%
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30); // 30 дней

      // ✅ ФИКС: retry до 5 раз, если промокод занят
      let promocodeCreated = false;
      for (let i = 0; i < 5 && !promocodeCreated; i++) {
        try {
          db.prepare(`
            INSERT INTO promocodes
              (code, description, discount_type, discount_value, max_discount, uses_limit, valid_until, is_active)
            VALUES (?, ?, 'percent', 10, 1000, 1, ?, 1)
          `).run(
            promocode,
            `Промокод за подписку — ${cleanEmail}`,
            validUntil.toISOString().slice(0, 10)
          );
          promocodeCreated = true;
        } catch (e) {
          if (e.message.includes('UNIQUE')) {
            // Промокод занят — генерируем новый
            const num = Math.floor(1000 + Math.random() * 9000);
            promocode = `WELCOME${num}`;
          } else {
            throw e;
          }
        }
      }

      if (!promocodeCreated) {
        return res.status(500).json({ error: 'Не удалось создать промокод. Попробуйте ещё раз.' });
      }

      // Записываем подписчика
      const result = db.prepare(`
        INSERT INTO subscribers (email, name, promocode, source, ip)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        cleanEmail,
        (name || '').trim(),
        promocode,
        source || 'footer',
        req.ip
      );

      logger.logActivity('Новая подписка', {
        email: cleanEmail,
        promocode,
        source: source || 'footer',
        ip: req.ip
      });

      // Письмо с промокодом (асинхронно)
      notifications.sendEmail(
        cleanEmail,
        '🍰 Ваш промокод на -10% — Cake.Me',
        `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"><style>
            body { font-family: -apple-system, sans-serif; background: #0E0A08; padding: 40px 20px; margin: 0; color: #F5EDE4; }
            .container { max-width: 560px; margin: 0 auto; background: #1A1310; border-radius: 16px; overflow: hidden; border: 1px solid rgba(201,169,97,0.2); }
            .header { background: linear-gradient(135deg, #E8A87C 0%, #C87A4D 100%); padding: 32px; text-align: center; }
            .header h1 { margin: 0; color: #16100C; }
            .body { padding: 32px; text-align: center; }
            .body p { color: #A89888; line-height: 1.6; }
            .promo { font-family: monospace; font-size: 2rem; font-weight: 700; color: #E5C57A; letter-spacing: 0.15em; padding: 24px; background: #241A15; border-radius: 12px; margin: 24px 0; border: 2px dashed rgba(201,169,97,0.4); }
            .footer { padding: 24px; text-align: center; color: #6B5D52; font-size: 12px; }
          </style></head>
          <body>
            <div class="container">
              <div class="header"><h1>🍰 Добро пожаловать!</h1></div>
              <div class="body">
                <p>Спасибо за подписку на новости Cake.Me!</p>
                <p>Ваш персональный промокод на скидку <strong>10%</strong>:</p>
                <div class="promo">${promocode}</div>
                <p>Действует <strong>30 дней</strong> с момента получения. Применяется один раз на любой заказ от 500 ₽. Максимальная скидка — 1000 ₽.</p>
              </div>
              <div class="footer">© 2026 Cake.Me — торты и кофе на заказ</div>
            </div>
          </body>
          </html>
        `
      ).catch(err => console.error('Ошибка отправки письма подписчику:', err));

      res.status(201).json({
        success: true,
        promocode,
        message: `Промокод ${promocode} отправлен на ${cleanEmail}`
      });
    } catch (err) {
      console.error('Ошибка подписки:', err);
      res.status(500).json({ error: 'Не удалось оформить подписку' });
    }
  }
);

// Админ — список подписчиков
app.get('/api/admin/subscribers',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const subs = db.prepare(`
        SELECT * FROM subscribers
        ORDER BY id DESC
      `).all();
      res.json(subs);
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

/* ============================================================
   ДОП. УСЛУГИ (свечи, открытки и т.д.)
   ============================================================ */
app.get('/api/extras', (req, res) => {
  try {
    const extras = db.prepare(`
      SELECT id, name, description, price, icon
      FROM extras
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `).all();
    res.json(extras);
  } catch (err) {
    console.error('Ошибка доп. услуг:', err);
    res.status(500).json({ error: 'Не удалось загрузить доп. услуги' });
  }
});

/* ============================================================
   АДМИН — ДОП. УСЛУГИ
   ============================================================ */
app.get('/api/admin/extras',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const extras = db.prepare(`SELECT * FROM extras ORDER BY sort_order ASC, id ASC`).all();
      res.json(extras);
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

app.post('/api/admin/extras',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создание доп. услуги'),
  (req, res) => {
    try {
      const { name, description, price, icon, sort_order } = req.body;

      if (!name || price === undefined) {
        return res.status(400).json({ error: 'Укажите название и цену' });
      }

      const result = db.prepare(`
        INSERT INTO extras (name, description, price, icon, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        (description || '').trim(),
        parseFloat(price) || 0,
        (icon || '').trim(),
        parseInt(sort_order, 10) || 0
      );

      const item = db.prepare('SELECT * FROM extras WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ success: true, extra: item });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

app.patch('/api/admin/extras/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Обновление доп. услуги'),
  (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM extras WHERE id = ?').get(req.params.id);
      if (!item) return res.status(404).json({ error: 'Не найдено' });

      const { name, description, price, icon, sort_order, is_active } = req.body;

      db.prepare(`
        UPDATE extras
        SET name = ?, description = ?, price = ?, icon = ?, sort_order = ?, is_active = ?
        WHERE id = ?
      `).run(
        name !== undefined ? name.trim() : item.name,
        description !== undefined ? description.trim() : item.description,
        price !== undefined ? parseFloat(price) : item.price,
        icon !== undefined ? (icon || '').trim() : item.icon,
        sort_order !== undefined ? parseInt(sort_order, 10) : item.sort_order,
        is_active !== undefined ? (is_active ? 1 : 0) : item.is_active,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM extras WHERE id = ?').get(req.params.id);
      res.json({ success: true, extra: updated });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

app.delete('/api/admin/extras/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление доп. услуги'),
  (req, res) => {
    try {
      db.prepare('DELETE FROM extras WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);


/* ============================================================
   СЛОТЫ ДОСТАВКИ
   ============================================================ */
app.get('/api/delivery-slots', (req, res) => {
  try {
    const slots = db.prepare(`
      SELECT id, time_from, time_to
      FROM delivery_slots
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `).all();
    res.json(slots);
  } catch (err) {
    console.error('Ошибка слотов:', err);
    res.status(500).json({ error: 'Не удалось загрузить слоты' });
  }
});

/* ============================================================
   АДМИН — СЛОТЫ ДОСТАВКИ
   ============================================================ */
app.get('/api/admin/delivery-slots',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const slots = db.prepare(`
        SELECT * FROM delivery_slots
        ORDER BY sort_order ASC, id ASC
      `).all();
      res.json(slots);
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

app.post('/api/admin/delivery-slots',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создание слота доставки'),
  (req, res) => {
    try {
      const { time_from, time_to, sort_order } = req.body;

      if (!time_from || !time_to) {
        return res.status(400).json({ error: 'Укажите время с и до' });
      }

      const result = db.prepare(`
        INSERT INTO delivery_slots (time_from, time_to, sort_order)
        VALUES (?, ?, ?)
      `).run(
        time_from.trim(),
        time_to.trim(),
        parseInt(sort_order, 10) || 0
      );

      const slot = db.prepare('SELECT * FROM delivery_slots WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ success: true, slot });
    } catch (err) {
      res.status(500).json({ error: 'Не удалось создать слот' });
    }
  }
);

app.patch('/api/admin/delivery-slots/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Обновление слота'),
  (req, res) => {
    try {
      const slot = db.prepare('SELECT * FROM delivery_slots WHERE id = ?').get(req.params.id);
      if (!slot) return res.status(404).json({ error: 'Слот не найден' });

      const { time_from, time_to, sort_order, is_active } = req.body;

      db.prepare(`
        UPDATE delivery_slots
        SET time_from = ?, time_to = ?, sort_order = ?, is_active = ?
        WHERE id = ?
      `).run(
        time_from !== undefined ? time_from.trim() : slot.time_from,
        time_to !== undefined ? time_to.trim() : slot.time_to,
        sort_order !== undefined ? parseInt(sort_order, 10) : slot.sort_order,
        is_active !== undefined ? (is_active ? 1 : 0) : slot.is_active,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM delivery_slots WHERE id = ?').get(req.params.id);
      res.json({ success: true, slot: updated });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

app.delete('/api/admin/delivery-slots/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление слота'),
  (req, res) => {
    try {
      db.prepare('DELETE FROM delivery_slots WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);


/* ============================================================
   FAQ — публичный список
   ============================================================ */
app.get('/api/faq', (req, res) => {
  try {
    const faq = db.prepare(`
      SELECT id, question, answer
      FROM faq
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `).all();
    res.json(faq);
  } catch (err) {
    console.error('Ошибка FAQ:', err);
    res.status(500).json({ error: 'Не удалось загрузить FAQ' });
  }
});

/* ============================================================
   АДМИН — FAQ
   ============================================================ */
app.get('/api/admin/faq',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const faq = db.prepare(`
        SELECT * FROM faq
        ORDER BY sort_order ASC, id ASC
      `).all();
      res.json(faq);
    } catch (err) {
      res.status(500).json({ error: 'Не удалось загрузить FAQ' });
    }
  }
);

app.post('/api/admin/faq',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создание вопроса FAQ'),
  (req, res) => {
    try {
      const { question, answer, sort_order } = req.body;

      if (!question || !answer) {
        return res.status(400).json({ error: 'Заполните вопрос и ответ' });
      }

      const result = db.prepare(`
        INSERT INTO faq (question, answer, sort_order)
        VALUES (?, ?, ?)
      `).run(
        question.trim(),
        answer.trim(),
        parseInt(sort_order, 10) || 0
      );

      const item = db.prepare('SELECT * FROM faq WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ success: true, faq: item });
    } catch (err) {
      console.error('Ошибка создания FAQ:', err);
      res.status(500).json({ error: 'Не удалось создать вопрос' });
    }
  }
);

app.patch('/api/admin/faq/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Обновление FAQ'),
  (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM faq WHERE id = ?').get(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Вопрос не найден' });
      }

      const { question, answer, sort_order, is_active } = req.body;

      db.prepare(`
        UPDATE faq
        SET question = ?, answer = ?, sort_order = ?, is_active = ?
        WHERE id = ?
      `).run(
        question !== undefined ? question.trim() : item.question,
        answer !== undefined ? answer.trim() : item.answer,
        sort_order !== undefined ? parseInt(sort_order, 10) : item.sort_order,
        is_active !== undefined ? (is_active ? 1 : 0) : item.is_active,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM faq WHERE id = ?').get(req.params.id);
      res.json({ success: true, faq: updated });
    } catch (err) {
      res.status(500).json({ error: 'Не удалось обновить' });
    }
  }
);

app.delete('/api/admin/faq/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление FAQ'),
  (req, res) => {
    try {
      const item = db.prepare('SELECT id FROM faq WHERE id = ?').get(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Вопрос не найден' });
      }

      db.prepare('DELETE FROM faq WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Не удалось удалить' });
    }
  }
);


/* ============================================================
   SEO — мета-данные страниц
   ============================================================ */

// Мета для главной
app.get('/api/seo/home', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    rows.forEach(r => s[r.key] = r.value);

    res.json({
      title: `${s.site_name || 'Cake.Me'} — ${s.site_description || 'Торты и кофе на заказ'}`,
      description: s.site_description || 'Домашние торты, пирожные и свежеобжаренный кофе с доставкой.',
      image: s.hero_poster || '/uploads/banners/og-default.jpg',
      url: req.protocol + '://' + req.get('host') + '/',
      type: 'website',
      site_name: s.site_name || 'Cake.Me'
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

// Мета для товара
app.get('/api/seo/product/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? AND p.is_active = 1
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    rows.forEach(r => s[r.key] = r.value);

    res.json({
      title: `${product.name} — ${s.site_name || 'Cake.Me'}`,
      description: product.description || `${product.name} — купить с доставкой. ${product.weight || ''}`,
      image: product.image || s.hero_poster || '/uploads/banners/og-default.jpg',
      url: req.protocol + '://' + req.get('host') + '/product.html?id=' + product.id,
      type: 'product',
      site_name: s.site_name || 'Cake.Me',
      product: {
        name: product.name,
        price: product.price,
        currency: 'RUB',
        category: product.category_name,
        image: product.image,
        availability: product.track_stock === 1 && product.stock === 0 ? 'out_of_stock' : 'in_stock'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

// Мета для каталога
app.get('/api/seo/catalog', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const s = {};
    rows.forEach(r => s[r.key] = r.value);

    const type = req.query.type;
    const titles = {
      cake: 'Торты и пирожные',
      coffee: 'Кофе и чай'
    };

    const title = titles[type] || 'Каталог';
    const description = type === 'cake'
      ? 'Домашние торты и пирожные на заказ. Готовим вручную из натуральных ингредиентов.'
      : type === 'coffee'
        ? 'Свежеобжаренный кофе и отборный чай с доставкой. Обжариваем небольшими партиями.'
        : 'Каталог тортов, пирожных, кофе и чая с доставкой.';

    res.json({
      title: `${title} — ${s.site_name || 'Cake.Me'}`,
      description,
      image: s.hero_poster || '/uploads/banners/og-default.jpg',
      url: req.protocol + '://' + req.get('host') + '/catalog.html' + (type ? '?type=' + type : ''),
      type: 'website',
      site_name: s.site_name || 'Cake.Me'
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

/* ============================================================
   SITEMAP.XML — для поисковиков
   ============================================================ */
app.get('/sitemap.xml', (req, res) => {
  try {
    const base = req.protocol + '://' + req.get('host');

    const products = db.prepare(`
      SELECT id, created_at FROM products
      WHERE is_active = 1
      ORDER BY id DESC
    `).all();

    const categories = db.prepare(`
      SELECT id, slug FROM categories
      WHERE is_active = 1
    `).all();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${base}/catalog.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${base}/catalog.html?type=cake</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${base}/catalog.html?type=coffee</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${base}/constructor.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${base}/partners.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;

    products.forEach(p => {
      const date = p.created_at ? p.created_at.slice(0, 10) : '';
      xml += `
  <url>
    <loc>${base}/product.html?id=${p.id}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    xml += `
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Ошибка sitemap:', err);
    res.status(500).send('Ошибка генерации sitemap');
  }
});

app.get('/robots.txt', (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  const txt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /cart.html
Disallow: /checkout.html
Disallow: /account.html
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;

  res.header('Content-Type', 'text/plain');
  res.send(txt);
});


/* ============================================================
   ПРОМОКОДЫ (публичная проверка)
   ============================================================ */
app.post('/api/promocodes/check',
  security.generalLimiter,
  (req, res) => {
    try {
      const { code, order_sum } = req.body;

      if (!code || !String(code).trim()) {
        return res.status(400).json({ error: 'Укажите промокод' });
      }

      const cleanCode = String(code).trim().toUpperCase();
      const sum = parseFloat(order_sum) || 0;

      const promo = db.prepare(`
        SELECT * FROM promocodes
        WHERE code = ? AND is_active = 1
      `).get(cleanCode);

      if (!promo) {
        return res.status(404).json({ error: 'Промокод не найден' });
      }

      // Проверки
      if (promo.valid_from) {
        const from = new Date(promo.valid_from + 'T00:00:00');
        if (new Date() < from) {
          return res.status(400).json({ error: 'Промокод ещё не активен' });
        }
      }

      if (promo.valid_until) {
        const until = new Date(promo.valid_until + 'T23:59:59');
        if (new Date() > until) {
          return res.status(400).json({ error: 'Промокод истёк' });
        }
      }

      if (promo.uses_limit && promo.uses_count >= promo.uses_limit) {
        return res.status(400).json({ error: 'Промокод исчерпан' });
      }

      if (promo.min_order_sum && sum < promo.min_order_sum) {
        return res.status(400).json({
          error: `Минимальная сумма заказа: ${promo.min_order_sum.toLocaleString('ru-RU')} ₽`
        });
      }

      // Считаем скидку
      let discount = 0;
      if (promo.discount_type === 'percent') {
        discount = sum * (promo.discount_value / 100);
        if (promo.max_discount && discount > promo.max_discount) {
          discount = promo.max_discount;
        }
      } else {
        discount = promo.discount_value;
      }

      discount = Math.min(discount, sum); // Не больше суммы

      res.json({
        success: true,
        code: promo.code,
        description: promo.description,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        discount: Math.round(discount),
        new_total: Math.round(sum - discount)
      });
    } catch (err) {
      console.error('Ошибка проверки промокода:', err);
      res.status(500).json({ error: 'Не удалось проверить промокод' });
    }
  }
);

/* ============================================================
   АДМИН — ПРОМОКОДЫ
   ============================================================ */

app.get('/api/admin/promocodes',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const promos = db.prepare(`
        SELECT
          p.*,
          (SELECT COUNT(*) FROM promocode_uses WHERE promocode_id = p.id) as uses_total,
          (SELECT COALESCE(SUM(discount_amount), 0) FROM promocode_uses WHERE promocode_id = p.id) as discount_total
        FROM promocodes p
        ORDER BY id DESC
      `).all();
      res.json(promos);
    } catch (err) {
      console.error('Ошибка промокодов:', err);
      res.status(500).json({ error: 'Не удалось загрузить промокоды' });
    }
  }
);

app.post('/api/admin/promocodes',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создание промокода'),
  (req, res) => {
    try {
      const {
        code, description, discount_type, discount_value,
        min_order_sum, max_discount, uses_limit, valid_from, valid_until
      } = req.body;

      if (!code || !discount_type || discount_value === undefined) {
        return res.status(400).json({ error: 'Заполните код, тип и значение скидки' });
      }

      if (!['percent', 'fixed'].includes(discount_type)) {
        return res.status(400).json({ error: 'Недопустимый тип скидки' });
      }

      const cleanCode = String(code).trim().toUpperCase();

      const existing = db.prepare('SELECT id FROM promocodes WHERE code = ?').get(cleanCode);
      if (existing) {
        return res.status(409).json({ error: 'Промокод с таким кодом уже существует' });
      }

      const result = db.prepare(`
        INSERT INTO promocodes
          (code, description, discount_type, discount_value, min_order_sum, max_discount, uses_limit, valid_from, valid_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cleanCode,
        (description || '').trim(),
        discount_type,
        parseFloat(discount_value) || 0,
        parseFloat(min_order_sum) || 0,
        max_discount ? parseFloat(max_discount) : null,
        uses_limit ? parseInt(uses_limit, 10) : null,
        valid_from || null,
        valid_until || null
      );

      const promo = db.prepare('SELECT * FROM promocodes WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ success: true, promocode: promo });
    } catch (err) {
      console.error('Ошибка создания промокода:', err);
      res.status(500).json({ error: 'Не удалось создать промокод' });
    }
  }
);

app.patch('/api/admin/promocodes/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Обновление промокода'),
  (req, res) => {
    try {
      const promo = db.prepare('SELECT * FROM promocodes WHERE id = ?').get(req.params.id);
      if (!promo) {
        return res.status(404).json({ error: 'Промокод не найден' });
      }

      const {
        description, discount_type, discount_value,
        min_order_sum, max_discount, uses_limit,
        valid_from, valid_until, is_active
      } = req.body;

      db.prepare(`
        UPDATE promocodes
        SET description = ?,
            discount_type = ?,
            discount_value = ?,
            min_order_sum = ?,
            max_discount = ?,
            uses_limit = ?,
            valid_from = ?,
            valid_until = ?,
            is_active = ?
        WHERE id = ?
      `).run(
        description !== undefined ? description.trim() : promo.description,
        discount_type !== undefined ? discount_type : promo.discount_type,
        discount_value !== undefined ? parseFloat(discount_value) : promo.discount_value,
        min_order_sum !== undefined ? parseFloat(min_order_sum) || 0 : promo.min_order_sum,
        max_discount !== undefined ? (max_discount ? parseFloat(max_discount) : null) : promo.max_discount,
        uses_limit !== undefined ? (uses_limit ? parseInt(uses_limit, 10) : null) : promo.uses_limit,
        valid_from !== undefined ? (valid_from || null) : promo.valid_from,
        valid_until !== undefined ? (valid_until || null) : promo.valid_until,
        is_active !== undefined ? (is_active ? 1 : 0) : promo.is_active,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM promocodes WHERE id = ?').get(req.params.id);
      res.json({ success: true, promocode: updated });
    } catch (err) {
      console.error('Ошибка обновления промокода:', err);
      res.status(500).json({ error: 'Не удалось обновить промокод' });
    }
  }
);

app.delete('/api/admin/promocodes/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление промокода'),
  (req, res) => {
    try {
      const promo = db.prepare('SELECT * FROM promocodes WHERE id = ?').get(req.params.id);
      if (!promo) {
        return res.status(404).json({ error: 'Промокод не найден' });
      }

      db.prepare('DELETE FROM promocodes WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка удаления промокода:', err);
      res.status(500).json({ error: 'Не удалось удалить промокод' });
    }
  }
);

// История использования промокода
app.get('/api/admin/promocodes/:id/uses',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const uses = db.prepare(`
        SELECT pu.*, o.customer_name, o.total as order_total
        FROM promocode_uses pu
        LEFT JOIN orders o ON o.id = pu.order_id
        WHERE pu.promocode_id = ?
        ORDER BY pu.id DESC
      `).all(req.params.id);
      res.json(uses);
    } catch (err) {
      console.error('Ошибка загрузки использований:', err);
      res.status(500).json({ error: 'Не удалось загрузить историю' });
    }
  }
);


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

app.patch('/api/admin/orders/:id/status',
  authRequired,
  requireRole('admin', 'manager'),
  logger.activityLogger('Смена статуса заказа'),
  (req, res) => {
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

      // ✅ ФИКС: при отмене — возвращаем остатки на склад
      if (status === 'cancelled' && order.status !== 'cancelled') {
        const items = db.prepare(
          'SELECT product_id, quantity, is_custom FROM order_items WHERE order_id = ?'
        ).all(order.id);

        const restore = db.transaction(() => {
          for (const item of items) {
            if (item.is_custom === 1) continue;
            if (!item.product_id) continue;

            db.prepare(`
              UPDATE products
              SET stock = stock + ?
              WHERE id = ? AND track_stock = 1
            `).run(item.quantity, item.product_id);
          }
        });

        restore();
      }

      db.prepare(`
        UPDATE orders
        SET status = ?, seen_by_admin = 1, seen_at = datetime('now')
        WHERE id = ?
      `).run(status, req.params.id);

      const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

      if (updatedOrder && order.status !== status) {
        notifications.notifyOrderStatusChange(updatedOrder, status, order.status).catch(err => {
          logger.logError('Ошибка уведомления о смене статуса', { error: err.message });
        });
      }

      res.json({ success: true, status });
    } catch (err) {
      console.error('Ошибка смены статуса:', err);
      res.status(500).json({ error: 'Не удалось обновить статус' });
    }
  }
);
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

app.post('/api/admin/categories',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создание категории'),
  (req, res) => {
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
  }
);

app.patch('/api/admin/categories/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Обновление категории'),
  (req, res) => {
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
  }
);

app.delete('/api/admin/categories/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление категории'),
  (req, res) => {
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
  }
);

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

app.post('/api/admin/products',
  authRequired,
  requireRole('admin'),
  security.validateProduct,
  security.handleValidationErrors,
  logger.activityLogger('Создание товара'),
  (req, res) => {
    try {
      const { category_id, name, description, price, weight, image, stock, track_stock, low_stock_threshold, portions, ingredients, storage_info } = req.body;

      const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
      if (!category) {
        return res.status(400).json({ error: 'Категория не найдена' });
      }

      const result = db.prepare(`
        INSERT INTO products (category_id, name, description, price, weight, image, stock, track_stock, low_stock_threshold, portions, ingredients, storage_info)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        category_id,
        name.trim(),
        (description || '').trim(),
        parseFloat(price),
        (weight || '').trim(),
        (image || '').trim(),
        parseInt(stock, 10) || 0,
        track_stock !== undefined ? (track_stock ? 1 : 0) : 1,
        parseInt(low_stock_threshold, 10) || 5,
        (portions || '').trim(),
        (ingredients || '').trim(),
        (storage_info || '').trim()
      );

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json({ success: true, product });
    } catch (err) {
      console.error('Ошибка создания товара:', err);
      res.status(500).json({ error: 'Не удалось создать товар' });
    }
  }
);

app.patch('/api/admin/products/:id',
  authRequired,
  requireRole('admin'),
  security.validateId,
  security.handleValidationErrors,
  logger.activityLogger('Обновление товара'),
  (req, res) => {
    try {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      const {
        category_id, name, description, price, weight, image, stock, is_active, track_stock, low_stock_threshold,
        portions, ingredients, storage_info
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
            is_active = ?,
            track_stock = ?,
            low_stock_threshold = ?,
            portions = ?,
            ingredients = ?,
            storage_info = ?
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
        track_stock !== undefined ? (track_stock ? 1 : 0) : product.track_stock,
        low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : product.low_stock_threshold,
        portions !== undefined ? portions.trim() : product.portions,
        ingredients !== undefined ? ingredients.trim() : product.ingredients,
        storage_info !== undefined ? storage_info.trim() : product.storage_info,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      res.json({ success: true, product: updated });
    } catch (err) {
      console.error('Ошибка обновления товара:', err);
      res.status(500).json({ error: 'Не удалось обновить товар' });
    }
  }
);

app.delete('/api/admin/products/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление товара'),
  (req, res) => {
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
  }
);

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

app.patch('/api/admin/users/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Изменение пользователя'),
  (req, res) => {
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
  }
);

app.delete('/api/admin/users/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление пользователя'),
  (req, res) => {
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
  }
);

/* ============================================================
   АДМИН — ПАРТНЁРЫ
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

app.post('/api/admin/partners',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создание партнёра'),
  (req, res) => {
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
  }
);

app.patch('/api/admin/partners/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Обновление партнёра'),
  (req, res) => {
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
  }
);

app.delete('/api/admin/partners/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление партнёра'),
  (req, res) => {
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
  }
);

/* ============================================================
   АДМИН — КОНСТРУКТОР
   ============================================================ */

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

app.post('/api/admin/constructor/options',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создание опции конструктора'),
  (req, res) => {
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
  }
);

app.patch('/api/admin/constructor/options/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Обновление опции конструктора'),
  (req, res) => {
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
  }
);

app.delete('/api/admin/constructor/options/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление опции конструктора'),
  (req, res) => {
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
  }
);

/* ============================================================
   АДМИН — ОТЗЫВЫ
   ============================================================ */

app.get('/api/admin/reviews',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const { filter } = req.query;

      let sql = `
        SELECT
          r.*,
          p.name AS product_name,
          o.total AS order_total
        FROM reviews r
        LEFT JOIN products p ON p.id = r.product_id
        LEFT JOIN orders o ON o.id = r.order_id
        WHERE 1=1
      `;
      const params = [];

      if (filter === 'pending') {
        sql += ' AND r.is_approved = 0';
      } else if (filter === 'approved') {
        sql += ' AND r.is_approved = 1';
      } else if (filter === 'featured') {
        sql += ' AND r.is_featured = 1 AND r.is_approved = 1';
      }

      sql += ' ORDER BY r.is_approved ASC, r.created_at DESC';

      const reviews = db.prepare(sql).all(...params);
      res.json(reviews);
    } catch (err) {
      console.error('Ошибка отзывов:', err);
      res.status(500).json({ error: 'Не удалось загрузить отзывы' });
    }
  }
);

app.patch('/api/admin/reviews/:id',
  authRequired,
  requireRole('admin', 'manager'),
  logger.activityLogger('Изменение отзыва'),
  (req, res) => {
    try {
      const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
      if (!review) {
        return res.status(404).json({ error: 'Отзыв не найден' });
      }

      const { is_approved, is_featured } = req.body;

      db.prepare(`
        UPDATE reviews
        SET is_approved = ?, is_featured = ?, approved_at = CASE WHEN ? = 1 THEN datetime('now') ELSE approved_at END
        WHERE id = ?
      `).run(
        is_approved !== undefined ? (is_approved ? 1 : 0) : review.is_approved,
        is_featured !== undefined ? (is_featured ? 1 : 0) : review.is_featured,
        is_approved !== undefined ? (is_approved ? 1 : 0) : review.is_approved,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
      res.json({ success: true, review: updated });
    } catch (err) {
      console.error('Ошибка обновления отзыва:', err);
      res.status(500).json({ error: 'Не удалось обновить отзыв' });
    }
  }
);

app.delete('/api/admin/reviews/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление отзыва'),
  (req, res) => {
    try {
      const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
      if (!review) {
        return res.status(404).json({ error: 'Отзыв не найден' });
      }

      db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка удаления отзыва:', err);
      res.status(500).json({ error: 'Не удалось удалить отзыв' });
    }
  }
);

/* ============================================================
   АДМИН — НАСТРОЙКИ
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

app.patch('/api/admin/settings',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Изменение настроек'),
  (req, res) => {
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
        'logo', 'hero_video', 'hero_poster',
        'banner_1', 'banner_2', 'banner_3',
        'map_latitude', 'map_longitude', 'map_zoom',
        // ✅ Юридические данные
        'legal_name', 'legal_inn', 'legal_ogrn',
        'legal_address', 'legal_phone', 'legal_email',
        // ✅ Работа
        'working_hours',
        // ✅ Аналитика
        'ym_counter_id', 'ga_measurement_id',
        // ✅ Jivo
        'jivo_widget_id',
        // ✅ ABOUT-БЛОК (О нас)
        'about_title',           // заголовок «Готовим с душой с 2019 года»
        'about_subtitle',        // подзаголовок / eyebrow
        'about_text_1',          // первый абзац
        'about_text_2',          // второй абзац
        'about_image_1',         // фото 1
        'about_image_2',         // фото 2
        'about_image_3',         // фото 3
        'about_video',           // ✅ видео после фото        // фото 4 (опционально)
        'about_feature_1_title', // «Натуральные ингредиенты»
        'about_feature_1_desc',  // «Без консервантов и красителей»
        'about_feature_2_title', // «Доставка 24/7»
        'about_feature_2_desc',
        'about_feature_3_title', // «Индивидуальный подход»
        'about_feature_3_desc'
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
  }
);

app.post('/api/admin/settings/reset-demo',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Сброс демо-данных'),
  (req, res) => {
    try {
      db.prepare('DELETE FROM order_items').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('orders', 'order_items')").run();

      res.json({ success: true, message: 'Заказы удалены. Товары и пользователи сохранены.' });
    } catch (err) {
      console.error('Ошибка сброса:', err);
      res.status(500).json({ error: 'Не удалось сбросить данные' });
    }
  }
);

/* ============================================================
   АДМИН — МЕДИА
   ============================================================ */

app.get('/api/admin/media', authRequired, requireRole('admin', 'manager'), (req, res) => {
  try {
    const folders = ['products', 'hero', 'banners', 'misc'];
    const files = [];

    folders.forEach(folder => {
      const dir = path.join(UPLOAD_DIR, folder);
      if (!fs.existsSync(dir)) return;

      fs.readdirSync(dir).forEach(filename => {
        // ✅ ФИКС: пропускаем скрытые файлы (.gitkeep и т.п.)
        if (filename.startsWith('.')) return;

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
  security.uploadLimiter,
  upload.single('file'),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не получен' });
      }

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

app.delete('/api/admin/media',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление медиафайла'),
  (req, res) => {
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
  }
);

/* ============================================================
   БЭКАПЫ
   ============================================================ */

app.get('/api/admin/backups',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    res.json(backup.listBackups());
  }
);

app.post('/api/admin/backups/create',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Создан бэкап БД вручную'),
  (req, res) => {
    const name = backup.createBackup();
    if (name) {
      res.json({ success: true, name });
    } else {
      res.status(500).json({ error: 'Не удалось создать бэкап' });
    }
  }
);

app.get('/api/admin/backups/:name',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    const safeName = path.basename(req.params.name);

    // ✅ ФИКС: только файлы вида shop-*.db
    if (!/^shop-[\d\-T]+\.db$/.test(safeName)) {
      return res.status(400).json({ error: 'Недопустимое имя бэкапа' });
    }

    const filePath = path.join(__dirname, 'data', 'backups', safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Бэкап не найден' });
    }

    res.download(filePath);
  }
);

app.post('/api/admin/backups/:name/restore',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Восстановление БД из бэкапа'),
  (req, res) => {
    try {
      backup.restoreBackup(req.params.name);
      res.json({ success: true, message: 'БД восстановлена. Перезапустите сервер.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ============================================================
   АДМИН — УВЕДОМЛЕНИЯ (тестирование)
   ============================================================ */

// Статус подключения сервисов
app.get('/api/admin/notifications/status',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    res.json({
      email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      },
      sms: {
        enabled: process.env.SMS_ENABLED === 'true',
        configured: !!process.env.SMSRU_API_ID
      },
      telegram: {
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID)
      }
    });
  }
);

// Тест Email
app.post('/api/admin/notifications/test-email',
  authRequired,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { email } = req.body;
      const target = email || req.user.email;

      const result = await notifications.sendEmail(
        target,
        '🍰 Тест Email — Cake.Me',
        `
          <p>Это тестовое письмо от Cake.Me.</p>
          <p>Если вы видите его — настройки SMTP работают!</p>
          <p><strong>Время:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        `
      );

      res.json({
        success: result.success,
        stub: result.stub,
        error: result.error,
        message: result.stub ? 'Режим заглушки — проверьте консоль сервера' : 'Email отправлен'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Тест SMS
app.post('/api/admin/notifications/test-sms',
  authRequired,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Укажите номер телефона' });
      }

      const result = await notifications.sendSMS(phone, 'Cake.Me: Тестовое SMS');
      res.json({
        success: result.success,
        stub: result.stub,
        error: result.error,
        message: result.stub ? 'Режим заглушки — проверьте консоль сервера' : 'SMS отправлено'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Тест Telegram
app.post('/api/admin/notifications/test-telegram',
  authRequired,
  requireRole('admin'),
  async (req, res) => {
    try {
      const result = await notifications.sendTelegram(
        `🍰 <b>Cake.Me</b>\n\nЭто тестовое уведомление.\n\nВремя: ${new Date().toLocaleString('ru-RU')}`
      );

      res.json({
        success: result.success,
        stub: result.stub,
        error: result.error,
        message: result.stub ? 'Режим заглушки — проверьте консоль сервера' : 'Сообщение отправлено'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


/* ============================================================
   АДМИН — ЛОГИ ДЕЙСТВИЙ
   ============================================================ */
app.get('/api/admin/logs',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    try {
      const {
        user_id,
        action,
        entity_type,
        date_from,
        date_to,
        search,
        limit = 100,
        offset = 0
      } = req.query;

      let sql = 'SELECT * FROM activity_log WHERE 1=1';
      const params = [];

      if (user_id) {
        sql += ' AND user_id = ?';
        params.push(parseInt(user_id, 10));
      }

      if (action) {
        sql += ' AND action LIKE ?';
        params.push(`%${action}%`);
      }

      if (entity_type && entity_type !== 'all') {
        sql += ' AND entity_type = ?';
        params.push(entity_type);
      }

      if (date_from) {
        sql += ' AND created_at >= ?';
        params.push(date_from);
      }

      if (date_to) {
        sql += ' AND created_at <= ?';
        params.push(date_to + ' 23:59:59');
      }

      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        sql += ' AND (user_name LIKE ? OR action LIKE ? OR meta LIKE ?)';
        params.push(q, q, q);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10) || 100, parseInt(offset, 10) || 0);

      const logs = db.prepare(sql).all(...params);

      // Парсим meta JSON
      const parsed = logs.map(l => {
        let meta = null;
        try { meta = l.meta ? JSON.parse(l.meta) : null; } catch {}
        return { ...l, meta_parsed: meta };
      });

      // Общее количество для пагинации
      let countSql = 'SELECT COUNT(*) as total FROM activity_log WHERE 1=1';
      const countParams = [];

      if (user_id) { countSql += ' AND user_id = ?'; countParams.push(parseInt(user_id, 10)); }
      if (action) { countSql += ' AND action LIKE ?'; countParams.push(`%${action}%`); }
      if (entity_type && entity_type !== 'all') { countSql += ' AND entity_type = ?'; countParams.push(entity_type); }
      if (date_from) { countSql += ' AND created_at >= ?'; countParams.push(date_from); }
      if (date_to) { countSql += ' AND created_at <= ?'; countParams.push(date_to + ' 23:59:59'); }
      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        countSql += ' AND (user_name LIKE ? OR action LIKE ? OR meta LIKE ?)';
        countParams.push(q, q, q);
      }

      const { total } = db.prepare(countSql).get(...countParams);

      res.json({ logs: parsed, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
    } catch (err) {
      console.error('Ошибка загрузки логов:', err);
      res.status(500).json({ error: 'Не удалось загрузить логи' });
    }
  }
);

// Пользователи для фильтра
app.get('/api/admin/logs/users',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    try {
      const users = db.prepare(`
        SELECT DISTINCT user_id, user_name, user_role
        FROM activity_log
        WHERE user_id IS NOT NULL
        ORDER BY user_name
      `).all();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Не удалось загрузить список пользователей' });
    }
  }
);

/* ============================================================
   АДМИН — БЕЗОПАСНОСТЬ
   ============================================================ */

// Список заблокированных IP
app.get('/api/admin/security/blocked-ips',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    try {
      const blocked = db.prepare(`
        SELECT * FROM blocked_ips
        ORDER BY blocked_until DESC
      `).all();
      res.json(blocked);
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

// Разблокировать IP
app.delete('/api/admin/security/blocked-ips/:ip',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Разблокировка IP'),
  (req, res) => {
    try {
      const ip = decodeURIComponent(req.params.ip);
      securityExtra.unblockIP(ip);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

// Лог security-событий
app.get('/api/admin/security/events',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    try {
      const { type, limit = 100, offset = 0 } = req.query;

      let sql = 'SELECT * FROM security_events WHERE 1=1';
      const params = [];

      if (type && type !== 'all') {
        sql += ' AND event_type = ?';
        params.push(type);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10) || 100, parseInt(offset, 10) || 0);

      const events = db.prepare(sql).all(...params);

      // Типы событий для фильтра
      const types = db.prepare(`
        SELECT DISTINCT event_type FROM security_events
        ORDER BY event_type
      `).all().map(t => t.event_type);

      res.json({ events, types });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

// Счётчик активных блокировок
app.get('/api/admin/security/stats',
  authRequired,
  requireRole('admin'),
  (req, res) => {
    try {
      const blockedCount = db.prepare(`
        SELECT COUNT(*) as c FROM blocked_ips
        WHERE blocked_until > datetime('now')
      `).get().c;

      const eventsToday = db.prepare(`
        SELECT COUNT(*) as c FROM security_events
        WHERE created_at > datetime('now', '-1 day')
      `).get().c;

      const honeypotToday = db.prepare(`
        SELECT COUNT(*) as c FROM security_events
        WHERE event_type = 'honeypot_triggered'
          AND created_at > datetime('now', '-1 day')
      `).get().c;

      res.json({
        blocked_active: blockedCount,
        events_today: eventsToday,
        honeypot_hits_today: honeypotToday
      });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

// Очистить логи старше N дней
app.delete('/api/admin/logs/cleanup',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Очистка старых логов'),
  (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 90;
      const result = db.prepare(`
        DELETE FROM activity_log
        WHERE created_at < datetime('now', ?)
      `).run(`-${days} days`);

      res.json({ success: true, deleted: result.changes, days });
    } catch (err) {
      console.error('Ошибка очистки логов:', err);
      res.status(500).json({ error: 'Не удалось очистить логи' });
    }
  }
);

/* ============================================================
   ЗАЯВКИ ОПЕРАТОРУ («Связаться с оператором»)
   ============================================================ */

// ============================================
// 1. Публичный endpoint — создать заявку
// ============================================
const operatorLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 час
  max: 5,                      // 5 заявок в час с одного IP
  message: { error: 'Слишком много заявок. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/operator-request',
  operatorLimiter,
  securityExtra.honeypot('website_hp'),   // ✅ Honeypot
  body('name').trim().notEmpty().withMessage('Укажите имя')
    .isLength({ min: 2, max: 100 }),
  body('phone').trim().notEmpty().withMessage('Укажите телефон')
    .matches(/^[\d\s+\-()]{7,20}$/).withMessage('Некорректный телефон'),
  body('email').optional({ checkFalsy: true }).trim()
    .isEmail().withMessage('Некорректный email'),
  body('message').optional({ checkFalsy: true }).trim()
    .isLength({ max: 2000 }),
  security.handleValidationErrors,
  (req, res) => {
    try {
      const { name, phone, email, message, page_url } = req.body;

      // Простая защита от спама: honeypot-поле
      if (req.body.website_hp) {
        // Это бот — возвращаем «успех», но не пишем в БД
        return res.json({ success: true, message: 'Заявка принята' });
      }

      const result = db.prepare(`
        INSERT INTO operator_requests (name, phone, email, message, page_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        phone.trim(),
        (email || '').trim(),
        (message || '').trim(),
        (page_url || '').trim().slice(0, 500)
      );

      logger.logActivity('Новая заявка оператору', {
        requestId: result.lastInsertRowid,
        name: name.trim(),
        phone: phone.trim(),
        ip: req.ip
      });

      // Уведомления админу (email + Telegram) — асинхронно
      const adminEmail = process.env.ADMIN_EMAIL;
      const tgMessage = `
💬 <b>Новая заявка оператору</b>

👤 <b>${escapeHtml(name.trim())}</b>
📞 ${escapeHtml(phone.trim())}
${email ? `📧 ${escapeHtml(email.trim())}\n` : ''}${message ? `\n💬 ${escapeHtml(message.trim().substring(0, 300))}\n` : ''}
<a href="${escapeHtml(process.env.SITE_URL || 'http://localhost:3000')}/admin/">Открыть админку →</a>
      `.trim();

      if (adminEmail) {
        notifications.sendEmail(
          adminEmail,
          `💬 Заявка от ${escapeHtml(name.trim())}`,
          `<p><strong>Имя:</strong> ${escapeHtml(name.trim())}</p>
           <p><strong>Телефон:</strong> ${escapeHtml(phone.trim())}</p>
           ${email ? `<p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>` : ''}
           ${message ? `<p><strong>Сообщение:</strong><br>${escapeHtml(message.trim())}</p>` : ''}`
        ).catch(err => console.error('Ошибка email-уведомления:', err));
      }

      notifications.sendTelegram(tgMessage)
        .catch(err => console.error('Ошибка TG-уведомления:', err));

      res.status(201).json({
        success: true,
        requestId: result.lastInsertRowid,
        message: 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.'
      });
    } catch (err) {
      console.error('Ошибка создания заявки:', err);
      res.status(500).json({ error: 'Не удалось отправить заявку' });
    }
  }
);

// ============================================
// 2. Админ — список заявок
// ============================================
app.get('/api/admin/operator-requests',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const { status, search, limit = 100, offset = 0 } = req.query;

      let sql = 'SELECT * FROM operator_requests WHERE 1=1';
      const params = [];

      if (status && status !== 'all') {
        sql += ' AND status = ?';
        params.push(status);
      }

      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR message LIKE ?)';
        params.push(q, q, q, q);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10) || 100, parseInt(offset, 10) || 0);

      const requests = db.prepare(sql).all(...params);

      // Счётчики по статусам
      const counts = db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as progress_count,
          SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) as answered_count,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
          COUNT(*) as total
        FROM operator_requests
      `).get();

      res.json({ requests, counts });
    } catch (err) {
      console.error('Ошибка загрузки заявок:', err);
      res.status(500).json({ error: 'Не удалось загрузить заявки' });
    }
  }
);

// ============================================
// 3. Счётчик непрочитанных (для badge)
// ============================================
app.get('/api/admin/operator-requests/count',
  authRequired,
  requireRole('admin', 'manager'),
  (req, res) => {
    try {
      const count = db.prepare(`
        SELECT COUNT(*) as c FROM operator_requests WHERE status = 'new'
      `).get().c;
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка' });
    }
  }
);

// ============================================
// 4. Админ — обновить статус/комментарий
// ============================================
app.patch('/api/admin/operator-requests/:id',
  authRequired,
  requireRole('admin', 'manager'),
  logger.activityLogger('Изменение заявки оператору'),
  (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM operator_requests WHERE id = ?').get(req.params.id);
      if (!request) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      const { status, admin_comment } = req.body;

      const allowed = ['new', 'in_progress', 'answered', 'closed'];
      if (status && !allowed.includes(status)) {
        return res.status(400).json({ error: 'Недопустимый статус' });
      }

      const newStatus = status !== undefined ? status : request.status;
      const newComment = admin_comment !== undefined ? admin_comment : request.admin_comment;
      const handledAt = (newStatus !== 'new' && request.status === 'new')
        ? new Date().toISOString().replace('T', ' ').slice(0, 19)
        : request.handled_at;

      db.prepare(`
        UPDATE operator_requests
        SET status = ?,
            admin_comment = ?,
            handled_by = ?,
            handled_at = ?
        WHERE id = ?
      `).run(
        newStatus,
        newComment,
        req.user.id,
        handledAt,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM operator_requests WHERE id = ?').get(req.params.id);
      res.json({ success: true, request: updated });
    } catch (err) {
      console.error('Ошибка обновления заявки:', err);
      res.status(500).json({ error: 'Не удалось обновить заявку' });
    }
  }
);

// ============================================
// 5. Админ — удалить заявку
// ============================================
app.delete('/api/admin/operator-requests/:id',
  authRequired,
  requireRole('admin'),
  logger.activityLogger('Удаление заявки оператору'),
  (req, res) => {
    try {
      const request = db.prepare('SELECT * FROM operator_requests WHERE id = ?').get(req.params.id);
      if (!request) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      db.prepare('DELETE FROM operator_requests WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Ошибка удаления заявки:', err);
      res.status(500).json({ error: 'Не удалось удалить заявку' });
    }
  }
);

// ✅ ФИКС: закрываем payment-stub.html в проде
app.get('/payment-stub.html', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Not found');
  }
  next();
});

const { notFoundHandler, errorHandler } = require('./src/middleware/error-handler');

app.use(notFoundHandler);
app.use(errorHandler);

/* ============================================================
   START
   ============================================================ */
app.listen(PORT, () => {
  console.log(`\n🍰 Сервер запущен: http://localhost:${PORT}`);
  console.log(`📦 База: data/shop.db`);
  console.log(`🖼️  Медиа: public/uploads/`);
  console.log(`📝 Логи: data/logs/`);
  console.log(`💾 Бэкапы: data/backups/\n`);
});

/* ============================================================
   АВТОБЭКАПЫ
   ============================================================ */
if (process.env.BACKUP_ENABLED !== 'false') {
  const cron = require('node-cron');

  cron.schedule('0 */6 * * *', () => {
    console.log('🕐 Автобэкап по расписанию...');
    backup.createBackup();
  });

  setTimeout(() => {
    backup.createBackup();
  }, 5000);

  console.log('📅 Автобэкапы включены (каждые 6 часов)');
}

/* ============================================================
   ОЧИСТКА ИСТЁКШИХ IP-БЛОКИРОВОК
   ============================================================ */
if (process.env.BACKUP_ENABLED !== 'false') {
  const cron = require('node-cron');

  // Каждые 15 минут
  cron.schedule('*/15 * * * *', () => {
    securityExtra.cleanupExpiredBlocks();
  });

  console.log('🛡️  Очистка IP-блокировок включена (каждые 15 мин)');

  // ✅ ФИКС: раз в 5 минут проверяем pending-платежи через API ЮKassa
  cron.schedule('*/5 * * * *', async () => {
    try {
      const pending = db.prepare(`
        SELECT id, payment_id FROM orders
        WHERE payment = 'card'
          AND payment_status = 'pending'
          AND payment_id IS NOT NULL
          AND created_at > datetime('now', '-2 days')
      `).all();

      for (const order of pending) {
        try {
          const status = await yookassa.getPaymentStatus(order.payment_id);

          if (status.success && status.status === 'succeeded') {
            db.prepare(`
              UPDATE orders
              SET payment_status = 'succeeded', paid_at = datetime('now')
              WHERE id = ? AND payment_status != 'succeeded'
            `).run(order.id);

            logger.logActivity('Cron: заказ оплачен (пропущен вебхук)', {
              orderId: order.id,
              paymentId: order.payment_id
            });
          } else if (status.success && status.status === 'canceled') {
            db.prepare(`
              UPDATE orders
              SET payment_status = 'canceled'
              WHERE id = ? AND payment_status = 'pending'
            `).run(order.id);
          }
        } catch (e) {
          console.error('Cron проверки платежа:', e.message);
        }
      }
    } catch (e) {
      console.error('Cron pending payments:', e.message);
    }
  });

  console.log('💳 Проверка pending-платежей включена (каждые 5 мин)');
}