'use strict';
/* ================= Helper & Storage ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const K = { users: 'tf_users', session: 'tf_session', projects: 'tf_projects', tasks: 'tf_tasks', theme: 'tf_theme', accent: 'tf_accent' };
const STATUS = ['To-do', 'In-Progress', 'Done'];
const PSTATUS = ['Aktif', 'Ditunda', 'Selesai'];
const ACCENTS = { pink: ['#e84393', '#ff7eb3'], ungu: ['#7c3aed', '#ec4899'], oranye: ['#f97316', '#eab308'], hijau: ['#10b981', '#06b6d4'], laut: ['#0ea5e9', '#6366f1'] };
const MAX_FILE = 500 * 1024; // 500 KB per lampiran (batas localStorage ~5 MB)
const FILE_OK = /\.(png|jpe?g|gif|webp|pdf|txt|docx?|xlsx?|pptx?)$/i;

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { toast('Penyimpanan browser penuh. Hapus lampiran/data lama.', 'error'); return false; }
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const P = () => load(K.projects, []);
const T = () => load(K.tasks, []);
const me = () => load(K.users, []).find(u => u.id === load(K.session, null));
const myP = () => P().filter(p => p.userId === me().id);
const myT = () => { const ids = new Set(myP().map(p => p.id)); return T().filter(t => ids.has(t.projectId)); };
const opts = (list, sel) => list.map(s => `<option ${s === sel ? 'selected' : ''}>${s}</option>`).join('');
const field = (name, label, input) => `<label>${label}${input}<span class="err" data-err="${name}"></span></label>`;
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const pwInput = (name, ac) => `<span class="pw"><input name="${name}" type="password" autocomplete="${ac}"><button type="button" class="eye" data-act="toggle-pw" aria-label="Tampilkan kata sandi" title="Tampilkan kata sandi">${EYE}</button></span>`;
const empty = (t, s) => `<div class="empty"><div class="big">📭</div><h3>${t}</h3><p>${s}</p></div>`;

const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysLeft = d => Math.round((new Date(d + 'T00:00:00') - today0()) / 864e5);
const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const dl = d => { const n = daysLeft(d);
  return n < 0 ? [`Terlambat ${-n} hari`, 'late'] : n === 0 ? ['Hari ini', 'soon'] : n === 1 ? ['H-1', 'soon'] : n <= 3 ? [`H-${n}`, 'near'] : [fmt(d), '']; };
// Skor prioritas: bobot tinggi + deadline dekat = paling atas. Tanpa bobot dianggap 10.
const score = t => (t.weight || 10) / (Math.max(daysLeft(t.deadline), 0) + 1);

async function sha(t) {
  if (window.crypto?.subtle) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  return btoa(unescape(encodeURIComponent(t)));
}

/* ================= UI: toast, modal, validasi ================= */
function toast(msg, type = 'ok', ms = 3500) {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.remove(), ms);
}
const openModal = html => { const m = $('#modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.remove('hidden'); $('input,textarea', m)?.focus(); };
const closeModal = () => { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; };
const ask = msg => new Promise(res => {
  openModal(`<h3>Konfirmasi</h3><p>${esc(msg)}</p><div class="row end"><button class="btn ghost" id="no">Batal</button><button class="btn danger" id="yes">Ya, hapus</button></div>`);
  $('#yes').onclick = () => { closeModal(); res(true); };
  $('#no').onclick = () => { closeModal(); res(false); };
});
function showErrors(form, errs) {
  $$('[data-err]', form).forEach(e => e.textContent = errs[e.dataset.err] || '');
  const first = Object.keys(errs)[0];
  if (first) $(`[name=${first}]`, form)?.focus();
  return first !== undefined;
}

/* ================= Tema ================= */
function applyTheme() {
  const dark = (localStorage.getItem(K.theme) || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')) === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#themeBtn').textContent = dark ? '☀️' : '🌙';
  const name = localStorage.getItem(K.accent) in ACCENTS ? localStorage.getItem(K.accent) : 'pink';
  const [a, b] = ACCENTS[name];
  document.documentElement.style.setProperty('--a1', a);
  document.documentElement.style.setProperty('--a2', b);
  $('#swatches').innerHTML = Object.entries(ACCENTS).map(([n, [x, y]]) =>
    `<button class="sw ${n === name ? 'on' : ''}" data-act="accent" data-id="${n}" title="${n}" style="background:linear-gradient(135deg,${x},${y})"></button>`).join('');
}

/* ================= Router ================= */
const S = { cal: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(), pid: null, mode: 'list', filter: { q: '', status: '', sort: 'deadline' }, draft: [] };

function route() {
  const u = me(), pub = ['/login', '/register'], h = location.hash.slice(1) || (u ? '/dashboard' : '/home');
  if (!u && !pub.includes(h) && h !== '/home') { location.hash = '#/login'; return; }   // guard: wajib login
  if (u && pub.includes(h)) { location.hash = '#/dashboard'; return; }
  document.body.classList.toggle('authed', !!u);
  $('#userName').textContent = u ? u.name : '';
  const [, page, id] = h.split('/');
  S.calView = 'days';
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === page || (page === 'project' && a.dataset.nav === 'projects')));
  ({ home: vHome, login: vLogin, register: vRegister, dashboard: vDash, projects: vProjects, project: () => vProject(id) }[page] || vDash)();
  window.scrollTo(0, 0);
}

