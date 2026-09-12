# MascotaSegura

Primera versión de una web para registrar mascotas y crear una ficha pública accesible desde un QR en su collar.

## Incluye

- Cuenta del dueño con correo y contraseña, inicio y cierre de sesión.
- Registro y edición de perros, gatos, conejos, aves y otras mascotas.
- Nombre, raza, sexo, color, dueño, celular, dirección, distrito y notas.
- Foto opcional (JPG, PNG o WebP, hasta 5 MB), convertida a WebP y sin metadatos.
- Ficha pública móvil en `/m/<uuid>`, con llamada y WhatsApp.
- QR descargable en PNG, comprobado con un decodificador real.
- Suscripción mensual de $3.99 USD mediante Stripe Checkout.
- Panel de superadministración para consultar usuarios, activar o inactivar cuentas y eliminarlas definitivamente.
- Recuperación de contraseña por correo con enlace de un solo uso que vence en 30 minutos.
- PostgreSQL real: los registros y las fotos sobreviven a reinicios y cambios de sesión.

La dirección exacta y el correo de la cuenta no aparecen en la ficha pública. Quien tenga el enlace puede ver el nombre del dueño, teléfono, distrito, foto y datos de la mascota. Solo su dueño puede modificarla.

## Tecnologías

Next.js 16, React 19, TypeScript, Tailwind CSS 4 y PostgreSQL 18. API con Route Handlers, consultas parametrizadas con pg, validación con Zod, contraseñas con scrypt y sesiones opacas cuyo hash se almacena en la base.

## Ejecutar en desarrollo

Requiere Node.js 22.18 o superior y npm.

```sh
npm ci
npm run db:local
```

Deja la terminal de PostgreSQL abierta. En otra terminal:

```sh
npm run dev
```

Abre http://localhost:3100 y crea tu cuenta. No hay cuentas ni mascotas de demostración cargadas.

El primer arranque genera una contraseña aleatoria local y `.env.local`, crea la base y aplica las migraciones. Los datos están en `.local-db/`. Ambos están excluidos de Git. Mantener y respaldar esa carpeta si se quieren conservar los datos locales. Detener PostgreSQL con Ctrl+C antes de mover la carpeta.

Si ya existe `.env.local`, el script no lo sobrescribe. Para una base externa, configura `DATABASE_URL` en ese archivo y ejecuta `npm run db:migrate`; no necesitas `db:local`.

## Variables

Ver `.env.example`.

- `DATABASE_URL`: conexión PostgreSQL del servidor. Nunca usar prefijo NEXT_PUBLIC.
- `APP_URL`: origen canónico de la aplicación, sin rutas. Se usa para el QR y la validación de origen.
- `COOKIE_SECURE`: true en cualquier despliegue HTTPS; false únicamente para desarrollo HTTP.
- `SUPER_ADMIN_EMAIL`: correo exacto de la única cuenta autorizada para administrar usuarios. El rol se valida en el servidor y no se puede asignar desde la interfaz.
- `RESEND_API_KEY`: clave privada de Resend para enviar correos de recuperación. Nunca usar prefijo `NEXT_PUBLIC`.
- `RESET_EMAIL_FROM`: remitente de recuperación perteneciente a un dominio verificado, por ejemplo `MascotaSegura <cuentas@correo.tudominio.com>`.
- `SMTP_USER`: cuenta Gmail remitente cuando no se usa Resend.
- `SMTP_APP_PASSWORD`: contraseña de aplicación de 16 caracteres de Gmail; nunca es la contraseña normal de Google.
- `STRIPE_SECRET_KEY`: clave secreta de Stripe. Usa `sk_test_...` en local y DEV, y `sk_live_...` en producción.
- `STRIPE_WEBHOOK_SECRET`: secreto de firma del webhook correspondiente a cada entorno.

Las cuentas nuevas quedan siempre pendientes y sin acceso a las funciones de mascotas hasta completar Stripe Checkout. Si Stripe no está configurado, el registro permanece bloqueado en la pantalla de suscripción en lugar de conceder acceso gratuito. El webhook público es `/api/billing/webhook` y debe recibir los eventos `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`. Las cuentas existentes conservan su estado actual.

El panel administrativo aparece automáticamente al iniciar sesión con `SUPER_ADMIN_EMAIL`. El estado administrativo de una cuenta es independiente de su suscripción. La eliminación borra definitivamente la cuenta, sus sesiones, mascotas y fotografías; si existe una suscripción de Stripe, primero se cancela para evitar cargos posteriores. La cuenta administradora no puede desactivarse ni eliminarse desde el panel.

La recuperación usa Resend (`RESEND_API_KEY` y `RESET_EMAIL_FROM`) o Gmail (`SMTP_USER` y `SMTP_APP_PASSWORD`). Los enlaces se guardan únicamente como hashes, vencen en 30 minutos, funcionan una sola vez y cierran todas las sesiones anteriores. La respuesta al solicitar el correo es genérica para no revelar qué cuentas existen.

En local el QR apunta a localhost y no funciona desde otros celulares. Después de publicar, establece APP_URL con el dominio HTTPS y vuelve a descargar el QR antes de imprimirlo. Editar la mascota conserva su URL y su QR. Cambiar el dominio requiere mantener el dominio anterior o reimprimir los códigos.

## Comprobaciones

```sh
npm run typecheck
npm test
npm run build
npm run test:integration
```

La integración requiere la app y PostgreSQL locales en ejecución. Crea dos cuentas temporales, comprueba permisos, privacidad, persistencia, fotos, validaciones y decodificación del QR. Limpia solo los datos que ella misma creó. Rechaza bases o aplicaciones remotas.

GitHub Actions ejecuta las mismas verificaciones con PostgreSQL en cada push o PR hacia dev. El workflow valida el código; aún no despliega a un hosting.

## DEV y despliegue

Rama de trabajo: `dev`. No se necesita GitHub Pages: esta aplicación necesita un servidor Node.js y una base PostgreSQL.

El repositorio incluye un Dockerfile con salida standalone de Next.js y compose.yaml para ejecutar web y base juntas. El contenedor ejecuta las migraciones antes de servir la aplicación. Las migraciones se registran con checksum y un bloqueo de transacción; una migración ya aplicada no se debe modificar.

Para probar Docker localmente, configura una contraseña en POSTGRES_PASSWORD, APP_URL=http://localhost:3000 y COOKIE_SECURE=false; ejecuta `docker compose up --build`. Las variables pueden ir en un archivo `.env` ignorado por Git. Usa una contraseña alfanumérica aleatoria para evitar caracteres que requieran codificación en la URL.

Para publicar DEV falta conectar un proveedor de hosting y una base PostgreSQL remota, configurar sus variables, ejecutar las migraciones y conectar el despliegue a dev. No hay proveedor ni credenciales de despliegue configurados en esta versión.

## Alcance de esta primera versión

No incluye verificación inicial de correo, notificaciones de escaneos, geolocalización ni administración de placas físicas. El control de intentos de acceso es por cuenta; para una apertura masiva conviene añadir protección por IP en el proxy. La base local es solo para desarrollo; los respaldos y la disponibilidad del entorno publicado deben configurarse en su proveedor.

La interfaz contiene una integración opcional y detectada por capacidad con WebMCP para abrir el formulario de mascota; no se validó en un navegador compatible. Su ausencia no afecta al uso normal.

## Fotografía

Foto de Krista Mangulsone en [Unsplash](https://unsplash.com/photos/9gz3wfHr65U), bajo [licencia Unsplash](https://unsplash.com/license).
