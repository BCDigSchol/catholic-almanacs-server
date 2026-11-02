// Editors' sign-in for the Data Issues page: one shared password
// (DATA_ISSUES_PASSWORD, set in the server's environment; docker-compose reads
// it from the untracked .env file) exchanged for a signed token that lasts 30
// days. The token is an expiry time and its HMAC under a key made from the
// password and JWT_SECRET, so changing the password signs everyone out. No
// accounts and nothing stored: the site has no other users.
//
// Without a password set, the Data Issues data stays closed.

const crypto = require('crypto');

const DAYS = 30;
const ATTEMPTS = 10;                 // wrong passwords allowed per address…
const WINDOW_MS = 15 * 60 * 1000;    // …in this long
const attempts = new Map();

const password = () => process.env.DATA_ISSUES_PASSWORD || '';
const key = () => crypto.createHash('sha256').update(`${process.env.JWT_SECRET || ''}:${password()}`).digest();
const sign = payload => crypto.createHmac('sha256', key()).update(payload).digest('base64url');

function equal(a, b) {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** A token for a correct password, or null. */
function issue(given) {
    if (!password() || !equal(given, password())) return null;
    const expires = Date.now() + DAYS * 24 * 60 * 60 * 1000;
    const payload = String(expires);
    return { token: `${payload}.${sign(payload)}`, expires };
}

/** Whether a token (the request's "Authorization: Bearer …") is good and unexpired. */
function valid(token) {
    if (!password() || !token) return false;
    const [payload, mac] = String(token).split('.');
    return !!payload && !!mac && equal(mac, sign(payload)) && Number(payload) > Date.now();
}

const tokenOf = req => (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

/** Express middleware: 401 unless the request carries a good token. */
function requireReviewer(req, res, next) {
    if (valid(tokenOf(req))) return next();
    res.status(401).json({ message: password() ? 'Sign in to see the data issues.' : 'The data issues are closed on this server.' });
}

/** POST /api/auth/review {password} -> {token, expires}; a few wrong guesses per address, then a wait. */
function signIn(req, res) {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const recent = (attempts.get(ip) || []).filter(t => now - t < WINDOW_MS);
    if (recent.length >= ATTEMPTS) return res.status(429).json({ message: 'Too many tries; wait a few minutes.' });
    const result = issue(req.body?.password);
    if (!result) {
        recent.push(now);
        attempts.set(ip, recent);
        return res.status(401).json({ message: password() ? 'That password is not right.' : 'No password is set on this server.' });
    }
    attempts.delete(ip);
    res.json(result);
}

/** GET /api/auth/review -> {configured, signedIn} for the request's token. */
function status(req, res) {
    res.json({ configured: !!password(), signedIn: valid(tokenOf(req)) });
}

module.exports = { requireReviewer, signIn, status };
