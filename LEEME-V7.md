# Portal EPES Entidades · V7 — Descargas bajo demanda por defecto

## Novedades
- Los botones de convenios y adendas firmados utilizan directamente el circuito
  cifrado bajo demanda para cualquier entidad que haya iniciado sesión y tenga
  permiso en Supabase (sin `?epes_descarga_prueba=1`).
- Se elimina la ruta de descarga permanente del JavaScript de V6.
- Los archivos `config.js`, `styles.css`, el logotipo, la clave pública
  `assets/epes-download-public.pem` y los datos NO están dentro del ZIP: conservarlos.
- Errores visibles: nunca se hace una descarga automática de respaldo desde
  `epes-documentos` si falla el circuito nuevo.
- El mecanismo RSA-OAEP/AES-256-GCM y la verificación SHA-256 de la V5/V6
  permanecen sin cambios.
- El archivo de `app.js` cambia de etiqueta de caché a `epes-v7-20261015`.

## IMPORTANTE: NO PUBLICAR SIN CONTROL PREVIO
La prueba hasta ahora solo ha validado E0002, convenio CV0069 y sus adendas.
Verificar mediante SQL que las filas de `public.documentos` corresponden a
originales que existen en `/srv/epes/documentos`, especialmente antes de crear
usuarios de otras entidades. Actualmente solo hay constancia de 3 PDF locales.
Verificar que `epes-descargas-cola.timer` y `epes-descargas-limpieza.timer`
están habilitados/activos y que el procesador no registra errores.
La función `epes_solicitar_descarga` debe conceder EXECUTE a `authenticated`
para el uso normal. NO se concede por publicar el ZIP y ahora continúa revocada.
El GRANT es de rol; RPC valida entidad y tiene límites por usuario.

## Secuencia prevista para la puesta en marcha supervisada
1. Auditoría de documentos firmados y originales locales por entidad.
2. Conservar copia de los archivos publicados V6 para posible reversión.
3. Verificar permisos, RLS, estado de los timers y ausencia de pendientes.
4. Conceder ejecución de la RPC en Supabase solo al estar preparados para
   abrir el servicio a las entidades autorizadas.
5. Publicar `index.html` y `app.js` V7; conservar `download-on-demand.js`
   idéntico al actual o subir el incluido.
6. Probar la URL habitual, sin parámetro: E0002, CV0069 y las dos adendas.
7. Probar una segunda entidad solo después de validar sus originales locales,
   asignaciones, políticas de acceso y permisos.
8. Supervisar estado de solicitudes, registros del worker, descarga y limpieza.

## Reversión controlada
- Si aparecen fallos, primero revocar `EXECUTE` de la RPC a `authenticated`
  para bloquear nuevas solicitudes bajo demanda.
- Republicar los archivos `index.html` y `app.js` de V6, conservando los
  PDF del bucket permanente `epes-documentos` sin tocar.
- Los temporizadores pueden seguir limpiando solicitudes ya creadas;
  no es necesario detener sincronizadores EPES o Incentivos.

## No borrar el almacenamiento permanente todavía
El sincronizador EPES v9 mantiene las copias en `epes-documentos`.
No borrar archivos del bucket ni modificar `public.documentos` hasta adaptar
su sincronización; de lo contrario, se pueden volver a subir y/o romper
las referencias históricas.

## Archivos del paquete
- `index.html` V7
- `app.js` V7
- `download-on-demand.js` (sin cambios respecto a V6)
- `LEEME-V7.md`
