/**
 * Skoring Kickboxing WAKO - multi event, multi peran (PIN)
 * Database: Google Sheets. Rekap per event: folder Google Drive.
 * Rahasia (PIN pengelola) disimpan di Script Properties: MASTER_PIN
 */
const SS_ID = '1-JkKyaiNzQl4XfQXefa93IefEAVF6jTvhCmTckM3NY8';
const FOLDER_ID = '12Pw5Bsb8SBntE9z_bYAxzASg-a59elfl';
const ROLES = ['admin', 'j1', 'j2', 'j3', 'timer', 'hakim', 'monitor'];
const HEAD = {
  Events: ['id', 'nama', 'tanggal', 'admin', 'j1', 'j2', 'j3', 'timer', 'hakim', 'monitor', 'folderId', 'recapId'],
  Matches: ['eventId', 'no', 'merah', 'biru', 'kelas', 'aturan', 'rounds', 'dur', 'status', 'hasil'],
  Live: ['eventId', 'json'],
  Log: ['waktu', 'eventId', 'partai', 'peran', 'jenis', 'sisi', 'nilai']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Skoring Kickboxing WAKO')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // Opsional: hapus tanda // di bawah untuk favicon dari GitHub (PNG/ICO, URL "raw"):
    // .setFaviconUrl('https://raw.githubusercontent.com/USERNAME/skoring-kickboxing-wako/main/assets/icon.png')
    ;
}

// API JSON untuk versi GitHub Pages / PWA (fetch dari browser ke URL web app)
function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    const allow = { getEvents: getEvents, login: login, getBoard: getBoard, getMatches: getMatches, getEventsAdmin: getEventsAdmin, act: act };
    if (!allow[q.fn]) throw new Error('Fungsi tidak dikenal');
    out = { ok: true, data: allow[q.fn].apply(null, q.args || []) };
  } catch (err) { out = { ok: false, error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Sheet helper ---------- */
function sh_(n) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let s = ss.getSheetByName(n);
  if (!s) { s = ss.insertSheet(n); s.appendRow(HEAD[n]); s.setFrozenRows(1); }
  return s;
}
function rows_(n) {
  const v = sh_(n).getDataRange().getValues(), h = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => o[k] = r[j]); return o; });
}
// Jalankan SEKALI dari editor untuk membuat sheet dan memberi izin akses
function setup() { Object.keys(HEAD).forEach(sh_); }

/* ---------- Login & sesi ---------- */
function d_(x) { return x instanceof Date ? Utilities.formatDate(x, 'Asia/Jakarta', 'dd/MM/yyyy') : String(x || ''); }
function getEvents() {
  return rows_('Events').map(e => ({ id: e.id, nama: e.nama, tanggal: d_(e.tanggal) }));
}
function mk_(s) {
  const t = Utilities.getUuid();
  CacheService.getScriptCache().put('t_' + t, JSON.stringify(s), 21600);
  s.token = t;
  return s;
}
function auth_(t) {
  const c = CacheService.getScriptCache().get('t_' + t);
  if (!c) throw new Error('Sesi habis, silakan masuk lagi');
  return JSON.parse(c);
}
function login(eventId, pin) {
  pin = String(pin || '').trim();
  if (eventId === 'MASTER') {
    const mp = PropertiesService.getScriptProperties().getProperty('MASTER_PIN');
    if (mp && pin === String(mp)) return mk_({ e: 'MASTER', role: 'master', nama: 'Pengelola' });
    throw new Error('PIN salah');
  }
  const ev = rows_('Events').find(x => x.id === eventId);
  if (!ev) throw new Error('Event tidak ditemukan');
  const role = ROLES.find(r => String(ev[r]) === pin);
  if (!role) throw new Error('PIN salah');
  return mk_({ e: ev.id, role: role, nama: ev.nama });
}

