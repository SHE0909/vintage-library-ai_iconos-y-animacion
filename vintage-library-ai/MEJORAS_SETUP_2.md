# Migracion para racha de lectura, metas y notas

Agregamos: racha de lectura + minutos leidos, "continuar leyendo",
meta de lectura anual, notas de texto libre y estadisticas/logros.
Si usas Supabase, corre esto una sola vez en **SQL Editor**.

```sql
-- Fecha en que se marco un libro como terminado (para la meta anual)
-- y fecha del ultimo momento en que se abrio (para "Continuar leyendo").
alter table books add column if not exists finished_at timestamptz;
alter table books add column if not exists last_opened_at timestamptz;

-- Actividad de lectura por dia: minutos leidos y paginas vistas.
-- Se usa para calcular la racha, el calendario tipo GitHub y los logros.
create table if not exists reading_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  minutes int not null default 0,
  pages int not null default 0,
  primary key (user_id, date)
);

alter table reading_activity enable row level security;

drop policy if exists "reading_activity: solo el dueno" on reading_activity;
create policy "reading_activity: solo el dueno" on reading_activity
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Meta de lectura (por ahora una meta simple, sin distinguir por año).
create table if not exists reading_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target int not null default 12
);

alter table reading_goals enable row level security;

drop policy if exists "reading_goals: solo el dueno" on reading_goals;
create policy "reading_goals: solo el dueno" on reading_goals
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

No se necesita ninguna columna nueva para las notas de texto libre:
usan la misma tabla `highlights` que ya tenias, solo con
`kind = 'note'` (por eso la migracion anterior ya dejaba `kind` como
columna de texto libre).

## Que agrega cada columna/tabla

| Columna/tabla | Para que sirve |
|---|---|
| `books.finished_at` | Cuando se marco el libro como terminado, para contar cuantos van en el año |
| `books.last_opened_at` | Cuando se abrio por ultima vez, para la tarjeta "Continuar leyendo" |
| `reading_activity` | Minutos leidos y paginas vistas por dia (racha, calendario, promedio de paginas/dia) |
| `reading_goals` | Meta de libros a terminar que el usuario se puso |
