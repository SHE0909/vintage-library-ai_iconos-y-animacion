// =========================================================
// ADAPTADOR SUPABASE
// =========================================================
// Implementa la misma interfaz que localAdapter.js para que
// app.js pueda usar cualquiera de los dos sin cambiar codigo.
//
// Usa Supabase para todo: Auth + Database (Postgres) + Storage.
//
// Requiere:
//   1. Completar src/js/supabaseConfig.js con tus credenciales
//   2. npm install
//   3. Poner BACKEND = 'supabase' en src/js/config.js
//   4. Crear las tablas/columnas y buckets (ver SETUP_SUPABASE.md)

import { supabase } from '../supabaseConfig.js';

function publicUser(sbUser) {
  if (!sbUser) return null;
  return {
    id: sbUser.id,
    name: sbUser.user_metadata?.name || '',
    email: sbUser.email
  };
}

// ---------------- AUTH ----------------
export async function signUp({ name, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });
  if (error) throw error;
  return publicUser(data.user);
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return publicUser(data.user);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  // Dispara con el estado actual de inmediato
  supabase.auth.getSession().then(({ data }) => {
    callback(publicUser(data.session?.user));
  });
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(publicUser(session?.user));
  });
  return () => sub.subscription.unsubscribe();
}

let cachedUser = null;
supabase.auth.getSession().then(({ data }) => { cachedUser = data.session?.user || null; });
supabase.auth.onAuthStateChange((_event, session) => { cachedUser = session?.user || null; });

export function getCurrentUser() {
  return publicUser(cachedUser);
}

// ---------------- STORAGE ----------------
async function uploadFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
}

async function downloadFile(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) return null;
  return data; // Blob
}

async function removeFile(bucket, path) {
  await supabase.storage.from(bucket).remove([path]);
}

// ---------------- BOOKS ----------------
export async function addBook({ title, author, category, file, coverImage, coverPreset }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Debes iniciar sesion.');
  const spineColors = ['#5C3A21', '#6B2737', '#7C8B6F', '#3B2413', '#B08A4E'];
  const bookData = {
    owner_id: currentUser.id,
    title: title || 'Sin titulo',
    author: author || 'Autor desconocido',
    category: category || 'General',
    added_at: new Date().toISOString(),
    progress_page: 0,
    bookmark_page: null,
    total_pages: null,
    rating: 0,
    spine_color: spineColors[Math.floor(Math.random() * spineColors.length)],
    file_name: file ? file.name : null,
    has_cover: !!coverImage,
    cover_preset: coverImage ? null : (coverPreset || null),
    archived: false,
    finished: false
  };

  const { data, error } = await supabase.from('books').insert(bookData).select().single();
  if (error) throw error;

  if (file) {
    await uploadFile('books', `${currentUser.id}/${data.id}`, file);
  }
  if (coverImage) {
    await uploadFile('covers', `${currentUser.id}/${data.id}`, coverImage);
  }
  await addCategory(currentUser.id, bookData.category);
  return mapBook(data);
}

export async function setBookCover(bookId, coverImage) {
  const currentUser = getCurrentUser();
  await uploadFile('covers', `${currentUser.id}/${bookId}`, coverImage);
  return updateBook(bookId, { hasCover: true, coverPreset: null });
}

export async function getBookCover(bookId) {
  const currentUser = getCurrentUser();
  return await downloadFile('covers', `${currentUser.id}/${bookId}`);
}

export async function listBooks(userId) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('owner_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data.map(mapBook);
}

export async function getBook(bookId) {
  const { data, error } = await supabase.from('books').select('*').eq('id', bookId).maybeSingle();
  if (error) throw error;
  return data ? mapBook(data) : null;
}

export async function updateBook(bookId, patch) {
  const dbPatch = toDbBook(patch);
  const { data, error } = await supabase.from('books').update(dbPatch).eq('id', bookId).select().single();
  if (error) throw error;
  return mapBook(data);
}

