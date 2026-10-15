import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { downloadEphemeralPdf } from './download-on-demand.js';

// V8.6: novedades por usuario y entidad, confirmación persistente en Supabase.
// V8.5: bandeja de incidencias pendientes con 6 columnas y empresa resuelta por convenio; histórico y descargas V7 intactos.
// V7: descarga bajo demanda para todos los documentos firmados visibles.
// Autorización efectiva: Supabase Auth + RPC + RLS; no existe acceso anónimo.
// El portal NO recurre automáticamente al bucket permanente si falla el circuito.
// Antes de publicar: verificar originales locales, programadores y permisos RPC.
const EPES_ON_DEMAND_DOWNLOADS = true;

// Consulta de EPES sin credenciales privilegiadas. La única escritura del portal registra «Ya lo he visto» en epes_novedades_vistas.
const PAGE_SIZE = 20;
const PRACTICES_PAGE_SIZE = 15;
const SEARCH_RESULT_LIMIT = 30;
const SECTIONS = {
  convenios: {
    title: 'Convenios', description: 'Convenios de la entidad publicados en EPES.', key: 'id_convenio',
    columns: ['id_convenio', 'nombre_empresa', 'cif_empresa', 'firma_delegado', 'fecha_extincion', 'id_convocatoria']
  },
  adendas: {
    title: 'Adendas', description: 'Adendas vinculadas a los convenios de la entidad.', key: 'id_adenda',
    columns: ['id_adenda', 'id_convenio', 'numero_adenda', 'fecha_adenda', 'motivo_adenda', 'firma_delegado']
  },
  practicas: {
    title: 'Prácticas', description: 'Prácticas relacionadas con la entidad.', key: 'id_practica',
    columns: ['id_practica', 'id_convenio', 'fecha_inicio', 'fecha_fin', 'estado', 'anulada']
  },
  incidencias: {
    title: 'Incidencias pendientes', description: 'Incidencias pendientes de resolver. Las incidencias resueltas se consultan en el convenio o la práctica correspondiente.', key: 'id_incidencia',
    columns: ['id_incidencia', 'nombre_empresa', 'id_convenio', 'id_practica', 'descripcion']
  }
};
const LABELS = {
  id_convenio: 'Convenio', id_adenda: 'Adenda', id_practica: 'Práctica', id_incidencia: 'Incidencia',
  id_origen: 'Origen', nombre_empresa: 'Empresa', cif_empresa: 'CIF empresa',
  firma_delegado: 'Firma delegado/a', numero_adenda: 'N.º de adenda', fecha_adenda: 'Fecha de adenda',
  fecha_inicio: 'Inicio', fecha_fin: 'Fin', fecha_extincion: 'Fecha extinción',
  motivo_extincion: 'Motivo extinción', motivo_adenda: 'Motivo de adenda',
  errores_activos: 'Errores activos', anulada: 'Anulada', anulado: 'Anulado',
  nombre_archivo: 'Archivo', fecha_publicacion: 'Publicado', fecha_actualizacion: 'Actualizado',
  clave_documento: 'Documento', id_entidad: 'Entidad', id_personal_entidad: 'Personal entidad',
  id_acreditacion: 'Acreditación', id_convocatoria: 'Convocatoria', id_practica_origen: 'Práctica origen',
  descripcion: 'Descripción de la incidencia', estado: 'Estado', resuelta: 'Resuelta', fecha_resolucion: 'Fecha resolución',
  persona_usuaria: 'Participante'
};

const el = (id) => document.getElementById(id);
const state = { supabase: null, user: null, entities: [], entity: null, section: 'convenios', page: 0, requestId: 0, searchId: 0, count: 0, convenioFilter: null, pageRelations: null, detailRequestId: 0, novRequestId: 0 };

function validateConfig() {
  if (!SUPABASE_URL?.startsWith('https://') || !SUPABASE_PUBLISHABLE_KEY?.trim()) return false;
  const key = SUPABASE_PUBLISHABLE_KEY.trim();
  if (key.startsWith('sb_secret_') || key.toLowerCase().includes('service_role')) return false;
  // Bloqueo adicional para JWT legacy cuyo rol es service_role.
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role === 'service_role') return false;
    } catch { return false; }
  }
  return true;
}

function displayError(error) {
  if (!error) return 'No ha sido posible completar la operación.';
  if (typeof error === 'string') return error;
  return error.message || 'No ha sido posible completar la operación.';
}
function showMessage(message, isError = false) {
  const target = el('global-message');
  target.textContent = message;
  target.hidden = !message;
  target.classList.toggle('notice-warning', isError);
}
function showLogin(message = '') {
  ++state.requestId;
  state.user = null;
  state.entities = [];
  state.entity = null;
  ++state.novRequestId;
  el('news-panel').hidden = true;
  el('news-list').replaceChildren();
  state.convenioFilter = null;
  clearSearch();
  ++state.detailRequestId;
  if (el('detail-dialog').open) el('detail-dialog').close();
  el('dashboard-view').hidden = true;
  el('login-view').hidden = false;
  el('top-header-actions').hidden = true;
  el('header-label').hidden = false;
  el('login-error').hidden = !message;
  el('login-error').textContent = message;
  if (!message) el('password').value = '';
}
function showDashboard() {
  el('login-view').hidden = true;
  el('dashboard-view').hidden = false;
  el('top-header-actions').hidden = false;
  el('header-label').hidden = true;
  el('password').value = '';
}
function niceLabel(key) {
  return LABELS[key] || key.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}
