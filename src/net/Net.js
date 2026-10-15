/**
 * Firebase RTDB multiplayer — host-authoritative.
 * Firebase SDK di-load lewat dynamic import() hanya saat multiplayer dipakai,
 * supaya mode solo tetap boot offline / tanpa CDN.
 */

/** Firebase Ocean Nomad — default baked-in; VITE_* di .env bisa override. */
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCoOSRs8taPcwhgQ-c3TUSsRP6Az-H1eWI',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'ocean-nomad-9cea4.firebaseapp.com',
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || 'https://ocean-nomad-9cea4-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'ocean-nomad-9cea4',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'ocean-nomad-9cea4.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '319695162428',
  appId: env.VITE_FIREBASE_APP_ID || '1:319695162428:web:5366c89f80312fc7bac739'
};

const FB_APP = 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
const FB_AUTH = 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
const FB_DB = 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

export class Net {
  get configured() {
    return !!(firebaseConfig.apiKey
      && firebaseConfig.apiKey !== 'REPLACE_ME'
      && firebaseConfig.projectId
      && firebaseConfig.databaseURL);
  }

  constructor() {
    this.app = null;
    this.db = null;
    this.uid = null;
    this.code = null;
    this.isHost = false;
    this.seed = 0;
    this.started = false;
    this.peers = new Map();
    this.handlers = {};
    this._lastSend = 0;
    this._lastWorld = 0;
    this.connected = false;
    this.name = 'Survivor';
    this._unsubs = [];
    this._fb = null; // lazy SDK refs
  }

