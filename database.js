const { createClient } = require("@libsql/client");

// لو شغالين على السحابة يقرأ من البيئة، ولو محلي ممكن نحط الرابط للتجربة أو نخليه sqlite عادي
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://makhazen-amira-samy97.aws-eu-west-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIzMzUyMTEsImlkIjoiMDFhMGQyY2ItYTgwMS03YjNhLWJlYWMtODQ0YzUwZWQ2YjVjIiwia2lkIjoiVDVya1VRYm5SaXJpbXBwZ3d4NEY1SUtUbVJ2TWp4djY0TFN3Q25DQnVMVSIsInJpZCI6Ijc5ODAxOTAzLTk1ZTAtNDcwZi1hNjE1LTg3ZjJkN2VlMTg5NCJ9.Aukhn_4gU2Yt5d9IXNy4TYCaJDxQLC7TFeglPXt5bPbVc9lzURN0eMIfQ2xjXqqW8ayjm93qIoySOVtgRuhPDg",
});

// تهيئة الجداول وإدخال البيانات الافتراضية
async function initializeDatabase() {
  try {    
    // جدول الأصناف (مع إضافة عمود نوع المخزن store_type)
    await db.execute(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_number TEXT,
        item_name TEXT,
        quantity INTEGER,
        available_quantity INTEGER,
        price REAL,
        store_type TEXT DEFAULT 'مستهلك'
    )`);

    try {
      await db.execute(`ALTER TABLE items ADD COLUMN store_type TEXT DEFAULT 'مستهلك'`);
    } catch (e) {}

    await db.execute(`CREATE TABLE IF NOT EXISTS custodies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT,
        quantity INTEGER,
        receiver TEXT,
        department TEXT,
        date TEXT,
        store_type TEXT DEFAULT 'مستهلك'
    )`);

    try {
      await db.execute(`ALTER TABLE custodies ADD COLUMN store_type TEXT DEFAULT 'مستهلك'`);
    } catch (e) {}

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

    // إدخال المستخدمين الافتراضيين لو مش موجودين (بالبحث عن الـ username)
    const users = [
      { username: 'ابراهيم', pass: '123456', phone: '01012345678', email: 'shateb@system.com', role: 'shateb' },
      { username: 'محمد', pass: '123456', phone: '01087654321', email: 'custody@system.com', role: 'custody' },
      { username: 'ياسر عبدالصادق', pass: '123456', phone: '01000407054', email: 'manager@system.com', role: 'manager' }
    ];

    for (let u of users) {
      const existing = await db.execute({
        sql: "SELECT * FROM users WHERE username = ?",
        args: [u.username]
      });
      
      if (existing.rows.length === 0) {
        await db.execute({
          sql: "INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)",
          args: [u.username, u.pass, u.phone, u.email, u.role]
        });
      }
    }

    console.log("Database initialized successfully locally!");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

initializeDatabase();

module.exports = db;