function formatted(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(d);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  }
  return String(value);
}
function cellText(value, maxLength = 96) {
  const text = formatted(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
function entityName(entity) {
  return entity?.nombre_entidad || entity?.nombre || entity?.denominacion || entity?.razon_social || entity?.nombre_razon_social || entity?.id_entidad || 'Entidad';
}
function errorPanel(message) {
  const box = document.createElement('div');
  box.className = 'empty-state';
  const title = document.createElement('strong');
  title.textContent = 'No se pudo cargar esta sección';
  const detail = document.createElement('span');
  detail.textContent = message;
  box.append(title, detail);
  return box;
}
function emptyPanel() {
  const box = document.createElement('div');
  box.className = 'empty-state';
  const title = document.createElement('strong');
  title.textContent = 'No hay registros disponibles';
  const detail = document.createElement('span');
  detail.textContent = 'Esta entidad no tiene registros publicados en esta sección.';
  box.append(title, detail);
  return box;
}

async function applyUser(user) {
  const db = state.supabase;
  const { data: profile, error: profileError } = await db.from('perfiles')
    .select('id,nombre,email,activo').eq('id', user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.activo !== true) {
    throw new Error('Tu perfil no está activo. Contacta con la persona responsable de EPES.');
  }
  const { data: assignments, error: assignmentsError } = await db.from('perfil_entidades')
    .select('id_entidad').eq('user_id', user.id).order('id_entidad');
  if (assignmentsError) throw assignmentsError;
  const ids = [...new Set((assignments || []).map((x) => x.id_entidad).filter(Boolean))];
  if (!ids.length) throw new Error('Tu usuario no tiene entidades asignadas.');

  const { data: entities, error: entityError } = await db.from('entidades')
    .select('*').in('id_entidad', ids).order('id_entidad');
  if (entityError) throw entityError;
  if (!entities?.length) throw new Error('No se encontraron entidades autorizadas para tu usuario.');

  state.user = user;
  state.entities = entities;
  state.entity = entities[0].id_entidad;
  state.section = 'convenios';
  state.page = 0;
  state.convenioFilter = null;
  clearSearch();
  const selector = el('entity-select');
  selector.replaceChildren();
  for (const entity of entities) {
    const option = document.createElement('option');
    option.value = entity.id_entidad;
    option.textContent = `${entity.id_entidad} · ${entityName(entity)}`;
    selector.append(option);
  }
  selector.value = state.entity;
  selector.disabled = entities.length === 1;
  el('entity-selector-group').hidden = entities.length === 1;
  updateEntityHeading();
  markActiveTab();
  showDashboard();
  showMessage('');
  await Promise.all([loadCounts(), loadSection(), loadNovedades()]);
}


// EPES V8.6 · Notificaciones: solo eventos FUTUROS desde la migración SQL.
// Leemos una RPC SECURITY INVOKER + RLS que excluye confirmaciones del usuario.
// Ninguna marca se guarda en localStorage ni depende del navegador utilizado.
function avisoTitulo(row) {
  if (row.tipo === 'documento_firmado') {
    return row.referencia?.startsWith('ADENDA:')
      ? 'Nueva adenda firmada disponible'
      : 'Nuevo convenio firmado disponible';
  }
  return 'Incidencia resuelta';
}
function avisoDescripcion(row) {
  if (row.tipo === 'documento_firmado') {
    const convenio = row.id_convenio ? ` · Convenio ${row.id_convenio}` : '';
    return `${row.nombre_archivo || row.referencia}${convenio}`;
  }
  return `Incidencia ${row.referencia}` +
    (row.id_practica ? ` · Práctica ${row.id_practica}` :
     row.id_convenio ? ` · Convenio ${row.id_convenio}` : '');
}

async function abrirExpedienteAviso(row) {
  if (!state.entity || !state.user) return;
  const entityId = state.entity;
  const userId = state.user.id;
  let convenioId = row.id_convenio;
  try {
    if (!convenioId && row.id_practica) {
      const { data, error } = await state.supabase.from('practicas')
        .select('id_convenio')
        .eq('id_entidad', entityId)
        .eq('id_practica', row.id_practica)
        .maybeSingle();
      if (error) throw error;
      convenioId = data?.id_convenio;
    }
    if (entityId !== state.entity || userId !== state.user?.id) return;
    if (!convenioId) {
      showMessage('La novedad no tiene un convenio identificado. Consulta el listado de convenios.', true);
      return;
    }
    await jumpToConvenio(convenioId, !!row.id_practica, row.id_practica);
  } catch (error) {
    if (entityId === state.entity && userId === state.user?.id)
      showMessage(`No se pudo abrir el expediente: ${displayError(error)}`, true);
  }
}

async function marcarAvisoVisto(row, input, tarjeta) {
  const entityId = state.entity;
  const userId = state.user?.id;
  if (!userId || entityId !== row.id_entidad) { input.checked = false; return; }
  input.disabled = true;
  try {
    const { error } = await state.supabase.from('epes_novedades_vistas')
      .insert({ id_novedad: row.id, user_id: userId });
    // Un segundo dispositivo podría haber marcado el mismo aviso.
    if (error && error.code !== '23505') throw error;
    if (entityId !== state.entity || userId !== state.user?.id) return;
    tarjeta.remove();
    const restantes = el('news-list').querySelectorAll('.epes-news-item').length;
    el('news-count').textContent = `${restantes} sin leer`;
    if (!restantes) el('news-panel').hidden = true;
  } catch (error) {
    if (entityId !== state.entity || userId !== state.user?.id) return;
    input.checked = false;
    input.disabled = false;
    el('news-status').textContent = `No se pudo guardar «Ya lo he visto»: ${displayError(error)}`;
  }
}

function renderNovedades(rows) {
  const panel = el('news-panel');
  const list = el('news-list');
  list.replaceChildren();
  panel.hidden = rows.length === 0;
  el('news-count').textContent = `${rows.length} sin leer`;
  el('news-status').textContent = '';
  for (const row of rows) {
    const item = document.createElement('article');
    item.className = `epes-news-item epes-news-${row.tipo}`;
    const icono = document.createElement('span');
    icono.className = 'epes-news-icon';
    icono.setAttribute('aria-hidden','true');
    icono.textContent = row.tipo === 'documento_firmado' ? '📄' : '✓';
    const contenido = document.createElement('div');
    contenido.className = 'epes-news-body';
    const cab = document.createElement('div');
    cab.className = 'epes-news-item-head';
    const titulo = document.createElement('strong');
    titulo.textContent = avisoTitulo(row);
    const fecha = document.createElement('time');
    fecha.dateTime = row.creado_en;
    fecha.textContent = formatted(row.creado_en);
    cab.append(titulo,fecha);
    const descripcion = document.createElement('p');
    descripcion.textContent = avisoDescripcion(row);
    const acciones = document.createElement('div');
    acciones.className = 'epes-news-actions';
    if (row.id_convenio || row.id_practica) {
      const abrir = document.createElement('button');
      abrir.type = 'button';
      abrir.className = 'btn btn-secondary epes-news-open';
      abrir.textContent = 'Abrir expediente';
      abrir.addEventListener('click', () => abrirExpedienteAviso(row));
      acciones.append(abrir);
    }
    const marcar = document.createElement('label');
    marcar.className = 'epes-news-ack';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('aria-label', `Ya lo he visto: ${avisoTitulo(row)} ${row.referencia}`);
    input.addEventListener('change', () => {
      if (input.checked) marcarAvisoVisto(row,input,item);
    });
    const label = document.createElement('span');
    label.textContent = 'Ya lo he visto · No volver a mostrar';
    marcar.append(input,label);
    acciones.append(marcar);
    contenido.append(cab,descripcion,acciones);
    item.append(icono,contenido);
    list.append(item);
  }
}

async function loadNovedades() {
  const entityId = state.entity;
  const userId = state.user?.id;
  const req = ++state.novRequestId;
  if (!entityId || !userId) return;
  try {
    const { data, error } = await state.supabase.rpc('epes_mis_novedades', {
      p_id_entidad: entityId,
      p_limite: 30
    });
    if (error) throw error;
    if (req !== state.novRequestId || entityId !== state.entity || userId !== state.user?.id) return;
    renderNovedades(data || []);
  } catch (error) {
    if (req !== state.novRequestId || entityId !== state.entity || userId !== state.user?.id) return;
    el('news-panel').hidden = false;
    el('news-list').replaceChildren();
    el('news-count').textContent = 'No disponible';
    el('news-status').textContent = `No se pudieron consultar las novedades: ${displayError(error)}`;
  }
}

function updateEntityHeading() {
  const entity = state.entities.find((x) => x.id_entidad === state.entity);
  el('entity-name').textContent = `${state.entity} · ${entityName(entity)}`;
}
function markActiveTab() {
  for (const btn of document.querySelectorAll('[data-tab]')) {
    const active = btn.dataset.tab === state.section;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  for (const btn of document.querySelectorAll('[data-stat-section]')) {
    const active = btn.dataset.statSection === state.section;
    btn.classList.toggle('is-selected', active);
    btn.setAttribute('aria-pressed', String(active));
  }
}

// El panel principal sirve como bandeja de trabajo: SOLO pendientes.
// El origen EPES dispone del booleano real `resuelta`: false=pendiente, true=resuelta.
// La lectura completa del histórico se conserva en fetchIncidencias() dentro
// del detalle de cada convenio o práctica, sin filtrar por este booleano.
async function loadCounts() {
  const entityId = state.entity;
  const metrics = ['convenios', 'incidencias'];
  for (const section of metrics) el(`count-${section}`).textContent = '…';
  const results = await Promise.allSettled([
    (async () => {
      const { count, error } = await state.supabase.from('convenios')
        .select('id_convenio', { count: 'exact', head: true })
        .eq('id_entidad', entityId);
      if (error || count === null) throw error || new Error('No se pudo contar convenios.');
      return count;
    })(),
    (async () => {
      const { count, error } = await state.supabase.from('incidencias')
        .select('id_incidencia', { count: 'exact', head: true })
        .eq('id_entidad', entityId)
        .eq('resuelta', false);
      if (error || count === null) throw error || new Error('No se pudieron contar incidencias pendientes.');
      return count;
    })()
  ]);
  if (state.entity !== entityId || !state.user) return;
  let failed = false;
  for (let i = 0; i < metrics.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') el(`count-${metrics[i]}`).textContent = result.value.toLocaleString('es-ES');
    else { failed = true; el(`count-${metrics[i]}`).textContent = '—'; }
  }
  const tarjeta = el('count-incidencias').closest('.stat');
  const pie = el('incidencias-caption');
  const resultado = results[1];
  tarjeta.classList.remove('has-incidents');
  if (resultado.status === 'fulfilled') {
    const pendientes = resultado.value;
    pie.textContent = pendientes === 0
      ? 'Ninguna pendiente de resolver'
      : `${pendientes.toLocaleString('es-ES')} pendiente${pendientes === 1 ? '' : 's'} por resolver`;
    tarjeta.classList.toggle('has-incidents', pendientes > 0);
  } else {
    pie.textContent = 'No se pudo consultar el número de pendientes';
  }
  if (failed) showMessage('No se han podido cargar todos los contadores. Comprueba tu conexión o tus permisos.', true);
}

function columnsFor(rows, section) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]).filter((x) => x !== 'id_entidad' && x !== 'fecha_actualizacion' && x !== 'storage_bucket' && x !== 'storage_path');
  // No añadir columnas adicionales automáticamente al listado principal.
  // Evita que aparezca Acreditación o surja un desplazamiento horizontal.
  if (section === 'convenios') return SECTIONS.convenios.columns;
  const preferred = SECTIONS[section].columns.filter((x) => keys.includes(x));
  return [...preferred, ...keys.filter((x) => !preferred.includes(x))].slice(0, 6);
}
// Solo señalamos firmas pendientes cuando el dato sincronizado indica expresamente «no firmado».
// Las firmas nulas o desconocidas NO se consideran pendientes.
const FIRMAS_CONOCIDAS = {
  convenios: ['firma_delegado', 'firma_empresa', 'firma_entidad'],
  adendas: ['firma_delegado', 'firma_representante', 'firma_representante_legal', 'firma_entidad', 'firma_empresa'],
  practicas: ['firma_delegado', 'firma_empresa', 'firma_participante', 'firma_alumno']
};
function firmaPendiente(row, section) {
  const esFaltaConfirmada = (v) => v === false || v === 0 ||
    (typeof v === 'string' && ['false', 'no', '0', 'pendiente', 'sin firmar'].includes(v.trim().toLowerCase()));
  return (FIRMAS_CONOCIDAS[section] || [])
    .filter((field) => Object.hasOwn(row, field) && esFaltaConfirmada(row[field]));
}
function tieneErroresActivos(row) {
  const value = row.errores_activos;
  if (value == null || value === false || value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'number') return value > 0;
  const s = String(value).trim().toLowerCase();
  if (!s || ['0','false','no','[]','{}','null','sin errores'].includes(s)) return false;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  try { return tieneErroresActivos({ errores_activos: JSON.parse(s) }); }
  catch { return true; }
}
// Una incidencia histórica no equivale por sí misma a un error pendiente.
function incidenciaActiva(inc) {
  const status = String(inc.estado || inc.situacion || '').toLowerCase().trim();
  // Cualquier cierre expreso prevalece sobre un indicador antiguo «resuelta=false».
  if (inc.resuelta === true || inc.fecha_resolucion ||
      ['resuelta','resuelto','cerrada','cerrado','solucionada','solucionado','finalizada','finalizado'].includes(status)) return false;
  if (inc.resuelta === false ||
      ['abierta','abierto','pendiente','sin resolver','en curso','activa','activo'].includes(status)) return true;
  return null;
}
function alertasRegistro(row, section, incidencias = []) {
  const flags = [];
  if (tieneErroresActivos(row)) flags.push({ text: 'Errores activos', kind: 'error' });
  const pendientes = firmaPendiente(row, section);
  if (pendientes.length) flags.push({ text: 'Firma pendiente', kind: 'pending' });
  if (incidencias.some((inc) => incidenciaActiva(inc) === true)) {
    if (!flags.some((flag) => flag.kind === 'error')) flags.push({ text: 'Incidencia pendiente', kind: 'error' });
  } else if (incidencias.length && !flags.some((flag) => flag.kind === 'error')) {
    flags.push({ text: 'Incidencias registradas', kind: 'history' });
  }
  return flags;
}
// Aviso agregado para el listado de convenios. Incluye adendas y prácticas
// del expediente; no convierte incidencias históricas en problemas activos.
function alertasConvenio(row, relations = state.pageRelations) {
  const flags = alertasRegistro(row, 'convenios', incidenciasEnPagina('convenios', row, relations));
  if (!relations) return flags;
  const id = String(row.id_convenio);
  const adendas = relations.adendasByConvenio.get(id) || [];
  if (adendas.some((a) => tieneErroresActivos(a))) {
    flags.push({ text: 'Errores en adenda', kind: 'error' });
  }
  if (adendas.some((a) => firmaPendiente(a, 'adendas').length > 0)) {
    flags.push({ text: 'Firma de adenda pendiente', kind: 'pending' });
  }
  if ((relations.activePracticesByConvenio.get(id) || 0) > 0) {
    flags.push({ text: 'Prácticas con errores', kind: 'error' });
  }
  return flags;
}
function renderFlags(target, flags) {
  const wrap = document.createElement('div');
  wrap.className = 'record-badges';
  for (const flag of flags) wrap.append(createStatusBadge(flag.text, flag.kind));
  if (!flags.length) wrap.append(createStatusBadge('Sin avisos activos', 'ok'));
  target.append(wrap);
}
function setRowSeverity(tr, flags) {
  if (flags.some((f) => f.kind === 'error')) tr.classList.add('record-has-errors');
  else if (flags.some((f) => f.kind === 'pending')) tr.classList.add('record-has-pending');
}
function createStatusBadge(label, kind) {
  const span = document.createElement('span');
  span.className = `record-badge record-badge-${kind}`;
  span.textContent = label;
  return span;
}
function appendAlerts(target, row, section, incidencias = [], showEmpty = true) {
  const flags = alertasRegistro(row, section, incidencias);
  if (!flags.length && !showEmpty) return flags;
  const wrap = document.createElement('div');
  wrap.className = 'record-badges';
  for (const flag of flags) wrap.append(createStatusBadge(flag.text, flag.kind));
  if (!flags.length) wrap.append(createStatusBadge('Sin avisos activos', 'ok'));
  target.append(wrap);
  return flags;
}
function appendDetailField(target, labelText, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'detail-row';
  const label = document.createElement('dt');
  label.textContent = labelText;
  const val = document.createElement('dd');
  val.textContent = formatted(value);
  wrapper.append(label, val);
  target.append(wrapper);
}
function incidenciasEnPagina(section, row, relations = state.pageRelations) {
  if (!relations) return [];
  if (section === 'convenios') return relations.incByConvenio.get(String(row.id_convenio)) || [];
  if (section === 'practicas') return relations.incByPractica.get(String(row.id_practica)) || [];
  return [];
}
async function fetchIncidencias(row, section, entityId) {
  if (!['convenios', 'practicas'].includes(section)) return [];
  const key = section === 'convenios' ? 'id_convenio' : 'id_practica';
  if (!row[key]) return [];
  const { data, error } = await state.supabase.from('incidencias')
    .select('*').eq('id_entidad', entityId).eq(key, row[key]).limit(1000);
  if (error) throw error;
  return data || [];
}
async function showDetails(row, section) {
  const id = ++state.detailRequestId;
  const entityId = state.entity;
  el('detail-title').textContent = `${SECTIONS[section].title} · ${formatted(row[SECTIONS[section].key])}`;
  const list = el('detail-content');
  list.replaceChildren();
  const statusArea = document.createElement('section');
  statusArea.className = 'detail-alerts';
  const h = document.createElement('h3');
  h.textContent = 'Avisos y firmas';
  statusArea.append(h);
  const localInc = incidenciasEnPagina(section, row);
  if (section === 'incidencias') {
    statusArea.append(createStatusBadge(
      row.resuelta === false ? 'Pendiente de resolver' : 'Incidencia resuelta',
      row.resuelta === false ? 'pending' : 'ok'
    ));
  } else {
    appendAlerts(statusArea, row, section, localInc);
  }
  list.append(statusArea);
  for (const [key, value] of Object.entries(row)) {
    if (key === 'storage_bucket' || key === 'storage_path') continue;
    appendDetailField(list, niceLabel(key), value);
  }
  const issuesArea = document.createElement('section');
  issuesArea.className = 'detail-issues';
  const issueHeading = document.createElement('h3');
  issueHeading.textContent = section === 'convenios' ? 'Incidencias vinculadas al convenio (incluidas sus prácticas)' : 'Incidencias vinculadas a la práctica';
  if (['convenios','practicas'].includes(section)) {
    issuesArea.append(issueHeading);
    const waiting = document.createElement('p'); waiting.className = 'muted'; waiting.textContent = 'Consultando incidencias…';
    issuesArea.append(waiting); list.append(issuesArea);
  }
  if (!el('detail-dialog').open) el('detail-dialog').showModal();
  if (!['convenios', 'practicas'].includes(section)) return;
  try {
    const issues = await fetchIncidencias(row, section, entityId);
    if (id !== state.detailRequestId || entityId !== state.entity || !el('detail-dialog').open) return;
    issuesArea.replaceChildren(issueHeading);
    statusArea.querySelector('.record-badges')?.remove();
    appendAlerts(statusArea, row, section, issues);
    if (!issues.length) {
      const p = document.createElement('p'); p.className = 'muted';
      p.textContent = tieneErroresActivos(row)
        ? 'EPES indica errores activos; no hay una incidencia detallada vinculada a este registro en los datos publicados.'
        : 'No hay incidencias vinculadas a este registro.';
      issuesArea.append(p);
    }
    for (const inc of issues) {
      const item = document.createElement('article'); item.className = 'detail-issue';
      const title = document.createElement('strong');
      title.textContent = `Incidencia ${inc.id_incidencia || 'registrada'}${inc.id_practica ? ' · Práctica ' + inc.id_practica : ''}`;
      const description = document.createElement('p');
      description.textContent = formatted(inc.descripcion || inc.detalle || inc.mensaje || inc.error || 'Sin descripción disponible');
      item.append(title, description);
      const stateLine = document.createElement('small');
      stateLine.textContent = incidenciaActiva(inc) === true ? 'Estado: pendiente' : incidenciaActiva(inc) === false ? 'Estado: resuelta' : 'Estado de resolución: no especificado';
      item.append(stateLine); issuesArea.append(item);
    }
  } catch (error) {
    if (id !== state.detailRequestId || entityId !== state.entity) return;
    issuesArea.replaceChildren(issueHeading);
    const warn = document.createElement('p'); warn.className = 'notice notice-warning';
    warn.textContent = `No se pudieron consultar las incidencias: ${displayError(error)}`;
    issuesArea.append(warn);
  }
}

function makeButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

// Carga bajo demanda: ninguna práctica de otros convenios ni de otras entidades.
async function renderPracticasConvenio(convenio, panel, page = 0, focusPracticeId = null) {
  const entityId = state.entity;
  const convenioId = convenio.id_convenio;
  panel.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'muted';
  loading.textContent = 'Cargando prácticas asociadas…';
  panel.append(loading);
  try {
    const { data, error, count } = await state.supabase.from('practicas')
      .select('*', { count: 'exact' })
      .eq('id_entidad', entityId)
      .eq('id_convenio', convenioId)
      .order('id_practica', { ascending: false })
      .range(page * PRACTICES_PAGE_SIZE, (page + 1) * PRACTICES_PAGE_SIZE - 1);
    if (error) throw error;
    if (!panel.isConnected || entityId !== state.entity || !state.user) return;
    const records = data || [];
    const practiceIssues = new Map();
    if (records.length) {
      const ids = records.map((r) => r.id_practica).filter(Boolean);
      if (ids.length) {
        const { data: issues, error: issuesError } = await state.supabase.from('incidencias')
          .select('*').eq('id_entidad', entityId).in('id_practica', ids).limit(1000);
        if (issuesError) throw issuesError;
        for (const inc of issues || []) {
          const key = String(inc.id_practica);
          if (!practiceIssues.has(key)) practiceIssues.set(key, []);
          practiceIssues.get(key).push(inc);
        }
      }
    }
    if (!panel.isConnected || entityId !== state.entity || !state.user) return;
    panel.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'convenio-expanded-head';
    const h = document.createElement('strong');
    h.textContent = `Prácticas del convenio ${convenioId}`;
    const counter = document.createElement('span');
    counter.className = 'records-tag';
    counter.textContent = `${count ?? records.length} práctica${(count ?? records.length) === 1 ? '' : 's'}`;
    heading.append(h, counter);
    panel.append(heading);
    if (!records.length) {
      const msg = document.createElement('p');
      msg.className = 'muted';
      msg.textContent = 'Este convenio no tiene prácticas publicadas.';
      panel.append(msg);
      return;
    }
    const scroll = document.createElement('div');
    scroll.className = 'data-wrap practicas-inline-wrap';
    const table = document.createElement('table');
    table.className = 'convenio-expanded-table practica-inline-table';
    const keys = ['id_practica', 'fecha_inicio', 'fecha_fin', 'persona_usuaria'];
    const trh = document.createElement('tr');
    for (const key of keys) {
      const th = document.createElement('th');
      th.textContent = niceLabel(key);
      trh.append(th);
    }
    const statusHead = document.createElement('th'); statusHead.textContent = 'Avisos'; trh.append(statusHead);
    const actionHead = document.createElement('th');
    actionHead.textContent = 'Detalle';
    trh.append(actionHead);
    const thead = document.createElement('thead');
    thead.append(trh);
    table.append(thead);
    const tbody = document.createElement('tbody');
    for (const practice of records) {
      const tr = document.createElement('tr');
      if (focusPracticeId != null && String(practice.id_practica) === String(focusPracticeId)) {
        tr.classList.add('practica-found');
      }
      for (const key of keys) {
        const td = document.createElement('td');
        td.dataset.label = niceLabel(key);
        td.textContent = formatted(practice[key]);
        tr.append(td);
      }
      const issues = practiceIssues.get(String(practice.id_practica)) || [];
      const flags = alertasRegistro(practice, 'practicas', issues);
      setRowSeverity(tr, flags);
      const tdStatus = document.createElement('td'); tdStatus.dataset.label = 'Avisos'; appendAlerts(tdStatus, practice, 'practicas', issues); tr.append(tdStatus);
      const actions = document.createElement('td'); actions.dataset.label = 'Detalle';
      actions.append(makeButton('Ver detalle / incidencias', 'link-action', () => showDetails(practice, 'practicas')));
      tr.classList.add('record-clickable');
      tr.addEventListener('click', (event) => { if (!event.target.closest('button,a')) showDetails(practice, 'practicas'); });
      tr.append(actions);
      tbody.append(tr);
    }
    table.append(tbody);
    scroll.append(table);
    panel.append(scroll);
    const match = tbody.querySelector('.practica-found');
    if (match) match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if ((count ?? records.length) > PRACTICES_PAGE_SIZE) {
      const pager = document.createElement('div');
      pager.className = 'convenio-expanded-pagination';
      const status = document.createElement('span');
      status.textContent = `${page * PRACTICES_PAGE_SIZE + 1}–${page * PRACTICES_PAGE_SIZE + records.length} de ${count}`;
      const controls = document.createElement('div');
      controls.className = 'search-result-actions';
      const prev = makeButton('Anterior', 'btn btn-secondary', () => renderPracticasConvenio(convenio, panel, page - 1, focusPracticeId));
      prev.disabled = page === 0;
      const next = makeButton('Siguiente', 'btn btn-secondary', () => renderPracticasConvenio(convenio, panel, page + 1, focusPracticeId));
      next.disabled = (page + 1) * PRACTICES_PAGE_SIZE >= count;
      controls.append(prev, next);
      pager.append(status, controls);
      panel.append(pager);
    }
  } catch (error) {
    if (panel.isConnected && entityId === state.entity) panel.replaceChildren(errorPanel(displayError(error)));
  }
}

