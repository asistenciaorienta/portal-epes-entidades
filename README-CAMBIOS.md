# Portal EPES Entidades · Actualización visual V2

**Objetivo:** adaptar el estilo al frontend interno Gestión EPES Granada (color azul #1f5078, acento verde lima #b8cb14, tarjetas blancas, cabecera flotante y fondo suave), conservando todas las funciones ya operativas.

## Instalación en GitHub Pages (sin perder Supabase)

1. Guarda una copia de los archivos actuales del repositorio.
2. Sustituye **únicamente** `index.html` y `styles.css` por los de esta carpeta.
3. **No sobrescribas ni borres `config.js`**: contiene la URL y la clave pública de Supabase que ya funcionan. **No sobrescribas `app.js`**: el código de autenticación, consultas y descargas se mantiene.
4. Espera a que GitHub Pages publique y recarga la página con `Ctrl+F5` (caché CSS invalidada por el sufijo `?v=epes-v2-20261013`).
5. Verifica acceso del usuario E0002, recuentos, tablas y descargas de PDF.

Esta actualización no necesita modificar Node.js, Ubuntu, el sincronizador EPES o las políticas RLS de Supabase.

## Coincidencia visual

La paleta está basada en el CSS de Gestión EPES: azul `#1f5078`, lima `#b8cb14`, azul claro `#eef4fb`, tipografía de sistema, bordes suaves y sombras. La cabecera conserva un icono tipográfico temporal «EPES». Para incorporar el logotipo real de la aplicación interna, puedes proporcionar el archivo `/var/www/epes/images/logo_epes.png` y se añadirá en una actualización posterior.

## Ficheros

- `index.html`: cabecera/textos visuales; conserva los IDs necesarios para app.js.
- `styles.css`: toda la apariencia visual responsive.

**No contiene credenciales ni configuraciones de Supabase.**
