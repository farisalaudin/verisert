// app.js — VeriSert
// Logic UI, event handler, orkestrasi modul stego & crypto, canvas helper

/**
 * Memuat file gambar (dari <input type="file">) ke dalam canvas.
 * @param {File} file - File gambar dari input[type=file]
 * @returns {Promise<{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number}>}
 * @throws {Error} jika file bukan gambar valid atau gagal dimuat
 */
function loadImageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ canvas, ctx, width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar.'));
    };
    img.src = url;
  });
}

/**
 * Mengekspor canvas menjadi Blob PNG.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>} Blob dengan type 'image/png'
 */
function canvasToPNGBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/* ── Tab Navigation ─────────────────────────────────────────────────────── */

/**
 * Mengaktifkan tab yang dipilih dan menyembunyikan tab lainnya.
 * @param {string} tabId - ID tab yang akan ditampilkan ('generate' atau 'verify')
 */
function switchTab(tabId) {
  // Semua tombol tab dan semua section tab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-section').forEach(section => {
    if (section.id === 'tab-' + tabId) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', '');
    }
  });
}

// Daftarkan event listener pada setiap tombol tab
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ── Form Generate: Validation + Capacity Check (G-1 & G-2) ─────────────── */

const formGenerate   = document.getElementById('form-generate');
const inputCoverImage = document.getElementById('input-cover-image');
const capacityInfo   = document.getElementById('capacity-info');
const btnGenerate    = document.getElementById('btn-generate');

/** State yang disimpan untuk perhitungan kapasitas */
let _imageCapacityBits = 0;   // w * h * 3 bit dari gambar yang diupload

/**
 * Mengestimasi ukuran payload (dalam BIT) yang dibutuhkan untuk menyisipkan
 * data sertifikat. Mengambil nilai langsung dari field form yang sudah diisi.
 * AES CryptoJS menghasilkan base64 overhead ~4/3 dari plaintext + 48 byte salt/IV.
 * Tambahan 32 bit untuk header panjang payload (sesuai PRD §7).
 */
function estimateRequiredBits() {
  const nama          = (document.getElementById('input-nama')?.value          || '').trim();
  const nim           = (document.getElementById('input-nim')?.value           || '').trim();
  const program       = (document.getElementById('input-program')?.value       || '').trim();
  const noSertifikat  = (document.getElementById('input-no-sertifikat')?.value || '').trim();
  const tanggal       = (document.getElementById('input-tanggal-terbit')?.value|| '').trim();
  const penerbit      = (document.getElementById('input-penerbit')?.value      || '').trim();
  const passphrase    = (document.getElementById('input-passphrase')?.value    || '').trim();

  if (!nama || !nim || !program || !noSertifikat || !tanggal || !penerbit || !passphrase) {
    return null; // belum semua field terisi
  }

  const dataObj  = { nama, nim, program, no_sertifikat: noSertifikat, tanggal_terbit: tanggal, penerbit };
  const jsonStr  = JSON.stringify(dataObj);
  // AES CryptoJS: base64(salt[8] + iv[16] + cipher) → panjang ~Math.ceil((json+16)/16)*16 lalu *4/3 + overhead "Salted__"
  // Estimasi konservatif: panjang JSON * 1.4 + 100 byte untuk salt/IV/padding
  const estimatedBytes = Math.ceil(jsonStr.length * 1.4) + 100;
  // Setiap byte = 8 bit, tambah 32 bit header panjang (PRD §7)
  return estimatedBytes * 8 + 32;
}

