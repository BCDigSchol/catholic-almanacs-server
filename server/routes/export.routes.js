module.exports = app => {
    const controller = require('../controllers/export.controller');
    var router = require('express').Router();
    router.get('/', controller.exportAll);
    app.use('/api/export', router);
}