/**
 * BatchResizer Pro - Client-side Image Resizer
 * 100% In-Memory Local Processing via HTML5 Canvas API & JSZip
 */

// Application State
const state = {
  mode: 'width', // 'width' | 'height' | 'long' | 'short' | 'percent'
  dimensionValue: 1280,
  format: 'image/webp', // 'original' | 'image/webp' | 'image/jpeg' | 'image/png'
  quality: 0.9,
  allowUpscale: false,
  files: [], // Array of { id, file, originalWidth, originalHeight, originalSize, previewUrl, targetWidth, targetHeight, status, blob, resizedUrl, resizedSize, outputName }
  isProcessing: false,
};

// Preset configurations for each mode
const PRESETS = {
  width: [
    { label: '3840px (4K)', value: 3840 },
    { label: '1920px (FHD)', value: 1920 },
    { label: '1280px (HD)', value: 1280 },
    { label: '1080px (SNS)', value: 1080 },
    { label: '800px (블로그)', value: 800 },
    { label: '640px (썸네일)', value: 640 },
  ],
  height: [
    { label: '2160px (4K)', value: 2160 },
    { label: '1080px (FHD)', value: 1080 },
    { label: '720px (HD)', value: 720 },
    { label: '500px (피드)', value: 500 },
    { label: '300px (작게)', value: 300 },
  ],
  long: [
    { label: '3840px (4K 긴변)', value: 3840 },
    { label: '2048px (웹표준)', value: 2048 },
    { label: '1920px (FHD)', value: 1920 },
    { label: '1200px (포스트)', value: 1200 },
    { label: '800px (모바일)', value: 800 },
  ],
  short: [
    { label: '1440px (고해상도)', value: 1440 },
    { label: '1080px (FHD 짧은변)', value: 1080 },
    { label: '800px (보통)', value: 800 },
    { label: '600px (경량)', value: 600 },
    { label: '400px (소형)', value: 400 },
  ],
  percent: [
    { label: '200% (2배 확대)', value: 200 },
    { label: '150% (1.5배)', value: 150 },
    { label: '75% (3/4 축소)', value: 75 },
    { label: '50% (절반 축소)', value: 50 },
    { label: '25% (1/4 축소)', value: 25 },
    { label: '10% (초소형)', value: 10 },
  ],
};

const MODE_LABELS = {
  width: { label: '목표 가로 크기 (Width)', unit: 'px', defaultVal: 1280, min: 1, max: 16000 },
  height: { label: '목표 세로 크기 (Height)', unit: 'px', defaultVal: 720, min: 1, max: 16000 },
  long: { label: '긴 축 기준 크기 (Long Edge)', unit: 'px', defaultVal: 1920, min: 1, max: 16000 },
  short: { label: '짧은 축 기준 크기 (Short Edge)', unit: 'px', defaultVal: 800, min: 1, max: 16000 },
  percent: { label: '크기 비율 (Scale Percent)', unit: '%', defaultVal: 50, min: 1, max: 1000 },
};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const modeSelector = document.getElementById('modeSelector');
const dimensionInput = document.getElementById('dimensionInput');
const dimensionLabel = document.getElementById('dimensionLabel');
const dimensionUnit = document.getElementById('dimensionUnit');
const presetPills = document.getElementById('presetPills');
const formatSelect = document.getElementById('formatSelect');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
const allowUpscale = document.getElementById('allowUpscale');
const startBatchBtn = document.getElementById('startBatchBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const actionBar = document.getElementById('actionBar');
const progressContainer = document.getElementById('progressContainer');
const progressTitle = document.getElementById('progressTitle');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const imagesListSection = document.getElementById('imagesListSection');
const imageGrid = document.getElementById('imageGrid');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const totalOriginalSize = document.getElementById('totalOriginalSize');
const completedCount = document.getElementById('completedCount');
const listBadge = document.getElementById('listBadge');
const toastContainer = document.getElementById('toastContainer');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  renderPresets();
});

/**
 * Event Listeners Setup
 */
