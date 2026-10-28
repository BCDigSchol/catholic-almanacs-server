module.exports = app => {
    const controller = require('../controllers/person.controller');
    const wrap = require('../utils/async-handler');
    var router = require('express').Router();
    //router.post('/', controller.create);
    router.get('/', wrap(controller.findAll));
    router.get('/network', wrap(controller.getAllPersonNetwork));
    router.get('/:id', wrap(controller.findByID));
    router.get('/:id/network', wrap(controller.getPersonNetwork));
    router.get('/:id/timeline', wrap(controller.getTimeline));
    router.get('/:id/:year', wrap(controller.findOne));
    router.delete('/:id', wrap(controller.delete));
    app.use('/api/person', router);
}