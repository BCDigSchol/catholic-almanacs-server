module.exports = app => {
    const controller = require('../controllers/churchPerson.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/', wrap(controller.findAll));
    router.delete('/:instID/:persID', wrap(controller.delete));
    app.use('/api/churchPerson', router);
};