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

 5.Preparación de la base de datos MySQL

Antes de ejecutar la aplicación, es necesario tener instalado y funcionando MySQL.

Abrir MySQL Workbench o el programa que utilices para administrar MySQL.

Conectarse al servidor de base de datos.

Crear la base de datos catalogo_tienda, si todavía no existe.

Ejecutar el archivo SQL del proyecto que contiene la estructura de las tablas y los datos iniciales.

Verificar que las tablas se hayan creado correctamente.

La aplicación utiliza esta base de datos para almacenar y consultar la información de los productos, usuarios, pedidos y demás datos necesarios para su funcionamiento.

Configuración de las variables de entorno

Crear un archivo .env tomando como referencia .env.example y configurar los datos de conexión a MySQL:

PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=catalogo_tienda

Se deben utilizar las credenciales correspondientes al servidor MySQL instalado en el equipo.

Importante: El servidor MySQL debe estar iniciado para que StoreApp pueda conectarse correctamente.


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



