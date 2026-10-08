/* ============================================================
   МИГРАЦИЯ: Заявки «Связаться с оператором»
   Запуск: node src/migrate-operator.js
   ============================================================ */

const db = require('./db');

console.log('🔧 Миграция: заявки оператору...');

// ============================================================
// 1. Таблица operator_requests
// ============================================================
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

console.log('✅ Таблица operator_requests создана');

// ============================================================
// 2. Индексы
// ============================================================
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_operator_requests_status
  ON operator_requests(status, created_at DESC);
`);

console.log('✅ Индексы созданы');

// ============================================================
// 3. Проверка
// ============================================================
const count = db.prepare('SELECT COUNT(*) as c FROM operator_requests').get().c;
console.log(`ℹ️  Заявок в базе: ${count}`);

console.log('\n🎉 Миграция завершена!');
console.log('\nДальнейшие шаги:');
console.log('  1. Патч server.js (endpoints)');
console.log('  2. Файл public/js/operator-form.js');
console.log('  3. Файл public/css/operator-form.css');
console.log('  4. Файл public/js/admin-operator.js');
console.log('  5. Подключение в HTML');