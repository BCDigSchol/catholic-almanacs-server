const express = require('express');
const cors = require('cors');
const compression = require('compression');

const app = express();

// gzip all responses — the aggregate/fact endpoints return large JSON
// (the overview facts payload is ~7MB raw, ~1MB gzipped).
app.use(compression());
app.use(cors({origin: '*'}));
app.use(express.json());

require('./routes')(app);

// Errors from route handlers (see utils/async-handler.js) answer 500 instead
// of crashing the process.
app.use((err, req, res, next) => {
    console.error(`${req.method} ${req.originalUrl} failed:`, err);
    if (res.headersSent) return next(err);
    res.status(500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;