# A-08 · Política común de contraseñas

Corte: 18 de noviembre de 2026. Implementación preparada en una rama separada de `pruebas-rediseno`; integración y publicación sujetas a CI del commit final. No modifica el esquema ni cambia contraseñas de cuentas reales.

## Alcance y comportamiento

Registro, alta administrativa, edición con contraseña nueva y restablecimiento por administrador comparten reglas en backend y frontend:

- Mínimo de **15 caracteres Unicode**; se permiten frases, espacios y caracteres internacionales. No se exige una mezcla arbitraria de mayúsculas, números y símbolos.
- Máximo de **72 bytes UTF-8**, por el algoritmo bcrypt existente. Se rechaza el exceso antes de guardar; no se trunca. Algunos caracteres ocupan varios bytes.
- Rechazo local de una lista acotada de contraseñas comunes, de un único carácter repetido y de valores que solo alcanzan el mínimo al añadir espacios exteriores.
- Los espacios exteriores se ignoran únicamente durante la comprobación de previsibilidad. **El valor original se conserva** para hash y autenticación; no se recorta ni normaliza.
- Se rechazan NUL y texto Unicode mal formado. Una contraseña vacía en una edición opcional conserva el hash y las sesiones existentes.

El login no aplica el nuevo mínimo ni la lista de contraseñas comunes: las credenciales anteriores continúan siendo válidas. Su límite de transporte es 4096 bytes y rechaza entradas mal formadas. No se migra el algoritmo de hash ni se fuerza una rotación global.

La recuperación operativa sigue a cargo de un administrador. El cambio administrativo conserva el mecanismo existente que invalida tokens y sesiones de la cuenta. El usuario informó que **el correo todavía no funciona**; este cambio no implementa recuperación por correo, no añade un enlace que prometa ese servicio y no desactiva la verificación del registro. La homologación del envío y el flujo de recuperación queda en A-10.

## Fuente y límites del filtro local

La fuente única es `backend/resources/security/password-policy.json`; su copia TypeScript se comprueba por igualdad en CI. No se consulta un proveedor externo con la contraseña.

El filtro contiene **76 valores**: 70 entradas ASCII de la lista pública de SecLists que cumplen el rango admitido y un suplemento local, sin duplicados. La fuente contiene 99 999 entradas; las de menos de 15 caracteres ya se rechazan por longitud. No es una base completa de contraseñas filtradas ni una medición de entropía, y no garantiza detectar toda contraseña predecible.

- Fuente: [SecLists, lista de credenciales comunes](https://github.com/danielmiessler/SecLists/blob/0247dfd46495df842868b2ab6a2cce0c75709215/Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt).
- Commit: `0247dfd46495df842868b2ab6a2cce0c75709215`.
- SHA-256 del archivo fuente: `1472aafa2561df5e3293aee252aee3ca660c12b399a283cf808bb01b39be388b`.
- Licencia MIT conservada en `backend/resources/security/SECLISTS-LICENSE.txt` y `frontend/src/assets/licenses/seclists-MIT.txt`.

La elección de longitud y filtro local sigue la [guía de autenticación de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). El reporte original proponía reglas de composición; esta implementación adopta longitud, frases y rechazo de valores comunes. El responsable de seguridad/DIIT debe aceptar la política y sus límites, incluido bcrypt, antes de declarar conformidad institucional.

## Evidencia de verificación

- Contrato sintético compartido de 26 casos: longitud Unicode, límites de bytes, espacios, valores comunes, login anterior y entradas mal formadas.
- Pruebas de los cuatro puntos de escritura: un rechazo conserva usuarios, hashes, tokens y sesiones; no envía correo.
- Restablecimiento administrativo: la contraseña anterior deja de funcionar, la frase nueva se conserva exactamente y se invalidan los tokens según el comportamiento existente.
- Formularios: mensajes de error, validación previa al envío, edición opcional y compatibilidad del login.
- CI comprueba igualdad de política y casos entre lenguajes, licencia y traducciones; ejecuta la suite de backend, integración PostgreSQL y verificaciones del frontend.

Las verificaciones usan cuentas sintéticas y bases desechables; no requieren las credenciales ni los datos de producción. Los resultados del commit integrado y los despliegues se registran en el cierre de release. Este documento no acredita por sí solo entrega o aceptación de DIIT.
