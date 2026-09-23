const db = require('../database');

// --- تسجيل الدخول ---
exports.login = (req, res) => {
    const { username, password, remember } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
        if (err || !user) {
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
            res.redirect('/manager/dashboard'); // توجيه المدير للوحة تحكمه مباشرة
        // } else if (user.role === 'storekeeper') {
        //     res.redirect('/storekeeper/dashboard'); // وجهي أمين المخزن لصفحته الخاصة
        } else {
            res.redirect('/login');
        }
    });
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};

exports.resetPassword = (req, res) => {
    const { username, phone_or_email, new_password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND (phone = ? OR email = ?)`, [username.trim(), phone_or_email.trim(), phone_or_email.trim()], (err, user) => {
        if (err || !user) {
            return res.render('forgot_password', { error: 'تأكد من صحة اسم المستخدم ورقم التليفون أو البريد الإلكتروني', success: null });
        }
        db.run(`UPDATE users SET password = ? WHERE id = ?`, [new_password, user.id], (err) => {
            res.render('forgot_password', { error: null, success: 'تم تغيير كلمة السر بنجاح، يمكنك تسجيل الدخول الآن' });
        });
    });
};

exports.getAccount = (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.user.id], (err, user) => {
        res.render('account', { user: user, success: null });
    });
};

exports.updateAccount = (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { phone, email } = req.body;
    const userId = req.session.user.id;

    db.run(`UPDATE users SET phone = ?, email = ? WHERE id = ?`, [phone, email, userId], (err) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, updatedUser) => {
            if (updatedUser) req.session.user = updatedUser;
            res.render('account', { user: updatedUser || req.session.user, success: 'تم حفظ البيانات بنجاح' });
        });
    });
};

// --- وظائف كاتب الشطب ---
exports.getShatebDashboard = (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    db.all(`SELECT * FROM items`, [], (err, rows) => {
        res.render('shateb_dashboard', { items: rows, editItem: null });
    });
};

exports.addItem = (req, res) => {
    const { item_number, item_name, quantity, price } = req.body;
    const qty = parseInt(quantity);

    // عند الإضافة، الكمية الكلية والمتاحة تكون متساويتين
    db.run(`INSERT INTO items (item_number, item_name, quantity, available_quantity, price) VALUES (?, ?, ?, ?, ?)`, 
    [item_number, item_name, qty, qty, price], (err) => {
        return res.redirect('/shateb/dashboard');
    });
};

exports.deleteItem = (req, res) => {
    db.run(`DELETE FROM items WHERE id = ?`, [req.params.id], () => {
        res.redirect('/shateb/dashboard');
    });
};

exports.getEditItem = (req, res) => {
    db.all(`SELECT * FROM items`, [], (err, rows) => {
        db.get(`SELECT * FROM items WHERE id = ?`, [req.params.id], (err, itemToEdit) => {
            res.render('shateb_dashboard', { items: rows, editItem: itemToEdit });
        });
    });
};

exports.updateItem = (req, res) => {
    const { item_number, item_name, quantity, price } = req.body;
    db.run(`UPDATE items SET item_number = ?, item_name = ?, quantity = ?, price = ? WHERE id = ?`, [item_number, item_name, quantity, price, req.params.id], () => {
        res.redirect('/shateb/dashboard');
    });
};

// --- لوحة تحكم مسئول العهد وعرض السجل ---
exports.getCustodyDashboard = (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    // استخدام LEFT JOIN لجلب رقم الصنف من جدول items
    db.all(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`, [], (err, custodyRows) => {
        db.all(`SELECT * FROM items`, [], (err, itemRows) => {
            res.render('custody_dashboard', { 
                custodies: custodyRows || [], 
                items: itemRows || [], 
                editCustody: null,
                user: req.session.user,
                error: null 
            });
        });
    });
};

