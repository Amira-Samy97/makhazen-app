const express = require('express');
const session = require('express-session'); // <-- إضافة مكتبة الجلسات
const app = express();
app.use(express.static('public')); 

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// إعداد الجلسة
app.use(session({
    secret: 'inventory-secret-key',
    resave: false,
    saveUninitialized: false
}));

const authRoutes = require('./routes/authRoutes');
app.use('/', authRoutes);

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});