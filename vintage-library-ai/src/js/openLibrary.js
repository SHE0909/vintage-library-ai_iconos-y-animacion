// =========================================================
// OPEN LIBRARY — autocompletado de metadatos
// =========================================================
// API publica y gratuita (sin API key) de openlibrary.org.
// Se usa para sugerir titulo, autor y portada al agregar un
// libro, para no tener que escribir todo a mano.
// Docs: https://openlibrary.org/dev/docs/api/search

const SEARCH_URL = 'https://openlibrary.org/search.json';
const COVER_URL = 'https://covers.openlibrary.org/b/id';

export async function searchBooks(query, limit = 6) {
  if (!query || !query.trim()) return [];
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query.trim())}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('No se pudo buscar en Open Library.');
  const data = await res.json();
  return (data.docs || []).map((d) => ({
    key: d.key,
    title: d.title || 'Sin titulo',
    author: (d.author_name && d.author_name[0]) || 'Autor desconocido',
    year: d.first_publish_year || null,
    coverId: d.cover_i || null,
    coverUrl: d.cover_i ? `${COVER_URL}/${d.cover_i}-M.jpg` : null,
    coverUrlLarge: d.cover_i ? `${COVER_URL}/${d.cover_i}-L.jpg` : null
  }));
}

// Descarga la portada como Blob (para usarla igual que una imagen subida
// por el usuario). Puede fallar si Open Library no tiene la imagen; en
// ese caso el llamador simplemente sigue sin portada.
export async function fetchCoverBlob(coverUrlLarge) {
  if (!coverUrlLarge) return null;
  try {
    const res = await fetch(coverUrlLarge);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size < 200) return null; // Open Library devuelve un pixel gris si no hay portada
    return blob;
  } catch {
    return null;
  }
}
