¡Excelente iniciativa, Leopoldo! He revisado tu diagrama en la imagen. Tienes una base **muy sólida** y moderna (el uso de UUIDs y JSONB es profesional).

Sin embargo, para que el sistema funcione como un verdadero "Gestor de Datos Universitarios" y soporte el dashboard que quieres, **hacen falta un par de conexiones clave** que no están en el dibujo (específicamente: ¿Cómo sabe el sistema que *ese* usuario tiene permiso de subir archivos a *ese* departamento?).

A continuación, te presento la **Documentación Técnica Oficial** del modelo, incluyendo las mejoras necesarias y la explicación de "por qué lo hacemos así" para que todo tu equipo (y tus profesores) lo entiendan.

---

# 📘 Documentación del Modelo de Datos: Sistema de Gestión Dinámica de Departamentos

## 1. El Concepto: ¿Por qué no usamos una base de datos "normal"?

En una base de datos tradicional, las tablas son rígidas (como una hoja de papel impresa). Si Relaciones Públicas quiere guardar "Instagram Followers" y Finanzas quiere guardar "Presupuesto", tendríamos que modificar la base de datos cada vez.

**Nuestra Solución: Arquitectura Híbrida (Relacional + Documental)**
Hemos diseñado un sistema que actúa como un **"Traductor Universal"**:

1. **Estructura Fija (Relacional):** Para lo que nunca cambia (Usuarios, Nombres de Departamentos, Seguridad).
2. **Estructura Flexible (JSONB):** Para los datos de los Excel, que cambian siempre. Usamos `JSONB` en PostgreSQL para guardar las filas de Excel tal cual vienen, permitiendo consultas ultrarrápidas sin romper la base de datos.

---

## 2. Mejoras Implementadas al Diagrama Original

Basado en tu imagen, he agregado/modificado lo siguiente para garantizar la seguridad y coherencia:

1. **NUEVA ENTIDAD: `USUARIO_DEPARTAMENTO`:** En tu dibujo, el Usuario y el Departamento estaban desconectados. Agregamos esta tabla intermedia para asignar qué usuarios pertenecen a qué departamento (y con qué rol).
2. **Estandarización de Nombres:** Recomiendo usar `snake_case` (minúsculas y guiones bajos) en toda la base de datos para evitar problemas con PostgreSQL/Linux. (Ej: `VARIABLE_METADATO` pasa a `variable_metadato`).
3. **Optimización de `PERFIL`:** Se mantiene, pero se aclara que es una extensión 1:1 del usuario.

---

## 3. Diccionario de Datos (Detalle de Entidades)

Aquí tienes la descripción técnica para la documentación del proyecto.

### A. Módulo de Organización y Acceso

#### 🏢 1. `departamentos`

**Descripción:** Representa las áreas de la universidad (ej: "Bienestar Estudiantil", "Investigación"). Es la entidad "dueña" de los datos.

* **PK `id` (UUID):** Identificador único universal.
* **`nombre` (VARCHAR):** Nombre del área.
* **`codigo_interno` (VARCHAR):** (Mejora) Código administrativo (ej: "DEP-001").

#### 👥 2. `usuarios`

**Descripción:** Las personas que interactúan con el sistema.

* **PK `id` (UUID):** Identificador del usuario.
* **`email` (VARCHAR):** Correo institucional (clave para el login).
* **`password_hash` (VARCHAR):** Contraseña encriptada (nunca texto plano).
* **`estado` (BOOLEAN):** Activo/Inactivo.

#### 🔗 3. `usuario_departamento` (¡CRUCIAL - Faltaba en el diagrama!)

**Descripción:** Tabla pivote que conecta usuarios con departamentos. Permite que un usuario pueda ver datos de "Investigación" y "Docencia" al mismo tiempo si es necesario.

* **PK `id` (UUID)**
* **FK `usuario_id`:** Quién es.
* **FK `departamento_id`:** A qué departamento accede.
* **`rol` (ENUM):** ('ADMIN', 'EDITOR', 'LECTOR'). Define si puede subir Excel o solo ver el dashboard.

---

### B. Módulo de Datos Dinámicos (El Corazón del Sistema)

#### 📂 4. `datasets`

**Descripción:** Representa "El Archivo" que se subió. Es el contenedor lógico de la información.

* **PK `id` (UUID)**
* **FK `departamento_id`:** ¿De quién es este archivo?
* **FK `subido_por_usuario_id`:** (Mejora) Trazabilidad de quién lo subió.
* **`nombre_archivo` (VARCHAR):** Ej: "nomina_2025_v2.xlsx".
* **`fecha_carga` (TIMESTAMP):** Cuándo ocurrió.

#### 🧠 5. `variables_metadatos`

**Descripción:** Es el **"Cerebro" del Dashboard**. Aquí se guarda *qué* significan las columnas del Excel. Sin esto, el sistema no sabe qué graficar.

* **PK `id` (UUID)**
* **FK `dataset_id`:** Pertenece a un archivo específico.
* **`nombre_columna` (VARCHAR):** El encabezado del Excel (ej: "Salario").
* **`tipo_dato` (ENUM):** ('NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO').
* *Nota:* Si es 'NUMERICO', el dashboard sugerirá gráficos de barras/lineales. Si es 'CATEGORICO', sugerirá pasteles.



#### 💾 6. `registros_datos`

**Descripción:** El almacén de alto rendimiento. Aquí vive la data cruda.

* **PK `id` (UUID)** or **BIGSERIAL** (Recomiendo BIGSERIAL aquí por pura velocidad de indexación, aunque UUID es válido).
* **FK `dataset_id`:** Para poder borrar todos los datos si se borra el archivo.
* **`data` (JSONB):** **La joya de la corona.** Aquí se guarda la fila completa del Excel.
* *Ejemplo almacenado:* `{"Edad": 22, "Carrera": "Software", "Promedio": 9.5}`
* *Por qué:* Permite guardar 5 columnas o 50 columnas sin cambiar la tabla.



---

## 4. Estrategia de Almacenamiento: ¿Por qué JSONB?

En la documentación para tu profesor/equipo, añade este apartado para justificar la tecnología:

> **"Estrategia de Persistencia Híbrida"**
> Para este proyecto, hemos descartado el modelo tradicional EAV (Entidad-Atributo-Valor) porque genera consultas lentas al requerir múltiples "JOINs" para reconstruir una sola fila de información.
> En su lugar, utilizamos el tipo de dato **JSONB (Binary JSON)**. Esto nos permite:
> 1. **Flexibilidad de Esquema:** Cada departamento puede tener variables diferentes sin alterar la estructura de la base de datos (DDL).
> 2. **Velocidad de Lectura:** Al recuperar datos para el Dashboard, la base de datos lee el registro completo en una sola operación, en lugar de reconstruirlo desde fragmentos dispersos.
> 3. **Indexación:** A diferencia de guardar texto plano, JSONB permite crear índices GIN (Generalized Inverted Index) sobre las claves dentro del JSON, permitiendo filtrar "Donde 'Carrera' sea 'Software'" a velocidades comparables con una columna relacional estándar.
> 
> 

---

### Siguiente Paso

Leopoldo, con estas correcciones (especialmente la tabla `usuario_departamento`), tu diagrama ya soporta la lógica de negocio real.

¿Te gustaría que te genere el **script SQL (CREATE TABLE)** con estas correcciones exactas para que solo tengas que copiar y pegar en tu base de datos?