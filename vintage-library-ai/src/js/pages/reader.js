import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  getBookFile, getBook, updateBook, getCurrentUser,
  addHighlight, listHighlights, deleteHighlight, updateHighlight, restoreHighlight,
  recordReadingActivity
} from '../data.js';
import { el, showToast, showLoadingOverlay, hideLoadingOverlay, showMenu } from '../utils.js';
import { icon } from '../icons.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const HIGHLIGHT_COLORS = ['#D4AF6A', '#B37B87', '#7C8B6F', '#6B2737', '#4A6FA5', '#3B7A5A'];
const STYLE_OPTIONS = [
  { value: 'fill', label: 'Resaltar' },
  { value: 'underline', label: 'Subrayar' },
  { value: 'strike', label: 'Tachar' },
  { value: 'box', label: 'Recuadro' }
];
// Grosores de pluma disponibles para el modo "Dibujar", guardados como
// fraccion del ancho de la pagina para que se vean igual sin importar
// el nivel de zoom o el tamaño de pantalla.
const PEN_WIDTHS = [
  { value: 0.0025, label: 'Fino' },
  { value: 0.005, label: 'Medio' },
  { value: 0.009, label: 'Grueso' }
];

export async function renderReader(root, { bookId, initialPage, navigate }) {
  const user = getCurrentUser();
  if (!user) { navigate('#/login'); return; }

  root.innerHTML = '';
  const shell = el('div', { class: 'app-shell' });

  const pageIndicator = el('span', { id: 'page-indicator', class: 'reader-page-indicator' }, '...');
  const searchInput = el('input', { class: 'input reader-search-input', placeholder: 'Buscar en el libro...' });
  const styleSelect = el('select', { class: 'input reader-style-select' }, STYLE_OPTIONS.map((o) => el('option', { value: o.value }, o.label)));
  const favToggle = el('input', { type: 'checkbox', id: 'fav-toggle' });
  const bookmarkIcon = icon('pin', { size: 15 });
  const bookmarkLabel = el('span', { class: 'icn-label' }, 'Marcar aqui');
  const bookmarkBtn = el('button', { class: 'icon reader-bookmark-btn', type: 'button' }, [bookmarkIcon, bookmarkLabel]);
  const searchBtn = el('button', { class: 'icon icon-round', type: 'button', title: 'Buscar texto' }, icon('search', { size: 16 }));
  const favPanelBtn = el('button', { class: 'icon icon-round', type: 'button', title: 'Frases guardadas de este libro' }, icon('starOutline', { size: 16 }));
  const noteBtn = el('button', { class: 'icon reader-note-btn', type: 'button', title: 'Agregar nota en esta pagina' }, [icon('edit', { size: 15 }), el('span', { class: 'icn-label' }, 'Nota')]);
  const notesPanelBtn = el('button', { class: 'icon icon-round', type: 'button', title: 'Notas de este libro' }, icon('edit', { size: 15 }));

  bookmarkBtn.setAttribute('title', 'Marcar esta pagina');

  const toolbar = el('div', { class: 'reader-toolbar' }, [
    el('div', { class: 'group group-back' }, [
      el('button', { class: 'icon reader-back-btn', title: 'Volver a la estanteria', onClick: async () => { await leaveReaderAndCommit(); navigate('#/dashboard'); } }, [icon('arrowLeft', { size: 15 }), el('span', { class: 'icn-label' }, 'Volver a la estanteria')])
    ]),
    el('div', { class: 'group reader-pager' }, [
      el('button', { class: 'page-turn-btn', id: 'prev-page', title: 'Pagina anterior' }, icon('chevronLeft', { size: 17 })),
      pageIndicator,
      el('button', { class: 'page-turn-btn', id: 'next-page', title: 'Pagina siguiente' }, icon('chevronRight', { size: 17 }))
    ]),
    el('div', { class: 'group group-tools' }, [
      bookmarkBtn,
      noteBtn,
      el('span', { class: 'toolbar-divider', 'aria-hidden': 'true' }),
      searchBtn,
      favPanelBtn,
      notesPanelBtn,
      el('span', { class: 'toolbar-divider', 'aria-hidden': 'true' }),
      el('button', { class: 'icon icon-round', id: 'zoom-out', title: 'Alejar' }, icon('zoomOut', { size: 15 })),
      el('button', { class: 'icon icon-round', id: 'zoom-in', title: 'Acercar' }, icon('zoomIn', { size: 15 }))
    ])
  ]);

  const toolbar2 = el('div', { class: 'reader-toolbar reader-toolbar-2' }, [
    el('div', { class: 'group group-modes' }, [
      el('button', { class: 'icon icon-round mode-btn active', id: 'mode-select', type: 'button', title: 'Seleccionar texto para remarcar' }, icon('cursorText', { size: 15 })),
      el('button', { class: 'icon icon-round mode-btn', id: 'mode-draw', type: 'button', title: 'Dibujar a mano alzada' }, icon('brush', { size: 15 })),
      el('button', { class: 'icon icon-round mode-btn', id: 'mode-erase', type: 'button', title: 'Borrar trazos dibujados' }, icon('eraser', { size: 15 })),
      el('span', { class: 'toolbar-divider toolbar-divider-v2', 'aria-hidden': 'true' }),
      el('button', { class: 'icon icon-round', id: 'undo-btn', type: 'button', title: 'Deshacer', disabled: 'true' }, icon('undo', { size: 15 })),
      el('button', { class: 'icon icon-round', id: 'redo-btn', type: 'button', title: 'Rehacer', disabled: 'true' }, icon('redo', { size: 15 }))
    ]),
    el('div', { class: 'group group-select-tools' }, [
      el('span', { class: 'reader-hint', id: 'reader-hint' }, [icon('brush', { size: 12 }), el('span', { class: 'reader-hint-text' }, 'Selecciona texto para remarcar')]),
      el('span', { class: 'toolbar-divider toolbar-divider-v2', 'aria-hidden': 'true' }),
      el('label', { class: 'reader-inline-label' }, 'Estilo:'),
      styleSelect,
      el('label', { class: 'reader-inline-label reader-fav-label' }, [favToggle, icon('starOutline', { size: 13 }), el('span', {}, 'Guardar como frase')])
    ]),
    el('div', { class: 'group group-draw-tools', id: 'draw-tools', style: 'display:none;' }, [
      el('label', { class: 'reader-inline-label' }, 'Color:'),
      ...HIGHLIGHT_COLORS.map((c) => el('button', { class: 'swatch pen-swatch', type: 'button', style: `background:${c}`, 'data-color': c, title: c })),
      el('input', { type: 'color', class: 'swatch swatch-custom pen-swatch-custom', value: '#D4AF6A', title: 'Color personalizado' }),
      el('span', { class: 'toolbar-divider toolbar-divider-v2', 'aria-hidden': 'true' }),
      el('label', { class: 'reader-inline-label' }, 'Grosor:'),
      el('select', { class: 'input reader-style-select', id: 'pen-width-select' }, PEN_WIDTHS.map((w, i) => el('option', { value: w.value, ...(i === 1 ? { selected: 'true' } : {}) }, w.label)))
    ])
  ]);

  const canvasWrap = el('div', { class: 'reader-canvas-wrap' });
  const pageStack = el('div', { class: 'page-stack' });
  const canvas = el('canvas', { id: 'pdf-canvas' });
  const highlightLayer = el('div', { class: 'highlight-layer' });
  const textLayer = el('div', { class: 'textLayer' });
  const drawingLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  drawingLayer.setAttribute('class', 'drawing-layer');
  pageStack.appendChild(canvas);
  pageStack.appendChild(highlightLayer);
  pageStack.appendChild(drawingLayer);
  pageStack.appendChild(textLayer);
  canvasWrap.appendChild(pageStack);

  const sidePanel = el('div', { class: 'reader-side-panel' }, [
    el('div', { class: 'reader-side-panel-header' }, [
      el('span', { id: 'side-panel-title' }, 'Buscar'),
      el('button', { class: 'btn btn-ghost btn-sm modal-close', type: 'button', id: 'side-panel-close' }, icon('close', { size: 15 }))
    ]),
    el('div', { class: 'reader-side-panel-body', id: 'side-panel-body' })
  ]);

  shell.appendChild(toolbar);
  shell.appendChild(toolbar2);
  shell.appendChild(canvasWrap);
  shell.appendChild(sidePanel);
  root.appendChild(shell);

  showLoadingOverlay(canvasWrap, 'Abriendo tu libro...');

  let pdfDoc = null;
  let bookRecord = null;
  let pageNum = initialPage || 1;
  let scale = 1.3;
  let rendering = false;
  let firstRender = true;

  try {
    bookRecord = await getBook(bookId).catch(() => null);
    const blob = await getBookFile(bookId);
    const arrayBuffer = await blob.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    hideLoadingOverlay(canvasWrap);
    canvasWrap.innerHTML = '';
    canvasWrap.appendChild(el('p', { style: 'color:#eee' }, 'No se pudo cargar el archivo del libro.'));
    return;
  }

  if (!initialPage) {
    pageNum = (bookRecord && (bookRecord.bookmarkPage || bookRecord.progressPage)) || 1;
  }
  pageNum = Math.min(Math.max(pageNum, 1), pdfDoc.numPages);

  await updateBook(bookId, { totalPages: pdfDoc.numPages, lastOpenedAt: new Date().toISOString() });

  // ---------------- SESION DE LECTURA (racha, minutos, calendario) ----------------
  // No guardamos nada hasta que el usuario efectivamente pasa tiempo o
  // paginas en el libro; se registra periodicamente y al salir para que
  // una sesion larga no se pierda si el usuario cierra la pestaña sin avisar.
  let sessionStart = Date.now();
  let sessionPagesSeen = new Set([pageNum]);
  let sessionCommitted = false;

  async function commitReadingSession() {
    const elapsedMinutes = Math.round((Date.now() - sessionStart) / 60000);
    const pagesSeen = sessionPagesSeen.size;
    if (elapsedMinutes <= 0 && pagesSeen <= 1) return; // nada relevante que guardar aun
    sessionStart = Date.now();
    sessionPagesSeen = new Set([pageNum]);
    try { await recordReadingActivity({ minutes: elapsedMinutes, pages: pagesSeen }); } catch { /* modo offline: no interrumpe la lectura */ }
  }

  const activityTimer = setInterval(() => {
    if (!document.body.contains(shell)) { clearInterval(activityTimer); return; }
    commitReadingSession();
  }, 60000);

  async function leaveReaderAndCommit() {
    if (sessionCommitted) return;
    sessionCommitted = true;
    clearInterval(activityTimer);
    await commitReadingSession();
  }

  window.addEventListener('beforeunload', leaveReaderAndCommit);

  function updateBookmarkBtnState() {
    const active = bookRecord && bookRecord.bookmarkPage === pageNum;
    bookmarkLabel.textContent = active ? 'Marcador en esta pagina' : 'Marcar aqui';
    bookmarkBtn.setAttribute('title', active ? 'Marcador en esta pagina' : 'Marcar esta pagina');
    bookmarkBtn.classList.toggle('active', !!active);
  }

  function spawnPageLeaf(direction) {
    // Toma una "foto" de la pagina actual y la convierte en una hoja de
    // papel que gira sobre su bisagra (como al pasar una pagina real),
    // dejando ver la pagina nueva que ya quedo dibujada debajo.
    if (!canvas.width || !canvas.height) return null;
    const snapshot = canvas.toDataURL('image/jpeg', 0.75);
    const leaf = el('div', { class: `page-flip-leaf page-flip-${direction}` });
    leaf.style.width = `${canvas.width}px`;
    leaf.style.height = `${canvas.height}px`;
    leaf.style.backgroundImage = `url(${snapshot})`;
    pageStack.appendChild(leaf);
    requestAnimationFrame(() => leaf.classList.add('turning'));
    setTimeout(() => leaf.remove(), 620);
    return leaf;
  }

  async function renderPage(num, { animate = false, direction = 'next' } = {}) {
    if (rendering) return;
    rendering = true;
    const leaf = animate ? spawnPageLeaf(direction) : null;

    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    pageStack.style.width = `${viewport.width}px`;
    pageStack.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Capa de texto invisible para poder seleccionar y remarcar
    textLayer.innerHTML = '';
    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;
    const textContent = await page.getTextContent();
    const textLayerInstance = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayer,
      viewport
    });
    await textLayerInstance.render();

    pageIndicator.textContent = `Pagina ${num} de ${pdfDoc.numPages}`;
    await drawHighlights(num, viewport.width, viewport.height);
    rendering = false;
    sessionPagesSeen.add(num);
    updateBook(bookId, { progressPage: num }).catch(() => {});
    updateBookmarkBtnState();

    if (firstRender) {
      hideLoadingOverlay(canvasWrap);
      firstRender = false;
    }
  }

  function highlightStyleAttr(h) {
    const style = h.style || 'fill';
    if (style === 'underline') return `background: linear-gradient(${h.color},${h.color}) no-repeat bottom / 100% 3px;`;
    if (style === 'strike') return `background: linear-gradient(${h.color},${h.color}) no-repeat center / 100% 2px;`;
    if (style === 'box') return `border: 2px solid ${h.color}; box-sizing: border-box;`;
    return `background:${h.color};`;
  }

  async function drawHighlights(num, width, height) {
    highlightLayer.innerHTML = '';
    highlightLayer.style.width = `${width}px`;
    highlightLayer.style.height = `${height}px`;
    drawingLayer.setAttribute('width', width);
    drawingLayer.setAttribute('height', height);
    drawingLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    drawingLayer.innerHTML = '';
    const all = await listHighlights(bookId);
    all.filter((h) => h.page === num && h.kind !== 'drawing').forEach((h) => {
      h.rects.forEach((r) => {
        const div = el('div', {
          class: `highlight-mark style-${h.style || 'fill'}${h.isFavorite ? ' is-favorite' : ''}`,
          style: `left:${r.x * width}px; top:${r.y * height}px; width:${r.w * width}px; height:${r.h * height}px; ${highlightStyleAttr(h)}`,
          title: h.isFavorite ? 'Frase guardada - clic para opciones' : 'Clic para opciones'
        });
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = div.getBoundingClientRect();
          showMenu(rect, [
            {
              icon: h.isFavorite ? 'starOutline' : 'starFilled',
              label: h.isFavorite ? 'Quitar de frases guardadas' : 'Guardar como frase',
              onClick: async () => {
                await updateHighlight(h.id, { isFavorite: !h.isFavorite });
                showToast(h.isFavorite ? 'Frase quitada de guardadas.' : 'Frase guardada.');
                drawHighlights(num, width, height);
              }
            },
            {
              icon: 'trash',
              label: 'Eliminar resaltado',
              danger: true,
              onClick: async () => {
                await commitErase(h);
                drawHighlights(num, width, height);
              }
            }
          ]);
        });
        highlightLayer.appendChild(div);
      });
    });

    // Trazos de dibujo a mano alzada de esta pagina
    all.filter((h) => h.page === num && h.kind === 'drawing' && h.points && h.points.length > 1).forEach((h) => {
      drawingLayer.appendChild(strokeToPathEl(h, width, height));
    });
  }

  function strokeToPathEl(h, width, height) {
    const d = h.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', h.color || '#D4AF6A');
    path.setAttribute('stroke-width', Math.max(1, (h.strokeWidth || 0.005) * width));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.dataset.strokeId = h.id;
    return path;
  }

  // ---------------- DESHACER / REHACER ----------------
  // Historial de acciones de la sesion actual de lectura (se reinicia si
  // se recarga la pagina). Cubre tanto los resaltados de texto como los
  // trazos dibujados a mano, para que "Deshacer" funcione igual sin
  // importar cual de las dos herramientas se uso.
  let history = [];
  let historyIndex = -1;

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = historyIndex < 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1;
  }

  // Se llama cada vez que se crea un resaltado o trazo nuevo.
  async function commitAdd(record) {
    history = history.slice(0, historyIndex + 1);
    history.push({ type: 'add', record });
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
  }

  // Se llama cada vez que se borra un resaltado o trazo existente
  // (borrador, o el "Eliminar" del menu de un resaltado).
  async function commitErase(record) {
    await deleteHighlight(record.id);
    history = history.slice(0, historyIndex + 1);
    history.push({ type: 'erase', record });
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
  }

  async function undoAction() {
    if (historyIndex < 0) return;
    const entry = history[historyIndex];
    if (entry.type === 'add') await deleteHighlight(entry.record.id);
    else await restoreHighlight(entry.record);
    historyIndex--;
    await drawHighlights(pageNum, pageStack.offsetWidth, pageStack.offsetHeight);
    updateUndoRedoButtons();
  }

  async function redoAction() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    const entry = history[historyIndex];
    if (entry.type === 'add') await restoreHighlight(entry.record);
    else await deleteHighlight(entry.record.id);
    await drawHighlights(pageNum, pageStack.offsetWidth, pageStack.offsetHeight);
    updateUndoRedoButtons();
  }

  // La ultima seleccion para la que ya se mostro el selector de color, para
  // no volver a abrirlo repetidas veces mientras el usuario sigue ajustando
  // los "handles" de seleccion en movil.
  let lastSelectionSignature = '';

  function selectionSignature(range) {
    return [
      range.startContainer, range.startOffset,
      range.endContainer, range.endOffset
    ].join('|');
  }

  function handleSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!textLayer.contains(range.commonAncestorContainer)) return;

    const signature = selectionSignature(range);
    if (signature === lastSelectionSignature) return;

    const clientRects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (clientRects.length === 0) return;

    lastSelectionSignature = signature;

    const wrapRect = pageStack.getBoundingClientRect();
    const width = pageStack.offsetWidth;
    const height = pageStack.offsetHeight;

    const rects = clientRects.map((r) => ({
      x: (r.left - wrapRect.left) / width,
      y: (r.top - wrapRect.top) / height,
      w: r.width / width,
      h: r.height / height
    }));
    const text = selection.toString().slice(0, 300);

    showColorPicker(clientRects[clientRects.length - 1], async (color) => {
      const record = await addHighlight({
        bookId, page: pageNum, color, rects, text,
        style: styleSelect.value, isFavorite: favToggle.checked
      });
      await commitAdd(record);
      selection.removeAllRanges();
      lastSelectionSignature = '';
      drawHighlights(pageNum, width, height);
      if (favToggle.checked) showToast('Frase guardada en "Frases guardadas".');
    }, () => { lastSelectionSignature = ''; });
  }

  // En movil, el navegador tiene su propio menu nativo de "Copiar / Compartir
  // / Seleccionar todo" que aparece al remarcar texto y puede tapar nuestro
  // selector de color o cerrarlo antes de tiempo (el "click" fantasma que
  // dispara el sistema justo despues de soltar el dedo). Por eso:
  // 1) Ademas de "mouseup" (rapido en escritorio), escuchamos "touchend" y
  //    "selectionchange" con una pequeña espera, porque en tactil la
  //    seleccion puede seguir ajustandose un poco despues de levantar el dedo.
  // 2) El listener que cierra el picker al tocar afuera se agrega con un
  //    pequeño retraso y usa "pointerdown" en vez de "click", para no
  //    confundirse con el clic sintetico que genera el propio toque.
  let selectionTimer = null;
  function scheduleSelectionCheck(delay) {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(handleSelection, delay);
  }

  textLayer.addEventListener('mouseup', () => scheduleSelectionCheck(0));
  textLayer.addEventListener('touchend', () => scheduleSelectionCheck(350));
  document.addEventListener('selectionchange', function onSelectionChange() {
    if (!document.body.contains(shell)) { document.removeEventListener('selectionchange', onSelectionChange); return; }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!textLayer.contains(range.commonAncestorContainer)) return;
    scheduleSelectionCheck(450);
  });

  function showColorPicker(anchorRect, onPick, onDismiss) {
    const existing = document.querySelector('.highlight-picker');
    if (existing) existing.remove();

    let dismissed = false;
    function cleanup() {
      if (dismissed) return;
      dismissed = true;
      picker.remove();
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
    }
    function pick(color) {
      cleanup();
      onPick(color);
    }
    function onPointerDownOutside(e) {
      if (picker.contains(e.target)) return;
      cleanup();
      if (onDismiss) onDismiss();
    }

    const customInput = el('input', { type: 'color', class: 'swatch swatch-custom', value: '#D4AF6A', title: 'Color personalizado' });
    // El listener de "cerrar al tocar afuera" (mas abajo) escucha toda la
    // pagina. Sin detener la propagacion aqui, el simple hecho de abrir el
    // selector de color nativo (o de tocar un swatch) cerraba y eliminaba
    // este picker antes de poder elegir un color.
    customInput.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    customInput.addEventListener('input', (e) => { e.stopPropagation(); });
    customInput.addEventListener('change', (e) => { e.stopPropagation(); pick(customInput.value); });
    const picker = el('div', { class: 'highlight-picker' }, [
      ...HIGHLIGHT_COLORS.map((c) => el('button', {
        class: 'swatch',
        type: 'button',
        style: `background:${c}`,
        onPointerdown: (e) => { e.stopPropagation(); },
        onClick: (e) => { e.stopPropagation(); pick(c); }
      })),
      customInput
    ]);
    document.body.appendChild(picker);

    // Posicionamos despues de insertarlo para poder medir su tamaño real y
    // no dejarlo fuera de la pantalla en moviles con poco espacio.
    const pickerRect = picker.getBoundingClientRect();
    const margin = 8;
    let left = anchorRect.right + window.scrollX;
    let top = anchorRect.bottom + window.scrollY + 6;
    if (left + pickerRect.width > window.scrollX + window.innerWidth - margin) {
      left = window.scrollX + window.innerWidth - pickerRect.width - margin;
    }
    if (left < window.scrollX + margin) left = window.scrollX + margin;
    if (top + pickerRect.height > window.scrollY + window.innerHeight - margin) {
      top = anchorRect.top + window.scrollY - pickerRect.height - 6;
    }
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;

    // Retraso antes de armar el cierre por toque afuera, para no cerrarlo
    // con el mismo gesto que acaba de terminar la seleccion de texto.
    setTimeout(() => document.addEventListener('pointerdown', onPointerDownOutside, true), 300);
  }

  // ---------------- BUSQUEDA DE TEXTO ----------------
  async function runSearch(query) {
    const body = document.getElementById('side-panel-results');
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'empty-shelf' }, 'Buscando...'));
    if (!query || !query.trim()) {
      body.innerHTML = '';
      body.appendChild(el('p', { class: 'empty-shelf' }, 'Escribe una palabra o frase y presiona Enter.'));
      return;
    }
    const q = query.trim().toLowerCase();
    const results = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const tc = await page.getTextContent();
      const strs = tc.items.map((it) => it.str).join(' ');
      const idx = strs.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const snippet = `${start > 0 ? '…' : ''}${strs.slice(start, idx + q.length + 40)}…`;
        results.push({ page: i, snippet });
      }
      if (results.length >= 40) break;
    }
    body.innerHTML = '';
    if (results.length === 0) {
      body.appendChild(el('p', { class: 'empty-shelf' }, 'No se encontraron resultados.'));
      return;
    }
    results.forEach((r) => {
      const card = el('div', {
        class: 'side-panel-result', onClick: () => { pageNum = r.page; renderPage(pageNum, { animate: true }); }
      }, [
        el('p', { class: 'side-panel-result-snippet' }, r.snippet),
        el('span', { class: 'side-panel-result-page' }, `Pagina ${r.page}`)
      ]);
      body.appendChild(card);
    });
  }

  // ---------------- NOTAS DE TEXTO LIBRE ----------------
  // A diferencia de los resaltados (que nacen de seleccionar texto del
  // PDF), una nota es un pensamiento propio del lector, sin texto de
  // origen. Reusa la misma tabla/almacen que los resaltados con
  // kind:'note', asi el resto de la infraestructura (deshacer, borrar,
  // sincronizacion) ya funciona sin cambios.
  let currentSidePanelTab = null;

  function openNoteEditor(existingNote = null) {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const textarea = el('textarea', { class: 'input note-textarea', rows: '5', placeholder: 'Escribe tu nota para esta pagina...' }, existingNote ? existingNote.text : '');
    const saveBtn = el('button', { class: 'btn btn-gold', type: 'submit' }, existingNote ? 'Guardar cambios' : 'Agregar nota');
    const deleteBtn = existingNote ? el('button', {
      class: 'btn btn-danger', type: 'button',
      onClick: async () => {
        if (!confirm('¿Eliminar esta nota?')) return;
        await commitErase(existingNote);
        backdrop.remove();
        showToast('Nota eliminada.');
        if (currentSidePanelTab === 'notes') openSidePanel('notes');
      }
    }, 'Eliminar') : null;

    const form = el('form', {}, [
      textarea,
      el('div', { style: 'display:flex; gap:8px; justify-content:flex-end; margin-top:10px;' }, [
        deleteBtn,
        el('button', { type: 'button', class: 'btn btn-ghost', onClick: () => backdrop.remove() }, 'Cancelar'),
        saveBtn
      ])
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textarea.value.trim();
      if (!text) { showToast('Escribe algo antes de guardar.'); return; }
      if (existingNote) {
        await updateHighlight(existingNote.id, { text });
        showToast('Nota actualizada.');
      } else {
        const record = await addHighlight({ bookId, page: pageNum, kind: 'note', text, rects: [], color: '#B08A4E' });
        await commitAdd(record);
        showToast('Nota guardada en esta pagina.');
      }
      backdrop.remove();
      if (currentSidePanelTab === 'notes') openSidePanel('notes');
    });

    backdrop.appendChild(el('div', { class: 'modal panel' }, [
      el('div', { class: 'modal-header' }, [
        el('h2', {}, existingNote ? 'Editar nota' : `Nueva nota — pagina ${pageNum}`),
        el('button', { class: 'btn btn-ghost btn-sm modal-close', type: 'button', onClick: () => backdrop.remove() }, icon('close', { size: 15 }))
      ]),
      form
    ]));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.body.appendChild(backdrop);
    setTimeout(() => textarea.focus(), 50);
  }

  noteBtn.addEventListener('click', () => openNoteEditor());
  notesPanelBtn.addEventListener('click', () => openSidePanel('notes'));

  function openSidePanel(tab) {
    currentSidePanelTab = tab;
    sidePanel.classList.add('open');
    const title = document.getElementById('side-panel-title');
    const body = document.getElementById('side-panel-body');
    body.innerHTML = '';
    if (tab === 'notes') {
      title.innerHTML = '';
      title.appendChild(icon('edit', { size: 15 }));
      title.appendChild(el('span', {}, 'Notas de este libro'));
      body.appendChild(el('p', { class: 'empty-shelf' }, 'Cargando...'));
      listHighlights(bookId).then((all) => {
        const notes = all.filter((h) => h.kind === 'note').sort((a, b) => a.page - b.page);
        body.innerHTML = '';
        body.appendChild(el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', style: 'margin-bottom:10px;',
          onClick: () => openNoteEditor()
        }, [icon('plus', { size: 13 }), el('span', {}, `Nota en pagina ${pageNum}`)]));
        if (notes.length === 0) {
          body.appendChild(el('p', { class: 'empty-shelf' }, 'Aun no tienes notas en este libro. Usa el boton "Nota" en la barra superior.'));
          return;
        }
        notes.forEach((n) => {
          const card = el('div', { class: 'side-panel-result', style: 'border-left: 3px solid var(--color-gold);' }, [
            el('p', { class: 'side-panel-result-snippet' }, n.text),
            el('div', { class: 'saved-phrase-meta' }, [
              el('span', { class: 'side-panel-result-page' }, `Pagina ${n.page}`),
              el('button', { class: 'link', type: 'button', onClick: (e) => { e.stopPropagation(); openNoteEditor(n); } }, 'Editar')
            ])
          ]);
          card.addEventListener('click', () => { pageNum = n.page; renderPage(pageNum, { animate: true }); });
          body.appendChild(card);
        });
      });
    } else if (tab === 'search') {
      title.textContent = 'Buscar en el libro';
      const input = el('input', { class: 'input', placeholder: 'Buscar palabra o frase...' });
      const form = el('form', { class: 'side-panel-search-form' }, [
        input, el('button', { class: 'btn btn-gold btn-sm', type: 'submit' }, 'Buscar')
      ]);
      form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(input.value); });
      body.appendChild(form);
      body.appendChild(el('div', { id: 'side-panel-results' }));
      setTimeout(() => input.focus(), 50);
    } else if (tab === 'favorites') {
      title.innerHTML = '';
      title.appendChild(icon('starFilled', { size: 16 }));
      title.appendChild(el('span', {}, 'Frases guardadas de este libro'));
      body.appendChild(el('p', { class: 'empty-shelf' }, 'Cargando...'));
      listHighlights(bookId).then((all) => {
        const favs = all.filter((h) => h.isFavorite);
        body.innerHTML = '';
        if (favs.length === 0) {
          body.appendChild(el('p', { class: 'empty-shelf' }, 'Aun no has guardado frases de este libro. Selecciona texto, activa "Guardar como frase" y remarca.'));
          return;
        }
        favs.forEach((f) => {
          const card = el('div', {
            class: 'side-panel-result', style: `border-left: 3px solid ${f.color};`,
            onClick: () => { pageNum = f.page; renderPage(pageNum, { animate: true }); }
          }, [
            el('p', { class: 'side-panel-result-snippet' }, `"${f.text}"`),
            el('span', { class: 'side-panel-result-page' }, `Pagina ${f.page}`)
          ]);
          body.appendChild(card);
        });
      });
    }
  }

  searchBtn.addEventListener('click', () => openSidePanel('search'));
  favPanelBtn.addEventListener('click', () => openSidePanel('favorites'));
  sidePanel.querySelector('#side-panel-close').addEventListener('click', () => sidePanel.classList.remove('open'));

  bookmarkBtn.addEventListener('click', async () => {
    const newVal = (bookRecord && bookRecord.bookmarkPage === pageNum) ? null : pageNum;
    await updateBook(bookId, { bookmarkPage: newVal });
    if (bookRecord) bookRecord.bookmarkPage = newVal;
    showToast(newVal ? `Marcador guardado en la pagina ${pageNum}.` : 'Marcador eliminado.');
    updateBookmarkBtnState();
  });

  toolbar.querySelector('#prev-page').addEventListener('click', () => {
    if (pageNum <= 1) return;
    pageNum -= 1; renderPage(pageNum, { animate: true, direction: 'prev' });
  });
  toolbar.querySelector('#next-page').addEventListener('click', () => {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum += 1; renderPage(pageNum, { animate: true, direction: 'next' });
  });
  toolbar.querySelector('#zoom-in').addEventListener('click', () => { scale = Math.min(scale + 0.2, 3); renderPage(pageNum); });
  toolbar.querySelector('#zoom-out').addEventListener('click', () => { scale = Math.max(scale - 0.2, 0.5); renderPage(pageNum); });

  // ---------------- MODO: seleccionar / dibujar / borrar ----------------
  let readerMode = 'select';
  let penColor = '#D4AF6A';
  let penWidth = parseFloat(PEN_WIDTHS[1].value);

  const modeSelectBtn = toolbar2.querySelector('#mode-select');
  const modeDrawBtn = toolbar2.querySelector('#mode-draw');
  const modeEraseBtn = toolbar2.querySelector('#mode-erase');
  const selectToolsGroup = toolbar2.querySelector('.group-select-tools');
  const drawToolsGroup = toolbar2.querySelector('#draw-tools');
  const readerHintText = toolbar2.querySelector('.reader-hint-text');
  const undoBtn = toolbar2.querySelector('#undo-btn');
  const redoBtn = toolbar2.querySelector('#redo-btn');
  const penWidthSelect = toolbar2.querySelector('#pen-width-select');

  function setMode(mode) {
    readerMode = mode;
    [modeSelectBtn, modeDrawBtn, modeEraseBtn].forEach((b) => b.classList.remove('active'));
    if (mode === 'select') modeSelectBtn.classList.add('active');
    if (mode === 'draw') modeDrawBtn.classList.add('active');
    if (mode === 'erase') modeEraseBtn.classList.add('active');

    selectToolsGroup.style.display = mode === 'select' ? 'flex' : 'none';
    drawToolsGroup.style.display = mode === 'draw' ? 'flex' : 'none';

    // En modo dibujo/borrado, la capa de texto deja de capturar el
    // puntero (para no interferir con el trazo) y la capa de dibujo
    // pasa a capturarlo; en modo seleccion es al reves.
    textLayer.style.pointerEvents = mode === 'select' ? 'auto' : 'none';
    drawingLayer.style.pointerEvents = mode === 'select' ? 'none' : 'auto';
    drawingLayer.classList.toggle('erase-cursor', mode === 'erase');
    drawingLayer.classList.toggle('draw-cursor', mode === 'draw');

    if (readerHintText) {
      readerHintText.textContent = mode === 'draw'
        ? 'Dibuja con el mouse o el dedo sobre la pagina'
        : mode === 'erase'
          ? 'Toca o arrastra sobre un trazo para borrarlo'
          : 'Selecciona texto para remarcar';
    }
  }

  modeSelectBtn.addEventListener('click', () => setMode('select'));
  modeDrawBtn.addEventListener('click', () => setMode('draw'));
  modeEraseBtn.addEventListener('click', () => setMode('erase'));

  drawToolsGroup.querySelectorAll('.pen-swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      penColor = sw.dataset.color;
      drawToolsGroup.querySelectorAll('.pen-swatch').forEach((s) => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });
  drawToolsGroup.querySelector('.pen-swatch')?.classList.add('selected');
  drawToolsGroup.querySelector('.pen-swatch-custom').addEventListener('input', (e) => {
    penColor = e.target.value;
    drawToolsGroup.querySelectorAll('.pen-swatch').forEach((s) => s.classList.remove('selected'));
  });
  penWidthSelect.addEventListener('change', () => { penWidth = parseFloat(penWidthSelect.value); });

  // ---- Dibujar a mano alzada ----
  let currentStrokePoints = null;
  let liveStrokePath = null;

  function pointerToNormalized(e) {
    const rect = pageStack.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)
    };
  }

  drawingLayer.addEventListener('pointerdown', (e) => {
    if (readerMode === 'draw') {
      e.preventDefault();
      drawingLayer.setPointerCapture(e.pointerId);
      currentStrokePoints = [pointerToNormalized(e)];
      liveStrokePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      liveStrokePath.setAttribute('fill', 'none');
      liveStrokePath.setAttribute('stroke', penColor);
      liveStrokePath.setAttribute('stroke-width', Math.max(1, penWidth * pageStack.offsetWidth));
      liveStrokePath.setAttribute('stroke-linecap', 'round');
      liveStrokePath.setAttribute('stroke-linejoin', 'round');
      drawingLayer.appendChild(liveStrokePath);
    } else if (readerMode === 'erase') {
      e.preventDefault();
      drawingLayer.setPointerCapture(e.pointerId);
      eraseAtPoint(e);
    }
  });
  drawingLayer.addEventListener('pointermove', (e) => {
    if (readerMode === 'draw' && currentStrokePoints) {
      currentStrokePoints.push(pointerToNormalized(e));
      const width = pageStack.offsetWidth;
      const height = pageStack.offsetHeight;
      const d = currentStrokePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(' ');
      liveStrokePath.setAttribute('d', d);
    } else if (readerMode === 'erase' && e.buttons === 1) {
      eraseAtPoint(e);
    }
  });
  async function finishStroke() {
    if (!currentStrokePoints) return;
    const points = currentStrokePoints;
    currentStrokePoints = null;
    if (liveStrokePath) { liveStrokePath.remove(); liveStrokePath = null; }
    if (points.length < 2) return;
    const record = await addHighlight({
      bookId, page: pageNum, color: penColor, kind: 'drawing',
      points, strokeWidth: penWidth, rects: []
    });
    await commitAdd(record);
    drawHighlights(pageNum, pageStack.offsetWidth, pageStack.offsetHeight);
  }
  drawingLayer.addEventListener('pointerup', finishStroke);
  drawingLayer.addEventListener('pointercancel', finishStroke);

  // ---- Borrador: recuerda que trazos ya se borraron en el arrastre actual ----
  let erasedThisDrag = new Set();
  drawingLayer.addEventListener('pointerup', () => { erasedThisDrag = new Set(); });
  async function eraseAtPoint(e) {
    const rect = pageStack.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const strokeId = target?.dataset?.strokeId;
    if (!strokeId || erasedThisDrag.has(strokeId)) return;
    const all = await listHighlights(bookId);
    const record = all.find((h) => h.id === strokeId);
    if (!record) return;
    erasedThisDrag.add(strokeId);
    await commitErase(record);
    drawHighlights(pageNum, pageStack.offsetWidth, pageStack.offsetHeight);
  }

  undoBtn.addEventListener('click', undoAction);
  redoBtn.addEventListener('click', redoAction);
  setMode('select');

  document.addEventListener('keydown', function onDrawKey(e) {
    if (!document.body.contains(shell)) { document.removeEventListener('keydown', onDrawKey); return; }
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undoAction(); }
    if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redoAction(); }
  });

  document.addEventListener('keydown', function onKey(e) {
    if (!document.body.contains(shell)) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowRight') toolbar.querySelector('#next-page').click();
    if (e.key === 'ArrowLeft') toolbar.querySelector('#prev-page').click();
  });

  await renderPage(pageNum);
  showToast('Libro cargado. Selecciona texto para remarcarlo.');
}
