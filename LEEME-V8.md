# Portal EPES Entidades · V8 — Expedientes y búsqueda por participante

**Fecha:** 15/10/2026. Actualización visual/funcional sobre Portal V7.

## Qué cambia

- Resumen con **solo dos tarjetas**: Convenios e Incidencias, cada una ocupando la mitad del ancho disponible en escritorio (y todo el ancho en móvil).
- Se eliminan las tarjetas/pestañas independientes de **Adendas** y **Prácticas**: ambas se consultan **dentro del convenio**.
- Convenios: lista sin barra horizontal, elimina columna Acreditación. Columnas: Convenio, Empresa, CIF empresa, Firma delegado/a, Fecha extinción, Convocatoria, Avisos y Expediente.
- Convenios: alerta **roja** por errores activos en convenio/adendas/prácticas o incidencia activa; alerta **ámbar** por falta explícita de firma en convenio/adenda. Los avisos históricos no generan una fila roja.
- El detalle desplegable contiene PDF firmado del convenio, adendas con PDF propio y prácticas del convenio.
- Prácticas: columnas **Práctica**, **Inicio**, **Fin**, **Participante**, **Avisos**, **Detalle**. Las prácticas con errores activos se destacan en rojo.
- Búsqueda global incluye **practicas.persona_usuaria** para encontrar participantes por su nombre/apellidos. El botón "Abrir convenio y práctica" muestra el expediente correspondiente, salta a la página de esa práctica y resalta la fila.
- Compatibilidad responsive: a resoluciones estrechas las tablas se convierten en registros en formato etiqueta/valor, sin scroll horizontal.
- La V8 conserva *idéntica* la implementación de `download-on-demand.js` de V7: autenticación, RPC, cifrado y descifrado, Storage privado y validaciones no se modifican.

## Publicación segura en GitHub Pages

1. **Haz copia** de `index.html`, `app.js` y `styles.css` actuales (V7).
2. Sube a la raíz del repositorio los archivos de este ZIP: **`index.html`** y **`app.js`** (sustituyendo V7) y **`styles-v8.css`** (nuevo).
3. **No modifiques** `config.js`, `styles.css`, `download-on-demand.js`, la clave pública `assets/epes-download-public.pem`, logotipos ni `.nojekyll`.
4. Abre el portal con su dirección normal y realiza recarga completa (`Ctrl+F5`) si el navegador hubiera guardado archivos antiguos.
5. Con el usuario **E0002**, prueba el listado de convenios, resalta incidencias activas, expande `CV0069`, descarga convenio y dos adendas, consulta una práctica y busca por participante.
6. Para revertir la interfaz: recupera `index.html` y `app.js` V7. La nueva hoja `styles-v8.css` puede permanecer sin uso (la V7 no la referencia).

## Datos y alcance

- Los avisos de firma pendientes se señalan **solo cuando el dato de firma confirma explícitamente que falta** (`false`, `no`, `0`, `pendiente`, `sin firmar`). `null`/desconocido no se interpreta como firma pendiente.
- Los avisos activos se basan en `errores_activos` y, cuando esté disponible, en la situación de las incidencias. La ausencia de información no se presenta como error activo.
- La alerta de convenio incorpora errores de prácticas relacionadas y firmas pendientes de sus adendas; las prácticas se consultan mediante filtros de entidad y convenio y RLS existentes.
- Se ha comprobado la interfaz **localmente** con datos simulados, incluyendo búsqueda de participante, avisos y ausencia de desbordamiento horizontal a 1366 y 390 px. **No** se ha comprobado aún en el sitio GitHub Pages en producción.
- No se cambia el backend de Ubuntu, V10 del sincronizador, Supabase, la función de solicitudes ni los temporizadores.
