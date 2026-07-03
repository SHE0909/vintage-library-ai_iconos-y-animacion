import {
  listBooks, addBook, updateBook, deleteBook, signOut, getCurrentUser,
  listCategories, addCategory, deleteCategory, getBookCover, setBookCover,
  listFavoriteHighlights
} from '../data.js';
import { el, showToast, showMenu, iconBtn } from '../utils.js';
import { icon } from '../icons.js';
import { COVER_PRESETS, getCoverPreset } from '../coverPresets.js';

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

  shell.appendChild(topbar(user, navigate, () => sidebar.classList.toggle('open')));
  const layout = el('div', { class: 'layout' }, [sidebar, content]);
  shell.appendChild(layout);
  root.appendChild(shell);

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
    sidebar.classList.remove('open');
  }

  await refresh();
}

function topbar(user, navigate, onToggleSidebar) {
  return el('div', { class: 'topbar' }, [
    el('div', { style: 'display:flex; align-items:center; gap:12px;' }, [
      el('button', { class: 'link sidebar-toggle', onClick: onToggleSidebar }, icon('menu', { size: 20 })),
      el('span', { class: 'brand' }, [icon('book', { size: 20, className: 'brand-icon' }), el('span', {}, 'Vintage Library')])
    ]),
    el('nav', {}, [
      el('span', {}, `Hola, ${user.name || user.email}`),
      el('button', {
        class: 'link', onClick: async () => { await signOut(); navigate('#/login'); }
      }, [icon('logout', { size: 14 }), el('span', {}, 'Cerrar sesion')])
    ])
  ]);
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
          for (const b of selectedBooks) await updateBook(b.id, { finished: true });
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
          onClick: async () => { await updateBook(book.id, { finished: !book.finished }); showToast(book.finished ? 'Marca quitada.' : '¡Felicidades por terminarlo!'); refresh(); }
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
    el('div', {}, [
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
  const modeRow = el('div', { class: 'cover-picker-modes' }, [
    el('label', { class: 'radio-chip' }, [
      el('input', { type: 'radio', name: 'coverMode', value: 'upload', checked: 'true' }), ' Subir imagen'
    ]),
    el('label', { class: 'radio-chip' }, [
      el('input', { type: 'radio', name: 'coverMode', value: 'preset' }), ' Portada prediseñada'
    ])
  ]);

  const uploadSection = el('div', { class: 'cover-picker-section' }, [
    el('input', { class: 'input', type: 'file', name: 'coverImage', accept: 'image/*' })
  ]);

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
      uploadSection.style.display = radio.value === 'upload' && radio.checked ? 'block' : 'none';
      presetSection.style.display = radio.value === 'preset' && radio.checked ? 'block' : 'none';
    });
  });

  wrap.appendChild(modeRow);
  wrap.appendChild(uploadSection);
  wrap.appendChild(presetSection);

  return {
    node: wrap,
    getFile: () => uploadSection.querySelector('input[type=file]').files[0],
    getPreset: () => (presetGrid.dataset.value || null)
  };
}

function openBookModal({ categories, user, existingBook, onSaved }) {
  const isEdit = !!existingBook;
  const backdrop = el('div', { class: 'modal-backdrop' });
  const { select: catSelect, newCatInput } = categorySelect(categories, existingBook?.category);
  const cover = coverPicker(existingBook);

  const fields = [
    !isEdit ? el('div', { class: 'field' }, [
      el('label', {}, 'Archivo PDF'),
      el('input', { class: 'input', type: 'file', name: 'file', accept: 'application/pdf', required: 'true' })
    ]) : null,
    el('div', { class: 'field' }, [
      el('label', {}, 'Portada (opcional)'),
      cover.node
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Titulo'),
      el('input', { class: 'input', name: 'title', value: existingBook?.title || '', placeholder: 'El nombre del viento' })
    ]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Autor'),
      el('input', { class: 'input', name: 'author', value: existingBook?.author || '', placeholder: 'Patrick Rothfuss' })
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
        if (coverImageFile && coverImageFile.size > 0) {
          await setBookCover(existingBook.id, coverImageFile);
        } else if (coverPresetId) {
          await updateBook(existingBook.id, { coverPreset: coverPresetId, hasCover: false });
        }
        showToast('Libro actualizado.');
      } else {
        if (!file || file.size === 0) { showToast('Selecciona un archivo PDF.'); submitBtn.disabled = false; submitBtn.textContent = originalLabel; return; }
        await addBook({
          title: fd.get('title') || file.name.replace(/\.pdf$/i, ''),
          author: fd.get('author'),
          category,
          file,
          coverImage: coverImageFile && coverImageFile.size > 0 ? coverImageFile : null,
          coverPreset: (!coverImageFile || coverImageFile.size === 0) ? coverPresetId : null
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

async function openSavedPhrasesModal(user, navigate) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const listWrap = el('div', { class: 'saved-phrases-list' }, [el('p', { class: 'empty-shelf' }, 'Cargando...')]);

  backdrop.appendChild(el('div', { class: 'modal panel saved-phrases-modal' }, [
    el('div', { class: 'modal-header' }, [
      el('h2', {}, [icon('starFilled', { size: 18 }), el('span', {}, 'Frases guardadas')]),
      el('button', { class: 'btn btn-ghost btn-sm modal-close', type: 'button', onClick: () => backdrop.remove() }, icon('close', { size: 15 }))
    ]),
    listWrap
  ]));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);

  const [phrases, books] = await Promise.all([listFavoriteHighlights(user.id), listBooks(user.id)]);
  const titleFor = (bookId) => books.find((b) => b.id === bookId)?.title || 'Libro';

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
