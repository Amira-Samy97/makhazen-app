const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

// تحديد المسارات المطلقة لتعمل بكفاءة على Vercel
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
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

// التشغيل محلياً فقط لو مش شغالة على Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => {
        console.log('Server is running on http://localhost:3000');
    });
}

// تصدير التطبيق ليعمل على Vercel Serverless
module.exports = app;
