import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  getBookFile, getBook, updateBook, getCurrentUser,
  addHighlight, listHighlights, deleteHighlight, updateHighlight
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

  bookmarkBtn.setAttribute('title', 'Marcar esta pagina');

  const toolbar = el('div', { class: 'reader-toolbar' }, [
    el('div', { class: 'group group-back' }, [
      el('button', { class: 'icon reader-back-btn', title: 'Volver a la estanteria', onClick: () => navigate('#/dashboard') }, [icon('arrowLeft', { size: 15 }), el('span', { class: 'icn-label' }, 'Volver a la estanteria')])
    ]),
    el('div', { class: 'group reader-pager' }, [
      el('button', { class: 'page-turn-btn', id: 'prev-page', title: 'Pagina anterior' }, icon('chevronLeft', { size: 17 })),
      pageIndicator,
      el('button', { class: 'page-turn-btn', id: 'next-page', title: 'Pagina siguiente' }, icon('chevronRight', { size: 17 }))
    ]),
    el('div', { class: 'group group-tools' }, [
      bookmarkBtn,
      el('span', { class: 'toolbar-divider', 'aria-hidden': 'true' }),
      searchBtn,
      favPanelBtn,
      el('span', { class: 'toolbar-divider', 'aria-hidden': 'true' }),
      el('button', { class: 'icon icon-round', id: 'zoom-out', title: 'Alejar' }, icon('zoomOut', { size: 15 })),
      el('button', { class: 'icon icon-round', id: 'zoom-in', title: 'Acercar' }, icon('zoomIn', { size: 15 }))
    ])
  ]);

  const toolbar2 = el('div', { class: 'reader-toolbar reader-toolbar-2' }, [
    el('div', { class: 'group' }, [
      el('span', { class: 'reader-hint' }, [icon('brush', { size: 12 }), el('span', { class: 'reader-hint-text' }, 'Selecciona texto para remarcar')]),
      el('span', { class: 'toolbar-divider toolbar-divider-v2', 'aria-hidden': 'true' }),
      el('label', { class: 'reader-inline-label' }, 'Estilo:'),
      styleSelect,
      el('label', { class: 'reader-inline-label reader-fav-label' }, [favToggle, icon('starOutline', { size: 13 }), el('span', {}, 'Guardar como frase')])
    ])
  ]);

  const canvasWrap = el('div', { class: 'reader-canvas-wrap' });
  const pageStack = el('div', { class: 'page-stack' });
  const canvas = el('canvas', { id: 'pdf-canvas' });
  const highlightLayer = el('div', { class: 'highlight-layer' });
  const textLayer = el('div', { class: 'textLayer' });
  pageStack.appendChild(canvas);
  pageStack.appendChild(highlightLayer);
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

  await updateBook(bookId, { totalPages: pdfDoc.numPages });

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
    const all = await listHighlights(bookId);
    all.filter((h) => h.page === num).forEach((h) => {
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
                await deleteHighlight(h.id);
                drawHighlights(num, width, height);
              }
            }
          ]);
        });
        highlightLayer.appendChild(div);
      });
    });
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
      await addHighlight({
        bookId, page: pageNum, color, rects, text,
        style: styleSelect.value, isFavorite: favToggle.checked
      });
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

  function openSidePanel(tab) {
    sidePanel.classList.add('open');
    const title = document.getElementById('side-panel-title');
    const body = document.getElementById('side-panel-body');
    body.innerHTML = '';
    if (tab === 'search') {
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

  document.addEventListener('keydown', function onKey(e) {
    if (!document.body.contains(shell)) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowRight') toolbar.querySelector('#next-page').click();
    if (e.key === 'ArrowLeft') toolbar.querySelector('#prev-page').click();
  });

  await renderPage(pageNum);
  showToast('Libro cargado. Selecciona texto para remarcarlo.');
}
