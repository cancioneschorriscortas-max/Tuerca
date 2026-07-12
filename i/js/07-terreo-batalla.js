/* ============================================================
   TERRENO POR CELDAS CON AUTOTILING GEOMÉTRICO (v0.4)
   El mapa se divide en una rejilla 60×34 de celdas de 16×16 px.
   Cada celda tiene un tipo. Al dibujar, cada celda consulta a
   sus 8 vecinas y dibuja transiciones suaves entre tipos
   distintos. Sin imágenes externas — geometría procedural pura.

   Tipos definidos:
     0 GRASS  — hierba/tierra de fondo (verde grisáceo industrial)
     1 DIRT   — tierra árida (ocre oscuro)
     2 WATER  — agua/río
     3 ROAD   — asfalto/carretera
     4 BRIDGE — puente sobre agua
     5 RUBBLE — escombros/grava
   ============================================================ */
const TILE_SIZE = 16;
let COLS = 60;  /* 960/16 = 60 (MAP1) */
let ROWS = 34;  /* 540/16 ≈ 34 */
const T = {GRASS:0, DIRT:1, WATER:2, ROAD:3, BRIDGE:4, RUBBLE:5};

/* Paletas por tipo: base oscura, base media, base clara, acento */
const TILE_PALETTES = {
  [T.GRASS]:  {dark:'#0e1409', base:'#1a230f', light:'#2a3318', accent:'#3a4520'},
  [T.DIRT]:   {dark:'#1f160e', base:'#2c1f12', light:'#3d2c18', accent:'#5a3e22'},
  [T.WATER]:  {dark:'#0a1928', base:'#10283f', light:'#1a3850', accent:'#2a5070'},
  [T.ROAD]:   {dark:'#1a1a16', base:'#2a2a24', light:'#3a3a30', accent:'#4a4a3a'},
  [T.BRIDGE]: {dark:'#3a2818', base:'#5a4632', light:'#7a6244', accent:'#9a7e54'},
  [T.RUBBLE]: {dark:'#2a2520', base:'#3d3530', light:'#5a4e44', accent:'#7a685a'},
};

/* Jerarquía: cuál "gana" en transiciones. El de mayor número dibuja por encima.
   Esto permite que la carretera "monte" sobre la hierba sin parpadeos. */
const TILE_RANK = {
  [T.WATER]:  0,
  [T.GRASS]:  1,
  [T.DIRT]:   2,
  [T.RUBBLE]: 3,
  [T.ROAD]:   4,
  [T.BRIDGE]: 5,
};

/* Generar el mapa por defecto — usa as coordenadas do mapa actual (RIVER, BRIDGE) */
function buildDefaultMap(){
  const grid = [];
  for(let y=0; y<ROWS; y++){
    grid[y] = [];
    for(let x=0; x<COLS; x++){
      grid[y][x] = T.GRASS;
    }
  }
  /* Carretera horizontal central primeiro: a mesma altura que a ponte */
  const bridgeRowStart = Math.floor(BRIDGE.y1/TILE_SIZE);
  const bridgeRowEnd   = Math.floor(BRIDGE.y2/TILE_SIZE);
  for(let y=bridgeRowStart; y<=bridgeRowEnd; y++){
    for(let x=0; x<COLS; x++){
      grid[y][x] = T.ROAD;
    }
  }
  /* Río vertical despois: pisa estrada onde corresponda, pondo BRIDGE no cruce */
  const riverColStart = Math.floor(RIVER.x1/TILE_SIZE);
  const riverColEnd   = Math.floor(RIVER.x2/TILE_SIZE);
  for(let y=0; y<ROWS; y++){
    for(let x=riverColStart; x<=riverColEnd; x++){
      if(y < bridgeRowStart || y > bridgeRowEnd){
        grid[y][x] = T.WATER;
      } else {
        grid[y][x] = T.BRIDGE;
      }
    }
  }
  /* Parches de tierra árida alrededor de los HQs y manchas dispersas para textura */
  for(let i=0; i<60; i++){
    const cx = Math.floor(Math.random() * COLS);
    const cy = Math.floor(Math.random() * ROWS);
    const r  = 1 + Math.floor(Math.random()*2);
    for(let y=cy-r; y<=cy+r; y++){
      for(let x=cx-r; x<=cx+r; x++){
        if(y<0||y>=ROWS||x<0||x>=COLS) continue;
        if(grid[y][x] !== T.GRASS) continue;
        if(Math.hypot(x-cx, y-cy) <= r) grid[y][x] = T.DIRT;
      }
    }
  }
  /* Parches de escombros sueltos */
  for(let i=0; i<25; i++){
    const cx = Math.floor(Math.random() * COLS);
    const cy = Math.floor(Math.random() * ROWS);
    if(cy<2||cy>=ROWS-2) continue;
    if(grid[cy][cx] === T.GRASS || grid[cy][cx] === T.DIRT){
      grid[cy][cx] = T.RUBBLE;
      if(Math.random()<0.4 && cx+1<COLS && (grid[cy][cx+1]===T.GRASS||grid[cy][cx+1]===T.DIRT))
        grid[cy][cx+1] = T.RUBBLE;
    }
  }
  return grid;
}

