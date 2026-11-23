# Penjenisan Kain & Benang

Aplikasi web untuk menjeniskan nama kain dan benang. Ini pengganti `Apps_Penjenisan_V1.xlsb`.

- **Penjenisan Kain:** nama kain → benang 1–3, persentase, dan grouping (Greige / Matang).
- **Penjenisan Benang:** nama benang → jenis benang dan grouping (Greige / Warna / Eksternal / Double Winder).
- **Database:** setiap nama yang sudah pernah dijeniskan disimpan di sini. Generate berikutnya selalu mengambil dari Database lebih dulu.
- **Master Aturan:** daftar jenis benang dengan alias, % tetap spandex, daftar Eksternal / Double Winder, dan kata warna.
- Nama yang benangnya belum ada di Master muncul di kotak **"Belum ada di Master"** dan di kolom **Notes**. User menambahkannya ke Master dulu, lalu Generate ulang.

Halaman webnya di-hosting di **GitHub Pages**, sedangkan database dan login memakai **Supabase**. Tanpa login, data tidak bisa dibaca sama sekali, karena dilindungi Row Level Security di database. Repo ini hanya berisi kode, tidak berisi data.

---

## Setup (sekali saja, ±15 menit)

### 1. Buat project Supabase
1. Daftar atau masuk di https://supabase.com, lalu klik **New project**.
2. Isi nama (misalnya `penjenisan`), buat database password, dan pilih region **Southeast Asia (Singapore)**.

### 2. Buat tabel
1. Buka **SQL Editor**, klik **New query**, tempel seluruh isi `supabase/schema.sql`, lalu klik **Run**.
2. Hasilnya: 4 tabel (`master_benang`, `aturan`, `db_kain`, `db_benang`) dengan akses khusus user yang sudah login. Daftar Eksternal dan Double Winder ikut terisi.

### 3. Atur login supaya hanya tim yang bisa masuk
1. **Authentication → Sign In / Providers → Email:** matikan **Allow new users to sign up**. Dengan begitu orang luar tidak bisa mendaftar sendiri.
2. **Authentication → Users → Add user → Create new user:** buat akun untuk tiap anggota tim (email + password). Centang **Auto Confirm User**.
3. **Authentication → URL Configuration:**
   - Isi **Site URL** dengan alamat GitHub Pages (lihat langkah 5), misalnya `https://namakamu.github.io/penjenisan-web/`.
   - Tambahkan alamat yang sama di **Redirect URLs**. Ini diperlukan supaya fitur "Lupa password" bisa berjalan.

### 4. Isi `config.js`
- **SUPABASE_KEY:** buka **Project Settings → API Keys**, lalu di bagian **Publishable key** klik ikon salin di samping `sb_publishable_…`.
- **SUPABASE_URL:** klik tombol **Connect** di bagian atas dashboard (atau **Project Settings → Data API**), lalu salin **Project URL** (`https://xxxx.supabase.co`).

Publishable key memang aman dipasang di halaman web, karena akses tetap dicek login lewat RLS. Yang **tidak boleh** dipasang adalah **Secret key** (`sb_secret_…`) atau service_role key.

### 5. Upload ke GitHub dan aktifkan Pages
```bash
git init
git add .
git commit -m "Penjenisan kain & benang"
git branch -M main
git remote add origin https://github.com/NAMAKAMU/penjenisan-web.git
git push -u origin main
```
Lalu buka **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**. Beberapa menit kemudian web bisa dibuka di `https://NAMAKAMU.github.io/penjenisan-web/`.

> **Repo publik atau privat?** Kode di repo ini tidak berisi data, jadi aman dibuat publik. GitHub Pages dari repo **privat** hanya tersedia di paket GitHub berbayar (Pro / Team / Enterprise).

### 6. Isi data awal
Login, buka tab **Impor & Ekspor**, lalu pilih file `Apps_Penjenisan_V1.xlsb`:
- **Ganti Master Jenis Benang**: memasukkan 352 jenis benang beserta alias dan % spandex.
- **Simpan kain ke Database**: memasukkan hasil penjenisan lama, termasuk koreksi manual.

Database benang yang sudah ada bisa diimpor dari Excel dengan kolom `Nama Benang | Jenis Benang | Grouping`.

---

## Aturan penjenisan (ringkas)

**Kain** (port dari makro `START_PENJENISAN`, maksimal 3 benang):
- Alias dicari di nama kain, lalu diurutkan dari posisi paling awal dan alias terpanjang.
- Alias yang diakhiri angka juga mengenali akhiran 1, misalnya `CM 24` mengenali `CM 241`. Akhiran `/2` diabaikan.
- Benang bertambahan `SAMPLE` dilewati.
- **M71 hanya berlaku untuk benang tepat di depannya.** Contoh: `PE 301 M71 PE 301 M71 PE 201` → PE 30 S MISTI, PE 30 S MISTI, PE 20 S. Kalau versi MISTI tidak ada, dipakai benang biasa. Spandex tetap dihitung.
- Persentase: spandex memakai % tetap dari Master dan sisanya dibagi rata. Tanpa spandex: 100%, 50/50, atau 34/33/33.
- Potongan yang mirip benang tapi tidak ada di Master (misalnya `CTN LIKE 321`, `FIL 75/36`) masuk Notes. Baris seperti ini tidak disimpan otomatis.

**Benang** (1 jenis): sistem menyusun kemungkinan jenis secara berurutan, lalu memakai yang pertama ada di Master.
- Format `YARN;KODE,..,NE,angka,..`: (a) `KODE angka-setelah-NE`, misalnya `TC 28`; lalu (b) `KODE angka/angka`, misalnya `TC 65/35`.
- `Td,55T-48` dibaca `55/48`. `COT` + `CM` dibaca combed (`CM`), `COT` + `CD` dibaca carded. `NYLON` dibaca `NL`.
- Benang double winder (`… + …`): bagian pertama dulu, lalu bagian berikutnya.
- Benang warna (`CVC 20 BRIGHT WHITE [..]`): kode dalam kurung siku diabaikan, lalu diambil pasangan kode + angka pertama.
- Kalau tidak ada kemungkinan yang cocok di Master → masuk Notes: `Tidak ada di master: TC 33 / TC 65/35`.

**Grouping benang:** Eksternal (daftar) → Double Winder (daftar, atau nama mengandung `M D W` / `+`) → Warna (kata warna atau kode `[..]`) → Greige.
**Grouping kain:** Matang kalau mengandung kata warna atau kata kain matang, selain itu Greige.

## Struktur file
```
index.html              tampilan
config.js               alamat & anon key Supabase (diisi sendiri)
js/engine.js            logika penjenisan (sama persis dengan versi di Claude)
js/app.js               tampilan & alur kerja
js/adapter-supabase.js  login + baca/tulis database
supabase/schema.sql     tabel, keamanan (RLS), realtime
```
