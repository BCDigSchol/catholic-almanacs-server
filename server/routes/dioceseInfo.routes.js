module.exports = app => {
    const controller = require('../controllers/dioceseInfo.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    router.get('/diocese', wrap(controller.findDioceseInfo));
    app.use('/api', router);
}