import {
  listBooks, addBook, updateBook, deleteBook, signOut, getCurrentUser,
  listCategories, addCategory, deleteCategory, getBookCover, setBookCover,
  listFavoriteHighlights, getBookFile, listHighlights,
  listReadingActivity, getReadingGoal, setReadingGoal
} from '../data.js';
import { el, showToast, showMenu, iconBtn } from '../utils.js';
import { icon } from '../icons.js';
import { COVER_PRESETS, getCoverPreset } from '../coverPresets.js';
import { generatePdfCoverThumbnail } from '../pdfThumbnail.js';
import { BG_THEMES, getStoredTheme, applyTheme } from '../theme.js';
import { searchBooks as searchOpenLibrary, fetchCoverBlob } from '../openLibrary.js';
import {
  computeStreak, minutesToday, minutesThisWeek, buildActivityCalendar,
  avgPagesPerDay, favoriteCategory, favoriteAuthor, mostHighlightedBook,
  booksFinishedThisYear, computeAchievements
} from '../stats.js';

const DEFAULT_CATEGORIES = ['Favoritos', 'Pendientes', 'General'];
const NEW_CATEGORY_VALUE = '__new__';

export async function renderDashboard(root, { navigate }) {
  const user = getCurrentUser();
  if (!user) { navigate('#/login'); return; }

  let categories = await listCategories(user.id);
  if (categories.length === 0) {
    for (const c of DEFAULT_CATEGORIES) categories = await addCategory(user.id, c);
  }

  root.innerHTML = '';
  const shell = el('div', { class: 'app-shell' });
  const sidebar = el('aside', { class: 'sidebar', id: 'sidebar' });
  const content = el('div', { class: 'content' });
  const sidebarBackdrop = el('div', { class: 'sidebar-backdrop', id: 'sidebar-backdrop' });

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('visible');
  }
  function openSidebar() {
    sidebar.classList.add('open');
    sidebarBackdrop.classList.add('visible');
  }

  shell.appendChild(topbar(user, navigate, () => {
    if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
  }));
  const layout = el('div', { class: 'layout' }, [sidebar, sidebarBackdrop, content]);
  shell.appendChild(layout);
  root.appendChild(shell);

  // Cerrar el menu lateral al tocar/hacer clic en cualquier parte fuera de
  // el (el overlay cubre todo lo demas mientras el sidebar esta abierto).
  // El listener se auto-elimina si el usuario navega fuera del dashboard,
  // para no acumular listeners cada vez que se vuelve a esta pantalla.
  sidebarBackdrop.addEventListener('click', closeSidebar);
  document.addEventListener('click', function onDocClick(e) {
    if (!document.body.contains(shell)) { document.removeEventListener('click', onDocClick); return; }
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target)) return;
    if (e.target.closest('.sidebar-toggle')) return;
    closeSidebar();
  });

  // Estado del modo "Seleccionar" (persiste entre redibujos del contenido,
  // se resetea si se refresca todo el dashboard)
  const selectState = { active: false, ids: new Set() };

  async function redrawContent() {
    await drawContent(content, user, categories, navigate, refresh, selectState, redrawContent);
  }

  async function refresh() {
    categories = await listCategories(user.id);
    drawSidebar(sidebar, categories, user, {
      onAddCategory: async (name) => { categories = await addCategory(user.id, name); await refresh(); },
      onDeleteCategory: async (name) => {
        if (!confirm(`¿Eliminar la estanteria "${name}"? Los libros que tenga pasaran a "General".`)) return;
        categories = await deleteCategory(user.id, name);
        showToast('Estanteria eliminada.');
        await refresh();
      },
      onOpenSavedPhrases: () => openSavedPhrasesModal(user, navigate)
    });
    selectState.active = false;
    selectState.ids.clear();
    await redrawContent();
    closeSidebar();
  }

  await refresh();
}

function topbar(user, navigate, onToggleSidebar) {
  const themeBtn = el('button', { class: 'link', type: 'button', title: 'Cambiar fondo' }, [icon('palette', { size: 16 }), el('span', { class: 'icn-label' }, 'Fondo')]);
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openThemePicker(themeBtn.getBoundingClientRect());
  });

  return el('div', { class: 'topbar' }, [
    el('div', { style: 'display:flex; align-items:center; gap:12px;' }, [
      el('button', { class: 'link sidebar-toggle', onClick: onToggleSidebar }, icon('menu', { size: 20 })),
      el('span', { class: 'brand' }, [icon('book', { size: 20, className: 'brand-icon' }), el('span', {}, 'Vintage Library')])
    ]),
    el('nav', {}, [
      themeBtn,
      el('span', {}, `Hola, ${user.name || user.email}`),
      el('button', {
        class: 'link', onClick: async () => { await signOut(); navigate('#/login'); }
      }, [icon('logout', { size: 14 }), el('span', {}, 'Cerrar sesion')])
    ])
  ]);
}

