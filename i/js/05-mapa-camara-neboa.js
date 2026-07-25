/* ============================================================
   XERADOR PROCEDURAL DE MAPAS (v0.16)
   Dous arquétipos: CUENCA (río+ponte) e LLANURA (chaira aberta,
   máis portas). Cada mapa nace con lugares con nome propio.
   ============================================================ */
const NOMES_LUGARES = [
  'la Loma Quemada','el Cruce Negro','el Vado del Eco','la Cantera Hundida',
  'los Almacenes','el Depósito Seco','la Chatarrería','el Taller Viejo',
  'el Paso del Óxido','la Torre Caída','los Silos','el Cementerio de Latas',
  'la Zanja Larga','el Collado Roto','las Bobinas','el Horno Frío',
  'la Presa Vieja','el Mirador','los Tanques Oxidados','la Fundición',
  'el Corral de Chatarra','la Loma del Radar','el Barranco','las Antenas',
  'el Puesto Fantasma','la Curva del Diablo','los Pilones','el Aparcadero',
  'la Falla','el Nido de Grúas','las Turbinas','el Vertedero Norte',
  'la Explanada','el Túnel Ciego','los Andamios','la Rotonda Muerta',
  'el Kilómetro Cero','la Báscula','el Peaje Abandonado','las Cocheras',
];
const NOMES_ZONAS = ['LA CUENCA','EL PÁRAMO','LA HONDONADA','EL SECARRAL','LA VAGUADA','EL ERIAL','LA MESETA','EL BALDÍO'];

function _slug(s){ return s.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g,'_'); }
function _snap(v){ return Math.round(v/16)*16; }

/* (v0.39) xeración SEMENTADA: co mesmo seed, o mesmo mapa en calquera máquina.
   É o que permite mapas procedurais no PvP (o host publica só o número). */
