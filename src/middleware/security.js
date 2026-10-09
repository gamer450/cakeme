/* ============================================================
   БЕЗОПАСНОСТЬ — Helmet, Rate limit, Валидация
   v2.3 — CORS SITE_URL + Яндекс.Карты + CDN jsdelivr
   ============================================================ */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, query, param, validationResult } = require('express-validator');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ============================================================
// 0. ОПРЕДЕЛЕНИЕ РЕЖИМА
// ============================================================
const isProduction = process.env.NODE_ENV === 'production';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// ============================================================
// 1. CSP — правильные whitelist'ы
// ============================================================
const cspReportDir = path.join(__dirname, '..', '..', 'data', 'logs');
try {
  if (!fs.existsSync(cspReportDir)) {
    fs.mkdirSync(cspReportDir, { recursive: true });
  }
} catch (e) {
  console.warn('⚠️  Не удалось создать папку для CSP-логов:', e.message);
}
const cspReportFile = path.join(cspReportDir, 'csp-violations.log');

const cspDirectives = {
  defaultSrc: ["'self'"],

  // ✅ Скрипты: свои + инлайн + Яндекс.Карты + CDN jsdelivr (Chart.js, SheetJS)
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://api-maps.yandex.ru",
    "https://yastatic.net",
    "https://cdn.jsdelivr.net"
  ],

  // ✅ Стили: свои + Google Fonts + inline + Яндекс
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://yastatic.net"
  ],

  // ✅ Шрифты
  fontSrc: [
    "'self'",
    "data:",
    "https://fonts.gstatic.com"
  ],

  // ✅ Картинки: свои + data: + blob: + OSM + Яндекс (все поддомены)
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://*.tile.openstreetmap.org",
    "https://*.basemaps.cartocdn.com",
    "https://*.maps.yandex.net",
    "https://*.maps.yandex.ru",
    "https://*.yandex.ru",
    "https://yastatic.net"
  ],

  // ✅ AJAX/fetch: свои + OSM + Яндекс + CDN
  connectSrc: [
    "'self'",
    "https://*.tile.openstreetmap.org",
    "https://*.basemaps.cartocdn.com",
    "https://nominatim.openstreetmap.org",
    "https://api-maps.yandex.ru",
    "https://*.maps.yandex.ru",
    "https://*.yandex.ru",
    "https://yastatic.net",
    "https://cdn.jsdelivr.net"
  ],

  // Медиа
  mediaSrc: ["'self'", "blob:", "data:"],

  // Фреймы
  frameSrc: ["'self'"],

  // Отключаем опасные
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],

  // ✅ Отключено принудительное перенаправление на HTTPS
  upgradeInsecureRequests: null,

  // Отчёты
  reportUri: isProduction ? ['/api/csp-report'] : null
};

// В dev-режиме — localhost
if (!isProduction) {
  cspDirectives.connectSrc.push("ws://localhost:*", "http://localhost:*", "ws://127.0.0.1:*");
}

const helmetConfig = helmet({
  contentSecurityPolicy: isProduction ? { directives: cspDirectives } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  noSniff: true,
  frameguard: { action: 'sameorigin' },
  xssFilter: true
});

// ============================================================
// 1.5. ОБРАБОТЧИК CSP-ОТЧЁТОВ
// ============================================================
function cspReportHandler(req, res) {
  try {
    const report = req.body;
    const line = `[${new Date().toISOString()}] ${JSON.stringify(report).slice(0, 2000)}\n`;
    fs.appendFile(cspReportFile, line, 'utf8', () => {});
  } catch (e) {
    console.error('Не удалось записать CSP-отчёт:', e.message);
  }
  res.status(204).end();
}

