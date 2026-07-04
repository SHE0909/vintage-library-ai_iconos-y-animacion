// =========================================================
// Fondo ambiental: petalos de rosa color vino cayendo.
// Se monta UNA sola vez en el <body>, fuera de #app, para que
// no se destruya cada vez que cambia de pantalla (login,
// biblioteca, lector). Es puramente decorativo: no bloquea
// clics ni toques (pointer-events: none).
// =========================================================

const PETAL_COUNT = 16;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function mountRosePetals() {
  if (document.querySelector('.rose-petals-bg')) return; // ya montado

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const container = document.createElement('div');
  container.className = 'rose-petals-bg';
  container.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < PETAL_COUNT; i++) {
    const petal = document.createElement('div');
    petal.className = 'rose-petal';
    petal.style.setProperty('--petal-left', `${randomBetween(0, 100)}%`);
    petal.style.setProperty('--petal-size', `${randomBetween(9, 20).toFixed(1)}px`);
    petal.style.setProperty('--petal-opacity', randomBetween(0.35, 0.8).toFixed(2));
    petal.style.setProperty('--petal-duration', `${randomBetween(11, 22).toFixed(1)}s`);
    petal.style.setProperty('--petal-delay', `-${randomBetween(0, 20).toFixed(1)}s`);
    petal.style.setProperty('--petal-drift', `${randomBetween(20, 70).toFixed(0)}px`);
    petal.style.transform = `rotate(${randomBetween(0, 360).toFixed(0)}deg)`;
    container.appendChild(petal);
  }

  document.body.insertBefore(container, document.body.firstChild);
}
