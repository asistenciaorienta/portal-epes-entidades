# EPES V8.8 — Preparación de invitaciones y recuperación de contraseñas

Esta versión es una evolución conservadora de la V8.7: mantiene incidencias, expedientes, documentos cifrados bajo demanda y los tres tipos de novedades. Solo añade un formulario de solicitud de recuperación y una página dedicada a establecer contraseñas mediante invitación o enlace de recuperación.

## Archivos que se publican en GitHub Pages

- `index.html` y `app.js` actualizados.
- `styles-v8.css` actualizado.
- `establecer-clave.html` y `establecer-clave.js` nuevos.

**Conservar:** `config.js`, `styles.css`, `download-on-demand.js`, carpeta `assets`, clave pública y cualquier otro archivo existente. Nunca colocar una clave secret/service_role en GitHub.

## Antes de activar altas de entidades

1. En Supabase Dashboard > Authentication > URL Configuration, mantener la URL del Portal EPES en Site URL (según configuración existente), y agregar EXACTAMENTE las URL de retorno admitidas:
   - `https://asistenciaorienta.github.io/portal-epes-entidades/establecer-clave.html?tipo=invitacion`
   - `https://asistenciaorienta.github.io/portal-epes-entidades/establecer-clave.html?tipo=recuperacion`
2. En Authentication > SMTP Settings configurar un proveedor SMTP propio habilitado, con SPF/DKIM/DMARC del dominio emisor. Sin SMTP personalizado Supabase puede rechazar correos a usuarios externos.
3. Solo después, en la aplicación administrativa de Ubuntu, enviar invitaciones a usuarios reales con `redirectTo` a la URL `tipo=invitacion`. Este paquete NO contiene backend administrativo ni concede accesos automáticamente.

## Funcionamiento

- Desde el login se ofrece '¿Has olvidado tu contraseña?'. Introduciendo un correo, Supabase envía un enlace de recuperación si está autorizado y SMTP funciona. El formulario no confirma si la cuenta existe.
- Una invitación enviada por el backend debe usar `redirectTo=https://asistenciaorienta.github.io/portal-epes-entidades/establecer-clave.html?tipo=invitacion`.
- La página nueva verifica la sesión de Supabase y permite establecer una contraseña, mínimo 12 caracteres. No utiliza claves de administrador.
- **Importante**: La invitación debe crear/vincular `perfiles` y `perfil_entidades` antes de que el usuario abra el enlace. De lo contrario, podrá autenticarse pero no tendrá ninguna entidad autorizada.

## Pruebas sin riesgo

- Comprobar que convenios, incidencias y descargas siguen funcionando con E0002.
- Comprobar que al pulsar el enlace de recuperación aparece el formulario. NO enviarlo a terceros hasta que esté configurado SMTP.
- Probar una cuenta propia de test, usando una invitación o recuperación autorizada. Verificar permisos RLS con una entidad distinta antes de altas masivas.

## Seguridad de Ubuntu

Antes de añadir una clave secret de Supabase al backend, verificar que `portal-acceso-test.service` tiene `SESSION_SECRET` configurado de forma robusta (server.js tiene fallback), que solo usuarios ADMIN alcanzan las rutas administrativas, y que las claves se guardan fuera de `/var/www/portal-acceso-test/public` con permisos 0600/0640 adecuados. Evitar entregar valores de variables en chat.
