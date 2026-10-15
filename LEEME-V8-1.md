# Portal EPES Entidades · V8.1 — Corrección y rediseño del expediente

**Fecha:** 15/10/2026. Actualización de interfaz sobre V8.

## Cambios

- **Elimina el error HTTP 400** de `practicas?select=id_convenio,id_practica,errores_activos...`: la V8 asumía incorrectamente la existencia de `errores_activos`. V8.1 consulta `select('*')` y solo inspecciona el indicador si el registro realmente lo tiene; el resto de alertas se derivan de incidencias activas confirmadas.
- Entidad y **tarjetas Convenios e Incidencias alineadas en la misma franja**, usando todo el ancho de la cabecera. Para una sola entidad no se muestra el selector; cuando existan varias entidades autorizadas el selector reaparece para no bloquear la navegación.
- **Incidencias** se resalta en ámbar si existen incidencias registradas (aunque sean históricas); rojo sigue reservado a errores activos de registros.
- Se elimina la navegación duplicada por pestañas: las dos tarjetas son los accesos principales.
- Expediente desplegado con cabecera propia y **tarjetas separadas** para el convenio, adendas y prácticas. Cada adenda tiene cabecera, fecha, motivo y zona propia de descarga. Nombres de fichero y botones se presentan de forma legible.
- No se muestran las etiquetas **«Sin avisos confirmados»** en las adendas si no hay alertas. Las firmas pendientes siguen destacándose si los datos señalan inequívocamente falta de firma.
- Se mantienen la búsqueda de participantes, tabla de seis columnas, marcas de errores activos y presentación adaptable sin scroll horizontal.
- **Sin cambios** en `download-on-demand.js` (cifrado y descarga), `config.js`, `styles.css`, Supabase, Ubuntu, temporizadores o sincronizador V10.

## Publicar en GitHub Pages

1. Haz copia de los actuales `index.html`, `app.js`, `styles-v8.css` de V8.
2. Sustituye los tres archivos por los del ZIP en la raíz del repositorio. En V8.1 **`styles-v8.css` conserva el nombre**, pero incluye el diseño nuevo.
3. NO sustituyas `styles.css`, `config.js`, `download-on-demand.js`, logo ni `assets/epes-download-public.pem`.
4. Recarga con `Ctrl+F5` en el Portal EPES. Las URL de assets llevan versión V8.1 para evitar que la caché conserve la interfaz vieja.
5. Con E0002: revisa el listado de convenios, el resumen con incidencias, despliega CV0069, descarga su convenio/adendas y localiza una práctica por participante.

## Reversión

Restaura `index.html`, `app.js` y `styles-v8.css` del respaldo de V8.

## Precisión de datos

La columna `errores_activos` NO está garantizada en la tabla `practicas`: su ausencia no es un error pendiente. La V8.1 no inventa fallos. Una incidencia histórica tampoco equivale a una incidencia activa. El color ámbar del botón-resumen «Incidencias» significa que existen registros y se pueden consultar, no necesariamente que estén pendientes.
