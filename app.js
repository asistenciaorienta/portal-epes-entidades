import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// V1 de consulta: sin APIs propias, sin credenciales privilegiadas y sin escrituras de datos.
const PAGE_SIZE = 20;
const SECTIONS = {
  convenios: {
    title: 'Convenios', description: 'Convenios de la entidad publicados en EPES.', key: 'id_convenio',
    columns: ['id_convenio', 'nombre_empresa', 'cif_empresa', 'firma_delegado', 'fecha_extincion', 'errores_activos']
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
    title: 'Incidencias', description: 'Incidencias registradas. Consulta sin posibilidad de modificación.', key: 'id_incidencia',
    columns: ['id_incidencia', 'id_origen', 'id_convenio', 'id_practica', 'tipo_origen', 'descripcion']
  },
  documentos: {
    title: 'Documentos firmados', description: 'Documentación disponible para descarga autenticada desde un bucket privado.', key: 'clave_documento',
    columns: ['clave_documento', 'nombre_archivo', 'id_convenio', 'fecha_publicacion']
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
  id_acreditacion: 'Acreditación', id_convocatoria: 'Convocatoria', id_practica_origen: 'Práctica origen'
};

const el = (id) => document.getElementById(id);
const state = { supabase: null, user: null, entities: [], entity: null, section: 'convenios', page: 0, requestId: 0, count: 0 };

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
  el('dashboard-view').hidden = true;
  el('login-view').hidden = false;
  el('login-error').hidden = !message;
  el('login-error').textContent = message;
  if (!message) el('password').value = '';
}
function showDashboard() {
  el('login-view').hidden = true;
  el('dashboard-view').hidden = false;
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
  el('welcome-line').textContent = `${profile.nombre || profile.email || user.email || 'Usuario autorizado'} · Consulta de información EPES Granada`;
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
  updateEntityHeading();
  markActiveTab();
  showDashboard();
  showMessage('');
  await Promise.all([loadCounts(), loadSection()]);
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
}

async function loadCounts() {
  const entityId = state.entity;
  const metrics = ['convenios', 'adendas', 'practicas', 'incidencias', 'documentos'];
  for (const section of metrics) el(`count-${section}`).textContent = '…';
  const results = await Promise.allSettled(metrics.map(async (name) => {
    const { count, error } = await state.supabase.from(name)
      .select('*', { count: 'exact', head: true }).eq('id_entidad', entityId);
    if (error || count === null) throw error || new Error('No se pudo obtener el recuento.');
    return count;
  }));
  if (state.entity !== entityId || !state.user) return;
  let failed = false;
  for (let i = 0; i < metrics.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') el(`count-${metrics[i]}`).textContent = result.value.toLocaleString('es-ES');
    else { failed = true; el(`count-${metrics[i]}`).textContent = '—'; }
  }
  if (failed) showMessage('No se han podido cargar todos los contadores. Comprueba tu conexión o tus permisos.', true);
}

function columnsFor(rows, section) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]).filter((x) => x !== 'id_entidad' && x !== 'fecha_actualizacion' && x !== 'storage_bucket' && x !== 'storage_path');
  const preferred = SECTIONS[section].columns.filter((x) => keys.includes(x));
  return [...preferred, ...keys.filter((x) => !preferred.includes(x))].slice(0, 7);
}
function showDetails(row, section) {
  el('detail-title').textContent = `${SECTIONS[section].title} · ${formatted(row[SECTIONS[section].key])}`;
  const list = el('detail-content');
  list.replaceChildren();
  for (const [key, value] of Object.entries(row)) {
    if (key === 'storage_bucket' || key === 'storage_path') continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'detail-row';
    const label = document.createElement('dt');
    label.textContent = niceLabel(key);
    const val = document.createElement('dd');
    val.textContent = formatted(value);
    wrapper.append(label, val);
    list.append(wrapper);
  }
  el('detail-dialog').showModal();
}
function renderTable(rows, section) {
  const columns = columnsFor(rows, section);
  const wrapper = document.createElement('div');
  wrapper.className = 'data-wrap';
  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const headingRow = document.createElement('tr');
  for (const key of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = niceLabel(key);
    headingRow.append(th);
  }
  const actionsHead = document.createElement('th');
  actionsHead.scope = 'col';
  actionsHead.textContent = 'Detalle';
  headingRow.append(actionsHead);
  thead.append(headingRow);
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const key of columns) {
      const td = document.createElement('td');
      td.className = 'cell-short';
      td.textContent = cellText(row[key]);
      td.title = formatted(row[key]);
      tr.append(td);
    }
    const action = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-action';
    button.textContent = 'Ver detalle';
    button.addEventListener('click', () => showDetails(row, section));
    action.append(button);
    tr.append(action);
    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}