  async _loadSdk() {
    if (this._fb) return this._fb;
    const [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import(/* @vite-ignore */ FB_APP),
      import(/* @vite-ignore */ FB_AUTH),
      import(/* @vite-ignore */ FB_DB)
    ]);
    this._fb = {
      initializeApp,
      getAuth: authMod.getAuth,
      signInAnonymously: authMod.signInAnonymously,
      getDatabase: dbMod.getDatabase,
      ref: dbMod.ref,
      set: dbMod.set,
      update: dbMod.update,
      push: dbMod.push,
      get: dbMod.get,
      onValue: dbMod.onValue,
      onChildAdded: dbMod.onChildAdded,
      onDisconnect: dbMod.onDisconnect,
      serverTimestamp: dbMod.serverTimestamp,
      remove: dbMod.remove
    };
    return this._fb;
  }

  async init() {
    try {
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'REPLACE_ME') {
        console.warn('[Ocean Nomad] Firebase belum dikonfigurasi — multiplayer nonaktif');
        this.connected = false;
        return false;
      }
      const fb = await this._loadSdk();
      this.app = fb.initializeApp(firebaseConfig);
      this.db = fb.getDatabase(this.app);
      const cred = await fb.signInAnonymously(fb.getAuth(this.app));
      this.uid = cred.user.uid;
      this.connected = true;
      return true;
    } catch (e) {
      console.warn('[Ocean Nomad] Net init failed', e);
      this.connected = false;
      return false;
    }
  }

  on(type, fn) { this.handlers[type] = fn; }

  async createRoom(name, _tries = 0) {
    if (!this.db) {
      const ok = await this.init();
      if (!ok) throw new Error('Net belum siap');
    }
    const fb = this._fb;
    this.name = name || 'Host';
    // 6 chars — harder to guess than 5
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const exists = (await fb.get(fb.ref(this.db, `rooms/${code}/meta`))).exists();
    if (exists) {
      if (_tries > 12) throw new Error('Gagal buat kode room');
      return this.createRoom(name, _tries + 1);
    }
    const seed = (Math.random() * 2 ** 32) >>> 0;
    await fb.set(fb.ref(this.db, `rooms/${code}/meta`), {
      host: this.uid,
      seed,
      started: false,
      abandoned: false,
      createdAt: fb.serverTimestamp()
    });
    this.isHost = true;
    this.seed = seed;
    this.started = false;
    await this._join(code, this.name);
    return { code, seed, started: false };
  }

  async joinRoom(code, name) {
    if (!this.db) {
      const ok = await this.init();
      if (!ok) throw new Error('Net belum siap');
    }
    const fb = this._fb;
    code = String(code || '').toUpperCase().trim();
    this.name = name || 'Crew';
    const snap = await fb.get(fb.ref(this.db, `rooms/${code}/meta`));
    if (!snap.exists()) throw new Error('Room tidak ditemukan');
    const meta = snap.val();
    this.isHost = meta.host === this.uid;
    this.seed = (meta.seed >>> 0) || 0;
    this.started = !!meta.started;
    await this._join(code, this.name);
    return { code, seed: this.seed, started: this.started };
  }

  async markStarted() {
    if (!this.isHost || !this.code || !this._fb) return;
    this.started = true;
    await this._fb.update(this._fb.ref(this.db, `rooms/${this.code}/meta`), { started: true });
  }

  async _join(code, name) {
    const fb = this._fb;
    this._detach();
    this.code = code;
    const me = fb.ref(this.db, `rooms/${code}/players/${this.uid}`);
    await fb.set(me, {
      name, x: 0.5, y: 1.3, z: 0.5, yaw: 0, spd: 0, hp: 100, t: fb.serverTimestamp()
    });
    fb.onDisconnect(me).remove();
    if (this.isHost) {
      // Only host owns abandoned flag + onDisconnect (guests would get permission_denied)
      if (this.isHost) {
        fb.set(fb.ref(this.db, `rooms/${code}/meta/abandoned`), false).catch(() => {});
        fb.onDisconnect(fb.ref(this.db, `rooms/${code}/meta/abandoned`)).set(true);
      }
    }

    this._unsubs.push(fb.onValue(fb.ref(this.db, `rooms/${code}/players`), s => {
      const all = s.val() || {};
      for (const uid of Object.keys(all)) {
        if (uid !== this.uid) this.peers.set(uid, all[uid]);
      }
      for (const uid of [...this.peers.keys()]) {
        if (!all[uid]) this.peers.delete(uid);
      }
    }));

    const joinedAt = Date.now();
    this._unsubs.push(fb.onChildAdded(fb.ref(this.db, `rooms/${code}/events`), s => {
      const e = s.val();
      if (!e || e.from === this.uid) return;
      if (e.at && e.at < joinedAt - 5000 && e.type !== 'start') return;
      this.handlers[e.type]?.(e.data, e.from);
    }));

    this._unsubs.push(fb.onValue(fb.ref(this.db, `rooms/${code}/world`), s => {
      const w = s.val();
      if (w && !this.isHost) this.handlers.world?.(w, 'host');
    }));

    this._unsubs.push(fb.onValue(fb.ref(this.db, `rooms/${code}/meta`), s => {
      const m = s.val();
      if (m?.started && !this.started) {
        this.started = true;
        this.handlers.start?.({}, 'host');
      }
      if (m?.abandoned && !this.isHost) {
        this.handlers.host_left?.({}, 'host');
      }
    }));

    this._unsubs.push(fb.onValue(fb.ref(this.db, `rooms/${code}/debris`), s => {
      const list = s.val();
      if (list && !this.isHost) this.handlers.debris_sync?.(list, 'host');
    }));

    this._unsubs.push(fb.onValue(fb.ref(this.db, `rooms/${code}/raft`), s => {
      const layout = s.val();
      if (layout && !this.isHost) this.handlers.raft_layout?.(layout, 'host');
    }));
  }

  _detach() {
    for (const u of this._unsubs) {
      try { if (typeof u === 'function') u(); } catch (_) {}
    }
    this._unsubs = [];
  }

  sendPose(localPos, yaw, spd, hp, now) {
    if (!this.code || !this.uid || !this._fb) return;
    if (now - this._lastSend < 100) return;
    const moved = !this._lp
      || Math.hypot(localPos.x - this._lp.x, localPos.z - this._lp.z) > 0.02
      || Math.abs(yaw - (this._ly ?? 0)) > 0.02
      || Math.abs(spd - (this._ls ?? 0)) > 0.3
      || Math.abs((hp ?? 100) - (this._lhp ?? 100)) > 0.5;
    if (!moved && now - this._lastSend < 2000) return; // heartbeat max 2s when idle
    this._lastSend = now;
    this._lp = { x: localPos.x, z: localPos.z };
    this._ly = yaw;
    this._ls = spd;
    this._lhp = hp ?? 100;
    this._fb.update(this._fb.ref(this.db, `rooms/${this.code}/players/${this.uid}`), {
      x: +localPos.x.toFixed(2),
      y: +localPos.y.toFixed(2),
      z: +localPos.z.toFixed(2),
      yaw: +yaw.toFixed(2),
      spd: +spd.toFixed(1),
      hp: Math.round(hp ?? 100)
    }).catch(() => {});
  }

  sendWorld(state, now) {
    if (!this.isHost || !this.code || !this._fb) return;
    if (now - this._lastWorld < 200) return;
    this._lastWorld = now;
    // debris dikirim terpisah (sendDebris) agar payload world lebih ringan
    const { debris, ...rest } = state || {};
    this._fb.set(this._fb.ref(this.db, `rooms/${this.code}/world`), {
      ...rest, t: Date.now()
    }).catch(() => {});
  }

  sendDebris(list, now) {
    if (!this.isHost || !this.code || !this._fb) return;
    if (now - (this._lastDebris || 0) < 1500) return;
    this._lastDebris = now;
    this._fb.set(this._fb.ref(this.db, `rooms/${this.code}/debris`), list).catch(() => {});
  }

  pushRaftLayout(layout) {
    if (!this.isHost || !this.code || !this._fb) return;
    this._fb.set(this._fb.ref(this.db, `rooms/${this.code}/raft`), layout).catch(() => {});
  }

  sendEvent(type, data = {}) {
    if (!this.code || !this._fb) return;
    const r = this._fb.push(this._fb.ref(this.db, `rooms/${this.code}/events`), {
      type, data, from: this.uid, at: Date.now()
    });
    // Bersihkan event lama (kuota + listener noise)
    setTimeout(() => {
      try { this._fb.remove(r).catch(() => {}); } catch (_) {}
    }, 15000);
  }

  async leave() {
    this._detach();
    if (this.code && this.uid && this.db && this._fb) {
      try {
        await this._fb.remove(this._fb.ref(this.db, `rooms/${this.code}/players/${this.uid}`));
        if (this.isHost) {
          await this._fb.update(this._fb.ref(this.db, `rooms/${this.code}/meta`), { abandoned: true }).catch(() => {});
        }
      } catch (_) {}
    }
    this.code = null;
    this.isHost = false;
    this.started = false;
    this.peers.clear();
  }
}
