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

let eventi = [];
let imp = {nome:'', ruolo:'docente', tema:'auto', colore:'#0f766e', sett:1, testo:'100'};
let vista = new Date(), sel = iso(new Date()), editId = null;
let attivo = {circolare:1, riunione:1, scadenza:1, evento:1};


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
const dim = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';


function applica() {
  const r = document.documentElement;
  if (imp.tema === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', imp.tema);
  r.style.setProperty('--ac', imp.colore);
  r.style.fontSize = imp.testo + '%';
  document.querySelector('meta[name=theme-color]').content = imp.colore;
}


function card(e) {
  const t = TIPI[e.tipo], ok = e.firma && firmato(e);
  return '<article class="card ev" data-id="' + e.id + '" style="--t:' + t.c + '">' +
    '<div class="evh"><span class="tag">' + t.n + '</span>' +
    (e.urgente ? '<span class="tag red">Urgente</span>' : '') +
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
  $('sNome').value = imp.nome; $('sRuolo').value = imp.ruolo; $('sTema').value = imp.tema;
  $('sSett').value = imp.sett; $('sTesto').value = imp.testo;
  $('sColori').innerHTML = COLORI.map(c => '<button title="' + c[0] + '" data-c="' + c[1] + '" style="--c:' + c[1] + '" class="' + (c[1] === imp.colore ? 'on' : '') + '"></button>').join('');
  $('sColori').querySelectorAll('button').forEach(b => b.onclick = () => { imp.colore = b.dataset.c; cambiaImp(); renderImp(); });
}
function tutto() {
  renderMese(); renderAgenda(); renderFirme();
  $('fab').style.display = puoModificare() ? '' : 'none';
}
function cambiaImp() { salva(); applica(); tutto(); }


function dettaglio(id) {
  const e = eventi.find(x => x.id === id); if (!e) return;
  const t = TIPI[e.tipo];
  $('dTit').textContent = e.titolo;
  let h = '<p class="meta">' + t.n + ' · ' + fmtLungo(e.data) + (e.ora ? ' · ore ' + e.ora : '') + ' (' + rel(e.data) + ')</p>';
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
    else { const a = document.createElement('a'); a.href = u; a.download = e.file.nome; a.click(); }
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
    btn('Elimina', 'danger', () => { if (confirm( fDel(id).catch(() => {});'Eliminare “' + e.titolo + '”?')) { eventi = eventi.filter(x => x.id !== id); salva(); $('dlgDet').close(); tutto(); toast('Eliminato'); } });
  }
  btn('Chiudi', '', () => $('dlgDet').close());
  if (!$('dlgDet').open) $('dlgDet').showModal();
}
function apriForm(e) {
  editId = e ? e.id : null;
  $('formTitolo').textContent = e ? 'Modifica elemento' : 'Nuovo elemento';
  $('fTit').value = e ? e.titolo : ''; $('fTipo').value = e ? e.tipo : 'circolare';
  $('fData').value = e ? e.data : sel; $('fOra').value = e ? e.ora : '';
  $('fClassi').value = e ? e.classi : ''; $('fNum').value = e ? e.num : '';
  $('fDesc').value = e ? e.desc : ''; $('fFirma').checked = e ? e.firma : false; $('fUrg').checked = e ? e.urgente : false;
  $('fFile').value = ''; $('fRimuovi').checked = false;
  $('fRimBox').hidden = !(e && e.file);
  $('fFileInfo').textContent = e && e.file ? e.file.nome : '';
  $('dlgForm').showModal();
}
$('fSalva').onclick = async () => {
  const t = $('fTit').value.trim(), d = $('fData').value;
  if (!t || !d) { toast('Titolo e data sono obbligatori'); return; }
  const f = $('fFile').files[0];
  if (f && f.size > 10 * 1024 * 1024) { toast('File troppo grande (max 10 MB)'); return; }
  const dati = {titolo:t, tipo:$('fTipo').value, data:d, ora:$('fOra').value, classi:$('fClassi').value.trim(), num:$('fNum').value.trim(), desc:$('fDesc').value.trim(), firma:$('fFirma').checked, urgente:$('fUrg').checked};
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


$('sNome').oninput = e => { imp.nome = e.target.value; cambiaImp(); };
$('sRuolo').onchange = e => { imp.ruolo = e.target.value; cambiaImp(); };
$('sTema').onchange = e => { imp.tema = e.target.value; cambiaImp(); };
$('sSett').onchange = e => { imp.sett = +e.target.value; cambiaImp(); };
$('sTesto').onchange = e => { imp.testo = e.target.value; cambiaImp(); };

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
      'SUMMARY:' + x(e.titolo), 'DESCRIPTION:' + x((e.classi ? e.classi + ' – ' : '') + e.desc), 'END:VEVENT');
  });
  r.push('END:VCALENDAR');
  scarica(r.join('\r\n'), 'calendario-scuola.ics', 'text/calendar'); toast('File .ics creato');
};
$('btnBackup').onclick = () => { scarica(JSON.stringify({eventi, imp}, null, 2), 'backup-planner.json', 'application/json'); toast('Backup salvato'); };
$('btnImporta').onclick = () => $('fileImporta').click();
$('fileImporta').onchange = ev => {
  const f = ev.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const o = JSON.parse(rd.result);
      if (!Array.isArray(o.eventi)) throw 0;
      eventi = o.eventi; if (o.imp) imp = {...imp, ...o.imp};
      salva(); applica(); renderImp(); tutto(); toast('Backup ripristinato');
    } catch(e) { toast('File non valido'); }
  };
  rd.readAsText(f);
};
$('btnReset').onclick = () => {
  if (confirm('Cancellare tutti i dati e le impostazioni?')) {
    try { localStorage.removeItem(K_EV); localStorage.removeItem(K_IM); } catch(e) {}
    indexedDB.deleteDatabase('planner_files');
    location.reload();
  }
};


carica(); applica(); renderImp(); tutto();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
