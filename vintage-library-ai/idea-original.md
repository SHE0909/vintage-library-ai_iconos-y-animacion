# Idea original (documento completo, sin recortar)

Este es el documento de partida que compartiste. Se guarda aquí como
referencia para la sección de "alcance futuro" de tu informe — casi todo
lo que describe aquí NO está en el MVP, a propósito.

---

# 📚 Vintage Library AI

Aplicación web de biblioteca virtual inteligente donde los usuarios pueden
almacenar, organizar y leer libros digitales en una experiencia inmersiva
inspirada en una biblioteca clásica (tema vintage: madera, caoba, café
oscuro, beige, pergamino, rosa antiguo).

## Alcance completo original (resumen por área)

- **Auth**: registro, login, recuperación de contraseña, login con Google
- **Biblioteca personal**: subir PDF/EPUB con metadatos completos (título,
  autor, editorial, año, categoría, páginas, estado, calificación, tags)
- **Editor de portadas**: personalizar colores, tipografías, imágenes, iconos
- **Lector integrado**: paso de página realista, sonido de hojas, zoom,
  pantalla completa, scroll continuo o paginado
- **Herramientas de lectura**: subrayado multicolor, notas, comentarios,
  dibujo sobre páginas, marcadores, separadores, anotaciones laterales
- **Frases favoritas**: guardado automático, búsqueda, compartir, exportar
- **Historial de lectura**: última página, tiempo de lectura, racha, progreso
- **Estanterías personalizadas** con representación visual 3D tipo madera
- **IA integrada**: resúmenes, explicación de conceptos, preguntas y
  respuestas sobre el libro, flashcards, mapas conceptuales, traducción
- **Buscador inteligente**: por autor, título, categoría, contenido del PDF, notas
- **Estadísticas**: horas leídas, libros terminados, género/autor favorito, racha
- **Objetivos de lectura** con barras de progreso
- **Calendario tipo GitHub** de actividad de lectura
- **Múltiples temas visuales** (clásico, victoriano, oscuro, moderno, claro, pergamino)
- **Personalización** de tipografía, tamaño, espaciado, márgenes, colores
- **Sincronización en la nube** (Supabase/Firebase)
- **Compartir**: frases, notas, listas, estanterías públicas
- **PWA completa**: manifest, service worker, offline, notificaciones
- **Extras**: escaneo de ISBN, portadas generadas con IA, importar bibliotecas,
  exportar notas, sistema de logros, modo concentración, música ambiental,
  Pomodoro, diccionario, traductor, OCR, backups automáticos, colecciones,
  vista 3D de estantería, importación desde Drive/OneDrive

## Stack propuesto originalmente

- **Frontend**: Astro, JavaScript ES Modules, HTML5, CSS3
- **Backend**: Node.js, Express, API REST
- **Base de datos**: Supabase (PostgreSQL)
- **Almacenamiento**: Supabase Storage

## Nota

Este documento es intencionalmente el "techo" de la idea: útil para pensar
en hacia dónde podría crecer el proyecto después de la entrega, pero no es
la lista de tareas para las próximas dos semanas.
