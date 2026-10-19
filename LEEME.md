# Portal EPES V9.0 · Cambio obligatorio de clave temporal

Deriva de la V8.9 acumulada y conserva la visualización de avisos con empresa y participante, convenios, prácticas, PDF cifrados, y consulta de incidencias pendientes. Añade pantalla de cambio obligatorio de contraseña cuando `perfiles.debe_cambiar_clave` sea `true`. La consulta de expedientes permanece bloqueada en la **base de datos** hasta que Supabase Auth cambie la contraseña del usuario.

**No publicar V9.0 antes de ejecutar y verificar `01-clave-temporal-rls-v1-3.sql`**: de lo contrario `select('...,debe_cambiar_clave')` dará un error porque la columna todavía no existe.

Para GitHub Pages sustituir `index.html`, `app.js`, `styles-v8.css`; añadir `establecer-clave.html` y `establecer-clave.js` si no existen. Conservar `styles.css`, `config.js`, `download-on-demand.js`, imágenes y clave pública. No subir secretos ni claves admin.

Prueba funcional después de habilitar escrituras: cuenta de ensayo recién creada, login con clave temporal, pantalla de cambio, nuevo secreto de al menos 12 caracteres, acceso a expedientes SOLO tras el cambio. Nunca hacer pruebas alterando cuentas de entidades reales.

**Situacion**: una vez verificados los bloqueos de Supabase, publicar estos cinco archivos en la raiz del repositorio. No ejecutar de nuevo la migracion.
