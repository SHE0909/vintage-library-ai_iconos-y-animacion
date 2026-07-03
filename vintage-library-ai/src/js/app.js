import { onAuthChange } from './data.js';
import { renderAuthPage } from './pages/auth.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderReader } from './pages/reader.js';

const root = document.getElementById('app');
let currentUser = null;

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
