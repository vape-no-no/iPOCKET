/**
 * state.js — iPOCKET global state engine
 * XP / Level / Achievements / High Scores / Notification bus
 * Must load AFTER core.js, BEFORE any app.
 */
'use strict';

/* ══════════════════════════════════════════════════════
   STATE STORE
══════════════════════════════════════════════════════ */
const STATE_KEY = 'ipocket_state_v7';

const DEFAULT_STATE = {
  xp: 0,
  level: 1,
  gamesPlayed: 0,
  appsOpened: 0,
  achievements: {},       // id → true
  highScores: {},         // appId → number
  installedApps: null,    // null = all installed (first run)
  theme: 'cyber',
  bootCount: 0,
};

window.POS = (function () {
  // ── Load / Save ──────────────────────────────────────
  const load = () => {
    try { return Object.assign({}, DEFAULT_STATE, JSON.parse(localStorage.getItem(STATE_KEY) || '{}')); }
    catch { return Object.assign({}, DEFAULT_STATE); }
  };
  const save = () => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
  };

  let state = load();

  // ── XP / Level ───────────────────────────────────────
  const XP_PER_LEVEL = (lvl) => 100 + lvl * 50;  // level 1→2: 150xp, 2→3: 200xp…

  const addXP = (amount, reason) => {
    state.xp += amount;
    const prevLevel = state.level;
    let needed = XP_PER_LEVEL(state.level);
    while (state.xp >= needed) {
      state.xp -= needed;
      state.level++;
      needed = XP_PER_LEVEL(state.level);
    }
    save();
    if (state.level > prevLevel) {
      showToast(`⬆️ Level up! You're now level ${state.level}`, 'cyan', 3500);
      notifyBus('xp', { xp: amount, level: state.level, levelUp: true });
    } else {
      notifyBus('xp', { xp: amount, level: state.level, levelUp: false });
    }
  };

  const getXPProgress = () => {
    const needed = XP_PER_LEVEL(state.level);
    return { current: state.xp, needed, pct: Math.min(1, state.xp / needed) };
  };

  // ── High Scores ──────────────────────────────────────
  const submitScore = (appId, score) => {
    const prev = state.highScores[appId] || 0;
    if (score > prev) {
      state.highScores[appId] = score;
      save();
      showToast(`🏆 New high score: ${score}`, 'mag', 2500);
      addXP(Math.min(50, Math.floor(score / 10)), 'high_score');
    }
    // Track games played
    state.gamesPlayed = (state.gamesPlayed || 0) + 1;
    save();
    checkAchievements();
    addXP(5, 'game_played');
  };

  const getHighScore = (appId) => state.highScores[appId] || 0;

  // ── Achievements ─────────────────────────────────────
  const ACHIEVEMENTS = [
    { id: 'first_app',    label: '🚀 First Launch',       desc: 'Open your first app',             check: s => s.appsOpened >= 1 },
    { id: 'app_addict',   label: '📱 App Addict',         desc: 'Open 25 apps',                    check: s => s.appsOpened >= 25 },
    { id: 'first_game',   label: '🎮 Gamer',              desc: 'Play your first game',             check: s => s.gamesPlayed >= 1 },
    { id: 'games_10',     label: '🕹️ Arcade Regular',     desc: 'Play 10 games',                   check: s => s.gamesPlayed >= 10 },
    { id: 'games_50',     label: '🏅 Veteran',            desc: 'Play 50 games',                   check: s => s.gamesPlayed >= 50 },
    { id: 'snake_50',     label: '🐍 Snake Charmer',      desc: 'Score 50+ in Snake',              check: s => (s.highScores.snake || 0) >= 50 },
    { id: 'level_5',      label: '⭐ Rising Star',        desc: 'Reach level 5',                   check: s => s.level >= 5 },
    { id: 'level_10',     label: '💎 Diamond',            desc: 'Reach level 10',                  check: s => s.level >= 10 },
    { id: 'boot_5',       label: '🔁 Loyal User',         desc: 'Boot iPOCKET 5 times',            check: s => (s.bootCount || 0) >= 5 },
    { id: 'notes_made',   label: '📝 Note Taker',         desc: 'Write your first note',           check: s => s.noteMade },
    { id: 'hacker',       label: '💻 Hacker',             desc: 'Use the Hacker Terminal',         check: s => s.usedTerminal },
    { id: 'ai_chat',      label: '🤖 AI Whisperer',       desc: 'Chat with the AI Assistant',      check: s => s.usedAI },
    { id: 'store_install',label: '📦 App Installer',      desc: 'Install an app from the store',   check: s => s.installedFromStore },
  ];

  const checkAchievements = () => {
    ACHIEVEMENTS.forEach(a => {
      if (!state.achievements[a.id] && a.check(state)) {
        state.achievements[a.id] = Date.now();
        save();
        showToast(`🏆 Achievement: ${a.label}`, 'gold', 4000);
        addXP(25, 'achievement');
      }
    });
  };

  // ── App open tracking ────────────────────────────────
  const trackAppOpen = (appId) => {
    state.appsOpened = (state.appsOpened || 0) + 1;
    save();
    checkAchievements();
    addXP(2, 'app_open');
  };

  // ── Notification / Event Bus ─────────────────────────
  const listeners = {};
  const notifyBus = (event, data) => {
    (listeners[event] || []).forEach(fn => fn(data));
  };
  const on = (event, fn) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  };

  // ── Mark flags ───────────────────────────────────────
  const markFlag = (flag) => {
    if (!state[flag]) { state[flag] = true; save(); checkAchievements(); }
  };

  // ── Public API ───────────────────────────────────────
  return {
    get: () => state,
    save,
    addXP,
    getXPProgress,
    submitScore,
    getHighScore,
    getAchievements: () => ACHIEVEMENTS.map(a => ({ ...a, unlocked: !!state.achievements[a.id], unlockedAt: state.achievements[a.id] })),
    checkAchievements,
    trackAppOpen,
    markFlag,
    notifyBus,
    on,
    getInstalledApps: () => state.installedApps,
    setInstalledApps: (list) => { state.installedApps = list; save(); },
    incBoot: () => { state.bootCount = (state.bootCount || 0) + 1; save(); checkAchievements(); },
  };
})();


