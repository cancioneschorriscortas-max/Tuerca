/* ============================================================
   TUERCA MUNDIAL (v0.60, M1) — modo torneo aparte da campaña.
   Deseño: TUERCA_MUNDIAL_deseno_v1.md (Agarfal + Claude).
   M1: convocatoria de 22 renomeables · grupos de 4 + semi + final ·
   partido a 90' con GOLES por sectores · XI titular + 3 cambios ·
   tarxeta vermella por explotar en vehículo · balón neutral central
   (jeep→tanque) · bandeiras de país · comentarista básico.
   Persistencia PROPIA ('tuerca-mundial'): non toca a campaña.
   ============================================================ */

/* ---------- Datos de países e doutrinas ---------- */
const MUN_DOUTRINAS = {
  MARABUNTA:  {form:{GRUNT:8, ENGINEER:1, HEAVY:1, SNIPER:1}, agres:1.5, trofeo:'spd'},
  FORTALEZA:  {form:{GRUNT:3, ENGINEER:4, HEAVY:3, SNIPER:1}, agres:0.6, trofeo:'hp'},
  CIRURXAN:   {form:{GRUNT:3, ENGINEER:1, HEAVY:2, SNIPER:5}, agres:1.0, trofeo:'rng'},
  BLINDADO:   {form:{GRUNT:4, ENGINEER:2, HEAVY:4, SNIPER:1}, agres:1.2, trofeo:'dmg'},
  CHATARREIRO:{form:{GRUNT:4, ENGINEER:4, HEAVY:2, SNIPER:1}, agres:0.9, trofeo:'hp'},
  FANTASMA:   {form:{GRUNT:5, ENGINEER:1, HEAVY:1, SNIPER:4}, agres:1.3, trofeo:'spd'},
};
const MUN_PAISES = [
  {id:'ES', nome:'ESPAÑA',    band:{t:'tricolor-h',c:['#c23a30','#e8c832','#c23a30']}, bioma:'VERDE', dout:'FORTALEZA'},
  {id:'BR', nome:'BRASIL',    band:{t:'disco',     c:['#3a9a3a','#e8d24a']}, bioma:'VERDE',   dout:'MARABUNTA'},
  {id:'XP', nome:'XAPÓN',     band:{t:'disco',     c:['#f0f0ee','#d84a3c']}, bioma:'VERDE',   dout:'CIRURXAN'},
  {id:'EX', nome:'EXIPTO',    band:{t:'tricolor-h',c:['#d84a3c','#f0f0ee','#26251f']}, bioma:'DESERTO', dout:'BLINDADO'},
  {id:'MX', nome:'MÉXICO',    band:{t:'tricolor-v',c:['#3a9a3a','#f0f0ee','#d84a3c']}, bioma:'DESERTO', dout:'MARABUNTA'},
  {id:'MR', nome:'MARROCOS',  band:{t:'disco',     c:['#c23a30','#3a7a3a']}, bioma:'DESERTO', dout:'CHATARREIRO'},
  {id:'NO', nome:'NORUEGA',   band:{t:'cruz',      c:['#c23a30','#f0f0ee','#2a4a8a']}, bioma:'NEVE', dout:'FORTALEZA'},
  {id:'IS', nome:'ISLANDIA',  band:{t:'cruz',      c:['#2a4a8a','#f0f0ee','#c23a30']}, bioma:'NEVE', dout:'FANTASMA'},
];

/* ---------- Constantes de partido ---------- */
const MUN_MIN_TICKS   = 480;                       /* 1 minuto do partido = 8s reais */
const MUN_MATCH_TICKS = 90 * MUN_MIN_TICKS;        /* 90' = 12 min reais */
const MUN_GOL_TICKS   = 45 * 60;                   /* manter maioría 45s reais = GOL */
const MUN_SUBS_MAX    = 3;
const MUN_XI          = 11;
const MUN_PLANTEL     = 22;

/* ---------- Persistencia propia ---------- */
let MDATA = null;
let _munMemStore = null;
async function mundialLoad(){
  if(MDATA) return MDATA;
  try{
    /* (v0.61.3) localStorage, como todo TUERCA — window.storage NON existe
       nos navegadores (era do arnés de probas; erro meu autoenganado polo stub) */
    const v = localStorage.getItem('tuerca-mundial');
    MDATA = v ? JSON.parse(v) : null;
  }catch(e){ MDATA = _munMemStore; }
  if(MDATA){   /* (v0.61) migracións */
    if(MDATA.pais === 'GZ') MDATA.pais = 'ES';
    MDATA.grupo.rivais = MDATA.grupo.rivais.map(id => id === 'GZ' ? 'ES' : id);
    MDATA.outroGrupo = (MDATA.outroGrupo || []).map(id => id === 'GZ' ? 'ES' : id);
    if(!MDATA.mell) MDATA.mell = {dmg:0, hp:0, spd:0};
    if(typeof MDATA.orz !== 'number') MDATA.orz = 0;
    if(!MDATA.trofeos) MDATA.trofeos = [];
  }
  return MDATA;
}
async function mundialSave(){
  _munMemStore = MDATA;
  try{ localStorage.setItem('tuerca-mundial', JSON.stringify(MDATA)); }catch(e){}
}

