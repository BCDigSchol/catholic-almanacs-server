module.exports = app => {
    const controller = require('../controllers/export.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    router.get('/', wrap(controller.exportAll));
    app.use('/api/export', router);
}