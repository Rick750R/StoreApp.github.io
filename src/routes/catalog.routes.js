const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function validImageUrl(value) {
  if (value == null || value === '') return null;
  const imageUrl = String(value).trim();
  if (imageUrl.length > 500) {
    const error = new Error('La dirección de la imagen no debe superar los 500 caracteres.');
    error.status = 400;
    throw error;
  }
  if (imageUrl.startsWith('/uploads/')) return imageUrl;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return imageUrl;
  } catch (_error) {
    // The value is rejected below.
  }
  const error = new Error('La imagen debe ser una URL http(s) válida o un archivo de imagen.');
  error.status = 400;
  throw error;
}

async function resolveImage({ imageUrl, imageData }) {
  if (imageData) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(imageData));
    if (!match) {
      const error = new Error('El archivo debe ser PNG, JPG o WEBP.');
      error.status = 400;
      throw error;
    }
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      const error = new Error('La imagen no debe superar los 2 MB.');
      error.status = 400;
      throw error;
    }

    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!(isPng || isJpg || isWebp)) {
      const error = new Error('El contenido del archivo no coincide con un formato de imagen válido.');
      error.status = 400;
      throw error;
    }

    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `${crypto.randomUUID()}.${extension}`;
    await fs.writeFile(path.join(uploadsDir, filename), buffer, { flag: 'wx' });
    return `/uploads/${filename}`;
  }
  return validImageUrl(imageUrl);
}

function validateProduct(body) {
  const nombre = String(body.nombre || '').trim();
  const descripcion = String(body.descripcion || '').trim();
  const categoria = String(body.categoria || '').trim();
  const precio = Number(body.precio);
  const stock = Number(body.stock);

  if (nombre.length < 2 || nombre.length > 120) throw Object.assign(new Error('El nombre debe tener entre 2 y 120 caracteres.'), { status: 400 });
  if (!descripcion || descripcion.length > 5000) throw Object.assign(new Error('Agrega una descripción de hasta 5000 caracteres.'), { status: 400 });
  if (categoria.length < 2 || categoria.length > 60) throw Object.assign(new Error('La categoría debe tener entre 2 y 60 caracteres.'), { status: 400 });
  if (!Number.isFinite(precio) || precio < 0 || precio > 99999999) throw Object.assign(new Error('Escribe un precio válido.'), { status: 400 });
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) throw Object.assign(new Error('Las existencias deben ser un número entero igual o mayor que cero.'), { status: 400 });

  return {
    nombre,
    descripcion,
    categoria,
    precio: precio.toFixed(2),
    stock,
    destacado: body.destacado === true || body.destacado === 'true' || body.destacado === '1',
    activo: body.activo === false || body.activo === 'false' || body.activo === '0' ? 0 : 1
  };
}

// Endpoints privados para administración. Deben estar antes de /:id.
router.get('/admin/all', requireAdmin, async (_req, res, next) => {
  try {
    const [products] = await pool.query(
      `SELECT id, nombre, descripcion, categoria, precio, imagen_url, stock, destacado, activo
       FROM productos ORDER BY creado_en DESC, id DESC`
    );
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const product = validateProduct(req.body || {});
    const image = await resolveImage(req.body || {});
    const [result] = await pool.query(
      `INSERT INTO productos (nombre, descripcion, categoria, precio, imagen_url, stock, destacado, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [product.nombre, product.descripcion, product.categoria, product.precio, image, product.stock, product.destacado, product.activo]
    );
    res.status(201).json({ message: 'Producto agregado correctamente.', data: { id: result.insertId } });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'ID de producto inválido.' });
    const product = validateProduct(req.body || {});
    const [existing] = await pool.query('SELECT imagen_url FROM productos WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ message: 'Producto no encontrado.' });

    let image = existing[0].imagen_url;
    if (req.body.imageData) image = await resolveImage({ imageData: req.body.imageData });
    else if (req.body.imageUrl) image = validImageUrl(req.body.imageUrl);

    await pool.query(
      `UPDATE productos SET nombre = ?, descripcion = ?, categoria = ?, precio = ?,
       imagen_url = ?, stock = ?, destacado = ?, activo = ? WHERE id = ?`,
      [product.nombre, product.descripcion, product.categoria, product.precio, image, product.stock, product.destacado, product.activo, id]
    );
    res.json({ message: 'Producto actualizado correctamente.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || typeof req.body?.activo !== 'boolean') {
      return res.status(400).json({ message: 'Indica un producto y un estado válido.' });
    }
    const [result] = await pool.query('UPDATE productos SET activo = ? WHERE id = ?', [req.body.activo ? 1 : 0, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Producto no encontrado.' });
    res.json({ message: req.body.activo ? 'Producto activado.' : 'Producto desactivado.' });
  } catch (error) {
    next(error);
  }
});

// Catálogo público.
router.get('/', async (req, res, next) => {
  try {
    const { q = '', category = '', minPrice = '', maxPrice = '' } = req.query;
    const conditions = ['activo = 1'];
    const params = [];

    if (String(q).trim()) {
      conditions.push('(nombre LIKE ? OR descripcion LIKE ?)');
      const term = `%${String(q).trim()}%`;
      params.push(term, term);
    }
    if (String(category).trim() && category !== 'Todos') {
      conditions.push('categoria = ?');
      params.push(String(category).trim());
    }
    if (minPrice !== '' && Number.isFinite(Number(minPrice))) {
      conditions.push('precio >= ?');
      params.push(Number(minPrice));
    }
    if (maxPrice !== '' && Number.isFinite(Number(maxPrice))) {
      conditions.push('precio <= ?');
      params.push(Number(maxPrice));
    }

    const [products] = await pool.query(
      `SELECT id, nombre, descripcion, categoria, precio, imagen_url, stock, destacado
       FROM productos WHERE ${conditions.join(' AND ')} ORDER BY destacado DESC, nombre ASC`,
      params
    );
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT categoria FROM productos WHERE activo = 1 ORDER BY categoria');
    res.json({ data: ['Todos', ...rows.map((row) => row.categoria)] });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'ID de producto inválido.' });

    const [rows] = await pool.query(
      `SELECT id, nombre, descripcion, categoria, precio, imagen_url, stock, destacado
       FROM productos WHERE id = ? AND activo = 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Producto no encontrado.' });
    res.json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
