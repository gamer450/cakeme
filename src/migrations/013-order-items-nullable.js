/* ============================================================
   МИГРАЦИЯ: Разрешить NULL для product_id в order_items
   Это нужно для кастомных тортов, у которых нет product_id
   Запуск: node src/migrations/013-order-items-nullable.js
   ============================================================ */

const db = require('../db');

console.log('🔧 Миграция order_items.product_id → NULL разрешён...\n');

// Проверяем текущее состояние
const cols = db.prepare('PRAGMA table_info(order_items)').all();
const productIdCol = cols.find(c => c.name === 'product_id');

console.log(`   product_id: notnull=${productIdCol.notnull}, type=${productIdCol.type}`);

if (productIdCol.notnull === 0) {
  console.log('✅ Уже позволяет NULL — ничего не надо менять');
  process.exit(0);
}

console.log('\n⚠️  product_id = NOT NULL. Пересоздаём таблицу...\n');

// SQLite не поддерживает ALTER COLUMN.
// Пересоздаём таблицу через 4 шага:
// 1. Создаём новую таблицу с нужной схемой
// 2. Копируем данные
// 3. Удаляем старую
// 4. Переименовываем новую

try {
  db.transaction(() => {
    // Проверяем, есть ли уже старая резервная
    db.exec(`DROP TABLE IF EXISTS order_items_old`);

    // 1. Переименовываем старую во временную
    db.exec(`ALTER TABLE order_items RENAME TO order_items_old`);

    // 2. Создаём новую таблицу с product_id NULLABLE
    db.exec(`
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price REAL NOT NULL,
        is_custom INTEGER NOT NULL DEFAULT 0,
        custom_params TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      );
    `);

    // 3. Копируем данные
    db.exec(`
      INSERT INTO order_items (id, order_id, product_id, product_name, quantity, price, is_custom, custom_params)
      SELECT id, order_id, product_id, product_name, quantity, price,
             COALESCE(is_custom, 0),
             custom_params
      FROM order_items_old;
    `);

    // 4. Удаляем старую
    db.exec(`DROP TABLE order_items_old`);

    console.log('✅ Таблица order_items пересоздана');
  })();

  // Проверяем результат
  const newCol = db.prepare('PRAGMA table_info(order_items)').all().find(c => c.name === 'product_id');
  console.log(`\n📋 Новая схема product_id: notnull=${newCol.notnull}`);

  if (newCol.notnull === 0) {
    console.log('\n🎉 Готово! product_id теперь позволяет NULL');
    console.log('Перезапусти сервер: npm run dev');
  }
} catch (err) {
  console.error('\n❌ Ошибка миграции:', err.message);
  console.error('Структура БД может быть повреждена. Восстановите из бэкапа:');
  console.error('  data/backups/ — самые свежие .db файлы');
  process.exit(1);
}