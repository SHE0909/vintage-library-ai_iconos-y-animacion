import { onAuthChange } from './data.js';
import { renderAuthPage } from './pages/auth.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderReader } from './pages/reader.js';
import { mountRosePetals } from './rosePetals.js';
import { icon } from './icons.js';
import { el } from './utils.js';

const root = document.getElementById('app');
let currentUser = null;

// Fondo ambiental de petalos de rosa: se monta una sola vez, fuera de #app,
// para que sobreviva a los cambios de pantalla.
mountRosePetals();

// ---------------------------------------------------------
// PWA: registrar el service worker y ofrecer instalar la app
// ---------------------------------------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

let deferredInstallPrompt = null;
const installBtn = el('button', { class: 'pwa-install-btn', type: 'button', title: 'Instalar Vintage Library' }, [
  icon('download', { size: 15 }), el('span', {}, 'Instalar app')
]);
installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  installBtn.classList.remove('visible');
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => {});
  deferredInstallPrompt = null;
});
document.body.appendChild(installBtn);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.classList.add('visible');
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installBtn.classList.remove('visible');
});

function navigate(hash) {
  if (location.hash === hash) { route(); } else { location.hash = hash; }
}

function route() {
  const hash = location.hash || '#/login';

  if (!currentUser && !hash.startsWith('#/login') && !hash.startsWith('#/register')) {
    location.hash = '#/login';
    return;
  }
  if (currentUser && (hash.startsWith('#/login') || hash.startsWith('#/register') || hash === '#/')) {
    location.hash = '#/dashboard';
    return;
  }

  if (hash.startsWith('#/login')) return renderAuthPage(root, { mode: 'login', navigate });
  if (hash.startsWith('#/register')) return renderAuthPage(root, { mode: 'register', navigate });
  if (hash.startsWith('#/dashboard')) return renderDashboard(root, { navigate });
  if (hash.startsWith('#/read/')) {
    const rest = hash.replace('#/read/', '').split('/');
    const bookId = rest[0];
    const initialPage = rest[1] ? parseInt(rest[1], 10) : null;
    return renderReader(root, { bookId, initialPage, navigate });
  }
  return renderAuthPage(root, { mode: 'login', navigate });
}

window.addEventListener('hashchange', route);

onAuthChange((user) => {
  currentUser = user;
  route();
});
