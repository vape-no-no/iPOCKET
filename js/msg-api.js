/**
 * msg-api.js — iPOCKET Messaging v5
 *
 * Fully static: everything here runs in the browser. There is no server —
 * on GitHub Pages there can't be one, so this file *is* the backend.
 *
 * STORAGE MODEL
 *  - Local cache (this device only): messages + contacts are encrypted with
 *    AES-GCM using a random key generated once per browser/device and kept
 *    in localStorage. This isn't a secret from someone who already has
 *    DevTools open on your own unlocked device — nothing client-side can be —
 *    but it replaces the previous version's single hardcoded key, which was
 *    the same for every install of this app on every device everywhere, so
 *    anyone who read the public source could decode anyone's local data.
 *  - Cross-device / cross-user sync (optional, via a GitHub Gist you provide
 *    a token + Gist ID for): the shared conversation content is encrypted
 *    with a key derived from the Gist ID itself. Two people can only read
 *    each other's messages if they both know the Gist ID — which you already
 *    have to share with a friend out-of-band for sync to work at all, so this
 *    adds real protection against a stranger stumbling on the Gist without
 *    requiring any new setup step. It is NOT protection against someone who
 *    already has the Gist ID and a valid token; nothing running purely in a
 *    static site can defend against that.
 *  - Account passwords use PBKDF2 (150k iterations) with a random per-account
 *    salt to produce a verifier used only to check login attempts. It is
 *    never transmitted or stored anywhere in recoverable form.
 *
 * This file keeps the same public function names as before so the app UI
 * code doesn't need to change, only what happens underneath it.
 */
'use strict';