/* ================= Beranda ================= */
function vHome() {
  const cta = me() ? '<a class="btn primary" href="#/dashboard">Buka dashboard</a>'
    : '<a class="btn primary" href="#/register">Mulai sekarang</a><a class="btn" href="#/login">Masuk</a>';
  const F = [['⏰', 'Pengingat deadline', 'Tugas yang mendekati tenggat muncul di dashboard, diurutkan dari bobot dan kedekatan deadline.'],
    ['🗂️', 'Proyek & tugas', 'Kelompokkan tugas per proyek, misalnya per divisi, program kerja, atau kegiatan.'],
    ['📌', 'Papan status', 'Seret kartu antara To-do, In-Progress, dan Done untuk memperbarui progres.'],
    ['📎', 'Lampiran file', 'Unggah dokumen, gambar, atau PDF langsung di tugas.']];
  const S3 = [['Buat akun', 'Daftar dengan email dan kata sandi.'], ['Tambah proyek & tugas', 'Isi deadline, bobot nilai, dan lampiran bila perlu.'], ['Pantau di dashboard', 'Lihat ringkasan progres dan tugas yang paling mendesak.']];
  $('#view').innerHTML = `<section class="hero"><h1>Kelola proyek dan tugas <span>lebih teratur</span></h1>
    <p>Satu tempat untuk mencatat tugas, memantau deadline, dan melihat progres kerja tim maupun pribadi.</p><div class="row wrap">${cta}</div></section>
    <h2 class="sec-title">Fitur <span>utama</span></h2>
    <div class="features">${F.map(([i, t, d]) => `<div class="card feat"><div class="ico">${i}</div><h4>${t}</h4><p class="muted">${d}</p></div>`).join('')}</div>
    <h2 class="sec-title">Cara <span>pakai</span></h2>
    <div class="steps">${S3.map(([t, d]) => `<div class="card step"><h4>${t}</h4><p class="muted">${d}</p></div>`).join('')}</div>`;
}