/** Perbarui tampilan kapasitas & badge di #capacity-info, dan status tombol Generate */
function updateCapacityDisplay() {
  if (!capacityInfo) return;

  const requiredBits = estimateRequiredBits();
  const hasCap = _imageCapacityBits > 0;

  let html = '';

  if (hasCap) {
    html += `
      <div class="capacity-row">
        <span>Kapasitas tersedia</span>
        <strong>${_imageCapacityBits.toLocaleString()} bit</strong>
      </div>`;
  }

  if (hasCap && requiredBits !== null) {
    const enough = requiredBits <= _imageCapacityBits;
    const meterValue = Math.min(100, Math.round((requiredBits / _imageCapacityBits) * 100));
    html += `
      <div class="capacity-meter ${enough ? 'cap-ok' : 'cap-err'}">
        <div class="capacity-row">
          <span>Dibutuhkan</span>
          <span class="capacity-readout">${requiredBits.toLocaleString()} / ${_imageCapacityBits.toLocaleString()} bit</span>
        </div>
        <div class="meter-track" aria-hidden="true">
          <span class="meter-fill" style="--meter-value: ${meterValue}%"></span>
        </div>
        <div class="capacity-row">
          <span></span>
          <span class="cap-badge">${enough ? 'Cukup' : 'Tidak cukup'}</span>
        </div>
      </div>`;

    if (btnGenerate) {
      btnGenerate.disabled = !enough;
      btnGenerate.title    = enough ? '' : 'Kapasitas gambar tidak cukup. Gunakan gambar beresolusi lebih besar.';
    }
  } else {
    // Belum ada gambar atau belum semua field terisi — pastikan tombol aktif
    if (btnGenerate) {
      btnGenerate.disabled = false;
      btnGenerate.title    = '';
    }
  }

  capacityInfo.innerHTML = html;
}

/* Event: gambar di-upload → hitung kapasitas + validasi PNG */
if (inputCoverImage) {
  inputCoverImage.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    _imageCapacityBits = 0;
    updateCapacityDisplay();

    if (!file) return;

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      alert('Harus format PNG');
      inputCoverImage.value = '';
      return;
    }

    try {
      const { width, height } = await loadImageToCanvas(file);
      _imageCapacityBits = width * height * 3; // 3 channel (R, G, B) × 1 bit per pixel
      updateCapacityDisplay();
    } catch (_) {
      _imageCapacityBits = 0;
      updateCapacityDisplay();
    }
  });
}

/* Event: setiap field berubah → perbarui estimasi kebutuhan */
['input-nama','input-nim','input-program','input-no-sertifikat',
 'input-tanggal-terbit','input-penerbit','input-passphrase'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateCapacityDisplay);
});

/* Event: gambar verifikasi di-upload → tampilkan preview */
if (inputVerifyImage) {
  inputVerifyImage.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
      verifyPreviewArea.innerHTML = '';
      return;
    }

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      alert('Harus format PNG');
      inputVerifyImage.value = '';
      verifyPreviewArea.innerHTML = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    verifyPreviewArea.innerHTML = `
      <div class="preview-card verify-preview">
        <p class="preview-label">Pratinjau</p>
        <img src="${previewUrl}" alt="Pratinjau gambar sertifikat" class="preview-img" />
        <p class="file-name">${file.name}</p>
      </div>
    `;

    // Revoke URL after image loads
    const img = verifyPreviewArea.querySelector('img');
    img.addEventListener('load', () => URL.revokeObjectURL(previewUrl), { once: true });
  });
}

/* ── UI Helpers untuk Generate ──────────────────────────────────────────── */

const generateErrorEl = (() => {
  const el = document.createElement('div');
  el.id = 'generate-error';
  el.setAttribute('role', 'alert');
  // Sisipkan sebelum tombol Generate
  if (btnGenerate) btnGenerate.parentNode.insertBefore(el, btnGenerate);
  return el;
})();

function showGenerateError(msg) {
  generateErrorEl.textContent = msg;
  generateErrorEl.classList.add('visible');
}

function clearGenerateError() {
  generateErrorEl.textContent = '';
  generateErrorEl.classList.remove('visible');
}

/**
 * G-3: Orkestrasi penuh Generate Certificate sesuai TDD §7.1 langkah 1–9.
 * Dipanggil saat form-generate di-submit dan lolos validasi dasar.
 */