function mundialFresh(pais){
  /* plantel de 22 xenéricos (renomeables na convocatoria) */
  const nomes = (typeof NAMES !== 'undefined' ? [...NAMES] : []).sort(() => Math.random() - 0.5);
  const roster = [];
  for(let i = 0; i < MUN_PLANTEL; i++){
    roster.push({
      id: 'M-' + String(i + 1).padStart(2, '0'),
      dorsal: i + 1,
      name: nomes[i % Math.max(1, nomes.length)] || ('ROBOT' + (i + 1)),
      cls: i < 8 ? 'GRUNT' : i < 12 ? 'HEAVY' : i < 17 ? 'ENGINEER' : 'SNIPER',
      ops: 0, kills: 0, activity: {}, medals: [], vinculos: [], events: [],
      confianza: 60, personalidad: null, folga: null,
      scar: 1.0,          /* multiplicador por mortes (cicatriz permanente) */
      susp: -1,           /* índice de partido que ten que perder por vermella */
      goles: 0,           /* palmarés persoal do torneo */
    });
  }
  /* grupo: 3 rivais + 4 no outro grupo (simulado) */
  const outros = MUN_PAISES.filter(p => p.id !== pais).map(p => p.id).sort(() => Math.random() - 0.5);
  return {
    v: 1, pais, bloqueado: false,
    roster,
    fase: 'convocatoria',           /* convocatoria → grupos → semi → final → campion/eliminado */
    partidoIdx: 0,                  /* índice global de partido xogado */
    grupo: {rivais: outros.slice(0, 3), res: []},   /* res: [{rival, gf, gc, pts}] */
    outroGrupo: outros.slice(3, 7),
    semiRival: null, finalRival: null,
    palmares: [],
    orz: 0,                          /* (v0.61) orzamento por rendemento */
    mell: {dmg:0, hp:0, spd:0},      /* niveis mercados na tenda (máx 3) */
    trofeos: [],                     /* tecnoloxías saqueadas ás doutrinas vencidas */
  };
}

/* ---------- Bandeiras procedurais ---------- */
function drawBandeira(ctx, x, y, w, h, band){
  const c = band.c;
  if(band.t === 'tricolor-v'){
    const t = Math.ceil(w / 3);
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, t, h);
    ctx.fillStyle = c[1]; ctx.fillRect(x + t, y, t, h);
    ctx.fillStyle = c[2]; ctx.fillRect(x + 2 * t, y, w - 2 * t, h);
  } else if(band.t === 'tricolor-h'){
    const t = Math.ceil(h / 3);
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, t);
    ctx.fillStyle = c[1]; ctx.fillRect(x, y + t, w, t);
    ctx.fillStyle = c[2]; ctx.fillRect(x, y + 2 * t, w, h - 2 * t);
  } else if(band.t === 'bicolor-h'){
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, Math.ceil(h / 2));
    ctx.fillStyle = c[1]; ctx.fillRect(x, y + Math.ceil(h / 2), w, h - Math.ceil(h / 2));
  } else if(band.t === 'cruz'){
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c[1];
    ctx.fillRect(x, y + ((h / 2) | 0) - 1, w, 2);
    ctx.fillRect(x + ((w / 3) | 0), y, 2, h);
    ctx.fillStyle = c[2];
    ctx.fillRect(x, y + ((h / 2) | 0), w, 1);
    ctx.fillRect(x + ((w / 3) | 0), y, 1, h);
  } else { /* disco */
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c[1];
    const r = Math.min(w, h) / 3;
    ctx.fillRect(x + w / 2 - r, y + h / 2 - r / 1.4, r * 2, r * 1.4);
  }
  ctx.fillStyle = '#10160a';
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
}
function bandeiraHTML(band, w, h){
  /* mini-canvas inline para o hub */
  const id = 'bnd' + Math.random().toString(36).slice(2, 8);
  setTimeout(() => {
    const c = document.getElementById(id);
    if(c) drawBandeira(c.getContext('2d'), 0, 0, w, h, band);
  }, 0);
  return `<canvas id="${id}" width="${w}" height="${h}" style="image-rendering:pixelated; vertical-align:middle;"></canvas>`;
}

/* ---------- HUB / UI (usa #bioModal) ---------- */
function mundialHub(){
  /* (v0.61.3) blindado: calquera fallo sae no overlay, non nun "non vai" mudo */
  mundialLoad().then(() => {
    if(!MDATA) return mundialEscollaPais();
    if(!MDATA.bloqueado) return mundialConvocatoria();
    mundialTorneoHub();
  }).catch(err => {
    if(typeof _tuercaOverlay === 'function') _tuercaOverlay('mundial: ' + (err && (err.stack || err.message) || err));
  });
}

function mundialEscollaPais(){
  let body = `<div class="small" style="margin-bottom:10px;">${TXT('mun.intro')}</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">`;
  for(const p of MUN_PAISES){
    body += `<button class="mun-pais" data-pais="${p.id}" style="text-align:left; padding:8px;">
      ${bandeiraHTML(p.band, 24, 15)} <b>${p.nome}</b>
      <div class="small" style="color:var(--phos-dim);">${TXT('mun.dout.' + p.dout)} · ${TXT('mun.bioma.' + p.bioma)}</div>
    </button>`;
  }
  body += `</div>`;
  fondoModal('mundial');
  $('bioTitle').innerHTML = TXT('mun.titulo');
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'block';
  $('bioBody').querySelectorAll('.mun-pais').forEach(b => b.onclick = () => {
    MDATA = mundialFresh(b.dataset.pais);
    mundialSave();
    mundialConvocatoria();
  });
}

