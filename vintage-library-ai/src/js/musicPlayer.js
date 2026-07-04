// =========================================================
// REPRODUCTOR DE MUSICA AMBIENTAL (flotante, fuera de #app)
// =========================================================
// Dos formas de escuchar musica mientras se lee, ambas sin necesidad
// de pagar ni de que cada usuario consiga su propia clave de API:
//
// 1) "Tu musica": el usuario sube sus propios archivos de audio desde
//    su dispositivo. Se guardan en IndexedDB (en su propio navegador)
//    para que la lista sobreviva a recargar la pagina.
// 2) "Radio": estaciones de radio por internet gratis, sin registro ni
//    API key, usando Radio Browser (https://www.radio-browser.info),
//    un directorio publico y abierto de radios. Ideal para musica de
//    fondo tipo jazz / lofi / clasica mientras se lee.
import { el, showToast } from './utils.js';
import { icon } from './icons.js';

const LS_VOLUME = 'vl_music_volume';
const RADIO_TAGS = ['jazz', 'lofi', 'piano', 'clasica', 'ambient', 'bossa nova'];
// Varios espejos del mismo servicio: si uno falla probamos el siguiente.
const RADIO_API_HOSTS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://nl1.api.radio-browser.info'];

// ---- IndexedDB minimo para guardar los audios subidos por el usuario ----
const DB_NAME = 'vintage_library_music';
const STORE = 'tracks';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(track) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(track);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function uid() { return `track_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

async function searchRadioStations(query) {
  const params = new URLSearchParams({ limit: '24', hidebroken: 'true', order: 'clickcount', reverse: 'true' });
  if (query) params.set('name', query); else params.set('tag', 'jazz');
  for (const host of RADIO_API_HOSTS) {
    try {
      const res = await fetch(`${host}/json/stations/search?${params.toString()}`);
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // probamos el siguiente espejo
    }
  }
  throw new Error('No se pudo conectar con el directorio de radios.');
}

export function mountMusicPlayer() {
  const audio = el('audio', { id: 'vl-music-audio' });
  const savedVolume = parseFloat(localStorage.getItem(LS_VOLUME) || '0.6');
  audio.volume = Number.isFinite(savedVolume) ? savedVolume : 0.6;

  const fab = el('button', { class: 'music-fab', type: 'button', title: 'Musica para leer' }, icon('music', { size: 20 }));
  const panel = el('div', { class: 'music-panel' });
  document.body.appendChild(audio);
  document.body.appendChild(panel);
  document.body.appendChild(fab);

  let open = false;
  let currentKind = null; // 'local' | 'radio'
  let currentLabel = '';
  let localTracks = [];
  let localIndex = -1;
  let objectUrls = new Map();

  function togglePanel() {
    open = !open;
    panel.classList.toggle('open', open);
    if (open) renderPanel();
  }
  fab.addEventListener('click', togglePanel);

  function nowPlayingBar() {
    const isPlaying = !audio.paused && !audio.ended && audio.currentTime > 0;
    return el('div', { class: 'music-now-playing' }, [
      el('button', {
        class: 'icon-round', type: 'button', title: isPlaying ? 'Pausar' : 'Reproducir',
        onClick: () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); renderPanel(); }
      }, icon(isPlaying ? 'pause' : 'play', { size: 15 })),
      currentKind === 'local' ? el('button', {
        class: 'icon-round', type: 'button', title: 'Anterior', onClick: () => playLocalByOffset(-1)
      }, icon('skipPrev', { size: 14 })) : null,
      currentKind === 'local' ? el('button', {
        class: 'icon-round', type: 'button', title: 'Siguiente', onClick: () => playLocalByOffset(1)
      }, icon('skipNext', { size: 14 })) : null,
      el('div', { class: 'music-now-playing-label' }, currentLabel || 'Nada sonando todavia'),
      el('span', { class: 'icn-wrap' }, icon('volume', { size: 14 })),
      el('input', {
        type: 'range', min: '0', max: '1', step: '0.05', value: String(audio.volume), class: 'music-volume',
        onInput: (e) => { audio.volume = parseFloat(e.target.value); localStorage.setItem(LS_VOLUME, String(audio.volume)); }
      })
    ]);
  }

  async function playLocalTrack(index) {
    if (index < 0 || index >= localTracks.length) return;
    localIndex = index;
    const track = localTracks[index];
    let url = objectUrls.get(track.id);
    if (!url) { url = URL.createObjectURL(track.blob); objectUrls.set(track.id, url); }
    audio.src = url;
    currentKind = 'local';
    currentLabel = track.name;
    await audio.play().catch(() => showToast('Toca el boton de reproducir para iniciar la musica.'));
    renderPanel();
  }
  function playLocalByOffset(offset) {
    if (localTracks.length === 0) return;
    const next = (localIndex + offset + localTracks.length) % localTracks.length;
    playLocalTrack(next);
  }
  audio.addEventListener('ended', () => { if (currentKind === 'local') playLocalByOffset(1); });
  audio.addEventListener('play', () => { if (open) renderPanel(); });
  audio.addEventListener('pause', () => { if (open) renderPanel(); });

  async function playRadioStation(station) {
    audio.src = station.url_resolved || station.url;
    currentKind = 'radio';
    currentLabel = station.name;
    await audio.play().catch(() => showToast('No se pudo reproducir esa emisora, prueba otra.'));
    renderPanel();
  }

  function localTab() {
    const fileInput = el('input', { type: 'file', accept: 'audio/*', multiple: 'true', class: 'music-file-input' });
    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files || []);
      for (const file of files) {
        const track = { id: uid(), name: file.name.replace(/\.[a-z0-9]+$/i, ''), blob: file, addedAt: Date.now() };
        await idbPut(track);
      }
      fileInput.value = '';
      localTracks = await idbAll();
      renderPanel();
      if (files.length) showToast(`${files.length} pista${files.length === 1 ? '' : 's'} agregada${files.length === 1 ? '' : 's'}.`);
    });

    const list = el('div', { class: 'music-track-list' });
    if (localTracks.length === 0) {
      list.appendChild(el('p', { class: 'empty-shelf' }, 'Sube canciones desde tu dispositivo para escucharlas mientras lees. Solo se guardan en este navegador.'));
    }
    localTracks.forEach((t, i) => {
      list.appendChild(el('div', { class: `music-track-row${i === localIndex && currentKind === 'local' ? ' is-current' : ''}` }, [
        el('button', { class: 'music-track-play', type: 'button', onClick: () => playLocalTrack(i) }, [icon('play', { size: 12 }), el('span', {}, t.name)]),
        el('button', {
          class: 'music-track-remove', type: 'button', title: 'Quitar',
          onClick: async () => {
            await idbDelete(t.id);
            const url = objectUrls.get(t.id);
            if (url) { URL.revokeObjectURL(url); objectUrls.delete(t.id); }
            localTracks = await idbAll();
            renderPanel();
          }
        }, icon('close', { size: 12 }))
      ]));
    });

    return el('div', { class: 'music-tab-body' }, [
      el('label', { class: 'btn btn-ghost btn-sm music-upload-label' }, [icon('upload', { size: 14 }), el('span', {}, 'Subir musica'), fileInput]),
      list
    ]);
  }

  function radioTab() {
    const searchInput = el('input', { class: 'input', placeholder: 'Buscar emisora (ej. lofi, jazz, clasica)...' });
    const tagsRow = el('div', { class: 'music-radio-tags' }, RADIO_TAGS.map((t) => el('button', {
      class: 'chip', type: 'button', onClick: () => { searchInput.value = t; runRadioSearch(t); }
    }, t)));
    const resultsWrap = el('div', { class: 'music-track-list', id: 'music-radio-results' }, [
      el('p', { class: 'empty-shelf' }, 'Busca un genero o estacion, por ejemplo "jazz" o "lofi".')
    ]);

    async function runRadioSearch(q) {
      resultsWrap.innerHTML = '';
      resultsWrap.appendChild(el('p', { class: 'empty-shelf' }, 'Buscando emisoras...'));
      try {
        const stations = await searchRadioStations(q);
        resultsWrap.innerHTML = '';
        if (!stations.length) {
          resultsWrap.appendChild(el('p', { class: 'empty-shelf' }, 'No se encontraron emisoras con ese nombre.'));
          return;
        }
        stations.forEach((s) => {
          resultsWrap.appendChild(el('div', { class: 'music-track-row' }, [
            el('button', { class: 'music-track-play', type: 'button', onClick: () => playRadioStation(s) }, [
              icon('radio', { size: 12 }),
              el('span', {}, s.name || 'Emisora sin nombre')
            ]),
            el('span', { class: 'music-track-tag' }, (s.tags || '').split(',')[0] || '')
          ]));
        });
      } catch (err) {
        resultsWrap.innerHTML = '';
        resultsWrap.appendChild(el('p', { class: 'empty-shelf' }, err.message || 'No se pudo cargar la lista de emisoras.'));
      }
    }

    const form = el('form', { class: 'music-radio-search' }, [searchInput]);
    form.addEventListener('submit', (e) => { e.preventDefault(); runRadioSearch(searchInput.value.trim()); });

    return el('div', { class: 'music-tab-body' }, [
      el('p', { class: 'cover-picker-hint' }, 'Radio por internet gratis (sin cuenta), cortesia del directorio abierto Radio Browser.'),
      form,
      tagsRow,
      resultsWrap
    ]);
  }

  let activeTab = 'local';

  function renderPanel() {
    panel.innerHTML = '';
    const tabsRow = el('div', { class: 'music-tabs' }, [
      el('button', { class: `music-tab-btn${activeTab === 'local' ? ' active' : ''}`, type: 'button', onClick: () => { activeTab = 'local'; renderPanel(); } }, 'Tu musica'),
      el('button', { class: `music-tab-btn${activeTab === 'radio' ? ' active' : ''}`, type: 'button', onClick: () => { activeTab = 'radio'; renderPanel(); } }, 'Radio')
    ]);
    panel.appendChild(el('div', { class: 'music-panel-header' }, [
      el('span', {}, [icon('music', { size: 15 }), el('span', {}, ' Musica para leer')]),
      el('button', { class: 'btn btn-ghost btn-sm modal-close', type: 'button', onClick: togglePanel }, icon('close', { size: 14 }))
    ]));
    panel.appendChild(tabsRow);
    panel.appendChild(activeTab === 'local' ? localTab() : radioTab());
    panel.appendChild(nowPlayingBar());
  }

  idbAll().then((tracks) => { localTracks = tracks; if (open) renderPanel(); }).catch(() => {});
}