async function handleGenerateSubmit() {
  clearGenerateError();

  // Langkah 1 — Ambil semua nilai dari form
  const file       = inputCoverImage?.files[0];
  const passphrase = document.getElementById('input-passphrase')?.value?.trim();
  const dataObj = {
    nama:           document.getElementById('input-nama')?.value?.trim(),
    nim:            document.getElementById('input-nim')?.value?.trim(),
    program:        document.getElementById('input-program')?.value?.trim(),
    no_sertifikat:  document.getElementById('input-no-sertifikat')?.value?.trim(),
    tanggal_terbit: document.getElementById('input-tanggal-terbit')?.value?.trim(),
    penerbit:       document.getElementById('input-penerbit')?.value?.trim(),
  };

  if (!file) { showGenerateError('Pilih gambar sertifikat terlebih dahulu.'); return; }

  // Set tombol ke loading state
  if (btnGenerate) { btnGenerate.disabled = true; btnGenerate.textContent = 'Memproses…'; }

  try {
    // Langkah 2 — Muat gambar ke canvas
    const { canvas, ctx, width, height } = await loadImageToCanvas(file);

    // Langkah 3 — Ambil pixel data
    const imageData = ctx.getImageData(0, 0, width, height);

    // Langkah 4 — Enkripsi data sertifikat
    const ciphertext = encryptCertificateData(dataObj, passphrase);

    // Langkah 5 — Konversi ciphertext ke bytes
    const payloadBytes = utf8ToBytes(ciphertext);

    // Langkah 6 — Cek kapasitas sebelum embed
    const requiredBits  = calculateRequiredBits(payloadBytes.length);
    const capacityBits  = calculateCapacityBits(width, height);
    if (requiredBits > capacityBits) {
      throw new CapacityError(
        `Gambar terlalu kecil: butuh ${requiredBits.toLocaleString()} bit, ` +
        `tersedia ${capacityBits.toLocaleString()} bit. Gunakan gambar beresolusi lebih besar.`
      );
    }

    // Langkah 7 — Sisipkan payload ke gambar via LSB
    embedLSB(imageData, payloadBytes);

    // Langkah 8 — Tulis kembali pixel ke canvas
    ctx.putImageData(imageData, 0, 0);

    // Langkah 9 — Export canvas sebagai Blob PNG
    const blob = await canvasToPNGBlob(canvas);

    // Langkah 10 & 11 (G-4 & G-5): render preview + download — dipanggil dari renderPreviewAndDownload
    renderPreviewAndDownload(file, canvas, blob, dataObj);

    // Log to MCP Stitch
    await logToStitch('GENERATE', {
      ...dataObj,
      status: 'SUCCESS'
    });

  } catch (err) {
    if (err instanceof CapacityError) {
      showGenerateError(err.message);
    } else {
      showGenerateError('Terjadi kesalahan: ' + err.message);
    }
    // Log error to Stitch
    await logToStitch('GENERATE', {
      nama: dataObj?.nama || 'N/A',
      status: 'FAILED',
      error: err.message
    });
  } finally {
    // Kembalikan tombol ke state normal
    if (btnGenerate) {
      btnGenerate.disabled = false;
      btnGenerate.textContent = 'Generate Sertifikat';
    }
    updateCapacityDisplay();
  }
}

/* Event: form submit */
if (formGenerate) {
  formGenerate.addEventListener('submit', (e) => {
    e.preventDefault();
    const file = inputCoverImage ? inputCoverImage.files[0] : null;
    if (file) {
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      if (!isPng) {
        alert('Harus format PNG');
        if (inputCoverImage) inputCoverImage.value = '';
        return;
      }
    }
    handleGenerateSubmit();
  });
}

/* ── G-4: Preview before/after & G-5: Tombol Download ──────────────────── */