/* Devuelve el tipo de una celda, con bordes infinitos del mismo tipo (clamp) */
function tileAt(grid, x, y){
  const cx = clamp(x, 0, COLS-1);
  const cy = clamp(y, 0, ROWS-1);
  return grid[cy][cx];
}

/* Dibujado de una celda con transiciones a vecinas.
   El truco: cada celda dibuja primero el tipo de menor rango entre la
   propia y sus vecinas (relleno base), después dibuja el tipo propio
   recortado por los vecinos con rango menor. Para suavizar los bordes,
   usamos pequeñas curvas/dentados en lugar de líneas rectas. */
function drawTile(ctx, grid, x, y){
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const here = grid[y][x];
  const palette = TILE_PALETTES[here];

  /* Fondo base: dibujar siempre con el color de la celda */
  ctx.fillStyle = palette.base;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  /* Para cada vecino con menor rango (la celda actual está "encima" del vecino),
     dibujar una pequeña "isla" de transición desde el lado del vecino.
     Esto rompe la línea recta entre tipos. */
  const N  = tileAt(grid, x,   y-1);
  const S  = tileAt(grid, x,   y+1);
  const E  = tileAt(grid, x+1, y);
  const W  = tileAt(grid, x-1, y);
  const NE = tileAt(grid, x+1, y-1);
  const NW = tileAt(grid, x-1, y-1);
  const SE = tileAt(grid, x+1, y+1);
  const SW = tileAt(grid, x-1, y+1);

  /* Para cada vecino DISTINTO al actual, "dentar" el borde con el color del vecino */
  function denticulate(neighborType, side){
    if(neighborType === here) return;
    const np = TILE_PALETTES[neighborType];
    ctx.fillStyle = np.base;
    /* Dentado: 4 pequeñas mordeduras irregulares del color del vecino */
    /* Seed determinista por celda+lado para que no parpadee entre frames */
    const seed = (x * 73 + y * 31 + side) | 0;
    const rnd = (n) => {
      const s = Math.sin(seed + n) * 10000;
      return s - Math.floor(s);
    };
    if(side === 0){ /* N */
      for(let i=0; i<4; i++){
        const dx = i * 4 + Math.floor(rnd(i)*2);
        const dh = 1 + Math.floor(rnd(i+10)*3);
        ctx.fillRect(px + dx, py, 4, dh);
      }
    } else if(side === 1){ /* S */
      for(let i=0; i<4; i++){
        const dx = i * 4 + Math.floor(rnd(i+1)*2);
        const dh = 1 + Math.floor(rnd(i+11)*3);
        ctx.fillRect(px + dx, py + TILE_SIZE - dh, 4, dh);
      }
    } else if(side === 2){ /* E */
      for(let i=0; i<4; i++){
        const dy = i * 4 + Math.floor(rnd(i+2)*2);
        const dw = 1 + Math.floor(rnd(i+12)*3);
        ctx.fillRect(px + TILE_SIZE - dw, py + dy, dw, 4);
      }
    } else if(side === 3){ /* W */
      for(let i=0; i<4; i++){
        const dy = i * 4 + Math.floor(rnd(i+3)*2);
        const dw = 1 + Math.floor(rnd(i+13)*3);
        ctx.fillRect(px, py + dy, dw, 4);
      }
    }
  }
  denticulate(N, 0);
  denticulate(S, 1);
  denticulate(E, 2);
  denticulate(W, 3);

  /* Esquinas: si dos lados adyacentes son del mismo tipo distinto, redondear */
  function corner(corn, side1, side2, cx, cy){
    if(corn === here) return;
    if(side1 !== corn && side2 !== corn) return;
    const cp = TILE_PALETTES[corn];
    ctx.fillStyle = cp.base;
    ctx.fillRect(px + cx, py + cy, 3, 3);
  }
  corner(NW, N, W, 0, 0);
  corner(NE, N, E, TILE_SIZE-3, 0);
  corner(SW, S, W, 0, TILE_SIZE-3);
  corner(SE, S, E, TILE_SIZE-3, TILE_SIZE-3);

  /* Acentos/textura interna para que no se vea plano */
  /* Ruido determinista pequeño */
  const sx = (x * 977 + y * 311) | 0;
  const rnd2 = (n) => {
    const s = Math.sin(sx + n * 7) * 10000;
    return s - Math.floor(s);
  };
  if(here === T.GRASS){
    /* Briznas oscuras */
    ctx.fillStyle = palette.dark;
    for(let i=0; i<3; i++){
      ctx.fillRect(px + Math.floor(rnd2(i)*14), py + Math.floor(rnd2(i+5)*14), 1, 2);
    }
    if(rnd2(20) > 0.85){
      ctx.fillStyle = palette.accent;
      ctx.fillRect(px + Math.floor(rnd2(30)*12)+2, py + Math.floor(rnd2(31)*12)+2, 1, 1);
    }
  } else if(here === T.DIRT){
    /* Grava */
    ctx.fillStyle = palette.dark;
    for(let i=0; i<4; i++){
      ctx.fillRect(px + Math.floor(rnd2(i+40)*15), py + Math.floor(rnd2(i+45)*15), 1, 1);
    }
    ctx.fillStyle = palette.light;
    if(rnd2(50) > 0.6) ctx.fillRect(px + Math.floor(rnd2(51)*12)+2, py + Math.floor(rnd2(52)*12)+2, 2, 1);
  } else if(here === T.WATER){
    /* Ondas estáticas en el cache: la animación se hará por encima en drawWaterRipples */
    const wave = 0;
    ctx.fillStyle = palette.light;
    for(let i=0; i<2; i++){
      const wy = (Math.floor(rnd2(i+60)*12) + Math.floor(Math.sin(wave + x*0.3 + y*0.2 + i) * 2));
      ctx.fillRect(px + Math.floor(rnd2(i+65)*10)+2, py + wy, 3, 1);
    }
  } else if(here === T.ROAD){
    /* Líneas amarillas discontinuas en la franja central de la carretera */
    const rowMid = Math.floor((252 + 288) / 2 / TILE_SIZE);
    if(y === rowMid){
      ctx.fillStyle = '#7a6a30';
      if(x % 2 === 0) ctx.fillRect(px + 2, py + TILE_SIZE/2 - 1, TILE_SIZE - 4, 1);
    }
    /* Acentos */
    ctx.fillStyle = palette.dark;
    for(let i=0; i<2; i++){
      ctx.fillRect(px + Math.floor(rnd2(i+70)*15), py + Math.floor(rnd2(i+75)*15), 1, 1);
    }
  } else if(here === T.BRIDGE){
    /* Tablones */
    ctx.fillStyle = palette.dark;
    ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
    ctx.fillRect(px, py, TILE_SIZE, 1);
    ctx.fillStyle = palette.light;
    ctx.fillRect(px + 4, py + 2, 1, TILE_SIZE - 4);
    ctx.fillRect(px + 11, py + 2, 1, TILE_SIZE - 4);
  } else if(here === T.RUBBLE){
    /* Piedras dispersas */
    ctx.fillStyle = palette.light;
    for(let i=0; i<3; i++){
      ctx.fillRect(px + Math.floor(rnd2(i+90)*13), py + Math.floor(rnd2(i+95)*13), 2, 2);
    }
    ctx.fillStyle = palette.dark;
    for(let i=0; i<2; i++){
      ctx.fillRect(px + Math.floor(rnd2(i+100)*14), py + Math.floor(rnd2(i+105)*14), 1, 1);
    }
  }
}

