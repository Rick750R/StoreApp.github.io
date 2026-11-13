-- Ejecuta este archivo UNA SOLA VEZ sobre la base catalogo_tienda existente.
-- Conserva los productos y pedidos que ya existen.
USE catalogo_tienda;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  correo VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('cliente','administrador') NOT NULL DEFAULT 'cliente',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
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

-- Añadir usuario_id a pedidos sin duplicar la columna si la migración se repite.
SET @has_usuario_id = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'usuario_id'
);
SET @sql_add_usuario_id = IF(
  @has_usuario_id = 0,
  'ALTER TABLE pedidos ADD COLUMN usuario_id INT NULL AFTER id',
  'SELECT 1'
);
PREPARE stmt_add_usuario_id FROM @sql_add_usuario_id;
EXECUTE stmt_add_usuario_id;
DEALLOCATE PREPARE stmt_add_usuario_id;

-- Relacionar los pedidos nuevos con la cuenta, conservando los pedidos históricos.
SET @has_fk_usuario_id = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND CONSTRAINT_NAME = 'fk_pedidos_usuario' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_add_fk_usuario_id = IF(
  @has_fk_usuario_id = 0,
  'ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_add_fk_usuario_id FROM @sql_add_fk_usuario_id;
EXECUTE stmt_add_fk_usuario_id;
DEALLOCATE PREPARE stmt_add_fk_usuario_id;
