module.exports = app => {
    const controller = require('../controllers/searchAll.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    router.get('/all', wrap(controller.findAllInfo));
    app.use('/api', router);
}