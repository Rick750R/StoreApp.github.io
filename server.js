require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('./src/config/db');
const authRoutes = require('./src/routes/auth.routes');
const catalogRoutes = require('./src/routes/catalog.routes');
const orderRoutes = require('./src/routes/order.routes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, 'public');
fs.mkdirSync(path.join(publicDir, 'uploads'), { recursive: true });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(publicDir));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, message: 'Servidor y base de datos disponibles' });
  } catch (error) {
    console.error('Health check:', error.message);
    res.status(500).json({ ok: false, message: 'El servidor funciona, pero no se pudo conectar con MySQL' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', catalogRoutes);
app.use('/api/orders', orderRoutes);

app.use('/api', (_req, res) => res.status(404).json({ message: 'Ruta de API no encontrada' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Ocurrió un error interno del servidor' });
});

app.listen(PORT, () => console.log(`StoreApp disponible en http://localhost:${PORT}`));
