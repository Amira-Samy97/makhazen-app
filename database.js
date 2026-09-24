const { createClient } = require("@libsql/client");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// تهيئة الجداول وإدخال البيانات الافتراضية
async function initializeDatabase() {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_number TEXT,
        item_name TEXT,
        quantity INTEGER,
        available_quantity INTEGER,
        price REAL
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS custodies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT,
        quantity INTEGER,
        receiver TEXT,
        department TEXT,
        date TEXT
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS store_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT,
        quantity INTEGER,
        receiver TEXT,
        department TEXT,
        date TEXT
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        phone TEXT,
        email TEXT,
        role TEXT,
        status TEXT DEFAULT 'active'
    )`);

    // إدخال المستخدمين الافتراضيين لو مش موجودين
    const users = [
      { username: 'ابراهيم', pass: '123456', phone: '01012345678', email: 'shateb@system.com', role: 'shateb' },
      { username: 'محمد', pass: '123456', phone: '01087654321', email: 'custody@system.com', role: 'custody' },
      { username: 'ياسر عبدالصادق', pass: '123456', phone: '01000407054', email: 'manager@system.com', role: 'manager' }
    ];

    for (let u of users) {
      const existing = await db.execute({
        sql: "SELECT * FROM users WHERE role = ?",
        args: [u.role]
      });
      
      if (existing.rows.length === 0) {
        await db.execute({
          sql: "INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)",
          args: [u.username, u.pass, u.phone, u.email, u.role]
        });
      }
    }

    console.log("Database initialized successfully with Turso!");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

initializeDatabase();

module.exports = db;