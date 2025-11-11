module.exports = app => {
    const controller = require('../controllers/searchAll.controller');
    var router = require('express').Router();
    router.get('/all', controller.findAllInfo);
    app.use('/api', router);
}