import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// Flujo de invitación y recuperación. Solo usa la clave pública y la sesión propia del usuario.
const el = (id) => document.getElementById(id);
const form = el('recovery-form');
const status = el('recovery-status');
const description = el('recovery-description');
const button = el('save-password');
const title = el('recovery-title');
const query = new URLSearchParams(location.search);
const type = query.get('tipo');
const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
const hasAuthLink = Boolean(query.get('code') || query.get('token_hash') || hash.get('access_token'));
let supabase = null;
let authorizedSession = false;

function say(message, error = false) {
  status.textContent = message;
  status.classList.toggle('form-error', error);
}
function publicKeyIsSafe() {
  if (!SUPABASE_URL?.startsWith('https://') || !SUPABASE_PUBLISHABLE_KEY?.trim()) return false;
  const key = SUPABASE_PUBLISHABLE_KEY.trim();
  if (key.startsWith('sb_secret_') || key.toLowerCase().includes('service_role')) return false;
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role === 'service_role') return false;
    } catch { return false; }
  }
  return true;
}
async function init() {
  if (!publicKeyIsSafe()) {
    description.textContent = 'La configuración de acceso no es válida. Contacta con la administración.';
    return;
  }
  title.textContent = type === 'recuperacion' ? 'Recuperar contraseña' : 'Establecer contraseña';
  if (!hasAuthLink) {
    description.textContent = 'Abre esta página desde el enlace recibido en tu correo electrónico. Si el enlace ha caducado, solicita otro.';
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  try {
    // getUser valida la sesión con Supabase, no basta con leer el almacenamiento local.
    // Supabase JS procesa automáticamente los enlaces de invitación/recuperación al inicializarse.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      description.textContent = 'El enlace no es válido o ha caducado. Solicita otro enlace de acceso.';
      return;
    }
    authorizedSession = true;
    description.textContent = 'Establece una contraseña personal de al menos 12 caracteres.';
    form.hidden = false;
  } catch {
    description.textContent = 'No se ha podido verificar el enlace. Vuelve a solicitarlo.';
  }
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!authorizedSession || !supabase) return;
  const password = el('new-password').value;
  const confirmation = el('confirm-password').value;
  if (password.length < 12) return say('La contraseña debe tener al menos 12 caracteres.', true);
  if (password !== confirmation) return say('Las contraseñas no coinciden.', true);
  button.disabled = true;
  say('Guardando la nueva contraseña…');
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    form.hidden = true;
    description.textContent = 'La contraseña se ha establecido correctamente.';
    say('Ya puedes acceder al Portal EPES con tu cuenta.');
    // Retirar de la barra de direcciones cualquier código o fragmento de recuperación.
    history.replaceState(null, '', new URL('./establecer-clave.html', location.href).pathname);
  } catch (error) {
    say(error?.message || 'No ha sido posible guardar la contraseña.', true);
  } finally { button.disabled = false; }
});
init();
