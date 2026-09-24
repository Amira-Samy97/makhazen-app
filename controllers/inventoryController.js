const db = require('../database');

// --- تسجيل الدخول ---
exports.login = async (req, res) => {
    const { username, password, remember } = req.body;
    
    try {
        const result = await db.execute({
            sql: `SELECT * FROM users WHERE username = ? AND password = ?`,
            args: [username, password]
        });
        const user = result.rows[0];
        
        if (!user) {
            return res.render('login', { error: 'اسم المستخدم أو الرقم السري غير صحيح' });
        }
        
        req.session.user = user;

        if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        } else {
            req.session.cookie.expires = false;
        }
        
        if (user.role === 'shateb') {
            res.redirect('/shateb/dashboard');
        } else if (user.role === 'custody') {
            res.redirect('/custody/dashboard');
        } else if (user.role === 'manager') {
            res.redirect('/manager/dashboard');
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        return res.render('login', { error: 'حدث خطأ في النظام، حاول مرة أخرى' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};

exports.resetPassword = async (req, res) => {
    const { username, phone_or_email, new_password } = req.body;
    try {
        const result = await db.execute({
            sql: `SELECT * FROM users WHERE username = ? AND (phone = ? OR email = ?)`,
            args: [username.trim(), phone_or_email.trim(), phone_or_email.trim()]
        });
        const user = result.rows[0];

        if (!user) {
            return res.render('forgot_password', { error: 'تأكد من صحة اسم المستخدم ورقم التليفون أو البريد الإلكتروني', success: null });
        }
        
        await db.execute({
            sql: `UPDATE users SET password = ? WHERE id = ?`,
            args: [new_password, user.id]
        });

        res.render('forgot_password', { error: null, success: 'تم تغيير كلمة السر بنجاح، يمكنك تسجيل الدخول الآن' });
    } catch (err) {
        console.error(err);
        res.render('forgot_password', { error: 'حدث خطأ ما', success: null });
    }
};

exports.getAccount = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const result = await db.execute({
            sql: `SELECT * FROM users WHERE id = ?`,
            args: [req.session.user.id]
        });
        res.render('account', { user: result.rows[0], success: null });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

exports.updateAccount = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { phone, email } = req.body;
    const userId = req.session.user.id;

    try {
        await db.execute({
            sql: `UPDATE users SET phone = ?, email = ? WHERE id = ?`,
            args: [phone, email, userId]
        });

        const result = await db.execute({
            sql: `SELECT * FROM users WHERE id = ?`,
            args: [userId]
        });
        const updatedUser = result.rows[0];

        if (updatedUser) req.session.user = updatedUser;
        res.render('account', { user: updatedUser || req.session.user, success: 'تم حفظ البيانات بنجاح' });
    } catch (err) {
        console.error(err);
        res.redirect('/account');
    }
};

// --- وظائف كاتب الشطب ---
exports.getShatebDashboard = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const result = await db.execute(`SELECT * FROM items`);
        res.render('shateb_dashboard', { items: result.rows, editItem: null });
    } catch (err) {
        console.error(err);
        res.render('shateb_dashboard', { items: [], editItem: null });
    }
};

exports.addItem = async (req, res) => {
    const { item_number, item_name, quantity, price } = req.body;
    const qty = parseInt(quantity);

    try {
        await db.execute({
            sql: `INSERT INTO items (item_number, item_name, quantity, available_quantity, price) VALUES (?, ?, ?, ?, ?)`,
            args: [item_number, item_name, qty, qty, price]
        });
        return res.redirect('/shateb/dashboard');
    } catch (err) {
        console.error(err);
        return res.redirect('/shateb/dashboard');
    }
};

exports.deleteItem = async (req, res) => {
    try {
        await db.execute({
            sql: `DELETE FROM items WHERE id = ?`,
            args: [req.params.id]
        });
        res.redirect('/shateb/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/shateb/dashboard');
    }
};

exports.getEditItem = async (req, res) => {
    try {
        const itemsResult = await db.execute(`SELECT * FROM items`);
        const editResult = await db.execute({
            sql: `SELECT * FROM items WHERE id = ?`,
            args: [req.params.id]
        });
        res.render('shateb_dashboard', { items: itemsResult.rows, editItem: editResult.rows[0] });
    } catch (err) {
        console.error(err);
        res.redirect('/shateb/dashboard');
    }
};

exports.updateItem = async (req, res) => {
    const { item_number, item_name, quantity, price } = req.body;
    try {
        await db.execute({
            sql: `UPDATE items SET item_number = ?, item_name = ?, quantity = ?, price = ? WHERE id = ?`,
            args: [item_number, item_name, quantity, price, req.params.id]
        });
        res.redirect('/shateb/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/shateb/dashboard');
    }
};