/**
 * Menampilkan preview sebelum/sesudah generate dan tombol download.
 * G-4: 2 gambar berdampingan (original vs stego)
 * G-5: Tombol download PNG dengan nama file otomatis
 *
 * @param {File}              originalFile  - File asli yang diupload user
 * @param {HTMLCanvasElement} stegoCanvas   - Canvas hasil embed LSB
 * @param {Blob}              blob          - Blob PNG dari stegoCanvas
 * @param {Object}            dataObj       - Data sertifikat (untuk nama file)
 */
function renderPreviewAndDownload(originalFile, stegoCanvas, blob, dataObj) {
  const previewArea = document.getElementById('preview-area');
  if (!previewArea) return;

  // URL untuk gambar original (dari File asli)
  const originalUrl     = URL.createObjectURL(originalFile);
  // URL untuk gambar stego yang ditampilkan di preview <img>
  const stegoPreviewUrl = URL.createObjectURL(blob);

  // Nama file otomatis: sertifikat-{nama}-{no_sertifikat}.png
  const safeName = (dataObj.nama          || 'sertifikat').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const safeCert = (dataObj.no_sertifikat || 'cert').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = `sertifikat-${safeName}-${safeCert}.png`;

  previewArea.innerHTML = `
    <div class="preview-section">
      <h3 class="preview-title">Sertifikat Berhasil Dibuat</h3>

      <div class="preview-grid">
        <div class="preview-card">
          <p class="preview-label">Asli</p>
          <img id="preview-original" src="${originalUrl}" alt="Gambar sertifikat original" class="preview-img" />
        </div>
        <div class="preview-card">
          <p class="preview-label">Hasil Steganografi</p>
          <img id="preview-stego" src="${stegoPreviewUrl}" alt="Gambar sertifikat stego" class="preview-img" />
        </div>
      </div>

      <p class="preview-note">
        Kedua gambar terlihat identik secara visual. Data sertifikat terenkripsi tersembunyi di bit terakhir setiap channel piksel.
      </p>

      <button id="btn-download" class="btn-download" data-filename="${filename}">
        Unduh Sertifikat (.png)
      </button>
    </div>
  `;

  // Revoke URL preview original setelah gambar dimuat
  const origImg = document.getElementById('preview-original');
  origImg.addEventListener('load', () => URL.revokeObjectURL(originalUrl), { once: true });

  // Revoke URL preview stego setelah gambar dimuat
  const stegoImg = document.getElementById('preview-stego');
  stegoImg.addEventListener('load', () => URL.revokeObjectURL(stegoPreviewUrl), { once: true });

  // ── G-5: Download programatik ──────────────────────────────────────────────
  // Re-export canvas ke blob baru saat diklik agar selalu fresh dan valid.
  // Tidak menggunakan ulang blob lama (yang bisa tainted / sudah di-revoke).
  const dlBtn = document.getElementById('btn-download');
  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    dlBtn.textContent = 'Menyiapkan file…';

    try {
      // Export ulang dari canvas stegoCanvas → blob PNG yang fresh
      const freshBlob = await canvasToPNGBlob(stegoCanvas);

      // Validasi blob: pastikan type benar dan ukuran > 0
      if (!freshBlob || freshBlob.type !== 'image/png' || freshBlob.size === 0) {
        alert('Gagal mengekspor gambar. Pastikan gambar PNG sudah diproses dengan benar.');
        return;
      }

      // Buat object URL dari blob yang fresh
      const downloadUrl = URL.createObjectURL(freshBlob);

      // Buat <a> sementara, trigger click, lalu hapus (pola paling andal lintas browser)
      const tempLink    = document.createElement('a');
      tempLink.href     = downloadUrl;
      tempLink.download = filename;
      tempLink.style.display = 'none';
      document.body.appendChild(tempLink);
      tempLink.click();
      // Hapus elemen setelah 100ms, revoke URL setelah 15 detik
      setTimeout(() => { document.body.removeChild(tempLink); }, 100);
      setTimeout(() => { URL.revokeObjectURL(downloadUrl); }, 15000);

    } catch (err) {
      alert('Download gagal: ' + err.message);
    } finally {
      dlBtn.disabled = false;
      dlBtn.textContent = 'Unduh Sertifikat (.png)';
    }
  });

  // Scroll ke preview agar langsung terlihat
  previewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}



