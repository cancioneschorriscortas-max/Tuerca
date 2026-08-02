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

/* ============================================================
   (v0.77) PERSISTENCIA — A CAMPAÑA GARDÁBASE SÓ EN MEMORIA.

   Isto usaba `window.storage`, que NON EXISTE en ningún navegador
   nin se define en ningures do proxecto: era do arnés de probas.
   `saveData` lanzaba en cada chamada e o `catch(e){}` baleiro
   tragábao. A partida vivía en memStore mentres a lapela estivese
   aberta e desaparecía ao recargar.

   (O mesmo erro atopárase na v0.61.3 no módulo do Mundial e
   arranxárase alí, pero non se volveu ao núcleo.)

   Agora: localStorage, coma o resto do proxecto, con tres
   proteccións que antes non había —
     1. COPIA DE SEGURIDADE: antes de pisar o gardado bo, o anterior
        pasa a unha segunda ranura. Unha escritura mala non leva a
        campaña por diante.
     2. VALIDACIÓN AO LER: se o JSON está roto ou non ten a forma
        dunha partida, tírase e próbase a copia.
     3. OS FALLOS VÉNSE. Tragar excepcións en silencio é o que
        permitiu que isto durase tanto: agora un fallo de escritura
        avisa por pantalla.
   ============================================================ */
const SAVE_CLAVE  = 'tuerca-roster';
const SAVE_COPIA  = 'tuerca-roster-copia';

let memStore = null;
let _saveAvisado = false;   /* non repetir o aviso en cada gardado */

/* Le unha ranura e devolve a partida migrada, ou null se non serve. */
function _lerRanura(clave){
  try{
    const txt = localStorage.getItem(clave);
    if(!txt) return null;
    const d = JSON.parse(txt);
    /* Forma mínima dunha partida. Sen isto, un JSON válido pero doutra
       cousa entraría e petaría moito máis adiante, lonxe da causa. */
    if(!d || typeof d !== 'object' || !Array.isArray(d.units) || typeof d.opCount !== 'number'){
      return null;
    }
    return migrate(d);
  }catch(e){ return null; }
}

async function loadData(){
  const bo = _lerRanura(SAVE_CLAVE);
  if(bo){ memStore = bo; return bo; }

  const copia = _lerRanura(SAVE_COPIA);
  if(copia){
    memStore = copia;
    console.warn('[save] a ranura principal non servía; recuperada a copia');
    if(typeof radio === 'function'){
      try{ radio('⚠ Partida recuperada da copia de seguridade.', '#ffd24a'); }catch(_){}
    }
    return copia;
  }
  /* Nin unha nin outra: se hai algo en memoria desta sesión, mellor iso
     que empezar de cero por un fallo pasaxeiro de lectura. */
  return memStore || freshData();
}

async function saveData(d){
  /* REDE DE SEGURIDADE. Un gardado cunha partida ACABADA DE NACER
     —ninguén no roster, ningún caído, cero operacións— enriba dunha que
     si ten contido non é nunca o que quere o xogador: é código que
     preguntou antes de cargar. Pasou dúas veces e a segunda custoulle a
     campaña ao dono.

     Borrar de verdade (btnWipe) pasa por wipeData(), que quita as
     chaves primeiro, así que aquí xa non hai nada que protexer e a
     garda non estorba. */
  try{
    const previo = localStorage.getItem(SAVE_CLAVE);
    const baleira = d && !(d.units||[]).length && !(d.fallen||[]).length && !(d.opCount||0);
    if(baleira && previo){
      const p = JSON.parse(previo);
      if((p.units||[]).length || (p.fallen||[]).length || (p.opCount||0)){
        console.error('[save] BLOQUEADO: intentouse gardar unha partida baleira enriba dunha con contido');
        return;
      }
    }
  }catch(_){}
  memStore = d;
  try{
    const txt = JSON.stringify(d);
    const anterior = localStorage.getItem(SAVE_CLAVE);
    /* A copia faise ANTES de pisar, e só se cambiou algo. */
    if(anterior && anterior !== txt){
      try{ localStorage.setItem(SAVE_COPIA, anterior); }catch(_){}
    }
    localStorage.setItem(SAVE_CLAVE, txt);
    _saveAvisado = false;
    /* (v0.81) AVISO DE CAMBIO. A columna de estado do hangar pintábase só
       ao entrar (showHangar) e ao cambiar de idioma, así que calquera cousa
       que mudase os datos estando xa dentro —encargar unha reensamblaxe,
       despezar, renomear— deixaba o panel rancio ata saír e volver.
       saveData é o punto polo que pasa TODO cambio real e non se chama nin
       unha vez dentro do bucle de batalla, así que sae barato. */
    if(typeof datosCambiaron === 'function'){
      try{ datosCambiaron(); }catch(e){ console.error('[datosCambiaron]', e); }
    }
    return true;
  }catch(e){
    /* Cota chea, modo privado, permisos... O importante é NON calar. */
    console.error('[save] non se puido gardar', e);
    if(!_saveAvisado){
      _saveAvisado = true;
      if(typeof _tuercaOverlay === 'function'){
        _tuercaOverlay('NON SE PODE GARDAR A PARTIDA (' + (e && e.name || 'erro') +
                       ').\nExporta cun clic en 💾 antes de pechar.');
      }
    }
    return false;
  }
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
  /* As dúas ranuras: se non, "borrar todos os datos" deixaría a copia e a
     partida volvería soa na seguinte carga. */
  for(const k of [SAVE_CLAVE, SAVE_COPIA]){
    try{ localStorage.removeItem(k); }catch(e){ console.error('[save] non se puido borrar ' + k, e); }
  }
}