/* ================= Auth ================= */
function vLogin() {
  $('#view').innerHTML = `<section class="card auth"><h2>Masuk</h2><p class="muted">Kelola proyek dan tugasmu di satu tempat.</p>
  <form data-form="login" novalidate>
    ${field('email', 'Email', '<input name="email" type="email" autocomplete="username">')}
    ${field('password', 'Kata sandi', pwInput('password', 'current-password'))}
    <button class="btn primary block">Masuk</button></form>
  <p class="muted center">Belum punya akun? <a href="#/register">Daftar</a></p></section>`;
}
function vRegister() {
  $('#view').innerHTML = `<section class="card auth"><h2>Buat akun</h2><p class="muted">Data tersimpan di browser ini saja.</p>
  <form data-form="register" novalidate>
    ${field('name', 'Nama', '<input name="name" maxlength="40" autocomplete="name">')}
    ${field('email', 'Email', '<input name="email" type="email" autocomplete="username">')}
    ${field('password', 'Kata sandi <small>(min. 6 karakter, ada huruf & angka)</small>', pwInput('password', 'new-password'))}
    ${field('confirm', 'Ulangi kata sandi', pwInput('confirm', 'new-password'))}
    <button class="btn primary block">Daftar</button></form>
  <p class="muted center">Sudah punya akun? <a href="#/login">Masuk</a></p></section>`;
}
async function doLogin(f) {
  const d = Object.fromEntries(new FormData(f)), e = {};
  if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = 'Format email tidak valid';
  if (!d.password) e.password = 'Kata sandi wajib diisi';
  if (showErrors(f, e)) return;
  const u = load(K.users, []).find(x => x.email === d.email.trim().toLowerCase());
  if (!u || u.pass !== await sha(d.password)) return toast('Email atau kata sandi salah', 'error');
  localStorage.setItem(K.session, JSON.stringify(u.id));
  toast(`Selamat datang, ${u.name}!`); location.hash = '#/dashboard'; route();
}
async function doRegister(f) {
  const d = Object.fromEntries(new FormData(f)), e = {}, users = load(K.users, []);
  const email = d.email.trim().toLowerCase();
  if (d.name.trim().length < 2) e.name = 'Nama minimal 2 karakter';
  if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Format email tidak valid';
  else if (users.some(u => u.email === email)) e.email = 'Email sudah terdaftar';
  if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(d.password)) e.password = 'Minimal 6 karakter, kombinasi huruf dan angka';
  if (d.confirm !== d.password) e.confirm = 'Kata sandi tidak sama';
  if (showErrors(f, e)) return;
  const u = { id: uid(), name: d.name.trim(), email, pass: await sha(d.password) };
  users.push(u);
  if (!save(K.users, users)) return;
  localStorage.setItem(K.session, JSON.stringify(u.id));
  toast('Akun berhasil dibuat'); location.hash = '#/dashboard'; route();
}

/* ================= Dashboard ================= */
function vDash() {
  const ps = myP(), ts = myT(), c = s => ts.filter(t => t.status === s).length;
  const names = Object.fromEntries(ps.map(p => [p.id, p.name]));
  const rem = ts.filter(t => t.status !== 'Done' && daysLeft(t.deadline) <= 3).sort((a, b) => score(b) - score(a));
  const bars = ts.length ? `<section class="card" style="margin-bottom:14px"><h3>📊 Progres tugas</h3><div class="bars">${STATUS.map(s => `<div class="bar"><span>${s}</span><div class="track"><i style="width:${Math.round(c(s) / ts.length * 100)}%"></i></div><b>${c(s)}</b></div>`).join('')}</div></section>` : '';
  const canAsk = 'Notification' in window && Notification.permission === 'default';
  $('#view').innerHTML = `<h2>Halo, ${esc(me().name)} 👋</h2>
  <div class="stats">
    <div class="card stat g"><b>${ps.length}</b><span>Proyek</span></div>
    <div class="card stat"><b>${c('To-do')}</b><span>To-do</span></div>
    <div class="card stat"><b>${c('In-Progress')}</b><span>In-Progress</span></div>
    <div class="card stat"><b>${c('Done')}</b><span>Done</span></div>
  </div>
  ${calHTML(ts)}
  ${bars}
  <section class="card"><div class="row between" style="margin:0 0 6px"><h3>⏰ Pengingat deadline</h3>
    ${canAsk ? '<button class="btn sm" data-act="notif">Aktifkan notifikasi browser</button>' : ''}</div>
    <p class="muted" style="margin-top:0">Tugas yang belum selesai dan deadline ≤ 3 hari, diurutkan dari bobot & kedekatan deadline.</p>
    ${rem.length ? rem.map(t => { const [l, cls] = dl(t.deadline); return `<div class="remind"><div>
        <a href="#/project/${t.projectId}"><b>${esc(t.title)}</b></a><div class="muted">${esc(names[t.projectId])}</div></div>
        <div class="row">${t.weight ? `<span class="pill w">⚖ ${t.weight}</span>` : ''}<span class="pill ${cls}">${l}</span></div></div>`; }).join('')
      : empty('Tidak ada deadline mendesak', 'Semua tugas aman untuk saat ini.')}
  </section>`;
}
function notifyDue() {
  if (sessionStorage.getItem('tf_notified') || !me()) return;
  sessionStorage.setItem('tf_notified', '1');
  const due = myT().filter(t => t.status !== 'Done' && daysLeft(t.deadline) <= 1).sort((a, b) => score(b) - score(a));
  if (!due.length) return;
  toast(`⏰ ${due.length} tugas H-1/terlambat. Prioritas: ${due[0].title}`, 'warn', 8000);
  if ('Notification' in window && Notification.permission === 'granted')
    new Notification('TaskFlow: deadline dekat', { body: due.slice(0, 3).map(t => t.title).join(', ') });
}