function openThemePicker(anchorRect) {
  document.querySelectorAll('.theme-picker-panel').forEach((p) => p.remove());
  const current = getStoredTheme();
  const panel = el('div', {
    class: 'theme-picker-panel',
    style: `top:${anchorRect.bottom + window.scrollY + 6}px; left:${Math.min(anchorRect.left + window.scrollX, window.innerWidth - 210)}px;`
  }, BG_THEMES.map((t) => el('button', {
    type: 'button',
    class: `theme-picker-option${t.id === current ? ' active' : ''}`,
    onClick: (e) => {
      e.stopPropagation();
      applyTheme(t.id);
      panel.remove();
    }
  }, [
    el('span', { class: 'theme-picker-swatch', style: `background:${t.swatch}` }),
    el('span', {}, t.label)
  ])));
  document.body.appendChild(panel);
  setTimeout(() => {
    document.addEventListener('click', function closeOnce() {
      panel.remove();
      document.removeEventListener('click', closeOnce);
    }, { once: true });
  }, 0);
}

function drawSidebar(sidebar, categories, user, { onAddCategory, onDeleteCategory, onOpenSavedPhrases }) {
  sidebar.innerHTML = '';
  sidebar.appendChild(el('button', {
    class: 'sidebar-phrases-btn', type: 'button', onClick: onOpenSavedPhrases
  }, [icon('starFilled', { size: 15 }), el('span', {}, 'Frases guardadas')]));

  sidebar.appendChild(el('p', { class: 'eyebrow', style: 'padding: 0 var(--space-3); margin-top: var(--space-3);' }, 'Estanterias'));
  const list = el('nav', { class: 'sidebar-nav' }, categories.map((c) => {
    const isDefault = DEFAULT_CATEGORIES.includes(c);
    const row = el('div', { class: 'sidebar-nav-row' }, [
      el('a', {
        href: 'javascript:void(0)',
        onClick: (e) => {
          e.preventDefault();
          document.getElementById(`cat-${slug(c)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          sidebar.classList.remove('open');
          document.getElementById('sidebar-backdrop')?.classList.remove('visible');
        }
      }, c),
      !isDefault ? el('button', {
        class: 'sidebar-nav-delete', type: 'button', title: `Eliminar estanteria "${c}"`,
        onClick: (e) => { e.stopPropagation(); onDeleteCategory(c); }
      }, '×') : null
    ]);
    return row;
  }));
  sidebar.appendChild(list);

  const newCatInput = el('input', { class: 'input', placeholder: 'Nueva estanteria...' });
  const newCatForm = el('form', { class: 'sidebar-add-cat' }, [
    newCatInput,
    el('button', { class: 'btn btn-ghost btn-sm', type: 'submit' }, '+')
  ]);
  newCatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = newCatInput.value.trim();
    if (!name) return;
    onAddCategory(name);
    newCatInput.value = '';
  });
  sidebar.appendChild(newCatForm);
}

async function drawContent(content, user, categories, navigate, refresh, selectState, redrawContent) {
  content.innerHTML = '';
  const allBooks = await listBooks(user.id);
  const books = allBooks.filter((b) => !b.archived);
  const archivedBooks = allBooks.filter((b) => b.archived);
  const stats = computeStats(allBooks);

  const selectToggleBtn = el('button', {
    class: `btn btn-ghost select-toggle-btn${selectState.active ? ' active' : ''}`,
    type: 'button',
    onClick: () => {
      selectState.active = !selectState.active;
      if (!selectState.active) selectState.ids.clear();
      redrawContent();
    }
  }, [
    icon(selectState.active ? 'close' : 'squareCheck', { size: 16 }),
    el('span', { class: 'icn-label' }, selectState.active ? 'Cancelar seleccion' : 'Seleccionar')
  ]);

  content.appendChild(el('div', { class: 'dash-header' }, [
    el('div', {}, [
      el('p', { class: 'eyebrow' }, 'Tu estanteria'),
      el('h1', {}, 'Biblioteca personal')
    ]),
    el('div', { class: 'dash-stats' }, [
      el('div', {}, [el('b', {}, String(stats.total)), 'libros']),
      el('div', {}, [el('b', {}, String(stats.finished)), 'terminados']),
      el('div', {}, [el('b', {}, String(stats.reading)), 'en lectura'])
    ]),
    el('div', { class: 'dash-header-actions' }, [
      selectToggleBtn,
      el('button', {
        class: 'btn btn-gold',
        onClick: () => openBookModal({ categories, user, onSaved: refresh })
      }, [icon('plus', { size: 16 }), el('span', { class: 'icn-label' }, 'Agregar libro')])
    ])
  ]));

  if (selectState.active) {
    content.appendChild(bulkActionBar(selectState, allBooks, refresh, redrawContent));
  } else {
    content.appendChild(await buildInsightsSection(user, allBooks, navigate, refresh));
  }

  const byCategory = groupBy(books, (b) => b.category || 'General');
  const categoriesToShow = [...new Set([...categories, ...Object.keys(byCategory)])];

  categoriesToShow.forEach((cat) => {
    const items = byCategory[cat] || [];
    content.appendChild(shelfGroup(cat, items, navigate, refresh, categories, user, selectState, redrawContent));
  });

  if (archivedBooks.length > 0) {
    content.appendChild(archivedGroup(archivedBooks, navigate, refresh, categories, user, selectState, redrawContent));
  }
}

function bulkActionBar(selectState, allBooks, refresh, redrawContent) {
  const count = selectState.ids.size;
  const selectedBooks = allBooks.filter((b) => selectState.ids.has(b.id));
  const isEmpty = count === 0;

  return el('div', { class: `bulk-action-bar${isEmpty ? ' is-empty' : ''}` }, [
    el('div', { class: 'bulk-action-count' }, [
      icon('squareCheck', { size: 15 }),
      el('span', {}, isEmpty ? 'Toca los libros que quieras seleccionar' : `${count} libro${count === 1 ? '' : 's'} seleccionado${count === 1 ? '' : 's'}`)
    ]),
    el('div', { class: 'bulk-action-buttons' }, [
      el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', disabled: isEmpty,
        onClick: async () => {
          for (const b of selectedBooks) await updateBook(b.id, { finished: true, finishedAt: new Date().toISOString() });
          showToast('Marcados como terminados.');
          selectState.active = false; selectState.ids.clear();
          await refresh();
        }
      }, [icon('checkCircle', { size: 15 }), el('span', { class: 'icn-label' }, 'Terminado')]),
      el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', disabled: isEmpty,
        onClick: async () => {
          for (const b of selectedBooks) await updateBook(b.id, { archived: !b.archived });
          showToast('Actualizado.');
          selectState.active = false; selectState.ids.clear();
          await refresh();
        }
      }, [icon('archive', { size: 15 }), el('span', { class: 'icn-label' }, 'Archivar')]),
      el('button', {
        class: 'btn btn-danger btn-sm', type: 'button', disabled: isEmpty,
        onClick: async () => {
          if (!confirm(`¿Eliminar ${count} libro${count === 1 ? '' : 's'} de tu biblioteca? Esto no se puede deshacer.`)) return;
          for (const b of selectedBooks) await deleteBook(b.id);
          showToast('Libros eliminados.');
          selectState.active = false; selectState.ids.clear();
          await refresh();
        }
      }, [icon('trash', { size: 15 }), el('span', { class: 'icn-label' }, 'Eliminar')])
    ])
  ]);
}

function archivedGroup(items, navigate, refresh, categories, user, selectState, redrawContent) {
  const shelf = el('div', { class: 'shelf' }, items.map((book) => bookSpine(book, navigate, refresh, categories, user, selectState, redrawContent)));
  return el('div', { class: 'shelf-group shelf-group-archived' }, [
    el('div', { class: 'shelf-title' }, [
      el('h3', {}, [icon('archive', { size: 17, className: 'shelf-title-icon' }), el('span', {}, 'Archivados')]),
      el('span', { class: 'count' }, `${items.length} libro${items.length === 1 ? '' : 's'}`)
    ]),
    shelf
  ]);
}

function shelfGroup(category, items, navigate, refresh, categories, user, selectState, redrawContent) {
  const shelf = el('div', { class: 'shelf' });
  if (items.length === 0) {
    shelf.appendChild(el('p', { class: 'empty-shelf' }, `Aun no tienes libros en "${category}".`));
  } else {
    items.forEach((book) => shelf.appendChild(bookSpine(book, navigate, refresh, categories, user, selectState, redrawContent)));
  }
  return el('div', { class: 'shelf-group', id: `cat-${slug(category)}` }, [
    el('div', { class: 'shelf-title' }, [
      el('h3', {}, category),
      el('span', { class: 'count' }, `${items.length} libro${items.length === 1 ? '' : 's'}`)
    ]),
    shelf
  ]);
}

function bookSpine(book, navigate, refresh, categories, user, selectState, redrawContent) {
  const pct = book.totalPages ? Math.round((book.progressPage / book.totalPages) * 100) : 0;
  const selectMode = selectState && selectState.active;
  const isSelected = selectMode && selectState.ids.has(book.id);

  const editBtn = el('button', {
    class: 'spine-edit',
    title: 'Editar libro',
    onClick: (e) => {
      e.stopPropagation();
      openBookModal({ categories, user, existingBook: book, onSaved: refresh });
    }
  }, icon('edit', { size: 12 }));

  const menuBtn = el('button', {
    class: 'spine-menu',
    title: 'Mas acciones',
    onClick: (e) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      showMenu(rect, [
        {
          icon: book.finished ? 'checkCircle' : 'checkCircle',
          label: book.finished ? 'Quitar marca de terminado' : 'Marcar como terminado',
          onClick: async () => {
            const nowFinished = !book.finished;
            await updateBook(book.id, { finished: nowFinished, finishedAt: nowFinished ? new Date().toISOString() : null });
            showToast(book.finished ? 'Marca quitada.' : '¡Felicidades por terminarlo!');
            refresh();
          }
        },
        {
          icon: 'archive',
          label: book.archived ? 'Sacar de archivados' : 'Archivar libro',
          onClick: async () => { await updateBook(book.id, { archived: !book.archived }); showToast(book.archived ? 'Libro restaurado.' : 'Libro archivado.'); refresh(); }
        },
        {
          icon: 'trash',
          label: 'Eliminar libro',
          danger: true,
          onClick: async () => {
            if (confirm(`¿Eliminar "${book.title}" de tu biblioteca?`)) {
              await deleteBook(book.id);
              showToast('Libro eliminado.');
              refresh();
            }
          }
        }
      ]);
    }
  }, icon('kebab', { size: 14 }));

  const selectCheckbox = el('span', { class: 'spine-select-checkbox' }, isSelected ? icon('check', { size: 12 }) : null);

  const startPage = book.bookmarkPage || book.progressPage || null;
  const spine = el('div', {
    class: `book-spine${book.finished ? ' is-finished' : ''}${book.archived ? ' is-archived' : ''}${selectMode ? ' is-select-mode' : ''}${isSelected ? ' is-selected' : ''}`,
    style: `--spine-color:${book.spineColor || '#5C3A21'}`,
    onClick: () => {
      if (selectMode) {
        if (selectState.ids.has(book.id)) selectState.ids.delete(book.id);
        else selectState.ids.add(book.id);
        redrawContent();
        return;
      }
      navigate(`#/read/${book.id}${startPage ? '/' + startPage : ''}`);
    }
  }, [
    selectMode ? selectCheckbox : el('div', { class: 'spine-actions' }, [editBtn, menuBtn]),
    book.finished ? el('span', { class: 'spine-badge', title: 'Terminado' }, icon('checkCircle', { size: 12 })) : null,
    book.bookmarkPage ? el('span', { class: 'spine-badge spine-badge-pin', title: 'Tienes un marcador guardado' }, icon('pin', { size: 12 })) : null,
    el('div', { class: 'spine-text-block' }, [
      el('div', { class: 'spine-title' }, book.title),
      el('div', { class: 'spine-author' }, book.author)
    ]),
    el('div', { class: 'spine-progress' }, [el('i', { style: `width:${pct}%` })])
  ]);
  spine.title = selectMode ? 'Clic para seleccionar' : 'Clic para leer';

  if (book.coverPreset) {
    const preset = getCoverPreset(book.coverPreset);
    if (preset) spine.style.cssText += preset.css;
  } else if (book.hasCover) {
    getBookCover(book.id).then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      spine.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${url})`;
      spine.style.backgroundSize = 'cover';
      spine.style.backgroundPosition = 'center';
    }).catch(() => {});
  }

  return spine;
}

// ---------------------------------------------------------
// "Continuar leyendo", racha, meta de lectura, calendario de
// actividad, logros y estadisticas — todo lo que hace que la
// biblioteca se sienta "viva" ademas de ser un catalogo.
// ---------------------------------------------------------
async function buildInsightsSection(user, allBooks, navigate, refresh) {
  const [activity, goal, favorites, highlightsPerBook] = await Promise.all([
    listReadingActivity(user.id),
    getReadingGoal(user.id),
    listFavoriteHighlights(user.id),
    Promise.all(allBooks.map((b) => listHighlights(b.id).then((hs) => [b.id, hs])))
  ]);

  const highlightsByBook = {};
  let notesCount = 0;
  highlightsPerBook.forEach(([bookId, hs]) => {
    highlightsByBook[bookId] = hs.length;
    notesCount += hs.filter((h) => h.kind === 'note').length;
  });

  const streak = computeStreak(activity);
  const calendar = buildActivityCalendar(activity);
  const achievements = computeAchievements({ books: allBooks, favoritesCount: favorites.length, notesCount, streak });
  const finishedThisYear = booksFinishedThisYear(allBooks);

  const continueBook = allBooks
    .filter((b) => !b.archived && !b.finished && b.lastOpenedAt)
    .sort((a, b) => new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt))[0] || null;

  const wrap = el('div', { class: 'dash-insights' });

  if (continueBook) wrap.appendChild(continueReadingCard(continueBook, navigate));

  wrap.appendChild(el('div', { class: 'insights-grid' }, [
    streakGoalCard(streak, activity, goal, finishedThisYear, user, refresh),
    statsCard({
      favCat: favoriteCategory(allBooks),
      favAuthor: favoriteAuthor(allBooks),
      mostHighlighted: mostHighlightedBook(highlightsByBook, allBooks),
      avgPages: avgPagesPerDay(activity)
    }),
    achievementsCard(achievements)
  ]));

  wrap.appendChild(activityCalendarCard(calendar));

  return wrap;
}

function continueReadingCard(book, navigate) {
  const startPage = book.bookmarkPage || book.progressPage || 1;
  const pct = book.totalPages ? Math.round((book.progressPage / book.totalPages) * 100) : 0;
  return el('div', {
    class: 'continue-reading-card', role: 'button', tabindex: '0',
    onClick: () => navigate(`#/read/${book.id}/${startPage}`)
  }, [
    el('div', { class: 'continue-reading-icon' }, icon('book', { size: 22 })),
    el('div', { class: 'continue-reading-info' }, [
      el('p', { class: 'eyebrow' }, 'Continuar leyendo'),
      el('h3', {}, book.title),
      el('p', { class: 'continue-reading-author' }, book.author),
      book.totalPages ? el('div', { class: 'spine-progress continue-reading-progress' }, [el('i', { style: `width:${pct}%` })]) : null
    ]),
    el('button', { class: 'btn btn-gold btn-sm', type: 'button' }, [el('span', {}, 'Seguir'), icon('arrowRight', { size: 13 })])
  ]);
}

function streakGoalCard(streak, activity, goal, finishedThisYear, user, refresh) {
  const target = goal || 12;
  const pct = Math.min(100, Math.round((finishedThisYear / target) * 100));
  return el('div', { class: 'insight-card' }, [
    el('p', { class: 'eyebrow' }, 'Racha de lectura'),
    el('div', { class: 'streak-row' }, [
      icon('leaf', { size: 20, className: 'streak-icon' }),
      el('div', {}, [
        el('b', { class: 'streak-number' }, String(streak.current)),
        el('span', {}, ` dia${streak.current === 1 ? '' : 's'} seguidos`)
      ])
    ]),
    el('p', { class: 'insight-subtext' }, `${minutesToday(activity)} min hoy · ${minutesThisWeek(activity)} min esta semana · racha mas larga: ${streak.longest} dias`),
    el('hr', { class: 'insight-divider' }),
    el('p', { class: 'eyebrow' }, `Meta anual: ${finishedThisYear} / ${target} libros`),
    el('div', { class: 'goal-progress' }, [el('i', { style: `width:${pct}%` })]),
    el('button', {
      class: 'link', type: 'button', style: 'margin-top:6px;',
      onClick: async () => {
        const input = prompt('¿Cuantos libros quieres terminar este año?', String(target));
        if (input === null) return;
        const n = parseInt(input, 10);
        if (!n || n < 1) { showToast('Escribe un numero valido.'); return; }
        await setReadingGoal(user.id, n);
        showToast('Meta actualizada.');
        refresh();
      }
    }, 'Cambiar meta')
  ]);
}

function statsCard({ favCat, favAuthor, mostHighlighted, avgPages }) {
  const rows = [];
  if (favCat) rows.push(`Estanteria favorita: ${favCat.name} (${favCat.count})`);
  if (favAuthor) rows.push(`Autor mas leido: ${favAuthor.name} (${favAuthor.count})`);
  if (mostHighlighted) rows.push(`Libro mas remarcado: "${mostHighlighted.book.title}" (${mostHighlighted.count})`);
  if (avgPages > 0) rows.push(`Promedio de lectura: ${avgPages} paginas/dia`);
  return el('div', { class: 'insight-card' }, [
    el('p', { class: 'eyebrow' }, 'Estadisticas'),
    rows.length === 0
      ? el('p', { class: 'insight-subtext' }, 'Sigue leyendo para desbloquear estadisticas.')
      : el('ul', { class: 'stats-list' }, rows.map((r) => el('li', {}, r)))
  ]);
}

function achievementsCard(achievements) {
  return el('div', { class: 'insight-card' }, [
    el('p', { class: 'eyebrow' }, 'Logros'),
    el('div', { class: 'achievements-grid' }, achievements.map((a) => el('div', {
      class: `achievement-badge${a.unlocked ? ' unlocked' : ''}`,
      title: a.label
    }, [icon(a.icon, { size: 15 }), el('span', {}, a.label)])))
  ]);
}

function activityCalendarCard(calendar) {
  const weeks = [];
  for (let i = 0; i < calendar.length; i += 7) weeks.push(calendar.slice(i, i + 7));
  const grid = el('div', { class: 'activity-calendar' }, weeks.map((week) => el('div', { class: 'activity-week' },
    week.map((day) => el('span', {
      class: `activity-day level-${day.level}`,
      title: `${day.date}: ${day.minutes} min de lectura`
    })))));
  return el('div', { class: 'insight-card activity-calendar-card' }, [
    el('p', { class: 'eyebrow' }, 'Actividad de lectura (ultimas semanas)'),
    grid
  ]);
}

function computeStats(books) {
  return {
    total: books.length,
    finished: books.filter((b) => b.finished || (b.totalPages && b.progressPage >= b.totalPages)).length,
    reading: books.filter((b) => !b.finished && b.progressPage > 0 && (!b.totalPages || b.progressPage < b.totalPages)).length
  };
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

function slug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
}

function categorySelect(categories, selected) {
  const select = el('select', { class: 'input', name: 'category' }, [
    ...categories.map((c) => el('option', { value: c, ...(c === selected ? { selected: 'true' } : {}) }, c)),
    el('option', { value: NEW_CATEGORY_VALUE }, '+ Nueva estanteria...')
  ]);
  const newCatInput = el('input', {
    class: 'input', name: 'newCategory', placeholder: 'Nombre de la nueva estanteria',
    style: 'display:none; margin-top:6px;'
  });
  select.addEventListener('change', () => {
    newCatInput.style.display = select.value === NEW_CATEGORY_VALUE ? 'block' : 'none';
  });
  return { select, newCatInput };
}

function coverPicker(existingBook) {
  const wrap = el('div', { class: 'cover-picker' });
  const hasCustomAlready = !!(existingBook && (existingBook.hasCover || existingBook.coverPreset));
  const modeRow = el('div', { class: 'cover-picker-modes' }, [
    el('label', { class: 'radio-chip' }, [
      el('input', { type: 'radio', name: 'coverMode', value: 'auto', checked: hasCustomAlready ? undefined : 'true' }), ' Portada del libro (1a pagina)'
    ]),
    el('label', { class: 'radio-chip' }, [
      el('input', { type: 'radio', name: 'coverMode', value: 'upload', checked: hasCustomAlready ? 'true' : undefined }), ' Subir imagen'
    ]),
    el('label', { class: 'radio-chip' }, [
      el('input', { type: 'radio', name: 'coverMode', value: 'preset' }), ' Portada prediseñada'
    ])
  ]);

  const autoSection = el('div', { class: 'cover-picker-section' }, [
    el('p', { class: 'cover-picker-hint' }, 'Usaremos la primera pagina del PDF como portada, tal como aparece en el libro. Puedes cambiarla cuando quieras.')
  ]);

  let externalCoverBlob = null;
  const externalCoverHint = el('p', { class: 'cover-picker-hint', style: 'display:none;' });
  const uploadSection = el('div', { class: 'cover-picker-section', style: 'display:none;' }, [
    el('input', { class: 'input', type: 'file', name: 'coverImage', accept: 'image/*' }),
    externalCoverHint
  ]);
  uploadSection.querySelector('input[type=file]').addEventListener('change', () => {
    // Si el usuario elige un archivo propio, ya no usamos la portada
    // que se haya traido de Open Library.
    externalCoverBlob = null;
    externalCoverHint.style.display = 'none';
  });

  let selectedPreset = existingBook?.coverPreset || null;
  const presetGrid = el('div', { class: 'cover-preset-grid' });
  COVER_PRESETS.forEach((p) => {
    const swatch = el('button', {
      type: 'button', class: `cover-preset-swatch${selectedPreset === p.id ? ' selected' : ''}`,
      title: p.label,
      onClick: () => {
        selectedPreset = p.id;
        presetGrid.querySelectorAll('.cover-preset-swatch').forEach((s) => s.classList.remove('selected'));
        swatch.classList.add('selected');
        presetGrid.dataset.value = p.id;
      }
    }, el('span', {}, p.label));
    swatch.style.cssText += p.css;
    presetGrid.appendChild(swatch);
  });
  presetGrid.dataset.value = selectedPreset || '';
  const presetSection = el('div', { class: 'cover-picker-section', style: 'display:none;' }, [presetGrid]);

  modeRow.querySelectorAll('input[name="coverMode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      autoSection.style.display = radio.value === 'auto' && radio.checked ? 'block' : 'none';
      uploadSection.style.display = radio.value === 'upload' && radio.checked ? 'block' : 'none';
      presetSection.style.display = radio.value === 'preset' && radio.checked ? 'block' : 'none';
    });
  });

  wrap.appendChild(modeRow);
  wrap.appendChild(autoSection);
  wrap.appendChild(uploadSection);
  wrap.appendChild(presetSection);

  return {
    node: wrap,
    getMode: () => (wrap.querySelector('input[name="coverMode"]:checked')?.value || 'auto'),
    getFile: () => externalCoverBlob || uploadSection.querySelector('input[type=file]').files[0],
    getPreset: () => (presetGrid.dataset.value || null),
    // Usado por la busqueda de Open Library: fuerza el modo "Subir imagen"
    // con una portada ya descargada, sin que el usuario tenga que elegir
    // un archivo de su computadora.
    setExternalCover: (blob, label) => {
      externalCoverBlob = blob;
      externalCoverHint.textContent = `Portada de Open Library seleccionada: ${label}`;
      externalCoverHint.style.display = 'block';
      const uploadRadio = wrap.querySelector('input[name="coverMode"][value="upload"]');
      if (uploadRadio) { uploadRadio.checked = true; uploadRadio.dispatchEvent(new Event('change')); }
    }
  };
}

function openLibrarySearchField(titleInput, authorInput, cover) {
  const input = el('input', { class: 'input', placeholder: 'Buscar por titulo (ej: El nombre del viento)...' });
  const searchBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, [icon('search', { size: 13 }), el('span', {}, 'Buscar')]);
  const resultsBox = el('div', { class: 'ol-results' });

  async function runOlSearch() {
    const q = input.value.trim();
    if (!q) return;
    resultsBox.innerHTML = '';
    resultsBox.appendChild(el('p', { class: 'empty-shelf' }, 'Buscando en Open Library...'));
    try {
      const results = await searchOpenLibrary(q, 6);
      resultsBox.innerHTML = '';
      if (results.length === 0) {
        resultsBox.appendChild(el('p', { class: 'empty-shelf' }, 'Sin resultados. Puedes escribir los datos a mano.'));
        return;
      }
      results.forEach((r) => {
        const row = el('button', { class: 'ol-result-row', type: 'button' }, [
          r.coverUrl ? el('img', { src: r.coverUrl, class: 'ol-result-cover', alt: '' }) : el('span', { class: 'ol-result-cover ol-result-cover-empty' }, icon('book', { size: 14 })),
          el('span', { class: 'ol-result-text' }, [
            el('span', { class: 'ol-result-title' }, r.title),
            el('span', { class: 'ol-result-author' }, `${r.author}${r.year ? ' · ' + r.year : ''}`)
          ])
        ]);
        row.addEventListener('click', async () => {
          titleInput.value = r.title;
          authorInput.value = r.author;
          resultsBox.innerHTML = '';
          resultsBox.appendChild(el('p', { class: 'empty-shelf' }, 'Descargando portada...'));
          const blob = await fetchCoverBlob(r.coverUrlLarge);
          resultsBox.innerHTML = '';
          if (blob) {
            cover.setExternalCover(blob, r.title);
            showToast('Titulo, autor y portada rellenados desde Open Library.');
          } else {
            showToast('Titulo y autor rellenados. No habia portada disponible.');
          }
        });
        resultsBox.appendChild(row);
      });
    } catch {
      resultsBox.innerHTML = '';
      resultsBox.appendChild(el('p', { class: 'empty-shelf' }, 'No se pudo buscar en Open Library ahora mismo.'));
    }
  }

  searchBtn.addEventListener('click', runOlSearch);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runOlSearch(); } });

  return el('div', { class: 'field ol-search-field' }, [
    el('label', {}, [icon('search', { size: 12 }), el('span', {}, ' Autocompletar con Open Library (opcional)')]),
    el('div', { class: 'ol-search-row' }, [input, searchBtn]),
    resultsBox
  ]);
}