function convenioDocs(row, relations = state.pageRelations) {
  return (relations?.docsByConvenio.get(String(row.id_convenio)) || [])
    .filter((doc) => doc.id_adenda == null);
}
function adendaDocs(row, relations = state.pageRelations) {
  return (relations?.docsByAdenda.get(String(row.id_adenda)) || []);
}
function documentButtons(target, documents, fallback = 'PDF firmado') {
  for (const doc of documents) {
    const label = doc.nombre_archivo || doc.clave_documento || fallback;
    const row = document.createElement('div');
    row.className = 'expediente-file';
    const file = document.createElement('div');
    file.className = 'expediente-file-info';
    const icon = document.createElement('span');
    icon.className = 'expediente-file-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'PDF';
    const name = document.createElement('span');
    name.className = 'expediente-file-name';
    name.textContent = label;
    file.append(icon, name);
    const button = makeButton('↓ Descargar PDF', 'pdf-download', () => downloadDocument(doc, button));
    button.title = `Descargar ${label}`;
    row.append(file, button);
    target.append(row);
  }
}
function renderAdendasConvenio(convenio, relations) {
  const list = relations?.adendasByConvenio.get(String(convenio.id_convenio)) || [];
  const section = document.createElement('section');
  section.className = 'expanded-doc-section expediente-card expediente-adendas';
  const title = document.createElement('h4');
  title.textContent = `Adendas (${list.length})`;
  section.append(title);
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No se han publicado adendas para este convenio.';
    section.append(empty);
  }
  for (const adenda of list) {
    const item = document.createElement('article');
    item.className = 'expanded-adenda';
    const header = document.createElement('div');
    header.className = 'adenda-header';
    const name = document.createElement('strong');
    name.textContent = `Adenda ${adenda.numero_adenda ?? adenda.id_adenda}`;
    const date = document.createElement('span');
    date.className = 'adenda-date';
    date.textContent = formatted(adenda.fecha_adenda);
    header.append(name, date);
    item.append(header);
    if (adenda.motivo_adenda) {
      const reason = document.createElement('p');
      reason.className = 'adenda-reason';
      reason.textContent = adenda.motivo_adenda;
      item.append(reason);
    }
    // Si no hay alertas confirmadas, no mostrar etiquetas vacías.
    appendAlerts(item, adenda, 'adendas', [], false);
    const actions = document.createElement('div');
    actions.className = 'adenda-footer';
    const docs = adendaDocs(adenda, relations);
    if (docs.length) documentButtons(actions, docs, 'Adenda firmada');
    else {
      const msg = document.createElement('small');
      msg.className = 'muted';
      msg.textContent = 'Sin PDF firmado publicado';
      actions.append(msg);
    }
    actions.append(makeButton('Ver detalles', 'link-action', () => showDetails(adenda, 'adendas')));
    item.append(actions);
    section.append(item);
  }
  return section;
}
async function mostrarPracticasConFoco(convenio, panel, focusPracticeId = null) {
  let page = 0;
  if (focusPracticeId) {
    const { count, error } = await state.supabase.from('practicas')
      .select('id_practica', { count: 'exact', head: true })
      .eq('id_entidad', state.entity)
      .eq('id_convenio', convenio.id_convenio)
      .gt('id_practica', focusPracticeId);
    if (error) throw error;
    page = Math.floor((count || 0) / PRACTICES_PAGE_SIZE);
  }
  await renderPracticasConvenio(convenio, panel, page, focusPracticeId);
}
function toggleExpedienteConvenio(row, tr, button) {
  const focusPracticeId = button.dataset.focusPracticeId || null;
  delete button.dataset.focusPracticeId;
  const old = tr.nextElementSibling;
  if (old?.classList.contains('convenio-expanded-row')) {
    if (old.hidden) old.hidden = false;
    else if (!focusPracticeId) old.hidden = true;
    button.setAttribute('aria-expanded', String(!old.hidden));
    button.textContent = old.hidden ? 'Abrir expediente' : 'Ocultar expediente';
    if (focusPracticeId && !old.hidden) {
      const area = old.querySelector('.practices-area');
      if (area) void mostrarPracticasConFoco(row, area, focusPracticeId).catch((e) => area.replaceChildren(errorPanel(displayError(e))));
    }
    return;
  }
  const expanded = document.createElement('tr'); expanded.className = 'convenio-expanded-row';
  const td = document.createElement('td'); td.colSpan = tr.children.length;
  const panel = document.createElement('div'); panel.className = 'convenio-expanded-panel';
  td.append(panel); expanded.append(td); tr.after(expanded);
  button.setAttribute('aria-expanded', 'true'); button.textContent = 'Ocultar expediente';

  const top = document.createElement('section');
  top.className = 'expanded-doc-section expediente-header';
  const heading = document.createElement('div');
  heading.className = 'expediente-heading';
  const title = document.createElement('h4');
  title.textContent = `Expediente ${row.id_convenio}`;
  const company = document.createElement('p');
  company.textContent = row.nombre_empresa || 'Convenio de la entidad';
  heading.append(title, company);
  top.append(heading);
  const topFlags = alertasConvenio(row);
  if (topFlags.length) renderFlags(top, topFlags);
  top.append(makeButton('Ver datos y avisos', 'link-action', () => showDetails(row, 'convenios')));
  panel.append(top);

  const grid = document.createElement('div');
  grid.className = 'expediente-doc-grid';
  const documents = document.createElement('section');
  documents.className = 'expanded-doc-section expediente-card expediente-convenio-pdf';
  const docTitle = document.createElement('h4');
  docTitle.textContent = 'Documento del convenio';
  documents.append(docTitle);
  const relatedDocs = convenioDocs(row);
  if (relatedDocs.length) documentButtons(documents, relatedDocs, 'Convenio firmado');
  else {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay PDF firmado publicado para este convenio.';
    documents.append(empty);
  }
  grid.append(documents, renderAdendasConvenio(row, state.pageRelations));
  panel.append(grid);

  const practices = document.createElement('section');
  practices.className = 'expanded-doc-section expediente-card expediente-practicas';
  const practicesArea = document.createElement('div');
  practicesArea.className = 'practices-area';
  practices.append(practicesArea);
  panel.append(practices);
  void mostrarPracticasConFoco(row, practicesArea, focusPracticeId).catch((e) => practicesArea.replaceChildren(errorPanel(displayError(e))));
}

