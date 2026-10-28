// Express 4 does not catch rejected promises from async handlers: an uncaught
// query error becomes an unhandled rejection and takes the whole process down.
// Wrap every route handler so errors reach the error middleware in app.js.
module.exports = handler => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};
