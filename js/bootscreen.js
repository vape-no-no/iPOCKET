/**
 * bootscreen.js — iPOCKET animated boot sequence
 * Shows before home screen. Skippable after 1.5s.
 */
'use strict';

window.runBootScreen = function(onComplete) {
  POS.incBoot();

  const screen = document.createElement('div');
  screen.id = 'boot-screen';
  screen.style.cssText = [
    'position:fixed;inset:0;z-index:9000;',
    'background:#000;display:flex;flex-direction:column;',
    'align-items:center;justify-content:center;gap:28px;',
    'cursor:pointer;-webkit-tap-highlight-color:transparent;',
    'overflow:hidden;',
  ].join('');

  // Grid scanline background
  screen.innerHTML = `
    <canvas id="boot-cv" style="position:absolute;inset:0;width:100%;height:100%;opacity:0.12;"></canvas>
    <div id="boot-logo" style="
      font-family:'Orbitron',sans-serif;
      font-size:clamp(3rem,18vw,5.5rem);
      font-weight:900;
      letter-spacing:0.28em;
      color:#00ffcc;
      text-shadow:0 0 40px rgba(0,255,204,1),0 0 100px rgba(0,255,204,.5);
      opacity:0;
      transform:scale(0.7);
      transition:opacity .6s ease, transform .7s cubic-bezier(.16,1,.3,1);
    ">iPOCKET</div>
    <div id="boot-sub" style="
      font-family:'Share Tech Mono',monospace;
      font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;
      color:#304a58;opacity:0;
      transition:opacity .4s ease .4s;
    ">v7.0 — Pocket OS</div>
    <div id="boot-bar-wrap" style="
      width:min(240px,60vw);display:flex;flex-direction:column;gap:8px;
      opacity:0;transition:opacity .3s ease .8s;
    ">
      <div style="height:2px;background:rgba(0,255,204,.12);border-radius:2px;overflow:hidden;">
        <div id="boot-bar" style="height:100%;width:0%;background:#00ffcc;border-radius:2px;box-shadow:0 0 12px #00ffcc;transition:width .05s linear;"></div>
      </div>
      <div id="boot-msg" style="font-family:'Share Tech Mono',monospace;font-size:.47rem;letter-spacing:.12em;text-transform:uppercase;color:#304a58;text-align:center;">Initialising...</div>
    </div>
    <div id="boot-skip" style="
      position:absolute;bottom:calc(env(safe-area-inset-bottom,20px) + 28px);
      font-family:'Share Tech Mono',monospace;font-size:.47rem;letter-spacing:.14em;
      text-transform:uppercase;color:rgba(48,74,88,.5);
      opacity:0;transition:opacity .3s ease 1.5s;
    ">tap to skip</div>
  `;

  document.body.appendChild(screen);

  // Scanline canvas
  const cv = screen.querySelector('#boot-cv');
  const ctx = cv.getContext('2d');
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  const drawGrid = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 0.5;
    const sz = 40;
    for (let x = 0; x < cv.width; x += sz) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke();
    }
    for (let y = 0; y < cv.height; y += sz) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
    }
  };
  drawGrid();

  // Startup audio chime
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, t, dur, vol) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.setValueAtTime(0, ac.currentTime + t);
      g.gain.linearRampToValueAtTime(vol, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + dur);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + dur + 0.05);
    };
    play(523, 0, 0.18, 0.12);    // C5
    play(659, 0.14, 0.18, 0.10); // E5
    play(784, 0.28, 0.28, 0.08); // G5
    play(1047, 0.44, 0.45, 0.07); // C6
  } catch {}

  // Animate logo
  const logo = screen.querySelector('#boot-logo');
  const sub = screen.querySelector('#boot-sub');
  const barWrap = screen.querySelector('#boot-bar-wrap');
  const bar = screen.querySelector('#boot-bar');
  const msg = screen.querySelector('#boot-msg');
  const skip = screen.querySelector('#boot-skip');

  requestAnimationFrame(() => {
    logo.style.opacity = '1';
    logo.style.transform = 'scale(1)';
    sub.style.opacity = '1';
    barWrap.style.opacity = '1';
    skip.style.opacity = '1';
  });

  const msgs = [
    'Initialising core…',
    'Loading apps…',
    'Calibrating sensors…',
    'Connecting to network…',
    'Mounting file system…',
    'Almost there…',
    'Ready.',
  ];

  let pct = 0;
  let msgIdx = 0;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    bar.style.width = '100%';
    msg.textContent = 'Ready.';
    setTimeout(() => {
      screen.style.transition = 'opacity .5s ease';
      screen.style.opacity = '0';
      setTimeout(() => { screen.remove(); onComplete(); }, 520);
    }, 320);
  };

  const tick = setInterval(() => {
    pct += 1.8 + Math.random() * 2.5;
    if (pct >= 100) { clearInterval(tick); finish(); return; }
    bar.style.width = pct + '%';
    const mi = Math.min(msgs.length - 1, Math.floor((pct / 100) * msgs.length));
    if (mi !== msgIdx) { msgIdx = mi; msg.textContent = msgs[mi]; }
  }, 48);

  let canSkip = false;
  setTimeout(() => { canSkip = true; }, 1500);
  screen.addEventListener('click', () => { if (canSkip) { clearInterval(tick); finish(); } });
};
