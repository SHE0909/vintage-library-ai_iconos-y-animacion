// =========================================================
// TEMAS DE FONDO (papel, madera, cuero, marmol, nocturno)
// =========================================================
// El fondo se aplica como atributo data-theme en <body>; las reglas
// visuales de cada tema viven en main.css. Aqui solo guardamos la
// lista (para pintar el selector) y la logica de guardar/aplicar.
const LS_THEME = 'vl_theme';

export const BG_THEMES = [
  { id: 'parchment', label: 'Papel envejecido', swatch: 'linear-gradient(160deg, #ECE2CC, #DED0AE)' },
  { id: 'amaderado', label: 'Amaderado', swatch: 'repeating-linear-gradient(90deg, #7a5232 0px, #6b4426 8px, #7a5232 16px)' },
  { id: 'cuero', label: 'Cuero', swatch: 'radial-gradient(circle at 40% 30%, #5c3a21, #2a1d14 80%)' },
  { id: 'marmol', label: 'Marmol', swatch: 'linear-gradient(160deg, #e7e2d8, #b9b2a1 70%)' },
  { id: 'nocturno', label: 'Biblioteca nocturna', swatch: 'linear-gradient(160deg, #1a1712, #0c0a08 70%)' }
];

export function getStoredTheme() {
  try {
    return localStorage.getItem(LS_THEME) || 'parchment';
  } catch {
    return 'parchment';
  }
}

export function applyTheme(id) {
  const valid = BG_THEMES.some((t) => t.id === id) ? id : 'parchment';
  document.body.dataset.theme = valid;
  try { localStorage.setItem(LS_THEME, valid); } catch { /* almacenamiento no disponible, seguimos igual */ }
}

// Llamar una sola vez al iniciar la app para restaurar el tema elegido.
export function initTheme() {
  applyTheme(getStoredTheme());
}
