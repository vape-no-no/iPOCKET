/* ════════════ MUSIC VISUALIZER ════════════ */
function initVisualizer() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;background:#000;overflow:hidden;position:relative;';
  content.appendChild(wrap);

  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;flex:1;width:100%;';
  wrap.appendChild(cv);
  const ctx = cv.getContext('2d');

  /* ── Bottom controls ── */
  const controls = document.createElement('div');
  controls.style.cssText = 'flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 16px calc(var(--sb,0px) + 18px);background:rgba(0,0,0,.6);';
  wrap.appendChild(controls);

  const MODES = ['Bars', 'Wave', 'Radial', 'Particles'];
  let currentMode = 0;

  const modeBtn = document.createElement('button');
  modeBtn.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);padding:9px 20px;border-radius:18px;cursor:pointer;-webkit-tap-highlight-color:transparent;';
  modeBtn.textContent = '⟳ ' + MODES[currentMode];
  modeBtn.onclick = () => {
    haptic('light');
    currentMode = (currentMode + 1) % MODES.length;
    modeBtn.textContent = '⟳ ' + MODES[currentMode];
  };
  controls.appendChild(modeBtn);

  let audioCtx = null, analyser = null, dataArr = null, stream = null, raf = null;
  let particles = [];
  let W = 0, H = 0;

  const resize = () => {
    W = cv.width  = cv.offsetWidth  * (window.devicePixelRatio || 1);
    H = cv.height = cv.offsetHeight * (window.devicePixelRatio || 1);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(cv);

  /* ── Visualizer draw functions ── */
  const drawBars = data => {
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(0, 0, W, H);
    const barW = W / data.length * 2.2;
    const gap = 2;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 255;
      const h = v * H * .85;
      const hue = (i / data.length) * 200 + 160;
      const x = i * (barW + gap);
      const grad = ctx.createLinearGradient(0, H, 0, H - h);
      grad.addColorStop(0, `hsla(${hue},100%,50%,.9)`);
      grad.addColorStop(1, `hsla(${hue + 40},100%,70%,.5)`);
      ctx.fillStyle = grad;
      ctx.shadowColor = `hsl(${hue},100%,60%)`;
      ctx.shadowBlur = v > .6 ? 16 : 4;
      ctx.fillRect(x, H - h, barW, h);
    }
    ctx.shadowBlur = 0;
  };

  const drawWave = data => {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    const sliceW = W / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128;
      const y = (v * H) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceW;
    }
    ctx.lineTo(W, H / 2);
    ctx.strokeStyle = 'var(--cyan)';
    ctx.shadowColor = 'var(--cyan)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawRadial = data => {
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const baseR = Math.min(W, H) * .18;
    const maxR  = Math.min(W, H) * .38;
    const count = data.length;

    for (let i = 0; i < count; i++) {
      const v = data[i] / 255;
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      const r = baseR + v * (maxR - baseR);
      const hue = (i / count) * 360;
      const x0 = cx + Math.cos(a) * baseR;
      const y0 = cy + Math.sin(a) * baseR;
      const x1 = cx + Math.cos(a) * r;
      const y1 = cy + Math.sin(a) * r;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = `hsla(${hue},100%,65%,${.4 + v * .6})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `hsl(${hue},100%,60%)`;
      ctx.shadowBlur = v > .5 ? 12 : 4;
      ctx.stroke();
    }

    // Center circle pulse
    const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * (.7 + avg * .5), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,255,204,${.3 + avg * .5})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'var(--cyan)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawParticles = data => {
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(0, 0, W, H);
    const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
    const bass = data.slice(0, 8).reduce((s, v) => s + v, 0) / 8 / 255;

    // Spawn on beat
    if (bass > .55 && particles.length < 200) {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 2 + bass * 8;
        particles.push({
          x: W / 2, y: H / 2,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: 1, ml: .6 + Math.random() * .6,
          hue: Math.random() * 360,
          sz: 2 + bass * 5,
        });
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += .05;
      p.life -= .018;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const alpha = Math.pow(p.life / p.ml, .5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},100%,65%,${alpha})`;
      ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Bass ring
    ctx.beginPath();
    ctx.arc(W/2, H/2, 30 + bass * Math.min(W, H) * .35, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,74,248,${bass * .8})`;
    ctx.lineWidth = bass * 8;
    ctx.shadowColor = 'var(--mag)';
    ctx.shadowBlur = bass * 20;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  /* ── Animation loop ── */
  const animate = () => {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArr);
    const mode = MODES[currentMode];
    if      (mode === 'Bars')      drawBars(dataArr);
    else if (mode === 'Wave')      { analyser.getByteTimeDomainData(dataArr); drawWave(dataArr); }
    else if (mode === 'Radial')    drawRadial(dataArr);
    else if (mode === 'Particles') drawParticles(dataArr);
    raf = requestAnimationFrame(animate);
  };

  /* ── Mic setup ── */
  const startMic = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = .82;
      source.connect(analyser);
      dataArr = new Uint8Array(analyser.frequencyBinCount);
      statusOverlay.remove();
      animate();
    } catch(e) {
      statusOverlay.textContent = 'Microphone denied. Please allow access and reload.';
    }
  };

  /* ── Permission overlay ── */
  const statusOverlay = document.createElement('div');
  statusOverlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:5;background:#000;';
  statusOverlay.innerHTML = `<div style="font-size:3rem">🎙️</div><div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:var(--dim);letter-spacing:.12em;text-transform:uppercase;text-align:center;max-width:240px">Tap to enable microphone</div>`;
  const micBtn = document.createElement('button');
  micBtn.textContent = 'Enable Mic';
  micBtn.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:#050508;background:var(--cyan);border:none;padding:12px 28px;border-radius:22px;cursor:pointer;box-shadow:var(--gc);-webkit-tap-highlight-color:transparent;';
  micBtn.onclick = () => startMic();
  statusOverlay.appendChild(micBtn);
  wrap.appendChild(statusOverlay);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (audioCtx) audioCtx.close();
  };
}