function genMap(seed){
  if(seed){
    const _mr = Math.random;
    Math.random = seededRand(seed >>> 0);
    try{ return _genMapImpl(); } finally { Math.random = _mr; }
  }
  return _genMapImpl();
}
function _genMapImpl(){
  const arq = Math.random() < 0.55 ? 'CUENCA' : 'LLANURA';
  /* (v0.61) MUNDIAL: campos GRANDES sempre (XI contra XI precisa aire;
     os combos de velocidade cobran sentido) */
  const _mun = !!window._mundialArranque;
  const W = (_mun ? 2560 : 1792) + Math.floor(Math.random()*9)*64;
  const H = (_mun ? 1408 : 1024) + Math.floor(Math.random()*5)*64;
  const roadY = _snap(H*0.40 + Math.random()*H*0.18);
  const BRIDGE = {y1: roadY, y2: roadY + 64};
  let RIVER, BRIDGE_CENTER;
  if(arq === 'CUENCA'){
    const rx = _snap(W*0.40 + Math.random()*W*0.20);
    RIVER = {x1: rx, x2: rx + 64};
    BRIDGE_CENTER = {x: rx + 32, y: roadY + 32};
  } else {
    RIVER = {x1: -999, x2: -998};   /* sen río: fóra de pantalla */
    BRIDGE_CENTER = {x: Math.round(W/2), y: roadY + 32};
  }
  const RADAR_DOME = {
    x: _snap(W*0.40 + Math.random()*W*0.20),
    y: (Math.random() < 0.7) ? 120 + Math.floor(Math.random()*60) : H - 200 + Math.floor(Math.random()*40),
    w: 48, h: 36, capRadius: 42,
  };
  const HQ = [
    {team:0, x:60,     y:roadY - 22, w:74, h:84},
    {team:1, x:W - 134, y:roadY - 22, w:74, h:84},
  ];
  /* Sectores: 6-9 puntos con separación mínima, fóra de río/estrada/HQs/radar */
  const nomes = [...NOMES_LUGARES].sort(()=>Math.random()-0.5);
  const nSec = 6 + Math.floor(Math.random()*4);
  const SECTORS = [], PLACES = [];
  let intentos = 0;
  while(SECTORS.length < nSec && intentos++ < 400){
    const x = 260 + Math.random()*(W - 520);
    const y = 140 + Math.random()*(H - 280);
    if(arq==='CUENCA' && x > RIVER.x1 - 90 && x < RIVER.x2 + 90) continue;   /* fóra do río */
    if(y > roadY - 100 && y < roadY + 164) continue;                          /* fóra da estrada */
    if(Math.hypot(x - (RADAR_DOME.x+24), y - (RADAR_DOME.y+18)) < 130) continue;
    if(SECTORS.some(s => Math.hypot(s.x-x, s.y-y) < 200)) continue;
    const nome = nomes[SECTORS.length];
    const pid = _slug(nome);
    SECTORS.push({id: String.fromCharCode(65 + SECTORS.length), x:_snap(x), y:_snap(y), r:56, place: pid});
    PLACES.push({id: pid, x:_snap(x), y:_snap(y), r:80, label: nome});
  }
  /* Lugares fixos */
  if(arq==='CUENCA') PLACES.push({id:'PUENTE_CENTRAL', x:BRIDGE_CENTER.x, y:BRIDGE_CENTER.y, r:90, label:'el Puente Central'});
  else PLACES.push({id:'CRUCE_CENTRAL', x:BRIDGE_CENTER.x, y:BRIDGE_CENTER.y, r:90, label:'el Cruce Central'});
  PLACES.push({id:'RADAR_DOME', x:RADAR_DOME.x+24, y:RADAR_DOME.y+18, r:60, label:'el Radar Central'});
  PLACES.push({id:'HQ_AZUL', x:100, y:roadY+20, r:110, label:'el HQ Azul'});
  PLACES.push({id:'HQ_ROJO', x:W-100, y:roadY+20, r:110, label:'el HQ Rojo'});
  /* Torretas e jeeps: 2+2 por bando preto dos HQs, con jitter */
  const TURRETS = [
    {id:'T_AZUL',  x:_snap(280 + Math.random()*80),  y:_snap(roadY + 80 + Math.random()*60),  angle:-Math.PI/2},
    {id:'T_AZUL2', x:_snap(280 + Math.random()*80),  y:_snap(roadY - 120 - Math.random()*60), angle:-Math.PI/2},
    {id:'T_ROJO',  x:_snap(W - 360 + Math.random()*80), y:_snap(roadY + 80 + Math.random()*60),  angle:Math.PI/2},
    {id:'T_ROJO2', x:_snap(W - 360 + Math.random()*80), y:_snap(roadY - 120 - Math.random()*60), angle:Math.PI/2},
  ];
  const nJeeps = Math.random() < 0.5 ? 1 : 2;
  const JEEPS = [];
  for(let i=0; i<nJeeps; i++){
    JEEPS.push({id:'J_AZUL'+(i?i+1:''), x:_snap(340 + Math.random()*60), y:_snap(roadY - 40 + i*90)});
    JEEPS.push({id:'J_ROJO'+(i?i+1:''), x:_snap(W - 400 + Math.random()*60), y:_snap(roadY - 40 + i*90)});
  }
  /* Portas de muro na estrada */
  const WALLS = [];
  if(arq === 'CUENCA'){
    WALLS.push({x:_snap(HQ[0].x + 340 + Math.random()*(RIVER.x1 - HQ[0].x - 520)), yStart:roadY, yEnd:roadY+64});
    WALLS.push({x:_snap(RIVER.x2 + 180 + Math.random()*(HQ[1].x - RIVER.x2 - 520)), yStart:roadY, yEnd:roadY+64});
  } else {
    for(const f of [0.28, 0.50, 0.72]){
      WALLS.push({x:_snap(W*f + (Math.random()*120-60)), yStart:roadY, yEnd:roadY+64});
    }
  }
  const zona = NOMES_ZONAS[Math.floor(Math.random()*NOMES_ZONAS.length)];
  const apelido = nomes[nSec] || NOMES_LUGARES[0];
  return {W, H, RIVER, BRIDGE, BRIDGE_CENTER, RADAR_DOME, PLACES, SECTORS, HQ, TURRETS, JEEPS, WALLS,
          NAME: `${zona}, zona de ${apelido}`, ARQ: arq};
}