/* Dibujar el grid completo. Llamado una vez al inicio en un canvas off-screen
   y luego copiado al canvas principal cada frame (mucho más rápido que redibujar
   por celda cada frame). Solo el agua se anima — para no recachear todo. */
let TERRAIN_CACHE = null;     /* canvas off-screen con el terreno estático */
let TERRAIN_GRID  = null;     /* la matriz lógica */

function buildTerrainCache(grid){
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  for(let y=0; y<ROWS; y++){
    for(let x=0; x<COLS; x++){
      drawTile(ctx, grid, x, y);
    }
  }
  return canvas;
}

/* Animación del agua: dibujar ondas encima del cache cada frame */
function drawWaterRipples(ctx, grid, g){
  const wave = g.t / 30;
  for(let y=0; y<ROWS; y++){
    for(let x=0; x<COLS; x++){
      if(grid[y][x] !== T.WATER) continue;
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      const palette = TILE_PALETTES[T.WATER];
      const sx = (x * 977 + y * 311) | 0;
      const rnd2 = (n) => {
        const s = Math.sin(sx + n * 7) * 10000;
        return s - Math.floor(s);
      };
      /* Repintar la base del agua para tapar ondas anteriores */
      ctx.fillStyle = palette.base;
      ctx.fillRect(px+1, py+1, TILE_SIZE-2, TILE_SIZE-2);
      /* Dibujar las ondas nuevas */
      ctx.fillStyle = palette.light;
      for(let i=0; i<2; i++){
        const wy = (Math.floor(rnd2(i+60)*12) + Math.floor(Math.sin(wave + x*0.3 + y*0.2 + i) * 2));
        ctx.fillRect(px + Math.floor(rnd2(i+65)*10)+2, py + wy, 3, 1);
      }
    }
  }
}


