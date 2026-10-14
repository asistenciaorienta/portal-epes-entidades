/* Portal EPES Entidades · Descarga temporal cifrada V5.
 * No contiene secretos, ni usa claves privilegiadas.
 * Todas las autorizaciones las comprueba Supabase (Auth y RLS).
 * Activacion inicial bloqueada en app.js hasta finalizar pruebas integrales.
 */
const BUCKET = 'epes-descargas-temporales';
const PUBLIC_KEY_URL = './assets/epes-download-public.pem';
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 4 * 60 * 1000;
const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}
function base64ToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Metadatos cifrados no válidos.');
  }
  const data = atob(value);
  return Uint8Array.from(data, (ch) => ch.charCodeAt(0));
}
function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function makeDownloadName(value) {
  return String(value || 'documento_firmado.pdf')
    .replace(/[/\\\\:*?"<>|\x00-\x1f\x7f]/g, '_').slice(0, 160) || 'documento_firmado.pdf';
}
function ensure(current, why = 'Ha cambiado la sesión o la entidad. Solicita de nuevo la descarga.') {
  if (!current()) throw new Error(why);
}
async function loadPublicKey() {
  const result = await fetch(PUBLIC_KEY_URL, { cache: 'no-store', credentials: 'same-origin' });
  if (!result.ok) throw new Error('Falta la clave pública de descargas EPES en GitHub Pages.');
  const pem = await result.text();
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  const der = base64ToBytes(base64);
  return crypto.subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
}
function expectedPath(entityId, id) {
  return `${entityId}/${id}.bin`;
}
function aadFor(request) {
  return encoder.encode(JSON.stringify([
    'epes-descargas-v1', request.id, request.user_id,
    request.clave_documento, request.id_entidad, request.storage_path,
  ]));
}
async function waitForReady(db, requestId, doc, userId, active, status) {
  const deadline = Date.now() + POLL_MAX_MS;
  while (Date.now() < deadline) {
    ensure(active);
    const { data: req, error } = await db.from('epes_solicitudes_descarga')
      .select('id,user_id,clave_documento,id_entidad,estado,storage_bucket,storage_path,iv_salida,tamano_bytes_plano,sha256_plano,nombre_descarga,expira_en,error_publico')
      .eq('id', requestId).maybeSingle();
    if (error) throw new Error(`No se puede consultar el estado de la descarga: ${error.message}`);
    if (!req || req.id !== requestId || req.user_id !== userId ||
        req.id_entidad !== doc.id_entidad || req.clave_documento !== doc.clave_documento ||
        req.storage_bucket !== BUCKET || req.storage_path !== expectedPath(doc.id_entidad, requestId)) {
      throw new Error('La solicitud no corresponde al documento o a la sesión actual.');
    }
    if (req.estado === 'disponible') {
      if (!req.expira_en || Date.parse(req.expira_en) <= Date.now()) {
        throw new Error('El PDF temporal ha caducado. Solicítalo de nuevo.');
      }
      return req;
    }
    if (['error', 'caducado'].includes(req.estado)) {
      throw new Error(req.error_publico || 'No se ha podido preparar la descarga.');
    }
    if (!['pendiente', 'procesando'].includes(req.estado)) {
      throw new Error('Estado de descarga no reconocido.');
    }
    status(req.estado === 'procesando' ? 'Cifrando el documento solicitado…' : 'Solicitud registrada. Esperando al servidor EPES…');
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('La solicitud sigue pendiente. Podrás volver a solicitarla cuando el servicio esté disponible.');
}

/** Pide, recupera y descifra en memoria un PDF real, sin exponer una URL publica. */
export async function downloadEphemeralPdf({ db, userId, documentRow, isCurrent, onStatus }) {
  const status = typeof onStatus === 'function' ? onStatus : () => {};
  const active = typeof isCurrent === 'function' ? isCurrent : () => true;
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues || !window.isSecureContext) {
    throw new Error('Para descargas cifradas necesitas abrir el portal mediante HTTPS.');
  }
  if (!userId || !documentRow || !/^E\d+$/.test(documentRow.id_entidad) ||
      !/^(CONVENIO:|ADENDA:)/.test(String(documentRow.clave_documento || ''))) {
    throw new Error('Documento o usuario no válido para una descarga EPES.');
  }
  ensure(active);
  status('Preparando solicitud segura…');
  const publicKey = await loadPublicKey();
  const aesBytes = crypto.getRandomValues(new Uint8Array(32));
  let aesKey;
  let request;
  try {
    aesKey = await crypto.subtle.importKey('raw', aesBytes, 'AES-GCM', false, ['decrypt']);
    const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, aesBytes);
    ensure(active);
    const { data: requestId, error: requestError } = await db.rpc('epes_solicitar_descarga', {
      p_clave_documento: documentRow.clave_documento,
      p_clave_sesion_cifrada: bytesToBase64(new Uint8Array(wrapped)),
    });
    if (requestError || !requestId) {
      throw new Error(`No se pudo registrar la solicitud: ${requestError?.message || 'sin identificador'}`);
    }
    request = await waitForReady(db, requestId, documentRow, userId, active, status);
  } finally {
    aesBytes.fill(0);
  }
  ensure(active);
  status('Descargando copia cifrada…');
  const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(request.storage_path);
  if (downloadError || !blob) throw new Error(`No se pudo descargar la copia privada: ${downloadError?.message || 'archivo no disponible'}`);
  ensure(active);
  const encrypted = await blob.arrayBuffer();
  const iv = base64ToBytes(request.iv_salida);
  if (iv.length !== 12 || encrypted.byteLength < 17) throw new Error('Datos de cifrado inválidos.');
  status('Descifrando y verificando PDF…');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aadFor(request), tagLength: 128 }, aesKey, encrypted);
  ensure(active);
  if (plain.byteLength !== Number(request.tamano_bytes_plano)) throw new Error('El tamaño del PDF descargado no coincide.');
  const sha = toHex(await crypto.subtle.digest('SHA-256', plain));
  if (sha !== request.sha256_plano || (documentRow.sha256 && sha !== documentRow.sha256.toLowerCase())) {
    throw new Error('La huella SHA-256 del PDF no coincide.');
  }
  const header = encoder.encode('%PDF-');
  const first = new Uint8Array(plain, 0, 5);
  if (!first.every((value, i) => value === header[i])) throw new Error('El archivo recuperado no es un PDF.');
  const output = new Blob([plain], { type: 'application/pdf' });
  const url = URL.createObjectURL(output);
  const link = document.createElement('a');
  link.href = url;
  link.download = makeDownloadName(request.nombre_descarga || documentRow.nombre_archivo);
  document.body.append(link);
  try { ensure(active); link.click(); }
  finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
  status('PDF firmado descargado y verificado.');
}
