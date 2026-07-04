// =========================================================
// ADAPTADOR LOCAL (modo demo)
// =========================================================
// Implementa la misma interfaz que supabaseAdapter.js:
//   signUp, signIn, signOut, onAuthChange, getCurrentUser,
//   addBook, listBooks, updateBook, deleteBook, getBookFile,
//   listCategories, addCategory, deleteCategory,
//   setBookCover, getBookCover,
//   addHighlight, listHighlights, deleteHighlight,
//   updateHighlight, listFavoriteHighlights
//
// Metadatos de libros y usuarios -> localStorage (simple, sincrono)
// Archivos PDF (binarios)        -> IndexedDB (localStorage no
//                                    soporta bien blobs grandes)
//
// Este adaptador NO valida contrasenas de forma segura: es solo
// para desarrollar y hacer la demo sin depender de un backend.

const LS_USERS = 'vl_users';
const LS_BOOKS = 'vl_books';
const LS_SESSION = 'vl_session';
const LS_CATEGORIES = 'vl_categories';
const LS_HIGHLIGHTS = 'vl_highlights';

let authListeners = [];

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- IndexedDB minimo para guardar los archivos PDF ----
const DB_NAME = 'vintage_library_files';
const STORE = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emitAuthChange(user) {
  authListeners.forEach((cb) => cb(user));
}

// ---------------- AUTH ----------------
export async function signUp({ name, email, password }) {
  const users = readLS(LS_USERS, []);
  if (users.some((u) => u.email === email)) {
    throw new Error('Ya existe una cuenta con ese correo.');
  }
  const user = {
    id: uid('user'),
    name,
    email,
    password, // demo only: nunca hagas esto en produccion
    avatarColor: ['#5C3A21', '#6B2737', '#7C8B6F', '#B08A4E'][Math.floor(Math.random() * 4)],
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeLS(LS_USERS, users);
  writeLS(LS_SESSION, { userId: user.id });
  emitAuthChange(publicUser(user));
  return publicUser(user);
}

export async function signIn({ email, password }) {
  const users = readLS(LS_USERS, []);
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) throw new Error('Correo o contrasena incorrectos.');
  writeLS(LS_SESSION, { userId: user.id });
  emitAuthChange(publicUser(user));
  return publicUser(user);
}

export async function signOut() {
  localStorage.removeItem(LS_SESSION);
  emitAuthChange(null);
}

export function onAuthChange(callback) {
  authListeners.push(callback);
  callback(getCurrentUser());
  return () => { authListeners = authListeners.filter((cb) => cb !== callback); };
}

export function getCurrentUser() {
  const session = readLS(LS_SESSION, null);
  if (!session) return null;
  const users = readLS(LS_USERS, []);
  const user = users.find((u) => u.id === session.userId);
  return user ? publicUser(user) : null;
}

function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// ---------------- BOOKS ----------------
export async function addBook({ title, author, category, file, coverImage, coverPreset }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Debes iniciar sesion.');
  const books = readLS(LS_BOOKS, []);
  const spineColors = ['#5C3A21', '#6B2737', '#7C8B6F', '#3B2413', '#B08A4E'];
  const book = {
    id: uid('book'),
    ownerId: currentUser.id,
    title: title || 'Sin titulo',
    author: author || 'Autor desconocido',
    category: category || 'General',
    addedAt: new Date().toISOString(),
    progressPage: 0,
    bookmarkPage: null,
    totalPages: null,
    rating: 0,
    spineColor: spineColors[Math.floor(Math.random() * spineColors.length)],
    fileName: file ? file.name : null,
    hasCover: !!coverImage,
    coverPreset: coverImage ? null : (coverPreset || null),
    archived: false,
    finished: false
  };
  if (file) {
    await idbPut(book.id, file);
  }
  if (coverImage) {
    await idbPut(`cover_${book.id}`, coverImage);
  }
  books.push(book);
  writeLS(LS_BOOKS, books);
  await addCategory(currentUser.id, book.category);
  return book;
}

export async function setBookCover(bookId, coverImage) {
  await idbPut(`cover_${bookId}`, coverImage);
  return updateBook(bookId, { hasCover: true, coverPreset: null });
}

export async function getBookCover(bookId) {
  const blob = await idbGet(`cover_${bookId}`);
  return blob || null;
}

export async function listBooks(userId) {
  const books = readLS(LS_BOOKS, []);
  return books.filter((b) => b.ownerId === userId).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
}

