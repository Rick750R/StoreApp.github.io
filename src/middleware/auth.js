const crypto = require('crypto');
const pool = require('../config/db');

const COOKIE_NAME = 'storeapp.sid';
const SESSION_DAYS = 7;

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  await pool.query(
    'INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
    [tokenHash, userId]
  );
  setSessionCookie(res, token);
}

async function loadUser(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;

  const tokenHash = hashToken(token);
  const [rows] = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.rol
     FROM sesiones s
     INNER JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = ? AND s.expira_en > NOW() AND u.activo = 1
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) return null;
  req.sessionTokenHash = tokenHash;
  return rows[0];
}

async function optionalAuth(req, _res, next) {
  try {
    req.user = await loadUser(req);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAuth(req, res, next) {
  try {
    req.user = await loadUser(req);
    if (!req.user) {
      return res.status(401).json({ message: 'Debes iniciar sesión para continuar.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ message: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  });
}

module.exports = {
  COOKIE_NAME,
  clearSessionCookie,
  createSession,
  hashToken,
  loadUser,
  optionalAuth,
  readCookie,
  requireAdmin,
  requireAuth
};
