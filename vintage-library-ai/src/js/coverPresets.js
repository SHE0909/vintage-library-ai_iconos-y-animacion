// =========================================================
// PORTADAS PREDISEÑADAS
// =========================================================
// Diseños generados 100% con CSS (gradientes/patrones), sin
// imagenes externas, para que el usuario pueda elegir una
// portada rapida si no quiere subir su propia imagen.
export const COVER_PRESETS = [
  {
    id: 'leather-classic',
    label: 'Cuero clasico',
    css: `background:
      repeating-linear-gradient(135deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 2px, transparent 2px, transparent 10px),
      linear-gradient(160deg, #6B4426, #3B2413 70%);
      border: 2px solid rgba(212,175,106,0.55);`
  },
  {
    id: 'botanical',
    label: 'Botanica',
    css: `background:
      radial-gradient(circle at 20% 20%, rgba(212,175,106,0.25) 0, transparent 40%),
      radial-gradient(circle at 80% 75%, rgba(212,175,106,0.18) 0, transparent 45%),
      linear-gradient(160deg, #7C8B6F, #4B5740 75%);`
  },
  {
    id: 'marbled',
    label: 'Marmoleado',
    css: `background:
      repeating-radial-gradient(circle at 30% 40%, rgba(212,175,106,0.15) 0, transparent 18%),
      repeating-radial-gradient(circle at 70% 65%, rgba(0,0,0,0.15) 0, transparent 22%),
      linear-gradient(160deg, #6B2737, #3B1420 75%);`
  },
  {
    id: 'starry-ink',
    label: 'Cielo de tinta',
    css: `background:
      radial-gradient(1.5px 1.5px at 20% 25%, #D4AF6A 100%, transparent 100%),
      radial-gradient(1.5px 1.5px at 65% 15%, #D4AF6A 100%, transparent 100%),
      radial-gradient(1.5px 1.5px at 40% 55%, #D4AF6A 100%, transparent 100%),
      radial-gradient(1.5px 1.5px at 80% 70%, #D4AF6A 100%, transparent 100%),
      radial-gradient(1.5px 1.5px at 15% 80%, #D4AF6A 100%, transparent 100%),
      radial-gradient(1.5px 1.5px at 55% 85%, #D4AF6A 100%, transparent 100%),
      linear-gradient(160deg, #2A1D14, #14100b 75%);`
  },
  {
    id: 'goldleaf',
    label: 'Filo dorado',
    css: `background:
      linear-gradient(90deg, rgba(212,175,106,0.9) 0px, rgba(212,175,106,0.9) 4px, transparent 4px, transparent 12px),
      linear-gradient(160deg, #B08A4E, #5C3A21 80%);`
  }
];

export function getCoverPreset(id) {
  return COVER_PRESETS.find((p) => p.id === id) || null;
}
