/* ============================================================
   ПОДКЛЮЧЕНИЕ К SQLITE
   v2.0 — WAL + оптимизация
   ============================================================ */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Путь к папке data
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Путь к БД (можно переопределить через DB_PATH в .env)
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(dataDir, 'shop.db');

const db = new Database(dbPath);

// ============================================================
// ПРАГМЫ
// ============================================================

// ✅ WAL — быстрые записи + конкурентное чтение
db.pragma('journal_mode = WAL');

// ✅ Синхронизация NORMAL — быстро и надёжно (в связке с WAL)
db.pragma('synchronous = NORMAL');

// ✅ Внешние ключи
db.pragma('foreign_keys = ON');

// ✅ Таймаут на блокировки (5 сек)
db.pragma('busy_timeout = 5000');

// ✅ Кэш (10 MB)
db.pragma('cache_size = -10000');

// ✅ Temp-store в памяти
db.pragma('temp_store = MEMORY');

console.log(`📦 База данных подключена: ${dbPath}`);
console.log(`   journal_mode: ${db.pragma('journal_mode', { simple: true })}`);
console.log(`   synchronous:  ${db.pragma('synchronous', { simple: true })}`);
console.log(`   foreign_keys: ${db.pragma('foreign_keys', { simple: true })}`);

module.exports = db;