// ============================================================
// 2. CORS
// ============================================================
const corsConfig = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://129.101.115.219',
      SITE_URL
    ];

    if (isProduction) {
      allowed.push('https://cakeme-shop.ru');
      allowed.push('https://www.cakeme-shop.ru');
    }

    const uniqueAllowed = [...new Set(allowed)];

    if (uniqueAllowed.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS блокировка: ${origin}`);
      callback(new Error('Заблокировано CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// ============================================================
// 3. RATE LIMITING
// ============================================================
const devMultiplier = isProduction ? 1 : 100;

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500 * devMultiplier,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction && process.env.RATE_LIMIT_ENABLED !== 'true'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5 * devMultiplier,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => !isProduction && process.env.RATE_LIMIT_ENABLED !== 'true'
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10 * devMultiplier,
  message: { error: 'Слишком много заказов с этого IP. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction && process.env.RATE_LIMIT_ENABLED !== 'true'
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30 * devMultiplier,
  message: { error: 'Слишком много загрузок. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction && process.env.RATE_LIMIT_ENABLED !== 'true'
});

// ============================================================
// 4. ОБРАБОТЧИК ОШИБОК ВАЛИДАЦИИ
// ============================================================
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      error: firstError.msg,
      field: firstError.path
    });
  }
  next();
}

// ============================================================
// 5. ВАЛИДАТОРЫ
// ============================================================
const validateRegister = [
  body('name').trim()
    .notEmpty().withMessage('Укажите имя')
    .isLength({ min: 2, max: 100 }).withMessage('Имя от 2 до 100 символов'),
  body('email').trim()
    .isEmail().withMessage('Некорректный email')
    .normalizeEmail()
    .isLength({ max: 255 }),
  body('phone').optional({ checkFalsy: true }).trim()
    .matches(/^[\d\s+\-()]{7,20}$/).withMessage('Некорректный телефон'),
  body('password')
    .isLength({ min: 6, max: 100 }).withMessage('Пароль от 6 до 100 символов')
];

const validateLogin = [
  body('email').trim()
    .isEmail().withMessage('Некорректный email')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Введите пароль')
];

const validateOrder = [
  body('customer_name').trim()
    .notEmpty().withMessage('Укажите имя')
    .isLength({ min: 2, max: 100 }),
  body('phone').trim()
    .matches(/^[\d\s+\-()]{7,20}$/).withMessage('Некорректный телефон'),
  body('email').optional({ checkFalsy: true }).trim()
    .isEmail().withMessage('Некорректный email')
    .normalizeEmail(),
  body('address').optional({ checkFalsy: true }).trim()
    .isLength({ max: 300 }),
  body('comment').optional({ checkFalsy: true }).trim()
    .isLength({ max: 1000 }),

  body('items').optional({ nullable: true })
    .isArray({ max: 50 }).withMessage('Слишком много товаров в корзине'),
  body('custom_items').optional({ nullable: true })
    .isArray({ max: 20 }).withMessage('Слишком много кастомных тортов'),

  body().custom((value, { req }) => {
    const itemsCount = Array.isArray(req.body.items) ? req.body.items.length : 0;
    const customCount = Array.isArray(req.body.custom_items) ? req.body.custom_items.length : 0;

    if (itemsCount + customCount === 0) {
      throw new Error('Корзина пуста');
    }
    if (itemsCount + customCount > 50) {
      throw new Error('Корзина слишком большая');
    }
    return true;
  })
];

const validateProduct = [
  body('name').trim()
    .notEmpty().withMessage('Укажите название')
    .isLength({ max: 200 }),
  body('price')
    .isFloat({ min: 0, max: 10000000 }).withMessage('Некорректная цена'),
  body('category_id')
    .isInt({ min: 1 }).withMessage('Выберите категорию'),
  body('description').optional({ checkFalsy: true }).trim()
    .isLength({ max: 2000 }),
  body('weight').optional({ checkFalsy: true }).trim()
    .isLength({ max: 50 }),
  body('stock').optional()
    .isInt({ min: 0, max: 100000 })
];

const validateId = [
  param('id').isInt({ min: 1 }).withMessage('Некорректный ID')
];

module.exports = {
  isProduction,
  helmetConfig,
  cspReportHandler,
  corsConfig,
  generalLimiter,
  authLimiter,
  orderLimiter,
  uploadLimiter,
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateOrder,
  validateProduct,
  validateId
};