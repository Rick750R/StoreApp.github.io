-- Ejecuta este archivo UNA SOLA VEZ sobre catalogo_tienda.
-- Agrega una copia de la dirección de entrega a cada pedido y estados logísticos.
USE catalogo_tienda;

-- Agregar columnas de dirección solo cuando todavía no existan.
SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_nombre');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_nombre VARCHAR(120) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_telefono');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_telefono VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_codigo_postal');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_codigo_postal VARCHAR(10) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_estado');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_estado VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_municipio');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_municipio VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_colonia');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_colonia VARCHAR(120) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_calle');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_calle VARCHAR(150) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_numero_exterior');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_numero_exterior VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_numero_interior');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_numero_interior VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'envio_referencias');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN envio_referencias VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Conservar los estados anteriores, incorporar el seguimiento logístico y usar pendiente para pedidos nuevos.
ALTER TABLE pedidos
  MODIFY COLUMN estado ENUM(
    'pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado',
    'pendiente_pago', 'pagado', 'rechazado'
  ) NOT NULL DEFAULT 'pendiente';

-- Los pedidos anteriores que esperaban pago pasan a pendiente de revisión logística.
UPDATE pedidos SET estado = 'pendiente' WHERE estado = 'pendiente_pago';