// --- لوحة تحكم مسئول العهد وعرض السجل ---
exports.getCustodyDashboard = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    try {
        const custodyResult = await db.execute(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`);
        const itemResult = await db.execute(`SELECT * FROM items`);

        res.render('custody_dashboard', { 
            custodies: custodyResult.rows || [], 
            items: itemResult.rows || [], 
            editCustody: null,
            user: req.session.user,
            error: null 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

exports.addCustody = async (req, res) => {
    const { item_name, quantity, receiver, department, date } = req.body;
    const reqQty = parseInt(quantity);

    try {
        const itemResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ?`,
            args: [item_name]
        });
        const item = itemResult.rows[0];

        if (!item || item.available_quantity < reqQty) {
            const custodyResult = await db.execute(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`);
            const itemRowsResult = await db.execute(`SELECT * FROM items`);

            return res.render('custody_dashboard', { 
                custodies: custodyResult.rows || [], 
                items: itemRowsResult.rows || [], 
                editCustody: null,
                user: req.session.user,
                error: `عذراً! الكمية المطلوبة غير متاحة بالمخزن. المتاح حالياً: ${item ? item.available_quantity : 0}`
            });
        }

        const newAvailableQuantity = item.available_quantity - reqQty;
        await db.execute({
            sql: `UPDATE items SET available_quantity = ? WHERE id = ?`,
            args: [newAvailableQuantity, item.id]
        });

        await db.execute({
            sql: `INSERT INTO custodies (item_name, quantity, receiver, department, date) VALUES (?, ?, ?, ?, ?)`,
            args: [item_name, reqQty, receiver, department, date]
        });

        return res.redirect('/custody/dashboard');
    } catch (err) {
        console.error(err);
        return res.redirect('/custody/dashboard');
    }
};

exports.getEditCustody = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    try {
        const custodyResult = await db.execute(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`);
        const itemResult = await db.execute(`SELECT * FROM items`);
        const editResult = await db.execute({
            sql: `SELECT * FROM custodies WHERE id = ?`,
            args: [req.params.id]
        });

        res.render('custody_dashboard', { 
            custodies: custodyResult.rows || [], 
            items: itemResult.rows || [], 
            editCustody: editResult.rows[0],
            user: req.session.user,
            error: null 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/custody/dashboard');
    }
};

exports.updateCustody = async (req, res) => {
    const { item_name, quantity, receiver, department, date } = req.body;
    const newReqQty = parseInt(quantity);
    const custodyId = req.params.id;

    try {
        const oldCustodyResult = await db.execute({
            sql: `SELECT * FROM custodies WHERE id = ?`,
            args: [custodyId]
        });
        const oldCustody = oldCustodyResult.rows[0];
        if (!oldCustody) return res.redirect('/custody/dashboard');

        const oldItemResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ?`,
            args: [oldCustody.item_name]
        });
        const oldItem = oldItemResult.rows[0];
        if (!oldItem) return res.redirect('/custody/dashboard');

        const restoredAvailable = oldItem.available_quantity + oldCustody.quantity;

        const targetItemResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ?`,
            args: [item_name]
        });
        const targetItem = targetItemResult.rows[0];
        if (!targetItem) return res.redirect('/custody/dashboard');

        let availableCheck = targetItem.available_quantity;
        if (oldItem.id === targetItem.id) {
            availableCheck = restoredAvailable;
        }

        if (availableCheck < newReqQty) {
            const custodyResult = await db.execute(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`);
            const itemResult = await db.execute(`SELECT * FROM items`);
            return res.render('custody_dashboard', { 
                custodies: custodyResult.rows || [], 
                items: itemResult.rows || [], 
                editCustody: oldCustody,
                user: req.session.user,
                error: `فشل التعديل: الكمية المطلوبة أكبر من المتاح (${availableCheck})`
            });
        }

        await db.execute({
            sql: `UPDATE items SET available_quantity = ? WHERE id = ?`,
            args: [restoredAvailable, oldItem.id]
        });

        const finalTargetResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ?`,
            args: [item_name]
        });
        const finalTarget = finalTargetResult.rows[0];
        const finalAvailable = finalTarget.available_quantity - newReqQty;

        await db.execute({
            sql: `UPDATE items SET available_quantity = ? WHERE id = ?`,
            args: [finalAvailable, finalTarget.id]
        });

        await db.execute({
            sql: `UPDATE custodies SET item_name = ?, quantity = ?, receiver = ?, department = ?, date = ? WHERE id = ?`,
            args: [item_name, newReqQty, receiver, department, date, custodyId]
        });

        return res.redirect('/custody/dashboard');
    } catch (err) {
        console.error(err);
        return res.redirect('/custody/dashboard');
    }
};

