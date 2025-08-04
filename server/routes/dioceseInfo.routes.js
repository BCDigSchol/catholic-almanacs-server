module.exports = app => {
    const controller = require('../controllers/dioceseInfo.controller');
    var router = require('express').Router();
    router.get('/diocese', controller.findDioceseInfo);
    app.use('/api', router);
}