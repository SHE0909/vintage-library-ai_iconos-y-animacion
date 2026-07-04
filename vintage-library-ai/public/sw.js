// Service worker minimo para que Vintage Library sea instalable (PWA) y
// pueda volver a abrirse sin conexion (al menos la interfaz).
// Estrategia: "network first, cache fallback" solo para peticiones GET del
// mismo origen. No tocamos peticiones a Supabase, fuentes de Google ni
// peticiones con rango (usadas al leer archivos PDF grandes), para no
// romper nada de eso.

const CACHE_NAME = 'vintage-library-shell-v1';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // si algo falla (ej. sin red al instalar), no rompe la instalacion
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return; // no interferir con streaming de PDFs
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no tocar Supabase, fuentes, etc.

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
