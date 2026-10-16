# Portal EPES Entidades V8.7 · Aviso de nueva práctica

Partimos de V8.6 (Novedades) ya verificada en Supabase. Se conservan los avisos por documentos firmados y cierres de incidencias, y se añade un tercer evento: **nueva práctica publicada**.

## Instalar, en este orden

1. **Supabase → SQL Editor:** ejecutar una única vez `01-anadir-aviso-practica.sql` completo. Si encuentra una estructura diferente, aborta y revierte la transacción.
2. Ejecutar `02-verificar-aviso-practica.sql`. Resultado esperado: 0 avisos de prácticas existentes (si aún no se han publicado nuevas), `disparador_practicas=true`, `sin_duplicados=true`, permiso de lectura autenticada `true`, inserción directa de avisos por usuarios `false`.
3. Hacer una copia de seguridad de V8.6 en GitHub. Sustituir `index.html`, `app.js` y `styles-v8.css` por los tres de este paquete. Conservar `config.js`, `styles.css`, `download-on-demand.js`, logotipo y `assets/epes-download-public.pem`.
4. Recargar el portal con Ctrl+F5. El panel de novedades continúa oculto si no existen avisos sin leer.

## Qué genera el aviso

Cuando el sincronizador habitual V10 incorpora por primera vez una fila de práctica en `public.practicas` (`INSERT`), un trigger crea una novedad `practica_nueva` en `public.epes_novedades`. Los `UPDATE` habituales y las 647 prácticas previamente publicadas no generan avisos retroactivos. Una restricción única por entidad y práctica impide duplicados si se republica el mismo código.

En el portal aparece «Nueva práctica incorporada · Práctica Pxxxx · Convenio CVxxxx», un botón para abrir el convenio y localizar la práctica y la casilla «Ya lo he visto · No volver a mostrar». La confirmación se guarda por usuario en Supabase y funciona desde cualquier equipo. No se incluyen nombres de participantes en las notificaciones.

## Comportamiento importante

- La notificación se crea **cuando Supabase recibe una práctica nueva**, no al guardar un archivo o editar una práctica existente únicamente en PostgreSQL. El temporizador de sincronización EPES ya está activo; no hace falta otro servicio.
- El aviso confirma que la práctica se ha publicado, **no garantiza que todos sus datos sean correctos**. La entidad puede abrir el expediente, revisarlo y después marcarlo como visto.
- No se modifican el código del sincronizador V10, los PDF, las reglas RLS ni la base de datos local.
- No se alteran las novedades históricas ni las confirmaciones anteriores.
- Si la práctica se elimina posteriormente, una notificación previamente creada puede seguir existiendo, pero el enlace podría no encontrarla.

## Comprobación funcional sin alterar datos reales

En la siguiente práctica nueva que se publique normalmente desde EPES, esperar la sincronización programada, entrar al portal con su usuario autorizado o pulsar Actualizar, comprobar el aviso, abrir su expediente y marcarlo visto. Cerrar sesión/entrar de nuevo para comprobar que no reaparece. **No crear prácticas ficticias en producción para esta prueba.**
