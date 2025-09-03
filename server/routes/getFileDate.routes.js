module.exports = app => {
    const controller = require('../controllers/getFileDate.controller');
    var router = require('express').Router();
    router.get('/getFileDate', controller.getFileDate);
    app.use('/api', router);
}