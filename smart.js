const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const ORD = ['prima','seconda','terza','quarta','quinta'], ROM = ['I','II','III','IV','V'];
const ABB = new Set(['n','circ','art','prof','sig','dott','ss','ecc','es','pag','tel','p','dr']);
const GMAIL_CLIENT_ID = 'INCOLLA_QUI_IL_TUO_CLIENT_ID.apps.googleusercontent.com';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESS = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e) { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };
const caricaJs = u => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
const pausa = ms => new Promise(r => setTimeout(r, ms));



const annoDef = mo => { const n = new Date(); return n.getFullYear() + (mo < n.getMonth() - 1 ? 1 : 0); };
const dm = (g, mo, y) => new Date(y || annoDef(mo), mo, g);
function trovaDate(t) {
  const r = []; let m;
  const a = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  while ((m = a.exec(t))) { let y = +m[3]; if (y < 100) y += 2000; r.push({i: m.index, d: new Date(y, m[2]-1, +m[1])}); }
  const b = new RegExp('\\b(\\d{1,2})\\s+(' + MESI.join('|') + ')(?:\\s+(\\d{4}))?', 'gi');
  while ((m = b.exec(t))) r.push({i: m.index, d: dm(+m[1], MESI.indexOf(m[2].toLowerCase()), +m[3])});
  return r.filter(x => !isNaN(x.d)).sort((p, q) => p.i - q.i);
}
function normClasse(s) {
  s = String(s).trim().replace(/[ªº°^]/g, '');
  let m = s.match(/^(prima|seconda|terza|quarta|quinta)\s*([A-Za-z]{1,2})$/i);
  if (m) return (ORD.indexOf(m[1].toLowerCase()) + 1) + m[2].toUpperCase();
  m = s.match(/^(I{1,3}|IV|V)\s*([A-Z]{1,2})$/);
  if (m) return (ROM.indexOf(m[1]) + 1) + m[2];
  m = s.match(/^([1-5])\s*([A-Za-z]{1,2})$/);
  return m ? m[1] + m[2].toUpperCase() : null;
}
function menzioni(t, c) {
  const n = c[0], l = c.slice(1), r = [];
  [new RegExp('\\b' + n + '\\s?[ªº°^]?\\s?' + l + '\\b', 'g'),
   new RegExp('\\b' + ROM[n-1] + '\\s?[ªº°^]?\\s?' + l + '\\b', 'g'),
   new RegExp('\\b' + ORD[n-1] + '\\s+' + l + '\\b', 'gi')].forEach(re => { let m; while ((m = re.exec(t))) r.push(m.index); });
  return r.sort((a, b) => a - b);
}
function frasi(t) {                       
  const r = []; let a = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '.') continue;
    const p = t[i-1] || '', n = t[i+1];
    if (/\d/.test(p) && /\d/.test(n || '')) continue;     
    if (n && !/\s/.test(n)) continue;
    const w = (t.slice(Math.max(0, i - 6), i).match(/([A-Za-zÀ-ÿ]+)$/) || [])[1] || '';
    if (ABB.has(w.toLowerCase())) continue;                
    r.push({a, b: i + 1}); a = i + 1;
  }
  if (a < t.length) r.push({a, b: t.length});
  return r;
}
const esplicita = f => x => /(\bal|fino al|entro il|entro|termine)\s*$/i.test(f.slice(Math.max(0, x.i - 12), x.i));
const orari = f => [...f.matchAll(/(?:ore|alle|dalle)\s*(\d{1,2})(?:[:.,h](\d{2}))?/gi)].map(h => String(h[1]).padStart(2, '0') + ':' + (h[2] || '00'));
function periodo(f) {
  const o = {};
  const mm = f.match(new RegExp('dal\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+(' + MESI.join('|') + ')(?:\\s+(\\d{4}))?', 'i'));
  if (mm) { const mo = MESI.indexOf(mm[3].toLowerCase()); o.inizio = iso(dm(+mm[1], mo, +mm[4])); o.fine = iso(dm(+mm[2], mo, +mm[4])); }
  else { const ds = trovaDate(f); if (ds.length) { o.inizio = iso(ds[0].d); const k = ds.slice(1).find(esplicita(f)) || ds[1]; if (k) o.fine = iso(k.d); } }
  const h = orari(f); o.ora = h[0] || ''; o.oraFine = h[1] || '';
  return o;
}
function cercaImpegno(frs, i, pos) {      
  let ini = '', fine = '', ora = '', oraF = '', ult = i; const uso = [];
  for (let j = i; j < Math.min(i + 5, frs.length); j++) {
    const f = j === i ? frs[j].testo.slice(pos - frs[j].a) : frs[j].testo;
    uso.push(f);
    if (!ini) { const p = periodo(f); if (p.inizio) { ini = p.inizio; fine = p.fine || ''; ora = p.ora; oraF = p.oraFine; ult = j; } }
    else if (!fine) { const k = trovaDate(f).find(esplicita(f)); if (k) { fine = iso(k.d); ult = j; } }
    if (ini && fine) break;
  }
  return ini ? {inizio: ini, fine: fine || ini, ora, oraFine: oraF, ult, uso} : null;
}
const titoloDaFile = n => n.replace(/\.[^.]+$/, '').replace(/[0-9]+/g, '').replace(/[_\-–]+/g, ' ').replace(/\s+/g, ' ').trim();
const tipoDi = s => /convocazione|collegio|consiglio di (classe|istituto)|riunione/i.test(s) ? 'riunione' : /scadenza|termine ultimo/i.test(s) ? 'scadenza' : /open day|assemblea|uscita didattica|gita|spettacolo|manifestazione/i.test(s) ? 'evento' : 'circolare';