/* ── H-2: handleVerifySubmit (orkestrasi Verify sesuai TDD §7.2) ─────────── */

const formVerify        = document.getElementById('form-verify');
const inputVerifyImage  = document.getElementById('input-verify-image');
const btnVerify         = document.getElementById('btn-verify');
const verifyPreviewArea = document.getElementById('verify-preview-area');

/**
 * H-2: Orkestrasi penuh Verify Certificate sesuai TDD §7.2 langkah 1–6.
 * Semua skenario error (gambar bukan stego, passphrase salah, gambar rusak)
 * ditangkap dan ditampilkan ke user — tidak ada uncaught exception.
 */
async function handleVerifySubmit() {
  const verifyResult = document.getElementById('verify-result');
  if (verifyResult) verifyResult.innerHTML = '';

  const file       = inputVerifyImage?.files[0];
  const passphrase = document.getElementById('input-verify-passphrase')?.value?.trim();

  if (!file) {
    renderVerificationResult('invalid', null, 'Pilih file gambar sertifikat terlebih dahulu.');
    return;
  }
  if (!passphrase) {
    renderVerificationResult('invalid', null, 'Masukkan passphrase terlebih dahulu.');
    return;
  }

  // Validasi PNG
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  if (!isPng) {
    renderVerificationResult('invalid', null, 'Harus format PNG. File bukan PNG tidak bisa diverifikasi.');
    return;
  }

  // Loading state
  if (btnVerify) { btnVerify.disabled = true; btnVerify.textContent = 'Memverifikasi…'; }

  try {
    // Langkah 1 — Muat gambar ke canvas
    const { canvas, ctx, width, height } = await loadImageToCanvas(file);

    // Langkah 2 — Ambil pixel data
    const imageData = ctx.getImageData(0, 0, width, height);

    // Langkah 3 — Ekstrak LSB; jika gambar tidak mengandung data valid → tangkap error
    let payloadBytes;
    try {
      payloadBytes = extractLSB(imageData);
    } catch (e) {
      renderVerificationResult(
        'invalid', null,
        'Tidak ditemukan tanda tangan digital pada gambar ini.'
      );
      return;
    }

    // Langkah 4 — Konversi bytes ke ciphertext string
    const ciphertext = bytesToUtf8(payloadBytes);

    // Langkah 5 — Dekripsi; jika passphrase salah atau data rusak → tangkap DecryptionError
    let dataObj;
    try {
      dataObj = decryptCertificateData(ciphertext, passphrase);
    } catch (e) {
      if (e instanceof DecryptionError) {
        renderVerificationResult(
          'invalid', null,
          'Passphrase salah atau sertifikat telah dimodifikasi.'
        );
      } else {
        renderVerificationResult(
          'invalid', null,
          'Terjadi kesalahan saat memverifikasi: ' + e.message
        );
      }
      return;
    }

    // Langkah 6 — Sukses: render hasil valid
    renderVerificationResult('valid', dataObj);

    // Log to MCP Stitch
    await logToStitch('VERIFY', {
      ...dataObj,
      status: 'VALID'
    });

  } catch (err) {
    // Tangkap error tak terduga (gambar gagal dimuat, dll.)
    renderVerificationResult(
      'invalid', null,
      'Gagal memproses gambar: ' + err.message
    );
  } finally {
    if (btnVerify) { btnVerify.disabled = false; btnVerify.textContent = 'Verifikasi'; }
  }
}

