// =========================================================
// CAPA DE DATOS
// =========================================================
// Punto unico de acceso a datos para toda la app.
// Elige el adaptador segun BACKEND en config.js sin que el
// resto del codigo (paginas, componentes) sepa cual esta activo.
import { BACKEND } from './config.js';
import * as localAdapter from './adapters/localAdapter.js';

let adapter = localAdapter;

if (BACKEND === 'supabase') {
  // import dinamico: evita cargar el SDK de Supabase si no se usa
  const supabaseAdapter = await import('./adapters/supabaseAdapter.js');
  adapter = supabaseAdapter;
}

export const {
  signUp, signIn, signOut, onAuthChange, getCurrentUser,
  addBook, listBooks, getBook, updateBook, deleteBook, getBookFile,
  listCategories, addCategory, deleteCategory, setBookCover, getBookCover,
  addHighlight, listHighlights, deleteHighlight, updateHighlight, listFavoriteHighlights,
  restoreHighlight,
  recordReadingActivity, listReadingActivity, getReadingGoal, setReadingGoal
} = adapter;
