module.exports = app => {
    const controller = require('../controllers/maps.controller');
    var router = require('express').Router();
    router.get('/institutions', controller.findAllInstitutions);
    router.get('/people', controller.findAllPeople);
    router.get('/dioceses', controller.findAllDioceses);
    app.use('/api/maps', router);
}