/* ================= Kalender ================= */
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function pickerHTML(v) {
  const { y, m } = S.cal, t = new Date(), cy = t.getFullYear();
  let title, body;
  if (v === 'months') {
    title = `<button class="linkbtn" data-act="cal-view" data-id="years">${S.pickY}</button>`;
    body = MONTHS.map((n, i) => `<button class="pk ${S.pickY === cy && i === t.getMonth() ? 'now' : ''} ${S.pickY === y && i === m ? 'on' : ''}" data-act="pick-month" data-id="${i}">${n.slice(0, 3)}</button>`).join('');
  } else {
    title = `${S.yBase} – ${S.yBase + 11}`;
    body = Array.from({ length: 12 }, (_, i) => S.yBase + i).map(yy => `<button class="pk ${yy === cy ? 'now' : ''} ${yy === y ? 'on' : ''}" data-act="pick-year" data-id="${yy}">${yy}</button>`).join('');
  }
  return `<section class="card" id="cal" style="margin-bottom:14px"><div class="row between" style="margin-bottom:10px"><h3>📅 ${title}</h3>
    <div class="row"><button class="btn sm" data-act="pick-prev" aria-label="Sebelumnya">‹</button><button class="btn sm" data-act="cal-view" data-id="days">Kembali</button><button class="btn sm" data-act="pick-next" aria-label="Berikutnya">›</button></div></div>
    <div class="pickgrid">${body}</div></section>`;
}
function calHTML(ts) {
  if (S.calView && S.calView !== 'days') return pickerHTML(S.calView);
  const { y, m } = S.cal, lead = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), t0 = today0();
  const todayK = ymd(t0.getFullYear(), t0.getMonth(), t0.getDate()), by = {};
  ts.forEach(t => (by[t.deadline] ||= []).push(t));
  let cells = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => `<div class="cdh">${d}</div>`).join('') + '<div class="cd off"></div>'.repeat(lead);
  for (let d = 1; d <= n; d++) {
    const k = ymd(y, m, d), l = by[k] || [];
    cells += `<button type="button" class="cd ${k === todayK ? 'today' : ''}" data-act="day" data-id="${k}"><b>${d}</b>` +
      l.slice(0, 2).map(t => `<span class="chip s${STATUS.indexOf(t.status)} ${t.status !== 'Done' && daysLeft(t.deadline) < 0 ? 'late' : ''}">${esc(t.title)}</span>`).join('') +
      (l.length > 2 ? `<small>+${l.length - 2} lagi</small>` : '') + '</button>';
  }
  return `<section class="card" id="cal" style="margin-bottom:14px"><div class="row between" style="margin-bottom:10px"><h3>📅 <button class="linkbtn" data-act="cal-view" data-id="months" title="Pilih bulan">${MONTHS[m]}</button><button class="linkbtn" data-act="cal-view" data-id="years" title="Pilih tahun">${y}</button></h3>
    <div class="row"><button class="btn sm" data-act="cal-prev" aria-label="Bulan sebelumnya">‹</button><button class="btn sm" data-act="cal-today">Hari ini</button><button class="btn sm" data-act="cal-next" aria-label="Bulan berikutnya">›</button></div></div>
    <div class="calgrid">${cells}</div><p class="muted" style="margin:10px 0 0;font-size:13px">Klik tanggal untuk melihat, mengubah, atau menambah tugas.</p></section>`;
}
function dayModal(k) {
  const ps = Object.fromEntries(myP().map(p => [p.id, p.name])), ts = myT().filter(t => t.deadline === k);
  openModal(`<h3>${fmt(k)}</h3>` + (ts.length ? ts.map(t => `<div class="remind"><div><b>${esc(t.title)}</b><div class="muted">${esc(ps[t.projectId])}</div></div>
    <div class="row"><span class="pill s${STATUS.indexOf(t.status)}">${t.status}</span><button class="btn ghost sm" data-act="edit-task" data-id="${t.id}">Ubah</button></div></div>`).join('') : '<p class="muted">Belum ada tugas di tanggal ini.</p>') +
    `<div class="row end"><button class="btn ghost" data-act="close">Tutup</button><button class="btn primary" data-act="cal-new" data-id="${k}">+ Tugas</button></div>`);
}
const calMove = n => { const d = new Date(S.cal.y, S.cal.m + n, 1); S.cal = { y: d.getFullYear(), m: d.getMonth() }; vDash(); };

