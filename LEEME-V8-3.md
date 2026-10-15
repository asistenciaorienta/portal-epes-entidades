# Portal EPES Entidades · V8.3 — espacio, consulta general y desglose

## Cambios incluidos

1. Añade espacio visible entre Entidad autorizada / Convenios / Incidencias y Búsqueda general.
2. Añade dentro de Búsqueda general un enlace a https://asistenciaorienta.github.io/EPES_Granada/ que abre una pestaña nueva sin transferir autenticación al portal externo. No se integra con iframe ni comparte sesión.
3. «Incidencias» muestra siempre el total histórico visible (pendientes + gestionadas). En entidades con hasta 2.500 incidencias calcula el desglose de pendientes confirmadas, resueltas y sin estado confirmado, sin suponer que una incidencia histórica está activa. Un cierre explícito prevalece sobre un posible indicador desactualizado. El color ámbar se muestra únicamente si hay al menos una pendiente confirmada. Para conjuntos mayores, mantiene el total sin afirmar un desglose.
4. Ningún cambio en el módulo de descarga cifrada, políticas, Supabase, servicios de Ubuntu, autenticación o sincronizadores.

## Los avisos de nuevas firmas y cierres de incidencia NO están implementados todavía
Para que «Ya lo he visto» sea fiable entre navegadores y cuentas, es necesaria una tabla de eventos y otra de confirmaciones por usuario, ambas con RLS, más la identificación fiable de las transiciones a incidencia cerrada. Se abordará por separado tras revisar el esquema real de `incidencias` y `documentos`.

## Publicación

1. Guarda copia de V8.2.
2. Sustituye `index.html`, `app.js` y `styles-v8.css` por los de este ZIP.
3. Conserva sin cambios `styles.css`, `config.js`, `download-on-demand.js`, `assets/epes-download-public.pem` y logotipo.
4. Recarga con Ctrl+F5. Comprueba el espacio, el enlace externo, el total y desglose de incidencias y la descarga de un documento firmado.
