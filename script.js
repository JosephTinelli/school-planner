const TIPI = {
  circolare: {n: 'Circolare', c: '#0ea5e9'},
  riunione:  {n: 'Riunione',  c: '#f59e0b'},
  scadenza:  {n: 'Scadenza',  c: '#ef4444'},
  evento:    {n: 'Evento',    c: '#10b981'}
};
const COLORI = [['Verde acqua','#0f766e'],['Viola','#7c3aed'],['Arancio','#ea580c'],['Rosa','#db2777'],['Blu','#2563eb']];
const K_EV = 'planner_eventi_v2', K_IM = 'planner_impostazioni_v2';
const K_AUTH = 'planner_auth_v3', K_SESSIONE = 'planner_sessione_v3', K_EMAIL = 'planner_email_v3', K_INBOX = 'planner_inbox_v3';

const $ = id => document.getElementById(id);
const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = s => new Date(s+'T12:00').toLocaleDateString('it-IT', {weekday:'short', day:'numeric', month:'short'});
const fmtLungo = s => new Date(s+'T12:00').toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'});
const ordina = (a,b) => (a.data + (a.ora||'')).localeCompare(b.data + (b.ora||''));
const dim = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';

let eventi = [];
let imp = {nome:'', ruolo:'docente', tema:'auto', colore:'#0f766e', sett:1, testo:'100'};
let vista = new Date(), sel = iso(new Date()), editId = null;
let attivo = {circolare:1, riunione:1, scadenza:1, evento:1};
let email = {addr:'', host:'imap.gmail.com', port:993, user:'', pwd:'', mode:'demo', proxy:'', clientId:''};
let inbox = [];
let eventoProposto = null;

/* ---------- Dati ---------- */
function carica() {
  try { const i = localStorage.getItem(K_IM); if (i) imp = {...imp, ...JSON.parse(i)}; } catch(e) {}
  try { const e = localStorage.getItem(K_EMAIL); if (e) email = {...email, ...JSON.parse(e)}; } catch(e) {}
  try { const ib = localStorage.getItem(K_INBOX); if (ib) inbox = JSON.parse(ib); } catch(e) {}
  try { const r = localStorage.getItem(K_EV); if (r) { eventi = JSON.parse(r); return; } } catch(e) {}
  const t = new Date(), g = n => { const d = new Date(t); d.setDate(t.getDate()+n); return iso(d); };
  eventi = [
    {id:1, titolo:'Circ. 41 – Calendario scrutini', tipo:'circolare', data:g(-2), ora:'', classi:'Tutte', num:'Circ. n. 41 – circolare41.pdf', desc:'Calendario degli scrutini intermedi.', firma:true, urgente:false, firme:[]},
    {id:2, titolo:'Collegio docenti', tipo:'riunione', data:g(3), ora:'15:00', luogo:'Aula magna', classi:'Docenti', num:'', desc:'O.d.G. in bacheca.', firma:false, urgente:false, firme:[]},
    {id:3, titolo:'Consegna piani di lavoro', tipo:'scadenza', data:g(6), ora:'', classi:'Docenti', num:'', desc:'Caricare i piani su Argo.', firma:false, urgente:true, firme:[]},
    {id:4, titolo:'Circ. 44 – Uscita didattica', tipo:'circolare', data:g(9), ora:'08:30', luogo:'Museo Civico', classi:'4A, 4B', num:'Circ. n. 44 – circolare44.pdf', desc:'Uscita delle classi quarte al museo.', firma:true, urgente:false, firme:[]},
    {id:5, titolo:'Open day', tipo:'evento', data:g(14), ora:'09:00', classi:'Tutti', num:'', desc:'Accoglienza delle famiglie, ore 9–13.', firma:false, urgente:false, firme:[]}
  ];
  salva();
}
function salva() {
  try { localStorage.setItem(K_EV, JSON.stringify(eventi)); localStorage.setItem(K_IM, JSON.stringify(imp)); localStorage.setItem(K_EMAIL, JSON.stringify(email)); localStorage.setItem(K_INBOX, JSON.stringify(inbox)); } catch(e) {}
}
const puoModificare = () => imp.ruolo === 'docente';
const firmato = e => !!imp.nome.trim() && e.firme.some(f => f.nome.toLowerCase() === imp.nome.trim().toLowerCase());

function rel(s) {
  const n = Math.round((new Date(s+'T12:00') - new Date(iso(new Date())+'T12:00')) / 864e5);
  if (n === 0) return 'oggi'; if (n === 1) return 'domani'; if (n === -1) return 'ieri';
  return n > 0 ? 'tra ' + n + ' giorni' : Math.abs(n) + ' giorni fa';
}
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }

/* ---------- Allegati (IndexedDB) ---------- */
const DB = () => new Promise((ok, ko) => {
  const r = indexedDB.open('planner_files', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('f');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => ko(r.error);
});
async function fPut(id, blob) {
  const db = await DB();
  return new Promise((ok, ko) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(blob, id); t.oncomplete = ok; t.onerror = () => ko(t.error); });
}
async function fGet(id) {
  const db = await DB();
  return new Promise((ok, ko) => { const q = db.transaction('f').objectStore('f').get(id); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
}
async function fDel(id) {
  const db = await DB();
  return new Promise((ok, ko) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').delete(id); t.oncomplete = ok; t.onerror = () => ko(t.error); });
}

/* ---------- Impostazioni applicate ---------- */
function applica() {
  const r = document.documentElement;
  if (imp.tema === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', imp.tema);
  r.style.setProperty('--ac', imp.colore);
  r.style.fontSize = imp.testo + '%';
  document.querySelector('meta[name=theme-color]').content = imp.colore;
}

/* ---------- Render ---------- */
function card(e) {
  const t = TIPI[e.tipo], ok = e.firma && firmato(e);
  return '<article class="card ev" data-id="' + e.id + '" style="--t:' + t.c + '">' +
    '<div class="evh"><span class="tag">' + t.n + '</span>' +
    (e.urgente ? '<span class="tag red">Urgente</span>' : '') +
    (e.file ? '<span class="tag">📄 Allegato</span>' : '') +
    (e.firma ? '<span class="tag ' + (ok ? 'grn' : 'amb') + '">' + (ok ? 'Firmata ✓' : 'Da firmare') + '</span>' : '') + '</div>' +
    '<h4>' + esc(e.titolo) + '</h4>' +
    '<p class="meta">' + fmt(e.data) + ' (' + rel(e.data) + ')' + (e.ora ? ' · ' + e.ora : '') + (e.luogo ? ' · 📍 ' + esc(e.luogo) : '') + (e.classi ? ' · ' + esc(e.classi) : '') + '</p></article>';
}
function collega(box) { box.querySelectorAll('.ev').forEach(c => c.onclick = () => dettaglio(+c.dataset.id)); }

function renderMese() {
  const y = vista.getFullYear(), m = vista.getMonth();
  $('meseTitolo').textContent = vista.toLocaleDateString('it-IT', {month:'long', year:'numeric'});
  const nomi = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  if (imp.sett == 0) nomi.unshift(nomi.pop());
  let h = nomi.map(n => '<span class="dw">' + n + '</span>').join('');
  const off = (new Date(y, m, 1).getDay() - imp.sett + 7) % 7, oggi = iso(new Date());
  const righe = Math.ceil((off + new Date(y, m+1, 0).getDate()) / 7);
  for (let i = 0; i < righe * 7; i++) {
    const d = new Date(y, m, 1 - off + i), s = iso(d);
    const ev = eventi.filter(e => e.data === s && attivo[e.tipo]);
    h += '<button class="d' + (d.getMonth() !== m ? ' out' : '') + (s === oggi ? ' today' : '') + (s === sel ? ' sel' : '') + '" data-d="' + s + '"><b>' + d.getDate() + '</b><i>' +
      ev.slice(0,3).map(e => '<u style="--t:' + TIPI[e.tipo].c + '"></u>').join('') + '</i></button>';
  }
  $('griglia').innerHTML = h;
  $('griglia').querySelectorAll('.d').forEach(b => b.onclick = () => { sel = b.dataset.d; renderMese(); });
  $('giornoTitolo').textContent = fmtLungo(sel);
  const lista = eventi.filter(e => e.data === sel && attivo[e.tipo]).sort(ordina);
  $('giornoLista').innerHTML = lista.length ? lista.map(card).join('') : '<p class="empty">Nessun impegno in questa giornata.</p>';
  collega($('giornoLista'));
}
function renderAgenda() {
  const q = $('cerca').value.toLowerCase(), oggi = iso(new Date()), tutti = $('passati').checked;
  const l = eventi.filter(e => (tutti || e.data >= oggi) && (e.titolo + e.desc + e.classi + e.num + ' ' + (e.luogo||'')).toLowerCase().includes(q)).sort(ordina);
  let h = '', ult = '';
  l.forEach(e => { if (e.data !== ult) { h += '<div class="date-h">' + fmtLungo(e.data) + '</div>'; ult = e.data; } h += card(e); });
  $('agendaLista').innerHTML = h || '<p class="empty">Nessun risultato.</p>';
  collega($('agendaLista'));
}
function renderFirme() {
  const ric = eventi.filter(e => e.firma), da = ric.filter(e => !firmato(e)).sort(ordina), fatte = ric.filter(firmato).sort(ordina);
  const pc = ric.length ? Math.round(fatte.length / ric.length * 100) : 100;
  $('progTxt').innerHTML = '<b>' + fatte.length + ' di ' + ric.length + '</b> prese visione firmate (' + pc + '%)';
  $('progBar').style.width = pc + '%';
  let h = '';
  if (imp.ruolo !== 'docente') h = '<p class="empty">Gli studenti non devono firmare le circolari.</p>';
  else if (!imp.nome.trim()) h = '<p class="empty">Inserisci il tuo nome in Impostazioni per poter firmare.</p>';
  else {
    h = '<h3 class="sec">Da firmare</h3>' + (da.length ? da.map(card).join('') : '<p class="empty">Tutto firmato 🎉</p>');
    if (fatte.length) h += '<h3 class="sec">Già firmate</h3>' + fatte.map(card).join('');
  }
  $('firmeLista').innerHTML = h;
  collega($('firmeLista'));
  const n = (imp.ruolo === 'docente' && imp.nome.trim()) ? da.length : 0;
  $('nBadge').textContent = n; $('nBadge').hidden = !n;
}
function renderImp() {
  $('impNome').textContent = imp.nome || '—';
  $('sRuolo').value = imp.ruolo; $('sTema').value = imp.tema;
  $('sSett').value = imp.sett; $('sTesto').value = imp.testo;
  $('sColori').innerHTML = COLORI.map(c => '<button title="' + c[0] + '" data-c="' + c[1] + '" style="--c:' + c[1] + '" class="' + (c[1] === imp.colore ? 'on' : '') + '"></button>').join('');
  $('sColori').querySelectorAll('button').forEach(b => b.onclick = () => { imp.colore = b.dataset.c; cambiaImp(); renderImp(); });
  $('eAddr').value = email.addr || '';
  $('eHost').value = email.host || '';
  $('ePort').value = email.port || '';
  $('eUser').value = email.user || '';
  $('ePwd').value = email.pwd || '';
  $('eMode').value = email.mode || 'demo';
  $('eProxy').value = email.proxy || '';
  $('eClientId').value = email.clientId || '';
  const md = email.mode || 'demo';
  $('boxProxy').hidden = md !== 'imap';
  $('boxClient').hidden = md !== 'gmail';
}
function tutto() {
  renderMese(); renderAgenda(); renderFirme();
  $('fab').style.display = puoModificare() ? '' : 'none';
}
function cambiaImp() { salva(); applica(); tutto(); }

/* ---------- Dettaglio e form ---------- */
function dettaglio(id) {
  const e = eventi.find(x => x.id === id); if (!e) return;
  const t = TIPI[e.tipo];
  $('dTit').textContent = e.titolo;
  let h = '<p class="meta">' + t.n + ' · ' + fmtLungo(e.data) + (e.ora ? ' · ore ' + e.ora : '') + ' (' + rel(e.data) + ')</p>';
  if (e.luogo) h += '<p>📍 ' + esc(e.luogo) + '</p>';
  if (e.classi) h += '<p>👥 ' + esc(e.classi) + '</p>';
  if (e.num) h += '<p>📎 ' + esc(e.num) + '</p>';
  if (e.file) h += '<p>📄 ' + esc(e.file.nome) + ' <span class="mu">(' + dim(e.file.size) + ')</span></p>';
  if (e.desc) h += '<p>' + esc(e.desc).replace(/\n/g, '<br>') + '</p>';
  if (e.firma) {
    h += '<h3>Prese visione (' + e.firme.length + ')</h3>';
    h += e.firme.length ? e.firme.map(f => '<div class="sig">✓ ' + esc(f.nome) + ' <span class="mu">– ' + new Date(f.ts).toLocaleString('it-IT') + '</span></div>').join('') : '<p class="empty">Ancora nessuna firma.</p>';
  }
  $('dBody').innerHTML = h;
  const a = $('dAzioni'); a.innerHTML = '';
  const btn = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = txt; b.onclick = fn; a.appendChild(b); };
  if (e.file) btn('📄 Apri allegato', 'pr', async () => {
    const w = window.open('', '_blank');
    const b = await fGet(e.id);
    if (!b) { if (w) w.close(); toast('Allegato non trovato'); return; }
    const u = URL.createObjectURL(b);
    if (w) w.location = u;
    else { const l = document.createElement('a'); l.href = u; l.download = e.file.nome; l.click(); }
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  });
  if (e.firma && puoModificare()) {
    if (firmato(e)) btn('Togli la mia firma', '', () => { e.firme = e.firme.filter(f => f.nome.toLowerCase() !== imp.nome.trim().toLowerCase()); salva(); tutto(); dettaglio(id); toast('Firma rimossa'); });
    else btn('✍️ Firma presa visione', 'pr', () => {
      if (!imp.nome.trim()) { toast('Inserisci il nome in Impostazioni'); return; }
      e.firme.push({nome: imp.nome.trim(), ts: Date.now()}); salva(); tutto(); dettaglio(id); toast('Firmato ✓');
    });
  }
  if (puoModificare()) {
    btn('Modifica', '', () => { $('dlgDet').close(); apriForm(e); });
    btn('Elimina', 'danger', () => { if (confirm('Eliminare “' + e.titolo + '”?')) { fDel(id).catch(() => {}); eventi = eventi.filter(x => x.id !== id); salva(); $('dlgDet').close(); tutto(); toast('Eliminato'); } });
  }
  btn('Chiudi', '', () => $('dlgDet').close());
  if (!$('dlgDet').open) $('dlgDet').showModal();
}
function apriForm(e) {
  editId = e ? e.id : null;
  $('formTitolo').textContent = e ? 'Modifica elemento' : 'Nuovo elemento';
  $('fTit').value = e ? e.titolo : ''; $('fTipo').value = e ? e.tipo : 'circolare';
  $('fData').value = e ? e.data : sel; $('fOra').value = e ? e.ora : '';
  $('fLuogo').value = e ? (e.luogo || '') : '';
  $('fClassi').value = e ? e.classi : ''; $('fNum').value = e ? e.num : '';
  $('fDesc').value = e ? e.desc : ''; $('fFirma').checked = e ? e.firma : false; $('fUrg').checked = e ? e.urgente : false;
  $('fFile').value = ''; $('fRimuovi').checked = false;
  $('fRimBox').hidden = !(e && e.file);
  $('fFileInfo').textContent = e && e.file ? e.file.nome : '';
  aggiornaAutoFillInfo();
  $('dlgForm').showModal();
}
function aggiornaAutoFillInfo() {
  $('fAutoFillInfo').hidden = $('fTipo').value !== 'circolare';
}
$('fSalva').onclick = async () => {
  const t = $('fTit').value.trim(), d = $('fData').value;
  if (!t || !d) { toast('Titolo e data sono obbligatori'); return; }
  const f = $('fFile').files[0];
  if (f && f.size > 10 * 1024 * 1024) { toast('File troppo grande (max 10 MB)'); return; }
  const dati = {titolo:t, tipo:$('fTipo').value, data:d, ora:$('fOra').value, luogo:$('fLuogo').value.trim(), classi:$('fClassi').value.trim(), num:$('fNum').value.trim(), desc:$('fDesc').value.trim(), firma:$('fFirma').checked, urgente:$('fUrg').checked};
  let ev;
  if (editId) { ev = eventi.find(x => x.id === editId); Object.assign(ev, dati); }
  else { ev = {id: Date.now(), firme: [], ...dati}; eventi.push(ev); }
  try {
    if (f) { await fPut(ev.id, f); ev.file = {nome: f.name, tipo: f.type, size: f.size}; }
    else if ($('fRimuovi').checked && ev.file) { await fDel(ev.id); delete ev.file; }
  } catch (err) { toast('Impossibile salvare l’allegato'); }
  salva(); $('dlgForm').close(); sel = d; vista = new Date(d + 'T12:00'); tutto(); toast('Salvato');
};
$('fAnnulla').onclick = () => $('dlgForm').close();

/* ---------- Navigazione ---------- */
const TITOLI = {mese:'Calendario', agenda:'Agenda', firme:'Firme', impost:'Impostazioni'};
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + b.dataset.v));
  $('hTitolo').textContent = TITOLI[b.dataset.v];
  $('btnOggi').style.visibility = b.dataset.v === 'mese' ? 'visible' : 'hidden';
  if (b.dataset.v === 'impost') renderImp();
  window.scrollTo(0, 0);
});
$('prev').onclick = () => { vista = new Date(vista.getFullYear(), vista.getMonth()-1, 1); renderMese(); };
$('next').onclick = () => { vista = new Date(vista.getFullYear(), vista.getMonth()+1, 1); renderMese(); };
$('btnOggi').onclick = () => { vista = new Date(); sel = iso(vista); renderMese(); };
$('fab').onclick = () => apriForm();
$('cerca').oninput = renderAgenda; $('passati').onchange = renderAgenda;
$('filtri').innerHTML = Object.keys(TIPI).map(k => '<label><input type="checkbox" data-k="' + k + '" checked><span style="color:' + TIPI[k].c + '">●</span> ' + TIPI[k].n + '</label>').join('');
$('filtri').onchange = e => { attivo[e.target.dataset.k] = e.target.checked ? 1 : 0; renderMese(); };