/* ============================================================
   BATALLA
   ============================================================ */
/* (v0.26) CLIMA — ningunha op se sente igual */
const CLIMAS = [
  {id:'CLARO',  label:'Cielo despejado', vis:1,    tint:null,                    p:0.45},
  {id:'CHUVIA', label:'Lluvia',          vis:0.80, tint:'rgba(40,60,90,0.13)',   p:0.25},
  {id:'NEBOA',  label:'Niebla densa',    vis:0.60, tint:'rgba(165,165,175,0.16)',p:0.15},
  {id:'NOITE',  label:'Operación nocturna', vis:0.75, tint:'rgba(8,8,28,0.30)',  p:0.15},
];
function pickClima(){
  let r = Math.random();
  for(const c of CLIMAS){ r -= c.p; if(r <= 0) return c; }
  return CLIMAS[0];
}

function newBattle(deployed){
  try{ startMusic(); }catch(e){ console.warn('[música]', e); }   /* (v0.36) xamais no camiño crítico */
  const _crisol = !!window._modoCrisol;
  window._modoCrisol = false;
  /* (v0.9) Escoller mapa segundo a operación */
  /* (v0.39) PvP: batalla 1 en MAP1 (simétrico coñecido); revanchas con mapa
     procedural SEMENTADO (o host publica o seed, os dous xeran o mesmo). */
  const mapDef = window._pvpArranque
    ? (window._pvpMapaSeed ? genMap(window._pvpMapaSeed) : MAP1)
    : ((DATA.opCount >= 2) ? genMap() : ((DATA.opCount >= 1) ? MAP2 : MAP1));
  applyMap(mapDef);

  /* Construir el mapa de celdas y cachear el dibujo estático */
  TERRAIN_GRID  = buildDefaultMap();
  TERRAIN_CACHE = buildTerrainCache(TERRAIN_GRID);

  const g = {
    units:[], tracers:[], remains:[], scrap:[], walls: buildWallsFromMap(), craters:[], clima: pickClima(), chatarraGanada:0, turretPending:0, t:0, over:false, result:null, finished:false,
    sectors: SECTORS.map(s=>({...s, owner:-1, prog:0})),
    hq:[{...HQ[0], hp:600, max:600},{...HQ[1], hp:600, max:600}],
    prod:[null,null],
    aiTimer:240, aiWave:0,
    drag:null,
    kills:[0,0], enemyN:1,
    /* Radar Central: -1 neutral, 0 azul, 1 rojo. Da info de recurrentes a su dueño */
    radar: {...RADAR_DOME, owner:-1, prog:0},
    modo: _crisol ? 'crisol' : 'campana',
    /* Recurrentes desplegados en esta operación (para reuso al cerrar) */
    recurringActive: [],
    /* (v0.9) Torretas e jeeps desde a definición do mapa actual */
    turrets: mapDef.TURRETS.map(t => ({
      id:t.id, x:t.x, y:t.y, hp:250, max:250, team:-1, occupant:null, cool:0,
      rng:95, dmg:12, fireRate:70, sel:false, angle:t.angle||0,
    })),
    vehicles: mapDef.JEEPS.map(j => ({
      id:j.id, x:j.x, y:j.y, hp:180, max:180, team:-1, occupant:null, cool:0,
      rng:80, dmg:8, fireRate:50, sel:false, angle:0,
      tx:j.x, ty:j.y, spd:1.6, kind:'JEEP',
    })),
    /* Para tracking de DEFENDIO: por unidad, lugar actual + tiempo en él */
  };
  deployed.forEach((vu,i)=>{
    const u = mkUnit(PT, vu.cls, PT===0 ? HQ[0].x + HQ[0].w + 30 : HQ[1].x - 30, HQ[PT].y - 28 + i*40, vu);
    g.units.push(u);
    radio(TXT('r.desplegado', {id:vu.id, n:vu.name, op:vu.ops+1}), '#7fdc7f');
  });
  const _pdx = PT===0 ? (d)=>HQ[0].x + HQ[0].w + d : (d)=>HQ[1].x - d;
  g.units.push(mkUnit(PT,'GRUNT',    _pdx(30), HQ[PT].y + HQ[PT].h + 20, null));
  g.units.push(mkUnit(PT,'ENGINEER', _pdx(40), HQ[PT].y + HQ[PT].h + 60, null));

  /* ===== Despliegue enemigo escalado =====
     Op 1 (DATA.opCount===0): enemigo básico — 1 GRUNT + 1 ENGINEER.
     Op 2+ : el enemigo iguala en cantidad al jugador (veteranos + novatos
     iniciales) y despliega 1 veterano enemigo por cada veterano aliado.
     Los veteranos enemigos llevan nombres propios del pool ENEMY_VETERAN_NAMES
     para que el jugador pueda identificarlos y "recordar" sus enfrentamientos. */
  if(window._pvpArranque){
    /* (v0.31) PvP: os rivais chegan do roster do outro xogador (pvpSpawnRivais no host;
       no convidado veñen nas instantáneas) — aquí non se xera IA ningunha */
    g.modo = 'pvp';
  } else if(DATA.opCount === 0){
    const _edx = ET===1 ? (d)=>HQ[1].x - d : (d)=>HQ[0].x + HQ[0].w + d;
    g.units.push(mkUnit(ET,'GRUNT',    _edx(35), HQ[ET].y - 28, null));
    g.units.push(mkUnit(ET,'ENGINEER', _edx(40), HQ[ET].y + HQ[ET].h + 40, null));
  } else {
    const playerInitial = deployed.length + 2;  /* veteranos + GRUNT + ENGINEER */
    const playerVeterans = deployed.length;

    /* Composición: 1 Engineer garantizado + resto mezcla */
    const enemyClasses = ['ENGINEER'];
    for(let i=1; i<playerInitial; i++){
      const r = Math.random();
      enemyClasses.push(r<0.55 ? 'GRUNT' : r<0.85 ? 'HEAVY' : 'ENGINEER');
    }
    /* Mezclar para que el veterano enemigo no sea siempre el Engineer */
    for(let i=enemyClasses.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [enemyClasses[i], enemyClasses[j]] = [enemyClasses[j], enemyClasses[i]];
    }

    /* Pool de nombres enemigos veteranos sin repetidos en esta partida */
    const usedEnemyNames = new Set();
    const pickEnemyVetName = () => {
      const free = ENEMY_VETERAN_NAMES.filter(n => !usedEnemyNames.has(n));
      const name = free.length
        ? free[Math.floor(Math.random()*free.length)]
        : ENEMY_VETERAN_NAMES[Math.floor(Math.random()*ENEMY_VETERAN_NAMES.length)];
      usedEnemyNames.add(name);
      return name;
    };

    let vetCount = 0;

    /* === RECURRENTES (v0.3): intentar reaparecer enemigos de operaciones anteriores ===
       Probabilidad base: 50%. Decrece 8% por cada operación de ausencia,
       con un mínimo del 12%. Si "tira a favor", reemplaza un slot de
       veterano enemigo. La clase puede no coincidir con la mezcla original. */
    const recurringPool = (DATA.recurringEnemies||[]).filter(r => {
      const opsSince = DATA.opCount - (r.lastSeen||0);
      const baseP = 0.5;
      const p = Math.max(0.12, baseP - opsSince * 0.08);
      return Math.random() < p;
    });
    /* Mezclar y limitar al número de huecos disponibles */
    for(let i = recurringPool.length - 1; i > 0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [recurringPool[i], recurringPool[j]] = [recurringPool[j], recurringPool[i]];
    }
    const recurringSlots = Math.min(recurringPool.length, playerVeterans);
    const recurringForOp = recurringPool.slice(0, recurringSlots);
    g.recurringActive = recurringForOp.map(r => r.id);

    enemyClasses.forEach((cls, i) => {
      let persistedEnemy = null;
      /* Slot de veterano: primero intentar inyectar un recurrente */
      if(vetCount < playerVeterans){
        if(vetCount < recurringForOp.length){
          /* Reaparición de enemigo recurrente */
          const r = recurringForOp[vetCount];
          /* Usar la clase original del recurrente, no la del slot */
          persistedEnemy = {
            name: r.name,
            id: r.id,
            cls: r.cls,
            ops: r.ops,
            traits: [...(r.traits||[]), 'VUELVE_A_POR_TI'],
            events: [], medals: [], crossings: 0, recoveries: 0, kills: 0,
            /* Datos de recurrencia para el panel y la radio */
            appearances: (r.appearances||1) + 1,
            killedNames: r.killedNames || [],
          };
          usedEnemyNames.add(r.name);
          cls = r.cls;  /* sustituir clase del slot */
        } else {
          /* Nuevo veterano enemigo, como antes */
          const matchOps = Math.max(2, Math.floor((deployed[vetCount].ops||2) * 0.7));
          persistedEnemy = {
            name: pickEnemyVetName(),
            id: 'K-V'+String(DATA.opCount+1)+'-'+String(vetCount+1).padStart(2,'0'),
            cls, ops: matchOps, traits: ['VETERANO_ENEMIGO'],
            events: [], medals: [], crossings: 0, recoveries: 0, kills: 0,
            appearances: 1,
            killedNames: [],
          };
        }
        vetCount++;
      }
      const sx = 820 - (i%2)*20;
      const sy = 170 + i * 36;
      g.units.push(mkUnit(ET, cls, sx, sy, persistedEnemy));
    });

    if(playerVeterans > 0){
      radioSay('enemy_veteran_warning', null, {count: playerVeterans}, '#ff5340');
    }
  }
  /* (v0.27.2) O CRISOL: instalación de ÓPTIMA — sen bando vermello, oleadas grises */
  if(g.modo === 'crisol'){
    g.units = g.units.filter(u => u.team !== ET);
    g.prod[ET] = null;
    g.aiTimer = 1e9;
    g._wave = 0;
    g._waveClearT = g.t;
    setTimeout(() => {
      radio('▣ ÓPTIMA: ' + TXT('optima.crisolBenvida'), '#e8c060');
      sfxT('voice_blip', 200, 'OPTIMA');
    }, 1200);
    setTimeout(() => hqSay(TXT('hq.crisolInicio')), 3600);
  }
  return g;
}

