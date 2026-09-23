const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/login', (req, res) => {
    res.render('login', { error: null });
});
router.post('/login', inventoryController.login);
router.get('/logout', inventoryController.logout);

router.get('/forgot-password', (req, res) => {
    res.render('forgot_password', { error: null, success: null });
});
router.post('/forgot-password', inventoryController.resetPassword);

router.get('/account', inventoryController.getAccount);
router.post('/account/update', inventoryController.updateAccount);

// مسارات كاتب الشطب
router.get('/shateb/dashboard', inventoryController.getShatebDashboard);
router.post('/shateb/add-item', inventoryController.addItem);
router.get('/shateb/delete-item/:id', inventoryController.deleteItem);
router.get('/shateb/edit-item/:id', inventoryController.getEditItem);
router.post('/shateb/update-item/:id', inventoryController.updateItem);

// مسارات مسئول العهد
router.get('/custody/dashboard', inventoryController.getCustodyDashboard);
router.post('/custody/add', inventoryController.addCustody);
router.get('/custody/delete/:id', inventoryController.deleteCustody);
router.get('/custody/edit/:id', inventoryController.getEditCustody);
router.post('/custody/update/:id', inventoryController.updateCustody);
router.get('/custody/warehouse', inventoryController.getWarehouseView);

// لوحة تحكم مدير المخازن
router.get('/manager/dashboard', inventoryController.getManagerDashboard);
// صفحة عرض جميع أصناف المخزن وحدها
router.get('/manager/items', inventoryController.getManagerItems);
// صفحة عرض سجل العهد والبحث فيها وحدها
router.get('/manager/custodies', inventoryController.getManagerCustodies);
// صفحة عرض وإدارة المستخدمين
router.get('/manager/users', inventoryController.getManagerUsers);
// إضافة مستخدم جديد
router.post('/manager/users/add', inventoryController.addUser);
// حذف مستخدم
router.get('/manager/users/delete/:id', inventoryController.deleteUser);
// تعديل بيانات مستخدم
router.post('/manager/users/edit/:id', inventoryController.updateUser);

// // مسارات لوحة تحكم أمين المخزن
// router.get('/storekeeper/dashboard', inventoryController.getStorekeeperDashboard);
// router.post('/storekeeper/add', inventoryController.addStoreTransaction);
// router.get('/storekeeper/edit/:id', inventoryController.getEditStoreTransaction);
// router.post('/storekeeper/update/:id', inventoryController.updateStoreTransaction);
// router.get('/storekeeper/delete/:id', inventoryController.deleteStoreTransaction);
// router.get('/storekeeper/warehouse', inventoryController.getWarehouseView);
module.exports = router;