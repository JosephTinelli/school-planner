
const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GMAIL_CLIENT_ID = 'INCOLLA_QUI_IL_TUO_CLIENT_ID.apps.googleusercontent.com';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESS = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e) { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };
const caricaJs = u => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });

function trovaDate(t) {
  const r = []; let m;
  const a = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  while ((m = a.exec(t))) { let y = +m[3]; if (y < 100) y += 2000; r.push({i: m.index, d: new Date(y, m[2]-1, +m[1])}); }
  const b = new RegExp('\\b(\\d{1,2})\\s+(' + MESI.join('|') + ')(?:\\s+(\\d{4}))?', 'gi');
  while ((m = b.exec(t))) {
    const mo = MESI.indexOf(m[2].toLowerCase()), n = new Date();
    const y = m[3] ? +m[3] : n.getFullYear() + (mo < n.getMonth() - 1 ? 1 : 0);
    r.push({i: m.index, d: new Date(y, mo, +m[1])});
  }
  return r.filter(x => !isNaN(x.d)).sort((p, q) => p.i - q.i);
}

function analizza(t, soggetto) {
  t = t.replace(/[ \t]+/g, ' ');
  const o = {tipo: 'circolare'};
  const n = t.match(/circolare\s*(?:n\.?|n°|numero)?\s*(\d+)/i);
  o.num = n ? 'Circ. n. ' + n[1] : '';
  const og = (soggetto || (t.match(/oggetto\s*[:\-]\s*([^\n]+)/i) || [])[1] || t.split('\n').find(l => l.trim().length > 12) || '').trim().slice(0, 90);
  o.titolo = (n && !soggetto ? 'Circ. ' + n[1] + ' – ' : '') + og;
  const ds = trovaDate(t);
  const best = ds.find(x => /(si terr|giorno|in data|entro|convoc|scadenza)/i.test(t.slice(Math.max(0, x.i - 30), x.i))) || ds[ds.length - 1];
  o.data = best ? iso(best.d) : '';
  const h = t.match(/(?:ore|alle|dalle)\s*(\d{1,2})(?:[:.,h](\d{2}))?/i);
  o.ora = h ? String(h[1]).padStart(2, '0') + ':' + (h[2] || '00') : '';
  const cl = [...new Set((t.match(/\b[1-5]\s?[A-Z]\b/g) || []).map(s => s.replace(/\s/g, '')))];
  if (/tutte le classi|tutti gli studenti/i.test(t)) cl.unshift('Tutte');
  if (/docenti/i.test(t)) cl.push('Docenti');
  o.classi = cl.join(', ');
  if (/convocazione|collegio|consiglio di (classe|istituto)|riunione/i.test(t)) o.tipo = 'riunione';
  else if (/scadenza|termine ultimo/i.test(t)) o.tipo = 'scadenza';
  else if (/open day|assemblea|uscita didattica|gita|spettacolo|manifestazione/i.test(t)) o.tipo = 'evento';
  o.firma = /presa visione|firmare/i.test(t);
  o.urgente = /urgent|tassativ/i.test(t);
  o.desc = t.replace(/\s+/g, ' ').slice(0, 250);
  return o;
}


async function ocr(src) {
  await caricaJs(TESS);
  const r = await Tesseract.recognize(src, 'ita', {
    logger: m => { if (m.status === 'recognizing text') toast('Lettura OCR… ' + Math.round(m.progress * 100) + '%'); }
  });
  return r.data.text;
}
async function leggiPdf(file) {
  await caricaJs(PDFJS);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  let t = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
    const c = await (await pdf.getPage(p)).getTextContent();
    t += c.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  if (t.trim().length >= 30) return t;           // PDF con testo: niente OCR
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
function riempi(a) {
  const set = (id, v) => { if (v && !$(id).value) $(id).value = v; };
  set('fTit', a.titolo); set('fOra', a.ora); set('fClassi', a.classi); set('fNum', a.num); set('fDesc', a.desc);
  if (a.data) $('fData').value = a.data;
  $('fTipo').value = a.tipo; $('fFirma').checked = a.firma; $('fUrg').checked = a.urgente;
}
$('fFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  const pdf = f.type === 'application/pdf', img = f.type.startsWith('image/');
  if (!pdf && !img) return;
  toast('Leggo il file…');
  try {
    const t = pdf ? await leggiPdf(f) : await ocr(f);
    if (t.trim().length < 30) { toast('Testo non leggibile: compila a mano'); return; }
    riempi(analizza(t)); toast('Campi compilati: controlla e salva');
  } catch(err) { toast('Non riesco a leggere il file'); }
});


let tok = null, tc = null, timer = null;
let proposte = ld('planner_proposte', []);
const visti = new Set(ld('planner_visti', []));

const banner = document.createElement('div');
banner.className = 'card'; banner.style.cssText = 'cursor:pointer;border-color:var(--ac);font-weight:700';
$('v-mese').prepend(banner);
const dp = document.createElement('dialog'); dp.id = 'dlgProp'; document.body.appendChild(dp);
$('v-impost').insertBefore(Object.assign(document.createElement('div'), {className: 'card set', innerHTML:
  '<h3>Gmail</h3><p class="mu" id="gStato">Non collegato</p><button class="btn" id="gCollega">📧 Collega Gmail</button><button class="btn" id="gOra">🔄 Controlla ora</button>'}), $('v-impost').lastElementChild);

function stato() { $('gStato').textContent = tok ? 'Collegato · controllo ogni 2 minuti' : 'Non collegato'; }
function renderProp() { banner.hidden = !proposte.length; banner.textContent = '📩 ' + proposte.length + ' email con impegni da confermare'; sv('planner_proposte', proposte); sv('planner_visti', [...visti]); }

function apriProp() {
  if (!proposte.length) { dp.close(); return; }
  dp.innerHTML = '<h3>Email da confermare</h3>' + proposte.map((p, i) =>
    '<div class="card"><span class="tag" style="background:' + TIPI[p.tipo].c + '">' + TIPI[p.tipo].n + '</span><h4>' + esc(p.titolo) + '</h4>' +
    '<p class="meta">' + fmt(p.data) + (p.ora ? ' · ' + p.ora : '') + (p.classi ? ' · ' + esc(p.classi) : '') + '</p><p class="meta">Da: ' + esc(p.da) + '</p>' +
    '<div class="row"><button class="btn pr" data-a="ok" data-i="' + i + '">Aggiungi</button><button class="btn" data-a="mod" data-i="' + i + '">Modifica</button><button class="btn danger" data-a="no" data-i="' + i + '">Annulla</button></div></div>'
  ).join('') + '<div class="row"><button class="btn" data-a="x">Chiudi</button></div>';
  if (!dp.open) dp.showModal();
}
dp.onclick = e => {
  const a = e.target.dataset.a; if (!a) return;
  if (a === 'x') { dp.close(); return; }
  const p = proposte.splice(+e.target.dataset.i, 1)[0];
  if (a === 'ok') { eventi.push({id: Date.now(), firme: [], titolo: p.titolo, tipo: p.tipo, data: p.data, ora: p.ora || '', classi: p.classi || '', num: p.num || '', desc: p.desc + '\nDa: ' + p.da, firma: p.firma, urgente: p.urgente}); salva(); tutto(); toast('Aggiunto al calendario'); }
  if (a === 'mod') { dp.close(); apriForm({...p}); }
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
      const a = analizza(corpoMail(g.payload) || g.snippet, h('subject'));
      if (a.data) proposte.push({...a, da: h('from')});
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