/* ============================================================
   SISTEMA DE PERSONALIDAD + CONFIANZA (v0.11)
   ============================================================ */

/* Pesos de asignación de personalidad segundo a clase (suma 100 por fila) */
const PERSONALIDAD_PESOS = {
  SNIPER:   {ESTOICO:35, IRONICO:20, LEAL:10, NERVIOSO:10, CINICO:25},
  BOMBARDERO:{ESTOICO:15, IRONICO:30, LEAL:20, NERVIOSO:20, CINICO:15},
  GRUNT:    {ESTOICO:20, IRONICO:15, LEAL:25, NERVIOSO:30, CINICO:10},
  HEAVY:    {ESTOICO:15, IRONICO:25, LEAL:30, NERVIOSO:15, CINICO:15},
  ENGINEER: {ESTOICO:25, IRONICO:35, LEAL:10, NERVIOSO:5,  CINICO:25},
};

/* Modificadores de delta de confianza por personalidad */
const PERSONALIDAD_MODS = {
  ESTOICO:  {pos:0.7, neg:0.7},
  IRONICO:  {pos:1.0, neg:1.0},
  LEAL:     {pos:1.3, neg:0.8},
  NERVIOSO: {pos:1.0, neg:1.4},
  CINICO:   {pos:0.7, neg:1.0},
};