/* ---------- Impostazioni: eventi ---------- */
$('sRuolo').onchange = e => { imp.ruolo = e.target.value; cambiaImp(); };
$('sTema').onchange = e => { imp.tema = e.target.value; cambiaImp(); };
$('sSett').onchange = e => { imp.sett = +e.target.value; cambiaImp(); };
$('sTesto').onchange = e => { imp.testo = e.target.value; cambiaImp(); };
$('eMode').onchange = e => { const v = e.target.value; $('boxProxy').hidden = v !== 'imap'; $('boxClient').hidden = v !== 'gmail'; };
$('btnSalvaEmail').onclick = () => {
  email.addr = $('eAddr').value.trim();
  email.host = $('eHost').value.trim() || 'imap.gmail.com';
  email.port = +$('ePort').value || 993;
  email.user = $('eUser').value.trim() || email.addr;
  email.pwd = $('ePwd').value;
  email.mode = $('eMode').value;
  email.proxy = $('eProxy').value.trim();
  email.clientId = $('eClientId').value.trim();
  salva(); toast('Account email salvato');
};
$('btnControllaPosta').onclick = () => { if (!puoModificare()) { toast('Solo i docenti possono inserire eventi'); return; } apriPosta(); };
$('btnPosta').onclick = () => { if (!puoModificare()) { toast('Solo i docenti possono inserire eventi'); return; } apriPosta(); };
$('btnLogout').onclick = () => { if (confirm('Vuoi uscire dall’account?')) doLogout(); };

