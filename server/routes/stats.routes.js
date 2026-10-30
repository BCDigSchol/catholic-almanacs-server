module.exports = app => {
    const controller = require('../controllers/stats.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    router.get('/composition', wrap(controller.getComposition));
    router.get('/subset-vs-whole', wrap(controller.getSubsetVsWhole));
    router.get('/geo', wrap(controller.getGeo));
    router.post('/overview', wrap(controller.getOverview));
    router.get('/coverage', wrap(controller.getCoverage));
    router.get('/circuits', wrap(controller.getCircuits));
    router.get('/railroads', wrap(controller.getRailroads));
    router.get('/clergy-flows', wrap(controller.getClergyFlows));
    router.get('/path', wrap(controller.getPath));
    router.get('/orders', wrap(controller.getOrders));
    app.use('/api/stats', router);
}