function initEventListeners() {
  // Mode selection buttons
  modeSelector.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      switchMode(mode);
    });
  });

  // Target dimension input
  dimensionInput.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      state.dimensionValue = val;
      updateCalculatedDimensions();
      highlightActivePreset();
    }
  });

  // Format selection
  formatSelect.addEventListener('change', (e) => {
    state.format = e.target.value;
    const isQualityApplicable = (state.format === 'image/jpeg' || state.format === 'image/webp');
    document.getElementById('qualityGroup').style.opacity = isQualityApplicable ? '1' : '0.5';
  });

  // Quality slider
  qualitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    qualityValue.textContent = `${val}%`;
    state.quality = val / 100;
  });

  // Allow upscale toggle
  allowUpscale.addEventListener('change', (e) => {
    state.allowUpscale = e.target.checked;
    updateCalculatedDimensions();
  });

  // Drag & drop handlers
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      fileInput.value = ''; // Reset so the same file can be re-selected if needed
    }
  });

  // Action buttons
  startBatchBtn.addEventListener('click', startBatchProcessing);
  downloadZipBtn.addEventListener('click', downloadAllAsZip);
  clearAllBtn.addEventListener('click', clearAllFiles);
}

/**
 * Mode Switching Logic
 */
function switchMode(newMode) {
  state.mode = newMode;
  
  // Update mode buttons UI
  modeSelector.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === newMode);
  });

  // Update input labels & values
  const config = MODE_LABELS[newMode];
  dimensionLabel.textContent = config.label;
  dimensionUnit.textContent = config.unit;
  dimensionInput.min = config.min;
  dimensionInput.max = config.max;
  dimensionInput.value = config.defaultVal;
  state.dimensionValue = config.defaultVal;

  renderPresets();
  updateCalculatedDimensions();
}

/**
 * Render Presets according to current mode
 */
function renderPresets() {
  presetPills.innerHTML = '';
  const list = PRESETS[state.mode] || [];
  list.forEach(p => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'preset-pill';
    pill.textContent = p.label;
    pill.addEventListener('click', () => {
      dimensionInput.value = p.value;
      state.dimensionValue = p.value;
      updateCalculatedDimensions();
      highlightActivePreset();
    });
    presetPills.appendChild(pill);
  });
  highlightActivePreset();
}

function highlightActivePreset() {
  presetPills.querySelectorAll('.preset-pill').forEach((pill, idx) => {
    const p = PRESETS[state.mode][idx];
    pill.classList.toggle('active', p && p.value === state.dimensionValue);
  });
}

/**
 * File Handling: Extract metadata & preview
 */
async function handleFiles(fileList) {
  const imageFiles = fileList.filter(file => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name));

  if (imageFiles.length === 0) {
    showToast('지원되는 이미지 파일을 선택해 주세요.', 'error');
    return;
  }

  showToast(`${imageFiles.length}개의 이미지를 불러오는 중입니다...`, 'info');

  const newItems = [];
  for (const file of imageFiles) {
    try {
      const item = await readFileMetadata(file);
      newItems.push(item);
    } catch (err) {
      console.error('이미지 로드 실패:', file.name, err);
      showToast(`${file.name} 이미지를 읽지 못했습니다.`, 'error');
    }
  }

  state.files.push(...newItems);
  updateCalculatedDimensions();
  renderImageList();
  updateUIState();
  showToast(`${newItems.length}개의 이미지가 로컬 메모리에 준비되었습니다.`, 'success');
}

/**
 * Read File Metadata & generate local preview
 */
function readFileMetadata(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const id = 'img_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      resolve({
        id,
        file,
        name: file.name,
        originalWidth: img.naturalWidth || img.width,
        originalHeight: img.naturalHeight || img.height,
        originalSize: file.size,
        previewUrl: objectUrl,
        targetWidth: 0,
        targetHeight: 0,
        status: 'waiting', // 'waiting' | 'processing' | 'ready' | 'error'
        blob: null,
        resizedUrl: null,
        resizedSize: 0,
        outputName: '',
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image decode error'));
    };

    img.src = objectUrl;
  });
}

/**
 * Calculate Target Dimensions for all 5 modes
 */
