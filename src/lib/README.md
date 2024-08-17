## db.js

API wrapped for sql.js

### Usage

```js
(async () => {
  // Open or create a new database
  const db = await DB.openDB('myDatabase');

  // Create a table
  await db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)');

  // Insert data
  await db.exec('INSERT INTO users (name, age) VALUES ("Alice", 30)');

  // Query data
  const users = await db.exec('SELECT * FROM users');
  console.log(users);

  // Update data
  await db.exec('UPDATE users SET age = 31 WHERE name = "Alice"');

  // Delete data
  await db.exec('DELETE FROM users WHERE name = "Alice"');

  // Save database to dump
  const dump = db.save();
  console.log('Database dump:', dump);

  // Load database from dump
  await db.load(dump);

  // Merge with another dump
  const anotherDump = '...'; // SQL dump from another database
  await db.merge(anotherDump);
})();
```

## n-raft

Protocol for synchronize data in unstable cluster