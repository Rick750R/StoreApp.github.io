# StoreApp - Catálogo de productos tecnológicos

## Descripción del proyecto

StoreApp es una aplicación web desarrollada para la consulta y compra de productos tecnológicos. Permite a los usuarios visualizar un catálogo de productos, registrarse, iniciar sesión, agregar artículos al carrito y realizar pedidos.

También cuenta con un apartado de administrador que permite gestionar los productos disponibles en la tienda.

## Tecnologías utilizadas

- Node.js
- Express
- MySQL
- HTML
- CSS
- JavaScript
- Docker

## Requisitos

Para instalar y ejecutar el proyecto se necesita:

- Node.js y npm.
- MySQL Server.
- MySQL Workbench (opcional, para administrar la base de datos).
- Docker Desktop (para ejecutar la aplicación mediante contenedores).

## 1. Descargar el proyecto

Descargar el repositorio desde GitHub:

https://github.com/Rick750R/StoreApp.github.io

Seleccionar la opción **Code → Download ZIP** y extraer el archivo en una carpeta del equipo.

También se puede clonar el repositorio utilizando Git.

## 2. Preparación de la base de datos MySQL

Antes de ejecutar la aplicación, es necesario preparar la base de datos.

1. Iniciar el servidor MySQL.
2. Abrir MySQL Workbench y conectarse al servidor.
3. Crear la base de datos con el nombre `catalogo_tienda`, si todavía no existe.
4. Abrir el archivo SQL del proyecto ubicado en la carpeta `database`.
5. Ejecutar las instrucciones SQL para crear las tablas y preparar la estructura necesaria.
6. Verificar que las tablas se hayan creado correctamente.

La base de datos almacena la información de los productos, usuarios, pedidos y demás datos utilizados por la aplicación.

**Importante:** La base de datos debe estar creada y el servidor MySQL debe permanecer activo para que la aplicación pueda funcionar correctamente.

## 3. Configuración de variables de entorno

En la carpeta principal del proyecto se encuentra el archivo `.env.example`.

Crear una copia de este archivo y nombrarla `.env`.

Dentro del archivo `.env` configurar los datos de conexión a MySQL:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=catalogo_tienda
```

Reemplazar los valores de ejemplo por las credenciales correspondientes al servidor MySQL del equipo.

## 4. Instalación de dependencias

Abrir una terminal dentro de la carpeta del proyecto y ejecutar el siguiente comando:

```bash
npm install
```

Este comando instala las dependencias necesarias para el funcionamiento de la aplicación.

## 5. Ejecutar la aplicación con Node.js

Una vez configurada la base de datos e instaladas las dependencias, iniciar el servidor con:

```bash
npm start
```

Cuando el servidor esté funcionando, abrir el navegador y acceder a:

http://localhost:3000

## 6. Ejecutar la aplicación mediante Docker

También es posible ejecutar StoreApp utilizando Docker.

Primero, comprobar que Docker Desktop esté iniciado y que MySQL se encuentre funcionando en el equipo.

### Construir la imagen

Desde la carpeta principal del proyecto, ejecutar:

```bash
docker build -t storeapp .
```

Este comando construye la imagen de Docker utilizando las instrucciones del archivo Dockerfile.

### Ejecutar el contenedor

Ejecutar el siguiente comando:

```bash
docker run -d -p 3000:3000 --env-file .env -e DB_HOST=host.docker.internal --name storeapp-container storeapp
```

La configuración `host.docker.internal` permite que el contenedor se comunique con el servidor MySQL instalado en el equipo anfitrión.

### Acceder a la aplicación

Abrir el navegador y entrar a:

http://localhost:3000

### Comprobar la conexión con MySQL

Para verificar que el servidor y la base de datos estén disponibles, ingresar a:

http://localhost:3000/api/health

Si la conexión funciona correctamente, se mostrará el siguiente mensaje:

```json
{
  "ok": true,
  "message": "Servidor y base de datos disponibles"
}
```

## 7. Detener el contenedor

Para detener la aplicación ejecutada mediante Docker, utilizar:

```bash
docker stop storeapp-container
```

Si se desea eliminar el contenedor, ejecutar:

```bash
docker rm storeapp-container
```

## 8. Variables y archivos importantes

| Archivo | Descripción |
|---|---|
| `server.js` | Archivo principal que inicia el servidor. |
| `package.json` | Contiene la información y dependencias del proyecto. |
| `package-lock.json` | Registra las versiones de las dependencias. |
| `Dockerfile` | Contiene las instrucciones para construir la imagen Docker. |
| `.dockerignore` | Evita copiar archivos innecesarios al construir la imagen. |
| `.gitignore` | Evita publicar archivos privados o innecesarios en GitHub. |
| `.env` | Contiene las variables de entorno privadas. |
| `.env.example` | Muestra las variables necesarias para configurar el proyecto. |
| `README.md` | Contiene las instrucciones y documentación del proyecto. |

## 9. Repositorio en GitHub

El código fuente del proyecto se encuentra disponible en el siguiente repositorio:

https://github.com/Rick750R/StoreApp.github.io