export async function deleteBook(bookId) {
  const currentUser = getCurrentUser();
  const { error } = await supabase.from('books').delete().eq('id', bookId);
  if (error) throw error;
  await removeFile('books', `${currentUser.id}/${bookId}`);
  await removeFile('covers', `${currentUser.id}/${bookId}`);
}

export async function getBookFile(bookId) {
  const currentUser = getCurrentUser();
  return await downloadFile('books', `${currentUser.id}/${bookId}`);
}

// Convierte entre nombres de columnas snake_case (Postgres) y camelCase (resto de la app)
function mapBook(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    author: row.author,
    category: row.category,
    addedAt: row.added_at,
    progressPage: row.progress_page,
    bookmarkPage: row.bookmark_page,
    totalPages: row.total_pages,
    rating: row.rating,
    spineColor: row.spine_color,
    fileName: row.file_name,
    hasCover: row.has_cover,
    coverPreset: row.cover_preset,
    archived: row.archived,
    finished: row.finished
  };
}

function toDbBook(patch) {
  const map = {
    ownerId: 'owner_id', addedAt: 'added_at', progressPage: 'progress_page',
    bookmarkPage: 'bookmark_page', totalPages: 'total_pages', spineColor: 'spine_color',
    fileName: 'file_name', hasCover: 'has_cover', coverPreset: 'cover_preset'
  };
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    out[map[key] || key] = value;
  }
  return out;
}

// ---------------- CATEGORIAS ----------------
export async function listCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('list')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.list || [];
}

export async function addCategory(userId, name) {
  if (!name) return listCategories(userId);
  const list = await listCategories(userId);
  if (!list.includes(name)) list.push(name);
  const { error } = await supabase
    .from('categories')
    .upsert({ user_id: userId, list }, { onConflict: 'user_id' });
  if (error) throw error;
  return list;
}

export async function deleteCategory(userId, name) {
  const list = (await listCategories(userId)).filter((c) => c !== name);
  const { error } = await supabase
    .from('categories')
    .upsert({ user_id: userId, list }, { onConflict: 'user_id' });
  if (error) throw error;
  // Los libros que estaban en esa categoria pasan a "General"
  await supabase.from('books').update({ category: 'General' }).eq('owner_id', userId).eq('category', name);
  return list;
}

// ---------------- RESALTADOS (highlights) ----------------
export async function addHighlight({ bookId, page, color, rects, text, kind, style, isFavorite }) {
  const currentUser = getCurrentUser();
  const data = {
    book_id: bookId,
    owner_id: currentUser?.id || null,
    page,
    color: color || '#D4AF6A',
    style: style || 'fill',
    kind: kind || 'highlight',
    is_favorite: !!isFavorite,
    rects: rects || [],
    text: text || '',
    created_at: new Date().toISOString()
  };
  const { data: row, error } = await supabase.from('highlights').insert(data).select().single();
  if (error) throw error;
  return mapHighlight(row);
}

export async function listHighlights(bookId) {
  const { data, error } = await supabase.from('highlights').select('*').eq('book_id', bookId);
  if (error) throw error;
  return data.map(mapHighlight);
}

export async function updateHighlight(highlightId, patch) {
  const map = { isFavorite: 'is_favorite' };
  const dbPatch = {};
  for (const [key, value] of Object.entries(patch)) dbPatch[map[key] || key] = value;
  const { data, error } = await supabase.from('highlights').update(dbPatch).eq('id', highlightId).select().single();
  if (error) throw error;
  return mapHighlight(data);
}

export async function listFavoriteHighlights(userId) {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_favorite', true)
    .eq('kind', 'highlight')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapHighlight);
}

export async function deleteHighlight(highlightId) {
  const { error } = await supabase.from('highlights').delete().eq('id', highlightId);
  if (error) throw error;
}

function mapHighlight(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    ownerId: row.owner_id,
    page: row.page,
    color: row.color,
    style: row.style,
    kind: row.kind,
    isFavorite: row.is_favorite,
    rects: row.rects,
    text: row.text,
    createdAt: row.created_at
  };
}