export async function getBook(bookId) {
  return readLS(LS_BOOKS, []).find((b) => b.id === bookId) || null;
}

export async function updateBook(bookId, patch) {
  const books = readLS(LS_BOOKS, []);
  const idx = books.findIndex((b) => b.id === bookId);
  if (idx === -1) throw new Error('Libro no encontrado.');
  books[idx] = { ...books[idx], ...patch };
  writeLS(LS_BOOKS, books);
  return books[idx];
}

export async function deleteBook(bookId) {
  const books = readLS(LS_BOOKS, []).filter((b) => b.id !== bookId);
  writeLS(LS_BOOKS, books);
  await idbDelete(bookId);
  await idbDelete(`cover_${bookId}`);
  const highlights = readLS(LS_HIGHLIGHTS, []).filter((h) => h.bookId !== bookId);
  writeLS(LS_HIGHLIGHTS, highlights);
}

export async function getBookFile(bookId) {
  const blob = await idbGet(bookId);
  if (!blob) throw new Error('Archivo no encontrado.');
  return blob;
}

// ---------------- CATEGORIAS ----------------
export async function listCategories(userId) {
  const all = readLS(LS_CATEGORIES, {});
  return all[userId] || [];
}

export async function addCategory(userId, name) {
  if (!name) return listCategories(userId);
  const all = readLS(LS_CATEGORIES, {});
  const list = all[userId] || [];
  if (!list.includes(name)) list.push(name);
  all[userId] = list;
  writeLS(LS_CATEGORIES, all);
  return list;
}

export async function deleteCategory(userId, name) {
  const all = readLS(LS_CATEGORIES, {});
  const list = (all[userId] || []).filter((c) => c !== name);
  all[userId] = list;
  writeLS(LS_CATEGORIES, all);
  // Los libros que estaban en esa categoria pasan a "General"
  const books = readLS(LS_BOOKS, []);
  let changed = false;
  books.forEach((b) => {
    if (b.ownerId === userId && b.category === name) { b.category = 'General'; changed = true; }
  });
  if (changed) writeLS(LS_BOOKS, books);
  return list;
}

// ---------------- RESALTADOS (highlights) y trazos de dibujo ----------------
export async function addHighlight({ bookId, page, color, rects, text, kind, style, isFavorite, points, strokeWidth }) {
  const currentUser = getCurrentUser();
  const highlights = readLS(LS_HIGHLIGHTS, []);
  const highlight = {
    id: uid('hl'),
    bookId,
    ownerId: currentUser?.id || null,
    page,
    color: color || '#D4AF6A',
    style: style || 'fill',
    kind: kind || 'highlight',
    isFavorite: !!isFavorite,
    rects: rects || [],
    points: points || null,
    strokeWidth: strokeWidth || null,
    text: text || '',
    createdAt: new Date().toISOString()
  };
  highlights.push(highlight);
  writeLS(LS_HIGHLIGHTS, highlights);
  return highlight;
}

// Vuelve a insertar un resaltado/trazo que se habia eliminado (usado por
// deshacer/rehacer), conservando su id e info original en vez de crear uno
// nuevo, para que el historial de acciones se pueda referenciar de ida y vuelta.
export async function restoreHighlight(record) {
  const highlights = readLS(LS_HIGHLIGHTS, []);
  if (!highlights.some((h) => h.id === record.id)) {
    highlights.push(record);
    writeLS(LS_HIGHLIGHTS, highlights);
  }
  return record;
}

export async function listHighlights(bookId) {
  return readLS(LS_HIGHLIGHTS, []).filter((h) => h.bookId === bookId);
}

export async function updateHighlight(highlightId, patch) {
  const highlights = readLS(LS_HIGHLIGHTS, []);
  const idx = highlights.findIndex((h) => h.id === highlightId);
  if (idx === -1) throw new Error('Resaltado no encontrado.');
  highlights[idx] = { ...highlights[idx], ...patch };
  writeLS(LS_HIGHLIGHTS, highlights);
  return highlights[idx];
}

export async function listFavoriteHighlights(userId) {
  return readLS(LS_HIGHLIGHTS, [])
    .filter((h) => h.ownerId === userId && h.isFavorite && h.kind === 'highlight')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function deleteHighlight(highlightId) {
  const highlights = readLS(LS_HIGHLIGHTS, []).filter((h) => h.id !== highlightId);
  writeLS(LS_HIGHLIGHTS, highlights);
}
