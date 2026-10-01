/* ============================================================
   АДМИН: МЕДИА-БИБЛИОТЕКА
   ============================================================ */

const mediaState = {
  all: [],
  filter: 'all',
  uploadFolder: 'products'
};

// ============================================================
// 1. Рендер страницы
// ============================================================
async function renderMedia(container) {
  container.innerHTML = `
    <div class="media-header">
      <h2 class="media-header__title">Медиа-библиотека <small id="media-count"></small></h2>
    </div>

    <!-- Загрузка -->
    <div class="media-upload" id="media-upload">
      <div class="media-upload__icon">📁</div>
      <div class="media-upload__title">Перетащите файл или нажмите для выбора</div>
      <div class="media-upload__hint">JPG, PNG, WEBP, SVG, GIF, MP4, WEBM — до 20 МБ</div>

      <div class="media-upload__folder" id="upload-folder">
        <button class="media-upload__folder-btn is-active" data-folder="products">🎂 Товары</button>
        <button class="media-upload__folder-btn" data-folder="hero">🎬 Hero</button>
        <button class="media-upload__folder-btn" data-folder="banners">🖼️ Баннеры</button>
        <button class="media-upload__folder-btn" data-folder="misc">📦 Прочее</button>
      </div>

      <input type="file" id="media-file-input" accept="image/*,video/mp4,video/webm" />

      <div class="media-upload__progress" id="media-progress">
        <div style="font-size:0.85rem;font-weight:600;">Загрузка...</div>
        <div class="media-upload__progress-bar">
          <div class="media-upload__progress-fill" id="media-progress-fill"></div>
        </div>
      </div>
    </div>

    <!-- Фильтры -->
    <div class="media-filters" id="media-filters">
      <button class="media-filter is-active" data-filter="all">Все</button>
      <button class="media-filter" data-filter="image">🖼️ Изображения</button>
      <button class="media-filter" data-filter="video">🎬 Видео</button>
    </div>

    <!-- Сетка -->
    <div id="media-grid-wrap">
      <div class="admin-loading" style="min-height:200px">
        <div class="admin-loading__spinner"></div>
        <span>Загружаем медиа...</span>
      </div>
    </div>
  `;

  initUpload();
  initFilters();
  await loadMedia();
}

// ============================================================
// 2. Загрузка файлов
// ============================================================
function initUpload() {
  const uploadBox = document.getElementById('media-upload');
  const fileInput = document.getElementById('media-file-input');

  // Клик по области
  uploadBox.addEventListener('click', (e) => {
    if (e.target.closest('.media-upload__folder')) return;
    fileInput.click();
  });

  // Выбор папки
  document.querySelectorAll('.media-upload__folder-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.media-upload__folder-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      mediaState.uploadFolder = btn.dataset.folder;
    });
  });

  // Выбор файла
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) uploadFile(e.target.files[0]);
  });

  // Drag & drop
  uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('is-dragover');
  });

  uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('is-dragover');
  });

  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('is-dragover');
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
  });
}

async function uploadFile(file) {
  if (file.size > 20 * 1024 * 1024) {
    showMediaToast('Файл больше 20 МБ', 'error');
    return;
  }

  const progressBox = document.getElementById('media-progress');
  const progressFill = document.getElementById('media-progress-fill');
  progressBox.classList.add('is-visible');
  progressFill.style.width = '10%';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', mediaState.uploadFolder);

  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = `${pct}%`;
    }
  });

  xhr.addEventListener('load', async () => {
    progressBox.classList.remove('is-visible');
    progressFill.style.width = '0%';

    if (xhr.status === 200 || xhr.status === 201) {
      showMediaToast('Файл загружен');
      await loadMedia();
    } else {
      let err = 'Ошибка загрузки';
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.error) err = data.error;
      } catch {}
      showMediaToast(err, 'error');
    }
  });

  xhr.addEventListener('error', () => {
    progressBox.classList.remove('is-visible');
    progressFill.style.width = '0%';
    showMediaToast('Ошибка сети', 'error');
  });

  xhr.open('POST', '/api/admin/media/upload');
  xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);
  xhr.send(formData);
}

// ============================================================
// 3. Загрузка списка
// ============================================================
async function loadMedia() {
  try {
    const res = await fetch('/api/admin/media', {
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка загрузки');
    mediaState.all = await res.json();

    document.getElementById('media-count').textContent = `(${mediaState.all.length})`;
    renderGrid();
  } catch (err) {
    console.error(err);
    document.getElementById('media-grid-wrap').innerHTML = `
      <div class="media-empty">
        <div class="media-empty__icon">😕</div>
        <div>Не удалось загрузить файлы</div>
      </div>
    `;
  }
}

// ============================================================
// 4. Фильтры
// ============================================================
function initFilters() {
  document.querySelectorAll('.media-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.media-filter').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      mediaState.filter = btn.dataset.filter;
      renderGrid();
    });
  });
}

// ============================================================
// 5. Сетка
// ============================================================
function renderGrid() {
  const wrap = document.getElementById('media-grid-wrap');

  let list = [...mediaState.all];
  if (mediaState.filter !== 'all') {
    list = list.filter(f => f.type === mediaState.filter);
  }

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="media-empty">
        <div class="media-empty__icon">📁</div>
        <div>Файлов пока нет</div>
        <div style="font-size:0.85rem;margin-top:8px;">Загрузите первый файл выше</div>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="media-grid">
      ${list.map(file => {
        const isVideo = file.type === 'video';
        return `
          <div class="media-item" data-file='${JSON.stringify({folder: file.folder, name: file.name}).replace(/'/g, '&apos;')}'>
            ${isVideo
              ? '<div class="media-item__video-icon">🎬</div>'
              : `<img class="media-item__preview" src="${file.url}" alt="${file.name}" loading="lazy" />`
            }
            <div class="media-item__overlay">
              <div class="media-item__name">${file.name}</div>
              <div class="media-item__size">${formatSize(file.size)}</div>
              <div class="media-item__actions">
                <button class="media-item__btn" data-copy="${file.url}">Копировать URL</button>
                <button class="media-item__btn media-item__btn--danger" data-delete data-folder="${file.folder}" data-name="${file.name}">Удалить</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Обработчики
  wrap.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.dataset.copy);
    });
  });

  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFile(btn.dataset.folder, btn.dataset.name);
    });
  });
}

// ============================================================
// 6. Удаление
// ============================================================
async function deleteFile(folder, name) {
  if (!confirm(`Удалить файл «${name}»?\n\nВнимание: если файл используется на сайте — он перестанет отображаться.`)) return;

  try {
    const res = await fetch(`/api/admin/media?folder=${folder}&filename=${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Ошибка удаления');

    await loadMedia();
    showMediaToast('Файл удалён');
  } catch (err) {
    showMediaToast(err.message, 'error');
  }
}

// ============================================================
// 7. Копирование
// ============================================================
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showMediaToast('URL скопирован'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showMediaToast('URL скопирован');
  } catch {
    showMediaToast('Не удалось скопировать', 'error');
  }
  ta.remove();
}

// ============================================================
// 8. Утилиты
// ============================================================
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

function showMediaToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'media-toast' + (type === 'error' ? ' is-error' : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}