exports.addCustody = (req, res) => {
    const { item_name, quantity, receiver, department, date } = req.body;
    const reqQty = parseInt(quantity);

    db.get(`SELECT * FROM items WHERE item_name = ?`, [item_name], (err, item) => {
        // الفحص يتم على available_quantity بدلاً من quantity الأساسية
        if (err || !item || item.available_quantity < reqQty) {
            db.all(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`, [], (err, custodyRows) => {
                db.all(`SELECT * FROM items`, [], (err, itemRows) => {
                    return res.render('custody_dashboard', { 
                        custodies: custodyRows || [], 
                        items: itemRows || [], 
                        editCustody: null,
                        user: req.session.user,
                        error: `عذراً! الكمية المطلوبة غير متاحة بالمخزن. المتاح حالياً: ${item ? item.available_quantity : 0}`
                    });
                });
            });
            return;
        }

        // الخصم يتم فقط من الكمية المتاحة (available_quantity) لتظل كمية كاتب الشطب ثابتة
        const newAvailableQuantity = item.available_quantity - reqQty;
        db.run(`UPDATE items SET available_quantity = ? WHERE id = ?`, [newAvailableQuantity, item.id], (updateErr) => {
            if (updateErr) return res.redirect('/custody/dashboard');

            db.run(`INSERT INTO custodies (item_name, quantity, receiver, department, date) VALUES (?, ?, ?, ?, ?)`, 
            [item_name, reqQty, receiver, department, date], (insertErr) => {
                return res.redirect('/custody/dashboard');
            });
        });
    });
};

exports.getEditCustody = (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    db.all(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`, [], (err, custodyRows) => {
        db.all(`SELECT * FROM items`, [], (err, itemRows) => {
            db.get(`SELECT * FROM custodies WHERE id = ?`, [req.params.id], (err, custodyToEdit) => {
                res.render('custody_dashboard', { 
                    custodies: custodyRows || [], 
                    items: itemRows || [], 
                    editCustody: custodyToEdit,
                    user: req.session.user,
                    error: null 
                });
            });
        });
    });
};

exports.updateCustody = (req, res) => {
    const { item_name, quantity, receiver, department, date } = req.body;
    const newReqQty = parseInt(quantity);
    const custodyId = req.params.id;

    db.get(`SELECT * FROM custodies WHERE id = ?`, [custodyId], (err, oldCustody) => {
        if (err || !oldCustody) return res.redirect('/custody/dashboard');

        db.get(`SELECT * FROM items WHERE item_name = ?`, [oldCustody.item_name], (err, oldItem) => {
            if (!oldItem) return res.redirect('/custody/dashboard');

            // إعادة الكمية القديمة المؤقتة إلى available_quantity
            const restoredAvailable = oldItem.available_quantity + oldCustody.quantity;

            db.get(`SELECT * FROM items WHERE item_name = ?`, [item_name], (err, targetItem) => {
                if (!targetItem) return res.redirect('/custody/dashboard');

                let availableCheck = targetItem.available_quantity;
                if (oldItem.id === targetItem.id) {
                    availableCheck = restoredAvailable;
                }

                if (availableCheck < newReqQty) {
                    db.all(`SELECT custodies.*, items.item_number FROM custodies LEFT JOIN items ON custodies.item_name = items.item_name`, [], (err, custodyRows) => {
                        db.all(`SELECT * FROM items`, [], (err, itemRows) => {
                            return res.render('custody_dashboard', { 
                                custodies: custodyRows || [], 
                                items: itemRows || [], 
                                editCustody: oldCustody,
                                user: req.session.user,
                                error: `فشل التعديل: الكمية المطلوبة أكبر من المتاح (${availableCheck})`
                            });
                        });
                    });
                    return;
                }

                // تحديث الصنف القديم بإعادة الكمية المتاحة له
                db.run(`UPDATE items SET available_quantity = ? WHERE id = ?`, [restoredAvailable, oldItem.id], () => {
                    db.get(`SELECT * FROM items WHERE item_name = ?`, [item_name], (err, finalTarget) => {
                        const finalAvailable = finalTarget.available_quantity - newReqQty;
                        
                        // خصم الكمية الجديدة من available_quantity للصنف المستهدف
                        db.run(`UPDATE items SET available_quantity = ? WHERE id = ?`, [finalAvailable, finalTarget.id], () => {
                            db.run(`UPDATE custodies SET item_name = ?, quantity = ?, receiver = ?, department = ?, date = ? WHERE id = ?`, 
                            [item_name, newReqQty, receiver, department, date, custodyId], () => {
                                return res.redirect('/custody/dashboard');
                            });
                        });
                    });
                });
            });
        });
    });
};

exports.deleteCustody = (req, res) => {
    db.get(`SELECT * FROM custodies WHERE id = ?`, [req.params.id], (err, custody) => {
        if (custody) {
            db.get(`SELECT * FROM items WHERE item_name = ?`, [custody.item_name], (err, item) => {
                if (item) {
                    // عند الحذف، ترجع الكمية المخصومة إلى available_quantity فقط بينما يظل quantity لكاتب الشطب ثابتاً
                    const restoredAvailable = item.available_quantity + custody.quantity;
                    db.run(`UPDATE items SET available_quantity = ? WHERE id = ?`, [restoredAvailable, item.id], () => {
                        db.run(`DELETE FROM custodies WHERE id = ?`, [req.params.id], () => {
                            res.redirect('/custody/dashboard');
                        });
                    });
                } else {
                    db.run(`DELETE FROM custodies WHERE id = ?`, [req.params.id], () => {
                        res.redirect('/custody/dashboard');
                    });
                }
            });
        } else {
            res.redirect('/custody/dashboard');
        }
    });
};

exports.getWarehouseView = (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    db.all(`SELECT * FROM items`, [], (err, rows) => {
        res.render('warehouse_view', { items: rows, user: req.session.user });
    });
};

// --- لوحة التحكم الرئيسية (الإحصائيات والروابط) ---
exports.getManagerDashboard = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    db.all(`SELECT COUNT(*) as count FROM items`, [], (err, itemCount) => {
        db.all(`SELECT COUNT(*) as count FROM custodies`, [], (err, custodyCount) => {
            db.all(`SELECT COUNT(*) as count FROM users`, [], (err, userCount) => {
                // جلب available_quantity بدلاً من quantity لحساب القيمة الفعلية المتاحة بالمخزن
                db.all(`SELECT available_quantity, price FROM items`, [], (err, items) => {
                    let totalInventoryValue = 0;
                    
                    if (items && items.length > 0) {
                        items.forEach(item => {
                            const qty = parseFloat(item.available_quantity) || 0;
                            const price = parseFloat(item.price) || 0;
                            totalInventoryValue += (qty * price);
                        });
                    }

                    res.render('manager_dashboard', { 
                        itemCount: itemCount[0] ? itemCount[0].count : 0, 
                        custodyCount: custodyCount[0] ? custodyCount[0].count : 0, 
                        userCount: userCount[0] ? userCount[0].count : 0,
                        totalInventoryValue: totalInventoryValue, // إجمالي قيمة المخزن بناءً على المتاح
                        user: req.session.user 
                    });
                });
            });
        });
    });
};

// --- صفحة أصناف المخزن وحدها ---
exports.getManagerItems = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    db.all(`SELECT * FROM items`, [], (err, items) => {
        res.render('manager_items', { 
            items: items || [], 
            user: req.session.user 
        });
    });
};

// --- صفحة سجل العهد وحدها مع خاصية البحث ورقم الصنف ---
exports.getManagerCustodies = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    const searchQuery = req.query.search ? `%${req.query.search}%` : '%';

    // استخدام LEFT JOIN لجلب رقم الصنف (item_number) مع سجلات العهد ودعم البحث
    const query = `
        SELECT custodies.*, items.item_number 
        FROM custodies 
        LEFT JOIN items ON custodies.item_name = items.item_name 
        WHERE custodies.receiver LIKE ? OR custodies.item_name LIKE ?
    `;

    db.all(query, [searchQuery, searchQuery], (err, custodies) => {
        res.render('manager_custodies', { 
            custodies: custodies || [], 
            user: req.session.user,
            searchVal: req.query.search || '' 
        });
    });
};
// --- صفحة إدارة المستخدمين ---
exports.getManagerUsers = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }
    
    db.all(`SELECT * FROM users`, [], (err, users) => {
        res.render('manager_users', { 
            users: users || [], 
            user: req.session.user,
            error: null,
            query: req.query // <--- أضيفي هذا السطر هنا لتمرير إشارات النجاح للصفحة
        });
    });
};