// Bandeja de incidencias: seis columnas fijas y sin datos técnicos sobrantes.
// La empresa se consulta del convenio autorizado, nunca se presupone.
function renderIncidenciasPendientes(rows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'data-wrap incidencias-table-wrap';
  const table = document.createElement('table');
  table.className = 'data-table incidencias-pendientes-table';
  const headings = ['Incidencia', 'Empresa', 'Convenio', 'Práctica', 'Detalle error', 'Expediente'];
  const thead = document.createElement('thead');
  const header = document.createElement('tr');
  for (const label of headings) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    header.append(th);
  }
  thead.append(header);
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const ctx = state.pageRelations?.incidenceContext.get(String(row.id_incidencia)) || {};
    const tr = document.createElement('tr');
    tr.className = 'record-pending-incident record-clickable';
    const addCell = (label, value, extraClass = '') => {
      const td = document.createElement('td');
      td.dataset.label = label;
      if (extraClass) td.className = extraClass;
      td.textContent = value == null || value === '' ? '—' : String(value);
      tr.append(td);
      return td;
    };
    const incidentCell = addCell('Incidencia', null, 'incident-reference');
    incidentCell.replaceChildren(makeButton(
      formatted(row.id_incidencia), 'link-action', () => showDetails(row, 'incidencias')
    ));
    addCell('Empresa', ctx.empresa || '—', 'incident-company');
    addCell('Convenio', ctx.convenioId || '—', 'incident-convenio');
    addCell('Práctica', ctx.practicaId || '—', 'incident-practica');
    const detail = [row.descripcion, row.detalle, row.mensaje, row.error]
      .find(v => typeof v === 'string' && v.trim()) || 'Sin descripción publicada';
    addCell('Detalle error', detail, 'incident-description');
    const action = document.createElement('td');
    action.dataset.label = 'Expediente';
    action.className = 'incident-expediente';
    if (ctx.canOpen && ctx.convenioId) {
      action.append(makeButton('Abrir expediente', 'convenio-expand-button', () =>
        jumpToConvenio(ctx.convenioId, Boolean(ctx.practicaId), ctx.practicaId || null)));
    } else {
      const msg = document.createElement('span');
      msg.className = 'incident-unlinked';
      msg.textContent = ctx.inconsistent ? 'Revisar vinculación' : 'Sin expediente vinculado';
      action.append(msg);
    }
    tr.append(action);
    tr.addEventListener('click', (event) => {
      if (!event.target.closest('button,a')) showDetails(row, 'incidencias');
    });
    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}