async function estrai(t, classi, titolo, mute) {
  t = t.replace(/[ \t]+/g, ' ');
  const frs = frasi(t).map(x => ({...x, testo: t.slice(x.a, x.b)}));
  const coda = classi.length ? classi : [...new Set((t.match(/\b[1-5]\s?[ªº°^]?\s?[A-Z]\b/g) || []).map(normClasse).filter(Boolean))];
  const nm = (t.match(/circolare\s*(?:n\.?|n°|numero)?\s*(\d+)/i) || [])[1], num = nm ? 'Circ. n. ' + nm : '';
  const firma = /presa visione|firmare/i.test(t), urgente = /urgent|tassativ/i.test(t), out = [];
  for (let q = 0; q < coda.length; q++) {                  
    const c = coda[q];
    if (!mute) { toast('Cerco ' + c + ' (' + (q + 1) + '/' + coda.length + ')…'); await pausa(350); }
    for (let i = 0; i < frs.length; i++) {
      const ps = menzioni(frs[i].testo, c);
      if (!ps.length) continue;
      const pos = frs[i].a + ps[0], r = cercaImpegno(frs, i, pos);
      if (!r) continue;
      out.push({titolo, tipo: tipoDi(r.uso.join(' ')), data: r.inizio, fine: r.fine, ora: r.ora, classi: c, num, firma, urgente,
        desc: r.uso[0].trim().slice(0, 250)});
      i = r.ult;                                          
    }
  }
  if (!out.length && !classi.length) {                    
      const r = cercaImpegno(frs, i, frs[i].a);
      if (r) { out.push({titolo, tipo: tipoDi(r.uso.join(' ')), data: r.inizio, fine: r.fine, ora: r.ora, classi: '', num, firma, urgente, desc: frs[i].testo.trim().slice(0, 250)}); break; }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}


async function ocr(src) {
  await caricaJs(TESS);
  const r = await Tesseract.recognize(src, 'ita', {logger: m => { if (m.status === 'recognizing text') toast('Lettura OCR… ' + Math.round(m.progress * 100) + '%'); }});
  return r.data.text;
}
async function leggiPdf(file) {
  await caricaJs(PDFJS);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  let t = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
    const c = await (await pdf.getPage(p)).getTextContent();
    t += c.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  if (t.trim().length >= 30) return t;
  toast('PDF scansionato: uso l’OCR…');
  let o = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 2); p++) {
    const pg = await pdf.getPage(p), vp = pg.getViewport({scale: 2});
    const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
    await pg.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
    o += (await ocr(cv)) + '\n';
  }
  return o;
}