/* ================= Proyek ================= */
function vProjects() {
  const ps = myP().sort((a, b) => a.deadline.localeCompare(b.deadline)), ts = myT();
  $('#view').innerHTML = `<div class="row between"><h2>Proyek</h2><button class="btn primary" data-act="new-project">+ Proyek baru</button></div>` +
    (ps.length ? `<div class="grid">${ps.map(p => {
      const t = ts.filter(x => x.projectId === p.id), done = t.filter(x => x.status === 'Done').length, pct = t.length ? Math.round(done / t.length * 100) : 0;
      const [l, cls] = dl(p.deadline);
      return `<article class="card"><div class="row between" style="margin:0"><h4>${esc(p.name)}</h4><span class="pill">${p.status}</span></div>
        <p class="muted">${esc(p.description) || 'Tanpa deskripsi'}</p>
        <div class="row"><span class="pill ${cls}">${l}</span><span class="muted">${done}/${t.length} tugas</span></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="row" style="margin-top:12px"><a class="btn sm" href="#/project/${p.id}">Lihat</a>
        <button class="btn ghost sm" data-act="edit-project" data-id="${p.id}">Ubah</button>
        <button class="btn danger sm" data-act="del-project" data-id="${p.id}">Hapus</button></div></article>`;
    }).join('')}</div>` : empty('Belum ada proyek', 'Klik "Proyek baru" untuk mulai.'));
}
function projectForm(id) {
  const p = id ? P().find(x => x.id === id) : null;
  openModal(`<form data-form="project" data-id="${id || ''}" novalidate><h3>${p ? 'Ubah' : 'Tambah'} proyek</h3>
    ${field('name', 'Nama proyek', `<input name="name" maxlength="60" value="${esc(p?.name)}">`)}
    ${field('description', 'Deskripsi', `<textarea name="description" rows="3" maxlength="300">${esc(p?.description)}</textarea>`)}
    ${field('deadline', 'Deadline', `<input name="deadline" type="date" value="${p?.deadline || ''}">`)}
    <label>Status<select name="status">${opts(PSTATUS, p?.status)}</select></label>
    <div class="row end"><button type="button" class="btn ghost" data-act="close">Batal</button><button class="btn primary">Simpan</button></div></form>`);
}
function saveProject(f, id) {
  const d = Object.fromEntries(new FormData(f)), e = {};
  if (d.name.trim().length < 3) e.name = 'Nama proyek minimal 3 karakter';
  if (!d.deadline) e.deadline = 'Deadline wajib diisi';
  if (showErrors(f, e)) return;
  const all = P(), obj = { name: d.name.trim(), description: d.description.trim(), deadline: d.deadline, status: d.status };
  if (id) { const i = all.findIndex(x => x.id === id); all[i] = { ...all[i], ...obj }; }
  else all.push({ id: uid(), userId: me().id, ...obj });
  if (save(K.projects, all)) { closeModal(); toast(id ? 'Proyek diperbarui' : 'Proyek ditambahkan'); route(); }
}
async function delProject(id) {
  const p = P().find(x => x.id === id), n = T().filter(t => t.projectId === id).length;
  if (!await ask(`Hapus proyek "${p.name}" beserta ${n} tugas di dalamnya? Tindakan ini tidak bisa dibatalkan.`)) return;
  save(K.tasks, T().filter(t => t.projectId !== id));
  save(K.projects, P().filter(x => x.id !== id));
  toast('Proyek dan tugasnya dihapus'); location.hash = '#/projects'; route();
}

