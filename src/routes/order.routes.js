const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ORDER_STATUSES = new Set([
  'pendiente',
  'confirmado',
  'preparando',
  'enviado',
  'entregado'
]);

const PAYMENT_METHODS = new Set(['tarjeta_demo', 'transferencia_demo']);

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function validateShippingAddress(input) {
  const address = {
    nombre: cleanText(input?.nombre, 120),
    telefono: cleanText(input?.telefono, 20),
    codigoPostal: cleanText(input?.codigoPostal, 10),
    estado: cleanText(input?.estado, 100),
    municipio: cleanText(input?.municipio, 100),
    colonia: cleanText(input?.colonia, 120),
    calle: cleanText(input?.calle, 150),
    numeroExterior: cleanText(input?.numeroExterior, 20),
    numeroInterior: cleanText(input?.numeroInterior, 20),
    referencias: cleanText(input?.referencias, 500)
  };

  const requiredFields = [
    ['nombre', 'nombre de quien recibe'],
    ['telefono', 'teléfono'],
    ['codigoPostal', 'código postal'],
    ['estado', 'estado'],
    ['municipio', 'municipio o alcaldía'],
    ['colonia', 'colonia'],
    ['calle', 'calle'],
    ['numeroExterior', 'número exterior']
  ];
  for (const [key, label] of requiredFields) {
    if (!address[key]) {
      throw Object.assign(new Error(`Completa el campo ${label} de la dirección de entrega.`), { status: 400 });
    }
  }

  const phoneDigits = address.telefono.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    throw Object.assign(new Error('El teléfono debe contener entre 10 y 15 dígitos.'), { status: 400 });
  }
  if (!/^\d{5}$/.test(address.codigoPostal)) {
    throw Object.assign(new Error('El código postal debe tener 5 dígitos.'), { status: 400 });
  }

  return address;
}

function groupOrderRows(rows) {
  const ordersById = new Map();
  for (const row of rows) {
    if (!ordersById.has(row.id)) {
      ordersById.set(row.id, {
        id: row.id,
        usuario_id: row.usuario_id,
        cliente_nombre: row.cliente_nombre,
        cliente_correo: row.cliente_correo,
        total: row.total,
        estado: row.estado,
        creado_en: row.creado_en,
        metodo_pago: row.metodo_pago,
        estado_pago: row.estado_pago,
        pasarela_pago: row.pasarela_pago,
        referencia_pago: row.referencia_pago,
        envio_nombre: row.envio_nombre,
        envio_telefono: row.envio_telefono,
        envio_codigo_postal: row.envio_codigo_postal,
        envio_estado: row.envio_estado,
        envio_municipio: row.envio_municipio,
        envio_colonia: row.envio_colonia,
        envio_calle: row.envio_calle,
        envio_numero_exterior: row.envio_numero_exterior,
        envio_numero_interior: row.envio_numero_interior,
        envio_referencias: row.envio_referencias,
        items: []
      });
    }

    if (row.detalle_id !== null) {
      ordersById.get(row.id).items.push({
        producto_id: row.producto_id,
        nombre: row.producto_nombre || `Producto #${row.producto_id}`,
        imagen_url: row.imagen_url,
        cantidad: row.cantidad,
        precio_unitario: row.precio_unitario
      });
    }
  }
  return [...ordersById.values()];
}

const ORDER_SELECT = `
  SELECT p.id, p.usuario_id, p.cliente_nombre, p.cliente_correo,
         p.total, p.estado, p.creado_en,
         p.metodo_pago, p.estado_pago, p.pasarela_pago, p.referencia_pago,
         p.envio_nombre, p.envio_telefono, p.envio_codigo_postal,
         p.envio_estado, p.envio_municipio, p.envio_colonia,
         p.envio_calle, p.envio_numero_exterior, p.envio_numero_interior,
         p.envio_referencias,
         pd.id AS detalle_id, pd.producto_id, pd.cantidad, pd.precio_unitario,
         pr.nombre AS producto_nombre, pr.imagen_url
  FROM pedidos p
  LEFT JOIN pedido_detalles pd ON pd.pedido_id = p.id
  LEFT JOIN productos pr ON pr.id = pd.producto_id`;

