# Portal EPES Entidades V8.9 · Empresa y participante en avisos

Actualización de interfaz del portal público, basada en V8.8 (incluye V8.7). Mantiene las notificaciones de nuevas prácticas, documentos firmados e incidencias resueltas y la confirmación «Ya lo he visto».

## Qué cambia

- Cada novedad muestra `Empresa: <nombre_empresa>`, obtenida del convenio asociado.
- Si el aviso se refiere a una práctica y tiene `persona_usuaria`, muestra `Participante: <nombre>`.
- Si una incidencia solo trae `id_practica`, se localiza primero el `id_convenio` de esa práctica.
- Los datos de contexto se consultan en lotes mediante el usuario autenticado y `id_entidad`, con las políticas RLS ya existentes.
- Si falla o falta la vinculación, se muestra `Empresa: No disponible en el convenio` en vez de atribuir datos incorrectos.
- No se copian nombres a `epes_novedades`, no hay migraciones SQL y **no se modifica** la sincronización en Ubuntu.
- Los avisos no leídos existentes también se enriquecen al cargar la pantalla.

## Publicar en GitHub Pages

1. Guardar copia de la versión actual.
2. Sustituir en el repositorio `index.html`, `app.js`, `styles-v8.css` por los del ZIP.
3. Si aún no se publicó V8.8, añadir `establecer-clave.html` y `establecer-clave.js`; son las pantallas opcionales de invitación/recuperación de V8.8. El envío de correos requiere configuración adicional de Supabase y no se activa por esta actualización.
4. **No tocar** `config.js`, `download-on-demand.js`, `styles.css`, `assets/` ni las claves públicas.
5. Recargar con Ctrl+F5, iniciar sesión y examinar «Novedades de tu entidad». Las novedades ya marcadas como vistas no reaparecen.

## Comprobar

Abrir el aviso de la práctica de prueba del CV0069 aún pendiente de confirmar. Debe mostrar el nombre de la empresa de ese convenio y la persona de la práctica si `persona_usuaria` está cumplimentado. Pulsar `Abrir expediente` y comprobar que sigue llevando a la práctica. No hace falta crear otra práctica.

## Separación de gestión de accesos

La administración V1 instalada en `/var/www/portal-acceso-test` no se modifica con este ZIP. Mantenerla sin escritura hasta conectar su configuración privada. Las claves temporales administradas (modelo Incentivos/Itinerancias) se abordarán por separado.
