module.exports = app => {
    const controller = require('../controllers/place.controller');
    const wrap = require('../utils/async-handler');
    const router = require('express').Router();
    router.get('/county/:id', wrap(controller.getCounty));
    router.get('/metros', wrap(controller.getMetros));
    router.get('/metro/:id', wrap(controller.getMetro));
    app.use('/api/place', router);
};