// Crear un pedido: se verifica el inventario y se guarda una copia de la dirección
// para que no cambie si el cliente modifica su domicilio en una compra futura.
router.post('/', requireAuth, async (req, res, next) => {
  const { items } = req.body || {};
  const paymentMethod = String(req.body?.paymentMethod || '');
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return res.status(400).json({ message: 'Selecciona un método de pago de demostración válido.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Agrega al menos un producto al pedido.' });
  }

  let shippingAddress;
  try {
    shippingAddress = validateShippingAddress(req.body?.shippingAddress);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }

  const normalizedItems = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ message: 'Producto o cantidad inválidos.' });
    }
    normalizedItems.set(productId, (normalizedItems.get(productId) || 0) + quantity);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let total = 0;
    const orderLines = [];

    for (const [productId, quantity] of normalizedItems.entries()) {
      const [rows] = await connection.query(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = 1 FOR UPDATE',
        [productId]
      );
      if (!rows.length) throw Object.assign(new Error(`El producto ${productId} no existe o está inactivo.`), { status: 400 });

      const product = rows[0];
      if (product.stock < quantity) throw Object.assign(new Error(`No hay existencias suficientes de "${product.nombre}".`), { status: 409 });
      const price = Number(product.precio);
      total += price * quantity;
      orderLines.push({ productId, quantity, price });
    }

    const [orderResult] = await connection.query(
      `INSERT INTO pedidos (
        usuario_id, cliente_nombre, cliente_correo, total, estado,
        metodo_pago, estado_pago,
        envio_nombre, envio_telefono, envio_codigo_postal, envio_estado,
        envio_municipio, envio_colonia, envio_calle, envio_numero_exterior,
        envio_numero_interior, envio_referencias
      ) VALUES (?, ?, ?, ?, 'pendiente', ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, req.user.nombre, req.user.correo, total.toFixed(2), paymentMethod,
        shippingAddress.nombre, shippingAddress.telefono, shippingAddress.codigoPostal,
        shippingAddress.estado, shippingAddress.municipio, shippingAddress.colonia,
        shippingAddress.calle, shippingAddress.numeroExterior,
        shippingAddress.numeroInterior || null, shippingAddress.referencias || null
      ]
    );

    for (const line of orderLines) {
      await connection.query(
        'INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [orderResult.insertId, line.productId, line.quantity, line.price.toFixed(2)]
      );
      await connection.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [line.quantity, line.productId]);
    }

    await connection.commit();
    res.status(201).json({
      message: 'Pedido registrado correctamente. El pago está pendiente de simulación; no se realizó ningún cobro.',
      data: { orderId: orderResult.insertId, total: Number(total.toFixed(2)), status: 'pendiente', paymentStatus: 'pendiente' }
    });
  } catch (error) {
    await connection.rollback();
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  } finally {
    connection.release();
  }
});

// Cada cliente consulta únicamente los pedidos asociados a su sesión.
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${ORDER_SELECT} WHERE p.usuario_id = ? ORDER BY p.creado_en DESC, p.id DESC, pd.id ASC`,
      [req.user.id]
    );
    res.json({ data: groupOrderRows(rows) });
  } catch (error) {
    next(error);
  }
});

// Entorno de prueba: simula una respuesta del proveedor sin usar ni almacenar datos bancarios.
router.post('/:id/payment-simulation', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = String(req.body?.result || '');
    if (!Number.isInteger(id) || id < 1 || !['approved', 'rejected'].includes(result)) {
      return res.status(400).json({ message: 'Indica un pedido y un resultado de simulación válido.' });
    }

    const [orders] = await pool.query(
      'SELECT id, metodo_pago FROM pedidos WHERE id = ? AND usuario_id = ? LIMIT 1',
      [id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ message: 'No se encontró el pedido de esta cuenta.' });
    if (!PAYMENT_METHODS.has(orders[0].metodo_pago)) {
      return res.status(400).json({ message: 'Este pedido no utiliza un método de pago de demostración.' });
    }

    const paymentStatus = result === 'approved' ? 'aprobado_simulado' : 'rechazado_simulado';
    const reference = `SIM-${id}-${Date.now()}`;
    await pool.query(
      `UPDATE pedidos
       SET estado_pago = ?, pasarela_pago = 'simulador_storeapp', referencia_pago = ?
       WHERE id = ? AND usuario_id = ?`,
      [paymentStatus, reference, id, req.user.id]
    );

    res.json({
      message: result === 'approved'
        ? 'Pago aprobado en la simulación. No se realizó ningún cobro real.'
        : 'Pago rechazado en la simulación. No se realizó ningún cargo; puedes intentarlo nuevamente desde Mis pedidos.',
      data: { orderId: id, paymentStatus, reference }
    });
  } catch (error) {
    next(error);
  }
});

// El administrador puede consultar todos los pedidos y sus direcciones de entrega.
router.get('/admin/all', requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${ORDER_SELECT} ORDER BY p.creado_en DESC, p.id DESC, pd.id ASC`
    );
    res.json({ data: groupOrderRows(rows) });
  } catch (error) {
    next(error);
  }
});

// Solo el administrador puede actualizar el estado logístico del pedido.
router.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.estado || '');
    if (!Number.isInteger(id) || id < 1 || !ORDER_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Indica un pedido y un estado válido.' });
    }

    const [result] = await pool.query('UPDATE pedidos SET estado = ? WHERE id = ?', [status, id]);
    if (!result.affectedRows) {
      const [rows] = await pool.query('SELECT id FROM pedidos WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ message: 'No se encontró el pedido.' });
    }
    res.json({ message: 'El estado del pedido se actualizó correctamente.', data: { id, estado: status } });
  } catch (error) {
    next(error);
  }
});

// Cancelar desde administración elimina el pedido y devuelve al inventario las unidades reservadas.
router.delete('/:id', requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Indica un número de pedido válido.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query(
      'SELECT id FROM pedidos WHERE id = ? FOR UPDATE', [id]
    );
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'No se encontró el pedido.' });
    }

    const [details] = await connection.query(
      'SELECT producto_id, cantidad FROM pedido_detalles WHERE pedido_id = ? FOR UPDATE', [id]
    );
    for (const item of details) {
      await connection.query(
        'UPDATE productos SET stock = stock + ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    await connection.query('DELETE FROM pedido_detalles WHERE pedido_id = ?', [id]);
    await connection.query('DELETE FROM pedidos WHERE id = ?', [id]);
    await connection.commit();
    res.json({
      message: `El pedido #${id} se canceló y eliminó. Las existencias se devolvieron al inventario.`,
      data: { id, deleted: true, stockRestored: true }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