exports.deleteCustody = async (req, res) => {
    try {
        const custodyResult = await db.execute({
            sql: `SELECT * FROM custodies WHERE id = ?`,
            args: [req.params.id]
        });
        const custody = custodyResult.rows[0];

        if (custody) {
            const itemResult = await db.execute({
                sql: `SELECT * FROM items WHERE item_name = ?`,
                args: [custody.item_name]
            });
            const item = itemResult.rows[0];

            if (item) {
                const restoredAvailable = item.available_quantity + custody.quantity;
                await db.execute({
                    sql: `UPDATE items SET available_quantity = ? WHERE id = ?`,
                    args: [restoredAvailable, item.id]
                });
            }
        }

        await db.execute({
            sql: `DELETE FROM custodies WHERE id = ?`,
            args: [req.params.id]
        });
        res.redirect('/custody/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/custody/dashboard');
    }
};

exports.getWarehouseView = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const result = await db.execute(`SELECT * FROM items`);
        res.render('warehouse_view', { items: result.rows, user: req.session.user });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

// --- لوحة التحكم الرئيسية (الإحصائيات والروابط) ---
exports.getManagerDashboard = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    try {
        const itemCountRes = await db.execute(`SELECT COUNT(*) as count FROM items`);
        const custodyCountRes = await db.execute(`SELECT COUNT(*) as count FROM custodies`);
        const userCountRes = await db.execute(`SELECT COUNT(*) as count FROM users`);
        const itemsRes = await db.execute(`SELECT available_quantity, price FROM items`);

        let totalInventoryValue = 0;
        const items = itemsRes.rows;
        if (items && items.length > 0) {
            items.forEach(item => {
                const qty = parseFloat(item.available_quantity) || 0;
                const price = parseFloat(item.price) || 0;
                totalInventoryValue += (qty * price);
            });
        }

        res.render('manager_dashboard', { 
            itemCount: itemCountRes.rows[0] ? itemCountRes.rows[0].count : 0, 
            custodyCount: custodyCountRes.rows[0] ? custodyCountRes.rows[0].count : 0, 
            userCount: userCountRes.rows[0] ? userCountRes.rows[0].count : 0,
            totalInventoryValue: totalInventoryValue,
            user: req.session.user 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

exports.getManagerItems = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    try {
        const result = await db.execute(`SELECT * FROM items`);
        res.render('manager_items', { 
            items: result.rows || [], 
            user: req.session.user 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

exports.getManagerCustodies = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    const searchQuery = req.query.search ? `%${req.query.search}%` : '%';
    const query = `
        SELECT custodies.*, items.item_number 
        FROM custodies 
        LEFT JOIN items ON custodies.item_name = items.item_name 
        WHERE custodies.receiver LIKE ? OR custodies.item_name LIKE ?
    `;

    try {
        const result = await db.execute({
            sql: query,
            args: [searchQuery, searchQuery]
        });
        res.render('manager_custodies', { 
            custodies: result.rows || [], 
            user: req.session.user,
            searchVal: req.query.search || '' 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/manager/dashboard');
    }
};

exports.getManagerUsers = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    try {
        const result = await db.execute(`SELECT * FROM users`);
        res.render('manager_users', { 
            users: result.rows || [], 
            user: req.session.user,
            error: null,
            query: req.query 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

exports.addUser = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const { username, password, phone, email, role } = req.body;

    try {
        await db.execute({
            sql: `INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)`,
            args: [username, password, phone, email, role]
        });
        res.redirect('/manager/users');
    } catch (err) {
        const result = await db.execute(`SELECT * FROM users`);
        return res.render('manager_users', { 
            users: result.rows || [], 
            user: req.session.user,
            error: 'فشل الإضافة: اسم المستخدم قد يكون مستخدماً من قبل.',
            query: {}
        });
    }
};

exports.updateUser = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const userId = req.params.id;
    const { username, password, phone, email, role } = req.body;

    try {
        await db.execute({
            sql: `UPDATE users SET username = ?, password = ?, phone = ?, email = ?, role = ? WHERE id = ?`,
            args: [username, password, phone, email, role, userId]
        });
        res.redirect('/manager/users?success=updated');
    } catch (err) {
        console.log(err);
        res.redirect('/manager/users?error=db_error');
    }
};

exports.deleteUser = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const userId = req.params.id;
    if (parseInt(userId) === req.session.user.id) {
        return res.redirect('/manager/users');
    }

    try {
        await db.execute({
            sql: `DELETE FROM users WHERE id = ?`,
            args: [userId]
        });
        res.redirect('/manager/users?success=deleted');
    } catch (err) {
        console.log(err);
        res.redirect('/manager/users?error=db_error');
    }
};