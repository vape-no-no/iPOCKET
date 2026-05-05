/**
 * boot.js — iPOCKET v7.0 home screen + navigation
 * Features: XP badge, app switcher, rebuildGrid, openAppById
 */
'use strict';

/* ── APP DEFINITIONS ────────────────────────────────────────── */
const APPS = [
  { id:'clock',       name:'Clock',       ico:'🕐', col:'#00ffcc', group: null, store: false },
  { id:'weather',     name:'Weather',     ico:'🌤️', col:'#4dd0e1', group: null, store: false },
  { id:'timer',       name:'Timer',       ico:'⏱️', col:'#69ff47', group: null, store: false },
  { id:'notes',       name:'Notes',       ico:'📝', col:'#ffd740', group: null, store: false },
  { id:'sports',      name:'Sports',      ico:'🏆', col:'#ff9800', group: null, store: false },
  { id:'casino',      name:'Casino',      ico:'🎰', col:'#ffd700', group: null, store: false },
  { id:'assistant',   name:'Assistant',   ico:'🤖', col:'#00ffcc', group: null, store: false },
  { id:'appstore',    name:'App Store',   ico:'🛍️', col:'#ff4af8', group: null, store: false },
  { id:'snake',       name:'Snake',       ico:'🐍', col:'#69ff47',  group:'games', store: true },
  { id:'flappy',      name:'Flappy',      ico:'🐦', col:'#81d4fa',  group:'games', store: true },
  { id:'pong',        name:'Pong',        ico:'🏓', col:'#f48fb1',  group:'games', store: true },
  { id:'breakout',    name:'Breakout',    ico:'🧱', col:'#ffcc80',  group:'games', store: true },
  { id:'simon',       name:'Simon',       ico:'🟢', col:'#ffeb3b',  group:'games', store: true },
  { id:'reaction',    name:'Reaction',    ico:'⚡', col:'#fff9c4',  group:'games', store: true },
  { id:'colorgame',   name:'Colors',      ico:'🎨', col:'#e1bee7',  group:'games', store: true },
  { id:'g2048',       name:'2048',        ico:'🟦', col:'#edc22e',  group:'games', store: true },
  { id:'pacman',      name:'Pac-Man',     ico:'👾', col:'#ffd700',  group:'games', store: true },
  { id:'deviceinfo',  name:'Device',      ico:'📊', col:'#ff6d6d',  group:'device', store: true },
  { id:'benchmark',   name:'Benchmark',   ico:'🔬', col:'#ff6d6d',  group:'device', store: true },
  { id:'gyro',        name:'Compass',     ico:'🧭', col:'#4dd0e1',  group:'device', store: true },
  { id:'terminal',    name:'Terminal',    ico:'💻', col:'#00ff41',  group:'device', store: false },
  { id:'filesystem',  name:'Files',       ico:'🗂️', col:'#ffd740',  group:'device', store: false },
  { id:'ascii',       name:'ASCII Cam',   ico:'📷', col:'#fff176',  group:'creative', store: true },
  { id:'djpad',       name:'DJ Pad',      ico:'🎹', col:'#ff9800',  group:'creative', store: true },
  { id:'visualizer',  name:'Visualizer',  ico:'🎵', col:'#ce93d8',  group:'creative', store: true },
  { id:'particles',   name:'Sparks',      ico:'✨', col:'#ff4af8',  group:'creative', store: true },
  { id:'screensaver', name:'Screensaver', ico:'🌊', col:'#ce93d8',  group:'creative', store: true },
];

const FOLDERS = [
  { id:'games',    name:'Games',    ico:'🎮', col:'#69ff47' },
  { id:'device',   name:'Device',   ico:'📱', col:'#ff6d6d' },
  { id:'creative', name:'Creative', ico:'🎨', col:'#e1bee7' },
];

const APP_MAP = {
  clock:       () => initClock(),
  particles:   () => initParticles(),
  weather:     () => initWeather(),
  ascii:       () => initASCII(),
  screensaver: () => initScreensaver(),
  snake:       () => initSnake(),
  simon:       () => initSimon(),
  djpad:       () => initDJPad(),
  flappy:      () => initFlappy(),
  pong:        () => initPong(),
  reaction:    () => initReaction(),
  breakout:    () => initBreakout(),
  colorgame:   () => initColorGame(),
  benchmark:   () => initBenchmark(),
  g2048:       () => init2048(),
  timer:       () => initTimer(),
  notes:       () => initNotes(),
  gyro:        () => initGyro(),
  visualizer:  () => initVisualizer(),
  deviceinfo:  () => initDeviceInfo(),
  sports:      () => initSports(),
  casino:      () => initCasino(),
  pacman:      () => initPacman(),
  assistant:   () => initAssistant(),
  terminal:    () => initTerminal(),
  filesystem:  () => initFileSystem(),
  appstore:    () => initAppStore(),
};

