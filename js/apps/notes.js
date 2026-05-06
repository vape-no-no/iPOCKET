/* ════════════ NOTES ════════════ */
function initNotes() {
  const STORE_KEY = 'ipocket_notes';

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch(e) { return []; }
  };
  const save = notes => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(notes)); } catch(e) {}
  };

  let notes = load();
  let activeIdx = null;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;background:#050508;overflow:hidden;';
  content.appendChild(wrap);

  /* ── Top bar ── */
  const topBar = document.createElement('div');
  topBar.style.cssText = 'flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:8px 18px 12px;border-bottom:1px solid rgba(255,255,255,.06);';
  topBar.innerHTML = `
    <div style="font-family:'Orbitron',sans-serif;font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:var(--cyan);text-shadow:var(--gc)">Notes</div>
    <button id="notes-new" style="font-family:'Orbitron',sans-serif;font-size:.55rem;letter-spacing:.12em;text-transform:uppercase;color:#050508;background:var(--cyan);border:none;padding:8px 18px;border-radius:18px;cursor:pointer;box-shadow:var(--gc);-webkit-tap-highlight-color:transparent;">+ New</button>`;
  wrap.appendChild(topBar);

  /* ── List / Editor panels ── */
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:hidden;position:relative;';
  wrap.appendChild(body);

  const listPanel = document.createElement('div');
  listPanel.style.cssText = 'position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 0 40px;';
  body.appendChild(listPanel);

  const editorPanel = document.createElement('div');
  editorPanel.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;background:#050508;transform:translateX(100%);transition:transform .32s cubic-bezier(.34,1.56,.64,1);';
  body.appendChild(editorPanel);

  /* ── Editor contents ── */
  const editorTop = document.createElement('div');
  editorTop.style.cssText = 'flex-shrink:0;display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);';

  const backBtn = document.createElement('button');
  backBtn.innerHTML = '← Back';
  backBtn.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan);background:transparent;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;padding:6px 0;flex-shrink:0;';

  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '🗑';
  deleteBtn.style.cssText = 'font-size:1.1rem;background:transparent;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;padding:6px;margin-left:auto;opacity:.6;';

  editorTop.appendChild(backBtn);
  editorTop.appendChild(deleteBtn);
  editorPanel.appendChild(editorTop);

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.placeholder = 'Title...';
  titleInput.style.cssText = 'width:100%;padding:14px 18px 8px;font-family:"Orbitron",sans-serif;font-size:1rem;font-weight:700;letter-spacing:.04em;color:var(--text);background:transparent;border:none;outline:none;flex-shrink:0;';
  editorPanel.appendChild(titleInput);

  const bodyInput = document.createElement('textarea');
  bodyInput.placeholder = 'Start typing...';
  bodyInput.style.cssText = 'flex:1;padding:8px 18px 60px;font-family:"Share Tech Mono",monospace;font-size:.82rem;color:var(--text);background:transparent;border:none;outline:none;resize:none;line-height:1.7;-webkit-overflow-scrolling:touch;';
  editorPanel.appendChild(bodyInput);

  /* ── Render note list ── */
  const renderList = () => {
    listPanel.innerHTML = '';
    if (!notes.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;height:100%;padding:60px 30px;text-align:center;';
      empty.innerHTML = `<div style="font-size:3rem">📝</div><div style="font-family:'Share Tech Mono',monospace;font-size:.7rem;color:var(--dim);letter-spacing:.12em;text-transform:uppercase">No notes yet.<br>Tap + New to start.</div>`;
      listPanel.appendChild(empty);
      return;
    }
    notes.forEach((note, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s;';
      row.innerHTML = `
        <div style="font-family:'Orbitron',sans-serif;font-size:.72rem;letter-spacing:.06em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${note.title || 'Untitled'}</div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span style="font-family:'Share Tech Mono',monospace;font-size:.55rem;color:var(--dim);">${new Date(note.updated).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
          <span style="font-family:'Share Tech Mono',monospace;font-size:.55rem;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${(note.body || '').replace(/\n/g,' ').slice(0, 60)}</span>
        </div>`;
      row.addEventListener('click', () => openNote(i));
      row.addEventListener('touchstart', () => { row.style.background = 'rgba(0,255,204,.04)'; }, { passive: true });
      row.addEventListener('touchend', () => { row.style.background = ''; }, { passive: true });
      listPanel.appendChild(row);
    });
  };

  /* ── Open / create note ── */
  const openNote = (idx) => {
    activeIdx = idx;
    titleInput.value = notes[idx].title || '';
    bodyInput.value = notes[idx].body || '';
    editorPanel.style.transform = 'translateX(0)';
    setTimeout(() => {
      if (!notes[idx].title) titleInput.focus();
      else bodyInput.focus();
    }, 350);
  };

  const closeEditor = () => {
    // Auto-save on back
    if (activeIdx !== null) {
      notes[activeIdx].title   = titleInput.value.trim() || 'Untitled';
      notes[activeIdx].body    = bodyInput.value;
      notes[activeIdx].updated = Date.now();
      // Remove if completely empty
      if (!titleInput.value.trim() && !bodyInput.value.trim()) {
        notes.splice(activeIdx, 1);
      }
      save(notes);
    }
    activeIdx = null;
    editorPanel.style.transform = 'translateX(100%)';
    renderList();
  };

  const newNote = () => {
    haptic('medium');
    if (window.POS) POS.markFlag('noteMade');
    const note = { title:'', body:'', updated: Date.now() };
    notes.unshift(note);
    save(notes);
    openNote(0);
  };

  deleteBtn.onclick = () => {
    haptic('heavy');
    if (activeIdx !== null) { notes.splice(activeIdx, 1); save(notes); }
    activeIdx = null;
    editorPanel.style.transform = 'translateX(100%)';
    renderList();
  };

  backBtn.onclick    = () => { haptic('light'); closeEditor(); };
  document.getElementById('notes-new').onclick = newNote;

  // Auto-save while typing
  let saveTimer = null;
  const autoSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (activeIdx !== null) {
        notes[activeIdx].title   = titleInput.value.trim() || 'Untitled';
        notes[activeIdx].body    = bodyInput.value;
        notes[activeIdx].updated = Date.now();
        save(notes);
      }
    }, 800);
  };
  titleInput.addEventListener('input', autoSave);
  bodyInput.addEventListener('input', autoSave);

  renderList();
  return () => { clearTimeout(saveTimer); };
}
