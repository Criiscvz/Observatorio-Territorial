
# Observatorio - Backend

Este es el backend del proyecto **Observatorio**, una plataforma para la gestión, análisis y visualización de datos institucionales y académicos. El backend expone una API y administra la lógica de negocio, autenticación, usuarios, datasets, variables y más.

## Características principales

- Gestión de usuarios, perfiles y departamentos
- Administración y consulta de datasets y variables
- Importación de datos desde archivos Excel
- API RESTful para integración con el frontend
- Autenticación y autorización
- Migraciones y seeders para la base de datos

## Estructura del proyecto

```
backend/
├── app/                # Lógica de aplicación y modelos
├── config/             # Configuración de la aplicación
├── database/           # Migraciones, seeders y factories
├── public/             # Punto de entrada público
├── resources/          # Vistas y recursos estáticos
├── routes/             # Definición de rutas (API, web)
├── tests/              # Pruebas unitarias y funcionales
├── ...
```

## Requisitos previos

- PHP >= 8.1
- Composer
- Docker y Docker Compose (opcional, recomendado)
- MySQL o MariaDB (si no usas Docker)

## Instalación y puesta en marcha

1. **Clona el repositorio y entra al backend:**
 ```sh
 git clone <REPO_URL>
 cd Observatorio/backend
 ```

2. **Instala dependencias:**
 ```sh
 composer install
 ```

3. **Configura el entorno:**
 ```sh
 cp .env.example .env
 php artisan key:generate
 ```

	Edita `.env` para los datos de tu base de datos y otros parámetros.

4. **Ejecuta migraciones y seeders:**
 ```sh
 php artisan migrate --seed
 ```

5. **Levanta el servidor de desarrollo:**
 ```sh
 php artisan serve
 ```

	El backend estará disponible en `http://localhost:8000`.

## Uso con Docker

Desde la raíz del proyecto (donde está `docker-compose.yml`):

```sh
docker-compose up --build
```

Esto levantará los servicios definidos en el archivo docker-compose. Si solo tienes la base de datos en Docker, ejecuta los siguientes comandos en tu máquina local (no dentro de un contenedor):

```sh
composer install
php artisan migrate --seed
```

Si tienes un contenedor para la aplicación (por ejemplo, un servicio llamado `app` en tu docker-compose), entonces puedes ejecutar los comandos dentro del contenedor así:

```sh
docker-compose exec app bash
# Dentro del contenedor:
composer install
php artisan migrate --seed
```

> **Nota:** Ajusta estos pasos según los servicios definidos en tu archivo `docker-compose.yml`.

## Notas

- El frontend se encuentra en la carpeta `frontend/`.
- Puedes personalizar los seeders y migraciones según tus necesidades.
- Si tienes dudas, revisa los archivos de configuración y la estructura del proyecto.

---

## Licencia

Este proyecto es software de código abierto bajo la [licencia MIT](https://opensource.org/licenses/MIT).