/* ── LAYER / APP LIFECYCLE ─────────────────────────────────── */
const layer = document.getElementById('layer');
let cleanup = null;
const recentApps = [];

function openApp(app, iconEl) {
  content.innerHTML = '';
  const r = iconEl.getBoundingClientRect();
  layer.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  layer.style.transform = '';
  layer.style.opacity = '';
  layer.style.transition = '';
  layer.classList.add('open');
  const existing = recentApps.findIndex(a => a.id === app.id);
  if (existing !== -1) recentApps.splice(existing, 1);
  recentApps.unshift({ ...app, iconEl });
  if (recentApps.length > 6) recentApps.pop();
  POS.trackAppOpen(app.id);
  const fn = APP_MAP[app.id];
  cleanup = fn ? fn() : null;
}

window._openAppById = function(appId) {
  const app = APPS.find(a => a.id === appId);
  if (!app) return;
  const fake = document.createElement('div');
  fake.style.cssText = 'position:fixed;left:50%;top:50%;width:1px;height:1px;';
  document.body.appendChild(fake);
  openApp(app, fake);
  setTimeout(() => fake.remove(), 500);
};

function closeApp() {
  if (cleanup) { cleanup(); cleanup = null; }
  layer.style.transition = 'transform .32s ease,opacity .24s ease';
  layer.style.transform = 'translateX(105%)';
  layer.style.opacity = '0';
  setTimeout(() => {
    layer.classList.remove('open');
    layer.style.transform = '';
    layer.style.opacity = '';
    layer.style.transition = '';
    content.innerHTML = '';
  }, 340);
}

/* ── APP SWITCHER ──────────────────────────────────────────── */
let switcherOverlay = null;

function openSwitcher() {
  if (switcherOverlay) return;
  haptic('medium');
  switcherOverlay = document.createElement('div');
  switcherOverlay.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;flex-direction:column;';
  const bd = document.createElement('div');
  bd.style.cssText = 'position:absolute;inset:0;background:rgba(5,5,8,.9);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);opacity:0;transition:opacity .22s;';
  switcherOverlay.appendChild(bd);
  const panel = document.createElement('div');
  panel.style.cssText = 'position:relative;z-index:1;padding:calc(var(--safe-top,89px) + 12px) 20px calc(var(--sb,20px) + 28px);display:flex;flex-direction:column;gap:18px;height:100%;';
  const title = document.createElement('div');
  title.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:var(--cyan);';
  title.textContent = 'App Switcher';
  panel.appendChild(title);
  if (!recentApps.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--dim);';
    empty.innerHTML = '<div style="font-size:3rem">📱</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:.7rem;letter-spacing:.1em;">No recent apps</div>';
    panel.appendChild(empty);
  } else {
    const cards = document.createElement('div');
    cards.style.cssText = 'display:flex;flex-direction:column;gap:10px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;';
    recentApps.forEach((app, i) => {
      const card = document.createElement('div');
      card.style.cssText = `display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;cursor:pointer;background:rgba(0,0,0,.4);border:1px solid ${app.col}44;box-shadow:0 0 16px ${app.col}14;transition:transform .15s;-webkit-tap-highlight-color:transparent;animation:ci .4s ${i*.05}s both;`;
      card.innerHTML = `<div style="width:48px;height:48px;border-radius:22%;display:flex;align-items:center;justify-content:center;font-size:1.7rem;background:rgba(0,0,0,.5);border:1px solid ${app.col}44;flex-shrink:0;">${app.ico}</div><div style="flex:1;"><div style="font-family:'Orbitron',sans-serif;font-size:.6rem;letter-spacing:.1em;color:var(--text);">${app.name}</div>${i===0?'<div style="font-family:\'Share Tech Mono\',monospace;font-size:.48rem;color:var(--dim);margin-top:2px;letter-spacing:.08em;">Most recent</div>':''}</div><div style="color:var(--dim);">›</div>`;
      card.addEventListener('touchstart', () => { card.style.transform='scale(.97)'; }, {passive:true});
      card.addEventListener('touchend', () => { card.style.transform=''; }, {passive:true});
      card.onclick = () => { closeSwitcher(); setTimeout(() => window._openAppById(app.id), 180); };
      cards.appendChild(card);
    });
    panel.appendChild(cards);
  }
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'flex-shrink:0;font-family:"Orbitron",sans-serif;font-size:.54rem;letter-spacing:.15em;text-transform:uppercase;color:var(--dim);border:1px solid var(--dim);background:transparent;padding:11px 30px;border-radius:22px;cursor:pointer;-webkit-tap-highlight-color:transparent;';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = closeSwitcher;
  panel.appendChild(closeBtn);
  switcherOverlay.appendChild(panel);
  document.body.appendChild(switcherOverlay);
  requestAnimationFrame(() => { bd.style.opacity = '1'; });
  bd.addEventListener('click', closeSwitcher);
}