/* ══════════════════════════════════════════════════════
   TOAST / NOTIFICATION UI
══════════════════════════════════════════════════════ */
let _toastContainer = null;
const _toastQueue = [];
let _toastActive = false;

window.showToast = function(msg, color, duration) {
  color = color || 'cyan';
  duration = duration || 2500;
  _toastQueue.push({ msg, color, duration });
  _drainToastQueue();
};

function _drainToastQueue() {
  if (_toastActive || !_toastQueue.length) return;
  const { msg, color, duration } = _toastQueue.shift();
  _toastActive = true;

  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.style.cssText = [
      'position:fixed;left:50%;top:calc(var(--safe-top, 89px) + 8px);',
      'transform:translateX(-50%);z-index:9999;',
      'display:flex;flex-direction:column;align-items:center;gap:8px;',
      'pointer-events:none;',
    ].join('');
    document.body.appendChild(_toastContainer);
  }

  const colorMap = {
    cyan: '#00ffcc', mag: '#ff4af8', gold: '#ffd700',
    red: '#ff5252', green: '#69ff47', blue: '#4dd0e1',
  };
  const c = colorMap[color] || color;

  const t = document.createElement('div');
  t.style.cssText = [
    'font-family:"Orbitron",sans-serif;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;',
    `color:${c};`,
    `border:1px solid ${c}66;`,
    'background:rgba(5,5,8,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
    'padding:10px 20px;border-radius:24px;white-space:nowrap;',
    `box-shadow:0 0 20px ${c}44,0 4px 24px rgba(0,0,0,.6);`,
    'transform:translateY(-12px) scale(.92);opacity:0;',
    'transition:transform .32s cubic-bezier(.34,1.56,.64,1),opacity .22s ease;',
  ].join('');
  t.textContent = msg;
  _toastContainer.appendChild(t);

  requestAnimationFrame(() => {
    t.style.transform = 'translateY(0) scale(1)';
    t.style.opacity = '1';
  });

  setTimeout(() => {
    t.style.transform = 'translateY(-8px) scale(.94)';
    t.style.opacity = '0';
    setTimeout(() => {
      t.remove();
      _toastActive = false;
      _drainToastQueue();
    }, 280);
  }, duration);
}


