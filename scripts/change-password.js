#!/usr/bin/env node
/* ============================================================
   СМЕНА ПАРОЛЯ ПОЛЬЗОВАТЕЛЮ — Cake.Me
   ============================================================

   Использование:
   1. Показать список:  node scripts/change-password.js list
   2. Интерактивно:     node scripts/change-password.js
   3. Одной командой:   node scripts/change-password.js admin@cake.ru НовыйПароль123
   ============================================================ */

const bcrypt = require('bcryptjs');
const readline = require('readline');
const db = require('../src/db');

// ============================================================
// Утилиты
// ============================================================
function getUsers() {
  return db.prepare(`
    SELECT id, name, email, role, is_active, twofa_enabled, created_at
    FROM users
    ORDER BY id ASC
  `).all();
}

function findUser(email) {
  return db.prepare(`
    SELECT id, name, email, role, is_active
    FROM users
    WHERE email = ?
  `).get(String(email).trim().toLowerCase());
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    return 'Пароль должен быть минимум 6 символов';
  }
  if (password.length > 100) {
    return 'Пароль слишком длинный (макс 100 символов)';
  }
  return null;
}

// ============================================================
// Красивый вывод списка пользователей
// ============================================================
function showUsers() {
  const users = getUsers();

  if (users.length === 0) {
    console.log('❌ В базе нет пользователей');
    return;
  }

  console.log('\n📋 Пользователи в базе:\n');
  console.log('   ' + 'ID'.padEnd(5) + 'EMAIL'.padEnd(28) + 'РОЛЬ'.padEnd(14) + 'ИМЯ');
  console.log('   ' + '─'.repeat(72));

  users.forEach(u => {
    const roleIcon = {
      admin: '👑',
      manager: '🧑‍💼',
      client: '👤'
    }[u.role] || '•';

    const statusIcon = u.is_active ? '✅' : '🚫';
    const twofaIcon = u.twofa_enabled ? '🔐' : '';

    console.log(
      '   ' +
      String(u.id).padEnd(5) +
      u.email.padEnd(28) +
      (roleIcon + ' ' + u.role).padEnd(14) +
      u.name + ' ' + statusIcon + ' ' + twofaIcon
    );
  });

  console.log('\n   Легенда: 👑 админ | 🧑‍💼 менеджер | 👤 клиент');
  console.log('           ✅ активен | 🚫 заблокирован | 🔐 2FA включена\n');
}

// ============================================================
// Смена пароля одной командой
// ============================================================
function changePassword(email, newPassword) {
  const user = findUser(email);

  if (!user) {
    console.error(`\n❌ Пользователь "${email}" не найден.\n`);
    console.error('💡 Посмотреть список: node scripts/change-password.js list\n');
    process.exit(1);
  }

  const validationError = validatePassword(newPassword);
  if (validationError) {
    console.error(`\n❌ ${validationError}\n`);
    process.exit(1);
  }

  const hash = bcrypt.hashSync(newPassword, 10);

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  console.log('\n✅ Пароль успешно изменён!\n');
  console.log(`   👤 ${user.name}`);
  console.log(`   📧 ${user.email}`);
  console.log(`   🎭 Роль: ${user.role}`);
  console.log(`   🔑 Новый пароль: ${newPassword}`);
  console.log('\n💡 Не забудь сохранить новый пароль в надёжном месте.\n');
}

// ============================================================
// Скрытый ввод пароля (звёздочками)
// ============================================================
function questionHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const stdin = process.stdin;

    const onData = (char) => {
      const str = char.toString('utf8');
      const len = str.length;

      if (str === '\n' || str === '\r' || str === '\r\n') {
        stdin.removeListener('data', onData);
      } else {
        process.stdout.write('*'.repeat(len));
      }
    };

    process.stdout.write(query);
    stdin.on('data', onData);

    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ============================================================
// Интерактивный режим
// ============================================================
async function interactive() {
  console.log('\n🔐 Смена пароля пользователю — Cake.Me\n');

  showUsers();

  let email = await question('📧 Введите email пользователя: ');

  if (!email) {
    console.log('\n❌ Email не указан. Выход.\n');
    process.exit(0);
  }

  let user = findUser(email);

  while (!user) {
    console.log(`\n❌ Пользователь "${email}" не найден.\n`);

    const retry = await question('Попробовать ещё раз? (y/n): ');
    if (retry.toLowerCase() !== 'y' && retry.toLowerCase() !== 'yes') {
      process.exit(0);
    }

    email = await question('\n📧 Введите email: ');
    user = findUser(email);
  }

  console.log(`\n   👤 Найден: ${user.name} (${user.role})\n`);

  const password = await questionHidden('🔑 Новый пароль: ');

  const validationError = validatePassword(password);
  if (validationError) {
    console.log(`\n❌ ${validationError}\n`);
    process.exit(1);
  }

  const confirm = await questionHidden('🔑 Повторите пароль: ');

  if (password !== confirm) {
    console.log('\n❌ Пароли не совпадают. Выход.\n');
    process.exit(1);
  }

  console.log('\n' + '─'.repeat(50));
  console.log('   Подтвердите смену пароля:');
  console.log(`   👤 ${user.name} (${user.email})`);
  console.log(`   🎭 Роль: ${user.role}`);
  console.log('─'.repeat(50));

  const confirmChange = await question('\n   Изменить пароль? (y/n): ');

  if (confirmChange.toLowerCase() !== 'y' && confirmChange.toLowerCase() !== 'yes') {
    console.log('\n❌ Отменено.\n');
    process.exit(0);
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  console.log('\n✅ Пароль успешно изменён!\n');
  console.log(`   📧 ${user.email}`);
  console.log(`   🔑 Новый пароль: ${password}`);
  console.log('\n💡 Не забудь сохранить новый пароль в надёжном месте.\n');
}

// ============================================================
// MAIN
// ============================================================
function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    console.log(`
🔐 Смена пароля пользователю — Cake.Me

Использование:

  node scripts/change-password.js list
      → Показать список всех пользователей

  node scripts/change-password.js
      → Интерактивная смена пароля

  node scripts/change-password.js <email> <новый_пароль>
      → Смена пароля одной командой

Примеры:

  node scripts/change-password.js list
  node scripts/change-password.js
  node scripts/change-password.js admin@cake.ru MyStr0ngP@ss!
  node scripts/change-password.js manager@cake.ru ManagerSecure2026!
`);
    process.exit(0);
  }

  if (args[0] === 'list' || args[0] === 'ls') {
    showUsers();
    process.exit(0);
  }

  if (args.length === 2) {
    changePassword(args[0], args[1]);
    process.exit(0);
  }

  if (args.length > 2) {
    console.error('\n❌ Слишком много аргументов.\n');
    console.error('💡 Использование: node scripts/change-password.js <email> <пароль>\n');
    process.exit(1);
  }

  interactive().catch(err => {
    console.error('\n❌ Ошибка:', err.message, '\n');
    process.exit(1);
  });
}

main();