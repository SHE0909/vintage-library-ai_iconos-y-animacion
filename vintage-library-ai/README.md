# 📚 Vintage Library — MVP

Biblioteca digital personal con estilo vintage: sube tus PDFs, organízalos en
estanterías de madera y léelos con un lector integrado que guarda tu progreso.

Este proyecto es la versión **recortada y realista** de una idea original mucho
más grande (ver `idea-original.md` si quieres compararla). Se priorizó lo que
se puede construir, probar y explicar bien en menos de dos semanas trabajando
solo/a — no lo que suma más funciones al documento.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. **No necesitas crear ninguna cuenta ni backend**:
el proyecto arranca en modo demo (`BACKEND = 'local'` en `src/js/config.js`),
usando `localStorage` para los datos y `IndexedDB` para guardar los PDFs
directamente en tu navegador.

## Conectar Firebase (opcional, para producción)

1. Crea un proyecto en [console.firebase.google.com](https://console.firebase.google.com)
2. Agrega una app web y copia sus credenciales a `src/js/firebaseConfig.js`
3. Habilita en la consola de Firebase:
   - **Authentication** → método Correo/contraseña
   - **Firestore Database**
   - **Storage**
4. Cambia `BACKEND` a `'firebase'` en `src/js/config.js`
5. `npm run dev` — la app ahora usa Firebase sin tocar ninguna otra línea de código

Esto funciona porque `src/js/data.js` implementa un **patrón adaptador**:
`localAdapter.js` y `firebaseAdapter.js` exponen exactamente las mismas
funciones (`signIn`, `addBook`, `listBooks`, etc.), así que el resto de la
app nunca sabe cuál de los dos está usando.

## Estructura

```
src/
  js/
    adapters/
      localAdapter.js     # modo demo: localStorage + IndexedDB
      firebaseAdapter.js  # modo real: Firebase Auth + Firestore + Storage
    pages/
      auth.js             # login / registro
      dashboard.js        # estanterías y lomos de libros
      reader.js           # lector de PDF (pdf.js)
    data.js               # selecciona el adaptador activo
    config.js             # BACKEND: 'local' | 'firebase'
    app.js                # router basado en hash
  styles/
    tokens.css            # paleta, tipografía, espaciado (design tokens)
    main.css              # estilos globales
```

## Qué incluye este MVP

- Registro / inicio de sesión
- Subir libros en PDF con título, autor, categoría y **portada personalizada** (imagen)
- **Categorías dinámicas**: crea tus propias estanterías desde el sidebar o al agregar/editar un libro
- **Editar libro**: cambia título, autor, categoría o portada desde el ícono ✎ en cada lomo
- Estanterías por categoría con lomos de libro (color, portada e info por libro)
- **Sidebar de navegación responsive**: en escritorio siempre visible, en móvil se abre con el botón ☰
- Lector integrado con zoom, navegación de páginas y progreso guardado automáticamente
- **Resaltado de texto persistente**: selecciona texto dentro del PDF, elige un color y se guarda; vuelve a aparecer cada vez que abres el libro. Clic sobre un resaltado para eliminarlo.
- Diseño vintage completo: paleta caoba/pergamino/dorado, tipografía Fraunces + Source Serif
- Arquitectura con capa de adaptador (fácil de defender en la sustentación)

## Conectar Firebase de verdad

Sigue la guía paso a paso en **[`SETUP_FIREBASE.md`](./SETUP_FIREBASE.md)**:
crear el proyecto, habilitar Authentication/Firestore/Storage, reglas de
seguridad listas para copiar y pegar, y cómo activar el backend real
cambiando una sola línea en `src/js/config.js`.

## Qué se dejó fuera a propósito (trabajo futuro)

EPUB, dibujar sobre páginas, notas de texto libre (más allá del resaltado),
frases favoritas exportables, estadísticas avanzadas, calendario de
actividad, temas múltiples, funciones de IA (resumen, chat, flashcards),
PWA/offline, OCR, ISBN scanning, música ambiental, Pomodoro, compartir
contenido públicamente, reemplazar el PDF de un libro ya subido. Todo esto
está en el documento original (`idea-original.md`) y es material perfecto
para la sección de "alcance futuro" de tu informe.

## Para tu informe / sustentación

Puntos que vale la pena mencionar:

- **Recorte de alcance deliberado**: de ~40 funcionalidades a un núcleo de 5,
  explicando el criterio (demostrabilidad + tiempo disponible).
- **Patrón adaptador** para la capa de datos: permite cambiar de backend
  (local → Firebase) sin reescribir la lógica de la aplicación — buena
  práctica real de ingeniería de software, no solo "código que funciona".
- **Diseño con tokens**: la paleta y tipografía están centralizadas en
  `tokens.css`, no hardcodeadas por todo el CSS.
