# Portal EPES Entidades · V8.2 (cabecera compacta)

Actualización exclusiva de presentación sobre V8.1.

## Cambios
- «Actualizar» y «Cerrar sesión» aparecen a la derecha de la barra superior «Portal EPES Entidades · Granada» únicamente cuando existe una sesión autorizada.
- Durante el inicio de sesión los botones permanecen ocultos y sigue visible el indicador «Área de entidades colaboradoras».
- Se elimina por completo la franja «GESTIÓN EPES · ENTIDADES COLABORADORAS / Panel de la entidad», incluido el texto de bienvenida redundante.
- La sección de entidad y las tarjetas «Convenios» e «Incidencias» quedan directamente bajo la cabecera.
- En pantallas estrechas los botones siguen dentro de la cabecera, en una segunda línea adaptada al ancho.
- No cambia ninguna consulta a Supabase, las alertas, los expedientes, el buscador o la descarga cifrada.

## Publicación en GitHub Pages
1. Guardar copia de los archivos publicados V8.1.
2. Reemplazar `index.html`, `app.js` y `styles-v8.css` en la raíz por los tres archivos de este ZIP.
3. Mantener sin cambios `styles.css`, `config.js`, `download-on-demand.js`, el logotipo y `assets/epes-download-public.pem`.
4. Abrir la URL habitual y recargar con Ctrl+F5. Comprobar que los botones no se muestran en la página de acceso y aparecen al entrar.
5. Probar «Actualizar», «Cerrar sesión», la lista de convenios y una descarga cifrada del expediente CV0069.

No hay cambios en Ubuntu, servicios, base de datos, RLS ni permisos.