/* ══════════════════════════════════════════════════════
   XP BADGE (persistent HUD on home screen)
══════════════════════════════════════════════════════ */
window.renderXPBadge = function(container) {
  const s = POS.get();
  const prog = POS.getXPProgress();

  const badge = document.createElement('div');
  badge.id = 'xp-badge';
  badge.style.cssText = [
    'display:flex;align-items:center;gap:10px;',
    'background:rgba(0,255,204,.05);border:1px solid rgba(0,255,204,.18);',
    'border-radius:20px;padding:8px 16px;max-width:260px;width:100%;',
    'cursor:pointer;-webkit-tap-highlight-color:transparent;',
    'transition:opacity .2s;',
  ].join('');

  badge.innerHTML = `
    <div style="font-family:'Orbitron',sans-serif;font-size:.52rem;letter-spacing:.14em;color:var(--cyan);white-space:nowrap;">
      LV.${s.level}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
      <div style="height:4px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(prog.pct * 100)}%;background:var(--cyan);border-radius:4px;box-shadow:0 0 8px var(--cyan);transition:width .6s ease;"></div>
      </div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:.44rem;color:var(--dim);letter-spacing:.08em;">${s.xp} / ${prog.needed} XP</div>
    </div>
    <div style="font-size:.9rem;">⭐</div>
  `;

  badge.addEventListener('click', () => showAchievementsPanel());
  container.appendChild(badge);
  return badge;
};

function showAchievementsPanel() {
  haptic('medium');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;flex-direction:column;';

  const bd = document.createElement('div');
  bd.style.cssText = 'position:absolute;inset:0;background:rgba(5,5,8,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);opacity:0;transition:opacity .22s;';
  overlay.appendChild(bd);

  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:relative;z-index:1;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;',
    'padding:max(96px,var(--safe-top,89px)) 20px calc(var(--sb,0px) + 40px);',
    'display:flex;flex-direction:column;gap:14px;',
  ].join('');

  const s = POS.get();
  const prog = POS.getXPProgress();
  const achs = POS.getAchievements();
  const unlocked = achs.filter(a => a.unlocked).length;

  panel.innerHTML = `
    <div style="font-family:'Orbitron',sans-serif;font-size:.65rem;letter-spacing:.24em;text-transform:uppercase;color:var(--cyan);text-shadow:var(--gc);text-align:center;">Achievements</div>
    <div style="background:rgba(0,255,204,.05);border:1px solid rgba(0,255,204,.18);border-radius:18px;padding:16px 20px;display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:var(--text);">Level <span style="color:var(--cyan);font-size:1.4rem;font-weight:900;">${s.level}</span></div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.6rem;color:var(--dim);">${unlocked}/${achs.length} unlocked</div>
      </div>
      <div style="height:6px;background:rgba(255,255,255,.08);border-radius:6px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(prog.pct*100)}%;background:linear-gradient(90deg,var(--cyan),var(--mag));border-radius:6px;box-shadow:0 0 10px var(--cyan);"></div>
      </div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:.5rem;color:var(--dim);">${s.xp} / ${prog.needed} XP to next level · ${s.gamesPlayed||0} games played</div>
    </div>
    <div id="ach-list" style="display:flex;flex-direction:column;gap:8px;"></div>
    <button id="ach-close" style="font-family:'Orbitron',sans-serif;font-size:.55rem;letter-spacing:.15em;text-transform:uppercase;color:var(--dim);border:1px solid var(--dim);background:transparent;padding:12px 30px;border-radius:20px;cursor:pointer;margin-top:8px;-webkit-tap-highlight-color:transparent;">✕ Close</button>
  `;

  const list = panel.querySelector('#ach-list');
  achs.forEach(a => {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:flex;align-items:center;gap:14px;',
      'padding:12px 16px;border-radius:14px;',
      a.unlocked
        ? 'background:rgba(0,255,204,.06);border:1px solid rgba(0,255,204,.2);'
        : 'background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);opacity:.45;',
    ].join('');
    row.innerHTML = `
      <div style="font-size:1.5rem;line-height:1;flex-shrink:0;">${a.label.split(' ')[0]}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
        <div style="font-family:'Orbitron',sans-serif;font-size:.58rem;letter-spacing:.08em;color:${a.unlocked ? 'var(--text)' : 'var(--dim)'};">${a.label.split(' ').slice(1).join(' ')}</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.5rem;color:var(--dim);">${a.desc}</div>
      </div>
      ${a.unlocked ? '<div style="font-size:1rem;flex-shrink:0;">✅</div>' : '<div style="font-size:1rem;flex-shrink:0;opacity:.3;">🔒</div>'}
    `;
    list.appendChild(row);
  });

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => { bd.style.opacity = '1'; });

  const close = () => {
    bd.style.opacity = '0';
    setTimeout(() => overlay.remove(), 250);
  };
  panel.querySelector('#ach-close').onclick = close;
  bd.addEventListener('click', close);
}