/* ---------- Keadaan pertandingan ---------- */
function getLive_(e) {
  const c = CacheService.getScriptCache().get('l_' + e);
  if (c) return JSON.parse(c);
  const r = rows_('Live').find(x => x.eventId === e);
  return r && r.json ? JSON.parse(r.json) : null;
}
function setLive_(e, st) {
  const j = JSON.stringify(st);
  CacheService.getScriptCache().put('l_' + e, j, 21600);
  const r = rows_('Live').find(x => x.eventId === e);
  if (r) sh_('Live').getRange(r._row, 2).setValue(j); else sh_('Live').appendRow([e, j]);
}
function init_(m) {
  const n = +m.rounds || 3, dur = +m.dur || 120, pts = [], kd = [];
  for (let i = 0; i < n; i++) { pts.push([{ r: 0, b: 0 }, { r: 0, b: 0 }, { r: 0, b: 0 }]); kd.push({ r: 0, b: 0 }); }
  return {
    mid: m.no, info: { merah: m.merah, biru: m.biru, kelas: m.kelas, aturan: m.aturan, rounds: n, dur: dur },
    rd: 0, time: dur, running: false, t0: 0, done: false, final: false, pts: pts, kd: kd,
    w: { r: 0, b: 0 }, m: { r: 0, b: 0 }
  };
}
function fix_(st) { // bekukan sisa waktu sebelum aksi timer
  if (st.running) {
    const rem = Math.max(0, st.time - (Date.now() - st.t0) / 1000);
    st.time = rem; st.t0 = Date.now();
    if (rem <= 0) st.running = false;
  }
}
function tot_(st, j, s) {
  let t = 0;
  st.pts.forEach((r, i) => { t += r[j][s] + st.kd[i][s]; });
  return t - st.m[s];
}
function verdict_(st) {
  const v = { r: 0, b: 0, d: 0 };
  for (let j = 0; j < 3; j++) { const a = tot_(st, j, 'r'), b = tot_(st, j, 'b'); if (a > b) v.r++; else if (b > a) v.b++; else v.d++; }
  let side = null, type = 'Seri';
  if (v.r > v.b && v.r >= 2) side = 'r'; else if (v.b > v.r && v.b >= 2) side = 'b';
  if (side) {
    const w = side === 'r' ? v.r : v.b, o = side === 'r' ? v.b : v.r;
    type = w === 3 ? 'Unanimous' : (o === 1 ? 'Split' : 'Majority');
  } else { // seri: poin terbanyak di ronde terakhir
    let ra = st.kd[st.rd].r, rb = st.kd[st.rd].b;
    for (let j = 0; j < 3; j++) { ra += st.pts[st.rd][j].r; rb += st.pts[st.rd][j].b; }
    if (ra > rb) side = 'r'; else if (rb > ra) side = 'b';
    type = side ? 'Seri, ditentukan poin ronde terakhir (' + Math.max(ra, rb) + '-' + Math.min(ra, rb) + ')' : 'Seri penuh';
  }
  return { r: v.r, b: v.b, d: v.d, side: side, type: type };
}
function board_(e) {
  const st = getLive_(e);
  if (!st) return { empty: true };
  let rem = st.time, run = st.running;
  if (run) { rem = Math.max(0, st.time - (Date.now() - st.t0) / 1000); if (rem <= 0) run = false; }
  return {
    st: { info: st.info, mid: st.mid, rd: st.rd, done: st.done, final: st.final, pts: st.pts, kd: st.kd, w: st.w, m: st.m },
    rem: rem, running: run, v: verdict_(st),
    tot: [0, 1, 2].map(j => ({ r: tot_(st, j, 'r'), b: tot_(st, j, 'b') }))
  };
}
function getBoard(token) { return board_(auth_(token).e); }
function getMatches(token) {
  const s = auth_(token);
  if (s.role !== 'admin') throw new Error('Tidak diizinkan');
  return rows_('Matches').filter(m => m.eventId === s.e).map(m => ({ no: m.no, merah: m.merah, biru: m.biru, kelas: m.kelas, aturan: m.aturan, status: m.status, hasil: m.hasil }));
}
function getEventsAdmin(token) {
  if (auth_(token).role !== 'master') throw new Error('Tidak diizinkan');
  return rows_('Events').map(e => {
    const o = { nama: e.nama, tanggal: d_(e.tanggal), pins: {} };
    ROLES.forEach(r => o.pins[r] = String(e[r]));
    return o;
  });
}

