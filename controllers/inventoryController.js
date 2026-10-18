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
// --- وظائف كاتب الشطب (مع دعم تقسيم المخازن الثلاثة) ---

exports.getShatebDashboard = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const selectedStore = req.query.store || 'مستهلك'; 
    
    try {
        const result = await db.execute({
            sql: `SELECT * FROM items WHERE store_type = ?`,
            args: [selectedStore]
        });
        res.render('shateb_dashboard', { 
            items: result.rows || [], 
            editItem: null, 
            selectedStore: selectedStore 
        });
    } catch (err) {
        console.error(err);
        res.render('shateb_dashboard', { items: [], editItem: null, selectedStore: selectedStore });
    }
};

exports.addItem = async (req, res) => {
    const { item_number, item_name, quantity, price, store_type } = req.body;
    const qty = parseInt(quantity) || 0;
    const itemPrice = parseFloat(price) || 0;
    
    // ضمان أخذ قيمة المخزن بوضوح من الـ body أو من الـ query أو افتراضياً 'مستهلك'
    const store = (store_type && store_type.trim() !== '') 
        ? store_type.trim() 
        : (req.query.store || 'مستهلك');

    try {
        await db.execute({
            sql: `INSERT INTO items (item_number, item_name, quantity, available_quantity, price, store_type) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [item_number, item_name, qty, qty, itemPrice, store]
        });
        
        console.log(`تم إضافة الصنف (${item_name}) بنجاح إلى مخزن: ${store}`);
        return res.redirect(`/shateb/dashboard?store=${encodeURIComponent(store)}`);
    } catch (err) {
        console.error("خطأ أثناء إضافة الصنف:", err);
        return res.redirect(`/shateb/dashboard?store=${encodeURIComponent(store)}`);
    }
};
exports.deleteItem = async (req, res) => {
    const store = req.query.store || 'مستهلك';
    try {
        await db.execute({
            sql: `DELETE FROM items WHERE id = ?`,
            args: [req.params.id]
        });
        res.redirect(`/shateb/dashboard?store=${encodeURIComponent(store)}`);
    } catch (err) {
        console.error(err);
        res.redirect(`/shateb/dashboard?store=${encodeURIComponent(store)}`);
    }
};

exports.getEditItem = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const store = req.query.store || 'مستهلك';

    try {
        const itemsResult = await db.execute({
            sql: `SELECT * FROM items WHERE store_type = ?`,
            args: [store]
        });
        const editResult = await db.execute({
            sql: `SELECT * FROM items WHERE id = ?`,
            args: [req.params.id]
        });
        res.render('shateb_dashboard', { 
            items: itemsResult.rows || [], 
            editItem: editResult.rows[0], 
            selectedStore: store 
        });
    } catch (err) {
        console.error(err);
        res.redirect(`/shateb/dashboard?store=${encodeURIComponent(store)}`);
    }
};

exports.updateItem = async (req, res) => {
    const { item_number, item_name, quantity, price, store_type } = req.body;
    const store = store_type || 'مستهلك';

    try {
        await db.execute({
            sql: `UPDATE items SET item_number = ?, item_name = ?, quantity = ?, price = ? WHERE id = ?`,
            args: [item_number, item_name, quantity, price, req.params.id]
        });
        res.redirect(`/shateb/dashboard?store=${encodeURIComponent(store)}`);
    } catch (err) {
        console.error(err);
        res.redirect(`/shateb/dashboard?store=${encodeURIComponent(store)}`);
    }
};

// --- لوحة تحكم مسئول العهد وعرض السجل ---
// --- لوحة تحكم مسئول العهد وعرض السجل (مع دعم تقسيم المخازن) ---
exports.getCustodyDashboard = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const selectedStore = req.query.store || 'مستهلك';
    
    try {
        // جلب العهد الخاصة بالمخزن المختار أو جلب الكل حسب تفضيلك، والأفضل جلب أصناف المخزن المختار فقط للقائمة المنسدلة
        const custodyResult = await db.execute({
            sql: `SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name WHERE items.store_type = ?`,
            args: [selectedStore]
        });
        
        const itemResult = await db.execute({
            sql: `SELECT * FROM items WHERE store_type = ? AND available_quantity > 0`,
            args: [selectedStore]
        });

        res.render('custody_dashboard', { 
            custodies: custodyResult.rows || [], 
            items: itemResult.rows || [], 
            editCustody: null,
            user: req.session.user,
            selectedStore: selectedStore,
            error: null 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

exports.addCustody = async (req, res) => {
    const { item_name, quantity, receiver, department, date, store_type } = req.body;
    const reqQty = parseInt(quantity);
    const store = store_type || 'مستهلك';

    try {
        const itemResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ? AND store_type = ?`,
            args: [item_name, store]
        });
        const item = itemResult.rows[0];

        if (!item || item.available_quantity < reqQty) {
            const custodyResult = await db.execute({
                sql: `SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name WHERE items.store_type = ?`,
                args: [store]
            });
            const itemRowsResult = await db.execute({
                sql: `SELECT * FROM items WHERE store_type = ? AND available_quantity > 0`,
                args: [store]
            });

            return res.render('custody_dashboard', { 
                custodies: custodyResult.rows || [], 
                items: itemRowsResult.rows || [], 
                editCustody: null,
                user: req.session.user,
                selectedStore: store,
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

        return res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);
    } catch (err) {
        console.error(err);
        return res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);
    }
};

exports.getEditCustody = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const store = req.query.store || 'مستهلك';
    
    try {
        const custodyResult = await db.execute({
            sql: `SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name WHERE items.store_type = ?`,
            args: [store]
        });
        const itemResult = await db.execute({
            sql: `SELECT * FROM items WHERE store_type = ?`,
            args: [store]
        });
        const editResult = await db.execute({
            sql: `SELECT * FROM custodies WHERE id = ?`,
            args: [req.params.id]
        });

        res.render('custody_dashboard', { 
            custodies: custodyResult.rows || [], 
            items: itemResult.rows || [], 
            editCustody: editResult.rows[0],
            user: req.session.user,
            selectedStore: store,
            error: null 
        });
    } catch (err) {
        console.error(err);
        res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);
    }
};