/* Variables globais do mapa actual — INICIALÍZANSE coa configuración do MAP1
   e cámbianse con applyMap() en newBattle */
let W=MAP1.W, H=MAP1.H;
let RIVER=MAP1.RIVER, BRIDGE=MAP1.BRIDGE, BRIDGE_CENTER=MAP1.BRIDGE_CENTER;
let RADAR_DOME=MAP1.RADAR_DOME;
let PLACES=MAP1.PLACES, SECTORS=MAP1.SECTORS, HQ=MAP1.HQ;
let CURRENT_MAP = MAP1;

/* ============================================================
   CÁMARA (v0.13) — viewport móbil estilo Z
   ============================================================ */
const CAM_VW = 1280, CAM_VH = 720;      /* tamaño máximo do viewport */
let cam = {x: 0, y: 0};
/* (v0.50.2) ZOOM lixeiro da cámara (roda do rato sobre o mapa), 1x-1.8x */
let camZoom = 1;
let _mmRect = null;                      /* rect do minimapa en coords de pantalla */
let _mouseScr = {x: 0, y: 0, inside: false};

function camClamp(){
  cam.x = Math.max(0, Math.min(cam.x, W - cv.width / camZoom));
  cam.y = Math.max(0, Math.min(cam.y, H - cv.height / camZoom));
}
function camJumpTo(x, y){
  cam.x = x - cv.width/2;
  cam.y = y - cv.height/2;
  camClamp();
}
let _camKeys = new Set();
let _mouseClient = {x:-9999, y:-9999};
window.addEventListener('mousemove', e => { _mouseClient.x = e.clientX; _mouseClient.y = e.clientY; });

function updateCamera(){
  const M = 26, S = 10;
  /* Edge-scroll: calculado desde coords de documento — segue funcionando
     aínda que o rato saia do canvas (ata 60px máis alá) */
  const r = cv.getBoundingClientRect();
  if(r.width > 0){
    const sx = (_mouseClient.x - r.left) * (cv.width / r.width);
    const sy = (_mouseClient.y - r.top) * (cv.height / r.height);
    const OUT = 60;
    if(sx > -OUT && sx < cv.width + OUT && sy > -OUT && sy < cv.height + OUT){
      if(sx < M) cam.x -= S;
      if(sx > cv.width - M) cam.x += S;
      if(sy < M) cam.y -= S;
      if(sy > cv.height - M) cam.y += S;
    }
  }
  /* Teclas continuas (mantén premido = movemento suave) */
  const KS = 11;
  if(_camKeys.has('left'))  cam.x -= KS;
  if(_camKeys.has('right')) cam.x += KS;
  if(_camKeys.has('up'))    cam.y -= KS;
  if(_camKeys.has('down'))  cam.y += KS;
  camClamp();
}
document.addEventListener('keydown', e => {
  if(e.key==='ArrowLeft'||e.key==='a') _camKeys.add('left');
  if(e.key==='ArrowRight'||e.key==='d') _camKeys.add('right');
  if(e.key==='ArrowUp'||e.key==='w') _camKeys.add('up');
  if(e.key==='ArrowDown'||e.key==='s') _camKeys.add('down');
});
document.addEventListener('keyup', e => {
  if(e.key==='ArrowLeft'||e.key==='a') _camKeys.delete('left');
  if(e.key==='ArrowRight'||e.key==='d') _camKeys.delete('right');
  if(e.key==='ArrowUp'||e.key==='w') _camKeys.delete('up');
  if(e.key==='ArrowDown'||e.key==='s') _camKeys.delete('down');
});

