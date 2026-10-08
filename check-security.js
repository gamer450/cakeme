const db = require('./src/db');

console.log('\n=== Honeypot события ===');
const honeypotEvents = db.prepare(`
  SELECT event_type, ip, meta, created_at
  FROM security_events
  WHERE event_type = 'honeypot_triggered'
  ORDER BY id DESC LIMIT 5
`).all();
console.log(honeypotEvents);

console.log('\n=== Все типы событий ===');
const types = db.prepare(`
  SELECT event_type, COUNT(*) as count
  FROM security_events
  GROUP BY event_type
`).all();
console.log(types);

console.log('\n=== Заблокированные IP ===');
const blocked = db.prepare('SELECT * FROM blocked_ips').all();
console.log(blocked);