# NC-06: controles automáticos para pull requests

Corte: 15 de octubre de 2026. Rama: `seguridad-ci`, desde `deploy-gratis`
@ `2a857f8857b988ebc38d145b8a79f80775726748`.

## Alcance

Se prepara el workflow `CI seguridad` para todos los pull requests, pushes a
`main`/`deploy-gratis` y ejecución manual. No despliega, no recibe secretos de
producción, no cambia cuentas ni ejecuta seeds/migraciones contra datos reales.
No utiliza `pull_request_target`, runners propios ni permisos de escritura.

| Check | Control |
| --- | --- |
| Secretos | Gitleaks 8.30.1 con checksum fijado; diez regresiones; árbol rastreado actual y commits nuevos del PR/push |
| Higiene | 14 regresiones del repositorio, ocho del workflow y contexto Docker exclusivamente sintético |
| Backend | PHPUnit con SQLite en memoria y suites JSONB/aislamiento en PostgreSQL 16 desechable |
| Frontend | `npm ci`, pruebas sin watch, build SPA con `/api` y 20 regresiones de cabeceras/PWA sobre el artefacto |
| Resultado | Falla si cualquiera de los cuatro trabajos anteriores falla, se cancela o se omite |

Las acciones externas se fijan por SHA completo; PostgreSQL por digest. Los
checkouts no conservan credenciales y no se comparten cachés ni se suben informes
de secretos como artifacts. Cada trabajo tiene timeout y los runs obsoletos se
cancelan. Las credenciales del PostgreSQL efímero son exclusivamente sintéticas.

## Escaneo y confidencialidad

`scripts/scan-secrets.mjs` exporta únicamente archivos rastreados por Git a un
directorio temporal. No copia `.env`, uploads, dependencias o evidencia privada
que estén ignorados/no rastreados. Rechaza entradas no regulares o en conflicto.

También escanea el rango de commits nuevos suministrado por el evento GitHub.
Solo acepta SHAs completos: esto detecta secretos añadidos y después eliminados
dentro del mismo PR. Una ejecución manual sin rango escanea el árbol actual;
un evento PR/push sin rango válido falla de forma cerrada. No es una auditoría de
todo el historial anterior ni utiliza un baseline para ocultar hallazgos antiguos.

Se conservan las reglas predeterminadas de Gitleaks. La única excepción revisada
combina regla `grafana-api-key`, ruta exacta del seeder de demostración y una línea
completa de URL pública `app.powerbi.com/view`. Esos enlaces contienen
identificadores de publicación Power BI, no credenciales Grafana. No se excluyen
directorios de pruebas/documentación ni se aceptan comentarios `gitleaks:allow`.
Las regresiones prueban tanto la excepción como la detección en el mismo archivo,
otras rutas y commits transitorios.

La salida se limita a ruta, línea, regla y, para historial, SHA del commit. No
publica el valor, línea de código, hash de contraseña, autor, correo ni informe
crudo. Gitleaks recibe `--redact=100`; su stdout/stderr e informe quedan capturados
y el temporal se elimina al terminar. Un error del escáner hace fallar el check.

## Verificación local

- Escáner instalado desde la publicación oficial y SHA-256 verificado en Windows.
- Diez regresiones del escáner aprobadas, incluida detección positiva/redacción y
  secreto sintético añadido/eliminado dentro de un rango Git.
- 22 pruebas de higiene/workflow aprobadas; actionlint 1.7.12 valida sintaxis y
  expresiones. La expresión del puerto se corrigió a clave string durante esa validación.
- Matcher real Docker: 31 exclusiones y 11 inclusiones; sin contexto real, imágenes
  descargadas ni contenedores ejecutados por ese ensayo.
- Backend aislado PHP 8.4.25: SQLite, 188 casos (180 aprobados, ocho omitidos por
  requerir PostgreSQL), 1.106 aserciones; PostgreSQL 16, 77 pruebas aprobadas y 183
  aserciones. Las suites se solapan: no sumar los totales como casos independientes.
- Frontend: 208 pruebas aprobadas en 26 archivos. Build normal y build SPA
  `build:vercel` correctos; este último con `API_URL=/api`. Se restauró el placeholder
  del fuente después del ensayo: no hay cambio de configuración de aplicación en el PR.
- Cabeceras/PWA del artefacto: 20 aprobadas, ninguna omitida. Continúan diez
  advertencias SCSS preexistentes, fuera de este alcance.

Estos resultados locales no se presentan como una ejecución de GitHub. Antes de
fusionar, revisar el primer run real del PR y resolver cualquier fallo del runner.

## Uso local del escáner

PowerShell, desde la raíz del checkout revisado:

```powershell
$env:GITLEAKS_BIN = node scripts/install-gitleaks.mjs
node --test scripts/secret-scan.test.mjs
node scripts/scan-secrets.mjs
```

Se requiere Node 24, Git y `tar`. El instalador admite Windows/Linux x64 y valida
el checksum antes de extraer/ejecutar. El script escanea el contenido del worktree
de las rutas del índice; añadir las nuevas rutas del cambio al índice para
incluirlas en una comprobación local. CI trabaja en un checkout limpio.

## Pendientes y límites de cierre

1. Publicar/revisar el PR y acreditar sus checks reales. No fusionar ni publicar
   a producción automáticamente por el solo hecho de que las pruebas locales pasen.
2. Después del run real, autorizar por separado la regla de rama/ruleset que haga
   obligatorio el check `Resultado` del workflow `CI seguridad`. Un workflow verde
   no impide por sí mismo una fusión que ignore checks si la rama no está protegida.
3. Mantener versiones fijadas y revisar nuevas alertas/excepciones. Este pipeline
   no incorpora todavía auditoría periódica de dependencias, análisis SAST general
   ni cobertura completa del informe; no se declara cierre institucional de NC-06.
4. NC-03 sigue fuera del alcance. El usuario identifica las cuentas pendientes
   como de prueba y realizará su eliminación manual. No se verificó esa eliminación
   ni revocación de sesiones/tokens; no se cambiaron cuentas o credenciales.

## Fuentes técnicas

- [Gitleaks 8.30.1: CLI, redacción y allowlists](https://github.com/gitleaks/gitleaks/blob/v8.30.1/README.md).
- [Publicación y checksums de Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).
- [Checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1).
- [Setup Node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0).
- [Setup PHP 2.40.0](https://github.com/shivammathur/setup-php/releases/tag/2.40.0).
- [Actionlint 1.7.12](https://github.com/rhysd/actionlint/releases/tag/v1.7.12).
