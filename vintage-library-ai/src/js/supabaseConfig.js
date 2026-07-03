// =========================================================
// CONFIGURACION DE SUPABASE
// =========================================================
// Se usa para Auth + Database + Storage (todo el backend).
// 1. Ve a tu proyecto en https://supabase.com/dashboard
// 2. Project Settings -> API
// 3. Copia "Project URL" y "anon public" key aqui abajo
// 4. Corre el SQL de SETUP_SUPABASE.md para crear las tablas
// 5. Crea los buckets "books" y "covers" (publicos) en Storage

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://waaeuvvzcxwlpxfteilf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4M5EAQkJE179vA5KDnsq2w_NkX7oqxr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
