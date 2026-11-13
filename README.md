# StoreApp - Catálogo de productos tecnológicos

## Descripción del proyecto

StoreApp es una aplicación web desarrollada para la consulta y compra de productos tecnológicos. Permite a los usuarios visualizar un catálogo, registrarse, iniciar sesión, agregar productos al carrito y realizar pedidos.

También cuenta con un apartado de administrador para gestionar los productos disponibles en la tienda.

## Tecnologías utilizadas

- Node.js
- Express
- MySQL
- HTML, CSS y JavaScript
- Docker

## Requisitos

Para ejecutar el proyecto se necesita:

- Node.js y npm.
- MySQL.
- Docker Desktop (para ejecutarlo mediante contenedores).

## Configuración del proyecto

1. Descargar o clonar el repositorio.
2. Abrir la carpeta del proyecto.
3. Crear un archivo `.env` tomando como referencia `.env.example`.
4. Configurar los datos de conexión a MySQL:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=catalogo_tienda
```

5. Preparar la base de datos `catalogo_tienda` en MySQL con la estructura necesaria para la aplicación.
6. Instalar las dependencias:

```bash
npm install
```

## Ejecutar la aplicación con Node.js

Después de configurar las variables de entorno y la base de datos, ejecutar:

```bash
npm start
```

Abrir en el navegador:

```text
http://localhost:3000
```

## Ejecutar la aplicación con Docker

Primero, construir la imagen:

```bash
docker build -t storeapp .
```

Después, ejecutar el contenedor:

```bash
docker run -d -p 3000:3000 --env-file .env -e DB_HOST=host.docker.internal --name storeapp-container storeapp
```

Abrir en el navegador:

```text
http://localhost:3000
```

Para comprobar la conexión con el servidor y la base de datos, ingresar a:

```text
http://localhost:3000/api/health
```

## Variables de entorno

El archivo `.env.example` muestra las variables necesarias para configurar el proyecto sin compartir credenciales reales.