function drawMinimap(g){
  if(!TERRAIN_CACHE) return;
  const MM_W = 150;
  const mmH = Math.max(40, Math.round(MM_W * H / W));
  const mx = cv.width - MM_W - 8, my = cv.height - mmH - 8;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.drawImage(TERRAIN_CACHE, mx, my, MM_W, mmH);
  ctx.globalAlpha = 1;
  const sx = MM_W / W, sy = mmH / H;
  /* HQs */
  for(let i=0; i<g.hq.length; i++){
    const h = g.hq[i];
    ctx.fillStyle = i===0 ? '#4f8aff' : '#ff5340';
    ctx.fillRect(mx + h.x*sx, my + h.y*sy, Math.max(4, h.w*sx), Math.max(4, h.h*sy));
  }
  /* Unidades como puntos */
  if(g.subquests){
    for(const q of g.subquests){
      if(q._gone || q.done || q.failed) continue;
      ctx.fillStyle = '#b48aff';
      ctx.fillRect(mx + q.x*sx - 2, my + q.y*sy - 2, 4, 4);
    }
  }
  for(const u of g.units){
    if(u.dead || u.inside) continue;
    if(u.team === ET && !foeVisible(u, g)) continue;   /* (v0.20) néboa */
    ctx.fillStyle = u.team===0 ? '#8ac0ff' : (u.team===2 ? '#d8d8d8' : '#ff8a70');
    ctx.fillRect(mx + u.x*sx - 1, my + u.y*sy - 1, 2, 2);
  }
  /* (v0.54) PINGS de combate: cada explosión brilla e esvaece no minimapa —
     lees onde está a pelexa sen mover a cámara */
  if(g.booms) for(const b of g.booms){
    if(b.t <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, b.t / 14));
    ctx.fillStyle = '#ffd24a';
    const pr = b.big ? 2 : 1;
    ctx.fillRect(mx + b.x*sx - pr, my + b.y*sy - pr, pr*2 + 1, pr*2 + 1);
    ctx.restore();
  }
  /* Rectángulo do viewport */
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1;
  ctx.strokeRect(mx + cam.x*sx, my + cam.y*sy, cv.width*sx, cv.height*sy);
  /* Marco */
  ctx.strokeStyle = '#8a6200';
  ctx.strokeRect(mx - 1, my - 1, MM_W + 2, mmH + 2);
  ctx.restore();
  _mmRect = {x: mx, y: my, w: MM_W, h: mmH};
}

/* ============================================================
   NÉBOA DE GUERRA (v0.20) — o terreo sempre á vista; os INIMIGOS
   só onde tes ollos. Sniper: 110 en movemento, 190 parado.
   Disparar delata (~1.5s).
   ============================================================ */
const VISION = {
  GRUNT:150, HEAVY:150, ENGINEER:130, BOMBARDERO:140,
  SNIPER_MOVE:110, SNIPER_STILL:190, SNIPER_STILL_FRAMES:90,
  VEH:160, HQ:190, TURRET:160, RADAR:320, REVEAL_FRAMES:90,
};
let _visSources = [];
function computeVision(g){
  _visSources.length = 0;
  for(const u of g.units){
    if(u.dead || u.team !== PT || u.inside) continue;
    let r;
    if(u.cls === 'SNIPER'){
      r = (g.t - (u._movedT || 0) > VISION.SNIPER_STILL_FRAMES) ? VISION.SNIPER_STILL : VISION.SNIPER_MOVE;
    } else {
      r = VISION[u.cls] || 150;
    }
    if(u.equipment && u.equipment.includes('optica_termica')) r += 40;
    _visSources.push({x:u.x, y:u.y, r});
  }
  for(const v of g.vehicles){
    if(!v.destroyed && v.team === PT) _visSources.push({x:v.x, y:v.y, r:VISION.VEH});
  }
  for(const t of g.turrets){
    if(!t.destroyed && t.team === PT) _visSources.push({x:t.x, y:t.y, r:VISION.TURRET});
  }
  const hq = g.hq[PT];
  _visSources.push({x:hq.x + hq.w/2, y:hq.y + hq.h/2, r:VISION.HQ});
  if(g.radar && g.radar.owner === PT){
    _visSources.push({x:g.radar.x, y:g.radar.y, r:VISION.RADAR});
  }
  /* (v0.26) o clima come visión a TODAS as fontes */
  const _cf = (g.clima && g.clima.vis) || 1;
  if(_cf !== 1) for(const s of _visSources) s.r *= _cf;
}
function posVisible(x, y){
  for(const s of _visSources){
    if(Math.hypot(x - s.x, y - s.y) <= s.r) return true;
  }
  return false;
}
function foeVisible(u, g){
  if(!u || u.team !== ET) return true;
  if(u._revealT && g.t - u._revealT < VISION.REVEAL_FRAMES) return true;
  return posVisible(u.x, u.y);
}
function vehVisible(v, g){
  if(!v || v.team !== ET) return true;
  if(v._revealT && g.t - v._revealT < VISION.REVEAL_FRAMES) return true;
  return posVisible(v.x, v.y);
}