function renderTable(rows, section) {
  if (section === 'incidencias') return renderIncidenciasPendientes(rows);
  const columns = columnsFor(rows, section);
  const wrapper = document.createElement('div');
  wrapper.className = section === 'convenios' ? 'data-wrap convenios-table-wrap' : 'data-wrap';
  const table = document.createElement('table');
  table.className = section === 'convenios' ? 'data-table convenios-table' : 'data-table';
  const thead = document.createElement('thead'); const headingRow = document.createElement('tr');
  for (const key of columns) {
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = niceLabel(key);
    headingRow.append(th);
  }
  if (section !== 'incidencias') {
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = 'Avisos'; headingRow.append(th);
  }
  const actionsHead = document.createElement('th'); actionsHead.scope = 'col';
  actionsHead.textContent = 'Expediente'; headingRow.append(actionsHead);
  thead.append(headingRow); table.append(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const issues = incidenciasEnPagina(section, row);
    const flags = section === 'convenios' ? alertasConvenio(row) : alertasRegistro(row, section, issues);
    setRowSeverity(tr, flags);
    if (section === 'incidencias' && row.resuelta === false) tr.classList.add('record-pending-incident');
    tr.classList.add('record-clickable');
    for (const key of columns) {
      const td = document.createElement('td'); td.className = 'cell-short';
      td.dataset.label = niceLabel(key);
      td.textContent = section === 'convenios' ? formatted(row[key]) : cellText(row[key]);
      td.title = formatted(row[key]); tr.append(td);
    }
    if (section !== 'incidencias') {
      const cell = document.createElement('td'); cell.dataset.label = 'Avisos';
      renderFlags(cell, flags); tr.append(cell);
    }
    const action = document.createElement('td'); action.dataset.label = 'Expediente';
    const group = document.createElement('div'); group.className = 'convenio-actions';
    if (section === 'convenios') {
      const showPractices = makeButton('Abrir expediente', 'convenio-expand-button', () => toggleExpedienteConvenio(row, tr, showPractices));
      showPractices.dataset.practicasConvenio = row.id_convenio;
      showPractices.setAttribute('aria-expanded', 'false');
      group.append(showPractices);
      tr.addEventListener('click', (event) => {
        if (!event.target.closest('button,a')) showPractices.click();
      });
    } else {
      group.append(makeButton('Ver detalle', 'link-action', () => showDetails(row, section)));
      if (section === 'incidencias' && row.id_convenio) {
        group.append(makeButton('Abrir expediente', 'link-action', () =>
          jumpToConvenio(row.id_convenio, Boolean(row.id_practica), row.id_practica || null)));
      }
      tr.addEventListener('click', (event) => {
        if (!event.target.closest('button,a')) showDetails(row, section);
      });
    }
    action.append(group); tr.append(action);
    tbody.append(tr);
  }
  table.append(tbody); wrapper.append(table); return wrapper;
}

