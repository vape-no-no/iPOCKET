/**
 * login.js — iPOCKET Login & Lockscreen System
 * Supports: Liquid Glass (modern/liquid) + Win98 retro login
 * Two themes: liquid glass (Win11+iOS fusion) and Win98 CRT
 */
'use strict';

window.LoginSystem = (function () {
  /* ── STORAGE KEYS ─────────────────────────────────── */
  const KEY_USER    = 'ipocket_user';
  const KEY_PASS    = 'ipocket_pass';
  const KEY_PASSTYPE = 'ipocket_passtype'; // 'pin' | 'password' — needed once KEY_PASS is a hash
  const KEY_LOGGEDIN = 'ipocket_loggedin';

  /* ── STATE ────────────────────────────────────────── */
  let _pinBuffer   = '';
  let _pinTarget   = '';
  let _onSuccess   = null;
  let _clockTimer  = null;
  let _aurora98Timer = null;
  let _is98        = false;

  /* ── HASHING ──────────────────────────────────────────
     This is a device lock with no server and no account recovery — the
     realistic goal is making sure the PIN/password isn't sitting in
     localStorage as human-readable plaintext for anyone glancing at
     DevTools, not defending against a determined offline attack (which
     nothing running purely client-side can do). A plain SHA-256 covers
     that without changing behavior at all. */
  async function _sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function _looksHashed(v) { return /^[0-9a-f]{64}$/i.test(v || ''); }

  /* One-time migration: earlier versions stored the PIN/password as plain
     text. If we find one of those, hash it in place so it's never written
     back out in plaintext again. */
  async function _migrateLegacyPassIfNeeded() {
    const raw = localStorage.getItem(KEY_PASS);
    if (!raw || _looksHashed(raw)) return;
    const isPin = /^\d{4}$/.test(raw);
    localStorage.setItem(KEY_PASS, await _sha256Hex(raw));
    if (!localStorage.getItem(KEY_PASSTYPE)) localStorage.setItem(KEY_PASSTYPE, isPin ? 'pin' : 'password');
  }

  /* ── HELPERS ──────────────────────────────────────── */
  function getUser()  { return localStorage.getItem(KEY_USER) || ''; }
  function getPass()  { return localStorage.getItem(KEY_PASS) || ''; }
  function passType() { return localStorage.getItem(KEY_PASSTYPE) || 'password'; }
  function hasAccount() { return !!localStorage.getItem(KEY_USER); }
  async function saveAccount(user, pass) {
    const isPin = /^\d{4}$/.test(pass);
    localStorage.setItem(KEY_USER, user);
    localStorage.setItem(KEY_PASS, await _sha256Hex(pass));
    localStorage.setItem(KEY_PASSTYPE, isPin ? 'pin' : 'password');
  }
  async function checkPass(entered) {
    const stored = getPass();
    if (!stored) return false;
    return (await _sha256Hex(entered)) === stored;
  }
  function isLoggedIn() { return localStorage.getItem(KEY_LOGGEDIN) === '1'; }
  function setLoggedIn(v) { localStorage.setItem(KEY_LOGGEDIN, v ? '1' : '0'); }

  function currentTheme() {
    return localStorage.getItem('ipocket_theme') || 'retro';
  }

  function is98Mode() {
    const t = currentTheme();
    return t === 'retro';
  }

  /* ── CLOCK ────────────────────────────────────────── */
  function startClock(timeEl, dateEl) {
    function tick() {
      const now = new Date();
      if (timeEl) {
        const h = now.getHours(), m = now.getMinutes();
        timeEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      }
      if (dateEl) {
        const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const months = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
        dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
      }
    }
    clearInterval(_clockTimer);
    tick();
    _clockTimer = setInterval(tick, 1000);
  }

  /* ── AURORA CANVAS (liquid lockscreen) ───────────────── */
  function startAuroraCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, orbs;
    let raf;

    function resize() {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      initOrbs();
    }

    function initOrbs() {
      orbs = [
        { x: w*0.15, y: h*0.20, r: w*0.55, c: [88,86,214],  a: 0.55, vx:0.14, vy:0.08 },
        { x: w*0.85, y: h*0.18, r: w*0.50, c: [10,132,255], a: 0.45, vx:-0.10, vy:0.12 },
        { x: w*0.70, y: h*0.82, r: w*0.45, c: [48,209,88],  a: 0.22, vx:-0.08, vy:-0.10 },
        { x: w*0.20, y: h*0.80, r: w*0.42, c: [255,55,95],  a: 0.20, vx:0.12, vy:-0.07 },
        { x: w*0.50, y: h*0.50, r: w*0.65, c: [100,60,180], a: 0.28, vx:0.06, vy:0.06 },
        { x: w*0.92, y: h*0.60, r: w*0.38, c: [255,159,10], a: 0.18, vx:-0.13, vy:0.09 },
        { x: w*0.08, y: h*0.55, r: w*0.40, c: [191,90,242], a: 0.22, vx:0.11, vy:-0.08 },
      ];
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      // Dark base
      ctx.fillStyle = '#080c18';
      ctx.fillRect(0, 0, w, h);

      for (const o of orbs) {
        const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grd.addColorStop(0,   `rgba(${o.c[0]},${o.c[1]},${o.c[2]},${o.a})`);
        grd.addColorStop(0.5, `rgba(${o.c[0]},${o.c[1]},${o.c[2]},${o.a*0.4})`);
        grd.addColorStop(1,   `rgba(${o.c[0]},${o.c[1]},${o.c[2]},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }
      // Vignette
      const vig = ctx.createRadialGradient(w/2,h/2,h*0.3,w/2,h/2,h*0.85);
      vig.addColorStop(0,'transparent');
      vig.addColorStop(1,'rgba(0,0,0,0.45)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    function animate() {
      for (const o of orbs) {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r || o.x > w+o.r) o.vx *= -1;
        if (o.y < -o.r || o.y > h+o.r) o.vy *= -1;
      }
      draw();
      raf = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    animate();
    return () => { cancelAnimationFrame(raf); clearInterval(_clockTimer); };
  }

  /* ── PIN SYSTEM ───────────────────────────────────── */
  function updatePinDots(dots, buf) {
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < buf.length);
      dot.classList.remove('error');
    });
  }

  function shakeDots(dots) {
    dots.forEach(d => {
      d.classList.remove('filled');
      d.classList.add('error');
    });
    setTimeout(() => dots.forEach(d => d.classList.remove('error')), 600);
  }

  /* ═══════════════════════════════════════════════════
     LIQUID GLASS LOCKSCREEN
  ═══════════════════════════════════════════════════ */
  function buildLiquidLockscreen() {
    const el = document.createElement('div');
    el.id = 'lg-lockscreen';

    el.innerHTML = `
      <canvas id="lg-lockscreen-canvas"></canvas>
      <div id="lg-lockscreen-clock">
        <div id="lg-ls-time">00:00</div>
        <div id="lg-ls-date">Loading...</div>
      </div>
      <div id="lg-ls-hint">Tap to unlock</div>
    `;
    document.body.appendChild(el);

    const canvas = el.querySelector('#lg-lockscreen-canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;';
    const stopAurora = startAuroraCanvas(canvas);
    startClock(el.querySelector('#lg-ls-time'), el.querySelector('#lg-ls-date'));

    // Tap to show login
    el.addEventListener('click', () => showLiquidLogin());
    // Swipe up
    let startY = 0;
    el.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (startY - e.changedTouches[0].clientY > 60) showLiquidLogin();
    });

    return { el, stopAurora };
  }

  /* ── LIQUID LOGIN CARD ─────────────────────────────── */
  function buildLiquidLogin() {
    const el = document.createElement('div');
    el.id = 'lg-login-screen';

    const user = getUser();
    const usePin = passType() === 'pin';

    el.innerHTML = `
      <div id="lg-login-card">
        <div id="lg-login-avatar">👤</div>
        <div id="lg-login-username">${user || 'User'}</div>
        <div id="lg-login-error"></div>

        ${usePin ? `
          <div id="lg-pin-wrap">
            <div id="lg-pin-dots">
              <div class="lg-pin-dot"></div>
              <div class="lg-pin-dot"></div>
              <div class="lg-pin-dot"></div>
              <div class="lg-pin-dot"></div>
            </div>
          </div>
          <div id="lg-numpad">
            ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k =>
              `<button class="lg-numpad-btn ${k==='' ? 'empty' : ''} ${k==='⌫' ? 'del' : ''}" data-key="${k}">${k}</button>`
            ).join('')}
          </div>
        ` : `
          <input type="password" id="lg-login-input" placeholder="Password" autocomplete="current-password" />
          <button id="lg-login-btn">Unlock</button>
        `}

        <div id="lg-login-links">
          <button id="lg-back-ls">← Lock Screen</button>
          ${!hasAccount() ? `<button id="lg-create-acct-btn">Create Account</button>` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const errEl = el.querySelector('#lg-login-error');

    // PIN mode
    if (usePin) {
      const dots = [...el.querySelectorAll('.lg-pin-dot')];
      let buf = '';

      el.querySelectorAll('.lg-numpad-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const k = btn.dataset.key;
          if (k === '⌫') {
            buf = buf.slice(0,-1);
          } else if (k !== '' && buf.length < 4) {
            buf += k;
          }
          updatePinDots(dots, buf);
          if (buf.length === 4) {
            const enteredBuf = buf;
            if (await checkPass(enteredBuf)) {
              setLoggedIn(true);
              successDismiss(el);
            } else {
              shakeDots(dots);
              buf = '';
              errEl.textContent = 'Incorrect PIN';
              setTimeout(() => { errEl.textContent = ''; }, 2000);
            }
          }
        });
      });
    } else {
      // Password mode
      const input = el.querySelector('#lg-login-input');
      const btn   = el.querySelector('#lg-login-btn');
      const attempt = async () => {
        const val = input ? input.value : '';
        const stored = getPass();
        if (!stored || await checkPass(val)) {
          setLoggedIn(true);
          successDismiss(el);
        } else {
          errEl.textContent = 'Incorrect password';
          if (input) { input.value = ''; input.classList.add('shake'); setTimeout(()=>input.classList.remove('shake'),400); }
        }
      };
      if (btn) btn.addEventListener('click', attempt);
      if (input) input.addEventListener('keydown', e => { if (e.key==='Enter') attempt(); });
    }

    // Back to lockscreen
    const backBtn = el.querySelector('#lg-back-ls');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        el.classList.add('fade-out');
        setTimeout(() => el.classList.remove('fade-out'), 500);
      });
    }

    // Create account
    const createBtn = el.querySelector('#lg-create-acct-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => showCreateAccount());
    }

    return el;
  }

  /* ── CREATE ACCOUNT CARD ─────────────────────────────── */
  function buildCreateAccount() {
    const el = document.createElement('div');
    el.id = 'lg-create-screen';

    const isLiquid = !is98Mode();

    if (isLiquid) {
      /* ── LIQUID THEME: iOS-style PIN setup flow ── */
      /* Step 1: username. Step 2: enter 4-digit PIN. Step 3: confirm PIN. */
      let step = 'username'; // 'username' | 'pin' | 'confirm'
      let username = '';
      let pinFirst = '';
      let pinBuf = '';

      function renderStep() {
        el.innerHTML = `
          <div id="lg-create-card">
            <div id="lg-create-title">${
              step === 'username' ? 'Create Account' :
              step === 'pin'      ? 'Enter a Passcode' :
                                    'Re-enter Passcode'
            }</div>
            <div id="lg-create-sub">${
              step === 'username' ? 'Choose your username' :
              step === 'pin'      ? 'Create a 4-digit PIN to secure your device' :
                                    'Re-enter your 4-digit PIN to confirm'
            }</div>

            ${step === 'username' ? `
              <input class="lg-create-input" id="lg-create-user" type="text"
                placeholder="Username" autocomplete="username" maxlength="24" />
              <div id="lg-create-error"></div>
              <button id="lg-create-btn">Continue</button>
              <button id="lg-back-to-login">← Back</button>
            ` : `
              <!-- PIN dots -->
              <div id="lg-pin-wrap" style="margin:8px 0 4px;">
                <div id="lg-pin-dots">
                  <div class="lg-pin-dot"></div>
                  <div class="lg-pin-dot"></div>
                  <div class="lg-pin-dot"></div>
                  <div class="lg-pin-dot"></div>
                </div>
              </div>
              <div id="lg-create-error"></div>
              <!-- Numpad -->
              <div id="lg-numpad">
                ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k =>
                  `<button class="lg-numpad-btn ${k==='' ? 'empty' : ''} ${k==='⌫' ? 'del' : ''}" data-key="${k}">${k}</button>`
                ).join('')}
              </div>
              <button id="lg-back-to-login" style="margin-top:10px;">← Back</button>
            `}
          </div>
        `;

        const errEl = el.querySelector('#lg-create-error');

        if (step === 'username') {
          const userInput = el.querySelector('#lg-create-user');
          el.querySelector('#lg-create-btn').addEventListener('click', () => {
            const u = userInput.value.trim();
            if (!u) { errEl.textContent = 'Username is required'; return; }
            username = u;
            step = 'pin';
            pinBuf = '';
            renderStep();
          });
          userInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') el.querySelector('#lg-create-btn').click();
          });
        } else {
          pinBuf = '';
          const dots = [...el.querySelectorAll('.lg-pin-dot')];
          el.querySelectorAll('.lg-numpad-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const k = btn.dataset.key;
              if (k === '⌫') {
                pinBuf = pinBuf.slice(0, -1);
              } else if (k !== '' && pinBuf.length < 4) {
                pinBuf += k;
              }
              updatePinDots(dots, pinBuf);

              if (pinBuf.length === 4) {
                if (step === 'pin') {
                  pinFirst = pinBuf;
                  step = 'confirm';
                  renderStep();
                } else {
                  // confirm step
                  if (pinBuf === pinFirst) {
                    await saveAccount(username, pinFirst);
                    setLoggedIn(true);
                    successDismiss(el);
                  } else {
                    errEl.textContent = 'PINs do not match — try again';
                    shakeDots(dots);
                    setTimeout(() => {
                      pinBuf = '';
                      step = 'pin';
                      renderStep();
                    }, 800);
                  }
                }
              }
            });
          });
        }

        el.querySelector('#lg-back-to-login').addEventListener('click', () => {
          if (step === 'pin' || step === 'confirm') {
            step = 'username'; pinBuf = ''; pinFirst = '';
            renderStep();
          } else {
            el.classList.remove('visible');
          }
        });
      }

      renderStep();

    } else {
      /* ── Non-liquid: original text password flow ── */
      el.innerHTML = `
        <div id="lg-create-card">
          <div id="lg-create-title">Create Account</div>
          <div id="lg-create-sub">Set up your iPOCKET profile</div>
          <input class="lg-create-input" id="lg-create-user" type="text" placeholder="Username" autocomplete="username" maxlength="24" />
          <input class="lg-create-input" id="lg-create-pass" type="password" placeholder="Password" autocomplete="new-password" maxlength="32" />
          <input class="lg-create-input" id="lg-create-pass2" type="password" placeholder="Confirm password" autocomplete="new-password" maxlength="32" />
          <div id="lg-create-error"></div>
          <button id="lg-create-btn">Create Account</button>
          <button id="lg-back-to-login">← Back to Login</button>
        </div>
      `;

      const errEl = el.querySelector('#lg-create-error');
      el.querySelector('#lg-create-btn').addEventListener('click', async () => {
        const user  = el.querySelector('#lg-create-user').value.trim();
        const pass  = el.querySelector('#lg-create-pass').value;
        const pass2 = el.querySelector('#lg-create-pass2').value;
        if (!user)           { errEl.textContent = 'Username is required'; return; }
        if (pass.length < 1) { errEl.textContent = 'Password is required'; return; }
        if (pass !== pass2)  { errEl.textContent = 'Passwords do not match'; return; }
        await saveAccount(user, pass);
        setLoggedIn(true);
        successDismiss(el);
      });
      el.querySelector('#lg-back-to-login').addEventListener('click', () => {
        el.classList.remove('visible');
      });
    }

    document.body.appendChild(el);
    return el;
  }

  /* ═══════════════════════════════════════════════════
     WIN98 LOCKSCREEN
  ═══════════════════════════════════════════════════ */
  function buildWin98Lockscreen() {
    const el = document.createElement('div');
    el.id = 'lg98-lockscreen';

    // Fake BIOS bar
    const bios = document.createElement('div');
    bios.id = 'lg98-bios-bar';
    bios.textContent = 'iPOCKET BIOS v2.11 — Press DEL to enter setup';
    el.appendChild(bios);

    // Boot loading strip
    const loadWrap = document.createElement('div');
    loadWrap.id = 'lg98-loading';
    loadWrap.innerHTML = `
      <div id="lg98-load-label">Loading Windows 98...</div>
      <div class="lg98-bar-outer"><div class="lg98-bar-inner" id="lg98-bar"></div></div>
    `;
    el.appendChild(loadWrap);

    // Login dialog (shown after "boot" completes)
    const dialog = document.createElement('div');
    dialog.id = 'lg98-dialog';
    dialog.style.display = 'none';
    dialog.innerHTML = `
      <div id="lg98-titlebar">
        <span id="lg98-title-text">🔒 Enter Network Password</span>
        <div id="lg98-close-btn">✕</div>
      </div>
      <div id="lg98-body">
        <div class="lg98-field">
          <div class="lg98-label">User name:</div>
          <input class="lg98-input" id="lg98-user-input" type="text" value="${getUser()}" />
        </div>
        <div class="lg98-field">
          <div class="lg98-label">Password:</div>
          <input class="lg98-input" id="lg98-pass-input" type="password" placeholder="" />
        </div>
        <div id="lg98-error"></div>
        <div id="lg98-btns">
          <button class="lg98-btn" id="lg98-ok-btn">OK</button>
          <button class="lg98-btn" id="lg98-cancel-btn">Cancel</button>
        </div>
        <button id="lg98-create-link">Create new account</button>
      </div>
    `;
    el.appendChild(dialog);
    document.body.appendChild(el);

    // Animate BIOS boot, then show dialog
    const bar = el.querySelector('#lg98-bar');
    const loadLabel = el.querySelector('#lg98-load-label');
    let pct = 0;
    const blocks = ['Checking hardware...','Mounting FAT32...','Loading KERNEL.DLL...','Starting services...','Almost ready...'];
    let blockIdx = 0;
    const bootDur = 2200 + Math.random() * 1200;
    const startT  = Date.now();

    const bootTick = () => {
      const elapsed = Date.now() - startT;
      pct = Math.min(99, (elapsed / bootDur) * 100);
      bar.style.width = pct + '%';
      const tgt = Math.floor((pct/100) * blocks.length);
      if (tgt > blockIdx && blockIdx < blocks.length) {
        loadLabel.textContent = blocks[blockIdx];
        blockIdx++;
      }
      if (elapsed < bootDur) {
        // fill blocks
        const needed = Math.floor(pct / 100 * (bar.offsetWidth / 14));
        bar.innerHTML = '';
        for (let i = 0; i < needed; i++) {
          const b = document.createElement('div');
          b.className = 'lg98-bar-block';
          bar.appendChild(b);
        }
        setTimeout(bootTick, 40 + Math.random()*25);
      } else {
        bar.style.width = '100%';
        loadLabel.textContent = 'System ready.';
        setTimeout(() => {
          loadWrap.style.display = 'none';
          dialog.style.display = 'block';
        }, 350);
      }
    };
    bootTick();

    // Dialog logic
    const errEl = dialog.querySelector('#lg98-error');
    const attempt98 = async () => {
      const u = dialog.querySelector('#lg98-user-input').value.trim();
      const p = dialog.querySelector('#lg98-pass-input').value;
      const stored = getPass();
      if (!stored || await checkPass(p)) {
        setLoggedIn(true);
        successDismiss(el);
      } else {
        errEl.textContent = '⚠ Incorrect password.';
        dialog.querySelector('#lg98-pass-input').value = '';
        // Shake
        dialog.style.transform = 'translateX(-5px)';
        setTimeout(()=>dialog.style.transform='', 80);
        setTimeout(()=>{dialog.style.transform='translateX(5px)'}, 80);
        setTimeout(()=>{dialog.style.transform=''}, 160);
      }
    };

    dialog.querySelector('#lg98-ok-btn').addEventListener('click', attempt98);
    dialog.querySelector('#lg98-pass-input').addEventListener('keydown', e => { if(e.key==='Enter') attempt98(); });
    dialog.querySelector('#lg98-cancel-btn').addEventListener('click', () => {
      // Cancel logs in as guest
      setLoggedIn(true);
      successDismiss(el);
    });
    dialog.querySelector('#lg98-create-link').addEventListener('click', () => showCreateAccount());

    return el;
  }

  /* ── SHOW / DISMISS HELPERS ─────────────────────────── */
  function showLiquidLogin() {
    const loginEl = document.getElementById('lg-login-screen');
    if (loginEl) loginEl.classList.add('visible');
  }

  function showCreateAccount() {
    const el = document.getElementById('lg-create-screen');
    if (el) el.classList.add('visible');
  }

  function successDismiss(el) {
    // Dismiss all login layers with fade
    ['lg-lockscreen','lg-login-screen','lg98-lockscreen','lg-create-screen'].forEach(id => {
      const e = document.getElementById(id);
      if (!e) return;
      e.classList.add('fade-out');
      setTimeout(() => { if(e.parentNode) e.remove(); }, 500);
    });
    clearInterval(_clockTimer);
    if (_onSuccess) _onSuccess();
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════ */

  /**
   * init(onSuccess)
   * Shows the appropriate login flow based on current theme.
   * Calls onSuccess() when the user is authenticated.
   */
  async function init(onSuccess) {
    _onSuccess = onSuccess;
    await _migrateLegacyPassIfNeeded();
    const theme = currentTheme();
    _is98 = (theme === 'retro');

    // If already logged in this session, skip
    if (isLoggedIn()) {
      if (onSuccess) onSuccess();
      return;
    }

    if (_is98) {
      // Win98 CRT boot + login
      buildWin98Lockscreen();
      if (!hasAccount()) {
        // Directly show create flow after boot
        const orig = _onSuccess;
        _onSuccess = () => { orig && orig(); };
      }
      buildCreateAccount();
    } else {
      // Liquid glass lockscreen + login
      buildLiquidLockscreen();
      buildLiquidLogin();
      buildCreateAccount();
    }
  }

  /**
   * lock() — re-show the lockscreen (e.g. from settings)
   */
  function lock() {
    setLoggedIn(false);
    // Remove any existing screens first
    ['lg-lockscreen','lg-login-screen','lg98-lockscreen','lg-create-screen'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.remove();
    });
    init(() => {
      // Desktop is already visible — just remove the overlay
    });
  }

  return { init, lock, hasAccount, isLoggedIn, getUser };
})();
