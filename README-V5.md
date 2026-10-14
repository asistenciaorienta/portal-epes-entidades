# Portal EPES Entidades · V5 (preparación de descargas bajo demanda)

Este paquete conserva el portal V4 y añade `download-on-demand.js` para solicitar, recibir y descifrar archivos temporales de EPES. **El nuevo flujo está DESACTIVADO por defecto** en `app.js` (`USE_EPES_ON_DEMAND_DOWNLOADS = false`). Las descargas actuales continuarán usando `epes-documentos` mientras no se active la nueva opción.

## Actualización de GitHub Pages

- Antes de actualizar, guarda copia de `index.html`, `app.js` y `styles.css` actuales. Verifica que tu producción corresponda a la V4.
- Sube `index.html`, `app.js` y el archivo adicional `download-on-demand.js` a la raíz del repositorio. **No hace falta reemplazar el CSS V4**.
- Conserva sin cambios `config.js` y `assets/logo_epes.png`. Nunca subas `private_key.pem`, claves `service_role`, secretos de entorno o PDF privados.
- Descarga la CLAVE PUBLICA desde Ubuntu (`/etc/epes-documentos-descargas/public_key.pem`) y súbela a `assets/epes-download-public.pem` antes de habilitar la descarga nueva. Solo la clave pública debe estar en GitHub Pages.
- Esta versión V5 muestra exactamente el comportamiento del portal anterior porque está desactivado el nuevo flujo.

## Circuito listo para habilitar en una fase posterior

1. El navegador genera una clave AES-256 aleatoria y cifra esa clave con RSA-OAEP SHA-256 utilizando la clave pública oficial de EPES.
2. Supabase `epes_solicitar_descarga` comprueba el usuario y la entidad y crea la solicitud; el navegador espera hasta que sea `disponible`.
3. Ubuntu procesa la solicitud y publica una copia AES-256-GCM temporal en el bucket privado.
4. El navegador descarga, descifra, valida el tamaño, SHA-256 y cabecera PDF y descarga el archivo.
5. El servicio separado de limpieza elimina copias caducadas.

**Pendiente**: habilitar la función de solicitud solo para una prueba E0002, probar el worker `--once` de forma manual y controlada, verificar limpieza/caducidad y protección RLS con una sesión auténtica, configurar la frecuencia de ejecución y, solo después, conmutar el portal.

No modifica la aplicación interna EPES ni sincronizador ni documentos originales. **Nunca actives `USE_EPES_ON_DEMAND_DOWNLOADS` sin haber habilitado previamente el worker de forma controlada**.
