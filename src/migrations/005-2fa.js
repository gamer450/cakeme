/* ============================================================
   МИГРАЦИЯ: Волна 5 — 2FA для админов
   Запуск: node src/migrations/005-2fa.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция Wave 5 — 2FA...\n');

const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);

// Секрет для TOTP
if (!userCols.includes('twofa_secret')) {
  db.exec(`ALTER TABLE users ADD COLUMN twofa_secret TEXT`);
  console.log('✅ users.twofa_secret добавлено');
} else {
  console.log('ℹ️  users.twofa_secret уже есть');
}

// Включена ли 2FA
if (!userCols.includes('twofa_enabled')) {
  db.exec(`ALTER TABLE users ADD COLUMN twofa_enabled INTEGER NOT NULL DEFAULT 0`);
  console.log('✅ users.twofa_enabled добавлено');
} else {
  console.log('ℹ️  users.twofa_enabled уже есть');
}

// Резервные коды (JSON)
if (!userCols.includes('twofa_backup_codes')) {
  db.exec(`ALTER TABLE users ADD COLUMN twofa_backup_codes TEXT`);
  console.log('✅ users.twofa_backup_codes добавлено');
} else {
  console.log('ℹ️  users.twofa_backup_codes уже есть');
}

// Время последнего успешного 2FA (для аудита)
if (!userCols.includes('twofa_last_used')) {
  db.exec(`ALTER TABLE users ADD COLUMN twofa_last_used TEXT`);
  console.log('✅ users.twofa_last_used добавлено');
} else {
  console.log('ℹ️  users.twofa_last_used уже есть');
}

console.log('\n📋 Структура users (2FA-поля):');
const newCols = db.prepare('PRAGMA table_info(users)').all()
  .filter(c => c.name.startsWith('twofa_'));
newCols.forEach(c => {
  console.log(`   ${c.name.padEnd(25)} ${c.type || '—'}`);
});

console.log('\n🎉 Миграция Wave 5 завершена!');
console.log('Перезапусти сервер: npm run dev');