let finePronta = '';
const fileMem = {};
function riempi(a) {
  const set = (id, v, f) => { if (v && (f || !$(id).value)) $(id).value = v; };
  set('fTit', a.titolo, 1); set('fOra', a.ora, 1); set('fClassi', a.classi, 1); set('fNum', a.num); set('fDesc', a.desc, 1); set('fData', a.data, 1);
  $('fTipo').value = a.tipo; $('fFirma').checked = a.firma; $('fUrg').checked = a.urgente;
}
const listaClassi = s => String(s).split(/[,;]+/).map(normClasse).filter(Boolean);
$('fFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  const pdf = f.type === 'application/pdf';
  if (!pdf && !f.type.startsWith('image/')) return;
  finePronta = '';
  const titolo = titoloDaFile(f.name);
  if (!$('fTit').value) $('fTit').value = titolo;
  const digitate = listaClassi($('fClassi').value);
  if (digitate.length) { $('gClassi').value = digitate.join(', '); sv('planner_classi', $('gClassi').value); }
  const classi = digitate.length ? digitate : listaClassi($('gClassi').value);
  toast('Leggo il file…');
  try {
    const t = pdf ? await leggiPdf(f) : await ocr(f);
    if (t.trim().length < 30) { toast('Testo non leggibile: compila a mano'); return; }
    const ev = await estrai(t, classi, titolo);
    if (!ev.length) { toast('Nessun impegno trovato: compila a mano'); return; }
    const id = Date.now(); fileMem[id] = f;
    riempi(ev[0]); finePronta = ev[0].fine !== ev[0].data ? ev[0].fine : '';
    ev.slice(1).forEach(x => proposte.push({...x, da: 'Circolare ' + f.name, fid: id}));
    renderProp();
    toast(ev.length > 1 ? ev.length + ' impegni: gli altri sono in “da confermare”' : 'Impegno trovato: controlla e salva');
  } catch(err) { toast('Non riesco a leggere il file'); }
});
const salvaOrig = $('fSalva').onclick;
$('fSalva').onclick = async () => {
  const n = eventi.length;
  await salvaOrig();
  if (finePronta && eventi.length > n) { eventi[eventi.length - 1].fine = finePronta; salva(); tutto(); }
  finePronta = '';
};
$('fAnnulla').addEventListener('click', () => { finePronta = ''; });
$('fab').addEventListener('click', () => { finePronta = ''; });


let tok = null, tc = null, timer = null;
let proposte = ld('planner_proposte', []);
const visti = new Set(ld('planner_visti', []));

const banner = document.createElement('div');
banner.className = 'card'; banner.style.cssText = 'cursor:pointer;border-color:var(--ac);font-weight:700';
$('v-mese').prepend(banner);
const dp = document.createElement('dialog'); dp.id = 'dlgProp'; document.body.appendChild(dp);
$('v-impost').insertBefore(Object.assign(document.createElement('div'), {className: 'card set', innerHTML:
  '<h3>Lettura automatica</h3><label>Classi da cercare<input id="gClassi" placeholder="Es. 5F, 4A"></label>' +
  '<p class="mu" id="gStato">Gmail non collegato</p><button class="btn" id="gCollega">📧 Collega Gmail</button><button class="btn" id="gOra">🔄 Controlla ora</button>'}), $('v-impost').lastElementChild);
$('gClassi').value = ld('planner_classi', '');
$('gClassi').oninput = () => sv('planner_classi', $('gClassi').value);

