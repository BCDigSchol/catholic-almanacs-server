module.exports = app => {
    const controller = require('../controllers/churchChurch.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/', wrap(controller.findAll));
    router.delete('/:instID/:attendingInstID', wrap(controller.delete));
    app.use('/api/churchChurch', router);
};