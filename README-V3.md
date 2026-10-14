# Portal EPES Entidades · Versión 3

Actualización del portal público con la identidad visual de Gestión EPES Granada. **No cambia el esquema de Supabase, las políticas RLS, los datos ni el sincronizador de Ubuntu.**

## Novedades

- **Fichas-resumen interactivas:** al pulsar Convenios, Adendas, Prácticas, Incidencias o PDF firmados, se abre la sección correspondiente, se marca la ficha seleccionada y se desplaza hasta la tabla.
- **Aviso de incidencias:** si el contador de la entidad seleccionada es mayor que cero, su ficha se destaca en naranja. Se cuentan incidencias registradas (no presupone que sigan pendientes de resolver).
- **Buscador general** de números de convenio, nombres de empresa, CIF, identificadores de práctica y convenios asociados a prácticas. Modos: Todo, Convenios, Empresas, Prácticas.
- **Convenio → prácticas:** botón «Ver prácticas» en cada fila de convenio; lista paginada, con detalle de cada práctica. Desde los resultados de búsqueda también se puede ir directamente a las prácticas del convenio.
- **Logotipo:** preparado para mostrar el PNG original EPES, conservando «EPES» como fallback hasta que se añada.
- Se mantienen el login Supabase Auth, RLS, selección de entidades, paginación, detalle y descarga de PDF mediante bucket privado.

## Archivos que hay que actualizar en GitHub Pages

1. Conserva una copia de tu repositorio actual.
2. Sustituye **index.html**, **styles.css** y **app.js** por los de este paquete. En esta V3 sí se modifica `app.js` porque se añaden funcionalidades.
3. **No sustituyas ni edites `config.js`**. Debe conservar la URL y clave pública de Supabase que ya funcionan.
4. Añade el logo oficial en **assets/logo_epes.png**, conservando exactamente ese nombre y ruta.
5. Publica los cambios y recarga la web con Ctrl+F5.

## Obtener el logotipo original desde tu servidor

En **Windows Terminal / CMD**, fuera de la sesión SSH, puedes descargar el logo mediante:

```cmd
scp valenje@10.188.141.30:/var/www/epes/images/logo_epes.png "%USERPROFILE%\Downloads\logo_epes.png"
```

A continuación, en GitHub sube ese archivo al directorio `assets` del repositorio, con el nombre `logo_epes.png`. El archivo debe ser el original de Gestión EPES; **no se incluye en el ZIP** porque no disponemos de sus bytes. Mientras no se suba, se mostrará la marca textual EPES sin iconos rotos.

## Pruebas recomendadas con la cuenta E0002

1. Inicia sesión y comprueba los contadores de tu entidad.
2. Pulsa cada ficha: debe abrir su apartado y destacar la ficha seleccionada.
3. Con incidencias registradas, la ficha de incidencias debe verse en naranja.
4. Busca `CV0069` en «Todo» o «Convenios»; abre «Ver prácticas del convenio».
5. Busca parte del nombre de una empresa o CIF en «Empresas».
6. En Convenios, pulsa «Ver prácticas»: la lista solo muestra las asociadas a ese convenio y la entidad autorizada.
7. Comprueba descargas de PDF y acceso desde móvil.

## Privacidad

- El buscador ejecuta consultas remotas a Supabase limitadas a `id_entidad` de la sesión. Las políticas RLS siguen aplicándose en el servidor.
- La carga de prácticas de un convenio es bajo demanda y limitada mediante paginación.
- No se usa ninguna clave secreta ni se modifica la lógica de autenticación.
- Los resultados del buscador están limitados para evitar descargas masivas; si hay muchos, concretar la búsqueda.

## Alcance de validación

Comprobados: sintaxis de JavaScript con Node.js, existencia de los identificadores HTML empleados y ausencia de IDs duplicados. Pendiente: prueba funcional real en GitHub Pages con el usuario E0002, que debe realizarse tras publicar, especialmente en el buscador y la ampliación de prácticas.
