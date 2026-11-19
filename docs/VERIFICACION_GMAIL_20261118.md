# Verificación de correo con la cuenta Gmail existente

Preparación: 18 de noviembre de 2026. La activación requiere configurar y comprobar las credenciales existentes; no se considera operativo solo por publicar este código.

## Motivo y recorrido

Render Free bloquea las conexiones SMTP salientes a 25, 465 y 587. El deploy tenía Gmail SMTP en 587. Para conservar la cuenta Gmail sin contratar un dominio u otro proveedor, el backend entrega la solicitud por HTTPS a una función del proyecto Vercel existente. Esta función envía el código usando smtp.gmail.com:465 con TLS verificado. Vercel documenta el envío SMTP desde sus Functions.

Fuentes: https://render.com/docs/free y https://vercel.com/kb/guide/sending-emails-from-an-application-on-vercel.

El registro, los códigos de seis dígitos, los hashes, la expiración de diez minutos, los límites de intentos y el acceso tras verificar continúan en Laravel. La función recibe únicamente destinatario, código, clase de operación, instante y nonce. No recibe datos del perfil ni permisos de la cuenta del observatorio. Gmail y Outlook/Hotmail siguen siendo destinatarios válidos; el remitente es la cuenta Gmail configurada.

## Configuración del servidor

En Vercel, exclusivamente en el entorno Production del proyecto observatorio-territorial:

- GMAIL_SMTP_USER: usuario SMTP de la cuenta Gmail que la aplicación ya utiliza.
- GMAIL_SMTP_PASSWORD: contraseña de aplicación de Gmail existente, si sigue siendo válida.
- VERIFICATION_RELAY_SECRET: clave aleatoria de 32 bytes codificada como 64 caracteres hexadecimales.

En Render y, si se habilita el ensayo local, en la configuración privada del backend:

- VERIFICATION_DELIVERY=gmail_relay.
- VERIFICATION_RELAY_URL=https://observatorio-territorial-dun.vercel.app/_internal/verification-mail.
- VERIFICATION_RELAY_SECRET: la misma clave del canal autenticado.

Ninguno de estos valores se añade a environment.ts, environment.prod.ts, assets o al bundle Angular. Las credenciales Gmail se usan solo dentro de la función; Laravel necesita la clave del canal y su dirección, no otra copia de la contraseña Gmail. Las configuraciones Preview no reciben credenciales de Production.

La copia de las credenciales actuales desde Render a Vercel amplía los lugares donde se custodian. Debe autorizarla el propietario antes de realizarla. No se imprimen claves ni códigos en logs, resultados de comandos, commits o documentación.

## Controles y límites

- Función exclusiva para una plantilla fija de verificación y una comprobación SMTP sin mensaje. Rechaza remitentes, asuntos, cuerpos HTML, adjuntos u otros campos suministrados por el cliente.
- Solicitudes POST JSON de hasta 4096 bytes, firma HMAC-SHA256, comparación en tiempo constante, nonce aleatorio y ventana de 30 segundos. La firma cubre propósito, operación, tiempo, nonce, destinatario y código.
- La supresión de duplicados es local a una instancia caliente y está acotada. No es un registro distribuido de consumo único. TLS y la ventana firmada siguen aplicándose entre instancias; un request firmado capturado podría repetirse en otra instancia dentro de esa ventana. El secreto solo se entrega a los dos servidores autorizados.
- Conexión SMTP con TLS, sin modo debug, sin acceso a archivos/URL y sin remitentes controlados por la petición. No hay reintentos automáticos de una operación que pudiera haber sido aceptada por Gmail.
- El backend solo llama a la dirección HTTPS configurada por el operador, con ruta exacta, sin credenciales en URL, redirecciones ni desactivación de certificados. Elimina las cadenas de excepciones que pudieran contener el payload del proveedor.
- Un fallo conserva la cuenta pendiente y elimina el código no entregado, permitiendo solicitar otro. La aceptación SMTP no demuestra llegada al buzón o a la bandeja principal.
- Se mantienen las cuotas y decisiones de seguridad de Gmail. Este adaptador atiende el alojamiento actual; para el futuro host se conserva VERIFICATION_DELIVERY=mail con un mailer real configurado.

## Ensayo y activación

1. CI prueba el protocolo firmado, entradas maliciosas, errores, registro/verificación y la conservación del transporte Laravel. Las pruebas locales no envían correo real.
2. La Preview debe devolver JSON/405 a GET en /_internal/verification-mail, demostrando que la función precede al proxy API y al fallback SPA. POST sin configuración no debe enviar mensajes.
3. Tras la autorización del propietario, configurar las variables de Production, publicar la función y comprobar conexión/autenticación con verification:check-delivery. Este comando no envía correo y solo imprime el resultado general.
4. Hacer una entrega autorizada a una cuenta de prueba y comprobar la recepción y el código, además de los fallos de reenvío. Mantener la verificación activa durante todo el proceso.

Sin configurar las variables, la función falla de forma cerrada. El backend conserva por defecto su selección mail; la publicación del adaptador no activa por sí sola el canal Gmail.

## Pausa temporal de la verificación

Publicar la versión que reconoce ambos modos en frontend y backend. Para
activar la pausa, fijar `EMAIL_VERIFICATION_REQUIRED=false` en el entorno del
backend. En local se puede usar `backend/.env`. Reiniciar el backend y regenerar
la caché de configuración si el entorno la usa. En Render, guardar la variable
y desplegar el backend con ese entorno.

Durante la pausa, el registro termina en la página de inicio de sesión. Las
cuentas activas con correo pendiente pueden acceder con su contraseña. El
servidor deja los correos pendientes como tales y bloquea los endpoints de
verificación y reenvío.

Para reactivar la verificación, comprobar primero el transporte de correo con
las credenciales del alojamiento, ajustar `EMAIL_VERIFICATION_REQUIRED=true`
y volver a aplicar la configuración del backend. Las cuentas pendientes
vuelven a requerir el código, incluidas las sesiones abiertas durante la pausa.