exports.updateCustody = async (req, res) => {
    const { item_name, quantity, receiver, department, date, store_type } = req.body;
    const newReqQty = parseInt(quantity);
    const custodyId = req.params.id;
    const store = store_type || 'مستهلك';

    try {
        const oldCustodyResult = await db.execute({
            sql: `SELECT * FROM custodies WHERE id = ?`,
            args: [custodyId]
        });
        const oldCustody = oldCustodyResult.rows[0];
        if (!oldCustody) return res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);

        const oldItemResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ?`,
            args: [oldCustody.item_name]
        });
        const oldItem = oldItemResult.rows[0];
        if (!oldItem) return res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);

        const restoredAvailable = oldItem.available_quantity + oldCustody.quantity;

        const targetItemResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ? AND store_type = ?`,
            args: [item_name, store]
        });
        const targetItem = targetItemResult.rows[0];
        if (!targetItem) return res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);

        let availableCheck = targetItem.available_quantity;
        if (oldItem.id === targetItem.id) {
            availableCheck = restoredAvailable;
        }

        if (availableCheck < newReqQty) {
            const custodyResult = await db.execute({
                sql: `SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name WHERE items.store_type = ?`,
                args: [store]
            });
            const itemResult = await db.execute({
                sql: `SELECT * FROM items WHERE store_type = ?`,
                args: [store]
            });
            return res.render('custody_dashboard', { 
                custodies: custodyResult.rows || [], 
                items: itemResult.rows || [], 
                editCustody: oldCustody,
                user: req.session.user,
                selectedStore: store,
                error: `فشل التعديل: الكمية المطلوبة أكبر من المتاح (${availableCheck})`
            });
        }

        await db.execute({
            sql: `UPDATE items SET available_quantity = ? WHERE id = ?`,
            args: [restoredAvailable, oldItem.id]
        });

        const finalTargetResult = await db.execute({
            sql: `SELECT * FROM items WHERE item_name = ? AND store_type = ?`,
            args: [item_name, store]
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

        return res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);
    } catch (err) {
        console.error(err);
        return res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);
    }
};

exports.deleteCustody = async (req, res) => {
    const store = req.query.store || 'مستهلك';
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
        res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);
    } catch (err) {
        console.error(err);
        res.redirect(`/custody/dashboard?store=${encodeURIComponent(store)}`);
    }
};

exports.getWarehouseView = async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const store = req.query.store || 'مستهلك';
    try {
        const result = await db.execute({
            sql: `SELECT * FROM items WHERE store_type = ?`,
            args: [store]
        });
        res.render('warehouse_view', { items: result.rows, user: req.session.user, selectedStore: store });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};