function closeSwitcher() {
  if (!switcherOverlay) return;
  switcherOverlay.querySelector('div').style.opacity = '0';
  setTimeout(() => { if (switcherOverlay) { switcherOverlay.remove(); switcherOverlay = null; } }, 240);
}

/* ── SWIPE TO CLOSE ────────────────────────────────────────── */
(function() {
  let swX=null, swY=null, swDX=0;
  layer.addEventListener('touchstart', e => {
    const t=e.touches[0];
    if (t.clientX<24 && layer.classList.contains('open')) { swX=t.clientX; swY=t.clientY; swDX=0; }
  }, {passive:true});
  layer.addEventListener('touchmove', e => {
    if (swX===null) return;
    const t=e.touches[0]; const dx=t.clientX-swX, dy=Math.abs(t.clientY-swY);
    if (dy>55 && dx<30) { swX=null; return; }
    swDX=Math.max(0,dx);
    if (swDX>5) { layer.style.transition='none'; layer.style.transform=`translateX(${swDX*.75}px)`; layer.style.opacity=`${Math.max(.2,1-swDX/300)}`; }
  }, {passive:true});
  layer.addEventListener('touchend', () => {
    if (swX===null) return;
    if (swDX>100) { closeApp(); }
    else { layer.style.transition='transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s'; layer.style.transform=''; layer.style.opacity=''; setTimeout(()=>{layer.style.transition='';},380); }
    swX=null; swY=null; swDX=0;
  }, {passive:true});
})();

document.addEventListener('keydown', e => { if (e.key==='Escape') { closeApp(); closeFolder(); closeSwitcher(); } });

/* ── FOLDER OVERLAY ────────────────────────────────────────── */
let folderOverlay = null;
function openFolder(folder) {
  if (folderOverlay) folderOverlay.remove();
  haptic('medium');
  const installedIds = POS.getInstalledApps();
  const appsInFolder = APPS.filter(a => {
    if (a.group !== folder.id) return false;
    if (a.store && installedIds && !installedIds.includes(a.id)) return false;
    return true;
  });
  folderOverlay = document.createElement('div');
  folderOverlay.style.cssText = 'position:fixed;inset:0;z-index:150;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(5,5,8,.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);opacity:0;transition:opacity .22s ease;';
  folderOverlay.appendChild(backdrop);
  const panel = document.createElement('div');
  panel.style.cssText = 'position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:18px;padding:28px 20px 32px;transform:scale(.82);opacity:0;transition:transform .32s cubic-bezier(.34,1.56,.64,1),opacity .26s ease;width:100%;max-width:380px;';
  const ftitle = document.createElement('div');
  ftitle.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.7rem;letter-spacing:.24em;text-transform:uppercase;color:var(--text);';
  ftitle.textContent = folder.ico + ' ' + folder.name;
  panel.appendChild(ftitle);
  const innerGrid = document.createElement('div');
  innerGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:100%;';
  appsInFolder.forEach((app, i) => {
    const cell = document.createElement('div');
    cell.style.cssText = `aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;border-radius:22%;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;border:1px solid ${app.col}55;background:rgba(0,0,0,.35);position:relative;overflow:hidden;transition:transform .15s ease;box-shadow:0 0 16px ${app.col}18,0 4px 20px rgba(0,0,0,.5);animation:ci .5s ${i*.055}s both;`;
    const gloss = document.createElement('div');
    gloss.style.cssText = 'position:absolute;inset:0;border-radius:inherit;background:radial-gradient(ellipse at 30% 25%,rgba(255,255,255,.09),transparent 65%);pointer-events:none;';
    cell.appendChild(gloss);
    cell.innerHTML += `<span style="font-size:clamp(1.9rem,9.5vw,2.5rem);line-height:1;position:relative;">${app.ico}</span><span style="font-size:.48rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text);opacity:.85;position:relative;">${app.name}</span>`;
    cell.addEventListener('click', () => { closeFolder(); setTimeout(() => openApp(app, cell), 150); });
    cell.addEventListener('touchstart', () => { cell.style.transform='scale(.87)'; }, {passive:true});
    cell.addEventListener('touchend', () => { cell.style.transform=''; }, {passive:true});
    innerGrid.appendChild(cell);
  });
  if (!appsInFolder.length) {
    innerGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;font-family:'Share Tech Mono',monospace;font-size:.65rem;color:var(--dim);padding:24px 0;">No apps installed.<br>Visit App Store.</div>`;
  }
  panel.appendChild(innerGrid);
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.54rem;letter-spacing:.15em;text-transform:uppercase;color:var(--dim);border:1px solid var(--dim);background:transparent;padding:9px 26px;border-radius:20px;cursor:pointer;-webkit-tap-highlight-color:transparent;';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = closeFolder;
  panel.appendChild(closeBtn);
  folderOverlay.appendChild(panel);
  document.body.appendChild(folderOverlay);
  requestAnimationFrame(() => { backdrop.style.opacity='1'; panel.style.transform='scale(1)'; panel.style.opacity='1'; });
  backdrop.addEventListener('click', closeFolder);
}
function closeFolder() {
  if (!folderOverlay) return;
  const c = folderOverlay.children;
  if (c[0]) c[0].style.opacity='0';
  if (c[1]) { c[1].style.transform='scale(.82)'; c[1].style.opacity='0'; }
  setTimeout(() => { if (folderOverlay) { folderOverlay.remove(); folderOverlay=null; } }, 300);
}

