// Editors' sign-in for the Data Issues page (utils/review-auth.js).
module.exports = app => {
    const auth = require('../utils/review-auth');
    const router = require('express').Router();
    router.get('/review', auth.status);
    router.post('/review', auth.signIn);
    app.use('/api/auth', router);
};