function scarica(testo, nome, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([testo], {type: tipo}));
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('btnIcs').onclick = () => {
  const x = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Belluzzi da Vinci//School Planner//IT'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  eventi.forEach(e => {
    const d = e.data.replace(/-/g, '');
    r.push('BEGIN:VEVENT', 'UID:' + e.id + '@schoolplanner', 'DTSTAMP:' + stamp,
      e.ora ? 'DTSTART:' + d + 'T' + e.ora.replace(':', '') + '00' : 'DTSTART;VALUE=DATE:' + d,
      'SUMMARY:' + x(e.titolo),
      ...(e.luogo ? ['LOCATION:' + x(e.luogo)] : []),
      'DESCRIPTION:' + x((e.luogo ? 'Luogo: ' + e.luogo + ' – ' : '') + (e.classi ? e.classi + ' – ' : '') + e.desc), 'END:VEVENT');
  });
  r.push('END:VCALENDAR');
  scarica(r.join('\r\n'), 'calendario-scuola.ics', 'text/calendar'); toast('File .ics creato');
};
$('btnBackup').onclick = () => { scarica(JSON.stringify({eventi, imp, email, inbox}, null, 2), 'backup-planner.json', 'application/json'); toast('Backup salvato'); };
$('btnImporta').onclick = () => $('fileImporta').click();
$('fileImporta').onchange = ev => {
  const f = ev.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const o = JSON.parse(rd.result);
      if (!Array.isArray(o.eventi)) throw 0;
      eventi = o.eventi; if (o.imp) imp = {...imp, ...o.imp};
      if (o.email) email = {...email, ...o.email};
      if (Array.isArray(o.inbox)) inbox = o.inbox;
      salva(); applica(); renderImp(); tutto(); toast('Backup ripristinato');
    } catch(e) { toast('File non valido'); }
  };
  rd.readAsText(f);
};
$('btnReset').onclick = () => {
  if (confirm('Cancellare tutti i dati, le impostazioni e l’account?')) {
    try { localStorage.removeItem(K_EV); localStorage.removeItem(K_IM); localStorage.removeItem(K_AUTH); localStorage.removeItem(K_SESSIONE); localStorage.removeItem(K_EMAIL); localStorage.removeItem(K_INBOX); } catch(e) {}
    indexedDB.deleteDatabase('planner_files');
    location.reload();
  }
};

/* ---------- Avvio ---------- */
carica(); applica(); renderImp();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
avvio();

/* ===== Schermata di accesso (login / registrazione) ===== */
async function hashPwd(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function getAuth() { try { return JSON.parse(localStorage.getItem(K_AUTH)); } catch(e) { return null; } }
function getSessione() { try { return JSON.parse(localStorage.getItem(K_SESSIONE)); } catch(e) { return null; } }
function setSessione(nome) { localStorage.setItem(K_SESSIONE, JSON.stringify({nome, ts: Date.now()})); }

function avvio() {
  const auth = getAuth();
  if (!auth) { mostraRegistra(); return; }
  if (!getSessione()) { mostraLogin(); return; }
  entra();
}
function entra() {
  const auth = getAuth();
  imp.nome = auth ? auth.nome : '';
  salva();
  $('loginOverlay').hidden = true;
  $('appRoot').hidden = false;
  tutto();
  aggiornaMailBadge();
}
function mostraLogin() {
  $('loginTitolo').textContent = 'Bentornato';
  $('loginSub').textContent = 'Inserisci nome e password per accedere';
  $('loginForm').hidden = false; $('regForm').hidden = true;
  const auth = getAuth();
  if (auth) { $('lNome').value = auth.nome; }
  $('loginOverlay').hidden = false; $('appRoot').hidden = true;
  setTimeout(() => $('lPwd').focus(), 50);
}
function mostraRegistra() {
  $('loginTitolo').textContent = 'Crea il tuo account';
  $('loginSub').textContent = 'Scegli un nome e una password per proteggere l’accesso';
  $('loginForm').hidden = true; $('regForm').hidden = false;
  $('loginOverlay').hidden = false; $('appRoot').hidden = true;
  setTimeout(() => $('rNome').focus(), 50);
}
$('btnVaiRegistra').onclick = mostraRegistra;
$('btnVaiLogin').onclick = mostraLogin;
$('btnLogin').onclick = async () => {
  const n = $('lNome').value.trim(), p = $('lPwd').value;
  const auth = getAuth();
  if (!auth) { toast('Nessun account trovato: creane uno'); mostraRegistra(); return; }
  if (!n || !p) { toast('Inserisci nome e password'); return; }
  if (n.toLowerCase() !== auth.nome.toLowerCase()) { toast('Nome utente errato'); return; }
  if (await hashPwd(p) !== auth.hash) { toast('Password errata'); return; }
  setSessione(auth.nome); $('lPwd').value = ''; entra(); toast('Accesso effettuato');
};
$('btnRegistra').onclick = async () => {
  const n = $('rNome').value.trim(), p1 = $('rPwd').value, p2 = $('rPwd2').value;
  if (!n) { toast('Inserisci il nome'); return; }
  if (p1.length < 4) { toast('Password troppo corta (min 4 caratteri)'); return; }
  if (p1 !== p2) { toast('Le password non coincidono'); return; }
  const hash = await hashPwd(p1);
  localStorage.setItem(K_AUTH, JSON.stringify({nome:n, hash, ts: Date.now()}));
  setSessione(n);
  $('rPwd').value = ''; $('rPwd2').value = '';
  entra(); toast('Account creato ✓');
};
function doLogout() {
  localStorage.removeItem(K_SESSIONE);
  $('lPwd').value = '';
  mostraLogin();
  toast('Sei uscito dall’account');
}

/* ===== Lettura circolare (PDF.js) + parsing ===== */
let pdfjsPronto = false;
function loadPdfJs() {
  if (pdfjsPronto && window.pdfjsLib) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfjsPronto = true; res();
      } catch(e) { rej(e); }
    };
    s.onerror = () => rej(new Error('pdf.js non caricato'));
    document.head.appendChild(s);
  });
}
async function estraiTestoPdf(file) {
  await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({data: buf}).promise;
  let txt = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    let lastY = null;
    // Ricostruisce i ritorni a capo usando la posizione Y di ogni elemento
    c.items.forEach(it => {
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) txt += '\n';
      txt += (it.str || '') + ' ';
      lastY = y;
    });
    txt += '\n';
  }
  return txt;
}

/* ===== OCR delle immagini con Tesseract.js (modello italiano) ===== */
let tesseractPronto = false;
function loadTesseract() {
  if (tesseractPronto && window.Tesseract) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => { tesseractPronto = true; res(); };
    s.onerror = () => rej(new Error('tesseract.js non caricato'));
    document.head.appendChild(s);
  });
}
/* Riconosce il testo dentro un'immagine (foto di una circolare, scansione, …).
   Al primo uso scarica worker + core + modello italiano (≈ 14 MB totali,
   poi restano in cache del browser). `onProgress` riceve 0..1 per una barra. */
