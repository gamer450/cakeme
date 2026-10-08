/* ============================================================
   ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
   Ловит 404 + все исключения, пишет в лог
   ============================================================ */

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', '..', 'data', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const errorLogFile = path.join(logDir, 'errors.log');


// ✅ Экранирование HTML (для безопасного встраивания в ответы)
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ✅ Санитизация URL — скрываем токены и обрезаем
function sanitizeUrl(url) {
  return String(url || '')
    .replace(/([?&](?:token|password|secret|key|jwt|auth)=)[^&]*/gi, '$1***')
    .slice(0, 500);
}

function logError(err, req) {
  // ✅ Санитизация + обрезка
  const line = [
    `[${new Date().toISOString()}]`,
    `${req.method} ${sanitizeUrl(req.originalUrl)}`,
    `IP: ${req.ip || '—'}`,
    `MSG: ${String(err.message || err).slice(0, 500)}`,
    err.stack ? `STACK:\n${String(err.stack).slice(0, 2000)}` : '',
    '---'
  ].join(' | ') + '\n';

  fs.appendFile(errorLogFile, line, 'utf8', (e) => {
    if (e) console.error('Не удалось записать лог ошибки:', e.message);
  });
}

function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Не найдено' });
  }
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>404 — Не найдено</title>
      <style>
        body { font-family: system-ui; background: #0E0A08; color: #F5EDE4;
               display: flex; align-items: center; justify-content: center;
               min-height: 100vh; margin: 0; text-align: center; }
        h1 { font-size: 5rem; margin: 0; color: #E8A87C; }
        p { color: #A89888; }
        a { color: #C9A961; }
      </style>
    </head>
    <body>
      <div>
        <h1>404</h1>
        <p>Страница не найдена</p>
        <a href="/">← На главную</a>
      </div>
    </body>
    </html>
  `);
}

function errorHandler(err, req, res, next) {
  logError(err, req);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Внутренняя ошибка сервера'
    : String(err.message || 'Ошибка');

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: message });
  }

  // ✅ Экранируем message перед вставкой в HTML (защита от XSS)
  res.status(status).send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Ошибка ${status}</title>
      <style>
        body { font-family: system-ui; background: #0E0A08; color: #F5EDE4;
               display: flex; align-items: center; justify-content: center;
               min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
        h1 { font-size: 5rem; margin: 0; color: #E07878; }
        p { color: #A89888; max-width: 500px; }
        a { color: #C9A961; }
      </style>
    </head>
    <body>
      <div>
        <h1>${status}</h1>
        <p>${escapeHtml(message)}</p>
        <a href="/">← На главную</a>
      </div>
    </body>
    </html>
  `);
}

module.exports = {
  notFoundHandler,
  errorHandler,
  logError
};