// --- إضافة مستخدم جديد بواسطة المدير ---
exports.addUser = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const { username, password, phone, email, role } = req.body;

    db.run(`INSERT INTO users (username, password, phone, email, role) VALUES (?, ?, ?, ?, ?)`, 
    [username, password, phone, email, role], (err) => {
        if (err) {
            db.all(`SELECT * FROM users`, [], (dbErr, users) => {
                return res.render('manager_users', { 
                    users: users || [], 
                    user: req.session.user,
                    error: 'فشل الإضافة: اسم المستخدم قد يكون مستخدماً من قبل.' 
                });
            });
            return;
        }
        res.redirect('/manager/users');
    });
};

// 1. تعديل المستخدم
exports.updateUser = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const userId = req.params.id;
    const { username, password, phone, email, role } = req.body;

    db.run(`UPDATE users SET username = ?, password = ?, phone = ?, email = ?, role = ? WHERE id = ?`, 
    [username, password, phone, email, role, userId], (err) => {
        if (err) {
            console.log(err);
            return res.redirect('/manager/users?error=db_error');
        }
        // إعادة التوجيه مع علامة تدل على نجاح التعديل
        res.redirect('/manager/users?success=updated');
    });
};

// 2. حذف المستخدم
exports.deleteUser = (req, res) => {
    if (!req.session.user || req.session.user.role !== 'manager') {
        return res.redirect('/login');
    }

    const userId = req.params.id;
    if (parseInt(userId) === req.session.user.id) {
        return res.redirect('/manager/users');
    }

    db.run(`DELETE FROM users WHERE id = ?`, [userId], (err) => {
        if (err) {
            console.log(err);
        }
        // إعادة التوجيه مع علامة تدل على نجاح الحذف
        res.redirect('/manager/users?success=deleted');
    });
};
