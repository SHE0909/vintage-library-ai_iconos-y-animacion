# Configurar Supabase para Vintage Library

Ya migramos todo el backend a Supabase (Auth + Base de datos + Storage).
Sigue estos pasos para dejar tu proyecto de Supabase listo.

## 1. Crear las tablas

Ve a tu proyecto en [supabase.com/dashboard](https://supabase.com/dashboard) →
**SQL Editor** → **New query** → pega y ejecuta esto:

```sql
-- Tabla de libros
create table books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null,
  category text not null,
  added_at timestamptz not null default now(),
  progress_page int not null default 0,
  bookmark_page int,
  total_pages int,
  rating int not null default 0,
  spine_color text not null,
  file_name text,
  has_cover boolean not null default false,
  cover_preset text,
  archived boolean not null default false,
  finished boolean not null default false
);

-- Tabla de categorias (una fila por usuario, con un array de nombres)
create table categories (
  user_id uuid primary key references auth.users(id) on delete cascade,
  list text[] not null default '{}'
);

-- Tabla de resaltados (tambien guarda los trazos de dibujo a mano
-- alzada del lector, con kind='drawing': points y stroke_width se
-- usan solo para esos, quedan null en los resaltados de texto normales)
create table highlights (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  page int not null,
  color text not null default '#D4AF6A',
  style text not null default 'fill',
  kind text not null default 'highlight',
  is_favorite boolean not null default false,
  rects jsonb not null,
  points jsonb,
  stroke_width numeric,
  text text default '',
  created_at timestamptz not null default now()
);

-- Si ya tenias este proyecto de Supabase creado antes de la funcion de
-- dibujo a mano alzada, corre esto una sola vez para agregar las columnas
-- nuevas sin perder tus resaltados existentes:
--   alter table highlights add column if not exists points jsonb;
--   alter table highlights add column if not exists stroke_width numeric;

-- ---------------------------------------------------------
-- Seguridad: Row Level Security (RLS)
-- ---------------------------------------------------------
-- Cada usuario solo puede ver/editar sus propios datos.

alter table books enable row level security;
alter table categories enable row level security;
alter table highlights enable row level security;

create policy "books: solo el dueno" on books
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "categories: solo el dueno" on categories
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "highlights: solo el dueno" on highlights
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
```

## 2. Crear los buckets de Storage

1. Menú lateral → **Storage**
2. **New bucket** → nombre `books` → márcalo **Public**
3. **New bucket** → nombre `covers` → márcalo **Public**

## 3. Políticas de Storage (para que solo el dueño pueda subir/borrar)

Ve a **Storage → Policies** y crea, para cada bucket (`books` y `covers`),
una política que permita subir/leer/borrar solo si la carpeta coincide con
el `uid` del usuario autenticado. La forma más simple: en el SQL Editor,
corre esto (ajusta `books` y luego repite para `covers`):

```sql
create policy "books: acceso propio"
on storage.objects for all
using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "covers: acceso propio"
on storage.objects for all
using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
```

> Nota: como los buckets son públicos, cualquiera con el link directo a un
> archivo puede verlo (útil para mostrar portadas sin pedir login extra).
> Estas políticas solo controlan quién puede *subir/borrar*, no la lectura
> pública del archivo si alguien ya tiene la URL exacta.

## 4. Habilitar Auth por correo/contraseña

Normalmente ya viene activo por defecto en Supabase. Para confirmarlo:

1. Menú lateral → **Authentication → Providers**
2. Verifica que **Email** esté habilitado

Opcional: en **Authentication → Providers → Email**, puedes desactivar
"Confirm email" mientras haces pruebas, así no tienes que verificar el
correo cada vez que te registras.

## 5. Activar Supabase en el proyecto

Ya está hecho en `src/js/config.js`:

```js
export const BACKEND = 'supabase';
```

Y tus credenciales ya están puestas en `src/js/supabaseConfig.js`.

## 6. Instalar y correr

```bash
npm install
npm run dev
```

## 7. Verificar que funciona

- Regístrate con un correo y contraseña (mínimo 6 caracteres)
- Sube un PDF — deberías verlo en Storage → bucket `books`
- Revisa la tabla `books` en **Table Editor** — debería aparecer tu libro

## Problemas comunes

| Error | Causa probable |
|---|---|
| `new row violates row-level security policy` | No corriste el SQL de políticas RLS del paso 1, o el `owner_id` no coincide con el usuario logueado |
| `Invalid login credentials` | Correo o contraseña incorrectos, o el usuario no existe |
| El correo pide confirmación y no llega | Revisa spam, o desactiva "Confirm email" en Authentication → Providers → Email mientras pruebas |
| La portada/PDF no se ve | Revisa que los buckets `books` y `covers` existan y estén marcados como Public |