function calculateTargetSize(origW, origH) {
  let targetW = origW;
  let targetH = origH;
  const val = state.dimensionValue;

  switch (state.mode) {
    case 'width': {
      // 1. X축(가로) 기준
      targetW = Math.round(val);
      const ratio = targetW / origW;
      targetH = Math.round(origH * ratio);
      break;
    }
    case 'height': {
      // 2. Y축(세로) 기준
      targetH = Math.round(val);
      const ratio = targetH / origH;
      targetW = Math.round(origW * ratio);
      break;
    }
    case 'long': {
      // 3. 긴 축 기준
      if (origW >= origH) {
        // 가로가 더 길거나 같음
        targetW = Math.round(val);
        targetH = Math.round(origH * (val / origW));
      } else {
        // 세로가 더 김
        targetH = Math.round(val);
        targetW = Math.round(origW * (val / origH));
      }
      break;
    }
    case 'short': {
      // 4. 짧은 축 기준
      if (origW <= origH) {
        // 가로가 더 짧거나 같음
        targetW = Math.round(val);
        targetH = Math.round(origH * (val / origW));
      } else {
        // 세로가 더 짧음
        targetH = Math.round(val);
        targetW = Math.round(origW * (val / origH));
      }
      break;
    }
    case 'percent': {
      // 5. 퍼센트(%) 비율 기준
      const factor = val / 100;
      targetW = Math.max(1, Math.round(origW * factor));
      targetH = Math.max(1, Math.round(origH * factor));
      break;
    }
  }

  // Check upscaling restriction
  if (!state.allowUpscale) {
    if (targetW > origW || targetH > origH) {
      targetW = origW;
      targetH = origH;
    }
  }

  targetW = Math.max(1, targetW);
  targetH = Math.max(1, targetH);

  return { targetW, targetH };
}

/**
 * Update Calculated Target Dimensions for all items
 */
function updateCalculatedDimensions() {
  state.files.forEach(item => {
    const { targetW, targetH } = calculateTargetSize(item.originalWidth, item.originalHeight);
    item.targetWidth = targetW;
    item.targetHeight = targetH;
    
    // If settings changed after resize, flag as waiting again
    if (item.status === 'ready') {
      // Keep resizedUrl but if dimensions changed, user can re-run
    }
  });

  // Re-render dimension labels on cards
  state.files.forEach(item => {
    const cardDimEl = document.getElementById(`card-target-dim-${item.id}`);
    if (cardDimEl) {
      cardDimEl.textContent = `${item.targetWidth} × ${item.targetHeight}`;
    }
  });
}

/**
 * Render Image List UI
 */
function renderImageList() {
  imageGrid.innerHTML = '';

  state.files.forEach(item => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.id = `card-${item.id}`;

    const isReady = item.status === 'ready';
    const isProcessing = item.status === 'processing';
    const isError = item.status === 'error';

    let statusText = '대기 중';
    let statusClass = 'status-waiting';
    if (isReady) {
      statusText = '변환 완료';
      statusClass = 'status-ready';
    } else if (isProcessing) {
      statusText = '처리 중...';
      statusClass = 'status-processing';
    } else if (isError) {
      statusText = '오류 발생';
      statusClass = 'status-error';
    }

    card.innerHTML = `
      <div class="image-card-top">
        <div class="card-thumbnail-wrapper">
          <img src="${item.previewUrl}" alt="${escapeHtml(item.name)}" class="card-thumbnail" loading="lazy">
        </div>
        <div class="card-details">
          <div class="card-filename" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="card-dimensions-compare">
            <span class="dim-orig">${item.originalWidth} × ${item.originalHeight}</span>
            <span class="dim-arrow">→</span>
            <span class="dim-target" id="card-target-dim-${item.id}">${item.targetWidth} × ${item.targetHeight}</span>
          </div>
          <div class="card-size-compare" id="card-size-${item.id}">
            원본: ${formatBytes(item.originalSize)}
            ${item.resizedSize ? ` <span style="color:#38bdf8;">(${formatBytes(item.resizedSize)})</span>` : ''}
          </div>
        </div>
      </div>
      <div class="card-meta-bar">
        <span class="card-status-badge ${statusClass}" id="card-status-${item.id}">
          ${statusText}
        </span>
        <div class="card-actions">
          <button 
            type="button" 
            class="btn-card-download" 
            id="btn-download-${item.id}" 
            ${!isReady ? 'disabled' : ''}
            title="개별 리사이징 파일 다운로드"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            다운로드
          </button>
          <button 
            type="button" 
            class="btn-danger-ghost" 
            id="btn-remove-${item.id}"
            title="목록에서 제거"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Download single item handler
    const dlBtn = card.querySelector(`#btn-download-${item.id}`);
    dlBtn.addEventListener('click', () => downloadSingleItem(item));

    // Remove item handler
    const rmBtn = card.querySelector(`#btn-remove-${item.id}`);
    rmBtn.addEventListener('click', () => removeItem(item.id));

    imageGrid.appendChild(card);
  });
}

