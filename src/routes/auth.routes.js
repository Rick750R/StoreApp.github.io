const express = require('express');
const crypto = require('crypto');
const { promisify } = require('util');
const pool = require('../config/db');
const {
  clearSessionCookie,
  createSession,
  hashToken,
  loadUser,
  readCookie
} = require('../middleware/auth');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);

function publicUser(user) {
  return { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, salt, key] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

router.get('/me', async (req, res, next) => {
  try {
    const user = await loadUser(req);
    res.json({ authenticated: Boolean(user), user: user ? publicUser(user) : null });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (nombre.length < 2 || nombre.length > 120) {
      return res.status(400).json({ message: 'El nombre debe tener entre 2 y 120 caracteres.' });
    }
    if (correo.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ message: 'Escribe un correo electrónico válido.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'La contraseña debe tener entre 8 y 128 caracteres.' });
    }

    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES (?, ?, ?, \'cliente\')',
      [nombre, correo, passwordHash]
    );

    const user = { id: result.insertId, nombre, correo, rol: 'cliente' };
    await createSession(user.id, res);
    res.status(201).json({ message: 'Tu cuenta se creó correctamente.', user: publicUser(user) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe una cuenta registrada con ese correo.' });
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!correo || !password) {
      return res.status(400).json({ message: 'Escribe tu correo y contraseña.' });
    }

    const [rows] = await pool.query(
      'SELECT id, nombre, correo, password_hash, rol FROM usuarios WHERE correo = ? AND activo = 1 LIMIT 1',
      [correo]
    );
    if (!rows.length || !(await verifyPassword(password, rows[0].password_hash))) {
      return res.status(401).json({ message: 'El correo o la contraseña son incorrectos.' });
    }

    const user = rows[0];
    await createSession(user.id, res);
    res.json({ message: 'Sesión iniciada correctamente.', user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = readCookie(req, 'storeapp.sid');
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      await pool.query('DELETE FROM sesiones WHERE token_hash = ?', [hashToken(token)]);
    }
    clearSessionCookie(res);
    res.json({ message: 'Sesión cerrada.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