function openBookModal({ categories, user, existingBook, onSaved }) {
  const isEdit = !!existingBook;
  const backdrop = el('div', { class: 'modal-backdrop' });
  const { select: catSelect, newCatInput } = categorySelect(categories, existingBook?.category);
  const cover = coverPicker(existingBook);

  const titleInput = el('input', { class: 'input', name: 'title', value: existingBook?.title || '', placeholder: 'El nombre del viento' });
  const authorInput = el('input', { class: 'input', name: 'author', value: existingBook?.author || '', placeholder: 'Patrick Rothfuss' });

  const fields = [
    !isEdit ? el('div', { class: 'field' }, [
      el('label', {}, 'Archivo PDF'),
      el('input', { class: 'input', type: 'file', name: 'file', accept: 'application/pdf', required: 'true' })
    ]) : null,
    !isEdit ? openLibrarySearchField(titleInput, authorInput, cover) : null,
    el('div', { class: 'field' }, [
      el('label', {}, 'Portada (opcional)'),
      cover.node
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Titulo'),
      titleInput
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Autor'),
      authorInput
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Categoria / estanteria'),
      catSelect,
      newCatInput
    ])
  ];

  const submitBtn = el('button', { type: 'submit', class: 'btn btn-gold' }, isEdit ? 'Guardar cambios' : 'Agregar a la estanteria');
  const form = el('form', {}, [
    ...fields,
    el('div', { style: 'display:flex; gap:8px; justify-content:flex-end; margin-top: 8px;' }, [
      el('button', { type: 'button', class: 'btn btn-ghost', onClick: () => backdrop.remove() }, 'Cancelar'),
      submitBtn
    ])
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const file = fd.get('file');
    const coverMode = cover.getMode();
    const coverImageFile = cover.getFile();
    const coverPresetId = cover.getPreset();
    let category = fd.get('category');
    if (category === NEW_CATEGORY_VALUE) {
      category = (fd.get('newCategory') || '').trim();
      if (!category) { showToast('Escribe un nombre para la nueva estanteria.'); return; }
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Guardando...';
    submitBtn.classList.add('btn-loading');

    try {
      if (isEdit) {
        await updateBook(existingBook.id, {
          title: fd.get('title') || existingBook.title,
          author: fd.get('author') || existingBook.author,
          category
        });
        if (coverMode === 'upload' && coverImageFile && coverImageFile.size > 0) {
          await setBookCover(existingBook.id, coverImageFile);
        } else if (coverMode === 'preset' && coverPresetId) {
          await updateBook(existingBook.id, { coverPreset: coverPresetId, hasCover: false });
        } else if (coverMode === 'auto') {
          try {
            const pdfBlob = await getBookFile(existingBook.id);
            const thumb = await generatePdfCoverThumbnail(pdfBlob);
            await setBookCover(existingBook.id, thumb);
          } catch {
            showToast('No se pudo generar la portada automatica desde el PDF.');
          }
        }
        showToast('Libro actualizado.');
      } else {
        if (!file || file.size === 0) { showToast('Selecciona un archivo PDF.'); submitBtn.disabled = false; submitBtn.textContent = originalLabel; return; }
        let coverImage = null;
        let coverPreset = null;
        if (coverMode === 'upload' && coverImageFile && coverImageFile.size > 0) {
          coverImage = coverImageFile;
        } else if (coverMode === 'preset' && coverPresetId) {
          coverPreset = coverPresetId;
        } else {
          // 'auto' (o si el usuario dejo la seccion elegida sin completar):
          // la portada es la primera pagina del propio PDF que esta subiendo.
          try {
            coverImage = await generatePdfCoverThumbnail(file);
          } catch {
            // Si por algun motivo no se puede renderizar (PDF danado, etc.)
            // seguimos sin portada personalizada; el lomo usara el color por defecto.
          }
        }
        await addBook({
          title: fd.get('title') || file.name.replace(/\.pdf$/i, ''),
          author: fd.get('author'),
          category,
          file,
          coverImage,
          coverPreset
        });
        showToast('Libro agregado a tu estanteria.');
      }
      backdrop.remove();
      onSaved();
    } catch (err) {
      showToast(err.message || 'No se pudo guardar el libro.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      submitBtn.classList.remove('btn-loading');
    }
  });

  backdrop.appendChild(el('div', { class: 'modal panel' }, [
    el('div', { class: 'modal-header' }, [
      el('h2', {}, isEdit ? 'Editar libro' : 'Agregar libro'),
      el('button', { class: 'btn btn-ghost btn-sm modal-close', type: 'button', onClick: () => backdrop.remove() }, icon('close', { size: 15 }))
    ]),
    form
  ]));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function exportPhrasesToMarkdown(phrases, titleFor) {
  const lines = ['# Frases guardadas', '', `_Exportado el ${new Date().toLocaleDateString()}_`, ''];
  const byBook = groupBy(phrases, (p) => titleFor(p.bookId));
  Object.entries(byBook).forEach(([title, list]) => {
    lines.push(`## ${title}`, '');
    list.forEach((p) => {
      lines.push(`> ${p.text}`, '', `— pagina ${p.page}`, '');
    });
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: 'frases-guardadas.md' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function openSavedPhrasesModal(user, navigate) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const listWrap = el('div', { class: 'saved-phrases-list' }, [el('p', { class: 'empty-shelf' }, 'Cargando...')]);
  const exportBtn = el('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', title: 'Exportar todas las frases a un archivo Markdown', disabled: 'true'
  }, [icon('download', { size: 13 }), el('span', { class: 'icn-label' }, 'Exportar')]);

  backdrop.appendChild(el('div', { class: 'modal panel saved-phrases-modal' }, [
    el('div', { class: 'modal-header' }, [
      el('h2', {}, [icon('starFilled', { size: 18 }), el('span', {}, 'Frases guardadas')]),
      el('div', { style: 'display:flex; gap:8px; align-items:center;' }, [
        exportBtn,
        el('button', { class: 'btn btn-ghost btn-sm modal-close', type: 'button', onClick: () => backdrop.remove() }, icon('close', { size: 15 }))
      ])
    ]),
    listWrap
  ]));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);

  const [phrases, books] = await Promise.all([listFavoriteHighlights(user.id), listBooks(user.id)]);
  const titleFor = (bookId) => books.find((b) => b.id === bookId)?.title || 'Libro';

  if (phrases.length > 0) {
    exportBtn.removeAttribute('disabled');
    exportBtn.addEventListener('click', () => exportPhrasesToMarkdown(phrases, titleFor));
  }

  listWrap.innerHTML = '';
  if (phrases.length === 0) {
    listWrap.appendChild(el('p', { class: 'empty-shelf' }, 'Aun no has guardado ninguna frase. Al remarcar texto en un libro, marca la estrella para guardarla aqui.'));
  }
  phrases.forEach((p) => {
    const card = el('div', { class: 'saved-phrase-card', style: `border-left-color:${p.color}` }, [
      el('p', { class: 'saved-phrase-text' }, `"${p.text}"`),
      el('div', { class: 'saved-phrase-meta' }, [
        el('span', {}, `${titleFor(p.bookId)} · pagina ${p.page}`),
        el('button', {
          class: 'link', onClick: () => { backdrop.remove(); navigate(`#/read/${p.bookId}/${p.page}`); }
        }, [el('span', {}, 'Ir a la frase'), icon('arrowRight', { size: 12 })])
      ])
    ]);
    listWrap.appendChild(card);
  });
}
