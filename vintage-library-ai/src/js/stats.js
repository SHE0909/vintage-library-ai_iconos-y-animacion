// =========================================================
// ESTADISTICAS Y GAMIFICACION
// =========================================================
// Funciones puras (sin acceso a datos) que reciben libros /
// actividad / resaltados ya cargados y devuelven numeros o
// estructuras listas para pintar en el dashboard. Mantenerlas
// puras hace que sean faciles de probar y de reusar entre
// el widget de racha, el calendario y los logros.

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgoStr(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

// Un dia "cuenta" si hubo minutos leidos o paginas vistas ese dia.
function activeDaysSet(activity) {
  return new Set(activity.filter((a) => (a.minutes || 0) > 0 || (a.pages || 0) > 0).map((a) => a.date));
}

// Racha actual: dias consecutivos con actividad terminando hoy o ayer
// (si hoy aun no se ha leido, la racha "sigue viva" hasta medianoche).
export function computeStreak(activity) {
  const active = activeDaysSet(activity);
  if (active.size === 0) return { current: 0, longest: 0 };

  let current = 0;
  let cursor = 0;
  if (active.has(daysAgoStr(0))) {
    cursor = 0;
  } else if (active.has(daysAgoStr(1))) {
    cursor = 1;
  } else {
    cursor = -1; // racha rota
  }
  if (cursor >= 0) {
    while (active.has(daysAgoStr(cursor))) {
      current++;
      cursor++;
    }
  }

  // Racha mas larga historica (recorre todas las fechas ordenadas).
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const dateStr of sorted) {
    if (prev) {
      const diffDays = Math.round((new Date(dateStr) - new Date(prev)) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = dateStr;
  }

  return { current, longest: Math.max(longest, current) };
}

export function minutesToday(activity) {
  const today = daysAgoStr(0);
  const entry = activity.find((a) => a.date === today);
  return entry ? entry.minutes : 0;
}

export function minutesThisWeek(activity) {
  const cutoff = daysAgoStr(6);
  return activity.filter((a) => a.date >= cutoff).reduce((sum, a) => sum + (a.minutes || 0), 0);
}

// Datos para un calendario tipo GitHub: ultimas `weeks` semanas,
// cada dia con un "nivel" de 0 a 4 segun minutos leidos.
export function buildActivityCalendar(activity, weeks = 18) {
  const byDate = new Map(activity.map((a) => [a.date, a]));
  const totalDays = weeks * 7;
  const days = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const dateStr = daysAgoStr(i);
    const entry = byDate.get(dateStr);
    const minutes = entry ? entry.minutes : 0;
    let level = 0;
    if (minutes > 0) level = 1;
    if (minutes >= 15) level = 2;
    if (minutes >= 30) level = 3;
    if (minutes >= 60) level = 4;
    days.push({ date: dateStr, minutes, level });
  }
  return days;
}

export function avgPagesPerDay(activity) {
  const activeDays = activity.filter((a) => (a.pages || 0) > 0);
  if (activeDays.length === 0) return 0;
  const totalPages = activeDays.reduce((sum, a) => sum + a.pages, 0);
  return Math.round((totalPages / activeDays.length) * 10) / 10;
}

// Categoria/genero con mas libros (favorita "de facto").
export function favoriteCategory(books) {
  const counts = {};
  books.forEach((b) => { counts[b.category || 'General'] = (counts[b.category || 'General'] || 0) + 1; });
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0], count: entries[0][1] };
}

// Autor con mas libros en la biblioteca.
export function favoriteAuthor(books) {
  const counts = {};
  books.forEach((b) => {
    const a = (b.author || '').trim();
    if (!a) return;
    counts[a] = (counts[a] || 0) + 1;
  });
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0], count: entries[0][1] };
}

// Libro con mas resaltados/notas (todos los kinds).
export function mostHighlightedBook(highlightsByBook, books) {
  let best = null;
  for (const [bookId, count] of Object.entries(highlightsByBook)) {
    if (!best || count > best.count) {
      const book = books.find((b) => b.id === bookId);
      if (book) best = { book, count };
    }
  }
  return best;
}

// Libros terminados en el año en curso (requiere que finishedAt este
// seteado al marcar el libro como terminado).
export function booksFinishedThisYear(books) {
  const year = new Date().getFullYear();
  return books.filter((b) => b.finished && b.finishedAt && new Date(b.finishedAt).getFullYear() === year).length;
}

// Lista de logros: cada uno con id, etiqueta, icono sugerido y si esta
// desbloqueado, para pintar insignias en el dashboard.
export function computeAchievements({ books, favoritesCount, notesCount, streak }) {
  const finishedCount = books.filter((b) => b.finished).length;
  return [
    { id: 'first-book', label: 'Primer libro terminado', icon: 'checkCircle', unlocked: finishedCount >= 1 },
    { id: 'five-books', label: '5 libros terminados', icon: 'checkCircle', unlocked: finishedCount >= 5 },
    { id: 'ten-phrases', label: '10 frases guardadas', icon: 'starFilled', unlocked: favoritesCount >= 10 },
    { id: 'first-note', label: 'Primera nota escrita', icon: 'edit', unlocked: notesCount >= 1 },
    { id: 'streak-7', label: 'Racha de 7 dias', icon: 'leaf', unlocked: streak.longest >= 7 },
    { id: 'streak-30', label: 'Racha de 30 dias', icon: 'leaf', unlocked: streak.longest >= 30 }
  ];
}
