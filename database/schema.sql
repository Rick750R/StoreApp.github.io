-- STOREAPP: ESQUEMA COMPLETO PARA INSTALAR
-- Este es el unico archivo SQL que necesita ejecutar el proyecto.
-- Docker lo ejecuta automaticamente al inicializar el volumen datos_mysql

CREATE DATABASE IF NOT EXISTS catalogo_tienda
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE catalogo_tienda;

CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NOT NULL,
  categoria VARCHAR(60) NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  imagen_url VARCHAR(500) DEFAULT NULL,
  stock INT NOT NULL DEFAULT 0,
  destacado BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (precio >= 0),
  CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('cliente','administrador') NOT NULL DEFAULT 'cliente',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_pedido_numero INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash CHAR(64) PRIMARY KEY,
  usuario_id INT NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expira_en DATETIME NOT NULL,
  INDEX idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  folio VARCHAR(40) DEFAULT NULL UNIQUE,
  cliente_nombre VARCHAR(120) NOT NULL,
  cliente_correo VARCHAR(190) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(40) NOT NULL DEFAULT 'sin_especificar',
  estado_pago VARCHAR(40) NOT NULL DEFAULT 'pendiente',
  pasarela_pago VARCHAR(40) DEFAULT NULL,
  referencia_pago VARCHAR(190) DEFAULT NULL,
  estado ENUM('pendiente','confirmado','preparando','enviado','entregado','cancelado','pendiente_pago','pagado','rechazado') NOT NULL DEFAULT 'pendiente',
  envio_nombre VARCHAR(120) DEFAULT NULL,
  envio_telefono VARCHAR(20) DEFAULT NULL,
  envio_codigo_postal VARCHAR(10) DEFAULT NULL,
  envio_estado VARCHAR(100) DEFAULT NULL,
  envio_municipio VARCHAR(100) DEFAULT NULL,
  envio_colonia VARCHAR(120) DEFAULT NULL,
  envio_calle VARCHAR(150) DEFAULT NULL,
  envio_numero_exterior VARCHAR(20) DEFAULT NULL,
  envio_numero_interior VARCHAR(20) DEFAULT NULL,
  envio_referencias VARCHAR(500) DEFAULT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pedido_detalles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  CHECK (cantidad > 0)
);

INSERT INTO productos (nombre, descripcion, categoria, precio, imagen_url, stock, destacado)
SELECT * FROM (
  SELECT 'Audífonos inalámbricos', 'Audífonos Bluetooth para escuchar música y atender llamadas.', 'Audio', 350.00,
         'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80', 12, TRUE
  UNION ALL
  SELECT 'Laptop Slim', 'Laptop ligera para estudiar, trabajar y navegar.', 'Computadoras', 12500.00,
         'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80', 5, TRUE
  UNION ALL
  SELECT 'Cámara digital', 'Cámara compacta para fotografía y video.', 'Cámaras', 6800.00,
         'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80', 7, FALSE
  UNION ALL
  SELECT 'Smartwatch Sport', 'Reloj inteligente para actividad diaria y notificaciones.', 'Accesorios', 799.00,
         'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80', 9, TRUE
  UNION ALL
  SELECT 'Teclado mecánico', 'Teclado mecánico para trabajo y videojuegos.', 'Accesorios', 950.00,
         'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=900&q=80', 15, FALSE
  UNION ALL
  SELECT 'Bocina portátil', 'Bocina Bluetooth compacta para escuchar música.', 'Audio', 620.00,
         'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80', 0, FALSE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM productos LIMIT 1);
