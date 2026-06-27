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

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ── Form Generate: Validation + Capacity Check ────────────────────────── */

const formGenerate   = document.getElementById('form-generate');
const inputCoverImage = document.getElementById('input-cover-image');
const capacityInfo   = document.getElementById('capacity-info');
const btnGenerate    = document.getElementById('btn-generate');
const generatePreviewArea = document.getElementById('generate-preview-area');
const formVerify      = document.getElementById('form-verify');
const inputVerifyImage = document.getElementById('input-verify-image');
const btnVerify       = document.getElementById('btn-verify');
const verifyPreviewArea = document.getElementById('verify-preview-area');

let _imageCapacityBits = 0;

function estimateRequiredBits() {
  const nama          = (document.getElementById('input-nama')?.value          || '').trim();
  const nim           = (document.getElementById('input-nim')?.value           || '').trim();
  const program       = (document.getElementById('input-program')?.value       || '').trim();
  const noSertifikat  = (document.getElementById('input-no-sertifikat')?.value || '').trim();
  const tanggal       = (document.getElementById('input-tanggal-terbit')?.value|| '').trim();
  const penerbit      = (document.getElementById('input-penerbit')?.value      || '').trim();
  const passphrase    = (document.getElementById('input-passphrase')?.value    || '').trim();

  if (!nama || !nim || !program || !noSertifikat || !tanggal || !penerbit || !passphrase) {
    return null;
  }

  const dataObj  = { nama, nim, program, no_sertifikat, tanggal_terbit: tanggal, penerbit };
  const jsonStr  = JSON.stringify(dataObj);
  const estimatedBytes = Math.ceil(jsonStr.length * 1.4) + 100;
  return estimatedBytes * 8 + 32;
}

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
    if (btnGenerate) {
      btnGenerate.disabled = false;
      btnGenerate.title    = '';
    }
  }

  capacityInfo.innerHTML = html;
}

if (inputCoverImage) {
  inputCoverImage.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    _imageCapacityBits = 0;
    updateCapacityDisplay();
    generatePreviewArea.innerHTML = '';

    if (!file) return;

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      alert('Harus format PNG');
      inputCoverImage.value = '';
      return;
    }

    try {
      const { width, height } = await loadImageToCanvas(file);
      _imageCapacityBits = width * height * 3;
      updateCapacityDisplay();
      
      const previewUrl = URL.createObjectURL(file);
      generatePreviewArea.innerHTML = `
        <div class="preview-card verify-preview">
          <p class="preview-label">Pratinjau</p>
          <img src="${previewUrl}" alt="Pratinjau gambar sertifikat" class="preview-img" />
          <p class="file-name">${file.name}</p>
        </div>
      `;

      const img = generatePreviewArea.querySelector('img');
      img.addEventListener('load', () => URL.revokeObjectURL(previewUrl), { once: true });
    } catch (_) {
      _imageCapacityBits = 0;
      updateCapacityDisplay();
    }
  });
}

['input-nama','input-nim','input-program','input-no-sertifikat',
 'input-tanggal-terbit','input-penerbit','input-passphrase'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateCapacityDisplay);
});

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

    const img = verifyPreviewArea.querySelector('img');
    img.addEventListener('load', () => URL.revokeObjectURL(previewUrl), { once: true });
  });
}

/* ── UI Helpers untuk Generate ──────────────────────────────────────────── */

