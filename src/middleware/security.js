/* ============================================================
   БЕЗОПАСНОСТЬ — Helmet, Rate limit, Валидация
   ============================================================ */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, query, param, validationResult } = require('express-validator');
const cors = require('cors');

// ============================================================
// 1. HELMET — заголовки безопасности
// ============================================================
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // нужно для inline скриптов в HTML
        "https://unpkg.com",
        "https://tile.openstreetmap.org"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://unpkg.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.tile.openstreetmap.org",
        "https://unpkg.com"
      ],
      connectSrc: [
        "'self'",
        "https://*.tile.openstreetmap.org"
      ],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: null  // отключаем для localhost
    }
  },
  crossOriginEmbedderPolicy: false,  // нужно для Leaflet
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

// ============================================================
// 2. CORS
// ============================================================
const corsConfig = cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (Postman, curl, локальные)
    if (!origin) return callback(null, true);

    // Разрешённые домены
    const allowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

    // В продакшене — добавь свой домен
    if (process.env.NODE_ENV === 'production') {
      allowed.push('https://yourdomain.ru');
    }

    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Заблокировано CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
});

// ============================================================
// 3. RATE LIMITING
// ============================================================

// Общий лимит — 500 запросов / 15 минут
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Строгий лимит для авторизации — 5 попыток / 15 минут
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true  // успешные не считаем
});

// Лимит для создания заказов — 10 / час с одного IP
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много заказов с этого IP. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Лимит для загрузки файлов — 30 / час
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Слишком много загрузок. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
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
// 5. ВАЛИДАТОРЫ (наборы правил)
// ============================================================

// Регистрация
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Укажите имя')
    .isLength({ min: 2, max: 100 }).withMessage('Имя от 2 до 100 символов')
    .escape(),
  body('email')
    .trim()
    .isEmail().withMessage('Некорректный email')
    .normalizeEmail()
    .isLength({ max: 255 }),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\d\s+\-()]{7,20}$/).withMessage('Некорректный телефон')
    .escape(),
  body('password')
    .isLength({ min: 6, max: 100 }).withMessage('Пароль от 6 до 100 символов')
];

// Вход
const validateLogin = [
  body('email')
    .trim()
    .isEmail().withMessage('Некорректный email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Введите пароль')
];

// Создание заказа
const validateOrder = [
  body('customer_name')
    .trim()
    .notEmpty().withMessage('Укажите имя')
    .isLength({ min: 2, max: 100 })
    .escape(),
  body('phone')
    .trim()
    .matches(/^[\d\s+\-()]{7,20}$/).withMessage('Некорректный телефон')
    .escape(),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Некорректный email')
    .normalizeEmail(),
  body('address')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .escape(),
  body('comment')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .escape(),
  body('items')
    .isArray({ min: 1, max: 50 }).withMessage('Корзина пуста или слишком большая')
];

// Товар (создание/обновление)
const validateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('Укажите название')
    .isLength({ max: 200 })
    .escape(),
  body('price')
    .isFloat({ min: 0, max: 10000000 }).withMessage('Некорректная цена'),
  body('category_id')
    .isInt({ min: 1 }).withMessage('Выберите категорию'),
  body('description')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2000 })
    .escape(),
  body('weight')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .escape(),
  body('stock')
    .optional()
    .isInt({ min: 0, max: 100000 })
];

// ID в URL
const validateId = [
  param('id')
    .isInt({ min: 1 }).withMessage('Некорректный ID')
];

module.exports = {
  helmetConfig,
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