async function ocrImmagine(file, onProgress) {
  await loadTesseract();
  const r = await window.Tesseract.recognize(file, 'ita', {
    logger: m => { if (m && typeof m.progress === 'number' && onProgress) onProgress(m.progress, m.status); }
  });
  return (r && r.data && r.data.text) || '';
}

const MESI_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function dataItToIso(gg, mmNome, aaaa) {
  const mm = MESI_IT.indexOf(mmNome.toLowerCase()) + 1;
  if (!mm) return null;
  const y = aaaa || new Date().getFullYear();
  return `${y}-${String(mm).padStart(2,'0')}-${String(gg).padStart(2,'0')}`;
}
/* Parser usato sia per le circolari (PDF) sia per le email: estrae
   numero, data, ora, classi, titolo, descrizione, urgenza, firma. */
function parseTesto(testo, oggetto) {
  const t0 = (oggetto ? oggetto + '\n' : '') + (testo || '');
  const r = {titolo:'', num:'', data:'', ora:'', classi:'', luogo:'', desc:'', urgente:false, firma:false, tipo:'circolare'};
  if (!t0.trim()) return r;

  // Righe ripulite (senza righe vuote), conservate sia come array che unite
  const righe0 = t0.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
  const t = righe0.join('\n');
  const MESI_RX = '(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)';
  const GIORNI_RX = '(?:lunedì|luned[i]|martedì|marted[i]|mercoledì|mercoled[i]|giovedì|gioved[i]|venerdì|venerd[i]|sabato|domenica)';

  /* --- Numero di circolare / protocollo --- */
  let m = t.match(/circ(?:olare)?\.?\s*n\.?\s*(\d{1,4}(?:\/\d{2,4})?)/i)
       || t.match(/\bn\.?\s*(\d{1,4}(?:\/\d{2,4})?)\s*(?:del|di|–|-|\/)/i)
       || t.match(/\bcircolare\s+(\d{1,4}(?:\/\d{2,4})?)\b/i)
       || t.match(/\bprot(?:ocollo)?\.?\s*(?:n\.?)?\s*(\d{1,5})/i);
  if (m) r.num = 'Circ. n. ' + m[1];

  /* --- Data --- */
  const RE_DATA_LUNGO = new RegExp(
    GIORNI_RX + '?\\s*\\b(\\d{1,2})\\s+' + MESI_RX + '(?:\\s+(\\d{4}))?\\b', 'i');
  function dataDaLungo(md) {
    const mm = MESI_IT.indexOf(md[2].toLowerCase()) + 1;
    if (!mm) return null;
    const y = md[3] ? +md[3] : new Date().getFullYear();
    return `${y}-${String(mm).padStart(2,'0')}-${String(+md[1]).padStart(2,'0')}`;
  }
  function dataDaNum(mdn) {
    let gg = +mdn[1], mm = +mdn[2]; let aaaa = mdn[3];
    if (aaaa.length === 2) aaaa = '20' + aaaa;
    if (mm > 12 && gg <= 12) { const tmp = gg; gg = mm; mm = tmp; } // formato americano → scambia
    if (gg < 1 || gg > 31 || mm < 1 || mm > 12) return null;
    return `${aaaa}-${String(mm).padStart(2,'0')}-${String(gg).padStart(2,'0')}`;
  }
  function estraiDataPresso(pattern) {
    const re = new RegExp(pattern, 'i');
    const pos = t.search(re);
    if (pos < 0) return null;
    const sott = t.slice(pos, pos + 280);
    let md = sott.match(RE_DATA_LUNGO);
    if (md) return dataDaLungo(md);
    md = sott.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if (md) return dataDaNum(md);
    return null;
  }
  r.data = estraiDataPresso('in\\s+data|il\\s+giorno|si\\s+ter[raà]|si\\s+svolger|avver[raà]|ritrovo|fissat[oa]\\s+(?:per|il)|data\\s*:')
        || estraiDataPresso('collegio\\s+docenti|consiglio|riunione|uscita\\s+didattica|scadenza|consegna|assemblea|viaggio|ritrovo');
  if (!r.data) {
    // fallback: prima data lunga NON preceduta da "del" (data di emissione)
    const re = new RegExp(RE_DATA_LUNGO, 'gi');
    let mt, last = null;
    while ((mt = re.exec(t)) !== null) {
      const prima = t.slice(Math.max(0, mt.index - 12), mt.index);
      if (!/\bdel\b/i.test(prima) && !/protocollo|prot\./i.test(prima)) { last = mt; break; }
    }
    if (last) r.data = dataDaLungo(last);
  }
  if (!r.data) {
    const mdn = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if (mdn) r.data = dataDaNum(mdn);
  }

  /* --- Ora --- */
  m = t.match(/(?:ore\s+|h\.?\s*|alle\s+ore\s+|alle\s+)(\d{1,2})[:h\.](\d{2})\b/i)
   || t.match(/(?:ore|h\.?|alle)\s*(\d{1,2})[:\.,](\d{2})\b/i)
   || t.match(/(?:ore|h\.?|alle)\s+(\d{1,2})\b(?!\s*(?:\/|e\s|classi|docenti|studenti|alunni))/i);
  if (m) {
    const h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h >= 0 && h <= 23 && mi <= 59) r.ora = `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
  }

  /* --- Classi / destinatari --- */
  const classi = [...t.matchAll(/\b([1-5][A-I])\b/g)].map(x => x[1]);
  if (classi.length) r.classi = [...new Set(classi)].join(', ');
  if (!r.classi && /\btutte\s+le\s+classi\b/i.test(t)) r.classi = 'Tutte';
  else if (!r.classi && /\btutti\s+(?:i\s+)?docenti\b/i.test(t)) r.classi = 'Docenti';
  else if (!r.classi && /\bconsiglio\s+di\s+(?:classe|istituto|interclasse)\b/i.test(t)) r.classi = 'Docenti';

  /* --- Luogo --- */
  const mLuogo = t.match(/\b(?:in|presso|all['']|al|alla|nel|nella|nello|dal|dalla|dello)\s+(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|l['']\s*)?(aula\s+magna|aula\s+(?:\d+[A-F]?|professori|docenti|insegnanti)|sala\s+(?:docenti|magna|riunioni|consigli)|palestra|auditorium|biblioteca|teatro|laboratorio(?:\s+\w+)?|museo(?:\s+civico)?|ingresso\s+principale|giardino(?:\s+\w+)?|cortile)\b/i);
  r.luogo = mLuogo ? mLuogo[1].replace(/\s+/g,' ').trim() : '';
  if (!r.luogo) {
    const m2 = t.match(/\b(aula\s+magna|sala\s+docenti|aula\s+(?:\d+[A-F]?|professori)|palestra|auditorium|biblioteca|museo(?:\s+civico)?)\b/i);
    if (m2) r.luogo = m2[1];
  }

  /* --- Titolo: oggetto passato → riga "Oggetto:" → frase-chiave evento → prima riga utile --- */
  function estraiTitolo() {
    if (oggetto && oggetto.trim()) return oggetto.trim().replace(/\s+/g,' ').slice(0, 100);
    const mOgg = t.match(/oggetto\s*:\s*([^\n]+)/i);
    if (mOgg) return mOgg[1].replace(/^[\s"'«»]+|[\s"'«»]+$/g,'').replace(/\s+/g,' ').trim().slice(0, 100);
    const HEADER = /^(?:istituto|scuola|circ(?:olare)?\.?|prot\.?|protocollo|anno\s+scolastico|seduta|deliber|p\.?\s*c\.?|via\s+|viale|p\.?za|piazza|sig\.?|spett\.?[a-z]?|alla\s+attenzione|sezione|cf\.?|codice\s+fiscale|partita\s+iva|prot)/i;
    const FIRMA = /^(?:il\s+dirigente|il\s+preside|la\s+segreteria|il\s+consiglio|cordiali|distinti|a\s+presto|un\s+saluto|la\s+dirigente)/i;
    // Frasi-chiave di evento da usare come titolo quando manca "Oggetto:"
    const EV = /\b(collegio\s+docenti|consiglio\s+di\s+(?:classe|istituto|interclasse)|consiglio\s+d['ei]\s+classe|riunione(?:\s+dei\s+docenti)?|assemblea(?:\s+d['ei]\s+(?:istituto|classe))?|uscita\s+didattica|visita\s+d[ei']?\s+istruzione|scadenza|consegna(?:\s+dei\s+piani)?|scrutinio|recupero|sportello|open\s+day|festa\s+(?:della|maturita)|viaggio\s+di\s+istruzione|stage|tirocinio)\b/i;
    // 1) prima riga con frase-chiave di evento → usa la frase
    for (const l of righe0) {
      const s = l.replace(/\s+/g,' ').trim();
      if (!s || HEADER.test(s)) continue;
      const k = s.match(EV);
      if (k) {
        let ph = k[0].replace(/^\w/, c => c.toUpperCase());
        return ph.slice(0, 100);
      }
    }
    // 2) prima riga utile non-intestazione e non-firma (limiti ampi, tronca a 100)
    for (const l of righe0) {
      const s = l.replace(/\s+/g,' ').trim();
      if (!s || s.length < 8) continue;
      if (HEADER.test(s)) continue;
      if (FIRMA.test(s)) continue;
      if (/^\d+[\.,;:\-]?\s*$/.test(s)) continue;        // solo numeri/protocollo
      if (/^del\s+\d/i.test(s)) continue;                 // "del 10 dicembre …"
      if (/^(lunedì|luned[i]|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b/i.test(s) && !EV.test(s)) continue;
      if (/\bore\s+\d/.test(s) && s.length < 30) continue; // riga tipo "ore 15:00"
      return s.slice(0, 100);
    }
    return '';
  }
  r.titolo = estraiTitolo();

  /* --- Descrizione: corpo vero, saltando l'intestazione e i saluti finali --- */
  function estraiDescrizione() {
    let startIdx = -1;
    for (let i = 0; i < righe0.length; i++) {
      if (/^oggetto\s*:/i.test(righe0[i])) { startIdx = i + 1; break; }
    }
    let corpo;
    if (startIdx >= 0) {
      corpo = righe0.slice(startIdx).join(' ');
    } else {
      const APER = /^(si\s+comunica|si\s+informa|si\s+ricorda|con\s+la\s+presente|la\s+presente|il\s+presente|si\s+avvisa|si\s+invita|si\s+rend|la\s+scuola|il\s+consiglio|il\s+dirigente)/i;
      for (let i = 0; i < righe0.length; i++) {
        if (APER.test(righe0[i])) { startIdx = i; break; }
      }
      corpo = startIdx >= 0 ? righe0.slice(startIdx).join(' ') : righe0.join(' ');
    }
    corpo = corpo.replace(/\s+/g, ' ').trim();
    corpo = corpo.replace(/\s*(?:cordiali?\s+saluti|distinti?\s+saluti|a\s+presto|la\s+segreteria|il\s+dirigente\s+scolastico|il\s+dirigente)\b.*$/i, '').trim();
    if (!corpo) corpo = (testo || '').replace(/\s+/g,' ').trim();
    return corpo.slice(0, 500);
  }
  r.desc = estraiDescrizione();

  /* --- Urgenza / firma / tipo --- */
  r.urgente = /urg(?:en[zt]e?|enza)|immediat|entro\s+oggi|massima\s+urgenza|con\s+la\s+massima|come\s+precedenza/i.test(t);
  r.firma = /pres[ae]\s+visione|firmare|sottoscriv|per\s+(?:presa\s+visione|conoscenza|adempimento)|presa\s+visione/i.test(t);
  r.tipo = /riunione|collegio\s+docenti|consiglio\s+di\s+(?:classe|istituto|interclasse)|consiglio\s+d['ei]\s+classe/i.test(t) ? 'riunione'
      : /scadenza|consegna|entro\s+il|termine|ultim[oa]\s+(?:giorn|settiman)/i.test(t) ? 'scadenza'
      : /uscita\s+didattica|gita|open\s+day|festa|assemblea|viaggio|visita\s+d[ei]?\s+istruzione/i.test(t) ? 'evento'
      : 'circolare';
  return r;
}

/* Quando cambia il tipo nel form, mostra/nascondi l’aiuto */
$('fTipo').onchange = aggiornaAutoFillInfo;

/* Quando si sceglie un file (e tipo = circolare) si leggono i campi:
   PDF → estrazione testo con PDF.js; immagine → OCR con Tesseract.js */
$('fFile').onchange = async () => {
  const f = $('fFile').files[0];
  if (!f) return;
  // Mostra sempre il suggerimento per le circolari
  aggiornaAutoFillInfo();
  if ($('fTipo').value !== 'circolare') {
    toast('Imposta il tipo “Circolare” per leggere il file');
    return;
  }
  const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const isImg = /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(f.name);
  if (!isPdf && !isImg) { toast('Formato non supportato: usa PDF o immagine'); return; }
  if (isPdf) {
    toast('Lettura della circolare in corso…');
  } else {
    toast('OCR dell’immagine in corso (prima volta ≈ 14 MB da scaricare)…');
  }
  let txt = '';
  try {
    if (isPdf) txt = await estraiTestoPdf(f);
    else txt = await ocrImmagine(f, p => { /* potremmo aggiornare una barra qui */ });
  } catch (e) {
    toast(isImg ? 'OCR non riuscito (serve connessione per la libreria)' : 'Impossibile leggere il PDF (serve connessione per la libreria)');
    return;
  }
  if (!txt || !txt.trim()) {
    toast(isImg ? 'Nessun testo riconosciuto nell’immagine (prova una foto più nitida)' : 'PDF senza testo estraibile');
    return;
  }
  const p = parseTesto(txt, $('fTit').value.trim() || '');
  compilaForm(p, ['fTit','fTipo','fData','fOra','fLuogo','fClassi','fNum','fDesc','fFirma','fUrg']);
  toast(isImg ? 'Campi compilati dall’immagine (OCR) ✓' : 'Campi compilati dalla circolare ✓');
};
/* Compila i campi del form solo se vuoti (o se hanno il valore di default),
   e li evidenzia per indicare che sono stati compilati automaticamente */
function compilaForm(p, campi) {
  const m = {
    fTit: ['titolo', 'value'], fTipo: ['tipo', 'value'],
    fData: ['data', 'value'], fOra: ['ora', 'value'],
    fLuogo: ['luogo', 'value'], fClassi: ['classi', 'value'], fNum: ['num', 'value'],
    fDesc: ['desc', 'value'],
    fFirma: ['firma', 'checked'], fUrg: ['urgente', 'checked']
  };
  campi.forEach(id => {
    if (!m[id]) return;
    const [k, prop] = m[id];
    const el = $(id);
    if (prop === 'checked') { if (p[k]) { el.checked = true; el.classList.add('autofilled'); } }
    else {
      // Considera "vuoto" anche il valore di default (es. data = sel = oggi)
      const isDefault = (id === 'fData' && el.value === sel) || (id === 'fOra' && !el.value);
      if (p[k] && (!el.value.trim() || isDefault)) { el.value = p[k]; el.classList.add('autofilled'); }
    }
  });
  aggiornaAutoFillInfo();
}

/* ===== Integrazione email ===== */
const gOffset = n => { const d = new Date(); d.setDate(d.getDate()+n); return iso(d); };
function inboxDemoSeed() {
  if (inbox.length) return inbox;
  const oggi = new Date();
  const g = n => { const d = new Date(oggi); d.setDate(oggi.getDate()+n); return iso(d); };
  return [
    {id:'demo1', da:'segreteria@belluzzi.edu', oggetto:'Circolare n. 52 – Collegio docenti', corpo:'Si comunica che il collegio docenti si terrà il ' + fmtLungo(g(2)) + ' alle ore 15:00 in aula magna. Tutti i docenti sono tenuti a prendere visione. Cordiali saluti, la segreteria.'},
    {id:'demo2', da:'dirigente@belluzzi.edu', oggetto:'Uscita didattica classi 3A e 3B', corpo:'Si informano le classi 3A e 3B che il ' + fmtLungo(g(5)) + ' si terrà un’uscita didattica al Museo Civico. Ritrovo alle ore 8:30. Urge la firma per presa visione.'},
    {id:'demo3', da:'segreteria@belluzzi.edu', oggetto:'Scadenza consegna piani di lavoro', corpo:'Si ricorda ai docenti che la scadenza per la consegna dei piani di lavoro su Argo è fissata per il ' + fmtLungo(g(7)) + '. L’adempimento è urgente.'}
  ];
}
/* ===== Gmail API (OAuth + lettura messaggi reali) ===== */
function loadGis() {
  return new Promise((res, rej) => {
    if (window.google && google.accounts && google.accounts.oauth2) return res();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Google Identity Services non caricato (serve connessione)'));
    document.head.appendChild(s);
  });
}
/* Apre il popup OAuth di Google e restituisce un access token (scope sola lettura Gmail). */
async function connettiGmail() {
  if (!email.clientId) throw new Error('Client ID OAuth non impostato in Impostazioni');
  await loadGis();
  return new Promise((resolve, reject) => {
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: email.clientId,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      callback: resp => {
        if (resp && resp.access_token) resolve(resp.access_token);
        else reject(new Error('autorizzazione negata o non concessa'));
      },
      error_callback: err => reject(new Error(err && err.message ? err.message : 'accesso Gmail annullato'))
    });
    tc.requestAccessToken({ prompt: 'consent' });
  });
}
/* Decodifica base64url UTF-8 usato da Gmail per i corpi messaggio. */
function decB64Url(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  // Converte UTF-8 → stringa JS gestendo correttamente gli accenti
  try { return decodeURIComponent(escape(bin)); }
  catch (e) { return bin; }
}
/* Estrae il corpo (preferendo text/plain) dal payload MIME di Gmail. */
function estraiCorpoGmail(payload) {
  if (!payload) return '';
  let plain = '', html = '';
  function walk(p) {
    if (!p) return;
    if (!plain && p.mimeType === 'text/plain' && p.body && p.body.data) plain = decB64Url(p.body.data);
    if (!html && p.mimeType === 'text/html' && p.body && p.body.data) html = decB64Url(p.body.data);
    if (p.parts) p.parts.forEach(walk);
  }
  walk(payload);
  if (plain) return plain;
  if (html) return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                       .replace(/<[^>]+>/g, ' ')
                       .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
                       .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  return '';
}
/* Scarica le email non lette della casella Gmail e le restituisce nel formato inbox. */
async function fetchGmailInbox(token) {
  const H = { 'Authorization': 'Bearer ' + token };
  const list = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread%20in%3Ainbox&maxResults=15', { headers: H })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Gmail list ' + r.status)));
  if (!list.messages || !list.messages.length) return [];
  const out = [];
  for (const msg of list.messages) {
    const full = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msg.id + '?format=full&metadataHeaders=From&metadataHeaders=Subject', { headers: H })
      .then(r => r.ok ? r.json() : null);
    if (!full) continue;
    const hs = (full.payload && full.payload.headers) || [];
    const from = (hs.find(h => h.name.toLowerCase() === 'from') || {}).value || '';
    const subj = (hs.find(h => h.name.toLowerCase() === 'subject') || {}).value || '';
    const corpo = estraiCorpoGmail(full.payload);
    out.push({ id:'g' + msg.id, da:from, oggetto:subj, corpo });
  }
  return out;
}

async function apriPosta() {
  if (!puoModificare()) { toast('Solo i docenti possono inserire eventi'); return; }
  if (email.mode === 'gmail') {
    if (!email.clientId) { toast('Imposta il Client ID OAuth Gmail in Impostazioni'); return; }
    $('dlgPosta').showModal();
    $('postaStato').textContent = 'Connessione a Gmail… si aprirà una finestra di autorizzazione.';
    $('postaLista').innerHTML = '';
    try {
      const token = await connettiGmail();
      $('postaStato').textContent = 'Lettura delle email in corso…';
      const msgs = await fetchGmailInbox(token);
      // conserva le email già elaborate (eventi già creati), sostituisce il resto
      const elaborate = inbox.filter(m => m.elaborata);
      inbox = [...msgs, ...elaborate];
      if (!inbox.length) { inbox = inboxDemoSeed(); toast('Nessuna email non letta: mostro la posta demo.'); }
      salva();
    } catch (e) {
      $('postaStato').textContent = 'Gmail non connesso: ' + e.message + '. Puoi usare la posta Demo.';
      if (!inbox.length) { inbox = inboxDemoSeed(); salva(); }
    }
    renderPosta();
    return;
  }
  if (!email.addr && email.mode === 'demo') {
    toast('Modalità demo: configura un indirizzo in Impostazioni per personalizzare');
  }
  $('dlgPosta').showModal();
  $('postaStato').textContent = 'Carico…';
  $('postaLista').innerHTML = '';
  if (email.mode === 'imap' && email.proxy) {
    try {
      const r = await fetch(email.proxy, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({host: email.host, port: +email.port, user: email.user, pwd: email.pwd, da: email.addr})
      });
      if (!r.ok) throw new Error('proxy ' + r.status);
      const list = await r.json();
      const elaborate = inbox.filter(m => m.elaborata);
      inbox = [...list.map((m, i) => ({id:'p'+Date.now()+i, da:m.da||'', oggetto:m.oggetto||'', corpo:m.corpo||''})), ...elaborate];
      salva();
    } catch (e) {
      $('postaStato').textContent = 'Connessione IMAP non riuscita (' + e.message + '). Uso la posta demo locale.';
    }
  }
  if (!inbox.length) { inbox = inboxDemoSeed(); salva(); }
  renderPosta();
}
function renderPosta() {
  const nonProc = inbox.filter(m => !m.elaborata);
  const proc = inbox.filter(m => m.elaborata);
  $('postaStato').textContent = inbox.length ? (nonProc.length + ' da leggere · ' + proc.length + ' già trasformate in eventi') : 'Nessuna email. Usa “Incolla email” per aggiungerne una.';
  $('mailBadge').textContent = nonprocBadge(nonProc.length); $('mailBadge').hidden = !nonProc.length;
  let h = '';
  nonProc.forEach(m => h += mailItemHtml(m, false));
  if (proc.length) {
    h += '<h3 class="sec">Già elaborate</h3>';
    proc.slice(-5).forEach(m => h += mailItemHtml(m, true));
  }
  $('postaLista').innerHTML = h || '<p class="empty">Posta in arrivo vuota.</p>';
  $('postaLista').querySelectorAll('.mail-item').forEach(b => b.onclick = () => proponiDaEmail(+b.dataset.i));
}
function nonprocBadge(n) { return String(n); }
function mailItemHtml(m, elab) {
  const i = inbox.indexOf(m);
  const ant = (m.corpo || '').replace(/\s+/g,' ').slice(0, 140);
  return '<button class="mail-item' + (elab ? ' processata' : '') + '" data-i="' + i + '">' +
    '<p class="ml-meta">Da: ' + esc(m.da || '—') + '</p>' +
    '<p class="ml-oggetto">' + esc(m.oggetto || '(senza oggetto)') + '</p>' +
    '<p class="ml-ante">' + esc(ant) + (m.corpo && m.corpo.length > 140 ? '…' : '') + '</p>' +
    (elab ? '<p class="ml-meta">✓ evento creato</p>' : '') +
  '</button>';
}
function proponiDaEmail(i) {
  const m = inbox[i]; if (!m) return;
  const p = parseTesto(m.corpo || '', m.oggetto || '');
  eventoProposto = {origine:'email', idx:i, mittente:m.da};
  $('cTit').value = p.titolo || m.oggetto || '';
  $('cTipo').value = p.tipo || 'circolare';
  $('cData').value = p.data || iso(new Date());
  $('cOra').value = p.ora || '';
  $('cLuogo').value = p.luogo || '';
  $('cClassi').value = p.classi || '';
  $('cNum').value = p.num || '';
  $('cDesc').value = (p.desc || (m.corpo || '').slice(0,500)).slice(0, 500);
  $('cFirma').checked = !!p.firma;
  $('cUrg').checked = !!p.urgente;
  $('dlgPosta').close();
  $('dlgConferma').showModal();
}
function aggiornaMailBadge() {
  const n = inbox.filter(m => !m.elaborata).length;
  $('mailBadge').textContent = n; $('mailBadge').hidden = !n;
}
$('btnChiudiPosta').onclick = () => $('dlgPosta').close();
$('btnIncollaMail').onclick = () => { $('dlgPosta').close(); $('dlgIncolla').showModal(); };
$('incAnnulla').onclick = () => $('dlgIncolla').close();
$('incAnalizza').onclick = () => {
  const mitt = $('incMitt').value.trim(), ogg = $('incOgg').value.trim(), corpo = $('incCorpo').value.trim();
  if (!corpo && !ogg) { toast('Inserisci almeno l’oggetto o il testo'); return; }
  // Salva in inbox come nuova email
  const m = {id:'u'+Date.now(), da:mitt, oggetto:ogg, corpo:corpo};
  inbox.unshift(m); salva();
  $('dlgIncolla').close();
  $('incMitt').value = ''; $('incOgg').value = ''; $('incCorpo').value = '';
  toast('Email aggiunta alla posta in arrivo');
  // proponi subito
  const i = inbox.indexOf(m);
  proponiDaEmail(i);
};
$('cAnnulla').onclick = () => { $('dlgConferma').close(); toast('Inserimento annullato'); };
$('cConferma').onclick = () => {
  const t = $('cTit').value.trim(), d = $('cData').value;
  if (!t || !d) { toast('Titolo e data sono obbligatori'); return; }
  const ev = {id: Date.now(), titolo:t, tipo:$('cTipo').value, data:d, ora:$('cOra').value,
    luogo:$('cLuogo').value.trim(), classi:$('cClassi').value.trim(), num:$('cNum').value.trim(), desc:$('cDesc').value.trim(),
    firma:$('cFirma').checked, urgente:$('cUrg').checked, firme:[]};
  eventi.push(ev); salva();
  // marca email come elaborata
  if (eventoProposto && eventoProposto.origine === 'email' && inbox[eventoProposto.idx]) {
    inbox[eventoProposto.idx].elaborata = true; salva(); aggiornaMailBadge();
  }
  eventoProposto = null;
  $('dlgConferma').close();
  sel = d; vista = new Date(d + 'T12:00');
  tutto(); toast('Evento inserito ✓');
};
