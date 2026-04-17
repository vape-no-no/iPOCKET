/* ════════════ WEATHER ════════════ */
const WX_ICONS = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'❄️',75:'❄️',77:'❄️',80:'🌦️',81:'🌧️',82:'🌧️',85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️'};
const WX_DESC = {0:'Clear Sky',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',45:'Foggy',48:'Icy Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',61:'Light Rain',63:'Rain',65:'Heavy Rain',71:'Light Snow',73:'Snow',75:'Heavy Snow',80:'Showers',81:'Rain Showers',82:'Heavy Showers',95:'Thunderstorm',96:'Hail Storm',99:'Heavy Hail'};

function initWeather() {
  let celsius = true, wdata = null;
  const wrap = document.createElement('div');
  wrap.className = 'wx-wrap';
  content.appendChild(wrap);

  const comDir = d => ['N','NE','E','SE','S','SW','W','NW'][Math.round(d / 45) % 8];
  const toT = v => celsius ? Math.round(v) : Math.round(v * 9 / 5 + 32);
  const u = () => celsius ? '°C' : '°F';

  const loading = m => {
    wrap.innerHTML = `<div class="ld"><div class="ld-ring"></div>${m || 'Locating...'}</div>`;
  };

  /* ── Temperature → colorful gradient (cold=blue → warm=orange → hot=red) ── */
  const tempColor = (lo, hi, globalMin, globalMax) => {
    // Normalise the hi temp across the week's range to pick a hue
    const range = globalMax - globalMin || 1;
    const t = (hi - globalMin) / range; // 0 = coldest day, 1 = hottest day
    // Cold days: cyan→blue, warm days: yellow→orange, hot days: orange→red
    if (t < 0.33)      return `linear-gradient(90deg,#4dd0e1,#29b6f6)`; // blue-ish
    else if (t < 0.55) return `linear-gradient(90deg,#81d4fa,#aed581)`; // blue→green
    else if (t < 0.70) return `linear-gradient(90deg,#fff176,#ffb300)`; // yellow→amber
    else if (t < 0.85) return `linear-gradient(90deg,#ffb300,#f57c00)`; // amber→orange
    else               return `linear-gradient(90deg,#f57c00,#e53935)`; // orange→red
  };

  /* ── Precipitation % colour ── */
  const precipColor = pct => pct >= 70 ? '#4dd0e1' : pct >= 40 ? '#81d4fa' : 'rgba(255,255,255,.4)';

  const render = () => {
    if (!wdata) return;
    const d = wdata;
    const icon = WX_ICONS[d.code] || '🌡️';
    const desc = WX_DESC[d.code] || 'Unknown';
    const daily = d.daily, hourly = d.hourly;

    /* ── 7-day forecast rows with colourful bars ── */
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let forecastHTML = '';
    if (daily && daily.time) {
      const maxTemps = daily.temperature_2m_max || [];
      const minTemps = daily.temperature_2m_min || [];
      const allTemps = [...maxTemps, ...minTemps].filter(v => v != null);
      const globalMin = Math.min(...allTemps);
      const globalMax = Math.max(...allTemps);

      for (let i = 0; i < Math.min(7, daily.time.length); i++) {
        const dt = new Date(daily.time[i] + 'T12:00:00');
        const dayLabel = i === 0 ? 'Today' : days[dt.getDay()];
        const rawHi  = maxTemps[i] ?? 0;
        const rawLo  = minTemps[i] ?? 0;
        const hi  = toT(rawHi);
        const lo  = toT(rawLo);
        const code = daily.weather_code?.[i] ?? 0;
        const precip = daily.precipitation_probability_max?.[i] ?? 0;

        // Bar position relative to week range
        const convMin = toT(globalMin), convMax = toT(globalMax);
        const barRange = convMax - convMin || 1;
        const fillLeft  = ((lo - convMin) / barRange * 100).toFixed(1);
        const fillWidth = ((hi - lo) / barRange * 100).toFixed(1);
        const grad = tempColor(rawLo, rawHi, globalMin, globalMax);

        const precipBadge = precip >= 20
          ? `<span style="font-family:'Share Tech Mono',monospace;font-size:.55rem;color:${precipColor(precip)};margin-right:4px;">${precip}%</span>`
          : '';

        forecastHTML += `<div class="wx-fcast-row">
          <span class="wx-fcast-day">${dayLabel}</span>
          <span class="wx-fcast-ico">${WX_ICONS[code] || '🌡️'}</span>
          ${precipBadge}<span class="wx-fcast-lo">${lo}°</span>
          <div class="wx-fcast-bar-wrap">
            <div class="wx-fcast-bar-fill" style="left:${fillLeft}%;width:${fillWidth}%;background:${grad};border-radius:4px;"></div>
          </div>
          <span class="wx-fcast-hi">${hi}°</span>
        </div>`;
      }
    }

    /* ── Hourly strip ── */
    let hourlyHTML = '';
    if (hourly && hourly.time) {
      const now = new Date();
      let shown = 0;
      for (let i = 0; i < hourly.time.length && shown < 24; i++) {
        const ht = new Date(hourly.time[i]);
        if (ht < now - 1800000) continue;
        const isNow = shown === 0;
        const hLabel = isNow ? 'Now' : ht.toLocaleTimeString('en-US', { hour:'numeric', hour12:true });
        const code = hourly.weather_code?.[i] ?? 0;
        const precip = hourly.precipitation_probability?.[i] ?? 0;
        const precipStr = precip >= 20 ? `<span style="font-size:.5rem;color:#4dd0e1;">${precip}%</span>` : '';
        hourlyHTML += `<div class="wx-hour-cell">
          <span class="wx-hour-time">${hLabel}</span>
          <span class="wx-hour-ico">${WX_ICONS[code] || '🌡️'}</span>
          <span class="wx-hour-temp">${toT(hourly.temperature_2m?.[i] ?? 0)}°</span>
          ${precipStr}
        </div>`;
        shown++;
      }
    }

    const uvIndex = d.uv || 0;
    const uvLabel = uvIndex <= 2 ? 'Low' : uvIndex <= 5 ? 'Moderate' : uvIndex <= 7 ? 'High' : uvIndex <= 10 ? 'Very High' : 'Extreme';
    const dewPoint = d.dew != null ? toT(d.dew) + u() : '—';

    wrap.innerHTML = `
      <div class="wx-scroll-body">
        <div class="wx-loc-bar">
          <span class="wx-loc-city">${d.city}</span>
          <button class="wx-unit-tog" id="wx-utog">${celsius ? '°F · Switch' : '°C · Switch'}</button>
        </div>
        <div class="wx-hero-section">
          <div class="wx-city-name">${d.city.split(',')[0]}</div>
          <div class="wx-hero-temp">${toT(d.tc)}°</div>
          <div class="wx-hero-cond">${icon} ${desc}</div>
          <div class="wx-hero-hl">H:${toT(daily?.temperature_2m_max?.[0] ?? d.tc)}° · L:${toT(daily?.temperature_2m_min?.[0] ?? d.tc)}°</div>
        </div>
        <div class="wx-glass">
          <div class="wx-section-label">🕐 Hourly Forecast</div>
          <div class="wx-hourly-scroll">${hourlyHTML}</div>
        </div>
        <div class="wx-glass">
          <div class="wx-section-label">📅 7-Day Forecast</div>
          <div class="wx-forecast-list">${forecastHTML}</div>
        </div>
        <div class="wx-conditions-grid">
          <div class="wx-cond-tile wx-glass">
            <div class="wx-cond-label">💧 Humidity</div>
            <div class="wx-cond-val">${d.hum}%</div>
            <div class="wx-cond-sub">${d.hum < 30 ? 'Dry' : d.hum < 60 ? 'Comfortable' : 'Humid'}</div>
          </div>
          <div class="wx-cond-tile wx-glass">
            <div class="wx-cond-label">💨 Wind</div>
            <div class="wx-cond-val">${Math.round(d.ws)}</div>
            <div class="wx-cond-sub">km/h · ${comDir(d.wd)}</div>
          </div>
          <div class="wx-cond-tile wx-glass">
            <div class="wx-cond-label">🌡️ Feels Like</div>
            <div class="wx-cond-val">${toT(d.feels)}°</div>
            <div class="wx-cond-sub">${u()}</div>
          </div>
          <div class="wx-cond-tile wx-glass">
            <div class="wx-cond-label">☀️ UV Index</div>
            <div class="wx-cond-val">${uvIndex}</div>
            <div class="wx-cond-sub">${uvLabel}</div>
          </div>
          <div class="wx-cond-tile wx-glass">
            <div class="wx-cond-label">🌧️ Precip Chance</div>
            <div class="wx-cond-val">${d.precip}%</div>
            <div class="wx-cond-sub">Today</div>
          </div>
          <div class="wx-cond-tile wx-glass">
            <div class="wx-cond-label">👁️ Visibility</div>
            <div class="wx-cond-val">${d.vis}</div>
            <div class="wx-cond-sub">km</div>
          </div>
        </div>
      </div>`;

    document.getElementById('wx-utog').onclick = () => { celsius = !celsius; render(); };
  };

  const fetchW = async (lat, lon, cityName) => {
    loading('Fetching weather…');
    try {
      const wr = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,weather_code,uv_index,visibility` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&hourly=temperature_2m,weather_code,precipitation_probability` +
        `&timezone=auto&forecast_days=7`
      );
      const wj = await wr.json();
      const c = wj.current, dl = wj.daily, h = wj.hourly;

      let city = cityName;
      if (!city) {
        try {
          const gr = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const gj = await gr.json();
          city = (gj.address && (gj.address.city || gj.address.town || gj.address.village)) || `${lat.toFixed(1)}°`;
        } catch(e) { city = `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`; }
      }

      wdata = {
        tc:c.temperature_2m, feels:c.apparent_temperature,
        ws:c.wind_speed_10m, wd:c.wind_direction_10m,
        code:c.weather_code, city,
        hum:c.relative_humidity_2m,
        dew:c.dew_point_2m,
        uv:Math.round(c.uv_index || 0),
        vis:Math.round((c.visibility || 0) / 1000),
        precip:(dl && dl.precipitation_probability_max && dl.precipitation_probability_max[0]) || 0,
        daily:dl, hourly:h
      };
      render();
    } catch(e) { showManual('Connection error. Try searching manually.'); }
  };

  /* ── Manual search / location fallback ──
     Always shown when geolocation is blocked or fails.
     Does NOT say "blocked" — just gives the user tools to get weather. */
  const showManual = (err) => {
    err = err || '';

    // Determine whether to show the location button at all
    const geoAvail = !!navigator.geolocation;
    const locBtnHTML = geoAvail
      ? `<button id="wx-loc" style="font-family:'Orbitron',sans-serif;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#050508;background:var(--cyan);border:none;padding:13px 0;border-radius:22px;cursor:pointer;box-shadow:var(--gc);-webkit-tap-highlight-color:transparent;width:100%;max-width:280px;">📍 Use My Location</button>`
      : '';

    // If err mentions "blocked" swap it for a more helpful instruction
    let errMsg = err;
    if (err && (err.toLowerCase().includes('block') || err.toLowerCase().includes('denied'))) {
      errMsg = 'Location access is off. Enable it in Settings → Privacy → Location Services → Safari, then tap "Use My Location" again. Or just search below.';
    }

    wrap.innerHTML = `
      <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:89px 24px 60px;box-sizing:border-box;">
        ${locBtnHTML}
        <div style="font-size:2.6rem;line-height:1;margin-top:4px;">🌍</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.78rem;color:var(--text);letter-spacing:.06em;text-align:center;">SEARCH YOUR CITY</div>
        <div style="position:relative;width:100%;max-width:300px;">
          <input class="wx-city-input" id="wxi" type="text" placeholder="e.g. Dunkirk, NY" autocomplete="off" spellcheck="false">
          <div class="wx-dropdown" id="wxd"></div>
        </div>
        ${errMsg ? `<div style="font-family:'Share Tech Mono',monospace;font-size:.56rem;color:rgba(255,200,100,.8);text-align:center;max-width:280px;line-height:1.55;">${errMsg}</div>` : ''}
        <button class="cyan-btn" id="wxgo">Search →</button>
      </div>`;

    // Location button
    const locEl = document.getElementById('wx-loc');
    if (locEl) {
      locEl.addEventListener('click', () => {
        loading('Requesting location…');
        navigator.geolocation.getCurrentPosition(
          p => fetchW(p.coords.latitude, p.coords.longitude, null),
          e => {
            let msg = 'Could not get location.';
            if (e.code === 1) msg = 'Location access is off. Enable it in Settings → Privacy → Location Services → Safari, then try again. Or just search below.';
            else if (e.code === 2) msg = 'Location unavailable right now. Try searching instead.';
            else if (e.code === 3) msg = 'Location request timed out. Try searching instead.';
            showManual(msg);
          },
          { timeout:12000, enableHighAccuracy:false, maximumAge:60000 }
        );
      });
    }

    // Search input
    const inp = document.getElementById('wxi');
    const drop = document.getElementById('wxd');
    if (!inp) return;

    let dbt = null;
    const sel = (lat, lon, name) => { drop.style.display='none'; loading('Fetching…'); fetchW(lat, lon, name); };
    const mkDrop = res => {
      if (!res || !res.length) { drop.style.display='none'; return; }
      drop.innerHTML = res.map(loc => {
        const lbl = [loc.name, loc.admin1, loc.country].filter(Boolean).join(', ');
        return `<div class="wx-drop-item" data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${lbl}">${lbl}</div>`;
      }).join('');
      drop.style.display = 'block';
      drop.querySelectorAll('.wx-drop-item').forEach(el => {
        const go = () => sel(+el.dataset.lat, +el.dataset.lon, el.dataset.name);
        el.addEventListener('touchstart', e => { e.preventDefault(); go(); }, { passive:false });
        el.addEventListener('mousedown', go);
      });
    };

    inp.addEventListener('input', () => {
      clearTimeout(dbt);
      const q = inp.value.trim();
      if (q.length < 2) { drop.style.display='none'; return; }
      dbt = setTimeout(async () => {
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&format=json`);
          const d = await r.json();
          mkDrop(d.results || []);
        } catch(e) {}
      }, 280);
    });

    const go = async () => {
      const first = drop.querySelector('.wx-drop-item');
      if (first) { sel(+first.dataset.lat, +first.dataset.lon, first.dataset.name); return; }
      const city = inp.value.trim();
      if (!city) return;
      loading('Searching…');
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`);
        const d = await r.json();
        if (!d.results || !d.results.length) { showManual('City not found. Try a different name.'); return; }
        const loc = d.results[0];
        fetchW(loc.latitude, loc.longitude, loc.name + (loc.country ? ', ' + loc.country : ''));
      } catch(e) { showManual('Connection error.'); }
    };

    document.getElementById('wxgo').onclick = go;
    inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    setTimeout(() => inp.focus(), 300);
  };

  /* ── On open: try geolocation, but skip straight to manual if it fails ── */
  if (navigator.geolocation) {
    loading('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      p => fetchW(p.coords.latitude, p.coords.longitude, null),
      e => {
        // Any failure → show manual search immediately, no scary message
        const msg = e.code === 1
          ? 'Location access is off. Enable it in Settings → Privacy → Location Services → Safari, then tap "Use My Location". Or just search for your city below.'
          : '';
        showManual(msg);
      },
      { timeout:6000, enableHighAccuracy:false, maximumAge:600000 }
    );
  } else {
    showManual();
  }

  return () => {};
}
