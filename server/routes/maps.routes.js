module.exports = app => {
    const controller = require('../controllers/maps.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    router.get('/institutions', wrap(controller.findAllInstitutions));
    router.get('/people', wrap(controller.findAllPeople));
    router.get('/dioceses', wrap(controller.findAllDioceses));
    app.use('/api/maps', router);
}