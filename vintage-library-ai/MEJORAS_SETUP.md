# Migracion para las nuevas mejoras

Agregamos varias funciones nuevas (archivar, terminado, portadas
prediseñadas, marcador de pagina, frases guardadas, estilos de
resaltado). Para que funcionen con tu base de datos en Supabase,
corre este SQL una sola vez.

Ve a tu proyecto → **SQL Editor** → **New query** → pega y ejecuta:

```sql
-- Nuevas columnas en "books"
alter table books add column if not exists archived boolean not null default false;
alter table books add column if not exists finished boolean not null default false;
alter table books add column if not exists cover_preset text;
alter table books add column if not exists bookmark_page int;

-- Nuevas columnas en "highlights"
alter table highlights add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table highlights add column if not exists kind text not null default 'highlight';
alter table highlights add column if not exists style text not null default 'fill';
alter table highlights add column if not exists is_favorite boolean not null default false;

-- Rellena owner_id en resaltados existentes (si ya tenias alguno)
update highlights h
set owner_id = b.owner_id
from books b
where h.book_id = b.id and h.owner_id is null;

-- Reemplaza la politica de "highlights" para usar owner_id directo
-- (mas simple y mas rapido que la version anterior con EXISTS)
drop policy if exists "highlights: solo el dueno del libro" on highlights;

create policy "highlights: solo el dueno" on highlights
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
```

Eso es todo — no necesitas tocar Storage ni los buckets, las
mejoras nuevas solo usan la base de datos.

## Que agrega cada columna

| Columna | Tabla | Para que sirve |
|---|---|---|
| `archived` | books | Libro archivado (no se muestra en las estanterias normales) |
| `finished` | books | Marca manual de "libro terminado" |
| `cover_preset` | books | Id de la portada prediseñada elegida (si no subiste imagen) |
| `bookmark_page` | books | Pagina donde dejaste un marcador manual ("continuar aqui") |
| `owner_id` | highlights | Dueño del resaltado (simplifica los permisos) |
| `kind` | highlights | Tipo de marca (por ahora solo `highlight`) |
| `style` | highlights | Como se dibuja: `fill`, `underline`, `strike`, `box` |
| `is_favorite` | highlights | Si esta guardada en "Frases guardadas" |