const generateErrorEl = (() => {
  const el = document.createElement('div');
  el.id = 'generate-error';
  el.setAttribute('role', 'alert');
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

async function handleGenerateSubmit() {
  clearGenerateError();

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

  console.log('[APP] handleGenerateSubmit, dataObj:', dataObj);

  if (!file) { showGenerateError('Pilih gambar sertifikat terlebih dahulu.'); return; }

  if (btnGenerate) { btnGenerate.disabled = true; btnGenerate.textContent = 'Memproses…'; }

  try {
    const { canvas, ctx, width, height } = await loadImageToCanvas(file);
    console.log('[APP] Gambar diload, width:', width, 'height:', height);
    const imageData = ctx.getImageData(0, 0, width, height);
    console.log('[APP] imageData.data.length:', imageData.data.length);
    const ciphertext = encryptCertificateData(dataObj, passphrase);
    console.log('[APP] ciphertext:', ciphertext);
    const payloadBytes = utf8ToBytes(ciphertext);
    console.log('[APP] payloadBytes.length:', payloadBytes.length);

    const requiredBits  = calculateRequiredBits(payloadBytes.length);
    const capacityBits  = calculateCapacityBits(width, height);
    if (requiredBits > capacityBits) {
      throw new CapacityError(
        `Gambar terlalu kecil: butuh ${requiredBits.toLocaleString()} bit, ` +
        `tersedia ${capacityBits.toLocaleString()} bit. Gunakan gambar beresolusi lebih besar.`
      );
    }

    embedLSB(imageData, payloadBytes);
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvasToPNGBlob(canvas);
    console.log('[APP] Generated blob, size:', blob.size);
    renderPreviewAndDownload(file, canvas, blob, dataObj);
  } catch (err) {
    console.error('[APP] handleGenerateSubmit error:', err);
    if (err instanceof CapacityError) {
      showGenerateError(err.message);
    } else {
      showGenerateError('Terjadi kesalahan: ' + err.message);
    }
  } finally {
    if (btnGenerate) {
      btnGenerate.disabled = false;
      btnGenerate.textContent = 'Generate Sertifikat';
    }
    updateCapacityDisplay();
  }
}

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

/* ── Preview before/after & Tombol Download ─────────────────────────────── */

function renderPreviewAndDownload(originalFile, stegoCanvas, blob, dataObj) {
  const previewArea = document.getElementById('preview-area');
  if (!previewArea) return;

  const originalUrl     = URL.createObjectURL(originalFile);
  const stegoPreviewUrl = URL.createObjectURL(blob);

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

  const origImg = document.getElementById('preview-original');
  origImg.addEventListener('load', () => URL.revokeObjectURL(originalUrl), { once: true });

  const stegoImg = document.getElementById('preview-stego');
  stegoImg.addEventListener('load', () => URL.revokeObjectURL(stegoPreviewUrl), { once: true });

  const dlBtn = document.getElementById('btn-download');
  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    dlBtn.textContent = 'Menyiapkan file…';

    try {
      const freshBlob = await canvasToPNGBlob(stegoCanvas);

      if (!freshBlob || freshBlob.type !== 'image/png' || freshBlob.size === 0) {
        alert('Gagal mengekspor gambar. Pastikan gambar PNG sudah diproses dengan benar.');
        return;
      }

      const downloadUrl = URL.createObjectURL(freshBlob);

      const tempLink    = document.createElement('a');
      tempLink.href     = downloadUrl;
      tempLink.download = filename;
      tempLink.style.display = 'none';
      document.body.appendChild(tempLink);
      tempLink.click();
      setTimeout(() => { document.body.removeChild(tempLink); }, 100);
      setTimeout(() => { URL.revokeObjectURL(downloadUrl); }, 15000);

    } catch (err) {
      alert('Download gagal: ' + err.message);
    } finally {
      dlBtn.disabled = false;
      dlBtn.textContent = 'Unduh Sertifikat (.png)';
    }
  });

  previewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── handleVerifySubmit ─────────────────────────────────────────────────── */

async function handleVerifySubmit() {
  console.log('[APP] handleVerifySubmit called');
  const verifyResult = document.getElementById('verify-result');
  if (verifyResult) verifyResult.innerHTML = '';

  const file       = inputVerifyImage?.files[0];
  const passphrase = document.getElementById('input-verify-passphrase')?.value?.trim();

  console.log('[APP] File:', file?.name, 'Passphrase:', passphrase ? '<provided>' : '<not provided>');

  if (!file) {
    renderVerificationResult('invalid', null, 'Pilih file gambar sertifikat terlebih dahulu.');
    return;
  }
  if (!passphrase) {
    renderVerificationResult('invalid', null, 'Masukkan passphrase terlebih dahulu.');
    return;
  }

  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  if (!isPng) {
    renderVerificationResult('invalid', null, 'Harus format PNG. File bukan PNG tidak bisa diverifikasi.');
    return;
  }

  if (btnVerify) { btnVerify.disabled = true; btnVerify.textContent = 'Memverifikasi…'; }

  try {
    const { canvas, ctx, width, height } = await loadImageToCanvas(file);
    console.log('[APP] Verify image loaded, width:', width, 'height:', height);
    const imageData = ctx.getImageData(0, 0, width, height);
    console.log('[APP] Verify imageData.data.length:', imageData.data.length);

    let payloadBytes;
    try {
      payloadBytes = extractLSB(imageData);
    } catch (e) {
      console.error('[APP] extractLSB error:', e);
      renderVerificationResult(
        'invalid', null,
        'Tidak ditemukan tanda tangan digital pada gambar ini.'
      );
      return;
    }

    console.log('[APP] payloadBytes.length:', payloadBytes.length);
    const ciphertext = bytesToUtf8(payloadBytes);
    console.log('[APP] ciphertext:', ciphertext);
    let dataObj;
    try {
      dataObj = decryptCertificateData(ciphertext, passphrase);
      console.log('[APP] Decrypted dataObj:', dataObj);
    } catch (e) {
      console.error('[APP] decryptCertificateData error:', e);
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

    renderVerificationResult('valid', dataObj);
  } catch (err) {
    console.error('[APP] handleVerifySubmit error:', err);
    renderVerificationResult(
      'invalid', null,
      'Gagal memproses gambar: ' + err.message
    );
  } finally {
    if (btnVerify) { btnVerify.disabled = false; btnVerify.textContent = 'Verifikasi'; }
  }
}

if (formVerify) {
  formVerify.addEventListener('submit', (e) => {
    e.preventDefault();
    handleVerifySubmit();
  });
}

/* ── renderVerificationResult ───────────────────────────────────────────── */

function renderVerificationResult(status, dataObj, msg) {
  const el = document.getElementById('verify-result');
  if (!el) return;

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
      value.textContent = dataObj[field.key] || '-';

      row.appendChild(label);
      row.appendChild(value);
      container.appendChild(row);
    });
  }
}
