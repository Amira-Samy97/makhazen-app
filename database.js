const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// إنشاء الجداول
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_number TEXT,
        item_name TEXT,
        quantity INTEGER,
        available_quantity INTEGER,
        price REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS custodies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT,
        quantity INTEGER,
        receiver TEXT,
        department TEXT,
        date TEXT
    )`);

    // --- أضيفي هذا الجدول الخاص بحركات أمين المخزن ---
    db.run(`CREATE TABLE IF NOT EXISTS store_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT,
        quantity INTEGER,
        receiver TEXT,
        department TEXT,
        date TEXT
    )`);
});

db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    phone TEXT,
    email TEXT,
    role TEXT,
    status TEXT DEFAULT 'active' -- نشط افتراضياً
)`, () => {
    db.get(`SELECT * FROM users WHERE username = ?`, ['shateb'], (err, row) => {
        if (!row) db.run(`INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)`, ['ابراهيم', '123456', '01012345678', 'shateb@system.com', 'shateb']);
    });
    db.get(`SELECT * FROM users WHERE username = ?`, ['custody'], (err, row) => {
        if (!row) db.run(`INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)`, ['محمد', '123456', '01087654321', 'custody@system.com', 'custody']);
    });
    db.get(`SELECT * FROM users WHERE username = ?`, ['manager'], (err, row) => {
        if (!row) db.run(`INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)`, ['ياسر عبدالصادق', '123456', '01000407054', 'manager@system.com', 'manager']);
    });

    // db.get(`SELECT * FROM users WHERE username = ?`, ['storekeeper'], (err, row) => {
    //     if (!row) db.run(`INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)`, ['storekeeper', '123456', '01099887766', 'storekeeper@system.com', 'storekeeper']);
    // });
});

module.exports = db;