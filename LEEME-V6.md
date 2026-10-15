# Portal EPES Entidades — V6 · Prueba controlada de botones de descarga

## Alcance
- Conserva V5 y su descargador cifrado `download-on-demand.js` (sin cambios).
- Añade un interruptor **solo de interfaz**, activo **únicamente** si la dirección del portal lleva `?epes_descarga_prueba=1` **y** la entidad seleccionada es E0002.
- La dirección habitual del portal, sin el parámetro, conserva las descargas previas desde el bucket privado `epes-documentos`.
- El nuevo sistema no incluye fallbacks automáticos al documento permanente: un fallo produce aviso visible, para no ocultar incidencias.
- `index.html` actualiza el sufijo del `app.js` para evitar cargar código V5 desde caché.
- La seguridad real está en Supabase Auth, pertenencia a entidad, RPC y políticas Storage RLS; el indicador en JavaScript no concede ningún permiso.

## Instalación (GitHub Pages)
1. Guardar copia local de los archivos `index.html`, `app.js` y `download-on-demand.js` publicados.
2. Confirmar que la producción es V5, con estilos, `config.js`, logotipo y `assets/epes-download-public.pem` funcionando.
3. Sustituir en la raíz del repositorio `index.html`, `app.js` y, si faltase, `download-on-demand.js` por los de este paquete.
4. **No** reemplazar `config.js`, `styles.css`, `assets/`, ni subir claves privadas, PDF o secretos.
5. Probar primero la URL normal sin parámetros: deben funcionar los documentos como antes.
6. Con el único perfil de pruebas E0002: comprobación SQL de que la cola esté vacía y `perfiles`/`perfil_entidades` corresponden exclusivamente a ese usuario. Conceder temporalmente EXECUTE sobre RPC `epes_solicitar_descarga` a `authenticated`.
7. En el Portal EPES, añadir `?epes_descarga_prueba=1` a la dirección que se abre (si ya hay query string, usar `&epes_descarga_prueba=1`), iniciar sesión como E0002, abrir convenio CV0069 y hacer clic en su PDF firmado. Ubuntu lo atenderá con timer cada 30 s. El archivo se cifra, el navegador lo descifra/verifica y descarga.
8. Con independencia del resultado, revocar el GRANT temporal. Revisar `epes_solicitudes_descarga` y `journalctl -u epes-descargas-cola.service -n 30 --no-pager`.
9. Esperar al vencimiento y revisar eliminación automática mediante `epes-descargas-limpieza.service` (cada 5 min).

**NOTA**: No borrar la documentación antigua de `epes-documentos`: la sincronización v9 sigue vigente y la ruta normal V6 aún depende de ella.
