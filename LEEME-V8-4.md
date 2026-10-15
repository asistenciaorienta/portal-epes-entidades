# Portal EPES Entidades · V8.4 — incidencias pendientes

## Cambios

- La tarjeta principal pasa a **Incidencias pendientes** y muestra exclusivamente `public.incidencias.resuelta = false` de la entidad autorizada. Para E0002, la última consulta aportada por el usuario registra 2 pendientes y 38 resueltas.
- El listado al pulsar la tarjeta solo muestra las pendientes, con una marca ámbar; la paginación y el contador del listado aplican el mismo filtro.
- Las incidencias resueltas **no se borran ni se ocultan en los expedientes**. Las consultas de incidencias dentro del convenio o del detalle de la práctica se mantienen sin filtro de `resuelta`; muestran su estado correspondiente.
- En la bandeja de pendientes se añade `Abrir expediente` cuando la incidencia tiene identificador de convenio (salta a la práctica si se identifica).
- Si no hay incidencias pendientes, el listado indica que las resueltas se consultan dentro de convenios y prácticas.
- Sin cambios de autenticación, Supabase RLS, sincronizador, servidor, descarga cifrada, buscador o contenido de convenios y prácticas.

## Publicación GitHub Pages

1. Guarda copia de V8.3.
2. Sustituye `index.html` y `app.js` por los del ZIP. Sustituye también `styles-v8.css` por el incluido, que incorpora la marca visual ámbar de pendientes.
3. Conserva `styles.css`, `config.js`, `download-on-demand.js`, `assets/epes-download-public.pem` y el logotipo.
4. Recarga con Ctrl+F5. Comprueba que la tarjeta de E0002 muestra 2 incidencias pendientes y, al entrar, solo esas 2. Abre CV0069 y una práctica para verificar que las históricas siguen siendo consultables.

## Avisos de novedades

Los avisos persistentes de documentos firmados e incidencias cerradas, con confirmación de lectura por usuario, requieren diseño y almacenamiento en Supabase. No están incluidos aquí.
