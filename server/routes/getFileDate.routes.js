module.exports = app => {
    const controller = require('../controllers/getFileDate.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    router.get('/getFileDate', wrap(controller.getFileDate));
    app.use('/api', router);
}