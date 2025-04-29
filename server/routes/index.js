module.exports = app => {
    require('./person.routes.js')(app);
    require('./institution.routes.js')(app);
    require('./churchPerson.routes.js')(app);
    require('./churchChurch.routes.js')(app);
};