/* ---------- Aksi (dikunci agar tidak saling menimpa) ---------- */
function act(token, type, p) {
  const s = auth_(token), lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return doAct_(s, type, p || {}); } finally { lock.releaseLock(); }
}
function log_(e, st, role, jenis, sisi, nilai) {
  sh_('Log').appendRow([new Date(), e, st ? st.mid : '', role, jenis, sisi || '', nilai === undefined ? '' : nilai]);
}
function doAct_(s, type, p) {
  const e = s.e, R = s.role, side = p.s === 'b' ? 'b' : 'r', d = +p.d || 0;
  if (R === 'master') {
    if (type === 'createEvent') return createEvent_(p);
    throw new Error('Tidak diizinkan');
  }
  if (R === 'admin') {
    if (type === 'addMatch') {
      if (!p.merah || !p.biru) throw new Error('Nama merah dan biru wajib diisi');
      const no = rows_('Matches').filter(m => m.eventId === e).length + 1;
      sh_('Matches').appendRow([e, no, p.merah, p.biru, p.kelas || '', p.aturan || 'K-1', +p.rounds || 3, +p.dur || 120, 'menunggu', '']);
      return { msg: 'Partai ' + no + ' ditambahkan' };
    }
    if (type === 'activate' || type === 'reset') {
      const live = getLive_(e);
      const no = type === 'reset' ? (live && live.mid) : +p.no;
      const m = rows_('Matches').find(x => x.eventId === e && +x.no === +no);
      if (!m) throw new Error('Partai tidak ditemukan');
      if (type === 'activate' && live && !live.final && +live.mid !== +no) {
        const old = rows_('Matches').find(x => x.eventId === e && +x.no === +live.mid);
        if (old && old.status === 'berjalan') sh_('Matches').getRange(old._row, 9).setValue('menunggu');
      }
      setLive_(e, init_(m));
      sh_('Matches').getRange(m._row, 9, 1, 2).setValues([['berjalan', '']]);
      log_(e, { mid: no }, R, type);
      return { board: board_(e), msg: type === 'reset' ? 'Skor partai direset' : 'Partai ' + no + ' aktif' };
    }
    throw new Error('Tidak diizinkan');
  }
  const st = getLive_(e);
  if (!st) throw new Error('Belum ada partai aktif');
  if (st.final && type !== 'noop') throw new Error('Hasil sudah disahkan');
  if (/^j[123]$/.test(R)) {
    if (type !== 'pt') throw new Error('Tidak diizinkan');
    if (st.done) throw new Error('Pertandingan sudah diakhiri');
    const j = +R[1] - 1;
    if (st.pts[st.rd][j][side] + d < 0) return { board: board_(e) };
    st.pts[st.rd][j][side] += d;
    log_(e, st, R, 'poin', side, d);
  } else if (R === 'timer') {
    if (type !== 'timer') throw new Error('Tidak diizinkan');
    fix_(st);
    if (p.a === 'toggle' && !st.done) {
      if (st.running) st.running = false; else if (st.time > 0) { st.running = true; st.t0 = Date.now(); }
    } else if (p.a === 'adj' && !st.running && !st.done) {
      st.time = Math.max(0, Math.min(st.info.dur, st.time + d));
    } else if (p.a === 'next' && !st.done) {
      st.running = false;
      if (st.rd + 1 < st.info.rounds) { st.rd++; st.time = st.info.dur; } else st.done = true;
    }
    log_(e, st, R, 'timer', '', p.a);
  } else if (R === 'hakim') {
    if (type === 'kd') { st.kd[st.rd][side] = Math.max(0, st.kd[st.rd][side] + d); log_(e, st, R, 'knockdown', side, d); }
    else if (type === 'w') { st.w[side] = Math.max(0, st.w[side] + d); log_(e, st, R, 'peringatan', side, d); }
    else if (type === 'm') { st.m[side] = Math.max(0, st.m[side] + d); log_(e, st, R, 'minus', side, d); }
    else if (type === 'final') {
      if (!st.done) throw new Error('Timekeeper belum mengakhiri pertandingan');
      st.final = true;
      finalize_(e, st);
    } else throw new Error('Tidak diizinkan');
  } else throw new Error('Tidak diizinkan');
  setLive_(e, st);
  return { board: board_(e), msg: st.final ? 'Hasil disahkan dan direkap ke Drive' : '' };
}