/**
 * Update UI State (Buttons, Counters, Visibility)
 */
function updateUIState() {
  const count = state.files.length;
  const completed = state.files.filter(f => f.status === 'ready').length;

  if (count === 0) {
    actionBar.style.display = 'none';
    imagesListSection.style.display = 'none';
    emptyState.style.display = 'block';
    startBatchBtn.disabled = true;
    downloadZipBtn.disabled = true;
  } else {
    actionBar.style.display = 'flex';
    imagesListSection.style.display = 'flex';
    emptyState.style.display = 'none';
    startBatchBtn.disabled = state.isProcessing;
    downloadZipBtn.disabled = (completed === 0 || state.isProcessing);

    totalCount.textContent = `${count}개`;
    completedCount.textContent = `${completed}개`;
    listBadge.textContent = `${count}건 등록됨 (완료: ${completed})`;

    const totalBytes = state.files.reduce((sum, f) => sum + f.originalSize, 0);
    totalOriginalSize.textContent = formatBytes(totalBytes);
  }
}

/**
 * Remove an item from the list
 */
function removeItem(id) {
  const idx = state.files.findIndex(f => f.id === id);
  if (idx !== -1) {
    const item = state.files[idx];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.resizedUrl) URL.revokeObjectURL(item.resizedUrl);
    state.files.splice(idx, 1);
  }
  renderImageList();
  updateUIState();
}

/**
 * Clear all files
 */
function clearAllFiles() {
  if (state.files.length === 0) return;
  state.files.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item.resizedUrl) URL.revokeObjectURL(item.resizedUrl);
  });
  state.files = [];
  renderImageList();
  updateUIState();
  showToast('목록이 모두 비워졌습니다.', 'info');
}

/**
 * Single Image In-Memory Resizing using HTML5 Canvas
 */
function resizeImageInMemory(item) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = item.targetWidth;
      canvas.height = item.targetHeight;

      const ctx = canvas.getContext('2d');
      // High quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw resized image
      ctx.drawImage(img, 0, 0, item.targetWidth, item.targetHeight);

      // Determine output mime type
      let mimeType = state.format;
      let extension = 'webp';

      if (mimeType === 'original') {
        mimeType = item.file.type || 'image/png';
        const match = item.file.name.match(/\.([0-9a-z]+)$/i);
        extension = match ? match[1].toLowerCase() : 'png';
      } else if (mimeType === 'image/jpeg') {
        extension = 'jpg';
      } else if (mimeType === 'image/webp') {
        extension = 'webp';
      } else if (mimeType === 'image/png') {
        extension = 'png';
      }

      // Output quality (ignored for PNG)
      const quality = (mimeType === 'image/png') ? undefined : state.quality;

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob 생성 실패'));
          return;
        }

        // Clean up previous resizedUrl if any
        if (item.resizedUrl) {
          URL.revokeObjectURL(item.resizedUrl);
        }

        const resizedUrl = URL.createObjectURL(blob);
        const baseName = item.name.replace(/\.[^/.]+$/, '');
        const outputName = `${baseName}_${item.targetWidth}x${item.targetHeight}.${extension}`;

        item.blob = blob;
        item.resizedUrl = resizedUrl;
        item.resizedSize = blob.size;
        item.outputName = outputName;
        item.status = 'ready';

        resolve(item);
      }, mimeType, quality);
    };

    img.onerror = () => {
      reject(new Error('Image failed to render on canvas'));
    };

    img.src = item.previewUrl;
  });
}

/**
 * Start Batch Processing
 */
async function startBatchProcessing() {
  if (state.files.length === 0 || state.isProcessing) return;

  state.isProcessing = true;
  updateUIState();
  progressContainer.style.display = 'block';
  progressTitle.textContent = '이미지 일괄 변환 중...';
  progressFill.style.width = '0%';
  progressPercent.textContent = '0%';

  const total = state.files.length;
  let finished = 0;

  for (let i = 0; i < total; i++) {
    const item = state.files[i];
    item.status = 'processing';
    updateCardStatusUI(item);

    try {
      await resizeImageInMemory(item);
    } catch (err) {
      console.error('리사이징 오류:', item.name, err);
      item.status = 'error';
    }

    finished++;
    const percent = Math.round((finished / total) * 100);
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    progressTitle.textContent = `이미지 변환 중 (${finished}/${total})`;
    updateCardStatusUI(item);
  }

  state.isProcessing = false;
  setTimeout(() => {
    progressContainer.style.display = 'none';
  }, 1200);

  updateUIState();
  showToast(`총 ${total}개의 이미지 리사이징이 완료되었습니다!`, 'success');
}

