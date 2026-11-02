module.exports = app => {
    const controller = require('../controllers/place.controller');
    const wrap = require('../utils/async-handler');
    const router = require('express').Router();
    router.get('/county/:id', wrap(controller.getCounty));
    app.use('/api/place', router);
};
