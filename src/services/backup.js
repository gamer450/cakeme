/* ============================================================
   РЕЗЕРВНОЕ КОПИРОВАНИЕ БАЗЫ ДАННЫХ
   ============================================================ */

const fs = require('fs');
const path = require('path');

// ✅ ФИКС: путь к БД тот же, что и в db.js
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', '..', 'data', 'shop.db');

const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
const MAX_BACKUPS = 30;  // храним последние 30 бэкапов

// Создаём папку бэкапов
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ============================================================
// Создать бэкап
// ============================================================
function createBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn('⚠️  База данных не найдена — пропускаем бэкап');
      return null;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);

    const backupName = `shop-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    // ✅ ФИКС: VACUUM INTO — атомарный бэкап (совместимо с WAL)
    let success = false;

    try {
      const Database = require('better-sqlite3');
      const sourceDb = new Database(DB_PATH, { readonly: true });

      // Экранируем путь для SQL
      const safePath = backupPath.replace(/'/g, "''");
      sourceDb.exec(`VACUUM INTO '${safePath}'`);
      sourceDb.close();

      success = true;
    } catch (err) {
      console.warn('⚠️  VACUUM INTO не сработал, fallback на wal_checkpoint:', err.message);

      // Fallback: делаем checkpoint и копируем
      try {
        const db = require('../db');
        db.pragma('wal_checkpoint(TRUNCATE)');
        fs.copyFileSync(DB_PATH, backupPath);
        success = true;
      } catch (err2) {
        console.error('❌ Оба способа бэкапа провалились:', err2.message);
      }
    }

    if (!success) return null;

    const stats = fs.statSync(backupPath);
    console.log(`✅ Бэкап создан: ${backupName} (${(stats.size / 1024).toFixed(1)} КБ)`);

    cleanupOldBackups();

    return backupName;
  } catch (err) {
    console.error('❌ Ошибка создания бэкапа:', err);
    return null;
  }
}

// ============================================================
// Удалить старые бэкапы (оставляем последние MAX_BACKUPS)
// ============================================================
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('shop-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);  // новые сначала

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f.name));
        console.log(`🗑️  Старый бэкап удалён: ${f.name}`);
      });
    }
  } catch (err) {
    console.error('Ошибка очистки бэкапов:', err);
  }
}

// ============================================================
// Список бэкапов
// ============================================================
function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('shop-') && f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size: stat.size,
          sizeFormatted: `${(stat.size / 1024).toFixed(1)} КБ`,
          createdAt: stat.mtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files;
  } catch (err) {
    console.error('Ошибка списка бэкапов:', err);
    return [];
  }
}

// ============================================================
// Восстановить из бэкапа
// ============================================================
function restoreBackup(backupName) {
  try {
    const safeName = path.basename(backupName);

    // ✅ ФИКС: защита от path traversal
    if (!safeName.match(/^shop-[\d\-T]+\.db$/)) {
      throw new Error('Недопустимое имя бэкапа');
    }

    const backupPath = path.join(BACKUP_DIR, safeName);

    if (!fs.existsSync(backupPath)) {
      throw new Error('Бэкап не найден');
    }

    // ✅ ФИКС: ЗАКРЫВАЕМ текущее соединение (иначе порча SQLite)
    const db = require('../db');
    try {
      db.close();
    } catch (err) {
      console.warn('Не удалось закрыть db:', err.message);
    }

    fs.copyFileSync(backupPath, DB_PATH);

    // ✅ Удаляем устаревшие WAL/SHM
    try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
    try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}

    console.log(`♻️  Восстановлено из бэкапа: ${safeName}`);
    console.log('⚠️  Сервер нужно перезапустить.');

    return true;
  } catch (err) {
    console.error('Ошибка восстановления:', err);
    throw err;
  }
}

// ============================================================
// Экспорт
// ============================================================
module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  cleanupOldBackups
};