// Daftarkan event listener form-verify
if (formVerify) {
  formVerify.addEventListener('submit', (e) => {
    e.preventDefault();
    handleVerifySubmit();
  });
}

/* ── H-3: renderVerificationResult ───────────────────────────────────────── */

/**
 * Merender hasil verifikasi ke DOM.
 * @param {'valid'|'invalid'} status
 * @param {Object|null}       dataObj  - Data sertifikat (jika valid)
 * @param {string}            [msg]    - Pesan error (jika invalid)
 */
function renderVerificationResult(status, dataObj, msg) {
  const el = document.getElementById('verify-result');
  if (!el) return;

  // Bersihkan hasil sebelumnya
  el.innerHTML = '';

  if (status === 'invalid') {
    let badgeLabel = msg || 'Passphrase Salah atau Sertifikat Telah Dimodifikasi';
    if (badgeLabel.toLowerCase().includes('tidak ditemukan')) {
      badgeLabel = 'Tidak Ditemukan Tanda Tangan Digital';
    } else if (badgeLabel.toLowerCase().includes('passphrase')) {
      badgeLabel = 'Passphrase Salah atau Sertifikat Telah Dimodifikasi';
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'verify-status invalid';
    errorDiv.innerHTML = `
      <div class="status-frame">
        <div class="verify-badge">${badgeLabel}</div>
      </div>
      <p class="verify-msg">Sertifikat tidak dapat diverifikasi. Pastikan gambar masih berformat PNG dan passphrase sesuai dengan data penerbit.</p>
    `;
    el.appendChild(errorDiv);
  } else if (status === 'valid' && dataObj) {
    const successDiv = document.createElement('div');
    successDiv.className = 'verify-status valid';
    successDiv.innerHTML = `
      <div class="status-frame">
        <div class="verify-badge">Sertifikat Asli — Data Terverifikasi</div>
      </div>
      <div class="verify-data-card" id="verify-data-container"></div>
    `;
    el.appendChild(successDiv);

    // Render field data dengan aman menggunakan textContent (bukan innerHTML)
    const container = document.getElementById('verify-data-container');
    const fields = [
      { key: 'nama', label: 'Nama Penerima' },
      { key: 'nim', label: 'NIM' },
      { key: 'program', label: 'Nama Program/Sertifikat' },
      { key: 'no_sertifikat', label: 'Nomor Sertifikat' },
      { key: 'tanggal_terbit', label: 'Tanggal Terbit' },
      { key: 'penerbit', label: 'Nama Instansi Penerbit' }
    ];

    fields.forEach(field => {
      const row = document.createElement('div');
      row.className = 'data-row';

      const label = document.createElement('span');
      label.className = 'data-label';
      label.textContent = field.label;

      const value = document.createElement('span');
      value.className = 'data-value';
      // Fallback jika field tidak ada di dataObj
      value.textContent = dataObj[field.key] || '-';

      row.appendChild(label);
      row.appendChild(value);
      container.appendChild(row);
    });
  }
}

/* ── Initialization: Check MCP Stitch Connection ───────────────────────── */

/**
 * Initialize Stitch connection check on app load
 */
async function initStitchConnection() {
  const statusEl = document.getElementById('stitch-status');
  if (!statusEl) return;

  try {
    const isHealthy = await checkStitchHealth();
    if (isHealthy) {
      statusEl.textContent = '✅ MCP Stitch Terhubung';
      statusEl.style.background = '#d4edda';
      statusEl.style.color = '#155724';
    } else {
      statusEl.textContent = '⚠️ MCP Stitch Tidak Terhubung';
      statusEl.style.background = '#fff3cd';
      statusEl.style.color = '#856404';
    }
  } catch (error) {
    statusEl.textContent = '❌ Error Koneksi Stitch';
    statusEl.style.background = '#f8d7da';
    statusEl.style.color = '#721c24';
  }
}

// Initialize on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStitchConnection);
} else {
  initStitchConnection();
}