function stato() { $('gStato').textContent = tok ? 'Gmail collegato · controllo ogni 2 minuti' : 'Gmail non collegato'; }
function renderProp() { banner.hidden = !proposte.length; banner.textContent = '📩 ' + proposte.length + ' impegni da confermare'; sv('planner_proposte', proposte); sv('planner_visti', [...visti]); }
function apriProp() {
  if (!proposte.length) { dp.close(); return; }
  dp.innerHTML = '<h3>Impegni da confermare</h3>' + proposte.map((p, i) =>
    '<div class="card"><span class="tag" style="background:' + TIPI[p.tipo].c + '">' + TIPI[p.tipo].n + '</span><h4>' + esc(p.titolo) + '</h4>' +
    '<p class="meta">' + fmt(p.data) + (p.fine && p.fine !== p.data ? ' → ' + fmt(p.fine) : '') + (p.ora ? ' · ' + p.ora : '') + (p.classi ? ' · ' + esc(p.classi) : '') + '</p><p class="meta">Da: ' + esc(p.da) + '</p>' +
    '<div class="row"><button class="btn pr" data-a="ok" data-i="' + i + '">Aggiungi</button><button class="btn" data-a="mod" data-i="' + i + '">Modifica</button><button class="btn danger" data-a="no" data-i="' + i + '">Annulla</button></div></div>'
  ).join('') + '<div class="row"><button class="btn" data-a="x">Chiudi</button></div>';
  if (!dp.open) dp.showModal();
}
dp.onclick = async e => {
  const a = e.target.dataset.a; if (!a) return;
  if (a === 'x') { dp.close(); return; }
  const p = proposte.splice(+e.target.dataset.i, 1)[0];
  if (a === 'ok') {
    const ev = {id: Date.now(), firme: [], titolo: p.titolo, tipo: p.tipo, data: p.data, ora: p.ora || '', classi: p.classi || '', num: p.num || '', desc: p.desc + '\nDa: ' + p.da, firma: p.firma, urgente: p.urgente};
    if (p.fine && p.fine !== p.data) ev.fine = p.fine;
    const f = fileMem[p.fid];
    if (f) { try { await fPut(ev.id, f); ev.file = {nome: f.name, tipo: f.type, size: f.size}; } catch(err) {} }
    eventi.push(ev); salva(); tutto(); toast('Aggiunto al calendario');
  }
  if (a === 'mod') { dp.close(); apriForm({...p}); finePronta = p.fine && p.fine !== p.data ? p.fine : ''; }
  renderProp(); apriProp();
};
banner.onclick = apriProp;

const api = async u => {
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + u, {headers: {Authorization: 'Bearer ' + tok}});
  if (r.status === 401) { tok = null; stato(); throw 0; }
  return r.json();
};
function corpoMail(p) {
  if (p.mimeType === 'text/plain' && p.body && p.body.data) {
    const b = atob(p.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0)));
  }
  for (const x of p.parts || []) { const t = corpoMail(x); if (t) return t; }
  return '';
}
async function controlla() {
  if (!tok) { toast('Collega prima Gmail'); return; }
  try {
    const l = await api('messages?maxResults=10&q=' + encodeURIComponent('newer_than:7d -in:sent -in:drafts'));
    for (const m of l.messages || []) {
      if (visti.has(m.id)) continue;
      visti.add(m.id);
      const g = await api('messages/' + m.id + '?format=full');
      const h = n => (g.payload.headers.find(x => x.name.toLowerCase() === n) || {}).value || '';
      const ev = await estrai(corpoMail(g.payload) || g.snippet, listaClassi($('gClassi').value), h('subject'), true);
      ev.forEach(x => proposte.push({...x, da: h('from')}));
    }
    renderProp();
  } catch(e) {}
}
$('gCollega').onclick = async () => {
  if (GMAIL_CLIENT_ID.startsWith('INCOLLA')) { alert('Inserisci il Client ID in smart.js'); return; }
  await caricaJs('https://accounts.google.com/gsi/client');
  tc = tc || google.accounts.oauth2.initTokenClient({client_id: GMAIL_CLIENT_ID, scope: 'https://www.googleapis.com/auth/gmail.readonly',
    callback: r => { tok = r.access_token; stato(); controlla(); clearInterval(timer); timer = setInterval(controlla, 120000); }});
  tc.requestAccessToken();
};
$('gOra').onclick = controlla;
renderProp();