/* ================= Tugas ================= */
function vProject(id) {
  const p = myP().find(x => x.id === id);
  if (!p) { toast('Proyek tidak ditemukan', 'error'); location.hash = '#/projects'; return; }
  if (S.pid !== id) S.filter = { q: '', status: '', sort: 'deadline' };
  S.pid = id;
  const [l, cls] = dl(p.deadline), f = S.filter;
  $('#view').innerHTML = `<a href="#/projects">← Semua proyek</a>
  <div class="row between" style="margin-top:8px"><div><h2>${esc(p.name)}</h2>
    <p class="muted" style="margin:4px 0">${esc(p.description)}</p>
    <div class="row"><span class="pill">${p.status}</span><span class="pill ${cls}">Deadline: ${l}</span></div></div>
    <div class="row"><button class="btn ghost sm" data-act="edit-project" data-id="${id}">Ubah proyek</button>
    <button class="btn primary" data-act="new-task">+ Tugas</button></div></div>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Cari tugas…" value="${esc(f.q)}" aria-label="Cari tugas">
    <select id="fs" aria-label="Filter status"><option value="">Semua status</option>${opts(STATUS, f.status)}</select>
    <select id="sort" aria-label="Urutkan"><option value="deadline" ${f.sort === 'deadline' ? 'selected' : ''}>Urut deadline</option>
      <option value="priority" ${f.sort === 'priority' ? 'selected' : ''}>Urut prioritas</option>
      <option value="title" ${f.sort === 'title' ? 'selected' : ''}>Urut judul</option></select>
    <button class="btn ${S.mode === 'list' ? 'on' : ''}" data-act="mode" data-id="list">Daftar</button>
    <button class="btn ${S.mode === 'board' ? 'on' : ''}" data-act="mode" data-id="board">Papan</button></div>
  <div id="taskArea"></div>`;
  renderTasks();
}
function taskCard(t, drag) {
  const [l, c] = dl(t.deadline);
  return `<article class="card task ${t.status === 'Done' ? 'done' : ''}" ${drag ? 'draggable="true"' : ''} data-id="${t.id}">
    <div class="row"><h4>${esc(t.title)}</h4>${t.weight ? `<span class="pill w" title="Bobot nilai">⚖ ${t.weight}</span>` : ''}</div>
    ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ''}
    <div class="row wrap"><span class="pill ${t.status === 'Done' ? '' : c}">${l}</span><span class="pill s${STATUS.indexOf(t.status)}">${t.status}</span></div>
    ${(t.files || []).map(f => `<a class="file" href="${f.data}" download="${esc(f.name)}">📎 ${esc(f.name)}</a>`).join('')}
    <div class="row actions"><select data-act="set-status" data-id="${t.id}" aria-label="Ubah status">${opts(STATUS, t.status)}</select>
      <button class="btn ghost sm" data-act="edit-task" data-id="${t.id}">Ubah</button>
      <button class="btn danger sm" data-act="del-task" data-id="${t.id}">Hapus</button></div></article>`;
}
function renderTasks() {
  const area = $('#taskArea'); if (!area) return;
  const all = T().filter(t => t.projectId === S.pid), { q, status, sort } = S.filter;
  const list = all.filter(t => (!status || t.status === status) && (!q || (t.title + ' ' + t.description).toLowerCase().includes(q.toLowerCase())));
  list.sort(sort === 'priority' ? (a, b) => score(b) - score(a) : sort === 'title' ? (a, b) => a.title.localeCompare(b.title) : (a, b) => a.deadline.localeCompare(b.deadline));
  if (!all.length) area.innerHTML = empty('Belum ada tugas', 'Klik "+ Tugas" untuk menambahkan tugas pertama.');
  else if (!list.length) area.innerHTML = empty('Tidak ada hasil', 'Coba ubah kata kunci atau filter.');
  else if (S.mode === 'board')
    area.innerHTML = `<div class="board">${STATUS.map(s => `<div class="col" data-status="${s}"><h4>${s} (${list.filter(t => t.status === s).length})</h4>${list.filter(t => t.status === s).map(t => taskCard(t, true)).join('')}</div>`).join('')}</div>`;
  else area.innerHTML = `<div class="list">${list.map(t => taskCard(t, false)).join('')}</div>`;
}
function taskForm(id, date, pick) {
  const t = id ? T().find(x => x.id === id) : null;
  S.draft = (t?.files || []).slice();
  openModal(`<form data-form="task" data-id="${id || ''}" novalidate><h3>${t ? 'Ubah' : 'Tambah'} tugas</h3>
    ${field('title', 'Judul', `<input name="title" maxlength="80" value="${esc(t?.title)}">`)}
    ${field('description', 'Deskripsi', `<textarea name="description" rows="3" maxlength="500">${esc(t?.description)}</textarea>`)}
    ${pick && !t ? `<label>Proyek<select name="project">${myP().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>` : ''}
    <div class="row wrap">${field('deadline', 'Deadline', `<input name="deadline" type="date" value="${t?.deadline || date || ''}">`)}
    <label>Status<select name="status">${opts(STATUS, t?.status)}</select></label></div>
    ${field('weight', 'Bobot nilai <small>(opsional, 1–100; makin besar makin diprioritaskan di pengingat)</small>', `<input name="weight" type="number" min="1" max="100" value="${t?.weight ?? ''}">`)}
    <label>Lampiran <small>(maks. 500 KB/file: gambar, PDF, dokumen)</small><input id="fileInput" type="file" multiple></label>
    <div id="fileList"></div>
    <div class="row end"><button type="button" class="btn ghost" data-act="close">Batal</button><button class="btn primary">Simpan</button></div></form>`);
  renderDraft();
}
const renderDraft = () => { const el = $('#fileList'); if (el) el.innerHTML = S.draft.map((f, i) =>
  `<div class="row" style="margin-bottom:6px">📎 <span style="flex:1;word-break:break-all">${esc(f.name)} <small class="muted">(${Math.ceil(f.size / 1024)} KB)</small></span>
   <button type="button" class="btn danger sm" data-act="rm-file" data-id="${i}">Lepas</button></div>`).join(''); };
const readFile = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
async function addFiles(input) {
  for (const f of input.files) {
    if (!FILE_OK.test(f.name)) { toast(`${f.name}: tipe file tidak didukung`, 'error'); continue; }
    if (f.size > MAX_FILE) { toast(`${f.name}: lebih dari 500 KB`, 'error'); continue; }
    S.draft.push({ name: f.name, size: f.size, data: await readFile(f) });
  }
  input.value = ''; renderDraft();
}
function saveTask(f, id) {
  const d = Object.fromEntries(new FormData(f)), e = {};
  if (d.title.trim().length < 3) e.title = 'Judul minimal 3 karakter';
  if (!d.deadline) e.deadline = 'Deadline wajib diisi';
  if (d.weight !== '' && !(Number.isInteger(+d.weight) && +d.weight >= 1 && +d.weight <= 100)) e.weight = 'Bobot harus bilangan bulat 1–100';
  if (showErrors(f, e)) return;
  const all = T(), obj = { title: d.title.trim(), description: d.description.trim(), deadline: d.deadline, status: d.status, weight: d.weight === '' ? null : +d.weight, files: S.draft };
  if (id) { const i = all.findIndex(x => x.id === id); all[i] = { ...all[i], ...obj }; }
  else all.push({ id: uid(), projectId: d.project || S.pid, createdAt: Date.now(), ...obj });
  if (save(K.tasks, all)) { closeModal(); toast(id ? 'Tugas diperbarui' : 'Tugas ditambahkan'); renderTasks(); if ($('#cal')) vDash(); }
}
function setStatus(id, status) {
  const all = T(), t = all.find(x => x.id === id);
  if (!t || t.status === status) return;
  t.status = status;
  if (save(K.tasks, all)) { toast(`Dipindah ke ${status}`); renderTasks(); }
}
async function delTask(id) {
  const t = T().find(x => x.id === id);
  if (!await ask(`Hapus tugas "${t.title}"?`)) return;
  save(K.tasks, T().filter(x => x.id !== id)); toast('Tugas dihapus'); renderTasks();
}

/* ================= Event delegation ================= */
document.addEventListener('click', async e => {
  if (e.target.id === 'modal') return closeModal();
  const el = e.target.closest('[data-act]'); if (!el) return;
  const { act, id } = el.dataset;
  if (act === 'close') closeModal();
  else if (act === 'logout') { if (confirm('Yakin ingin keluar?')) { localStorage.removeItem(K.session); sessionStorage.removeItem('tf_notified'); location.hash = '#/login'; route(); } }
  else if (act === 'theme') { localStorage.setItem(K.theme, document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); }
  else if (act === 'accent') { localStorage.setItem(K.accent, id); applyTheme(); }
  else if (act === 'notif') { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Notifikasi browser aktif' : 'Notifikasi tidak diizinkan', r === 'granted' ? 'ok' : 'warn'); vDash(); }
  else if (act === 'toggle-pw') { const i = $('input', el.parentElement), show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = show ? EYE_OFF : EYE; const t = show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'; el.title = t; el.setAttribute('aria-label', t); }
  else if (act === 'day') dayModal(id);
  else if (act === 'cal-new') { if (!myP().length) { closeModal(); toast('Buat proyek dulu sebelum menambah tugas', 'warn'); } else taskForm(null, id, true); }
  else if (act === 'cal-view') { S.calView = id; S.pickY = S.pickY ?? S.cal.y; if (id === 'months') S.pickY = S.cal.y; if (id === 'years') S.yBase = Math.floor(S.pickY / 12) * 12; vDash(); }
  else if (act === 'pick-month') { S.cal = { y: S.pickY, m: +id }; S.calView = 'days'; vDash(); }
  else if (act === 'pick-year') { S.pickY = +id; S.calView = 'months'; vDash(); }
  else if (act === 'pick-prev' || act === 'pick-next') { const s = act === 'pick-next' ? 1 : -1; if (S.calView === 'years') S.yBase += 12 * s; else S.pickY += s; vDash(); }
  else if (act === 'cal-prev') calMove(-1);
  else if (act === 'cal-next') calMove(1);
  else if (act === 'cal-today') { S.calView = 'days'; const d = new Date(); S.cal = { y: d.getFullYear(), m: d.getMonth() }; vDash(); }
  else if (act === 'new-project') projectForm();
  else if (act === 'edit-project') projectForm(id);
  else if (act === 'del-project') delProject(id);
  else if (act === 'new-task') taskForm();
  else if (act === 'edit-task') taskForm(id);
  else if (act === 'del-task') delTask(id);
  else if (act === 'rm-file') { S.draft.splice(+id, 1); renderDraft(); }
  else if (act === 'mode') { S.mode = id; vProject(S.pid); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, k = f.dataset.form, id = f.dataset.id || null;
  ({ login: () => doLogin(f), register: () => doRegister(f), project: () => saveProject(f, id), task: () => saveTask(f, id) }[k] || (() => {}))();
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.filter.q = e.target.value; renderTasks(); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fs') { S.filter.status = t.value; renderTasks(); }
  else if (t.id === 'sort') { S.filter.sort = t.value; renderTasks(); }
  else if (t.id === 'fileInput') addFiles(t);
  else if (t.dataset.act === 'set-status') setStatus(t.dataset.id, t.value);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* Drag & drop status (papan) */
document.addEventListener('dragstart', e => { const c = e.target.closest?.('.task[data-id]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging'); } });
document.addEventListener('dragend', e => { e.target.closest?.('.task')?.classList.remove('dragging'); $$('.col.over').forEach(c => c.classList.remove('over')); });
document.addEventListener('dragover', e => { const c = e.target.closest?.('.col'); if (c) { e.preventDefault(); $$('.col.over').forEach(x => x !== c && x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('drop', e => { const c = e.target.closest?.('.col'); if (!c) return; e.preventDefault(); setStatus(e.dataTransfer.getData('text/plain'), c.dataset.status); });

/* ================= Start ================= */
window.addEventListener('hashchange', route);
applyTheme();
route();
notifyDue();