function pickPersonalidad(cls){
  const pesos = PERSONALIDAD_PESOS[cls] || PERSONALIDAD_PESOS.GRUNT;
  const total = Object.values(pesos).reduce((a,b)=>a+b, 0);
  let r = Math.random() * total;
  for(const [p, w] of Object.entries(pesos)){
    r -= w;
    if(r <= 0) return p;
  }
  return 'ESTOICO';
}

/* ============================================================
   ALCUMES (v0.23.1) — os fitos poñen nome. Un alcume por unidade,
   gáñase e é para sempre. Ninguén esquece a "O XORDO".
   ============================================================ */
const ALCUMES = [
  {texto:'A COSTUREIRA',    motivo:'5 rescates de compañeiros',  cond:(r)=>(r.rescatesFeitos||0) >= 5},
  {texto:'DÚAS VECES MORTO',motivo:'recuperado 2 veces dos restos', cond:(r)=>(r.recoveries||0) >= 2},
  {texto:'O XORDO',         motivo:'3 explosións sobrevividas',  cond:(r)=>(r.criticalSurvivals||0) >= 3},
  {texto:'PONTES',          motivo:'20 cruces do río',           cond:(r)=>(r.crossings||0) >= 20},
  {texto:'FANTASMA',        motivo:'sniper con 15 baixas',       cond:(r)=>r.cls==='SNIPER' && (r.kills||0) >= 15},
  {texto:'MEDIA COMPAÑÍA',  motivo:'25 baixas confirmadas',      cond:(r)=>(r.kills||0) >= 25},
  {texto:'O CARTEIRO',      motivo:'60 km de campo pateados',    cond:(r)=>((r.activity&&r.activity.dist)||0) >= 60000},
  {texto:'O VELLO',         motivo:'10 operacións ás costas',    cond:(r)=>(r.ops||0) >= 10},
];
function checkAlcume(rec){
  if(rec.alcume) return null;
  for(const a of ALCUMES){
    if(a.cond(rec)){
      rec.alcume = {texto: a.texto, motivo: a.motivo, op: DATA.opCount};
      return rec.alcume;
    }
  }
  return null;
}
/* Nome para mostrar (o u.name interno NON cambia: rompería vínculos e rescates) */
function nomeCompleto(u){
  return u.alcume ? `${u.name} "${u.alcume.texto}"` : u.name;
}

/* ============================================================
   VÍNCULOS (v0.21 R2) — relacións con consecuencia.
   CAMARADA (mutuo): 4 ops despregados xuntos e sobrevivindo.
   DÉBEDA (direccional): quen te rescatou 2 veces, dáche calma.
   Efecto: +10% dano co vínculo preto (<120px).
   ============================================================ */
const VINCULO = {OPS_CAMARADA: 4, RESCATES_DEBEDA: 2, RADIO: 120, BUFF: 1.10, MAX: 2};

function crearVinculo(rec, outroRec, tipo){
  rec.vinculos = rec.vinculos || [];
  if(rec.vinculos.length >= VINCULO.MAX) return false;
  if(rec.vinculos.some(v => v.con === outroRec.id)) return false;
  rec.vinculos.push({con: outroRec.id, conNome: outroRec.name, tipo, op: DATA.opCount});
  return true;
}

