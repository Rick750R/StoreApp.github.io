# StoreApp – PHP, servicios independientes y Docker


## Requisitos
- Docker Desktop iniciado y usando contenedores Linux.
- Visual Studio Code.
- MySQL Workbench es opcional; no se necesita instalar ni iniciar un servidor MySQL local.

## Preparar el proyecto
1. Descomprime el ZIP.
2. Abre en VS Code la carpeta `catalogo_productos`.
3. En esa misma carpeta, copia `.env.example` y renombra la copia a `.env`. 
4. Abre `.env` y cambia `DB_PASSWORD` y `MYSQL_ROOT_PASSWORD` por contraseñas propias. Usa los mismos valores que queden escritos en ese archiv.
5. Los valores `STORE_TRANSFER_*` son los datos que la tienda mostrará para transferencias de demostración. Sustituye los ejemplos por los datos que quieras mostrar o déjalos vacíos si todavía no los defines. No se realiza ninguna transferencia real.

## Base de datos: un solo SQL
Toda la estructura está consolidada en `database/schema.sql`. Incluye creación de la base `catalogo_tienda`, productos iniciales, usuarios y sesiones para autenticación, roles, relación de usuarios con pedidos, direcciones de entrega, estados de pedido, métodos/estados/referencias de pago, folio único y contador consecutivo por usuario, detalles de pedido y llaves foráneas.

**No necesitas crear la base manualmente en MySQL Workbench ni ejecutar allí el SQL.** Al iniciar Docker por primera vez, el contenedor MySQL crea la base y ejecuta automáticamente `database/schema.sql`.

### Workbench (opcional)
Si quieres visualizar la base que está dentro de Docker desde Workbench, crea una conexión con: Hostname `127.0.0.1`, Port `3307`, Username `storeapp`, Password el valor de `DB_PASSWORD` en `.env`. La base se llama `catalogo_tienda`. El puerto 3307 se publica solo en localhost para evitar chocar con un MySQL local que use 3306.

## Levantar la aplicación
Desde una terminal ubicada en la carpeta que contiene `docker-compose.yml`, ejecuta:

```powershell
docker compose up -d --build
```

Comprueba los contenedores:

```powershell
docker compose ps
```

Abre `http://localhost:8080`. Deben estar los servicios `tienda-web`, `usuarios`, `productos`, `pedidos` y `database` (cinco contenedores separados).

## Crear el administrador
Cuando los contenedores estén iniciados, ejecuta:

```powershell
docker compose exec usuarios php create-admin.php "Administrador StoreApp" admin@storeapp.local "CambiaEstaClave123!"
```

Usa una contraseña propia de al menos 8 caracteres. El administrador se crea dentro de la base nueva de Docker. El registro público de la página crea cuentas con rol cliente.

## Servicios y rutas
| Contenedor | Responsabilidad |
|---|---|
| `tienda-web` | Nginx: página estática y entrada a las API |
| `usuarios` | Registro, login, logout, sesiones, roles y datos de transferencia |
| `productos` | Catálogo, categorías, administración e imágenes |
| `pedidos` | Pedidos, folios, inventario, historial y pagos de demostración |
| `database` | MySQL 8.4 y archivo único `schema.sql` |

## Comandos útiles

```powershell
# Ver contenedores
docker compose ps

# Ver registros
docker compose logs -f

# Ver registros de un servicio
docker compose logs -f usuarios
docker compose logs -f productos
docker compose logs -f pedidos
docker compose logs -f database

# Detener sin borrar datos
docker compose down

# Volver a iniciar
docker compose up -d

# Borrar la base y las imágenes guardadas en volúmenes Docker
docker compose down -v
```

## Pagos
El formulario de tarjeta y transferencia es de demostración. No se envían datos de tarjeta a un banco ni se realizan cargos reales. Los datos de tarjeta no se almacenan.
