module.exports = app => {
    const controller = require('../controllers/institution.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/network', wrap(controller.getAllInstitutionNetwork));
    router.get('/network/bipartite', wrap(controller.getBipartiteNetwork));
    router.get('/', wrap(controller.findAll));
    router.get('/:id', wrap(controller.findByID));
    router.get('/:id/network', wrap(controller.getPersonNetwork));
    router.get('/:id/timeline', wrap(controller.getTimeline));
    router.get('/:id/dendrogram', wrap(controller.getDendrogramData));
    router.get('/:id/:year', wrap(controller.findOne));
    router.delete('/:id', wrap(controller.delete));
    app.use('/api/institution', router);
}