// --- لوحة التحكم الرئيسية (الإحصائيات والروابط) ---
// --- لوحة التحكم الرئيسية للمدير (الإحصائيات والروابط) ---
exports.getManagerDashboard = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    const selectedStore = req.query.store || 'الكل'; // دعم تصفية الإحصائيات بالمخزن أو عرض الكل

    try {
        let itemCountRes, custodyCountRes, itemsRes;

        if (selectedStore === 'الكل') {
            itemCountRes = await db.execute(`SELECT COUNT(*) as count FROM items`);
            custodyCountRes = await db.execute(`SELECT COUNT(*) as count FROM custodies`);
            itemsRes = await db.execute(`SELECT available_quantity, price FROM items`);
        } else {
            itemCountRes = await db.execute({
                sql: `SELECT COUNT(*) as count FROM items WHERE store_type = ?`,
                args: [selectedStore]
            });
            custodyCountRes = await db.execute({
                sql: `SELECT COUNT(*) as count FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name WHERE items.store_type = ?`,
                args: [selectedStore]
            });
            itemsRes = await db.execute({
                sql: `SELECT available_quantity, price FROM items WHERE store_type = ?`,
                args: [selectedStore]
            });
        }

        const userCountRes = await db.execute(`SELECT COUNT(*) as count FROM users`);

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
            selectedStore: selectedStore,
            user: req.session.user 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

// --- صفحة عرض جميع أصناف المخزن للمدير (مع دعم التصفية) ---
exports.getManagerItems = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const selectedStore = req.query.store || 'مستهلك';
    
    try {
        let query = `SELECT * FROM items WHERE store_type = ?`;
        let args = [selectedStore];

        if (selectedStore === 'الكل') {
            query = `SELECT * FROM items`;
            args = [];
        }

        const result = await db.execute({ sql: query, args: args });
        res.render('manager_items', { 
            items: result.rows || [], 
            user: req.session.user,
            selectedStore: selectedStore 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};

// --- صفحة عرض سجل العهد للمدير (مع دعم البحث والتصفية بحسب المخزن) ---
exports.getManagerCustodies = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    const selectedStore = req.query.store || 'الكل';
    const searchQuery = req.query.search ? `%${req.query.search}%` : '%';
    
    try {
        // استعلام يجلب المخزن الحقيقي المرتبط بالصنف من جدول items بناءً على تطابق اسم الصنف
        let query = `
            SELECT 
                custodies.*, 
                COALESCE(items.item_number, '-') AS item_number, 
                COALESCE(items.store_type, 'مستهلك') AS real_store_type 
            FROM custodies 
            LEFT JOIN items ON TRIM(custodies.item_name) = TRIM(items.item_name) 
            WHERE (custodies.receiver LIKE ? OR custodies.item_name LIKE ?)
        `;
        let args = [searchQuery, searchQuery];

        if (selectedStore !== 'الكل') {
            query += ` AND items.store_type = ?`;
            args.push(selectedStore);
        }

        const result = await db.execute({ sql: query, args: args });
        
        res.render('manager_custodies', { 
            custodies: result.rows || [], 
            user: req.session.user,
            searchVal: req.query.search || '',
            selectedStore: selectedStore 
        });
    } catch (err) {
        console.error("خطأ في جلب العهد للمدير:", err);
        res.redirect('/manager/dashboard');
    }
};
// --- عرض قائمة مستخدمي النظام للمدير ---
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
        console.error("خطأ في جلب المستخدمين:", err);
        res.redirect('/login');
    }
};

// --- إضافة مستخدم جديد للنظام ---
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
        res.redirect('/manager/users?success=added');
    } catch (err) {
        console.error("خطأ في إضافة المستخدم:", err);
        try {
            const result = await db.execute(`SELECT * FROM users`);
            return res.render('manager_users', { 
                users: result.rows || [], 
                user: req.session.user,
                error: 'فشل الإضافة: اسم المستخدم قد يكون مستخدماً من قبل أو البيانات غير مكتملة.',
                query: req.query || {}
            });
        } catch (fetchErr) {
            console.error("خطأ أثناء إعادة التحميل:", fetchErr);
            res.redirect('/manager/users?error=db_error');
        }
    }
};

// --- تعديل بيانات مستخدم حالي ---
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
        console.error("خطأ في تعديل المستخدم:", err);
        res.redirect('/manager/users?error=db_error');
    }
};

// --- حذف مستخدم من النظام ---
exports.deleteUser = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const userId = req.params.id;

    // حماية: منع المدير من حذف حسابه المسجل به حالياً
    if (parseInt(userId) === req.session.user.id) {
        return res.redirect('/manager/users?error=self_delete');
    }

    try {
        await db.execute({
            sql: `DELETE FROM users WHERE id = ?`,
            args: [userId]
        });
        res.redirect('/manager/users?success=deleted');
    } catch (err) {
        console.error("خطأ في حذف المستخدم:", err);
        res.redirect('/manager/users?error=db_error');
    }
};