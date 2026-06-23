# VeriSert — Sistem Verifikasi Keaslian Sertifikat Digital

VeriSert adalah aplikasi berbasis web (client-side) untuk menerbitkan dan memverifikasi keaslian sertifikat digital menggunakan teknik **Steganografi LSB (Least Significant Bit)** dan enkripsi **AES (Advanced Encryption Standard)**.

## Fitur Utama
1. **Penerbitan Sertifikat (Generate)**: Menyisipkan metadata sertifikat (Nama, NIM, Program, Nomor Sertifikat, Tanggal Terbit, dan Penerbit) yang telah dienkripsi dengan AES ke dalam gambar cover berformat PNG menggunakan teknik LSB Steganografi.
2. **Verifikasi Sertifikat (Verify)**: Mengekstraksi metadata terenkripsi dari gambar sertifikat PNG, mendekripsinya menggunakan passphrase yang sesuai, dan memvalidasi keaslian data tersebut.
3. **Deteksi Manipulasi (Anti-Tampering)**: Struktur LSB yang sensitif memastikan bahwa jika gambar diubah, dikompresi (seperti diubah ke format JPG/JPEG), atau dimanipulasi, data rahasia di dalamnya akan rusak dan verifikasi akan gagal.

---

## Cara Menjalankan Aplikasi

Aplikasi ini dirancang sepenuhnya berjalan di sisi klien (100% client-side) tanpa memerlukan backend server atau database. **Tidak ada dependensi atau pustaka yang perlu diinstal secara lokal.**

Untuk menjalankan aplikasi:
1. Pastikan Anda memiliki koneksi internet aktif (untuk memuat library `CryptoJS` via CDN).
2. Buka file **`index.html`** langsung menggunakan browser web modern pilihan Anda (misalnya Chrome, Firefox, Edge, atau Safari) dengan cara:
   - Double-click file `index.html`.
   - Atau drag-and-drop file `index.html` ke jendela browser Anda.
3. Aplikasi siap digunakan!

---

## Panduan Demo & Pengujian

### 1. Membuat/Menyisipkan Sertifikat (Generate)
1. Buka tab **Buat Sertifikat**.
2. Isi formulir dengan data sertifikat contoh (Nama, NIM, Program, dll.).
3. Unggah gambar cover dalam format **PNG** (disarankan gambar PNG berkualitas baik).
4. Masukkan **Passphrase Enkripsi** contoh, misalnya:
   * **`DemoPass123!`**
5. Klik tombol **Generate**.
6. Setelah proses selesai, preview gambar asli dan gambar hasil steganografi akan ditampilkan.
7. Klik tautan **Download** yang muncul untuk mengunduh file sertifikat hasil generate (file akan selalu diunduh dalam format PNG untuk menjaga integritas bit).

### 2. Memverifikasi Sertifikat (Verify)
1. Buka tab **Verifikasi Sertifikat**.
2. Unggah file sertifikat PNG hasil unduhan langkah sebelumnya.
3. Masukkan passphrase yang sama yang digunakan saat pembuatan: **`DemoPass123!`**
4. Klik tombol **Verifikasi**.
5. Jika passphrase benar dan gambar tidak mengalami modifikasi, badge hijau **VALID** akan muncul beserta detail metadata sertifikat yang berhasil didekripsi.

### 3. Menguji Skenario Kegagalan
* **Salah Passphrase**: Coba unggah sertifikat yang valid tetapi masukkan passphrase yang salah (misal: `SalahPassphrase`). Verifikasi akan mendeteksi kesalahan dekripsi dan menampilkan badge merah **INVALID / PASS KELIRU**.
* **Gambar Rusak/Dimanipulasi**: Coba edit sedikit gambar sertifikat menggunakan software editor gambar atau ubah formatnya menjadi JPG/JPEG (yang menerapkan kompresi lossy). Unggah kembali file tersebut dengan passphrase yang benar. Sistem akan mendeteksi bahwa data steganografi telah rusak dan menampilkan badge merah **INVALID / TAMPERED / BUKAN SERTIFIKAT**.

---

> [!WARNING]
> ### Catatan Penting Keamanan (Bukan untuk Produksi)
> * Aplikasi ini dikembangkan untuk tujuan demo, edukasi, dan penelitian akademis.
> * Sandi passphrase contoh (`DemoPass123!`) hanya boleh digunakan untuk pengujian/demonstrasi dan **BUKAN** untuk lingkungan produksi.
> * Untuk penggunaan tingkat produksi, gunakan passphrase yang kuat dan simpan secara aman menggunakan sistem manajemen kunci yang terstandarisasi.