/* ---------- Event, rekap Drive ---------- */
function pins_() {
  const used = {}, o = {};
  ROLES.forEach(r => { let p; do { p = String(10000 + Math.floor(Math.random() * 90000)); } while (used[p]); used[p] = 1; o[r] = p; });
  return o;
}
function createEvent_(p) {
  const nama = String(p.nama || '').trim();
  if (!nama) throw new Error('Nama event wajib diisi');
  const id = 'E' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyMMddHHmmss');
  const folder = DriveApp.getFolderById(FOLDER_ID).createFolder(nama);
  const rs = SpreadsheetApp.create('Rekap - ' + nama);
  const tab = rs.getSheets()[0];
  tab.setName('Rekap');
  tab.appendRow(['Waktu', 'Partai', 'Merah', 'Biru', 'Kelas', 'Aturan', 'Ronde', 'Juri 1 (M-B)', 'Juri 2 (M-B)', 'Juri 3 (M-B)', 'KD (M-B)', 'Peringatan (M-B)', 'Poin minus (M-B)', 'Pemenang', 'Keputusan']);
  tab.setFrozenRows(1);
  DriveApp.getFileById(rs.getId()).moveTo(folder);
  const pins = pins_();
  sh_('Events').appendRow([id, nama, String(p.tanggal || ''), pins.admin, pins.j1, pins.j2, pins.j3, pins.timer, pins.hakim, pins.monitor, folder.getId(), rs.getId()]);
  return { msg: 'Event dibuat', pins: pins, nama: nama, folderUrl: folder.getUrl(), recapUrl: rs.getUrl() };
}
function finalize_(e, st) {
  const v = verdict_(st), ev = rows_('Events').find(x => x.id === e);
  const win = v.side ? (v.side === 'r' ? st.info.merah : st.info.biru) + ' (' + (v.side === 'r' ? 'merah' : 'biru') + ')' : 'Seri penuh';
  const sum = k => st[k].r + '-' + st[k].b;
  const kd = st.kd.reduce((a, x) => ({ r: a.r + x.r, b: a.b + x.b }), { r: 0, b: 0 });
  const J = j => tot_(st, j, 'r') + '-' + tot_(st, j, 'b');
  SpreadsheetApp.openById(ev.recapId).getSheetByName('Rekap').appendRow([
    new Date(), st.mid, st.info.merah, st.info.biru, st.info.kelas, st.info.aturan, st.rd + 1,
    J(0), J(1), J(2), kd.r + '-' + kd.b, sum('w'), sum('m'), win, v.type
  ]);
  const m = rows_('Matches').find(x => x.eventId === e && +x.no === +st.mid);
  if (m) sh_('Matches').getRange(m._row, 9, 1, 2).setValues([['selesai', win + ' - ' + v.type]]);
  log_(e, st, 'hakim', 'sah', '', win);
}
