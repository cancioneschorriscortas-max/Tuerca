/* ============================================================
   TUERCA v0.2 — HITO A
   Cambios sobre v0.1:
     - Heavy usa el puente (waypoints)
     - Lugares con nombre (placeAt)
     - Sistema de eventos con lugar (eventos persistentes)
     - Restos recuperables por Engineer
     - Medallas cosméticas
     - Biografía leíble en el hangar
   ============================================================ */

/* ---------- Persistencia (con fallback en memoria) ---------- */

/* === SPRITES dos edificios (v0.7) === */
const ASSETS = { hqBlue:null, hqRed:null, radarBlue:null, radarRed:null, radarNeutral:null, tankRed:null, tankBlue:null, tankNeutral:null };
let _assetsLoaded = 0; const _assetsTotal = 13;
function _loadAsset(key, dataUrl){
  const img = new Image();
  img.onload = () => { ASSETS[key] = img; _assetsLoaded++; };
  img.onerror = () => { console.warn('Asset failed:', key); _assetsLoaded++; };
  img.src = dataUrl;
}

/* === SPRITES de torretas (v0.8) === */

/* === SPRITES de jeeps (v0.9) === */
/* (v0.17.2) Sprites do TANQUE — cañón cara ao SUR, pivote no centro do corpo */

let memStore = null;
async function loadData(){
  try{
    const r = await window.storage.get('tuerca-roster');
    if(!r) return freshData();
    const d = JSON.parse(r.value);
    return migrate(d);
  }catch(e){ return memStore ? memStore : freshData(); }
}
async function saveData(d){
  memStore = d;
  try{ await window.storage.set('tuerca-roster', JSON.stringify(d)); }catch(e){}
}
/* ============================================================
   EXPORT / IMPORT (v0.22.2) — a caixa forte. Todo o roster,
   pezas, vínculos, campaña e memoria nun JSON descargable.
   ============================================================ */
function exportPartida(){
  const d = {...DATA, _formato: 'TUERCA', _version: 'v0.22', _exportado: new Date().toISOString()};
  return JSON.stringify(d, null, 1);
}
function descargarPartida(){
  const json = exportPartida();
  const blob = new Blob([json], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tuerca_op${DATA.opCount||0}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function importPartidaTexto(txt){
  let d;
  try{ d = JSON.parse(txt); }
  catch(e){ return {ok:false, erro:'O ficheiro non é JSON válido.'}; }
  if(!d || d._formato !== 'TUERCA' || typeof d.opCount !== 'number' || !Array.isArray(d.units)){
    return {ok:false, erro:'O ficheiro non parece unha partida de TUERCA.'};
  }
  delete d._formato; delete d._version; delete d._exportado;
  for(const k of Object.keys(DATA)) delete DATA[k];
  Object.assign(DATA, d);
  await saveData(DATA);
  return {ok:true, ops: DATA.opCount, unidades: (DATA.units||[]).length};
}

/* ============================================================
   CRÓNICA DE GUERRA (v0.25.2) — o xogo escribe a túa historia.
   ============================================================ */
function xerarCronica(){
  const L = [];
  L.push(`# TUERCA — CRÓNICA DE GUERRA`);
  L.push(`### Operación ${DATA.opCount||0} de ${CAMPAIGN_LEN} · ${DATA.campWins||0} vitorias / ${DATA.campLosses||0} derrotas`);
  L.push('');
  const act = campaignAct();
  L.push(DATA.campaignEnded ? `**A campaña rematou.**` : `Acto ${act.n}: ${act.label}.`);
  L.push('');
  L.push(`## O ESCUADRÓN (${(DATA.units||[]).length})`);
  for(const r of (DATA.units||[]).slice().sort((a,b)=>(b.ops||0)-(a.ops||0))){
    let liña = `- **${nomeCompleto(r)}** (${r.cls}) — ${r.ops||0} ops, ${r.kills||0} baixas`;
    if(r.confianza !== undefined) liña += `, confianza ${r.confianza}`;
    L.push(liña);
    if(r.vinculos && r.vinculos.length){
      L.push(`  - ★ ${r.vinculos.map(v=>(v.tipo==='CAMARADA'?`camarada de ${v.conNome}`:`en débeda con ${v.conNome}`)).join(' · ')}`);
    }
    if(r.piezasDe && r.piezasDe.length){
      L.push(`  - ⟲ Reensamblado con pezas de ${r.piezasDe.join(', ')}${r.sinergia && SINERXIAS[r.sinergia] ? ` (✦ ${SINERXIAS[r.sinergia].label})` : ''}`);
    }
    if(r.equipment && r.equipment.some(e=>['optica_termica','servo_alleo'].includes(e))){
      L.push(`  - ◈ Leva tecnoloxía roubada`);
    }
  }
  L.push('');
  L.push(`## OS QUE NON VOLVERON (${(DATA.fallen||[]).length})`);
  for(const f of (DATA.fallen||[])) L.push(`- ${f}`);
  if((DATA.iaArquivo||[]).length){
    L.push('');
    L.push(`## IAs EN ARQUIVO (reconstruíbles): ${DATA.iaArquivo.map(r=>r.name).join(', ')}`);
  }
  if((DATA.piezasEnemigas||[]).length){
    L.push('');
    L.push(`## EN MANS INIMIGAS`);
    for(const p of DATA.piezasEnemigas) L.push(`- ${PEZA_LABEL[p.tipo]} de ${p.deNome} (perdida na Op ${p.op})`);
  }
  if((DATA.voltRoster||[]).length){
    L.push('');
    L.push(`## OS VETERANOS DE VOLT — apunta os nomes`);
    for(const v of DATA.voltRoster) L.push(`- ${v.name} (${v.cls}) — ${v.ops} ops, ${v.kills} baixas nosas`);
  }
  L.push('');
  L.push(`---`);
  L.push(`*"If the future is this war, then pour another one."*`);
  L.push(`*Exportada o ${new Date().toLocaleDateString()}.*`);
  return L.join('\n');
}
function descargarCronica(){
  const blob = new Blob([xerarCronica()], {type:'text/markdown'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tuerca_cronica_op${DATA.opCount||0}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function wipeData(){
  memStore = null;
  try{ await window.storage.delete('tuerca-roster'); }catch(e){}
}

