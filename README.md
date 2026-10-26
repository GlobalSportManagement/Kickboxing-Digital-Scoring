# Skoring Kickboxing WAKO (multi event, multi peran)

Papan skor digital kickboxing berbasis aturan WAKO: open scoring, skor kumulatif, 3 juri.
Server: Google Apps Script. Database: Google Sheets. Rekap hasil per event: Google Drive.
Bisa dipakai langsung dari URL Apps Script, atau dari GitHub Pages sebagai PWA yang bisa diinstal.

## Isi repositori
- `index.html` : tampilan dan logika (di Apps Script, beri nama file `index`)
- `Code.gs` : server Apps Script (`doGet`, `doPost`, login, aksi, rekap)
- `appsscript.json` : manifest Apps Script
- `sw.js` + `manifest.webmanifest` : PWA (aktif hanya saat dibuka dari GitHub Pages)
- `assets/` : logo dan ikon

## Peran (login pakai PIN per event)
| Peran | Tugas |
|---|---|
| Pengelola | Membuat event (PIN lewat Script Properties), melihat PIN semua peran |
| Admin | Menambah partai, mengaktifkan partai, reset skor partai aktif |
| Juri 1-3 | Hanya tombol poin merah/biru miliknya sendiri |
| Timekeeper | Mulai/jeda timer, koreksi waktu, ganti ronde, akhiri pertandingan |
| Dewan hakim | Knockdown, peringatan, poin minus, mengesahkan hasil |
| Monitor | Hanya menampilkan papan skor (TV/proyektor) |

## Aturan skoring
- Tiap teknik sah = 1 poin (input juri), knockdown = +1 poin bonus
- Skor dijumlahkan dari semua ronde (bukan 10-9)
- Hasil: unanimous (3-0), split (2-1), majority (2 menang, 1 seri)
- Seri: pemenang = poin terbanyak di ronde terakhir

## A. Pasang server (wajib)
1. Buat proyek di https://script.google.com dengan akun yang punya akses EDIT ke Spreadsheet dan folder Drive di `Code.gs` (`SS_ID`, `FOLDER_ID`).
2. Tempel `Code.gs`. Tambah file HTML bernama `index` (huruf kecil), tempel isi `index.html`. (Opsional) samakan `appsscript.json`.
3. Project Settings > Script Properties > tambah `MASTER_PIN` = PIN pengelola. Jangan taruh PIN ini di kode atau GitHub.
4. Pilih fungsi `setup`, klik Run, setujui izin akses (Sheets dan Drive).
5. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone > Deploy. Salin URL web app (berakhiran `/exec`).
6. Setiap perubahan kode butuh versi deployment baru (Manage deployments > edit > New version).

Sampai sini aplikasi sudah bisa dipakai dari URL web app tersebut.

## B. Pasang PWA di GitHub Pages (opsional)
1. Di `index.html`, isi `var API_URL="";` dengan URL web app dari langkah A5.
2. Unggah semua file repo ini ke GitHub (repo publik).
3. Settings > Pages > Source: Deploy from a branch > main, folder `/ (root)` > Save.
4. Buka `https://USERNAME.github.io/NAMA-REPO/`. Di HP, pilih "Tambahkan ke layar utama" / "Instal aplikasi".
5. Jangan taruh `MASTER_PIN` di repo. URL web app boleh publik, akses tetap dijaga PIN.

Catatan: service worker hanya jalan di versi GitHub Pages. Di dalam URL Apps Script, service worker tidak bisa didaftarkan, jadi bagian PWA hanya berlaku untuk langkah B.

## Favicon untuk versi Apps Script (opsional)
Di `doGet` pada `Code.gs`, hapus tanda `//` pada baris `.setFaviconUrl(...)` dan ganti `USERNAME` dan nama repo dengan milikmu.

## Alur satu partai
Admin tambah partai dan klik Aktifkan > juri, timekeeper, dewan hakim, dan monitor login dengan PIN masing-masing > timekeeper mulai ronde > setelah ronde terakhir timekeeper klik Akhiri pertandingan > dewan hakim klik Sahkan hasil. Hasil otomatis masuk ke spreadsheet rekap di folder Drive event tersebut.

## Catatan dan batasan
- Sinkronisasi memakai polling tiap 2 detik, jadi ada jeda sekitar 1-2 detik antar perangkat.
- Satu event = satu ring (satu partai aktif sekali waktu).
- PIN tersimpan polos di sheet `Events`, jadi batasi akses edit spreadsheet hanya untuk panitia.
- Belum ada pembatasan percobaan PIN salah, dan belum ada edit/hapus partai.
- Apps Script punya kuota eksekusi harian, aman untuk satu ring, uji dulu sebelum acara besar.
- Aplikasi butuh koneksi internet. Service worker hanya menyimpan cangkang halaman, bukan data pertandingan.