function safeDownloadName(name) {
  const plain = String(name || 'documento.pdf').split('/').pop().replace(/[\\:*?"<>|\x00-\x1f]/g, '_');
  return (plain || 'documento.pdf').slice(0, 160);
}
async function downloadDocument(row, button) {
  // Verificaciones preventivas de cliente. La verdadera autorización es RLS Storage.
  if (row.id_entidad !== state.entity || row.storage_bucket !== 'epes-documentos' ||
      !row.storage_path?.startsWith(`${state.entity}/`)) {
    showMessage('Este documento no corresponde a la entidad seleccionada.', true);
    return;
  }
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Descargando…';
  try {
    const { data, error } = await state.supabase.storage.from(row.storage_bucket).download(row.storage_path);
    if (error || !data) throw error || new Error('No se pudo descargar el documento.');
    const objectUrl = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = safeDownloadName(row.nombre_archivo || row.clave_documento + '.pdf');
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    showMessage('Descarga iniciada correctamente.');
  } catch (error) {
    showMessage(`No se pudo descargar el PDF: ${displayError(error)}`, true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}
function renderDocuments(rows) {
  const container = document.createElement('div');
  container.className = 'document-list';
  for (const row of rows) {
    const item = document.createElement('article');
    item.className = 'document-item';
    const icon = document.createElement('div');
    icon.className = 'pdf-icon';
    icon.textContent = 'PDF';
    const main = document.createElement('div');
    main.className = 'doc-main';
    const title = document.createElement('strong');
    title.textContent = row.nombre_archivo || row.clave_documento || 'Documento firmado';
    const note = document.createElement('small');
    note.textContent = `${row.tipo_documento || row.clave_documento || 'Documento'} · Convenio ${row.id_convenio || '—'}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.textContent = 'Descargar PDF';
    button.addEventListener('click', () => downloadDocument(row, button));
    main.append(title, note, button);
    item.append(icon, main);
    container.append(item);
  }
  return container;
}

async function loadSection() {
  const requestId = ++state.requestId;
  const entityId = state.entity;
  const section = state.section;
  const page = state.page;
  const spec = SECTIONS[section];
  el('section-title').textContent = spec.title;
  el('section-description').textContent = spec.description;
  el('section-kicker').textContent = `CONSULTA · ${entityId}`;
  el('records-count').textContent = '…';
  el('records-status').textContent = 'Cargando registros…';
  el('records-content').replaceChildren();
  el('pagination').hidden = true;
  try {
    const { data, error, count } = await state.supabase.from(section)
      .select('*', { count: 'exact' })
      .eq('id_entidad', entityId)
      .order(spec.key, { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    if (requestId !== state.requestId) return;
    const rows = data || [];
    state.count = count ?? rows.length;
    el('records-count').textContent = `${state.count.toLocaleString('es-ES')} registro${state.count === 1 ? '' : 's'}`;
    el('records-status').textContent = '';
    el('records-content').append(rows.length === 0 ? emptyPanel() :
      section === 'documentos' ? renderDocuments(rows) : renderTable(rows, section));
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
    await Promise.all([loadCounts(), loadSection()]);
  });
  el('entity-select').addEventListener('change', async (event) => {
    const next = event.target.value;
    if (!state.entities.some((x) => x.id_entidad === next)) return;
    state.entity = next;
    state.page = 0;
    updateEntityHeading();
    showMessage('');
    await Promise.all([loadCounts(), loadSection()]);
  });
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', async () => {
      if (!SECTIONS[button.dataset.tab]) return;
      state.section = button.dataset.tab;
      state.page = 0;
      markActiveTab();
      await loadSection();
    });
  }
  el('prev-page').addEventListener('click', async () => { if (state.page > 0) { state.page--; await loadSection(); } });
  el('next-page').addEventListener('click', async () => { if ((state.page + 1) * PAGE_SIZE < state.count) { state.page++; await loadSection(); } });
  el('close-dialog').addEventListener('click', () => el('detail-dialog').close());
  el('close-dialog-footer').addEventListener('click', () => el('detail-dialog').close());
}

async function start() {
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