/* ── HOME DATE ─────────────────────────────────────────────── */
const homeDate = document.getElementById('home-date');
const fmtDate = () => {
  homeDate.textContent = new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }).toUpperCase();
};
fmtDate();
setInterval(fmtDate, 30000);

/* ── BUILD HOME GRID ───────────────────────────────────────── */
const gridEl = document.getElementById('grid');
const xpBadgeWrap = document.getElementById('xp-badge-wrap');

function buildGrid() {
  gridEl.innerHTML = '';
  const installedIds = POS.getInstalledApps();
  const topApps = APPS.filter(a => a.group === null);
  topApps.forEach((app, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.cssText = `border-color:${app.col}55;box-shadow:0 0 18px ${app.col}18,0 5px 24px rgba(0,0,0,.5);animation-delay:${.45+i*.07}s`;
    cell.innerHTML = `<span class="ico">${app.ico}</span><span class="lbl">${app.name}</span>`;
    const gloss = document.createElement('div');
    gloss.style.cssText = 'position:absolute;inset:0;border-radius:inherit;background:radial-gradient(ellipse at 30% 25%,rgba(255,255,255,.09),transparent 65%);pointer-events:none;';
    cell.appendChild(gloss);
    cell.addEventListener('click', () => { haptic('medium'); openApp(app, cell); });
    gridEl.appendChild(cell);
  });
  FOLDERS.forEach((folder, i) => {
    const appsIn = APPS.filter(a => {
      if (a.group!==folder.id) return false;
      if (a.store && installedIds && !installedIds.includes(a.id)) return false;
      return true;
    });
    const previews = appsIn.slice(0,4);
    const previewHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;width:54%;aspect-ratio:1;background:rgba(255,255,255,.06);border-radius:16%;padding:5px;flex-shrink:0;">${previews.map(a=>`<span style="font-size:clamp(.8rem,4vw,1.2rem);line-height:1;display:flex;align-items:center;justify-content:center;">${a.ico}</span>`).join('')}${previews.length<4?Array(4-previews.length).fill('<span></span>').join(''):''}</div>`;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.cssText = `border-color:${folder.col}55;box-shadow:0 0 18px ${folder.col}18,0 5px 24px rgba(0,0,0,.5);animation-delay:${.45+(topApps.length+i)*.07}s`;
    cell.innerHTML = `${previewHTML}<span class="lbl">${folder.name}</span>`;
    const gloss = document.createElement('div');
    gloss.style.cssText = 'position:absolute;inset:0;border-radius:inherit;background:radial-gradient(ellipse at 30% 25%,rgba(255,255,255,.09),transparent 65%);pointer-events:none;';
    cell.appendChild(gloss);
    cell.addEventListener('click', () => openFolder(folder));
    gridEl.appendChild(cell);
  });
}

window._rebuildGrid = buildGrid;

function buildHomeExtras() {
  if (!xpBadgeWrap) return;
  xpBadgeWrap.innerHTML = '';
  const badge = document.createElement('div');
  badge.style.cssText = 'flex:1;';
  renderXPBadge(badge);
  xpBadgeWrap.appendChild(badge);
  const sw = document.createElement('button');
  sw.style.cssText = 'flex-shrink:0;font-family:"Orbitron",sans-serif;font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);padding:8px 14px;border-radius:18px;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;gap:6px;';
  sw.innerHTML = '<span style="font-size:.8rem;">▣</span> Recents';
  sw.onclick = openSwitcher;
  xpBadgeWrap.appendChild(sw);
}

buildHomeExtras();
buildGrid();

setTimeout(() => {
  const s = POS.get();
  if ((s.bootCount||0) <= 1) showToast('Welcome to iPOCKET v7.0!', 'cyan', 3500);
  else showToast(`Welcome back! Level ${s.level} 🎮`, 'cyan', 3000);
}, 8000);