function applyMap(m){
  W = m.W; H = m.H;
  RIVER = m.RIVER; BRIDGE = m.BRIDGE; BRIDGE_CENTER = m.BRIDGE_CENTER;
  RADAR_DOME = m.RADAR_DOME;
  PLACES = m.PLACES; SECTORS = m.SECTORS; HQ = m.HQ;
  CURRENT_MAP = m;
  /* Axustar grid de tiles ó tamaño do mapa */
  COLS = Math.ceil(W / TILE_SIZE);
  ROWS = Math.ceil(H / TILE_SIZE);
  /* Redimensionar canvas se existe */
  if(typeof cv !== 'undefined' && cv){
    cv.width = Math.min(W, CAM_VW);
    cv.height = Math.min(H, CAM_VH);
    cam.x = 0; cam.y = 0;
  }
}

function inWater(x,y){
  return x>RIVER.x1 && x<RIVER.x2 && !(y>BRIDGE.y1 && y<BRIDGE.y2);
}
/* ¿La línea entre (x1,y1) y (x2,y2) cruza el río? */
function crossesRiver(x1, x2){
  return (x1 < RIVER.x1 && x2 > RIVER.x2) || (x1 > RIVER.x2 && x2 < RIVER.x1);
}

function placeAt(x, y){
  let best=null, bd=Infinity;
  for(const p of PLACES){
    const d=Math.hypot(x-p.x, y-p.y);
    if(d<p.r && d<bd){ best=p; bd=d; }
  }
  return best ? best.id : 'CAMPO_ABIERTO';
}
function placeLabel(id){
  /* (v0.41) Lugares fixos → clave i18n; sectores con nome propio quedan tal cal */
  const FIX = {PUENTE_CENTRAL:'lugar.ponte', CRUCE_CENTRAL:'lugar.cruce',
               RADAR_DOME:'lugar.radar', HQ_AZUL:'lugar.hqAzul', HQ_ROJO:'lugar.hqVermello'};
  if(FIX[id]) return TXT(FIX[id]);
  const p = PLACES.find(x=>x.id===id);
  return p ? p.label : TXT('lugar.campo');
}

/* ---------- Utilidades ---------- */
const dist=(a,b)=>Math.hypot(a.x-b.x, a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function fmtTime(s){ return Math.floor(s/60)+'m '+String(Math.floor(s%60)).padStart(2,'0')+'s'; }

/* ---------- Radio ---------- */
function radio(text, color, pos){
  if(typeof glNorm === 'function') text = glNorm(text);
  const box=document.getElementById('radio');
  const d=document.createElement('div');
  d.className='line'; d.textContent='> '+text;
  if(color) d.style.color=color;
  /* (v0.13) Radio navegable: clic para saltar a cámara ao lugar do evento */
  if(pos && typeof pos.x === 'number'){
    d.style.cursor = 'pointer';
    d.title = '▸ clic para ir alí';
    d.addEventListener('click', ()=>{ if(typeof camJumpTo==='function') camJumpTo(pos.x, pos.y); });
  }
  box.appendChild(d);
  while(box.children.length>6) box.removeChild(box.firstChild);
}

