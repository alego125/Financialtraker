const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-fintrack' : 'fintrack_session';
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' });
function issueSession(res, user) {
  const csrfToken = randomBytes(24).toString('hex');
  const token = jwt.sign({ userId: user.id, authVersion: user.authVersion ?? 0, csrf: csrfToken }, process.env.JWT_SECRET, {
    algorithm: 'HS256', issuer: 'fintrack', audience: 'fintrack-web', expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  res.cookie(cookieName(), token, { ...cookieOptions(), expires: new Date(jwt.decode(token).exp * 1000) });
  return csrfToken;
}
function clearSession(res) { res.clearCookie(cookieName(), cookieOptions()); }
function readSession(req) {
  const bearer = req.headers.authorization;
  if (bearer?.startsWith('Bearer ')) return { token: bearer.slice(7), cookie: false };
  const value = (req.headers.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith(cookieName() + '='));
  try { return { token: value ? decodeURIComponent(value.slice(cookieName().length + 1)) : null, cookie: true }; }
  catch { return { token: null, cookie: true }; }
}
module.exports = { issueSession, clearSession, readSession };
