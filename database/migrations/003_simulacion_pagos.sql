-- StoreApp: campos para preparar una futura pasarela de pago.

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'metodo_pago');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN metodo_pago VARCHAR(40) NOT NULL DEFAULT ''sin_especificar''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'estado_pago');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN estado_pago VARCHAR(40) NOT NULL DEFAULT ''pendiente''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'pasarela_pago');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN pasarela_pago VARCHAR(40) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'referencia_pago');
SET @sql = IF(@has_col = 0, 'ALTER TABLE pedidos ADD COLUMN referencia_pago VARCHAR(190) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Mantener una referencia inicial al método simulado para las compras ya registradas.
UPDATE pedidos
SET metodo_pago = 'sin_especificar'
WHERE metodo_pago IS NULL OR metodo_pago = '';

-- Los estados antiguos de pedido pagado o rechazado se reflejan también en el nuevo campo de pago.
UPDATE pedidos SET estado_pago = 'aprobado' WHERE estado = 'pagado' AND estado_pago = 'pendiente';
UPDATE pedidos SET estado_pago = 'rechazado' WHERE estado = 'rechazado' AND estado_pago = 'pendiente';
