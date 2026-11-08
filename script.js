const TIPI = {
  circolare: {n: 'Circolare', c: '#0ea5e9'},
  riunione:  {n: 'Riunione',  c: '#f59e0b'},
  scadenza:  {n: 'Scadenza',  c: '#ef4444'},
  evento:    {n: 'Evento',    c: '#10b981'}
};
const COLORI = [['Verde acqua','#0f766e'],['Viola','#7c3aed'],['Arancio','#ea580c'],['Rosa','#db2777'],['Blu','#2563eb']];
const K_EV = 'planner_eventi_v2', K_IM = 'planner_impostazioni_v2';

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

/* ---------- Dati ---------- */
function carica() {
  try { const i = localStorage.getItem(K_IM); if (i) imp = {...imp, ...JSON.parse(i)}; } catch(e) {}
  try { const r = localStorage.getItem(K_EV); if (r) { eventi = JSON.parse(r); return; } } catch(e) {}
  const t = new Date(), g = n => { const d = new Date(t); d.setDate(t.getDate()+n); return iso(d); };
  eventi = [
    {id:1, titolo:'Circ. 41 – Calendario scrutini', tipo:'circolare', data:g(-2), ora:'', classi:'Tutte', num:'Circ. n. 41 – circolare41.pdf', desc:'Calendario degli scrutini intermedi.', firma:true, urgente:false, firme:[]},
    {id:2, titolo:'Collegio docenti', tipo:'riunione', data:g(3), ora:'15:00', classi:'Docenti', num:'', desc:'Aula magna. O.d.G. in bacheca.', firma:false, urgente:false, firme:[]},
    {id:3, titolo:'Consegna piani di lavoro', tipo:'scadenza', data:g(6), ora:'', classi:'Docenti', num:'', desc:'Caricare i piani su Argo.', firma:false, urgente:true, firme:[]},
    {id:4, titolo:'Circ. 44 – Uscita didattica', tipo:'circolare', data:g(9), ora:'', classi:'4A, 4B', num:'Circ. n. 44 – circolare44.pdf', desc:'Uscita delle classi quarte al museo.', firma:true, urgente:false, firme:[]},
    {id:5, titolo:'Open day', tipo:'evento', data:g(14), ora:'09:00', classi:'Tutti', num:'', desc:'Accoglienza delle famiglie, ore 9–13.', firma:false, urgente:false, firme:[]}
  ];
  salva();
}
function salva() {
  try { localStorage.setItem(K_EV, JSON.stringify(eventi)); localStorage.setItem(K_IM, JSON.stringify(imp)); } catch(e) {}
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
    '<p class="meta">' + fmt(e.data) + ' (' + rel(e.data) + ')' + (e.ora ? ' · ' + e.ora : '') + (e.classi ? ' · ' + esc(e.classi) : '') + '</p></article>';
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
  const l = eventi.filter(e => (tutti || e.data >= oggi) && (e.titolo + e.desc + e.classi + e.num).toLowerCase().includes(q)).sort(ordina);
  let h = '', ult = '';
  l.forEach(e => { if (e.data !== ult) { h += '<div class="date-h">' + fmtLungo(e.data) + '</div>'; ult = e.data; } h += card(e); });
  $('agendaLista').innerHTML = h || '<p class="empty">Nessun risultato.