async function downloadDocument(row, button) {
  // Validaciones adicionales de cliente, nunca sustituyen Auth/RLS/RPC.
  // Durante la migración conservamos metadatos antiguos de epes-documentos,
  // pero el PDF se obtiene siempre del origen local mediante solicitud segura.
  if (!state.user || !state.supabase || row.id_entidad !== state.entity ||
      !/^(CONVENIO:|ADENDA:)/.test(String(row.clave_documento || '')) ||
      (row.storage_bucket && row.storage_bucket !== 'epes-documentos') ||
      (row.storage_path && !row.storage_path.startsWith(`${state.entity}/`))) {
    showMessage('El documento no está autorizado para la entidad seleccionada.', true);
    return;
  }
  if (!EPES_ON_DEMAND_DOWNLOADS) {
    showMessage('Las descargas bajo demanda no están habilitadas.', true);
    return;
  }
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Preparando PDF…';
  const currentUser = state.user.id;
  const currentEntity = state.entity;
  const db = state.supabase;
  try {
    await downloadEphemeralPdf({
      db,
      userId: currentUser,
      documentRow: row,
      isCurrent: () => state.user?.id === currentUser &&
                       state.entity === currentEntity && state.supabase === db,
      onStatus: (message) => {
        if (state.user?.id === currentUser && state.entity === currentEntity) {
          showMessage(message);
        }
      },
    });
  } catch (error) {
    if (state.user?.id === currentUser && state.entity === currentEntity) {
      showMessage(`No se pudo descargar el PDF: ${displayError(error)}`, true);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}
// Resuelve el nombre de empresa sin añadir campos inexistentes a incidencias.
// Si solo consta una práctica, localiza primero su convenio.
async function addIncidenceContexts(rows, entityId, relations, issues) {
  const directConventionIds = new Set();
  const practiceIds = new Set();
  const refs = new Map();
  for (const inc of rows) {
    const originType = String(inc.tipo_origen || '').toLowerCase();
    const practiceId = inc.id_practica ||
      (originType.includes('pract') ? inc.id_origen : null);
    const convenioId = inc.id_convenio ||
      (originType.includes('conven') ? inc.id_origen : null);
    refs.set(String(inc.id_incidencia), { practiceId, convenioId });
    if (practiceId) practiceIds.add(practiceId);
    if (convenioId) directConventionIds.add(convenioId);
  }
  const practicasById = new Map();
  if (practiceIds.size) {
    const { data, error } = await state.supabase.from('practicas')
      .select('id_practica,id_convenio')
      .eq('id_entidad', entityId)
      .in('id_practica', [...practiceIds]);
    if (error) issues.push(`Relación de prácticas: ${displayError(error)}`);
    else for (const p of data || []) {
      practicasById.set(String(p.id_practica), p);
      if (p.id_convenio) directConventionIds.add(p.id_convenio);
    }
  }
  const conveniosById = new Map();
  if (directConventionIds.size) {
    const { data, error } = await state.supabase.from('convenios')
      .select('id_convenio,nombre_empresa')
      .eq('id_entidad', entityId)
      .in('id_convenio', [...directConventionIds]);
    if (error) issues.push(`Relación de empresas: ${displayError(error)}`);
    else for (const convenio of data || []) {
      conveniosById.set(String(convenio.id_convenio), convenio);
    }
  }
  for (const inc of rows) {
    const ref = refs.get(String(inc.id_incidencia));
    const practice = ref.practiceId ? practicasById.get(String(ref.practiceId)) : null;
    const linkedId = practice?.id_convenio || null;
    const inconsistent = Boolean(ref.convenioId && linkedId && String(ref.convenioId) !== String(linkedId));
    const convenioId = ref.convenioId || linkedId;
    const convenio = !inconsistent && convenioId ? conveniosById.get(String(convenioId)) : null;
    relations.incidenceContext.set(String(inc.id_incidencia), {
      convenioId, practicaId: ref.practiceId,
      empresa: convenio?.nombre_empresa || null,
      canOpen: Boolean(convenio), inconsistent
    });
  }
}

// La descarga privada se presenta junto al convenio o adenda correspondiente.
async function loadPageRelations(section, rows, entityId) {
  const relations = {docsByConvenio: new Map(), docsByAdenda: new Map(), adendasByConvenio: new Map(), incByConvenio: new Map(), incByPractica: new Map(), activePracticesByConvenio: new Map(), incidenceContext: new Map()};
  const issues = [];
  const ids = [...new Set(rows.map((r) => r.id_convenio).filter(Boolean))];
  const adendaIds = [...new Set(rows.map((r) => r.id_adenda).filter((x) => x != null))];
  const practiceIds = [...new Set(rows.map((r) => r.id_practica).filter(Boolean))];
  const jobs = [];
  function queue(label, builder, consumer) {
    jobs.push((async () => {
      const {data,error} = await builder;
      if (error) throw error;
      for (const row of data || []) consumer(row);
    })().catch((err) => issues.push(`${label}: ${displayError(err)}`)));
  }
  const add = (map, key, row) => {
    if (key == null) return;
    const id = String(key);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  };
  if (['convenios','adendas'].includes(section)) {
    if (ids.length) {
      queue('Documentos', state.supabase.from('documentos').select('*').eq('id_entidad', entityId).in('id_convenio', ids).limit(1000),
        (r) => { add(relations.docsByConvenio, r.id_convenio, r); add(relations.docsByAdenda, r.id_adenda, r); });
    } else if (adendaIds.length) {
      queue('Documentos de adenda', state.supabase.from('documentos').select('*').eq('id_entidad', entityId).in('id_adenda', adendaIds).limit(1000),
        (r) => { add(relations.docsByConvenio, r.id_convenio, r); add(relations.docsByAdenda, r.id_adenda, r); });
    }
  }
  if (section === 'convenios' && ids.length) {
    queue('Adendas', state.supabase.from('adendas').select('*').eq('id_entidad', entityId).in('id_convenio', ids).limit(1000),
      (r) => add(relations.adendasByConvenio, r.id_convenio, r));
    queue('Incidencias de convenios', state.supabase.from('incidencias').select('*').eq('id_entidad', entityId).in('id_convenio', ids).limit(1000),
      (r) => add(relations.incByConvenio, r.id_convenio, r));
    // SELECT * evita pedir una columna que no existe en public.practicas.
    // Si el esquema aporta un indicador de error, úsalo; en los demás
    // casos los avisos se derivan de incidencias con estado activo confirmado.
    queue('Prácticas del expediente', state.supabase.from('practicas')
      .select('*')
      .eq('id_entidad', entityId).in('id_convenio', ids).limit(1000),
      (r) => {
        if (!tieneErroresActivos(r)) return;
        const key = String(r.id_convenio);
        relations.activePracticesByConvenio.set(key, (relations.activePracticesByConvenio.get(key) || 0) + 1);
      });
  }
  if (section === 'practicas' && practiceIds.length) {
    queue('Incidencias de prácticas', state.supabase.from('incidencias').select('*').eq('id_entidad', entityId).in('id_practica', practiceIds).limit(1000),
      (r) => add(relations.incByPractica, r.id_practica, r));
  }
  await Promise.all(jobs);
  if (section === 'incidencias' && rows.length) {
    await addIncidenceContexts(rows, entityId, relations, issues);
  }
  return {relations, issues};
}

async function loadSection() {
  const requestId = ++state.requestId;
  const entityId = state.entity;
  const section = state.section;
  const page = state.page;
  const spec = SECTIONS[section];
  el('section-title').textContent = spec.title;
  el('section-description').textContent = section === 'convenios' && state.convenioFilter
    ? `Prácticas y datos del convenio ${state.convenioFilter}.`
    : spec.description;
  el('clear-convenio-filter').hidden = !(section === 'convenios' && state.convenioFilter);
  el('section-kicker').textContent = `CONSULTA · ${entityId}`;
  el('records-count').textContent = '…';
  el('records-status').textContent = 'Cargando registros…';
  el('records-content').replaceChildren();
  el('pagination').hidden = true;
  try {
    let query = state.supabase.from(section)
      .select('*', { count: 'exact' })
      .eq('id_entidad', entityId);
    if (section === 'convenios' && state.convenioFilter) query = query.eq('id_convenio', state.convenioFilter);
    // Bandeja principal: NO listar incidencias ya resueltas.
    // No aplicar este filtro al historial dentro de convenios/prácticas.
    if (section === 'incidencias') query = query.eq('resuelta', false);
    const { data, error, count } = await query
      .order(spec.key, { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    if (requestId !== state.requestId) return;
    const rows = data || [];
    const extra = await loadPageRelations(section, rows, entityId);
    if (requestId !== state.requestId || entityId !== state.entity || section !== state.section) return;
    state.pageRelations = extra.relations;
    if (extra.issues.length) {
      el('records-status').textContent = `Aviso: ${extra.issues.join(' · ')}. Algunos indicadores o descargas pueden no mostrarse.`;
    }
    state.count = count ?? rows.length;
    el('records-count').textContent = `${state.count.toLocaleString('es-ES')} registro${state.count === 1 ? '' : 's'}`;
    if (!extra.issues.length) el('records-status').textContent = '';
    if (!rows.length && section === 'incidencias') {
      const vacío = document.createElement('div');
      vacío.className = 'empty-state';
      const titulo = document.createElement('strong');
      titulo.textContent = 'No hay incidencias pendientes de resolver';
      const detalle = document.createElement('span');
      detalle.textContent = 'Las incidencias ya resueltas siguen disponibles dentro de sus convenios y prácticas.';
      vacío.append(titulo, detalle);
      el('records-content').append(vacío);
    } else {
      el('records-content').append(rows.length === 0 ? emptyPanel() : renderTable(rows, section));
    }
    el('pagination').hidden = state.count <= PAGE_SIZE;
    const start = rows.length ? page * PAGE_SIZE + 1 : 0;
    el('pagination-status').textContent = `${start}–${page * PAGE_SIZE + rows.length} de ${state.count}`;
    el('prev-page').disabled = page === 0;
    el('next-page').disabled = (page + 1) * PAGE_SIZE >= state.count;
  } catch (error) {
    if (requestId !== state.requestId) return;
    el('records-status').textContent = '';
    el('records-count').textContent = 'Error';
    el('records-content').replaceChildren(errorPanel(displayError(error)));
  }
}


function clearSearch() {
  state.searchId++;
  el('global-search-button').disabled = false;
  el('global-search-input').value = '';
  el('global-search-scope').value = 'todos';
  el('global-search-status').textContent = '';
  el('global-search-results').hidden = true;
  el('global-search-results').replaceChildren();
}

function setSearchStatus(message) {
  el('global-search-status').textContent = message;
}

async function jumpToConvenio(id, showPractices = false, focusPracticeId = null) {
  state.section = 'convenios';
  state.page = 0;
  state.convenioFilter = id;
  markActiveTab();
  await loadSection();
  el('records-count').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (showPractices) {
    const button = [...document.querySelectorAll('[data-practicas-convenio]')]
      .find((candidate) => candidate.dataset.practicasConvenio === id);
    if (button) {
      if (focusPracticeId) button.dataset.focusPracticeId = String(focusPracticeId);
      button.click();
    }
  }
}

function appendSearchGroup(target, title, rows, section) {
  if (!rows.length) return;
  const heading = document.createElement('h3');
  heading.textContent = `${title} · ${rows.length} resultado${rows.length === 1 ? '' : 's'}`;
  target.append(heading);
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'search-result';
    const main = document.createElement('div');
    main.className = 'search-result-main';
    const text = document.createElement('strong');
    const summary = document.createElement('small');
    if (section === 'convenios') {
      text.textContent = `${row.id_convenio || 'Convenio'} · ${row.nombre_empresa || 'Empresa no indicada'}`;
      summary.textContent = `CIF: ${row.cif_empresa || '—'} · Convenio ${row.id_convenio || '—'}`;
    } else {
      text.textContent = `Práctica ${row.id_practica || '—'}`;
      summary.textContent = `Participante: ${row.persona_usuaria || '—'} · Convenio ${row.id_convenio || '—'} · Inicio ${formatted(row.fecha_inicio)} · Fin ${formatted(row.fecha_fin)}`;
    }
    main.append(text, summary);
    if (alertasRegistro(row, section).length) appendAlerts(main, row, section);
    const actions = document.createElement('div');
    actions.className = 'search-result-actions';
    actions.append(makeButton('Ver detalle', 'btn btn-secondary', () => showDetails(row, section)));
    if (section === 'convenios') {
      actions.append(makeButton('Ver prácticas del convenio', 'btn btn-secondary', () => jumpToConvenio(row.id_convenio, true)));
    } else if (row.id_convenio) {
      actions.append(makeButton('Abrir convenio y práctica', 'btn btn-secondary', () => jumpToConvenio(row.id_convenio, true, row.id_practica)));
    }
    item.append(main, actions);
    target.append(item);
  }
}

// Búsqueda con filtros server-side, paginación limitada y RLS aplicadas por Supabase.
// No se descargan todos los convenios/prácticas al navegador.
async function globalSearch(event) {
  event?.preventDefault();
  const searchText = el('global-search-input').value.trim();
  const scope = el('global-search-scope').value;
  const entityId = state.entity;
  const requestId = ++state.searchId;
  const target = el('global-search-results');
  target.replaceChildren();
  target.hidden = true;
  if (!entityId) return;
  if (searchText.length < 2) {
    setSearchStatus('Introduce al menos dos caracteres para buscar.');
    return;
  }
  el('global-search-button').disabled = true;
  setSearchStatus('Buscando información autorizada…');
  try {
    const pattern = `%${searchText}%`;
    const queries = [];
    if (scope === 'todos' || scope === 'convenios' || scope === 'empresas') {
      const fields = scope === 'convenios' ? ['id_convenio'] : scope === 'empresas' ? ['nombre_empresa', 'cif_empresa'] : ['id_convenio', 'nombre_empresa', 'cif_empresa'];
      for (const field of fields) {
        queries.push({ kind: 'convenios', field, work: state.supabase.from('convenios')
          .select('*').eq('id_entidad', entityId).ilike(field, pattern)
          .order('id_convenio', { ascending: false }).limit(SEARCH_RESULT_LIMIT) });
      }
    }
    if (scope === 'todos' || scope === 'practicas') {
      for (const field of ['id_practica', 'id_convenio', 'persona_usuaria']) {
        queries.push({ kind: 'practicas', field, work: state.supabase.from('practicas')
          .select('*').eq('id_entidad', entityId).ilike(field, pattern)
          .order('id_practica', { ascending: false }).limit(SEARCH_RESULT_LIMIT) });
      }
    }
    const answers = await Promise.all(queries.map((q) => q.work));
    if (requestId !== state.searchId || entityId !== state.entity) return;
    const found = { convenios: new Map(), practicas: new Map() };
    for (let i = 0; i < answers.length; i++) {
      const { data, error } = answers[i];
      if (error) throw error;
      for (const row of data || []) {
        const key = queries[i].kind === 'convenios' ? row.id_convenio : row.id_practica;
        if (key != null) found[queries[i].kind].set(String(key), row);
      }
    }
    const convenios = [...found.convenios.values()].slice(0, SEARCH_RESULT_LIMIT);
    const practicas = [...found.practicas.values()].slice(0, SEARCH_RESULT_LIMIT);
    const total = convenios.length + practicas.length;
    target.hidden = false;
    if (!total) {
      target.append(emptyPanel());
      setSearchStatus('No se encontraron coincidencias en la entidad seleccionada.');
      return;
    }
    appendSearchGroup(target, scope === 'empresas' ? 'Empresas / convenios asociados' : 'Convenios y empresas', convenios, 'convenios');
    appendSearchGroup(target, 'Prácticas y participantes', practicas, 'practicas');
    const limited = answers.some((a) => (a.data || []).length === SEARCH_RESULT_LIMIT);
    setSearchStatus(`${total} coincidencia${total === 1 ? '' : 's'} mostrada${total === 1 ? '' : 's'}.${limited ? ' Resultados limitados: concreta la búsqueda para localizar otros registros.' : ''}`);
  } catch (error) {
    if (requestId !== state.searchId || entityId !== state.entity) return;
    target.hidden = false;
    target.replaceChildren(errorPanel(displayError(error)));
    setSearchStatus('La búsqueda no se ha podido completar.');
  } finally {
    if (requestId === state.searchId) el('global-search-button').disabled = false;
  }
}

function initEvents() {
  el('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = el('login-button');
    const email = el('email').value.trim();
    const password = el('password').value;
    el('login-error').hidden = true;
    button.disabled = true;
    button.textContent = 'Comprobando acceso…';
    try {
      const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.user) throw error || new Error('No se pudo iniciar sesión.');
      await applyUser(data.user);
    } catch (error) {
      // Si no está autorizado, no conservar una sesión que parezca válida en la interfaz.
      if (state.supabase) await state.supabase.auth.signOut({ scope: 'local' });
      showLogin(displayError(error));
    } finally {
      button.disabled = false;
      button.textContent = 'Entrar al portal →';
    }
  });
  el('logout-button').addEventListener('click', async () => {
    el('logout-button').disabled = true;
    try { await state.supabase.auth.signOut(); }
    catch { showMessage('No se pudo cerrar la sesión. Inténtalo de nuevo.', true); }
    finally { el('logout-button').disabled = false; }
    showLogin();
  });
  el('refresh-button').addEventListener('click', async () => {
    if (!state.entity) return;
    showMessage('');
    await Promise.all([loadCounts(), loadSection(), loadNovedades()]);
  });
  el('entity-select').addEventListener('change', async (event) => {
    const next = event.target.value;
    if (!state.entities.some((x) => x.id_entidad === next)) return;
    state.entity = next;
    ++state.novRequestId;
    el('news-panel').hidden = true;
    ++state.detailRequestId;
    if (el('detail-dialog').open) el('detail-dialog').close();
    state.page = 0;
    state.convenioFilter = null;
    clearSearch();
    updateEntityHeading();
    showMessage('');
    await Promise.all([loadCounts(), loadSection(), loadNovedades()]);
  });
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', async () => {
      if (!SECTIONS[button.dataset.tab]) return;
      state.section = button.dataset.tab;
      state.page = 0;
      state.convenioFilter = null;
      markActiveTab();
      await loadSection();
    });
  }
  for (const button of document.querySelectorAll('[data-stat-section]')) {
    button.addEventListener('click', async () => {
      if (!state.entity || !SECTIONS[button.dataset.statSection]) return;
      state.section = button.dataset.statSection;
      state.page = 0;
      state.convenioFilter = null;
      markActiveTab();
      await loadSection();
      el('records-count').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
  el('clear-convenio-filter').addEventListener('click', async () => {
    state.convenioFilter = null;
    state.page = 0;
    await loadSection();
  });
  el('global-search-form').addEventListener('submit', globalSearch);
  el('global-search-clear').addEventListener('click', clearSearch);
  el('prev-page').addEventListener('click', async () => { if (state.page > 0) { state.page--; await loadSection(); } });
  el('next-page').addEventListener('click', async () => { if ((state.page + 1) * PAGE_SIZE < state.count) { state.page++; await loadSection(); } });
  el('close-dialog').addEventListener('click', () => el('detail-dialog').close());
  el('close-dialog-footer').addEventListener('click', () => el('detail-dialog').close());
}

async function start() {
  const logo = el('epes-logo');
  const mark = logo?.closest('.identity-mark');
  if (logo && mark) {
    const loaded = () => { if (logo.naturalWidth > 0) mark.classList.add('has-logo'); };
    logo.addEventListener('load', loaded);
    logo.addEventListener('error', () => mark.classList.remove('has-logo'));
    if (logo.complete) loaded();
  }
  initEvents();
  if (!validateConfig()) {
    el('config-error').hidden = false;
    showLogin();
    el('login-button').disabled = true;
    return;
  }
  state.supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  state.supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') showLogin();
  });
  try {
    const { data, error } = await state.supabase.auth.getUser();
    if (error || !data?.user) return showLogin();
    await applyUser(data.user);
  } catch (error) {
    showLogin(displayError(error));
  }
}

start();
