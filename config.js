// Isi dari Supabase:
//  - SUPABASE_URL : Project Settings > Data API (atau tombol "Connect" di atas) > Project URL
//  - SUPABASE_KEY : Project Settings > API Keys > Publishable key (diawali sb_publishable_...)
// Publishable key memang aman ditaruh di sini: tanpa login, database menolak semua akses (Row Level Security).
// JANGAN pernah menaruh Secret key (sb_secret_...) atau service_role key di file ini.
window.PENJENISAN_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_KEY: 'isi-publishable-key'
};
