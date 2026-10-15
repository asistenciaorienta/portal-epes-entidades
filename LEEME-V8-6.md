# Portal EPES Entidades V8.6 · Novedades con confirmación

Partimos de V8.5. No se modifican los PDF, el módulo de descarga cifrada, el sincronizador V10, ni los temporizadores.

## Instalación (respetar orden)

1. Guardar una copia de los archivos de la V8.5 de GitHub Pages.
2. En Supabase SQL Editor, pegar y ejecutar **01-crear-novedades-supabase.sql** (una sola vez, como administrador).
   - La migración es atómica (`BEGIN` / `COMMIT`) y rechaza ejecutar sobre objetos ya existentes.
   - Crea dos tablas con RLS: `epes_novedades` y `epes_novedades_vistas`.
   - Crea dos triggers que notifican *solo cambios posteriores* a la migración:
     a) nueva ficha de convenio/adenda firmado en `public.documentos`, publicada por el sincronizador V10,
     b) una incidencia que cambia de `resuelta=false` a `resuelta=true` en `public.incidencias`.
   - Los 3 documentos y las 38 incidencias antiguas NO generan avisos iniciales.
   - No cambia el contenido ni las políticas RLS existentes.
3. Ejecutar **02-verificar-novedades.sql**. Deben aparecer inicialmente 0 y 0,
   ambos RLS en true, RPC para authenticated=true, anon=false,
   usuarios_crean_eventos=false, usuarios_marcan_vistos=true, y dos triggers.
4. Después de verificar Supabase, reemplazar en GitHub Pages **index.html**, **app.js** y **styles-v8.css**.
   Conservar config.js, styles.css, download-on-demand.js, assets/epes-download-public.pem y logotipo.
5. Abrir el portal y usar Ctrl+F5. El bloque "Novedades de tu entidad" aparece solo cuando hay novedades sin ver.

## Funcionamiento

- La entidad ve avisos solo cuando inicia sesión o pulsa **Actualizar** (también al cambiar de entidad).
- "Abrir expediente" abre el convenio/práctica relacionados sin marcar automáticamente el aviso.
- "Ya lo he visto · No volver a mostrar" guarda una confirmación por `user_id` y `id_novedad` en Supabase.
- Cada cuenta puede marcar sus novedades de forma independiente; se respetan desde cualquier equipo.
- Las incidencias ya resueltas siguen disponibles en el detalle de la práctica/convenio.
- Solo nuevos documentos: actualizar un PDF ya publicado con la misma clave no genera una segunda novedad; V10 actualmente rechaza modificaciones discordantes.
- Si no hay RLS/permisos, se muestra un mensaje de error en el panel de novedades sin interrumpir la consulta de convenios.
- Las confirmaciones no alteran ni documentos ni incidencias.

## Pruebas sugeridas sin afectar a datos reales

- Tras instalar, acceso E0002 debe mostrar la vista normal sin novedades retroactivas.
- Registrar en el futuro un documento firmado nuevo de prueba validado por V10: debe aparecer aviso tras sincronizar.
- Cambiar una incidencia de prueba que esté en estado pendiente a resuelta mediante la gestión EPES habitual y dejar sincronizar: se genera aviso.
- Marcar "Ya lo he visto" y comprobar que no reaparece tras cerrar sesión o desde otro equipo.
- Evitar editar directamente las 2 incidencias reales de E0002 para fabricar un aviso de prueba.

## Reversión

Para volver visualmente a V8.5, restaurar sus tres archivos de GitHub. Dejar las tablas y triggers sin uso no cambia las pantallas anteriores, pero la sincronización podría seguir generando avisos. No borrar tablas ni triggers sin un plan explícito de reversión; los acuses de recibo son datos de auditoría de lectura.
