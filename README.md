# Portal EPES Entidades · Granada — V1

Sitio web estático para **GitHub Pages** que permite a las entidades autorizadas consultar los registros de Supabase mediante **Supabase Auth + RLS**. Se ha creado como primera versión funcional **sin publicar** y **sin introducir claves**.

## Funcionalidades

- Inicio de sesión por correo y contraseña (`signInWithPassword`).
- Comprueba `perfiles.activo` y las asignaciones de `perfil_entidades`.
- Entidad seleccionable si el usuario tiene varias autorizadas.
- Recuentos y consultas paginadas para `convenios`, `adendas`, `practicas`, `incidencias` y `documentos`.
- Consulta de los campos completos de cada registro mediante «Ver detalle».
- Descarga autenticada de PDF desde el bucket privado `epes-documentos`, comprobando que la ruta comience por `id_entidad/`.
- Interfaz adaptable a móviles y ordenadores.
- Exclusivamente lectura de datos. No se incluyen formularios de modificación o comunicación de incidencias todavía.

## 1. Configuración

Editar `config.js`:

```js
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "TU_CLAVE_PUBLICABLE_O_ANON";
```

**IMPORTANTE:** `config.js` se publica en Internet junto con el portal. Utilizar exclusivamente una clave **publishable** (`sb_publishable_...`) o la clave **anon** (`eyJ...`) del proyecto. Nunca insertar claves `service_role`, `sb_secret_...`, credenciales SQL, contraseñas ni tokens de usuario. La autorización real la aplica Supabase en servidor mediante RLS.

La URL y las claves públicas figuran en la configuración del proyecto Supabase, apartado API Keys. No es necesario configurar un backend Node.js adicional para esta versión.

## 2. Prueba local

Servir la carpeta por HTTP local, por ejemplo en Windows con Python si está instalado:

```sh
python -m http.server 8080
```

Abrir `http://localhost:8080`. No abrir el HTML mediante `file://`, porque utiliza módulos JavaScript.

Iniciar sesión con el usuario de pruebas de E0002. Los contadores esperados según la simulación RLS realizada son aproximadamente: 113 convenios, 9 adendas, 114 prácticas, 38 incidencias y 3 documentos. Los datos pueden cambiar conforme se sincronice EPES.

## 3. Publicación en GitHub Pages

1. Crear un repositorio dedicado, por ejemplo `portal-epes-entidades`, **sin subir claves secretas**.
2. Subir los archivos `index.html`, `styles.css`, `app.js`, `config.js` y `.nojekyll` a la raíz del repositorio (no hace falta subir este README).
3. En GitHub → Settings → Pages, seleccionar «Deploy from a branch», rama `main`, carpeta `/(root)`.
4. Abrir la URL pública de GitHub Pages, que normalmente tendrá formato `https://USUARIO.github.io/portal-epes-entidades/`.
5. Probar inicio de sesión y autorización efectiva desde el navegador.

La interfaz es pública, **los datos no deben serlo**. No se deben publicar documentos PDF en el repositorio GitHub: todos permanecen en Supabase Storage privado.

## 4. Pruebas obligatorias antes de facilitar la URL a entidades reales

- Entrar con el usuario de pruebas asignado solo a E0002 y comprobar que ve exclusivamente esa entidad.
- Confirmar que el panel muestra registros y que descarga los tres PDF autorizados.
- Probar cierre de sesión y acceso no autenticado.
- Con un segundo usuario asignado a otra entidad, probar que no accede a documentos de E0002, incluso con una petición manual o URL antigua.
- Verificar que `anon` no recibe datos, que `authenticated` no tiene políticas de escritura, y revisar la política `storage.objects`.
- Confirmar que los errores se muestran sin exponer credenciales y que no existen claves privilegiadas en `config.js`.

## Alcance y limitaciones V1

- La prueba SQL anterior confirma el aislamiento RLS con la identidad **simulada** de E0002, pero todavía hay que probar una sesión autenticada real en el navegador.
- Las columnas mostradas se adaptan a los campos que devuelve Supabase; se puede personalizar su orden y nomenclatura cuando confirmemos los datos reales.
- La página de incidencias es de **solo consulta**: comunicar correcciones requerirá un flujo independiente autorizado, diseñado y auditado posteriormente.
- Se cargan 20 registros por página. Si el usuario cambia de entidad o sección, la vista se actualiza y se restablece la paginación.
- Supabase JavaScript v2 se carga desde CDN. El sitio requiere conexión a Internet y que el CDN esté disponible.
- No se implementa alta pública de usuarios ni recuperación de contraseña en V1. Las altas se gestionan desde Supabase Auth por un administrador.
- Evitar publicar el portal para entidades reales hasta completar las pruebas de seguridad indicadas.

## Archivos

- `index.html`: interfaz y zonas de consulta.
- `styles.css`: diseño responsive.
- `app.js`: autenticación, datos y descargas.
- `config.js`: configuración pública (pendiente de rellenar).
- `.nojekyll`: evita procesamiento Jekyll innecesario en GitHub Pages.
