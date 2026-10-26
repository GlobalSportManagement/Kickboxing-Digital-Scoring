# Kickboxing Digital Scoring (WAKO)

Papan skor digital kickboxing berbasis aturan WAKO: open scoring, skor kumulatif, 3 juri.
Server: Google Apps Script. Database: Google Sheets. Rekap hasil per event: Google Drive.
Tampilan di GitHub Pages (PWA, bisa diinstal), server di Apps Script.

## Cara kerja
- **Login Google** (hanya di versi GitHub Pages): siapa pun yang login boleh **membuat event** dan melihat **riwayat** event-nya.
- **Gabung hari pertandingan**: kode event (4 angka) + PIN peran. Tidak perlu akun Google, jadi juri dan monitor bisa langsung masuk.
- **Lanjutkan**: kembali ke event dan peran terakhir di perangkat itu (sesi berlaku sekitar 6 jam). **Hapus sesi tersimpan** membersihkannya.

| Peran | Tugas |
|---|---|
| Admin | Menambah partai, mengaktifkan partai, reset skor partai aktif |
| Juri 1-3 | Hanya tombol poin merah/biru miliknya sendiri |
| Timekeeper | Mulai/jeda timer, koreksi waktu, ganti ronde, akhiri pertandingan |
| Dewan hakim | Knockdown, peringatan, poin minus, mengesahkan hasil |
| Monitor | Hanya menampilkan papan skor (TV/proyektor) |

Pembuat event otomatis bisa membuka event-nya sebagai admin dari menu **Riwayat event**.

## Aturan skoring
- Tiap teknik sah = 1 poin (input juri), knockdown = +1 poin bonus
- Skor dijumlahkan dari semua ronde (bukan 10-9)
- Hasil: unanimous (3-0), split (2-1), majority (2 menang, 1 seri)
- Seri: pemenang = poin terbanyak di ronde terakhir

## Isi repositori
`index.html` (tampilan, di Apps Script beri nama file `index`), `Code.gs`, `appsscript.json`, `sw.js`, `manifest.webmanifest`, `assets/` (logo dan ikon).

## A. Pasang server (Apps Script)
1. Buat proyek di https://script.google.com dengan akun yang punya akses EDIT ke Spreadsheet dan folder Drive di `Code.gs` (`SS_ID`, `FOLDER_ID`).
2. Tempel `Code.gs`. Tambah file HTML bernama `index` (huruf kecil), tempel `index.html`.
3. Project Settings > Script Properties > tambah `GOOGLE_CLIENT_ID` = OAuth Client ID (jenis Web application, bentuk `xxxx.apps.googleusercontent.com`). Di Google Cloud Console, Authorized JavaScript origins harus memuat `https://globalsportmanagement.github.io`.
4. Pilih fungsi `setup`, klik Run, setujui izin (Sheets, Drive, koneksi eksternal). `setup` juga menambah kolom baru di sheet lama.
5. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone > Deploy. Salin URL `/exec` dan isi ke `API_URL` di `index.html`.
6. Setiap perubahan kode butuh versi baru (Manage deployments > edit > New version).

## B. GitHub Pages
Unggah semua file ke repo publik, lalu Settings > Pages > Deploy from a branch > main, folder `/ (root)`. Buka `https://USERNAME.github.io/NAMA-REPO/`, lalu pasang lewat "Instal aplikasi" di browser.

## Alur satu partai
Admin tambah partai dan klik Aktifkan > juri, timekeeper, dewan hakim, dan monitor gabung dengan kode event + PIN > timekeeper mulai ronde > setelah ronde terakhir klik Akhiri pertandingan > dewan hakim klik Sahkan hasil. Hasil otomatis masuk ke spreadsheet rekap di folder Drive event itu.

## Catatan dan batasan
- Login Google tidak tersedia di URL Apps Script langsung (hanya di GitHub Pages). Gabung dengan kode + PIN tetap jalan di keduanya.
- Sinkronisasi memakai polling tiap 2 detik (jeda sekitar 1-2 detik). Satu event = satu ring.
- PIN tersimpan polos di sheet `Events`, batasi akses edit spreadsheet hanya untuk panitia. Belum ada pembatasan percobaan PIN salah, edit/hapus partai, atau penghapusan event.
- Folder rekap dimiliki akun pemilik Apps Script. Pembuat event diberi akses lihat (viewer) lewat email Google-nya.
- Apps Script punya kuota harian, aman untuk satu ring. Uji dulu sebelum acara besar.
