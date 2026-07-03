// =========================================================
// ICONOS — set de linea unico para toda la app (reemplaza emojis)
// Estilo: trazo fino, look "grabado en cuero", currentColor.
// =========================================================
const STROKE = '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{{inner}}</g>';

const RAW = {
  menu: '<line x1="3.5" y1="6.5" x2="20.5" y2="6.5"/><line x1="3.5" y1="12" x2="20.5" y2="12"/><line x1="3.5" y1="17.5" x2="20.5" y2="17.5"/>',
  book: '<path d="M12 6.2C10.6 5 8.4 4.3 5.7 4.2c-.7 0-1.2.6-1.2 1.2v11.8c0 .7.6 1.2 1.3 1.2 2.3.1 4.3.7 5.6 1.7"/><path d="M12 6.2c1.4-1.2 3.6-1.9 6.3-2 .7 0 1.2.6 1.2 1.2v11.8c0 .7-.6 1.2-1.3 1.2-2.3.1-4.3.7-5.6 1.7"/><line x1="12" y1="6.2" x2="12" y2="20.1"/>',
  starOutline: '<path d="M12 4.2l2.1 4.6 5 .5-3.7 3.5 1 5-4.4-2.5-4.4 2.5 1-5-3.7-3.5 5-.5L12 4.2Z"/>',
  starFilled: '<path d="M12 4.2l2.1 4.6 5 .5-3.7 3.5 1 5-4.4-2.5-4.4 2.5 1-5-3.7-3.5 5-.5L12 4.2Z" fill="currentColor"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M4.5 8.5v9.2c0 1 .8 1.8 1.8 1.8h11.4c1 0 1.8-.8 1.8-1.8V8.5"/><line x1="9.7" y1="12.3" x2="14.3" y2="12.3"/>',
  trash: '<line x1="4.5" y1="6.5" x2="19.5" y2="6.5"/><path d="M9.5 6.5v-1c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1"/><path d="M6.5 6.5l.8 12c.1 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8l.8-12"/><line x1="10.2" y1="10.2" x2="10.5" y2="17"/><line x1="13.8" y1="10.2" x2="13.5" y2="17"/>',
  check: '<polyline points="4.5,12.5 9.5,17.5 19.5,6.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.2"/><polyline points="8.3,12.3 11,15 15.8,9.2"/>',
  edit: '<path d="M15.6 4.9l3.5 3.5-10 10-4.1 1 1-4.1 9.6-10.4Z"/><line x1="14.1" y1="6.4" x2="17.6" y2="9.9"/>',
  kebab: '<circle cx="12" cy="5.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="18.4" r="1.15" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.6" cy="10.6" r="6.1"/><line x1="15.2" y1="15.2" x2="20" y2="20"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11Z"/><circle cx="12" cy="9.8" r="2.1"/>',
  chevronLeft: '<polyline points="14.5,5.5 8,12 14.5,18.5"/>',
  chevronRight: '<polyline points="9.5,5.5 16,12 9.5,18.5"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  zoomIn: '<circle cx="10.6" cy="10.6" r="6.1"/><line x1="15.2" y1="15.2" x2="20" y2="20"/><line x1="10.6" y1="7.6" x2="10.6" y2="13.6"/><line x1="7.6" y1="10.6" x2="13.6" y2="10.6"/>',
  zoomOut: '<circle cx="10.6" cy="10.6" r="6.1"/><line x1="15.2" y1="15.2" x2="20" y2="20"/><line x1="7.6" y1="10.6" x2="13.6" y2="10.6"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  brush: '<path d="M6.5 15.7c-1.2 0-2.2 1-2.2 2.2 0 1.6-1 2.1-1.8 2.1 1 1.1 2.5 1.5 3.9 1.5 2.1 0 3.8-1.7 3.8-3.8 0-1.1-.9-2-2-2Z"/><path d="M9 13.5 17.8 4.7a1.7 1.7 0 0 1 2.5 0 1.7 1.7 0 0 1 0 2.5L11.5 16"/>',
  underline: '<path d="M6.5 4.5v6.7a5.5 5.5 0 0 0 11 0V4.5"/><line x1="5" y1="19" x2="19" y2="19"/>',
  strike: '<path d="M7 7.2c0-1.7 1.9-2.9 4.6-2.9 2.3 0 4.2.9 4.9 2.3"/><path d="M8 17c.5 1.6 2.3 2.7 4.4 2.7 2.8 0 4.8-1.3 4.8-3.1 0-1.4-1-2.2-2.7-2.7"/><line x1="4" y1="12" x2="20" y2="12"/>',
  box: '<rect x="4.5" y="4.5" width="15" height="15" rx="1.2"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="10.5,6 5,12 10.5,18"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13.5,6 19,12 13.5,18"/>',
  squareCheck: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.2"/><polyline points="8.3,12.3 11,15 15.8,9.2"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.2"/>',
  logout: '<path d="M14.5 8V6.2c0-.9-.7-1.7-1.7-1.7H6.2c-.9 0-1.7.8-1.7 1.7v11.6c0 .9.8 1.7 1.7 1.7h6.6c1 0 1.7-.8 1.7-1.7V16"/><line x1="9.5" y1="12" x2="20" y2="12"/><polyline points="16.7,8.7 20,12 16.7,15.3"/>',
  leaf: '<path d="M6 18C4.5 12 8 6 18 5c1 8-4.5 13.5-12 13Z"/><path d="M6 18c2-3.5 5-6.5 9-9"/>'
};

export function iconMarkup(name, { size = 18 } = {}) {
  const inner = RAW[name];
  if (!inner) return '';
  const body = STROKE.replace('{{inner}}', inner);
  return `<svg class="icn" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Devuelve un <span class="icn-wrap"> con el SVG dentro, listo para usar como hijo de el(...)
export function icon(name, { size = 18, className = '' } = {}) {
  const span = document.createElement('span');
  span.className = `icn-wrap${className ? ' ' + className : ''}`;
  span.innerHTML = iconMarkup(name, { size });
  return span;
}

// Devuelve [icono, texto] para usar como hijos de un boton: el('button', {}, iconText('trash', 'Eliminar'))
export function iconText(name, text, opts = {}) {
  return [icon(name, opts), el_span(text)];
}

function el_span(text) {
  const s = document.createElement('span');
  s.className = 'icn-label';
  s.textContent = text;
  return s;
}