/**
 * Update UI for a single card status
 */
function updateCardStatusUI(item) {
  const statusEl = document.getElementById(`card-status-${item.id}`);
  const dlBtn = document.getElementById(`btn-download-${item.id}`);
  const sizeEl = document.getElementById(`card-size-${item.id}`);

  if (!statusEl) return;

  if (item.status === 'processing') {
    statusEl.className = 'card-status-badge status-processing';
    statusEl.innerHTML = `<span class="spinner"></span> 처리 중...`;
    if (dlBtn) dlBtn.disabled = true;
  } else if (item.status === 'ready') {
    statusEl.className = 'card-status-badge status-ready';
    statusEl.innerHTML = `✓ 완료`;
    if (dlBtn) dlBtn.disabled = false;
    if (sizeEl) {
      sizeEl.innerHTML = `원본: ${formatBytes(item.originalSize)} → <strong style="color:#38bdf8;">변환: ${formatBytes(item.resizedSize)}</strong>`;
    }
  } else if (item.status === 'error') {
    statusEl.className = 'card-status-badge status-error';
    statusEl.innerHTML = `✕ 오류`;
    if (dlBtn) dlBtn.disabled = true;
  }
}

/**
 * 1. Individual Download Handler
 */
function downloadSingleItem(item) {
  if (!item.blob || !item.resizedUrl) {
    showToast('아직 리사이징이 완료되지 않았습니다.', 'error');
    return;
  }

  const a = document.createElement('a');
  a.href = item.resizedUrl;
  a.download = item.outputName || `resized_${item.name}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`${item.outputName} 개별 다운로드 시작`, 'info');
}

/**
 * 2. Batch Download Handler (.ZIP) via client-side JSZip
 */
async function downloadAllAsZip() {
  const completedItems = state.files.filter(f => f.status === 'ready' && f.blob);

  if (completedItems.length === 0) {
    showToast('다운로드할 변환 완료 이미지가 없습니다. 일괄 변환을 먼저 실행해주세요.', 'error');
    return;
  }

  if (typeof JSZip === 'undefined') {
    showToast('JSZip 라이브러리를 로드하지 못했습니다. 개별 다운로드를 이용해 주세요.', 'error');
    return;
  }

  progressContainer.style.display = 'block';
  progressTitle.textContent = 'ZIP 압축 파일 생성 중...';
  progressFill.style.width = '10%';
  progressPercent.textContent = '10%';
  downloadZipBtn.disabled = true;

  try {
    const zip = new JSZip();

    // Add each file blob to zip archive
    completedItems.forEach((item, index) => {
      // Avoid duplicate filenames in zip
      let fileName = item.outputName;
      zip.file(fileName, item.blob);
    });

    progressFill.style.width = '40%';
    progressPercent.textContent = '40%';

    // Generate zip blob with progress callback
    const zipBlob = await zip.generateAsync(
      { 
        type: 'blob', 
        compression: 'DEFLATE',
        compressionOptions: { level: 6 } 
      },
      (metadata) => {
        const p = Math.round(40 + (metadata.percent * 0.55));
        progressFill.style.width = `${p}%`;
        progressPercent.textContent = `${p}%`;
      }
    );

    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';

    // Trigger download
    const zipUrl = URL.createObjectURL(zipBlob);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const zipName = `Resized_Images_${dateStr}_(${completedItems.length}files).zip`;

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(zipUrl);
      progressContainer.style.display = 'none';
      downloadZipBtn.disabled = false;
    }, 1500);

    showToast(`${zipName} 일괄 압축 다운로드가 시작되었습니다!`, 'success');
  } catch (err) {
    console.error('ZIP 생성 오류:', err);
    progressContainer.style.display = 'none';
    downloadZipBtn.disabled = false;
    showToast('ZIP 압축 파일 생성 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * Utility: Format byte size
 */
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Toast Notifications
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = '';
  if (type === 'success') {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  } else if (type === 'error') {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3200);
}
