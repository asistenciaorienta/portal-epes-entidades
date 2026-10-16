# EPES 8.7.1 · Identificación de empresa y participante en los avisos

Versión específica basada en la **V8.7 ya publicada** (no incorpora los cambios aún opcionales de V8.8 sobre recuperación por correo). Es una actualización limitada al contenido visual de los avisos.

## Novedades

En cada aviso de práctica, convenio/adenda firmada o incidencia resuelta, se obtiene y muestra:
- **Empresa:** `public.convenios.nombre_empresa` del convenio relacionado.
- **Participante:** `public.practicas.persona_usuaria` si el aviso corresponde a una práctica y está cumplimentado.

Cuando el aviso de incidencia no tiene convenio pero sí práctica, primero se busca el convenio de esa práctica. Solo se consultan registros de la entidad autorizada mediante RLS. Si no se puede identificar una empresa, el aviso indicará «No disponible en el convenio», sin inventar nombres.

Los datos se obtienen al cargar la página, también para avisos no leídos ya existentes. No genera eventos adicionales ni revive avisos marcados como vistos.

## Publicación GitHub Pages

1. Guardar copia de los archivos actuales.
2. Subir y sobrescribir **solo** `index.html`, `app.js`, `styles-v8.css`.
3. Conservar `config.js`, `styles.css`, `download-on-demand.js`, claves, logos y cualquier archivo de la aplicación que no esté en este ZIP.
4. Recargar (Ctrl+F5), entrar con E0002 y comprobar el aviso de la práctica del CV0069 (si todavía no se ha marcado como visto).

**No ejecutar SQL ni tocar Ubuntu.** El módulo interno `Gestión de accesos EPES V1` sigue independiente.

## Importante respecto a V8.8

Esta actualización parte de V8.7, porque es la última versión pública cuya instalación se ha confirmado. Si ya se ha publicado V8.8, **no usar este paquete**: solicitar la variante acumulada V8.9, que conserva la recuperación de contraseña y añade estos nombres a los avisos.