function mundialConvocatoria(){
  const p = MUN_PAISES.find(x => x.id === MDATA.pais);
  let body = `<div class="small" style="margin-bottom:8px;">${bandeiraHTML(p.band, 24, 15)} <b>${p.nome}</b> — ${TXT('mun.convIntro')}</div>`;
  body += `<div style="max-height:52vh; overflow-y:auto;">`;
  for(const r of MDATA.roster){
    body += `<div style="display:flex; gap:6px; align-items:center; padding:2px 0; border-bottom:1px dotted #2a2200;">
      <span style="width:22px; color:var(--gold);">${r.dorsal}</span>
      <input data-mid="${r.id}" class="mun-nome" value="${r.name}" maxlength="10" style="width:110px; text-transform:uppercase;">
      <select data-mid="${r.id}" class="mun-cls">
        ${['GRUNT','HEAVY','ENGINEER','SNIPER'].map(c => `<option ${r.cls === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>`;
  }
  body += `</div>
    <div class="row" style="margin-top:10px;">
      <button id="munConfirmar" style="color:#7fdc7f;">✓ ${TXT('mun.confirmar')}</button>
      <button id="munPechar">${TXT('mun.pechar')}</button>
    </div>
    <div class="small" style="color:var(--phos-dim); margin-top:6px;">${TXT('mun.convAviso')}</div>`;
  fondoModal('mundial');
  $('bioTitle').innerHTML = TXT('mun.convTitulo');
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'block';
  $('bioBody').querySelectorAll('.mun-nome').forEach(i => i.oninput = () => {
    const r = MDATA.roster.find(x => x.id === i.dataset.mid);
    if(r) r.name = i.value.toUpperCase().slice(0, 10) || r.name;
  });
  $('bioBody').querySelectorAll('.mun-cls').forEach(s => s.onchange = () => {
    const r = MDATA.roster.find(x => x.id === s.dataset.mid);
    if(r) r.cls = s.value;
  });
  $('munConfirmar').onclick = () => {
    MDATA.bloqueado = true;
    MDATA.fase = 'grupos';
    mundialSave();
    mundialTorneoHub();
  };
  $('munPechar').onclick = () => { $('bioModal').style.display = 'none'; };
}

function _munRivalActual(){
  if(MDATA.fase === 'grupos') return MDATA.grupo.rivais[MDATA.grupo.res.length];
  if(MDATA.fase === 'semi')   return MDATA.semiRival;
  if(MDATA.fase === 'final')  return MDATA.finalRival;
  return null;
}
function _munRonda(){
  /* 0-2 grupos, 3 semi, 4 final — escala melloras e o balón */
  if(MDATA.fase === 'grupos') return MDATA.grupo.res.length;
  if(MDATA.fase === 'semi') return 3;
  return 4;
}
function _munSeed(n){ const s = Math.sin((MDATA.pais.charCodeAt(0) * 131) + n * 97) * 10000; return s - Math.floor(s); }

/* (v0.62) NOVO TORNEO conservando o CLUB: o plantel bautizado, coas súas
   cicatrices, goles e palmarés, é o valioso e PERSISTE. O país escóllese
   a CADA torneo — a crítica xusta de Agarfal: escoller España unha vez
   non pode ser condena perpetua. As sancións pendentes límpanse (torneo
   novo, contadores novos); as cicatrices quedan (a carne lembra). */
function mundialNovoTorneo(){
  const club = {roster: MDATA.roster, palmares: MDATA.palmares || [], bloqueado: MDATA.bloqueado};
  club.roster.forEach(r => { r.susp = -1; r.goles = 0; delete r._usado; });
  MDATA = null;
  /* escolla de país co club a coiro */
  let body = `<div class="small" style="margin-bottom:10px;">${TXT('mun.escollaNova')}</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">`;
  for(const p of MUN_PAISES){
    body += `<button class="mun-pais" data-pais="${p.id}" style="text-align:left; padding:8px;">
      ${bandeiraHTML(p.band, 24, 15)} <b>${p.nome}</b>
      <div class="small" style="color:var(--phos-dim);">${TXT('mun.dout.' + p.dout)} · ${TXT('mun.bioma.' + p.bioma)}</div>
    </button>`;
  }
  body += `</div>`;
  fondoModal('mundial');
  $('bioTitle').innerHTML = TXT('mun.titulo');
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'block';
  $('bioBody').querySelectorAll('.mun-pais').forEach(b => b.onclick = () => {
    MDATA = mundialFresh(b.dataset.pais);
    MDATA.roster = club.roster;         /* o club por riba dos xenéricos */
    MDATA.palmares = club.palmares;
    MDATA.bloqueado = club.bloqueado;
    if(MDATA.bloqueado) MDATA.fase = 'grupos';
    mundialSave();
    MDATA.bloqueado ? mundialTorneoHub() : mundialConvocatoria();
  });
}

function mundialTorneoHub(){
  const p = MUN_PAISES.find(x => x.id === MDATA.pais);
  let body = `<div style="margin-bottom:8px;">${bandeiraHTML(p.band, 32, 20)} <b style="font-size:15px;">${p.nome}</b> · <span class="small">${TXT('mun.fase.' + MDATA.fase)}</span></div>`;

  if(MDATA.fase === 'grupos' || MDATA.fase === 'semi' || MDATA.fase === 'final'){
    /* táboa do grupo */
    if(MDATA.fase === 'grupos'){
      body += `<div class="small"><b>${TXT('mun.grupo')}</b></div><table class="small" style="width:100%; margin:4px 0 10px;">`;
      const filas = _munTaboaGrupo();
      for(const f of filas){
        const pp = MUN_PAISES.find(x => x.id === f.id);
        body += `<tr ${f.id === MDATA.pais ? 'style="color:var(--gold);"' : ''}><td>${bandeiraHTML(pp.band, 16, 10)} ${pp.nome}</td><td style="text-align:right;">${f.pts} ${TXT('mun.pts')}</td><td style="text-align:right;">${f.gf}-${f.gc}</td></tr>`;
      }
      body += `</table>`;
    }
    const rid = _munRivalActual();
    const rv = MUN_PAISES.find(x => x.id === rid);
    body += `<div class="ph-section"><b>${TXT('mun.proximo')}</b>
      <div style="margin:4px 0;">${bandeiraHTML(rv.band, 24, 15)} <b>${rv.nome}</b> — ${TXT('mun.dout.' + rv.dout)}</div>
      <div class="small" style="color:var(--phos-dim);">${TXT('mun.sede')}: ${TXT('mun.bioma.' + rv.bioma)} · ${TXT('mun.balon')}: ${_munRonda() >= 3 ? 'TANQUE' : 'JEEP'}</div>
    </div>`;
    /* plantel: titulares, cicatrices, sancionados */
    const susp = MDATA.roster.filter(r => r.susp === MDATA.partidoIdx);
    if(susp.length) body += `<div class="small" style="color:#ff5340;">🟥 ${TXT('mun.sancionados')}: ${susp.map(r => r.name).join(', ')}</div>`;
    const feridos = MDATA.roster.filter(r => r.scar < 1);
    if(feridos.length) body += `<div class="small" style="color:var(--phos-dim);">✚ ${TXT('mun.tocados')}: ${feridos.map(r => r.name + ' (' + Math.round(r.scar * 100) + '%)').join(', ')}</div>`;
    /* (v0.61) TENDA: orzamento por rendemento → melloras de equipo (máx 3 niveis) */
    body += `<div class="ph-section"><b>${TXT('mun.tenda')}</b> <span style="color:var(--gold);">⚙ ${MDATA.orz || 0}</span>
      <div class="row" style="margin-top:4px;">`;
    const MELL = [['dmg', 60], ['hp', 60], ['spd', 50]];
    for(const [mid, custo] of MELL){
      const lv = MDATA.mell[mid], prezo = custo * (lv + 1);
      body += `<button class="mun-mell" data-m="${mid}" ${lv >= 3 || (MDATA.orz || 0) < prezo ? 'disabled' : ''}>
        ${TXT('mun.mell.' + mid)} ${'●'.repeat(lv)}${'○'.repeat(3 - lv)}${lv < 3 ? ' · ' + prezo + '⚙' : ''}</button>`;
    }
    body += `</div></div>`;
    if(MDATA.trofeos && MDATA.trofeos.length){
      body += `<div class="small" style="color:#e8c84a;">🏅 ${TXT('mun.trofeos')}: ${MDATA.trofeos.map(t => TXT('mun.trofeo.' + t)).join(' · ')}</div>`;
    }
    body += `<div class="row" style="margin-top:10px;">
      <button id="munXogar" style="color:#7fdc7f;">▶ ${TXT('mun.xogar')}</button>
      <button id="munPlantel">${TXT('mun.plantel')}</button>
      <button id="munNovo" style="color:#ffd24a;">🏆 ${TXT('mun.novoTorneo')}</button>
      <button id="munBorrarTodo" style="color:#ff8;" title="${TXT('mun.borrarTodoTitle')}">✕</button>
      <button id="munPechar">${TXT('mun.pechar')}</button>
    </div>`;
  } else {
    /* campión ou eliminado */
    body += `<div style="font-size:16px; margin:12px 0;">${MDATA.fase === 'campion' ? '🏆 ' + TXT('mun.campion') : TXT('mun.eliminado')}</div>`;
    body += `<div class="row"><button id="munNovo" style="color:#7fdc7f;">🏆 ${TXT('mun.novoTorneo')}</button>
      <button id="munBorrarTodo" style="color:#ff8;">✕ ${TXT('mun.borrarTodo')}</button>
      <button id="munPechar">${TXT('mun.pechar')}</button></div>`;
  }
  fondoModal('mundial');
  $('bioTitle').innerHTML = TXT('mun.titulo');
  $('bioBody').innerHTML = body;
  $('bioModal').style.display = 'block';
  const bx = $('munXogar'); if(bx) bx.onclick = mundialXogarPartido;
  $('bioBody').querySelectorAll('.mun-mell').forEach(b => b.onclick = () => {
    const mid = b.dataset.m, lv = MDATA.mell[mid];
    const prezo = (mid === 'spd' ? 50 : 60) * (lv + 1);
    if(lv >= 3 || (MDATA.orz || 0) < prezo) return;
    MDATA.orz -= prezo; MDATA.mell[mid]++;
    mundialSave(); mundialTorneoHub();
  });
  const bp = $('munPlantel'); if(bp) bp.onclick = mundialVerPlantel;
  const bn = $('munNovo'); if(bn) bn.onclick = () => {
    if(MDATA.fase === 'campion' || MDATA.fase === 'eliminado' || confirm(TXT('mun.confirmaNovo'))) mundialNovoTorneo();
  };
  const bt = $('munBorrarTodo'); if(bt) bt.onclick = () => {
    if(confirm(TXT('mun.confirmaReinicio'))){ MDATA = null; try{ localStorage.removeItem('tuerca-mundial'); }catch(e){} mundialEscollaPais(); }
  };
  const bc = $('munPechar'); if(bc) bc.onclick = () => { $('bioModal').style.display = 'none'; };
}

function mundialVerPlantel(){
  let body = `<div style="max-height:60vh; overflow-y:auto;">`;
  for(const r of MDATA.roster){
    const est = r.susp === MDATA.partidoIdx ? ' 🟥' : r.scar < 1 ? ' ✚' + Math.round(r.scar * 100) + '%' : '';
    body += `<div class="small" style="padding:2px 0; border-bottom:1px dotted #2a2200;">
      <span style="color:var(--gold);">${r.dorsal}</span> <b>${r.name}</b> · ${r.cls} · ⚽${r.goles} ☠${r.kills}${est}</div>`;
  }
  body += `</div><div class="row" style="margin-top:8px;"><button id="munVolver">← ${TXT('mun.volver')}</button></div>`;
  $('bioBody').innerHTML = body;
  $('munVolver').onclick = mundialTorneoHub;
}

function _munTaboaGrupo(){
  /* puntos propios + partidos simulados entre os outros 3 (deterministas) */
  const filas = {};
  const ids = [MDATA.pais, ...MDATA.grupo.rivais];
  ids.forEach(id => filas[id] = {id, pts: 0, gf: 0, gc: 0});
  MDATA.grupo.res.forEach(r => {
    filas[MDATA.pais].pts += r.pts; filas[MDATA.pais].gf += r.gf; filas[MDATA.pais].gc += r.gc;
    filas[r.rival].pts += r.pts === 3 ? 0 : r.pts === 1 ? 1 : 3;
    filas[r.rival].gf += r.gc; filas[r.rival].gc += r.gf;
  });
  /* simulación dos cruces entre rivais (3 partidos), tantos como roldas xogadas */
  const cruces = [[0,1],[0,2],[1,2]];
  for(let i = 0; i < Math.min(MDATA.grupo.res.length, 3); i++){
    const [a, b] = cruces[i];
    const A = MDATA.grupo.rivais[a], B = MDATA.grupo.rivais[b];
    const s = _munSeed(50 + i);
    const ga = (s * 4) | 0, gb = ((s * 17) % 4) | 0;
    filas[A].gf += ga; filas[A].gc += gb; filas[B].gf += gb; filas[B].gc += ga;
    if(ga > gb) filas[A].pts += 3; else if(gb > ga) filas[B].pts += 3; else { filas[A].pts++; filas[B].pts++; }
  }
  return Object.values(filas).sort((x, y) => (y.pts - x.pts) || ((y.gf - y.gc) - (x.gf - x.gc)));
}

/* (v0.61.2) ALIÑACIÓN DE SAQUE: os XI despregados en liñas por posición,
   como a foto inicial dun partido — ENGINEERs á porta, SNIPERs detrás,
   HEAVYs no medio, GRUNTs na dianteira. Que se VEXA que o equipo está
   enteiro no campo desde o pitido (regra de Agarfal). */
function mundialAlinear(g, team){
  const LIÑAS = {ENGINEER: 50, SNIPER: 105, HEAVY: 165, GRUNT: 235, BOMBARDERO: 165};
  const hq = g.hq[team];
  const baseX = team === 0 ? hq.x + hq.w : hq.x;
  const dirX = team === 0 ? 1 : -1;
  const meus = g.units.filter(u => u.team === team && !u.dead);
  /* (v0.61.5) CENTRO VERTICAL = o do PROPIO HQ, non H/2: nos mapas grandes
     H/2 podía quedar a centos de px da cámara (que arranca no HQ) e o equipo
     formaba FÓRA DA PANTALLA — "os xogadores non están" de Agarfal. */
  const cy = Math.max(160, Math.min(H - 160, hq.y + hq.h / 2));
  const porClase = {};
  for(const u of meus){ (porClase[u.cls] = porClase[u.cls] || []).push(u); }
  for(const cls of Object.keys(porClase)){
    const grupo = porClase[cls];
    const dx = LIÑAS[cls] || 160;
    grupo.forEach((u, i) => {
      const y = cy + (i - (grupo.length - 1) / 2) * 52;
      const sp = nudgeSpawn(g, team, baseX + dirX * dx, Math.max(40, Math.min(H - 40, y)));
      u.x = sp.x; u.y = sp.y; u.tx = sp.x; u.ty = sp.y;
    });
  }
}

/* ---------- Lanzar partido ---------- */
function mundialXogarPartido(){
  const rid = _munRivalActual();
  const rv = MUN_PAISES.find(x => x.id === rid);
  const ronda = _munRonda();
  /* XI titular: os 11 primeiros dispoñibles (nin sancionados) */
  const dispo = MDATA.roster.filter(r => r.susp !== MDATA.partidoIdx);
  const titulares = dispo.slice(0, MUN_XI);
  const banquillo = dispo.slice(MUN_XI);
  if(titulares.length < MUN_XI){ alert(TXT('mun.senPlantel')); return; }

  if(game && !game.over){ alert(TXT('mun.batallaViva')); return; }
  window._mundialArranque = true;
  window._mundialBioma = rv.bioma;
  window._mundial = {
    rival: rv, ronda, titulares, banquillo,
    subsUsadas: 0, vermellas: [], mortos: [],
    subsRival: 0, vermellasRival: [],   /* (v0.61.1) regulamento bilateral */
    goles: [0, 0], golProg: [0, 0], matchT: 0, saqueDado: false,
  };
  $('bioModal').style.display = 'none';

  /* (v0.62) A COSTURA QUE FALTABA — o bug das 3 sesións: btnStart fai o
     CAMBIO DE ESCENA (agochar hangar, MOSTRAR battle, resetear radio) e
     ARRANCA O LOOP. mundialXogarPartido só creaba a batalla: existía nun
     cuarto escuro, sen simulación nin pintado. "Os xogadores non aparecen"
     — non aparecía NADA da batalla. */
  if(typeof setPlayerTeam === 'function') setPlayerTeam(0);
  try{ initAudio(); if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{}); }catch(e){}
  try{ if(typeof preloadVoices === 'function') preloadVoices(); }catch(e){}
  $('hangar').style.display = 'none';
  const _brf = document.getElementById('briefing'); if(_brf) _brf.style.display = 'none';
  $('battle').style.display = 'block';
  $('radio').innerHTML = `<div class="line small">— ${TXT('r.canal')} —</div>`;
  panelInterrupt = null;

  /* recs → mkUnit persiste: aplicar cicatriz + mellora de fase tras crear */
  const deployed = titulares.map(r => ({...r}));
  game = window._munGame = newBattle(deployed);   /* _munGame: depuración */
  game.modo = 'mundial';
  const k = 1 + 0.06 * ronda;
  const _tr = (t) => MDATA.trofeos.includes(t) ? 0.05 : 0;   /* (v0.61) trofeo = +5% */
  const kDmg = k * (1 + 0.06 * MDATA.mell.dmg + _tr('dmg'));
  const kHp  = k * (1 + 0.06 * MDATA.mell.hp  + _tr('hp'));
  const kSpd = 1 + 0.05 * MDATA.mell.spd + _tr('spd');
  const kRng = 1 + _tr('rng');
  for(const u of game.units){
    if(u.team !== PT) continue;
    const rec = titulares.find(r => r.id === u.id);
    const sc = rec ? rec.scar : 1;
    u.max = Math.round(u.max * sc * kHp); u.hp = u.max;
    if(u.dmg) u.dmg = u.dmg * sc * kDmg;
    if(u.spd) u.spd = u.spd * kSpd;
    if(u.rng) u.rng = u.rng * kRng;
    if(rec) u.dorsal = rec.dorsal;   /* (v0.61) dorsal visible no campo */
  }
  /* XI rival pola doutrina, coa mesma mellora de fase */
  const dout = MUN_DOUTRINAS[rv.dout];
  let di = 0;
  for(const cls of Object.keys(dout.form)){
    for(let i = 0; i < dout.form[cls]; i++){
      const sp = nudgeSpawn(game, ET, ET === 0 ? HQ[0].x + HQ[0].w + 30 : HQ[1].x - 30, HQ[ET].y - 30 + di * 26);
      const u = mkUnit(ET, cls, sp.x, sp.y, null);
      u.max = Math.round(u.max * k); u.hp = u.max;
      if(u.dmg) u.dmg = u.dmg * k;
      game.units.push(u);
      di++;
    }
  }
  /* (v0.61.2/5) aliñación de saque para os DOUS equipos + cámara á propia */
  mundialAlinear(game, PT);
  mundialAlinear(game, ET);
  {
    const meus = game.units.filter(u => u.team === PT && !u.dead);
    if(meus.length && typeof camJumpTo === 'function'){
      const mx2 = meus.reduce((a, u) => a + u.x, 0) / meus.length;
      const my2 = meus.reduce((a, u) => a + u.y, 0) / meus.length;
      camJumpTo(mx2, my2);   /* (v0.61.5) abres o partido MIRANDO ao teu XI */
    }
  }
  /* agresividade da doutrina → ritmo da IA */
  game.aiTimer = Math.round(240 / dout.agres);
  game._munAgres = dout.agres;
  /* O BALÓN: vehículo neutral no centro (jeep nas primeiras, tanque nas últimas) */
  const tanque = ronda >= 3;
  const DEF = tanque ? TANK_DEF : (typeof JEEP_DEF !== 'undefined' ? JEEP_DEF : TANK_DEF);
  game.vehicles.push({
    id: 'BALON', tipo: tanque ? 'TANQUE' : 'JEEP',
    x: W / 2, y: H / 2 - 40, tx: W / 2, ty: H / 2 - 40,
    hp: DEF.hp, max: DEF.hp, dmg: DEF.dmg, rng: DEF.rng,
    spd: DEF.spd, fireRate: DEF.fireRate, cool: 0,
    angle: 0, team: 2, occupant: null, destroyed: false, sel: false, waypoints: [],
  });
  const _nPT = game.units.filter(u => u.team === PT && !u.dead).length;
  const _nET = game.units.filter(u => u.team === ET && !u.dead).length;
  radio(TXT('mun.aliñacions', {p: _nPT, r: _nET}), '#7fd0ff');
  if(_nPT !== MUN_XI || _nET !== MUN_XI){
    if(typeof _tuercaOverlay === 'function') _tuercaOverlay('mundial: aliñación irregular ' + _nPT + 'v' + _nET + ' (debería ser 11v11) — captura isto');
  }
  const _txtSaque = TXT('mun.saque', {a: MUN_PAISES.find(x => x.id === MDATA.pais).nome, b: rv.nome});
  radio(_txtSaque, '#7fd0ff');
  if(typeof vozComentarista === 'function') vozComentarista('mun.saqueHQ', _txtSaque);   /* (v0.63) */
  mundialBotonCambio();
  updateSidePanel(game);
  requestAnimationFrame(loop);   /* (v0.62) o proxector, POR FIN */
}

/* ---------- Substitucións ---------- */
function mundialBotonCambio(){
  let b = document.getElementById('munCambio');
  if(!b){
    b = document.createElement('button');
    b.id = 'munCambio';
    const bar = document.getElementById('prodbar');
    if(bar) bar.appendChild(b);
    b.onclick = mundialCambio;
  }
  b.style.display = '';
  mundialActualizarCambio();
}
function mundialActualizarCambio(){
  const b = document.getElementById('munCambio');
  if(!b || !window._mundial) return;
  b.textContent = '⇄ ' + TXT('mun.cambio') + ' ' + window._mundial.subsUsadas + '/' + MUN_SUBS_MAX;
  b.disabled = window._mundial.subsUsadas >= MUN_SUBS_MAX;
}
function mundialCambio(){
  const M = window._mundial;
  if(!M || !game || game.over || M.subsUsadas >= MUN_SUBS_MAX) return;
  /* primeiro titular morto NON expulsado, substituído polo primeiro do banquillo da mesma clase (ou calquera) */
  const morto = game.units.find(u => u.team === PT && u.dead && !M.vermellas.includes(u.id) && !u._substituido);
  if(!morto){ radio(TXT('mun.senCambio'), '#ff8'); return; }
  /* (v0.61.1) tope duro: nunca máis de 11 vivos no campo */
  if(game.units.filter(u => u.team === PT && !u.dead).length >= MUN_XI){ radio(TXT('mun.senCambio'), '#ff8'); return; }
  let sub = M.banquillo.find(r => r.cls === morto.cls && !r._usado);
  if(!sub) sub = M.banquillo.find(r => !r._usado);
  if(!sub){ radio(TXT('mun.banquilloBaleiro'), '#ff8'); return; }
  sub._usado = true; morto._substituido = true;
  M.subsUsadas++;
  const sp = nudgeSpawn(game, PT, PT === 0 ? HQ[0].x + HQ[0].w + 30 : HQ[1].x - 30, HQ[PT].y + 10);
  const u = mkUnit(PT, sub.cls, sp.x, sp.y, {...sub});
  const k = 1 + 0.06 * M.ronda;
  u.max = Math.round(u.max * (sub.scar || 1) * k * (1 + 0.06 * MDATA.mell.hp)); u.hp = u.max;
  if(u.dmg) u.dmg = u.dmg * (1 + 0.06 * MDATA.mell.dmg);
  u.dorsal = sub.dorsal;
  game.units.push(u);
  radio(TXT('mun.entraCambio', {sae: morto.name, entra: sub.name}), '#7fd0ff');
  mundialActualizarCambio();
}

/* ---------- Fin de partido ---------- */
function mundialFinPartido(g){
  const M = window._mundial;
  if(!M || M._pechado) return;
  M._pechado = true;
  const b = document.getElementById('munCambio'); if(b) b.style.display = 'none';
  const gf = M.goles[PT], gc = M.goles[1 - PT];
  /* (v0.61) MVP: o propio con máis mérito (baixas + capturas dobres) */
  let mvp = null, mvpPts = -1;
  for(const u of g.units){
    if(u.team !== PT) continue;
    const pts = (u.kills || 0) + ((u.act && u.act.caps) || 0) * 2;
    if(pts > mvpPts){ mvpPts = pts; mvp = u; }
  }
  let res;                                   /* 'v' | 'e' | 'd' */
  if(g.result === 'victory' && g._munKO) res = 'v';
  else if(g.result === 'defeat' && g._munKO) res = 'd';
  else res = gf > gc ? 'v' : gf < gc ? 'd' : 'e';

  /* cicatrices ás baixas propias (agás vermellas: o chasis salvounas) + kills/goles ao rexistro */
  for(const u of g.units){
    if(u.team !== PT) continue;
    const rec = MDATA.roster.find(r => r.id === u.id);
    if(!rec) continue;
    rec.kills += (u.kills || 0);
    if(u.dead && !M.vermellas.includes(u.id)) rec.scar = Math.max(0.6, (rec.scar || 1) * 0.92);
  }
  /* sancións: as vermellas perden o SEGUINTE partido */
  for(const vid of M.vermellas){
    const rec = MDATA.roster.find(r => r.id === vid);
    if(rec) rec.susp = MDATA.partidoIdx + 1;
  }
  MDATA.roster.forEach(r => { delete r._usado; });
  /* goleadores: reparto simple entre os que capturaron */
  const golPts = gf;
  if(golPts > 0){
    const caps = g.units.filter(u => u.team === PT && u.act && u.act.caps > 0);
    (caps.length ? caps : g.units.filter(u => u.team === PT)).slice(0, golPts).forEach(u => {
      const rec = MDATA.roster.find(r => r.id === u.id);
      if(rec) rec.goles++;
    });
  }
  /* (v0.61) ORZAMENTO por rendemento: goles, baixas, resultado */
  const totKills = g.units.filter(u => u.team === PT).reduce((a, u) => a + (u.kills || 0), 0);
  const ganho = gf * 30 + totKills * 3 + (res === 'v' ? 40 : res === 'e' ? 15 : 0);
  MDATA.orz = (MDATA.orz || 0) + ganho;
  /* (v0.61) TROFEO: vencer unha doutrina nova = saquear a súa tecnoloxía */
  let trofeoNovo = null;
  if(res === 'v'){
    const t = MUN_DOUTRINAS[M.rival.dout].trofeo;
    if(!MDATA.trofeos.includes(t)){ MDATA.trofeos.push(t); trofeoNovo = t; }
  }
  MDATA.partidoIdx++;

  /* avanzar torneo */
  let msg;
  if(MDATA.fase === 'grupos'){
    MDATA.grupo.res.push({rival: M.rival.id, gf, gc, pts: res === 'v' ? 3 : res === 'e' ? 1 : 0});
    if(MDATA.grupo.res.length >= 3){
      const taboa = _munTaboaGrupo();
      const pos = taboa.findIndex(f => f.id === MDATA.pais);
      if(pos <= 1){
        MDATA.fase = 'semi';
        MDATA.semiRival = MDATA.outroGrupo[(_munSeed(80) * MDATA.outroGrupo.length) | 0];
        msg = TXT('mun.clasificado');
      } else { MDATA.fase = 'eliminado'; msg = TXT('mun.foraGrupos'); }
    } else msg = TXT('mun.res.' + res, {gf, gc});
  } else if(MDATA.fase === 'semi'){
    if(res === 'v' || (res === 'e' && gf >= gc)){   /* empate en semi: pasa o de máis goles a favor no torneo (simple M1) */
      MDATA.fase = 'final';
      const resto = MDATA.outroGrupo.filter(id => id !== MDATA.semiRival);
      MDATA.finalRival = resto[(_munSeed(90) * resto.length) | 0] || MDATA.grupo.rivais[0];
      msg = TXT('mun.aFinal');
    } else { MDATA.fase = 'eliminado'; msg = TXT('mun.foraSemi'); }
  } else if(MDATA.fase === 'final'){
    if(res === 'v'){ MDATA.fase = 'campion'; MDATA.palmares.push({pais: MDATA.pais, cando: Date.now()}); msg = TXT('mun.campion'); }
    else { MDATA.fase = 'eliminado'; msg = TXT('mun.subcampion'); }
  }
  mundialSave();
  window._mundialArranque = false;
  window._mundial = null;
  game = null;
  if(typeof setBioma === 'function') setBioma('VERDE');
  /* (v0.62) devolver a escena: o partido rematou, volvemos ao hangar */
  $('battle').style.display = 'none';
  $('hangar').style.display = 'block';
  /* resultado + volver ao hub */
  setTimeout(() => {
    fondoModal('mundial');
    $('bioTitle').innerHTML = TXT('mun.finTitulo');
    $('bioBody').innerHTML = `<div style="font-size:16px; margin:8px 0;">${TXT('mun.marcador')}: <b>${gf} - ${gc}</b>${g._munKO ? ' (KO)' : ''}</div>
      ${mvp && mvpPts > 0 ? `<div style="color:var(--gold);">⭐ MVP: <b>${mvp.dorsal ? mvp.dorsal + '·' : ''}${mvp.name}</b> (${mvpPts})</div>` : ''}
      <div class="small">⚙ +${ganho} ${TXT('mun.orzGanado')}</div>
      ${trofeoNovo ? `<div style="color:#e8c84a;">🏅 ${TXT('mun.trofeoNovo')}: ${TXT('mun.trofeo.' + trofeoNovo)}</div>` : ''}
      <div style="margin:8px 0;">${msg}</div>
      <div class="row"><button id="munSeguir">→ ${TXT('mun.seguir')}</button></div>`;
    $('bioModal').style.display = 'block';
    $('munSeguir').onclick = mundialTorneoHub;
  }, 400);
}

/* ---------- botón do hangar ---------- */
(function(){
  const b = document.getElementById('btnMundial');
  if(b) b.onclick = mundialHub;
})();
