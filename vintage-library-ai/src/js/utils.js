// Utilidades de UI compartidas
import { icon } from './icons.js';

export function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

const BOOLEAN_ATTRS = new Set(['disabled', 'required', 'checked', 'readonly', 'selected', 'autofocus']);

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (BOOLEAN_ATTRS.has(key)) {
      // Los atributos booleanos deben AUSENTARSE cuando su valor es falso,
      // ya que en HTML la sola presencia del atributo (incluso ="false")
      // ya activa el comportamiento (ej: <button disabled="false"> sigue deshabilitado).
      if (value === true || value === 'true') node.setAttribute(key, '');
      else node.removeAttribute(key);
    } else {
      node.setAttribute(key, value);
    }
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

// ---------------------------------------------------------
// Boton con icono + etiqueta (reemplaza los emojis sueltos)
// ---------------------------------------------------------
export function iconBtn(iconName, label, props = {}, iconSize = 17) {
  const children = [icon(iconName, { size: iconSize })];
  if (label) children.push(el('span', { class: 'icn-label' }, label));
  return el('button', { class: 'btn', type: 'button', ...props }, children);
}

// ---------------------------------------------------------
// Overlay de carga con tema vintage (libro que se abre)
// ---------------------------------------------------------
export function showLoadingOverlay(container, message = 'Cargando...') {
  hideLoadingOverlay(container);
  const overlay = el('div', { class: 'loading-overlay' }, [
    el('div', { class: 'loading-book' }, [
      el('div', { class: 'loading-book-page loading-book-page-1' }),
      el('div', { class: 'loading-book-page loading-book-page-2' }),
      el('div', { class: 'loading-book-spine' })
    ]),
    el('p', { class: 'loading-message' }, message)
  ]);
  overlay.dataset.loadingOverlay = 'true';
  container.style.position = container.style.position || 'relative';
  container.appendChild(overlay);
  return overlay;
}

export function hideLoadingOverlay(container) {
  container.querySelectorAll('[data-loading-overlay="true"]').forEach((n) => n.remove());
}

// ---------------------------------------------------------
// Menu contextual flotante reutilizable (para acciones de
// libro, resaltados, etc.)
// ---------------------------------------------------------
export function showMenu(anchorRect, items) {
  const existing = document.querySelector('.floating-menu');
  if (existing) existing.remove();
  const menu = el('div', {
    class: 'floating-menu',
    style: `left:${anchorRect.left + window.scrollX}px; top:${anchorRect.bottom + window.scrollY + 4}px;`
  }, items.map((item) => el('button', {
    class: `floating-menu-item${item.danger ? ' is-danger' : ''}`,
    type: 'button',
    onClick: (e) => { e.stopPropagation(); menu.remove(); item.onClick(); }
  }, [
    item.icon ? icon(item.icon, { size: 15 }) : null,
    el('span', {}, item.label)
  ])));
  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function closeOnce() {
      menu.remove();
      document.removeEventListener('click', closeOnce);
    }, { once: true });
  }, 0);
  return menu;
}
