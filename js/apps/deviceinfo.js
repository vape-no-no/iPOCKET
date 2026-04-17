/* ════════════ DEVICE INFO ════════════ */
function initDeviceInfo() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#050508;padding:89px 16px calc(var(--sb,0px)+40px);display:flex;flex-direction:column;gap:12px;';
  content.appendChild(wrap);

  const title = document.createElement('div');
  title.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.52rem;letter-spacing:.28em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;';
  title.textContent = '// Device Info //';
  wrap.appendChild(title);

  /* ── Helpers ── */
  const section = label => {
    const s = document.createElement('div');
    s.style.cssText = 'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:16px;overflow:hidden;';
    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-family:"Orbitron",sans-serif;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);padding:10px 14px 8px;border-bottom:1px solid rgba(255,255,255,.05);';
    hdr.textContent = label;
    s.appendChild(hdr);
    wrap.appendChild(s);
    return s;
  };

  const row = (parent, key, value, accent) => {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(255,255,255,.03);';
    r.innerHTML = `
      <span style="font-family:'Share Tech Mono',monospace;font-size:.6rem;color:var(--dim);flex-shrink:0;">${key}</span>
      <span style="font-family:'Share Tech Mono',monospace;font-size:.6rem;color:${accent||'var(--text)'};text-align:right;word-break:break-all;">${value}</span>`;
    parent.appendChild(r);
    return r;
  };

  const dynRow = (parent, key, id, accent) => {
    const r = row(parent, key, '—', accent);
    r.querySelector('span:last-child').id = id;
    return r;
  };

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

  /* ── Device / Browser ── */
  const devSec = section('📱 Device & Browser');
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  // Detect iPhone model from screen size + pixel ratio
  const getIPhoneModel = () => {
    if (!/iPhone/.test(ua)) return null;
    const w = screen.width, h = screen.height, r = window.devicePixelRatio;
    const key = `${Math.min(w,h)}x${Math.max(w,h)}@${r}`;
    const models = {
      '390x844@3':'iPhone 14 / 13 / 12', '393x852@3':'iPhone 15 / 14 Pro',
      '430x932@3':'iPhone 14 Plus / 13 Pro Max', '428x926@3':'iPhone 13 Pro Max / 12 Pro Max',
      '375x812@3':'iPhone X / XS / 11 Pro / 12 Mini / 13 Mini',
      '414x896@2':'iPhone XR / 11', '414x896@3':'iPhone XS Max / 11 Pro Max',
      '414x736@3':'iPhone 8 Plus / 7 Plus', '375x667@2':'iPhone SE 3 / 8 / 7',
      '320x568@2':'iPhone SE 1', '414x736@2':'iPhone 6S Plus',
      '460x1004@3':'iPhone 16', '402x874@3':'iPhone 16 Pro', '440x956@3':'iPhone 16 Pro Max',
    };
    return models[key] || 'iPhone (unknown model)';
  };

  const platform = isIOS ? (getIPhoneModel() || 'iOS Device') : isAndroid ? 'Android Device' : 'Desktop / Other';
  row(devSec, 'Platform', platform, 'var(--cyan)');

  const osMatch = ua.match(/OS (\d+[_\d]+)/) || ua.match(/Android ([\d.]+)/);
  row(devSec, 'OS Version', osMatch ? (isIOS ? 'iOS ' : 'Android ') + osMatch[1].replace(/_/g,'.') : 'Unknown');

  const browserName = () => {
    if (/CriOS/.test(ua)) return 'Chrome (iOS)';
    if (/FxiOS/.test(ua)) return 'Firefox (iOS)';
    if (/EdgA|EdgiOS/.test(ua)) return 'Edge';
    if (/Chrome/.test(ua)) return 'Chrome';
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari';
    if (/Firefox/.test(ua)) return 'Firefox';
    return 'Unknown';
  };
  row(devSec, 'Browser', browserName());

  const verMatch = ua.match(/Version\/([\d.]+)/) || ua.match(/Chrome\/([\d.]+)/) || ua.match(/Firefox\/([\d.]+)/);
  row(devSec, 'Browser Version', verMatch ? verMatch[1] : '—');
  row(devSec, 'Language', navigator.language || '—');
  row(devSec, 'Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || '—');

  /* ── Display ── */
  const dispSec = section('🖥️ Display');
  row(dispSec, 'Screen Size',   `${screen.width} × ${screen.height} px`);
  row(dispSec, 'Viewport',      `${window.innerWidth} × ${window.innerHeight} px`);
  row(dispSec, 'Pixel Ratio',   `${window.devicePixelRatio}× (${Math.round(window.devicePixelRatio * 96)} DPI)`);
  row(dispSec, 'Color Depth',   `${screen.colorDepth}-bit`);
  row(dispSec, 'Orientation',   screen.orientation ? screen.orientation.type : (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'));
  row(dispSec, 'HDR Support',   window.matchMedia('(dynamic-range: high)').matches ? 'Yes' : 'No');
  row(dispSec, 'Dark Mode',     window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Yes' : 'No');

  /* ── Hardware ── */
  const hwSec = section('⚙️ Hardware');
  row(hwSec, 'CPU Cores',     navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} logical cores` : 'Unknown');
  row(hwSec, 'Device Memory', navigator.deviceMemory ? `~${navigator.deviceMemory} GB RAM` : 'Unknown');
  row(hwSec, 'Touch Points',  navigator.maxTouchPoints ? `${navigator.maxTouchPoints}` : '0');
  row(hwSec, 'Pointer Type',  window.matchMedia('(pointer: coarse)').matches ? 'Touch' : 'Mouse/Stylus');

  // GPU info via WebGL
  const gpuInfo = (() => {
    try {
      const c = document.createElement('canvas');
      const g = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!g) return 'WebGL not supported';
      const ext = g.getExtension('WEBGL_debug_renderer_info');
      if (ext) return g.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      return g.getParameter(g.RENDERER);
    } catch(e) { return 'Unknown'; }
  })();
  row(hwSec, 'GPU', gpuInfo, 'var(--mag)');

  const glVer = (() => {
    try {
      const c = document.createElement('canvas');
      const g = c.getContext('webgl2');
      return g ? 'WebGL 2.0' : 'WebGL 1.0';
    } catch(e) { return 'Unknown'; }
  })();
  row(hwSec, 'WebGL', glVer);

  /* ── Network ── */
  const netSec = section('🌐 Network');
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    row(netSec, 'Connection Type', conn.effectiveType ? conn.effectiveType.toUpperCase() : (conn.type || 'Unknown'));
    row(netSec, 'Downlink',        conn.downlink ? `~${conn.downlink} Mbps` : '—');
    row(netSec, 'Round-trip Time', conn.rtt !== undefined ? `${conn.rtt} ms` : '—');
    row(netSec, 'Data Saver',      conn.saveData ? 'On' : 'Off');
  } else {
    row(netSec, 'Online Status', navigator.onLine ? 'Online' : 'Offline', navigator.onLine ? '#69ff47' : '#ff6b6b');
    row(netSec, 'Connection API', 'Not supported');
  }

  /* ── Battery ── */
  const batSec = section('🔋 Battery');
  dynRow(batSec, 'Level', 'di-bat-lvl', '#69ff47');
  dynRow(batSec, 'Status', 'di-bat-st');
  dynRow(batSec, 'Charging Time', 'di-bat-ct');
  dynRow(batSec, 'Discharge Time', 'di-bat-dt');

  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      const updateBat = () => {
        const pct = Math.round(b.level * 100);
        set('di-bat-lvl', `${pct}%`);
        set('di-bat-st', b.charging ? '⚡ Charging' : '🔋 Discharging');
        set('di-bat-ct', b.chargingTime === Infinity ? '—' : `${Math.round(b.chargingTime/60)} min`);
        set('di-bat-dt', b.dischargingTime === Infinity ? '—' : `${Math.round(b.dischargingTime/60)} min`);
        document.getElementById('di-bat-lvl').style.color = pct > 50 ? '#69ff47' : pct > 20 ? '#ffd740' : '#ff6b6b';
      };
      updateBat();
      b.addEventListener('chargingchange', updateBat);
      b.addEventListener('levelchange', updateBat);
    }).catch(() => set('di-bat-lvl', 'Not supported'));
  } else {
    set('di-bat-lvl', 'Not supported');
  }

  /* ── Storage ── */
  const storSec = section('💾 Storage');
  dynRow(storSec, 'Quota', 'di-stor-q');
  dynRow(storSec, 'Usage', 'di-stor-u');
  dynRow(storSec, 'Available', 'di-stor-a', 'var(--cyan)');

  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      const fmt = b => b >= 1e9 ? (b/1e9).toFixed(1)+' GB' : b >= 1e6 ? (b/1e6).toFixed(0)+' MB' : (b/1e3).toFixed(0)+' KB';
      set('di-stor-q', fmt(est.quota || 0));
      set('di-stor-u', fmt(est.usage || 0));
      set('di-stor-a', fmt((est.quota || 0) - (est.usage || 0)));
    });
  } else {
    set('di-stor-q', 'Not supported');
  }

  /* ── Sensors / APIs ── */
  const sensSec = section('🔬 APIs & Sensors');
  const check = (label, val) => row(sensSec, label, val ? '✓ Available' : '✗ Not supported', val ? '#69ff47' : '#ff6b6b');
  check('Geolocation',         !!navigator.geolocation);
  check('Gyroscope',           typeof DeviceOrientationEvent !== 'undefined');
  check('Camera',              !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  check('Microphone',          !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  check('Vibration',           !!navigator.vibrate);
  check('Bluetooth',           !!navigator.bluetooth);
  check('Web NFC',             !!(window.NDEFReader));
  check('Service Worker',      !!navigator.serviceWorker);
  check('Notifications',       typeof Notification !== 'undefined');
  check('Web Share',           !!navigator.share);
  check('WebGL',               !!document.createElement('canvas').getContext('webgl'));
  check('WebGL 2',             !!document.createElement('canvas').getContext('webgl2'));

  /* ── Misc ── */
  const miscSec = section('ℹ️ Misc');
  row(miscSec, 'Cookies',       navigator.cookieEnabled ? 'Enabled' : 'Disabled');
  row(miscSec, 'Do Not Track',  navigator.doNotTrack === '1' ? 'On' : 'Off');
  row(miscSec, 'PDFs',          navigator.pdfViewerEnabled !== undefined ? (navigator.pdfViewerEnabled ? 'Supported' : 'Not supported') : '—');
  row(miscSec, 'JS Heap Limit', performance?.memory?.jsHeapSizeLimit ? `${Math.round(performance?.memory?.jsHeapSizeLimit/1e6)} MB` : '—');
  row(miscSec, 'User Agent',    navigator.userAgent.slice(0, 80) + (navigator.userAgent.length > 80 ? '...' : ''));

  return () => {};
}
