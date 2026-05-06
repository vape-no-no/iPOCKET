/* ════════ GALLERY (Win98) — persistent photos ════════ */
function initGallery98() {
  const c = window.content;
  c.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;';

  const STORAGE_KEY = 'ipocket_gallery_v8';

  // Load saved photos from localStorage
  let photos = [];
  try { photos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { photos = []; }

  function savePhotos() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(photos)); } catch(e) {}
  }

  const menu = document.createElement('div');
  menu.className = 'win-menubar';
  menu.innerHTML = '<div class="win-menu-item">File</div><div class="win-menu-item">View</div><div class="win-menu-item">Help</div>';
  c.appendChild(menu);

  // Toolbar
  const tb = document.createElement('div');
  tb.className = 'win-toolbar';
  const addBtn = document.createElement('button');
  addBtn.className = 'win-toolbar-btn';
  addBtn.innerHTML = '📷 Take Photo';
  const importBtn = document.createElement('button');
  importBtn.className = 'win-toolbar-btn';
  importBtn.innerHTML = '📂 Import';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'win-toolbar-btn';
  deleteBtn.innerHTML = '🗑️ Delete';
  const sep = document.createElement('div');
  sep.className = 'win-toolbar-sep';
  tb.append(addBtn, importBtn, sep, deleteBtn);
  c.appendChild(tb);

  // Body
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;';
  c.appendChild(body);

  const wrap = document.createElement('div');
  wrap.className = 'gallery98-wrap';
  wrap.style.cssText = 'width:100%;height:100%;';
  body.appendChild(wrap);

  const grid = document.createElement('div');
  grid.className = 'gallery98-grid';
  wrap.appendChild(grid);

  // Status bar
  const sb = document.createElement('div');
  sb.className = 'win-statusbar';
  const sbCount = document.createElement('div');
  sbCount.className = 'win-status-pane';
  sbCount.textContent = photos.length + ' photo(s)';
  sb.appendChild(sbCount);
  c.appendChild(sb);

  let selectedIdx = -1;

  function renderGrid() {
    grid.innerHTML = '';
    sbCount.textContent = photos.length + ' photo(s)';
    if (!photos.length) {
      const empty = document.createElement('div');
      empty.className = 'gallery98-empty';
      empty.innerHTML = '<div style="font-size:3rem">📷</div><div>No photos yet.</div><div style="font-size:14px;">Use "Take Photo" or "Import" to add images.</div>';
      grid.appendChild(empty);
      return;
    }
    photos.forEach((photo, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery98-thumb';
      if (selectedIdx === i) thumb.style.outline = '3px solid var(--win-select)';
      const img = document.createElement('img');
      img.src = photo.data;
      img.alt = photo.name || 'Photo';
      img.loading = 'lazy';
      thumb.appendChild(img);
      thumb.addEventListener('click', () => {
        selectedIdx = i;
        openViewer(i);
      });
      grid.appendChild(thumb);
    });
  }

  function openViewer(idx) {
    const viewer = document.createElement('div');
    viewer.className = 'gallery98-viewer';
    const img = document.createElement('img');
    img.src = photos[idx].data;
    img.alt = photos[idx].name || 'Photo';
    const vbar = document.createElement('div');
    vbar.className = 'gallery98-viewer-bar';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn98'; prevBtn.textContent = '◀ Prev';
    prevBtn.onclick = () => { viewer.remove(); if (idx > 0) openViewer(idx-1); };
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn98'; nextBtn.textContent = 'Next ▶';
    nextBtn.onclick = () => { viewer.remove(); if (idx < photos.length-1) openViewer(idx+1); };
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn98'; closeBtn.textContent = '✕ Close';
    closeBtn.onclick = () => { viewer.remove(); };
    const delBtn = document.createElement('button');
    delBtn.className = 'btn98 btn98-red'; delBtn.textContent = '🗑️ Delete';
    delBtn.onclick = () => {
      photos.splice(idx, 1);
      savePhotos();
      viewer.remove();
      renderGrid();
      pushNotification && pushNotification('Gallery','Photo deleted.','🖼️');
    };
    const nameLabel = document.createElement('span');
    nameLabel.style.cssText = 'font-family:var(--pixel-font);font-size:14px;color:var(--win-text);flex:1;padding:0 6px;';
    nameLabel.textContent = (photos[idx].name || 'Photo') + ' (' + (idx+1) + '/' + photos.length + ')';
    vbar.append(prevBtn, nameLabel, nextBtn, delBtn, closeBtn);
    viewer.append(img, vbar);
    body.appendChild(viewer);
  }

  // Take photo via camera
  addBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        photos.unshift({
          data: e.target.result,
          name: file.name,
          date: new Date().toLocaleDateString(),
        });
        savePhotos();
        renderGrid();
        POS.addXP(5, 'photo_taken');
        pushNotification && pushNotification('Gallery', 'Photo saved!', '📷');
      };
      reader.readAsDataURL(file);
      input.remove();
    };
    input.click();
  };

  // Import from files
  importBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      let count = 0;
      Array.from(input.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          photos.unshift({
            data: e.target.result,
            name: file.name,
            date: new Date().toLocaleDateString(),
          });
          count++;
          if (count === input.files.length) {
            savePhotos();
            renderGrid();
            pushNotification && pushNotification('Gallery', count + ' photo(s) imported!', '🖼️');
          }
        };
        reader.readAsDataURL(file);
      });
      input.remove();
    };
    input.click();
  };

  // Delete selected
  deleteBtn.onclick = () => {
    if (selectedIdx < 0 || selectedIdx >= photos.length) {
      showDialog98('Delete','No photo selected.',[{label:'OK',primary:true}]);
      return;
    }
    showDialog98('Delete Photo','Delete this photo? This cannot be undone.',[
      {label:'Delete',primary:true,action(){
        photos.splice(selectedIdx,1);
        selectedIdx=-1;
        savePhotos();
        renderGrid();
      }},
      {label:'Cancel'},
    ]);
  };

  renderGrid();
  POS.trackAppOpen('gallery');
}
