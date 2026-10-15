# Portal EPES Entidades · V8.5 — listado de incidencias pendientes

## Qué cambia

- Bandeja **Incidencias pendientes**: exactamente seis columnas: **Incidencia, Empresa, Convenio, Práctica, Detalle error, Expediente**.
- Se eliminan del listado los campos técnicos como origen y tipo de origen.
- **Empresa** se obtiene del convenio autorizado (`public.convenios.nombre_empresa`). Si una incidencia solo identifica la práctica, se busca su convenio por `public.practicas`.
- El detalle del error (`descripcion`, o alternativas si existen) se muestra **íntegro**, sin truncamiento, conservando saltos de línea.
- El identificador de incidencia abre el detalle completo; «Abrir expediente» lleva al convenio y, si se conoce, a la práctica afectada. Si no existe vínculo autorizado, se indica «Sin expediente vinculado» en lugar de crear un enlace incorrecto.
- Solo se muestran incidencias con `resuelta=false`; las resueltas permanecen en el historial de convenios y prácticas. Contador, paginación y permisos siguen igual.
- Tabla adaptable sin scroll horizontal: en móvil cada incidencia pasa a tarjeta de etiquetas y valores.
- En el detalle de una incidencia pendiente se muestra el estado «Pendiente de resolver» en lugar de «Sin avisos activos».

## Publicación en GitHub Pages

1. Guarda una copia de los tres archivos de V8.4.
2. Sustituye **index.html**, **app.js** y **styles-v8.css** con los del ZIP.
3. Mantén sin cambios `styles.css`, `config.js`, `download-on-demand.js`, logo y `assets/epes-download-public.pem`.
4. Fuerza recarga con Ctrl+F5. Entra en «Incidencias pendientes» y comprueba la empresa, el error y el botón «Abrir expediente».

No hay cambios en Supabase, Ubuntu ni en la descarga privada. Las novedades con confirmación «Ya lo he visto» por usuario aún requieren una fase separada de datos/autorizaciones.