window.MSG = (() => {

  /* ── BYTES / BASE64 HELPERS ─────────────────────────────────────── */
  const _txtEnc = new TextEncoder(), _txtDec = new TextDecoder();
  function _b64(bytes) {
    let s = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }
  function _unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }

  /* ── AES-GCM ────────────────────────────────────────────────────── */
  async function _importAesKey(rawBytes) {
    return crypto.subtle.importKey('raw', rawBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function _aesEncrypt(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, _txtEnc.encode(plaintext));
    return `${_b64(iv)}.${_b64(ct)}`;
  }
  async function _aesDecrypt(key, blob) {
    try {
      const [ivB64, ctB64] = String(blob).split('.');
      if (!ivB64 || !ctB64) return null;
      const iv = _unb64(ivB64), ct = _unb64(ctB64);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return _txtDec.decode(pt);
    } catch { return null; }
  }

  /* ── PBKDF2 (login verifier only — not used as an encryption key) ── */
  async function _pbkdf2Bits(password, saltBytes, iterations, bits) {
    const base = await crypto.subtle.importKey('raw', _txtEnc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const buf = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, base, bits);
    return new Uint8Array(buf);
  }
  async function _verifierFor(password, saltBytes) {
    const bits = await _pbkdf2Bits(password, saltBytes, 150000, 256);
    return _b64(bits);
  }

  /* ── SHA-256 (fast hash — used for the Gist "room key", not for passwords) ── */
  async function _sha256Bytes(str) {
    const buf = await crypto.subtle.digest('SHA-256', _txtEnc.encode(str));
    return new Uint8Array(buf);
  }

  /* ── LOCAL DEVICE KEY — encrypts data that stays on this device ── */
  const DEVKEY_LS = 'ipm_devkey';
  let _localKeyObj = null;
  function _getOrCreateLocalKeyBytes() {
    let b64 = localStorage.getItem(DEVKEY_LS);
    if (!b64) {
      b64 = _b64(crypto.getRandomValues(new Uint8Array(32)));
      localStorage.setItem(DEVKEY_LS, b64);
    }
    return _unb64(b64);
  }
  async function _localKey() {
    if (!_localKeyObj) _localKeyObj = await _importAesKey(_getOrCreateLocalKeyBytes());
    return _localKeyObj;
  }

  /* ── ROOM KEY — derived from the Gist ID, encrypts data that is synced ── */
  const _roomKeyCache = new Map();
  async function _roomKey(gistId) {
    if (_roomKeyCache.has(gistId)) return _roomKeyCache.get(gistId);
    const bytes = await _sha256Bytes('ipocket-shared-room:' + gistId);
    const key = await _importAesKey(bytes);
    _roomKeyCache.set(gistId, key);
    return key;
  }

  /* ── STORAGE KEYS ── */
  const K = {
    acct:    u => `ipm_acct_${u}`,
    MSGS:    'ipm_msgs',
    CONTACTS: 'ipm_contacts',
    SESSION: 'ipm_session',
    GIST:    'ipm_gist',
  };

  /* ── LEGACY (v4) MIGRATION — best-effort, read-only ──
     v4 obscured local data with a hardcoded XOR key baked into the public
     source. We only ever use this to read old data once, so it can be
     re-saved under real per-device encryption; we never write with it again. */
  const _LEGACY_SEED = 'iPK_v4_xX9#mQ3$nR7@wS5!tV1^kW8&zY2*';
  function _legacyKey(len) {
    const k = new Uint8Array(len); let h = 0x811c9dc5;
    for (let i = 0; i < len; i++) {
      h ^= _LEGACY_SEED.charCodeAt(i % _LEGACY_SEED.length);
      h = Math.imul(h, 0x01000193) >>> 0; k[i] = h & 0xFF;
    }
    return k;
  }
  function _legacyDecode(b64) {
    try {
      const r = atob(b64), b = Uint8Array.from(r, c => c.charCodeAt(0)), k = _legacyKey(b.length);
      return _txtDec.decode(b.map((x, i) => x ^ k[i]));
    } catch { return null; }
  }

  /* ── ACCOUNT ──
     Salt + verifier aren't sensitive on their own (the verifier can't be run
     backwards into the password — that's the entire point of PBKDF2), so
     these are stored as plain JSON rather than encrypted. */
  function _getAcct(username) {
    try { return JSON.parse(localStorage.getItem(K.acct(username)) || 'null'); } catch { return null; }
  }
  function _saveAcctLocal(obj) { localStorage.setItem(K.acct(obj.username), JSON.stringify(obj)); }

  function _getSession() {
    try { return JSON.parse(localStorage.getItem(K.SESSION) || 'null'); } catch { return null; }
  }
  function _setSession(u) { localStorage.setItem(K.SESSION, JSON.stringify({ username: u, ts: Date.now() })); }
  function _clearSession() { localStorage.removeItem(K.SESSION); }

  function getUsername() { return _getSession()?.username || null; }

  function hasAccount(username) {
    if (username) return !!localStorage.getItem(K.acct(username.trim().toLowerCase()));
    return Object.keys(localStorage).some(k => k.startsWith('ipm_acct_'));
  }

  async function register(username, password) {
    username = username.trim().toLowerCase();
    if (!username || !/^[a-z0-9_-]{2,24}$/.test(username))
      return { ok: false, error: 'Username: 2–24 chars, a-z / 0-9 / – / _' };
    if (!password || password.length < 4)
      return { ok: false, error: 'Password must be at least 4 characters' };
    if (_getAcct(username))
      return { ok: false, error: `@${username} already exists on this device. Sign in instead.` };
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await _verifierFor(password, salt);
    _saveAcctLocal({ username, salt: _b64(salt), verifier, createdAt: Date.now() });
    _setSession(username);
    _gistPushProfile(username, _b64(salt), verifier).catch(() => {});
    return { ok: true, username };
  }

  async function login(username, password) {
    username = username.trim().toLowerCase();

    const local = _getAcct(username);
    if (local) {
      const salt = _unb64(local.salt);
      const verifier = await _verifierFor(password, salt);
      if (verifier !== local.verifier) return { ok: false, error: 'Wrong password.' };
      _setSession(username);
      if (isGistConfigured()) _gistPushProfile(username, local.salt, local.verifier).catch(() => {});
      _gistPull().catch(() => {});
      return { ok: true, username };
    }

    // Not on this device — see if it exists on the shared Gist instead.
    const cfg = _getGistCfg();
    if (cfg?.token && cfg?.gistId) {
      const remote = await _gistFetchRaw(true).catch(() => null);
      const profile = remote?.profiles?.[username];
      if (profile) {
        const salt = _unb64(profile.salt);
        const verifier = await _verifierFor(password, salt);
        if (verifier !== profile.verifier) return { ok: false, error: 'Wrong password.' };
        _saveAcctLocal({ username, salt: profile.salt, verifier: profile.verifier, createdAt: profile.createdAt || Date.now() });
        _setSession(username);
        await _mergeRemoteIntoLocal(remote);
        return { ok: true, username };
      }
      return { ok: false, error: 'Username not found. Register first, or double check your Gist setup.' };
    }

    return { ok: false, error: `No account found for @${username}. Register first.` };
  }

  function logout() { _clearSession(); }

  async function changePassword(newPassword) {
    const username = getUsername();
    const acct = username ? _getAcct(username) : null;
    if (!acct) return { ok: false, error: 'Not logged in' };
    if (newPassword.length < 4) return { ok: false, error: 'Password too short' };
    const salt = crypto.getRandomValues(new Uint8Array(16));
    acct.salt = _b64(salt);
    acct.verifier = await _verifierFor(newPassword, salt);
    _saveAcctLocal(acct);
    await _gistPushProfile(acct.username, acct.salt, acct.verifier).catch(() => {});
    return { ok: true };
  }

  /* ── GIST CONFIG ── */
  function _getGistCfg() { try { return JSON.parse(localStorage.getItem(K.GIST) || 'null'); } catch { return null; } }
  function setGistConfig(cfg) { localStorage.setItem(K.GIST, JSON.stringify(cfg)); }
  function getGistConfig()    { return _getGistCfg(); }
  function clearGistConfig()  { localStorage.removeItem(K.GIST); }
  function isGistConfigured() { const c = _getGistCfg(); return !!(c?.token && c?.gistId); }

  /* ── GIST I/O ──
     Remote shape: { profiles: {username: {salt, verifier, createdAt}},
                      encMessages: 'iv.ct'  (AES-GCM, room key),
                      encContacts: 'iv.ct'  (AES-GCM, room key),
                      version } */
  const GIST_FILE = 'ipocket_db.dat';
  let _gistCache = null, _lastFetch = 0;

  async function _gistFetchRaw(force = false) {
    const cfg = _getGistCfg();
    if (!cfg?.token || !cfg?.gistId) return null;
    const now = Date.now();
    if (!force && _gistCache && now - _lastFetch < 8000) return _gistCache;
    try {
      const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
        headers: { Authorization: `token ${cfg.token}`, Accept: 'application/vnd.github.v3+json' },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = await res.json();
      const raw = data.files?.[GIST_FILE]?.content;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      _gistCache = parsed; _lastFetch = now;
      return parsed;
    } catch { return null; }
  }

  async function _gistWriteRaw(obj) {
    const cfg = _getGistCfg();
    if (!cfg?.token || !cfg?.gistId) return false;
    try {
      const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
        method: 'PATCH',
        headers: { Authorization: `token ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(obj) } } }),
      });
      if (res.ok) { _gistCache = obj; _lastFetch = Date.now(); }
      return res.ok;
    } catch { return false; }
  }

  // Every push below does fetch-latest -> mutate -> write-back. Without serializing
  // them, two pushes fired close together (e.g. sending two messages quickly) could
  // both fetch the same stale snapshot and the second write would silently clobber
  // the first. Chaining them onto one queue means each one always starts from the
  // state the previous one just wrote.
  let _gistOpQueue = Promise.resolve();
  function _queueGistOp(fn) {
    const run = _gistOpQueue.then(fn, fn);
    _gistOpQueue = run.catch(() => {});
    return run;
  }

  // Make sure whoever is currently logged in has an up-to-date profile entry on the
  // remote gist. Without this, registering *before* Gist sync was configured (the
  // normal order of things) meant your profile never got published, so no other
  // device could ever discover you to log in remotely — only your encrypted content
  // would be there, permanently orphaned.
  function _ensureOwnProfileOnRemote(remote) {
    remote.profiles = remote.profiles || {};
    const me = getUsername();
    if (me) {
      const acct = _getAcct(me);
      if (acct) remote.profiles[me] = { salt: acct.salt, verifier: acct.verifier, createdAt: acct.createdAt };
    }
  }

  function _gistPushProfile(username, saltB64, verifier) {
    if (!isGistConfigured()) return Promise.resolve();
    return _queueGistOp(async () => {
      const remote = await _gistFetchRaw(true) || { profiles: {}, version: 0 };
      remote.profiles = remote.profiles || {};
      remote.profiles[username] = { salt: saltB64, verifier, createdAt: Date.now() };
      remote.version = (remote.version || 0) + 1;
      await _gistWriteRaw(remote);
    });
  }

  // Decrypt the remote encMessages/encContacts (room key) and merge into local (device key).
  async function _mergeRemoteIntoLocal(remote) {
    const cfg = _getGistCfg();
    if (!cfg?.gistId) return;
    const room = await _roomKey(cfg.gistId);
    if (remote.encMessages) {
      const plain = await _aesDecrypt(room, remote.encMessages);
      if (plain) {
        try {
          const remoteDB = JSON.parse(plain);
          await _withLocalDb(db => {
            const merged = _mergeDB(db, remoteDB);
            db.conversations = merged.conversations;
          });
        } catch {}
      }
    }
    if (remote.encContacts) {
      const plain = await _aesDecrypt(room, remote.encContacts);
      if (plain) {
        try {
          const remoteContacts = JSON.parse(plain);
          await _withLocalContacts(db => {
            const merged = _mergeContacts(db, remoteContacts);
            db.list = merged.list;
          });
        } catch {}
      }
    }
  }

  async function _gistPull() {
    const remote = await _gistFetchRaw(true);
    if (!remote) return { ok: false };
    await _mergeRemoteIntoLocal(remote);
    return { ok: true };
  }

  async function _gistPushMessage(msg) {
    if (!isGistConfigured()) return;
    return _queueGistOp(async () => {
      const cfg = _getGistCfg();
      const room = await _roomKey(cfg.gistId);
      const remote = await _gistFetchRaw(true) || { profiles: {}, version: 0 };
      _ensureOwnProfileOnRemote(remote);
      let remoteDB = { conversations: {} };
      if (remote.encMessages) {
        const plain = await _aesDecrypt(room, remote.encMessages);
        if (plain) { try { remoteDB = JSON.parse(plain); } catch {} }
      }
      const key = _ck(msg.from_user, msg.to_user);
      remoteDB.conversations[key] = remoteDB.conversations[key] || [];
      if (!remoteDB.conversations[key].find(m => m.id === msg.id)) remoteDB.conversations[key].push(msg);
      remote.encMessages = await _aesEncrypt(room, JSON.stringify(remoteDB));
      remote.version = (remote.version || 0) + 1;
      await _gistWriteRaw(remote);
    });
  }

  async function _gistPushFullState() {
    if (!isGistConfigured()) return;
    return _queueGistOp(async () => {
      const cfg = _getGistCfg();
      const room = await _roomKey(cfg.gistId);
      const remote = await _gistFetchRaw(true) || { profiles: {}, version: 0 };
      _ensureOwnProfileOnRemote(remote);
      remote.encMessages = await _aesEncrypt(room, JSON.stringify(await _db()));
      remote.encContacts = await _aesEncrypt(room, JSON.stringify(await _contactsDB()));
      remote.version = (remote.version || 0) + 1;
      await _gistWriteRaw(remote);
    });
  }

  async function syncNow() {
    await _gistPushFullState().catch(() => {});
    return _gistPull();
  }

  /* ── LOCAL MESSAGE DB (encrypted with the per-device key) ── */
  function _ck(a, b) { return [a, b].sort().join('__'); }

  async function _db() {
    const raw = localStorage.getItem(K.MSGS);
    if (!raw) return { conversations: {} };
    const key = await _localKey();
    const plain = await _aesDecrypt(key, raw);
    if (plain) { try { return JSON.parse(plain) || { conversations: {} }; } catch { return { conversations: {} }; } }
    // Fall back to a one-time legacy (v4) read, then migrate it forward below.
    const legacy = _legacyDecode(raw);
    if (legacy) { try { return JSON.parse(legacy) || { conversations: {} }; } catch {} }
    return { conversations: {} };
  }
  async function _saveDB_local(db) {
    const key = await _localKey();
    localStorage.setItem(K.MSGS, await _aesEncrypt(key, JSON.stringify(db)));
  }
  // Same lost-update problem as the Gist queue, just local: two overlapping
  // sendMessage() calls would each read the same pre-write snapshot and the
  // second save would silently erase the first message. Route every
  // read-modify-write through one queue so they always see each other's work.
  let _localDbQueue = Promise.resolve();
  function _withLocalDb(mutator) {
    async function run() {
      const db = await _db();
      const result = await mutator(db);
      await _saveDB_local(db);
      return result;
    }
    const p = _localDbQueue.then(run, run);
    _localDbQueue = p.catch(() => {});
    return p;
  }
  function _mergeDB(localDB, remoteDB) {
    const out = { conversations: { ...localDB.conversations } };
    for (const [key, msgs] of Object.entries(remoteDB.conversations || {})) {
      if (!out.conversations[key]) { out.conversations[key] = msgs; }
      else {
        const seen = new Set(out.conversations[key].map(m => m.id));
        msgs.forEach(m => { if (!seen.has(m.id)) out.conversations[key].push(m); });
        out.conversations[key].sort((a, b) => a.ts - b.ts);
      }
    }
    return out;
  }
  function _genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ── LOCAL CONTACTS DB (encrypted with the per-device key) ──
     Previously getContacts/saveContact/deleteContact were no-op stubs that
     always returned an empty list — the Contacts app looked functional but
     silently never saved anything. This makes them real. */
  async function _contactsDB() {
    const raw = localStorage.getItem(K.CONTACTS);
    if (!raw) return { list: [] };
    const key = await _localKey();
    const plain = await _aesDecrypt(key, raw);
    if (plain) { try { return JSON.parse(plain) || { list: [] }; } catch { return { list: [] }; } }
    return { list: [] };
  }
  async function _saveContactsLocal(db) {
    const key = await _localKey();
    localStorage.setItem(K.CONTACTS, await _aesEncrypt(key, JSON.stringify(db)));
  }
  let _localContactsQueue = Promise.resolve();
  function _withLocalContacts(mutator) {
    async function run() {
      const db = await _contactsDB();
      const result = await mutator(db);
      await _saveContactsLocal(db);
      return result;
    }
    const p = _localContactsQueue.then(run, run);
    _localContactsQueue = p.catch(() => {});
    return p;
  }
  function _mergeContacts(localDB, remoteDB) {
    const out = { list: [...(localDB.list || [])] };
    const seen = new Set(out.list.map(c => c.owner + '__' + c.username));
    (remoteDB.list || []).forEach(c => {
      const id = c.owner + '__' + c.username;
      if (!seen.has(id)) { out.list.push(c); seen.add(id); }
    });
    return out;
  }

  async function getContacts(me) {
    const db = await _contactsDB();
    return (db.list || []).filter(c => c.owner === me).sort((a, b) => a.display_name.localeCompare(b.display_name));
  }
  async function saveContact(me, username, display_name) {
    username = String(username).trim().toLowerCase();
    display_name = String(display_name || username).trim().slice(0, 60);
    if (!username) return { ok: false, error: 'Username required' };
    const entry = await _withLocalContacts(db => {
      db.list = db.list || [];
      const idx = db.list.findIndex(c => c.owner === me && c.username === username);
      const rec = { owner: me, username, display_name, addedAt: idx > -1 ? db.list[idx].addedAt : Date.now() };
      if (idx > -1) db.list[idx] = rec; else db.list.push(rec);
      return rec;
    });
    _gistPushFullState().catch(() => {});
    return { ok: true, contact: entry };
  }
  async function deleteContact(me, username) {
    await _withLocalContacts(db => {
      db.list = (db.list || []).filter(c => !(c.owner === me && c.username === username));
    });
    _gistPushFullState().catch(() => {});
    return { ok: true };
  }

  /* ── MESSAGES API ── */
  async function sendMessage(from_user, to_user, text) {
    const key = _ck(from_user, to_user);
    const msg = { id: _genId(), from_user, to_user, text: String(text).trim(), ts: Date.now(), read: false };
    await _withLocalDb(db => {
      if (!db.conversations[key]) db.conversations[key] = [];
      db.conversations[key].push(msg);
    });
    _notify(msg);
    _gistPushMessage(msg).catch(() => {});
    return { ok: true, message: msg };
  }

  async function getConversation(me, other) {
    const key = _ck(me, other);
    const db = await _db();
    const msgs = (db.conversations[key] || []).slice();
    const dirty = msgs.some(m => m.to_user === me && !m.read);
    if (dirty) {
      await _withLocalDb(dbw => {
        (dbw.conversations[key] || []).forEach(m => { if (m.to_user === me) m.read = true; });
      });
      msgs.forEach(m => { if (m.to_user === me) m.read = true; });
    }
    return msgs;
  }

  async function getConversations(username) {
    const db = await _db(), out = [];
    for (const [key, msgs] of Object.entries(db.conversations)) {
      if (!msgs.length) continue;
      const parts = key.split('__');
      if (!parts.includes(username)) continue;
      const partner = parts.find(p => p !== username) || parts[0];
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter(m => m.to_user === username && !m.read).length;
      out.push({ partner, text: last.text, ts: last.ts, unread });
    }
    return out.sort((a, b) => b.ts - a.ts);
  }

  async function markAsRead(me, partner, messageId) {
    const key = _ck(me, partner);
    const changed = await _withLocalDb(db => {
      let didChange = false;
      (db.conversations[key] || []).forEach(m => { if (m.id === messageId && !m.read) { m.read = true; didChange = true; } });
      return didChange;
    });
    if (changed && isGistConfigured()) {
      _gistPushFullState().catch(() => {});
    }
  }

  async function getReadStatus(me, partner, messageId) {
    const db = await _db();
    const msg = (db.conversations[_ck(me, partner)] || []).find(m => m.id === messageId);
    return { read: !!msg?.read };
  }

  /* ── REAL-TIME (polling — there's no server to push to us) ── */
  let _cbs = [], _pollId = null;
  const _seen = new Set();
  function _notify(msg) { _cbs.forEach(cb => { try { cb(msg); } catch {} }); }

  function connect() {
    if (_pollId) return;
    _pollId = setInterval(async () => {
      const me = getUsername(); if (!me) return;
      if (isGistConfigured()) await _gistPull().catch(() => {});
      const db = await _db();
      for (const msgs of Object.values(db.conversations)) {
        for (const msg of msgs) {
          if (msg.to_user === me && !_seen.has(msg.id) && !msg.read) {
            _seen.add(msg.id); _notify(msg);
          }
        }
      }
    }, 8000);
  }
  function disconnect() { if (_pollId) { clearInterval(_pollId); _pollId = null; } }
  function onNewMessage(cb) { _cbs.push(cb); return () => { _cbs = _cbs.filter(c => c !== cb); }; }
  function subscribeToConversation(me, partner, onMsg) {
    const seen = new Set();
    const id = setInterval(async () => {
      const msgs = await getConversation(me, partner);
      msgs.forEach(msg => { if (!seen.has(msg.id)) { seen.add(msg.id); onMsg(msg); } });
    }, 800);
    return () => clearInterval(id);
  }

  /* ── SIMULATOR (a friendly bot to message when you have no one else to test with) ── */
  const SIM_PARTNER = 'simulator-bot';
  const _simReplies = [
    "Hey! Got your message 👋", "That's interesting, tell me more.", "lol yeah same honestly",
    "Wait really?? No way", "ok ok ok I hear you", "bro I was JUST thinking about that",
    "haha yeah for sure", "Nah I don't think so tbh", "omg same 💀", "...", "k", "YES exactly!!",
    "That's wild when you think about it", "ok so basically... idk actually", "fr fr 💯", "👀",
    "makes sense", "lmaooo", "not me doing the same thing",
  ];
  async function simReply(me) {
    const key = _ck(me, SIM_PARTNER);
    await _withLocalDb(db => {
      (db.conversations[key] || []).forEach(m => { if (m.from_user === me) m.read = true; });
    });
    await new Promise(r => setTimeout(r, 900 + Math.random() * 2000));
    await sendMessage(SIM_PARTNER, me, _simReplies[Math.floor(Math.random() * _simReplies.length)]);
  }

  /* ── EXPORT / IMPORT (manual backup/transfer file, encrypted with the local device key) ── */
  async function exportMessages() {
    const key = await _localKey();
    const blob = new Blob([await _aesEncrypt(key, JSON.stringify({ v: 5, db: await _db(), contacts: await _contactsDB(), exported: Date.now() }))], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `ipocket_msgs_${Date.now()}.ipm`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function importMessages(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const key = await _localKey();
          const raw = await _aesDecrypt(key, e.target.result.trim());
          if (!raw) { resolve({ ok: false, error: 'This file was made on a different device, so it can\u2019t be decrypted here. Use GitHub sync to move data between devices instead.' }); return; }
          const parsed = JSON.parse(raw);
          if (!parsed?.db?.conversations) { resolve({ ok: false, error: 'Bad format' }); return; }
          await _withLocalDb(db => {
            const merged = _mergeDB(db, parsed.db);
            db.conversations = merged.conversations;
          });
          if (parsed.contacts?.list) {
            await _withLocalContacts(db => {
              const merged = _mergeContacts(db, parsed.contacts);
              db.list = merged.list;
            });
          }
          resolve({ ok: true, imported: Object.values(parsed.db.conversations).flat().length });
        } catch (err) { resolve({ ok: false, error: err.message }); }
      };
      reader.onerror = () => resolve({ ok: false, error: 'Read error' });
      reader.readAsText(file);
    });
  }

  /* ── XSS-SAFE TEXT HELPER ──
     For the handful of places the UI builds HTML via innerHTML around a
     user-supplied string (like a contact's display name). Message bubble
     text already uses textContent and doesn't need this. */
  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ── UTILS ── */
  function formatTime(ts) {
    const d = new Date(ts), now = new Date(), diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Compat stubs kept for anything that still checks for a "server" — always
  // "available" since there is no server-down state in a static app.
  function setUsername() {} function isReceiving() { return true; }
  async function checkUser() { return { exists: true }; } async function checkServer() { return true; }
  function isServerAvailable() { return true; }

  return {
    getUsername, hasAccount, register, login, logout, changePassword,
    connect, disconnect, onNewMessage, subscribeToConversation,
    sendMessage, getConversation, getConversations, markAsRead, getReadStatus,
    getGistConfig, setGistConfig, clearGistConfig, isGistConfigured, syncNow,
    exportMessages, importMessages,
    SIM_PARTNER, simReply, formatTime, esc,
    setUsername, isReceiving, checkUser, checkServer, isServerAvailable,
    getContacts, saveContact, deleteContact,
  };
})();
