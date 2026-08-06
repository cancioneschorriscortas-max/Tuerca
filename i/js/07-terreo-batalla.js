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

/* ============================================================
   (v0.95) DETALLE DO CHAN — PUNTO DE RETORNO.

   Ponse a false e o terreo volve EXACTAMENTE ao de v0.94, sen tocar
   nada máis. Serve para comparar en quente sen pasar por git.

   POR QUE SE ENGADIU. Medindo o contraste local dunha captura, o chan
   baleiro daba 9,8 mentres unha zona con estruturas daba 18,1: os
   sprites non eran o problema, era a herba. E medindo a tres escalas
   —7,8 a 8 px, 9,1 a 16, 9,8 a 32— saíu o dato que o explica: o
   contraste é case o mesmo en todas. Iso quere dicir que o detalle que
   había NON TIÑA ESCALA. Eran motas soltas de un píxel, non textura:
   o 92% de cada cela era unha soa cor.

   Unha textura de verdade dá un pico no seu tamaño característico. Isto
   engade dúas cousas que si o teñen: grumos de tres ou catro píxeles
   xuntos, e un anaco de sombra na beira baixa da cela.

   OLLO: subir este número non é gañar. A métrica non distingue
   "lexible" de "ruidoso", e ruído por píxel subiríaa mentres fai que as
   unidades deixen de recortarse. Por iso o que se engade é contraste
   ESTRUTURADO —grumos e beiras, non sal e pementa— e por iso hai
   interruptor. */
const TERREO_DETALLE = true;
let COLS = 60;  /* 960/16 = 60 (MAP1) */
let ROWS = 34;  /* 540/16 ≈ 34 */
const T = {GRASS:0, DIRT:1, WATER:2, ROAD:3, BRIDGE:4, RUBBLE:5};

/* Paletas por tipo: base oscura, base media, base clara, acento */
/* (v0.50) Paletas VOXEL: máis luminosas, con cara superior (base/top2) e
   cara lateral (side) para a ilusión de bloque. Validadas nun banco de
   probas visual á parte antes do porte. */
/* (v0.60) BIOMAS: tres mundos coa mesma técnica voxel. Validados no lab
   (terreo_lab/biomas.py). setBioma() cámbiaos; a campaña usa VERDE. */
const BIOMA_PALETTES = {
 /* (v1.00) INTERIOR — primeira proba de escenario baixo cuberta.
    Non hai teito: un interior debúxase polas PAREDES, o chan e a
    ausencia de ceo. GRASS deixa de ser herba e pasa a ser bloque de
    formigón, que é o que enche todo o que non é sala nin corredor;
    WATER é o oco negro (fosos, ocos de maquinaria) e BRIDGE é reixa
    metálica. Mesmas teselas, outro mundo.

    Isto é un banco de probas: se ao entrar parece un exterior gris,
    sabémolo antes de construír vinte operacións enriba. */
 INTERIOR: {
  [T.GRASS]:  {dark:'#1e1e1c', base:'#3f3f3a', top2:'#47473f', side:'#161614', light:'#53534a', accent:'#63635a'},
  [T.DIRT]:   {dark:'#2a251e', base:'#4e463a', top2:'#564d40', side:'#211d18', light:'#655a49', accent:'#7a6d58'},
  [T.WATER]:  {dark:'#050608', base:'#0c0e12', top2:'#101319', side:'#030405', light:'#181c24', accent:'#242a34'},
  [T.ROAD]:   {dark:'#26282a', base:'#43464a', top2:'#4a4d52', side:'#1c1e20', light:'#585c62', accent:'#6a6f76'},
  [T.BRIDGE]: {dark:'#2e3034', base:'#54585e', top2:'#5d6168', side:'#232528', light:'#6e737b', accent:'#868c95'},
  [T.RUBBLE]: {dark:'#241f1a', base:'#453d33', top2:'#4d443a', side:'#1b1712', light:'#5b5145', accent:'#6f6252'},
 },
 VERDE: {
  [T.GRASS]:  {dark:'#233312', base:'#4d6a2a', top2:'#55742f', side:'#2c3d16', light:'#688a3a', accent:'#7da548'},
  [T.DIRT]:   {dark:'#332614', base:'#6a5236', top2:'#75603f', side:'#3d2e1c', light:'#8a6f4a', accent:'#a08558'},
  [T.WATER]:  {dark:'#0a2836', base:'#1e5a72', top2:'#1a5069', side:'#0e3040', light:'#3a86a0', accent:'#63b7cc'},
  [T.ROAD]:   {dark:'#2a2a26', base:'#585850', top2:'#605e55', side:'#333330', light:'#73736a', accent:'#8a8a80'},
  [T.BRIDGE]: {dark:'#3a2a18', base:'#8a6a42', top2:'#93744a', side:'#4a3520', light:'#a88652', accent:'#c09a60'},
  [T.RUBBLE]: {dark:'#3a3833', base:'#8a8578', top2:'#948e80', side:'#4d4a42', light:'#a8a294', accent:'#c2bcae'},
 },
 DESERTO: {
  [T.GRASS]:  {dark:'#5a4a26', base:'#b89a5c', top2:'#c2a566', side:'#6e5a30', light:'#d4b878', accent:'#e0c98a'},
  [T.DIRT]:   {dark:'#48351c', base:'#96703c', top2:'#a07a44', side:'#584022', light:'#b08c52', accent:'#c49e60'},
  [T.WATER]:  {dark:'#0e343a', base:'#2a7a86', top2:'#248090', side:'#134048', light:'#48a8b4', accent:'#7ed4dc'},
  [T.ROAD]:   {dark:'#36322a', base:'#6e665a', top2:'#786f60', side:'#403c34', light:'#8c8272', accent:'#a09684'},
  [T.BRIDGE]: {dark:'#44341e', base:'#9a7a4c', top2:'#a48454', side:'#544026', light:'#b8945e', accent:'#ccaa6e'},
  [T.RUBBLE]: {dark:'#4a4034', base:'#a89478', top2:'#b29e80', side:'#5c5040', light:'#c4b090', accent:'#d8c4a2'},
 },
 NEVE: {
  [T.GRASS]:  {dark:'#687684', base:'#c8d2da', top2:'#d2dce4', side:'#7a8896', light:'#e4ecf2', accent:'#f4f8fc'},
  [T.DIRT]:   {dark:'#3f4652', base:'#8a92a0', top2:'#949cab', side:'#4e5662', light:'#a8b0be', accent:'#bcc4d0'},
  [T.WATER]:  {dark:'#16283c', base:'#3a5a7e', top2:'#34547a', side:'#1c3048', light:'#5e86ae', accent:'#8fb8d8'},
  [T.ROAD]:   {dark:'#24272c', base:'#4e525c', top2:'#565a64', side:'#2c2f36', light:'#6a7080', accent:'#7e8494'},
  [T.BRIDGE]: {dark:'#362a1e', base:'#7a6248', top2:'#846c50', side:'#443626', light:'#987e5c', accent:'#ac926a'},
  [T.RUBBLE]: {dark:'#464e5a', base:'#9aa2ae', top2:'#a4acb8', side:'#565e6a', light:'#b8c0cc', accent:'#ccd4e0'},
 },
};
let TILE_PALETTES = BIOMA_PALETTES.VERDE;
function setBioma(b){
  TILE_PALETTES = BIOMA_PALETTES[b] || BIOMA_PALETTES.VERDE;
  window._bioma = BIOMA_PALETTES[b] ? b : 'VERDE';
  if(typeof TERRAIN_CACHE !== 'undefined' && window._terrainGrid){
    TERRAIN_CACHE = buildTerrainCache(window._terrainGrid);   /* repintar co bioma novo */
  }
}
/* Altura visual de cada tipo (para as caras laterais dos bloques) */
const TILE_HEIGHT = {[T.WATER]:0, [T.ROAD]:1, [T.DIRT]:1, [T.BRIDGE]:2, [T.GRASS]:2, [T.RUBBLE]:2};

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

/* ============================================================
   (v1.00) PLANTA DE INTERIOR — salas e corredores.

   O xerador de sempre fai terreo aberto: relevo, vexetación, auga. Un
   interior é a regra contraria — todo é bloque agás o que se escava.

   Empézase co mapa cheo de formigón (GRASS coa paleta INTERIOR) e
   ábrense salas rectangulares unidas por corredores en L. É a
   aproximación clásica e serve para mirar: se a lectura funciona,
   despois virán as portas, as paredes con colisión e a luz propia.

   O que NON fai aínda, e hai que dicilo: os bloques non paran ás
   unidades. Isto é aparencia, non navegación. As paredes reais do xogo
   veñen de buildWallsFromMap(), e conectalas é o paso seguinte.
   ============================================================ */
function buildInteriorMap(){
  const grid = [];
  for(let y=0; y<ROWS; y++){
    grid[y] = [];
    for(let x=0; x<COLS; x++) grid[y][x] = T.GRASS;   /* todo macizo */
  }
  const cuarto = (x0, y0, w, h, chan) => {
    for(let y=Math.max(1,y0); y<Math.min(ROWS-1,y0+h); y++)
      for(let x=Math.max(1,x0); x<Math.min(COLS-1,x0+w); x++) grid[y][x] = chan;
  };
  /* Corredor en L entre dous centros, sempre de dúas teselas de ancho:
     cunha soa non pasa unha unidade e o mapa vólvese un labirinto. */
  const corredor = (ax, ay, bx, by) => {
    for(let x=Math.min(ax,bx); x<=Math.max(ax,bx); x++) cuarto(x, ay, 1, 2, T.ROAD);
    for(let y=Math.min(ay,by); y<=Math.max(ay,by); y++) cuarto(bx, y, 2, 1, T.ROAD);
  };

  /* Unha nave central grande e catro dependencias arredor. Non é
     aleatorio de todo: unha planta industrial ten unha nave e anexos, e
     un montón de salas iguais non se le como unha instalación. */
  const cx = Math.floor(COLS/2), cy = Math.floor(ROWS/2);
  const naveW = Math.floor(COLS*0.42), naveH = Math.floor(ROWS*0.50);
  cuarto(cx - Math.floor(naveW/2), cy - Math.floor(naveH/2), naveW, naveH, T.ROAD);

  /* (v1.01) AS SALAS ESCALAN CO MAPA. Estaban fixas en 12x8 e 13x8, o
     que nun mapa de 132x68 —o que dá genMap()— deixaba catro cuartiños
     nas esquinas dunha lousa de formigón: o 77% do mapa era macizo.
     Non se notaba mentres o macizo se pintaba como terreo plano; desde
     que se debuxa como parede, vese que é unha lousa. */
  const sw = Math.max(12, Math.floor(COLS * 0.20));
  const sh = Math.max(8,  Math.floor(ROWS * 0.24));
  const salas = [
    [3, 3, sw, sh], [COLS-3-sw, 3, sw, sh],
    [3, ROWS-3-sh, sw, sh], [COLS-3-sw, ROWS-3-sh, sw, sh],
  ];
  for(const [x0,y0,w,h] of salas){
    /* (v1.01) RUBBLE, xa non DIRT. Desde que T.DIRT significa TABIQUE
       —muro destruíble— nun interior, deixar as dependencias en DIRT
       convertía o CHAN das catro salas en 348 muros: o Crisol quedaba
       con catro bloques de ladrillo onde tiña catro salas. Chan sucio é
       RUBBLE; DIRT xa non é un chan. */
    cuarto(x0, y0, w, h, T.RUBBLE);
    corredor(x0 + Math.floor(w/2), y0 + Math.floor(h/2), cx, cy);
  }

  /* Un foso na nave: rompe a explanada e dá algo que rodear. */
  cuarto(cx - 3, cy - 2, 6, 4, T.WATER);
  /* Pasarela metálica por riba do foso. */
  cuarto(cx - 3, cy, 6, 1, T.BRIDGE);

  /* Escombro contra as paredes da nave: unha nave impecable non parece
     un sitio onde pasou nada. */
  for(let i=0; i<40; i++){
    const x = cx - Math.floor(naveW/2) + Math.floor(rnd() * naveW);
    const y = cy - Math.floor(naveH/2) + Math.floor(rnd() * naveH);
    if(grid[y] && grid[y][x] === T.ROAD && rnd() < 0.5) grid[y][x] = T.RUBBLE;
  }
  return grid;
}

/* ============================================================
   (v1.01) PLANTAS ESCRITAS — o interior da campaña non se xera.

   O xerador (buildInteriorMap) vale para o Crisol, onde o que se quere
   é variedade. A campaña quere o contrario: unha instalación
   recoñecible, coa mesma nave e a mesma doca cada vez que se volve a
   ela. Iso é autoría. As plantas están en 07b-plantas.js, que o
   escribe `node tools/planta.js --todas --escribir`.

     #  macizo    .  chan    +  porta    =  tabique    :  escombro

   A PLANTA MANDA SOBRE O MAPA, e isto é o arranxo dun fallo que
   invalidaba todo o de arriba. applyMap recalcula COLS/ROWS co tamaño
   do mapa da operación: 60x34 na primeira, 80x45 na segunda e 120x80
   da terceira en diante. plantaAGrid percorría COLS x ROWS e o que
   sobraba quedaba en T.GRASS, así que a partir da operación 3 a planta
   ocupaba un cuarto do mapa e o outro 85% era un bloque de formigón
   macizo. A proba que esixía 60x34 arrancaba sempre en op 0 e non o
   vía nunca.

   Agora unha operación de interior TRAE O SEU MAPA: mapaDaPlanta()
   fabrica a definición co tamaño da planta e cos fondeadeiros que a
   propia planta declara, e applyMap xa non ten nada que adiviñar.
   ============================================================ */
function plantaAGrid(nome){
  const p = (typeof PLANTAS !== 'undefined') && PLANTAS[nome];
  if(!p) return null;
  const grid = [];
  for(let y = 0; y < ROWS; y++){
    grid[y] = [];
    const fila = p.grid[y] || '';
    for(let x = 0; x < COLS; x++){
      const c = fila[x];
      /* A porta píntase como reixa metálica: un oco sen marcar non se le
         como paso, lese como que faltou un muro. O tabique vai en DIRT
         —outro material— porque o xogador ten que poder distinguir de
         lonxe o que pode abrir do que non. */
      grid[y][x] = c === '.' ? T.ROAD
                 : c === ':' ? T.RUBBLE
                 : c === '+' ? T.BRIDGE
                 : c === '=' ? T.DIRT
                 : T.GRASS;
    }
  }
  return grid;
}

/* ¿É maciza esta cela? O formigón do edificio non é unha lista de
   obxectos: é a grella. Preguntarllo á grella é O(1) e non depende de
   cantos muros haxa, que é o que permite ter un edificio enteiro. */
function macizoEn(x, y){
  if((window._bioma || 'VERDE') !== 'INTERIOR') return false;
  const g = window._terrainGrid;
  if(!g) return false;
  const fila = g[Math.floor(y / TILE_SIZE)];
  if(!fila) return true;                 /* fóra do mapa: coma se fose muro */
  const t = fila[Math.floor(x / TILE_SIZE)];
  return t === undefined || t === T.GRASS;
}

/* ============================================================
   (v1.01) O MAPA DUNHA PLANTA.

   Devolve unha definición de mapa coa mesma forma que MAP1/MAP2: o
   resto do xogo non se entera de que isto é outra cousa.

   Tres decisións que non son obvias:

   · O RÍO PÓÑESE FÓRA. inWater() é `x > RIVER.x1 && x < RIVER.x2`, e
     un río nunha nave industrial non ten sentido ningún. Cun intervalo
     baleiro, inWater é falso en todo o mapa e non hai que tocalo.
   · SEN TORRETAS NIN JEEPS. Un jeep nun corredor de tres celas non
     manobra, e unha torreta fixa nun interior é un tapón.
   · OS LUGARES TEÑEN NOME. placeAt() é o que permite que o Diario
     diga "caeu na Doca de Carga" en vez de "en campo aberto", e esa é
     media razón de ser da campaña.
   ============================================================ */
function mapaDaPlanta(nome){
  const p = (typeof PLANTAS !== 'undefined') && PLANTAS[nome];
  if(!p) return null;
  const S = TILE_SIZE;
  const cen = (c) => ({x: c.x * S + S/2, y: c.y * S + S/2});

  const hq = (p.hq || []).map((h, i) => {
    const c = cen(h);
    /* x,y dun HQ é a ESQUINA superior esquerda dun rectángulo de 74x84.
       O fondeadeiro é o CENTRO, así que hai que restar a metade. Non
       facelo era o fallo que metía o HQ inimigo dentro do formigón —e
       en MAP1 chegaba a saírse do mapa polo bordo. */
    return {team: i, x: Math.round(c.x - 37), y: Math.round(c.y - 42), w: 74, h: 84};
  });

  /* Unha operación pode non levar sectores. Que unha misión de
     extracción teña círculos de captura tirados polo mapa é ruído: o
     xogador le que hai que capturalos e non hai que capturar nada. */
  const sectores = window._senSectores ? [] : (p.sectores || []).map(s => {
    const c = cen(s);
    return {id: s.id, x: c.x, y: c.y, r: 54, place: 'SECTOR_' + s.id};
  });

  const lugares = (p.lugares || []).map(l => {
    const c = cen(l);
    return {id: l.id, x: c.x, y: c.y, r: l.r * S, label: l.label};
  });
  for(const s of sectores) lugares.push({id: s.place, x: s.x, y: s.y, r: 65, label: 'o Sector ' + s.id});
  if(hq[0]) lugares.push({id:'HQ_AZUL',     x: hq[0].x + 37, y: hq[0].y + 42, r: 90, label:'el HQ Azul'});
  if(hq[1]) lugares.push({id:'HQ_ROJO',     x: hq[1].x + 37, y: hq[1].y + 42, r: 90, label:'el HQ Rojo'});

  const W2 = p.cols * S, H2 = p.filas * S;
  /* O radar vai no centro da espiña, que é o sitio máis transitado. */
  const esp = lugares.find(l => l.id === 'ESPINA') || {x: W2/2, y: H2/2};
  return {
    NAME: nome,
    W: W2, H: H2,
    RIVER: {x1: -2, x2: -1},                      /* intervalo baleiro: inWater sempre falso */
    BRIDGE: {y1: -2, y2: -1},
    BRIDGE_CENTER: {x: Math.round(esp.x), y: Math.round(esp.y)},
    RADAR_DOME: {x: Math.round(esp.x) - 24, y: Math.round(esp.y) - 18, w: 48, h: 36, capRadius: 42},
    PLACES: lugares,
    SECTORS: sectores,
    HQ: hq,
    TURRETS: [],
    JEEPS: [],
  };
}

/* ============================================================
   (v1.00) AS ESTRUTURAS VAN ONDE CABEN.

   O HQ e os sectores de captura veñen coas coordenadas do mapa exterior,
   e nunha planta de interior iso deixábaos onde callase: dentro do
   formigón, medio metidos nun muro, ou nun corredor de dúas celas onde
   non collen. Non é un detalle estético — un sector dentro dun muro non
   se pode capturar.

   A regra é simple e non intenta ser lista: unha estrutura só pode ir
   nun sitio con CHAN LIBRE ARREDOR. Búscanse eses sitios, os dous HQ van
   aos extremos opostos —para que haxa travesía— e os sectores repártense
   polos que queden máis lonxe entre si.

   E se a operación non leva sectores, non se poñen. Que unha misión de
   extracción teña círculos de captura tirados polo mapa é ruído: o
   xogador le que hai que capturalos e non hai que capturar nada.
   ============================================================ */
function axustarEstruturasAPlanta(grid){
  if(!grid) return;
  const libre = (x, y) => {
    const t = grid[y] && grid[y][x];
    return t === T.ROAD || t === T.BRIDGE || t === T.DIRT || t === T.RUBBLE;
  };
  /* Con marxe de dúas celas: unha estrutura ocupa máis ca unha tesela e
     pegada a un muro non se pode rodear. */
  const cabe = (x, y) => {
    for(let dy = -2; dy <= 2; dy++)
      for(let dx = -2; dx <= 2; dx++) if(!libre(x+dx, y+dy)) return false;
    return true;
  };
  const ocos = [];
  for(let y = 2; y < ROWS-2; y++)
    for(let x = 2; x < COLS-2; x++) if(cabe(x, y)) ocos.push({x, y});
  if(ocos.length < 3) return;   /* planta sen sitio: mellor non tocar nada */

  /* COPIAR ANTES DE TOCAR. applyMap fai `SECTORS = m.SECTORS` e
     `HQ = m.HQ`: por REFERENCIA. Mover eses obxectos ou baleirar a lista
     non cambiaría esta batalla, cambiaría MAP1 e MAP2 para o resto da
     sesión, e a seguinte operación no exterior aparecería cos sectores
     dun interior ou sen ningún. */
  if(typeof HQ !== 'undefined' && HQ) HQ = HQ.map(h => ({...h}));
  if(typeof SECTORS !== 'undefined' && SECTORS) SECTORS = SECTORS.map(s => ({...s}));

  const px = (o) => o.x * TILE_SIZE + TILE_SIZE/2;
  const py = (o) => o.y * TILE_SIZE + TILE_SIZE/2;
  const lonxe = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);

  /* Os HQ, aos dous extremos: o par de ocos máis separado que haxa.

     (v1.01) O OCO É O CENTRO; x,y DUN HQ É A ESQUINA. Aquí asignábase o
     centro directamente á esquina, e como o HQ mide 74x84 saía medio
     rectángulo cara abaixo e cara á dereita: o HQ inimigo aparecía
     metido no formigón, e en MAP1 chegaba a saírse do mapa (esquina en
     888,472 nun mapa de 960x540 = 962x556). A proba de entón miraba a
     esquina superior esquerda, que era xustamente a única boa. */
  if(typeof HQ !== 'undefined' && HQ && HQ.length >= 2){
    let mellor = [ocos[0], ocos[ocos.length-1]], d = lonxe(mellor[0], mellor[1]);
    for(const a of ocos) for(const b of ocos){
      const dd = lonxe(a, b);
      if(dd > d){ d = dd; mellor = [a, b]; }
    }
    for(let i = 0; i < 2; i++){
      const h = HQ[i], c = mellor[i];
      h.x = clamp(Math.round(px(c) - h.w/2), 0, W - h.w);
      h.y = clamp(Math.round(py(c) - h.h/2), 0, H - h.h);
    }
  }

  if(typeof SECTORS === 'undefined' || !SECTORS) return;
  if(window._senSectores){ SECTORS = []; return; }
  /* Repártense collendo cada vez o oco máis lonxe de todo o xa colocado
     (dispersión de Mitchell). Sen isto amoreábanse na primeira sala. */
  const postos = (typeof HQ !== 'undefined' && HQ) ? HQ.map(h => ({x: h.x/TILE_SIZE, y: h.y/TILE_SIZE})) : [];
  for(const sec of SECTORS){
    let mellor = null, d = -1;
    for(const o of ocos){
      let min = Infinity;
      for(const p of postos) min = Math.min(min, lonxe(o, p));
      if(min > d){ d = min; mellor = o; }
    }
    if(!mellor) break;
    sec.x = px(mellor); sec.y = py(mellor);
    postos.push(mellor);
  }
}

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
    const cx = Math.floor(rnd() * COLS);
    const cy = Math.floor(rnd() * ROWS);
    const r  = 1 + Math.floor(rnd()*2);
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
    const cx = Math.floor(rnd() * COLS);
    const cy = Math.floor(rnd() * ROWS);
    if(cy<2||cy>=ROWS-2) continue;
    if(grid[cy][cx] === T.GRASS || grid[cy][cx] === T.DIRT){
      grid[cy][cx] = T.RUBBLE;
      if(rnd()<0.4 && cx+1<COLS && (grid[cy][cx+1]===T.GRASS||grid[cy][cx+1]===T.DIRT))
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
/* ============================================================
   (v1.01) O FORMIGÓN DUN INTERIOR.

   CONTRASTE — DECIDIDO: masa escura, chan lexible.

   Compareáronse as dúas na mesma planta. Coa masa clara o plano lese
   dun golpe de vista, pero os muros pasan a ser o máis brillante da
   pantalla e as unidades pérdense contra eles. Coa masa escura o chan é
   a superficie que se le, as unidades e os sectores destacan, e o
   tabique de ladrillo distínguese mellor do formigón. É a escollida.

   `MACIZO_CLARO = true` volve á outra. O interruptor queda porque a
   comparación custa unha liña e unha captura, non porque siga aberto.

   O que NUNCA foi opcional é que se distingan: coa paleta do bioma soa,
   o formigón (#3f3f3a) e o chan (#43464a) están a catro niveis un do
   outro e o mapa era unha mancha.
   ============================================================ */
const MACIZO_CLARO = false;
const MACIZO_INTERIOR = MACIZO_CLARO
  ? {tapa:'#d8d5c8', lateral:'#8a887c', canto:'#f0eee4', rego:'#6a685e',
     bordo:'#10160a', sombra:'rgba(0,0,0,0.28)'}
  : {tapa:'#23231f', lateral:'#141412', canto:'#3a3a33', rego:'#101010',
     bordo:'#050605', sombra:'rgba(0,0,0,0.45)'};

/* O TABIQUE ten que verse DISTINTO, e non é un capricho: é a única
   maneira de que o xogador saiba onde pode abrir. Ao principio deixouse
   coa paleta de terreo (DIRT) e o resultado foi que non se distinguía
   nada dentro dun muro claro. Vai co mesmo volume có formigón —é
   parede— e con outro material: ladrillo oxidado. */
const TABIQUE_INTERIOR = MACIZO_CLARO
  ? {tapa:'#9a6a44', lateral:'#63412a', canto:'#c08a5c', rego:'#4a3020',
     bordo:'#1a0e06', sombra:'rgba(0,0,0,0.28)'}
  /* Sobre masa case negra, un ladrillo escuro non se ve. Este sobe ata
     onde se le sen deixar de ser óxido: contra o formigón (#23231f)
     hai corenta niveis de diferenza e a cor é doutra familia. */
  : {tapa:'#7a4826', lateral:'#4a2a14', canto:'#a86a3c', rego:'#2a180c',
     bordo:'#0a0604', sombra:'rgba(0,0,0,0.45)'};

/* A segunda pasada: os bloques de parede, que saen da súa propia cela. */
function debuxarMacizoInterior(ctx, grid, x, y){
  const aqui = grid[y][x];
  if(aqui !== T.GRASS && aqui !== T.DIRT) return;
  const px = x * TILE_SIZE, py = y * TILE_SIZE;
  const m = aqui === T.DIRT ? TABIQUE_INTERIOR : MACIZO_INTERIOR;
  /* Veciño "igual", non "sólido": así o bordo escuro debúxase tamén
     entre formigón e tabique, e o tabique queda perfilado dentro do
     muro en vez de fundirse con el. */
  const macizo = (a, b) => {
    const f = grid[b];
    if(!f) return aqui === T.GRASS;        /* fóra do mapa: o formigón segue */
    return f[a] === aqui;
  };
  const vN = macizo(x, y-1), vS = macizo(x, y+1);
  const vE = macizo(x+1, y), vO = macizo(x-1, y);
  const R = (a,b,w,h,c) => { ctx.fillStyle = c; ctx.fillRect(a,b,w,h); };
  const sx = (x * 977 + y * 311) | 0;
  const rnd2 = (n) => { const s = Math.sin(sx + n * 7) * 10000; return s - Math.floor(s); };

  /* A sombra só cae onde remata o muro: se hai máis formigón debaixo,
     aí non hai chan que sombrear. */
  if(!vS) R(px, py + TILE_SIZE, TILE_SIZE + 1, 3, m.sombra);
  R(px, py + 6, TILE_SIZE, 10, m.lateral);          /* cara vertical */
  R(px, py - 1, TILE_SIZE, 8, m.tapa);              /* cara superior */
  /* O canto de luz é o BORDO SUPERIOR. Con formigón enriba non hai
     canto: é parede continua. */
  if(!vN) R(px, py - 1, TILE_SIZE, 1, m.canto);
  /* Regos dentro da cela: dan textura sen marcar as xuntas do mosaico. */
  R(px + 5, py - 1, 1, 17, m.rego);
  R(px + 11, py - 1, 1, 17, m.rego);
  if(rnd2(30) > 0.88) R(px + 2 + Math.floor(rnd2(31)*8), py + 2 + Math.floor(rnd2(32)*10), 3 + Math.floor(rnd2(33)*4), 1, m.rego);
  /* Bordo escuro SÓ nas caras que dan ao baleiro: nos catro lados era o
     que costuraba o edificio en caixas de dezaseis píxeles. */
  if(!vO) R(px, py - 1, 1, 17, m.bordo);
  if(!vE) R(px + TILE_SIZE - 1, py - 1, 1, 17, m.bordo);
}

/* ============================================================
   (v1.01) UN TABIQUE DERRUBADO TEN QUE DEIXAR UN OCO.

   O formigón e os tabiques viven na CACHÉ do terreo, que se pinta unha
   soa vez. Sen isto, rebentar un tabique quitaba o obxecto de colisión
   —pasábase por el— pero a parede seguía debuxada: un paso invisible,
   que é peor ca non ter o paso.

   Repíntase a cela e as oito de arredor, porque un bloque proxecta
   sombra e canto nas veciñas e quedarían con marcas dun muro que xa non
   está. Non se reconstrúe a caché enteira: son dous mil e pico teselas
   por un burato de dous.
   ============================================================ */
function abrirTabique(w){
  if((window._bioma || 'VERDE') !== 'INTERIOR') return;
  const grid = window._terrainGrid;
  if(!grid || typeof _wearCtx === 'undefined' || !_wearCtx) return;
  const cx = Math.floor(w.x / TILE_SIZE), cy = Math.floor(w.y / TILE_SIZE);
  if(!grid[cy] || grid[cy][cx] !== T.DIRT) return;
  grid[cy][cx] = T.RUBBLE;                 /* o que queda dun tabique é cascallo */
  const ctx = _wearCtx;
  for(let dy = -1; dy <= 1; dy++){
    for(let dx = -1; dx <= 1; dx++){
      const x = cx + dx, y = cy + dy;
      if(!grid[y] || grid[y][x] === undefined) continue;
      ctx.clearRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
      drawTile(ctx, grid, x, y);
    }
  }
  for(let dy = -1; dy <= 1; dy++)
    for(let dx = -1; dx <= 1; dx++){
      const x = cx + dx, y = cy + dy;
      if(grid[y] && grid[y][x] !== undefined) debuxarMacizoInterior(ctx, grid, x, y);
    }
}

function drawTile(ctx, grid, x, y){
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const here = grid[y][x];
  const p = TILE_PALETTES[here];
  const N = tileAt(grid, x, y-1), S = tileAt(grid, x, y+1);
  const E = tileAt(grid, x+1, y), W = tileAt(grid, x-1, y);
  /* ruído determinista por cela (mesmo hash de sempre) */
  const sx = (x * 977 + y * 311) | 0;
  const rnd2 = (n) => { const s = Math.sin(sx + n * 7) * 10000; return s - Math.floor(s); };
  const R = (a,b,w,h,c) => { ctx.fillStyle = c; ctx.fillRect(a,b,w,h); };
  /* cubo pequeno: cara superior + lateral + brillo (matas, pedras, árbores) */
  const cube = (cx2, cy2, w, h, top, side, light) => {
    const sh = Math.max(2, (h/3)|0);
    R(cx2, cy2, w, h-sh, top); R(cx2, cy2+h-sh, w, sh, side); R(cx2, cy2, w, 1, light);
  };

  /* (v1.01) O MACIZO DUN INTERIOR NON É TERREO: É PAREDE.

     Ata agora as paredes vían do obxecto muro (drawWalls, en
     10-estructuras) porque a cortiza enteira do formigón estaba na
     lista. Ao deixar esa lista só cos tabiques —que é o que fai
     xogable un interior— o edificio desapareceu da vista: o macizo
     quedaba pintado como terreo plano, e o formigón (#3f3f3a) e o chan
     (#43464a) están a catro niveis un do outro. O mapa era unha
     mancha.

     Agora píntase aquí, na capa de terreo, que é onde debía estar
     desde o principio: o formigón NON cambia en toda a batalla, así
     que entra na caché e non custa nada por fotograma.

     A xeometría é a mesma que a do muro destruíble —altura de bloque,
     sombra só onde remata, canto de luz só se non hai bloque enriba,
     bordo escuro só nas caras que dan ao baleiro—, porque as dúas
     cousas son a mesma cousa vista polo xogador. */
  if((here === T.GRASS || here === T.DIRT) && (window._bioma || 'VERDE') === 'INTERIOR'){
    /* Aquí só se deixa a base. O bloque enteiro píntase nunha SEGUNDA
       PASADA (debuxarMacizoInterior), porque sae da súa cela: proxecta
       sombra na de abaixo e o canto sobe á de arriba, e nunha soa
       pasada a cela seguinte borraríao ao debuxarse despois. É a mesma
       razón pola que os muros sempre foron unha capa á parte. */
    R(px, py, TILE_SIZE, TILE_SIZE, (here === T.DIRT ? TABIQUE_INTERIOR : MACIZO_INTERIOR).tapa);
    return;
  }

  if(here === T.WATER){
    R(px, py, TILE_SIZE, TILE_SIZE, rnd2(1) < 0.6 ? p.base : p.top2);
    /* sombra da beira: a terra proxecta sobre a auga */
    if(N !== T.WATER) R(px, py, TILE_SIZE, 3, p.dark);
    if(W !== T.WATER) R(px, py, 3, TILE_SIZE, p.dark);
    if(E !== T.WATER) R(px+TILE_SIZE-2, py, 2, TILE_SIZE, p.side);
    if(S !== T.WATER) R(px, py+TILE_SIZE-2, TILE_SIZE, 2, p.side);
    /* ondas estáticas do cache (a animación vai en drawWaterRipples) */
    ctx.fillStyle = p.light;
    for(let i=0; i<2; i++){
      const wy = Math.floor(rnd2(60+i)*10)+2;
      ctx.fillRect(px + Math.floor(rnd2(65+i)*9)+2, py+wy, 3+Math.floor(rnd2(68+i)*3), 1);
    }
    if(rnd2(70) > 0.78) R(px+Math.floor(rnd2(71)*12)+2, py+Math.floor(rnd2(72)*12)+2, 2, 1, p.accent);
    if((window._bioma||'VERDE') === 'NEVE' && rnd2(330) > 0.55){
      /* placa de xeo flotante */
      const ix = px+Math.floor(rnd2(331)*8)+1, iy = py+Math.floor(rnd2(332)*8)+1;
      const iw = 5+Math.floor(rnd2(333)*5), ih = 4+Math.floor(rnd2(334)*4);
      R(ix, iy, iw, ih, '#c8d8e4'); R(ix, iy, iw, 1, '#eef4f8');
    }
    /* (v0.52) auga profunda ocasional: mancha escura */
    if(rnd2(75) > 0.86){
      R(px+Math.floor(rnd2(76)*8)+2, py+Math.floor(rnd2(77)*8)+2, 5+Math.floor(rnd2(78)*4), 3, p.side);
    }
    /* (v0.52) ROCHA no río (rompe a monotonía; a animación sáltase estas celas) */
    if(rnd2(85) > 0.90){
      const rx = px+Math.floor(rnd2(86)*7)+3, ry = py+Math.floor(rnd2(87)*7)+3;
      const rw = 5+Math.floor(rnd2(88)*3), rh = 4+Math.floor(rnd2(89)*3);
      R(rx-1, ry+1, rw+2, rh, '#0c2530');
      R(rx, ry, rw, rh-1, '#8a8578'); R(rx, ry+rh-2, rw, 2, '#4d4a42');
      R(rx, ry, rw, 1, '#a8a294');
      R(rx-1, ry+rh, rw+2, 1, '#dff0f5');
    }
    /* (v0.52) ESCUMA nas celas que tocan a PONTE (os piares baten a auga) */
    if(N === T.BRIDGE || S === T.BRIDGE || E === T.BRIDGE || W === T.BRIDGE){
      ctx.fillStyle = '#dff0f5';
      if(N === T.BRIDGE) for(let i=0;i<4;i++) ctx.fillRect(px+1+i*4+Math.floor(rnd2(91+i)*2), py+1, 2, 1);
      if(S === T.BRIDGE) for(let i=0;i<4;i++) ctx.fillRect(px+1+i*4+Math.floor(rnd2(95+i)*2), py+TILE_SIZE-3, 2, 1);
      if(W === T.BRIDGE) for(let i=0;i<3;i++) ctx.fillRect(px+1, py+2+i*5, 1, 2);
      if(E === T.BRIDGE) for(let i=0;i<3;i++) ctx.fillRect(px+TILE_SIZE-2, py+2+i*5, 1, 2);
    }
    return;
  }

  /* ---- cara superior do bloque con variación ---- */
  const top = rnd2(1) < 0.55 ? p.base : p.top2;
  R(px, py, TILE_SIZE, TILE_SIZE, top);
  /* dentado orgánico só entre tipos da MESMA altura (herba<->terra) */
  const dent = (nb, side) => {
    if(nb === here || TILE_HEIGHT[nb] !== TILE_HEIGHT[here] || nb === T.WATER) return;
    const np = TILE_PALETTES[nb]; ctx.fillStyle = np.base;
    const seed = (x*73 + y*31 + side)|0;
    const rr = (n)=>{ const s=Math.sin(seed+n)*10000; return s-Math.floor(s); };
    for(let i=0; i<4; i++){
      const o = i*4 + Math.floor(rr(i)*2), d = 1 + Math.floor(rr(i+10)*3);
      if(side===0) ctx.fillRect(px+o, py, 4, d);
      else if(side===1) ctx.fillRect(px+o, py+TILE_SIZE-d, 4, d);
      else if(side===2) ctx.fillRect(px+TILE_SIZE-d, py+o, d, 4);
      else ctx.fillRect(px, py+o, d, 4);
    }
  };
  dent(N,0); dent(S,1); dent(E,2); dent(W,3);
  /* micro-dithering */
  ctx.fillStyle = p.dark;
  for(let i=0; i<3; i++) ctx.fillRect(px+Math.floor(rnd2(10+i)*14)+1, py+Math.floor(rnd2(20+i)*14)+1, 1, 1);
  ctx.fillStyle = p.light;
  for(let i=0; i<2; i++) if(rnd2(30+i) > 0.5) ctx.fillRect(px+Math.floor(rnd2(40+i)*13)+1, py+Math.floor(rnd2(50+i)*13)+1, 2, 1);
  /* (v0.95) GRUMOS E BEIRA — o que lle daba escala ao chan.
     Só nos dous tipos que cobren o mapa; a auga, a estrada e a ponte xa
     teñen detalle de sobra e non tocan. */
  if(TERREO_DETALLE && (here === T.GRASS || here === T.DIRT)){
    /* Grumos: tres ou catro píxeles XUNTOS en vez de un solto. A mesma
       cantidade de tinta pesa moito máis nunha desviación cando está
       agrupada, e ademais le como mata e non como suciedade. */
    ctx.fillStyle = p.side;
    for(let i = 0; i < 3; i++){
      if(rnd2(200+i) < 0.45) continue;
      const gx = px + Math.floor(rnd2(210+i) * 12) + 1;
      const gy = py + Math.floor(rnd2(220+i) * 13) + 1;
      const gw = 2 + Math.floor(rnd2(230+i) * 2);
      ctx.fillRect(gx, gy, gw, 2);
      ctx.fillRect(gx + (rnd2(240+i) > 0.5 ? gw : -1), gy + 1, 1, 1);
    }
    /* Sombra curta: a "liña escura interna a escala de poucos píxeles"
       que ten a arte debuxada a man, e que é o que lle daba o 41,5 á
       referencia.

       PRIMEIRO INTENTO, e por que non valeu: púxose ao PÉ da cela, que
       é onde estaría a sombra dun bloque. O número subiu igual de ben
       —13,3 na herba pelada— pero ampliando a 4x víase o problema: como
       caía sempre na mesma fila de píxeles, as sombras de todas as
       celas veciñas aliñaban e o mapa saía a raias horizontais cada 16
       px. Era a reixa do mosaico asomando.

       Agora vai DENTRO da cela, a unha altura que depende do hash. A
       marca é a mesma, o contraste é o mesmo, e a reixa desaparece
       porque xa non hai nada aliñado. Lese como sombra de mata en vez
       de como bordo de baldosa. */
    if(rnd2(250) > 0.42){
      const bw = 4 + Math.floor(rnd2(251) * 6);
      const bx = px + Math.floor(rnd2(252) * (TILE_SIZE - bw));
      const by = py + 2 + Math.floor(rnd2(253) * (TILE_SIZE - 5));
      R(bx, by, bw, 1, p.dark);
      /* medio píxel de luz por riba: fai que a sombra teña volume en vez
         de parecer un rabuñón. */
      if(rnd2(254) > 0.5) R(bx + 1, by - 1, bw - 2, 1, p.light);
    }
  }
  /* catch-light ocasional (sen raiado) */
  if(rnd2(5) > 0.62) R(px+Math.floor(rnd2(6)*8), py, 6+Math.floor(rnd2(7)*6), 1, top === p.base ? p.top2 : p.base);
  /* caras laterais do bloque cara a veciños máis baixos */
  if(TILE_HEIGHT[S] < TILE_HEIGHT[here]) R(px, py+TILE_SIZE-3, TILE_SIZE, 3, p.side);
  if(TILE_HEIGHT[E] < TILE_HEIGHT[here]) R(px+TILE_SIZE-2, py, 2, TILE_SIZE, p.side);

  /* ---- detalle por tipo ---- */
  if(here === T.GRASS){
    /* (v0.95) A mata sobe do 14% ao 25% das celas. É o cambio máis barato
       dos tres e o menos elegante, pero é o que mete masa clara —accent
       está 55 niveis por riba da base— nun chan onde case todo estaba
       no mesmo valor. */
    /* O verde é literal: '#9ec868' é herba, non unha cor da paleta. Nun
       interior iso convertía o formigón nun descampado. */
    if((window._bioma || 'VERDE') !== 'INTERIOR' && rnd2(80) > (TERREO_DETALLE ? 0.75 : 0.86)){
      cube(px+Math.floor(rnd2(81)*9)+2, py+Math.floor(rnd2(82)*8)+2, 5, 5, p.accent, p.side, '#9ec868');
    }
    /* BAIXO CUBERTA NON MEDRA NADA.

       (v1.01) A GARDA TIÑA QUE SER A CABECEIRA DA CADEA, e non estaba.
       Aquí embaixo colga un `else if ... else if ...` con flores, herba
       alta ('#688a3a' literal), árbore morta e pneumáticos. Ao ser
       INTERIOR esta condición era falsa, así que a cadea ENTRABA, e a
       nave saía con mato pintado por riba do formigón. Eran as "motas
       verdes" que quedaban por localizar: non eran unha capa perdida,
       era esta mesma cadea entrando pola porta de atrás.

       Agora o interior ten a súa propia rama e non chega á vexetación
       nunca, faga o dado o que faga. */
    if((window._bioma || 'VERDE') === 'INTERIOR'){
      /* Formigón: xuntas e manchas de aceite. Todo sae da paleta do
         bioma —nada de cores literais— para que siga a luz da escena. */
      if(rnd2(90) > 0.88){
        const mx = px + Math.floor(rnd2(91)*8)+2, my = py + Math.floor(rnd2(92)*8)+3;
        R(mx, my, 5 + Math.floor(rnd2(93)*4), 2, p.dark);
      }
      if(rnd2(95) > 0.93) R(px+1, py + Math.floor(rnd2(96)*12)+2, TILE_SIZE-2, 1, p.side);
    }
    else if(rnd2(90) > 0.94){   /* vexetación grande por bioma */
      const _b = window._bioma || 'VERDE';
      const tx = px+2, ty = py+1;
      if(_b === 'DESERTO'){
        /* CACTO: tronco + dous brazos */
        const cx3 = px+7, cy3 = py+3;
        R(cx3+1, cy3+11, 5, 2, '#5a4a26');
        R(cx3, cy3, 3, 12, '#4a7a3a'); R(cx3, cy3, 3, 1, '#6a9a5a');
        R(cx3-3, cy3+3, 3, 2, '#4a7a3a'); R(cx3-3, cy3+1, 2, 4, '#4a7a3a');
        R(cx3+4, cy3+5, 3, 2, '#4a7a3a'); R(cx3+5, cy3+3, 2, 4, '#4a7a3a');
      } else if(_b === 'NEVE'){
        /* ABETO nevado */
        const ax = px+4, ay2 = py+1;
        R(ax+2, ay2+12, 6, 2, '#5a6674');
        R(ax, ay2+7, 8, 5, '#2c4a3a'); R(ax, ay2+7, 8, 1, '#e8f0f6');
        R(ax+1, ay2+3, 6, 5, '#35584a'); R(ax+1, ay2+3, 6, 1, '#e8f0f6');
        R(ax+3, ay2, 2, 4, '#3f6858'); R(ax+3, ay2, 2, 1, '#ffffff');
      } else {
        R(tx+2, ty+11, 10, 3, '#1c2a10');
        cube(tx, ty+3, 12, 10, '#3d6a26', '#1e3512', '#5d8f3a');
        cube(tx+2, ty, 8, 8, '#4d7d2e', '#2c4a1a', '#6fa243');
        R(tx+5, ty+12, 2, 2, '#3a2a18');
      }
    }
    else if((window._bioma||'VERDE') === 'DESERTO' && rnd2(310) > 0.80){
      /* liña de duna */
      const dy3 = py + Math.floor(rnd2(311)*10)+3;
      R(px+1, dy3, TILE_SIZE-2, 1, p.side);
      R(px+3, dy3-1, TILE_SIZE-8, 1, p.light);
    }
    /* (v0.57) DECORACIÓN AMBIENTAL — "ruído visual" pedido por Agarfal.
       Frecuencias baixas e canles rnd separadas para non amontoar. */
    else if(rnd2(200) > 0.90){   /* flores: 2-3 puntiños de cor con talo */
      for(let i = 0; i < 2 + (rnd2(201) > 0.5 ? 1 : 0); i++){
        const fx2 = px + Math.floor(rnd2(202+i)*12)+2, fy2 = py + Math.floor(rnd2(206+i)*12)+2;
        R(fx2, fy2+1, 1, 2, '#2c3d16');
        R(fx2, fy2, 2, 1, ['#e8d24a', '#d87ab0', '#e8e4e0'][Math.floor(rnd2(210+i)*3)]);
      }
    }
    else if(rnd2(215) > 0.90){   /* herba alta: trazos verticais */
      ctx.fillStyle = '#688a3a';
      for(let i = 0; i < 5; i++)
        ctx.fillRect(px + 2 + i*3 + Math.floor(rnd2(216+i)*2), py + Math.floor(rnd2(220+i)*8)+4, 1, 4 + Math.floor(rnd2(224+i)*3));
    }
    else if(rnd2(230) > 0.965){   /* árbore MORTA: tronco e polas núas */
      const tx2 = px + 6, ty2 = py + 2;
      R(tx2+1, ty2+11, 6, 2, '#1c2a10');
      R(tx2+2, ty2+3, 2, 10, '#4a3826'); R(tx2+2, ty2+3, 2, 1, '#6a5436');
      R(tx2-1, ty2+2, 4, 1, '#4a3826'); R(tx2+3, ty2, 1, 4, '#4a3826'); R(tx2+4, ty2+4, 3, 1, '#4a3826');
    }
    else if(rnd2(235) > 0.972){   /* pneumáticos: aro escuro */
      const nx = px + Math.floor(rnd2(236)*6)+3, ny = py + Math.floor(rnd2(237)*7)+4;
      R(nx, ny, 8, 7, '#1c1c18'); R(nx+2, ny+2, 4, 3, p.base); R(nx, ny, 8, 1, '#34342e');
      if(rnd2(238) > 0.5){ R(nx+5, ny+4, 8, 6, '#1c1c18'); R(nx+7, ny+6, 4, 2, p.base); }
    }
    else if(rnd2(240) > 0.975){   /* chatarra: anacos grises/ocres */
      for(let i = 0; i < 4; i++){
        ctx.fillStyle = i % 2 ? '#6a6a60' : '#7a5c34';
        ctx.fillRect(px + Math.floor(rnd2(241+i)*11)+2, py + Math.floor(rnd2(246+i)*11)+2, 2 + Math.floor(rnd2(250+i)*3), 2);
      }
    }
    else if(rnd2(255) > 0.985){   /* MURO DERRUÍDO: restos brancos do formigón */
      R(px+2, py+6, 7, 5, '#8a887c'); R(px+2, py+6, 7, 2, '#d8d5c8');
      R(px+10, py+9, 4, 3, '#8a887c'); R(px+10, py+9, 4, 1, '#d8d5c8');
      R(px+5, py+12, 3, 2, '#6a685e');
    }
    else if(rnd2(260) > 0.988){   /* COCHE OXIDADO (raro, ~1-2 por mapa) */
      R(px+1, py+11, 14, 2, '#1c2a10');
      R(px+1, py+4, 13, 7, '#8a5a2c'); R(px+1, py+4, 13, 2, '#a8743c');
      R(px+3, py+5, 4, 3, '#2c2c28'); R(px+9, py+5, 3, 3, '#2c2c28');
      R(px+1, py+10, 3, 2, '#1c1c18'); R(px+11, py+10, 3, 2, '#1c1c18');
      R(px+5, py+9, 5, 1, '#6a4420');
    }
    else if(rnd2(265) > 0.985){   /* POSTE ELÉCTRICO: alto, con travesa */
      const px2 = px + 7;
      R(px2, py+14, 4, 1, '#1c2a10');
      R(px2+1, py+1, 2, 14, '#4a3826'); R(px2+1, py+1, 2, 1, '#6a5436');
      R(px2-2, py+2, 8, 1, '#4a3826');
      R(px2-2, py+1, 1, 1, '#2c2c28'); R(px2+5, py+1, 1, 1, '#2c2c28');
    }
  } else if(here === T.DIRT){
    ctx.fillStyle = p.dark;
    for(let i=0; i<3; i++) ctx.fillRect(px+Math.floor(rnd2(40+i)*15), py+Math.floor(rnd2(45+i)*15), 1, 1);
    /* (v0.57) POZA na terra: escura con reflexo */
    if(rnd2(270) > 0.92){
      const qx = px + Math.floor(rnd2(271)*6)+2, qy = py + Math.floor(rnd2(272)*6)+3;
      R(qx, qy+1, 8, 4, '#22303a'); R(qx+1, qy, 6, 6, '#22303a');
      R(qx+2, qy+2, 3, 1, '#5a86a0');
    }
    /* (v0.57) caixa perdida */
    else if(rnd2(275) > 0.96){
      const bx = px + Math.floor(rnd2(276)*7)+2, by = py + Math.floor(rnd2(277)*7)+2;
      R(bx, by, 8, 6, '#6a5230'); R(bx, by, 8, 2, '#8a6f42'); R(bx+4, by, 1, 6, '#4a3820');
    }
  }
  /* (v0.57) SINAL DE ESTRADA: en herba pegada á estrada, raro */
  if(here === T.GRASS && (N === T.ROAD || S === T.ROAD) && rnd2(280) > 0.94){
    const sx2 = px + 7, syT = (N === T.ROAD) ? py + 8 : py + 2;
    ctx.fillStyle = '#1c2a10'; ctx.fillRect(sx2, syT + 6, 3, 1);
    ctx.fillStyle = '#4a4a42'; ctx.fillRect(sx2 + 1, syT + 1, 1, 6);
    ctx.fillStyle = rnd2(281) > 0.5 ? '#b09a30' : '#a84a3c';
    ctx.fillRect(sx2 - 1, syT - 2, 5, 4);
    ctx.fillStyle = '#26251f'; ctx.fillRect(sx2, syT - 1, 3, 2);
  }
  if(here === T.ROAD){
    if(x % 2 === 0) R(px, py+2, 1, TILE_SIZE-4, p.dark);   /* xuntas de lousa */
    /* (v0.52) cicatrices de uso: aceite, marcas de cadeas, parches, buracos */
    if(rnd2(120) > 0.86){   /* mancha de aceite */
      R(px+Math.floor(rnd2(121)*9)+2, py+Math.floor(rnd2(122)*9)+2, 4+Math.floor(rnd2(123)*3), 3, '#232420');
      R(px+Math.floor(rnd2(121)*9)+3, py+Math.floor(rnd2(122)*9)+4, 2, 2, '#1a1b18');
    }
    if(rnd2(125) > 0.84){   /* marcas de cadeas: dúas liñas paralelas */
      const ty2 = py+Math.floor(rnd2(126)*10)+2;
      R(px+1, ty2, TILE_SIZE-2, 1, p.dark);
      R(px+1, ty2+3, TILE_SIZE-2, 1, p.dark);
    }
    if(rnd2(128) > 0.90){   /* parche de asfalto novo */
      const qx = px+Math.floor(rnd2(129)*8)+2, qy = py+Math.floor(rnd2(130)*8)+2;
      R(qx, qy, 6, 5, '#454540'); R(qx, qy, 6, 1, p.dark); R(qx, qy+4, 6, 1, p.dark);
    }
    if(rnd2(132) > 0.93){   /* buraco */
      R(px+Math.floor(rnd2(133)*11)+2, py+Math.floor(rnd2(134)*11)+2, 3, 3, '#26251f');
    }
    R(px+2, py+(TILE_SIZE/2)|0, TILE_SIZE-4, 1, p.dark);
    /* liña amarela descontinua no bordo interior da fila superior da estrada */
    if(S === T.ROAD && N !== T.ROAD && x % 2 === 0) R(px+2, py+TILE_SIZE-2, TILE_SIZE-5, 2, '#c8a832');
  } else if(here === T.BRIDGE){
    R(px, py, TILE_SIZE, 1, p.dark); R(px, py+TILE_SIZE-1, TILE_SIZE, 1, p.dark);
    R(px+4, py+2, 1, TILE_SIZE-4, p.light); R(px+11, py+2, 1, TILE_SIZE-4, p.light);
  } else if(here === T.RUBBLE){
    for(let i=0; i<3; i++){
      cube(px+Math.floor(rnd2(100+i)*8)+1, py+Math.floor(rnd2(105+i)*7)+1,
           5+Math.floor(rnd2(110+i)*4), 5+Math.floor(rnd2(115+i)*4), p.base, p.side, p.accent);
    }
  }
}

/* Dibujar el grid completo/* Dibujar el grid completo. Llamado una vez al inicio en un canvas off-screen
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
  /* (v1.01) SEGUNDA PASADA: o formigón do interior. Vai despois de todo
     o chan porque un bloque proxecta sombra na cela de abaixo e sobe o
     canto á de arriba; nunha soa pasada, a cela seguinte borrábao. */
  if((window._bioma || 'VERDE') === 'INTERIOR' && typeof debuxarMacizoInterior === 'function'){
    for(let y=0; y<ROWS; y++)
      for(let x=0; x<COLS; x++) debuxarMacizoInterior(ctx, grid, x, y);
  }
  /* (v0.53) sistema de CAMIÑOS TRILLADOS: novo mapa = desgaste a cero */
  _wear = new Float32Array(COLS * ROWS);
  _wearStage = new Uint8Array(COLS * ROWS);
  _wearCtx = ctx;
  _wearGrid = grid;
  window._terrainGrid = grid;   /* (v0.60) para repintar ao cambiar de bioma */
  return canvas;
}

/* ============================================================
   (v0.53) CAMIÑOS TRILLADOS — onde as unidades pasan unha e outra
   vez, a herba/terra vaise desgastando en 3 fases. O mapa mostra
   as rutas de ataque como cicatrices. Puramente cosmético e por
   cliente; o desgaste PÍNTASE NO CACHE unha soa vez ao cruzar
   cada limiar (custo por frame: cero).
   ============================================================ */
let _wear = null, _wearStage = null, _wearCtx = null, _wearGrid = null;
function addWear(wx, wy, amt){
  if(!_wear || !_wearGrid) return;
  const cx2 = (wx / TILE_SIZE) | 0, cy2 = (wy / TILE_SIZE) | 0;
  if(cx2 < 0 || cy2 < 0 || cx2 >= COLS || cy2 >= ROWS) return;
  const t = _wearGrid[cy2][cx2];
  if(t !== T.GRASS && t !== T.DIRT) return;   /* estrada/ponte/auga non se trillan */
  const i = cy2 * COLS + cx2;
  _wear[i] += amt;
  const stg = _wear[i] > 16 ? 3 : _wear[i] > 7 ? 2 : _wear[i] > 2.5 ? 1 : 0;
  if(stg > _wearStage[i]){ _wearStage[i] = stg; _paintWear(cx2, cy2, stg); }
}
function _paintWear(x, y, stg){
  const ctx = _wearCtx; if(!ctx) return;
  const px = x * TILE_SIZE, py = y * TILE_SIZE;
  const P = TILE_PALETTES[T.DIRT];
  const sx = (x * 977 + y * 311) | 0;
  const r2 = (n) => { const s = Math.sin(sx + n * 7) * 10000; return s - Math.floor(s); };
  if(stg === 1){
    /* herba pisada: motas de terra espalladas */
    ctx.fillStyle = P.base;
    for(let i = 0; i < 6; i++)
      ctx.fillRect(px + ((r2(140+i)*13)|0) + 1, py + ((r2(146+i)*13)|0) + 1, 2, 1);
  } else if(stg === 2){
    /* parche de terra con bordo irregular */
    ctx.fillStyle = P.base; ctx.fillRect(px+3, py+4, 10, 8);
    ctx.fillStyle = P.top2; ctx.fillRect(px+4, py+5, 8, 6);
    ctx.fillStyle = P.base;
    ctx.fillRect(px + ((r2(150)*4)|0), py + ((r2(151)*10)|0) + 3, 3, 2);
    ctx.fillRect(px + 11 + ((r2(152)*3)|0), py + ((r2(153)*10)|0) + 3, 3, 2);
  } else {
    /* carreiro asentado: terra case completa + rodada escura central */
    ctx.fillStyle = P.top2; ctx.fillRect(px+1, py+1, TILE_SIZE-2, TILE_SIZE-2);
    ctx.fillStyle = P.base; ctx.fillRect(px+2, py+2, TILE_SIZE-4, TILE_SIZE-4);
    ctx.fillStyle = P.dark;
    for(let i = 0; i < 3; i++)
      ctx.fillRect(px + ((r2(160+i)*12)|0) + 2, py + ((r2(165+i)*12)|0) + 2, 2, 1);
    ctx.fillRect(px + 2, py + 7 + ((r2(168)*3)|0), TILE_SIZE - 4, 2);
  }
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
      if((window._bioma||'VERDE') === 'NEVE' && rnd2(330) > 0.55) continue;   /* (v0.60) placas de xeo */
      /* (v0.52) NON animar celas con ROCHA nin con ESCUMA de ponte:
         o repintado borraríaas; auga quieta ao pé de obstáculos é crible */
      if(rnd2(85) > 0.90) continue;
      const _bN = y>0 && grid[y-1][x]===T.BRIDGE, _bS = y+1<ROWS && grid[y+1][x]===T.BRIDGE;
      const _bW = x>0 && grid[y][x-1]===T.BRIDGE, _bE = x+1<COLS && grid[y][x+1]===T.BRIDGE;
      if(_bN || _bS || _bW || _bE) continue;
      /* Repintar la base del agua para tapar ondas anteriores
         (v0.50: coa variación top2 e redebuxando as sombras de beira) */
      ctx.fillStyle = rnd2(1) < 0.6 ? palette.base : palette.top2;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      const _N = y>0 ? grid[y-1][x] : T.WATER, _S = y+1<ROWS ? grid[y+1][x] : T.WATER;
      const _W = x>0 ? grid[y][x-1] : T.WATER, _E = x+1<COLS ? grid[y][x+1] : T.WATER;
      if(_N !== T.WATER){ ctx.fillStyle = palette.dark; ctx.fillRect(px, py, TILE_SIZE, 3); }
      if(_W !== T.WATER){ ctx.fillStyle = palette.dark; ctx.fillRect(px, py, 3, TILE_SIZE); }
      if(_E !== T.WATER){ ctx.fillStyle = palette.side; ctx.fillRect(px+TILE_SIZE-2, py, 2, TILE_SIZE); }
      if(_S !== T.WATER){ ctx.fillStyle = palette.side; ctx.fillRect(px, py+TILE_SIZE-2, TILE_SIZE, 2); }
      /* Dibujar las ondas nuevas (animadas) */
      ctx.fillStyle = palette.light;
      for(let i=0; i<2; i++){
        const wy = 2 + (Math.floor(rnd2(i+60)*9) + Math.floor(Math.sin(wave + x*0.3 + y*0.2 + i) * 2) + 9) % 11;
        ctx.fillRect(px + Math.floor(rnd2(i+65)*9)+2, py + wy, 3+Math.floor(rnd2(i+68)*3), 1);
      }
      if(rnd2(70) > 0.78){ ctx.fillStyle = palette.accent; ctx.fillRect(px+Math.floor(rnd2(71)*12)+2, py+Math.floor(rnd2(72)*12)+2, 2, 1); }
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
  let r = rnd();
  for(const c of CLIMAS){ r -= c.p; if(r <= 0) return c; }
  return CLIMAS[0];
}

/* (v0.48.4) Axuste de spawn: evita que as unidades aparezan SOLAPADAS co HQ
   ou amontoadas unhas sobre outras (facíaas 'malas de seleccionar', queixa da
   betatester). É puramente ADITIVO: só move a unidade se realmente hai colisión.
   Corre no host (autoritario), que tamén posiciona as unidades do convidado. */
function nudgeSpawn(g, team, x, y){
  const hqs = (g && g.hq) ? g.hq : (typeof HQ !== 'undefined' ? HQ : null);
  const hq = hqs && hqs[team];
  const facing = (team === 0) ? 1 : -1;   /* equipo 0 mira a +x; equipo 1 a -x */
  if(hq){
    const M = 18;   /* marxe fóra da caixa do HQ */
    if(x > hq.x - M && x < hq.x + hq.w + M && y > hq.y - M && y < hq.y + hq.h + M){
      x = (facing > 0) ? hq.x + hq.w + M + 6 : hq.x - M - 6;   /* empurra ao lado inimigo */
    }
  }
  if(g && g.units){
    for(let k = 0; k < 14; k++){
      const clash = g.units.find(u => u && !u.dead && u.team === team && !u.inside &&
        Math.abs(u.x - x) < 22 && Math.abs(u.y - y) < 22);
      if(!clash) break;
      y += 26;                                         /* baixa unha fila */
      if(hq && y > hq.y + hq.h + 130){ y = hq.y - 44; x += facing * 22; }   /* nova columna cara á fronte */
    }
  }
  const s = saírDoMacizo(x, y);
  return {x: Math.round(s.x), y: Math.round(s.y)};
}

/* ============================================================
   (v1.01) NON NACER DENTRO DUNHA PAREDE.

   Unha unidade que nace no formigón xa non sae: non hai ningunha forza
   que a empurre fóra, e queda camiñando pola masa maciza toda a
   operación. Isto busca a cela libre máis próxima e non fai nada fóra
   dun interior.

   Fai falla en tres sitios e non nun: nudgeSpawn, e as dúas oleadas de
   GRISES —que nacen a trinta píxeles do bordo do mapa, o que nun
   exterior é o campo e nunha planta é DENTRO da cortiza exterior—.
   ============================================================ */
function saírDoMacizo(x, y){
  if(typeof macizoEn !== 'function' || !macizoEn(x, y)) return {x, y};
  let mellor = null, dd = Infinity;
  for(let ry = -10; ry <= 10; ry++) for(let rx = -10; rx <= 10; rx++){
    const cx2 = x + rx*TILE_SIZE, cy2 = y + ry*TILE_SIZE;
    if(cx2 < 8 || cy2 < 8 || cx2 > W-8 || cy2 > H-8) continue;
    if(macizoEn(cx2, cy2)) continue;
    const d2 = rx*rx + ry*ry;
    if(d2 < dd){ dd = d2; mellor = {x: cx2, y: cy2}; }
  }
  return mellor || {x, y};
}
/* ============================================================
   A HORA DO MUNDO.

   Estaba escrita TRES veces coa mesma fórmula copiada —15-luz.js,
   11-retratos-ui.js e 10-estructuras.js— e o comentario que avisaba da
   duplicación só mencionaba dúas. Agora vive aquí, ao carón do sitio
   onde nace a batalla, e as tres pídena.

   POR QUE CAMBIA O RITMO. A fórmula vella era `9 + t/9000`: dez horas
   de mundo en 90.000 ticks. Medíronse cinco batallas e duran entre
   3.798 e 5.176 ticks, media 4.343. Traducido: TODAS acababan entre as
   9,0 e as 9,5, sempre no primeiro 6% da rampa de luz, que resulta ser
   o tramo máis escuro e frío de todos. A tarde, o solpor e o
   lusco-fusco eran contido morto: ninguén os viu nunca.

   Con 900 ticks por hora, unha batalla media percorre 4,8 horas. Xa é
   un arco e non un punto.

   POR QUE NON EMPEZA SEMPRE IGUAL. Media das batallas na mañá e o resto
   na noite indo cara ao abrente. O segundo caso é o interesante: a
   escuridade cae AO PRINCIPIO, cando aínda hai poucas unidades na
   pantalla, e a partida vaise aclarando segundo se complica. Ao revés
   sería castigar o final.

   O TOPE BAIXA ÁS 18, e isto si é un cambio. Medindo hora a hora, entre
   as 18 e as 19 o mapa pasa de ter un 6,7% dos píxeles esmagados a ter
   un 45,8%: sete veces máis nunha soa hora. Ese é o precipicio.

   Coa rampa vella as 19 quedaban a 90.000 ticks e non as vía ninguén,
   así que non se perde nada que alguén tivese visto. Coa nova, unha
   batalla longa chegaría alí de verdade, e alí non se xoga: acabaría
   case a metade do mapa por debaixo do limiar no que un panel deixa de
   separar tons. O escuro segue existindo —está no arranque de noite,
   que é frío pero desaturado e mide ben— pero non ao final, cando a
   pantalla está chea de cousas que hai que distinguir.
   ============================================================ */
const TICKS_POR_HORA = 900;
const HORA_TOPE = 18;

/* De onde arranca a batalla. O peso é a proporción: de cada cinco, tres
   empezan pola mañá e dúas de noite. */
const HORA_ARRANQUE = [
  { hora: 9, peso: 3 },   /* mañá cara ao mediodía */
  { hora: 4, peso: 2 },   /* noite cara ao abrente */
];

function escollerHoraArranque(){
  const total = HORA_ARRANQUE.reduce((a, h) => a + h.peso, 0);
  let r = rnd() * total;
  for(const h of HORA_ARRANQUE){ r -= h.peso; if(r <= 0) return h.hora; }
  return HORA_ARRANQUE[0].hora;
}

/* A hora que é agora mesmo neste mundo. Respecta a hora forzada da capa
   de luz, que é como se proban as horas sen xogar dez minutos. */
function mundoHora(g){
  if(typeof LUZ !== 'undefined' && LUZ && LUZ.horaForzada != null) return LUZ.horaForzada;
  const ini = (g && typeof g.horaInicio === 'number') ? g.horaInicio : HORA_ARRANQUE[0].hora;
  return Math.min(HORA_TOPE, ini + ((g && g.t) || 0) / TICKS_POR_HORA);
}

function newBattle(deployed){
  /* (v0.78) SEMENTE DA BATALLA — o primeiro de todo.
     O mapa constrúese antes de que exista o obxecto da batalla, así que
     se non se semente AQUÍ, buildDefaultMap() e pickClima() caerían en
     Math.random() e dúas partidas coa mesma semente xa arrancarían
     distintas. Ponse un portador provisional en `game` para que rnd()
     teña de onde tirar, e despois pásase o estado ao obxecto de verdade.
     window._semente permite repetir unha partida exacta. */
  const _semente = (typeof window._semente === 'number')
    ? (window._semente >>> 0)
    : (Math.random() * 0x100000000) >>> 0;
  window._semente = null;   /* dun só uso: a seguinte batalla volve ser nova */
  game = {rngEstado: _semente};
  try{ startMusic(); }catch(e){ console.warn('[música]', e); }   /* (v0.36) xamais no camiño crítico */
  /* (v0.60) bioma da batalla: o Mundial fixa a sede; a campaña vai en VERDE */
  /* O BIOMA PÍDESE, NON SE IMPÓN. Aquí forzábase VERDE agás para o
     Mundial, así que calquera outro modo que escollese mapa víao pisado
     ao xerar o terreo: o selector do Crisol amosábase e non facía nada.

     Agora quen queira un bioma déixao en `window._biomaPedido` e
     consómese aquí, unha vez. Sen petición, VERDE: a campaña vai sempre
     en verde e iso non cambia. */
  if(typeof setBioma === 'function'){
    const _pedido = window._mundialArranque ? (window._mundialBioma || 'VERDE')
                                            : (window._biomaPedido || 'VERDE');
    setBioma(_pedido);
  }
  window._biomaPedido = null;
  const _crisol = !!window._modoCrisol;
  window._modoCrisol = false;
  /* (v0.9) Escoller mapa segundo a operación */
  /* (v0.39) PvP: batalla 1 en MAP1 (simétrico coñecido); revanchas con mapa
     procedural SEMENTADO (o host publica o seed, os dous xeran o mesmo). */
  /* (v1.01) UNHA OPERACIÓN DE INTERIOR TRAE O SEU MAPA. Vai por diante
     de todo o demais: se se deixase que escollese o mapa da operación,
     applyMap poñería COLS/ROWS ao tamaño dese mapa e a planta escrita
     —que mide o que mide— ocuparía só un anaco del. */
  const _planta = window._plantaPedida && (typeof mapaDaPlanta === 'function')
    ? mapaDaPlanta(window._plantaPedida) : null;
  const mapDef = _planta
    ? _planta
    : window._mundialArranque
    ? genMap()                                   /* (v0.61) Mundial: sempre procedural (campos grandes) */
    : window._pvpArranque
    ? (window._pvpMapaSeed ? genMap(window._pvpMapaSeed) : MAP1)
    : ((DATA.opCount >= 2) ? genMap() : ((DATA.opCount >= 1) ? MAP2 : MAP1));
  applyMap(mapDef);

  /* Construir el mapa de celdas y cachear el dibujo estático */
  /* A planta de interior é outro xerador, non unha variante do de fóra:
     alí escávase, aquí énchese. */
  /* Tres vías: planta escrita (campaña), planta xerada (Crisol) ou
     terreo aberto (todo o demais). */
  TERRAIN_GRID  = (window._plantaPedida && plantaAGrid(window._plantaPedida))
    || ((window._bioma === 'INTERIOR') ? buildInteriorMap() : buildDefaultMap());
  window._plantaPedida = null;
  /* Nunha planta escrita as estruturas xa veñen no sitio: os
     fondeadeiros son parte da planta e o xerador xa comprobou que
     caben. Reaxustalas aquí sería movelas dun sitio bo a outro peor.
     No Crisol, en cambio, a planta é aleatoria e non declara nada. */
  if(window._bioma === 'INTERIOR' && !_planta) axustarEstruturasAPlanta(TERRAIN_GRID);
  window._terrainGrid = TERRAIN_GRID;   /* macizoEn() consúltao en cada paso */
  TERRAIN_CACHE = buildTerrainCache(TERRAIN_GRID);

  const g = {
    units:[], tracers:[], remains:[], scrap:[], walls: (window._bioma === 'INTERIOR' && typeof buildInteriorWalls === 'function')
      ? buildInteriorWalls(TERRAIN_GRID) : buildWallsFromMap(), craters:[], clima: pickClima(), chatarraGanada:0, turretPending:0, t:0, over:false, result:null, finished:false,
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
  /* (v0.76) O global `game` ASÍGNASE AQUÍ, antes de crear unha soa unidade.
     mkUnit numera os inimigos con `game ? ++game.enemyN : 1`, e ata agora
     `game` non se asignaba ata que newBattle DEVOLVÍA: na primeira batalla
     da sesión todos os inimigos do arranque saían como K-01, e nas
     seguintes numerábanse co contador da batalla ANTERIOR.
     Importa no PvP, que resolve ocupantes de torretas e vehículos por id
     (pvpAplicarSnap): con ids repetidos, find() devolve a unidade
     equivocada. */
  /* (v0.78) O estado do azar pasa do portador provisional ao obxecto de
     verdade, e viaxa xa con el: gárdase, snapshotéase e reprodúcese. */
  /* (v0.94) A hora á que arranca esta batalla. Sae do fluxo sementado,
     non de Math.random(): dúas partidas coa mesma semente teñen que
     amencer á mesma hora. */
  g.horaInicio = escollerHoraArranque();
  g.semente = _semente;
  g.rngEstado = game.rngEstado;
  game = g;
  if(typeof efxLimpar === 'function') efxLimpar();   /* (v0.83) sen restos da batalla anterior */
  deployed.forEach((vu,i)=>{
    const _sp = nudgeSpawn(g, PT, PT===0 ? HQ[0].x + HQ[0].w + 30 : HQ[1].x - 30, HQ[PT].y - 28 + i*40);
    const u = mkUnit(PT, vu.cls, _sp.x, _sp.y, vu);
    g.units.push(u);
    radio(TXT('r.desplegado', {id:vu.id, n:vu.name, op:vu.ops+1}), '#7fdc7f');
  });
  const _pdx = PT===0 ? (d)=>HQ[0].x + HQ[0].w + d : (d)=>HQ[1].x - d;
  if(!window._mundialArranque){   /* (v0.60) o Mundial xoga co XI puro, sen extras */
  { const _g = nudgeSpawn(g, PT, _pdx(30), HQ[PT].y + HQ[PT].h + 20); g.units.push(mkUnit(PT,'GRUNT', _g.x, _g.y, null)); }
  { const _e = nudgeSpawn(g, PT, _pdx(40), HQ[PT].y + HQ[PT].h + 60); g.units.push(mkUnit(PT,'ENGINEER', _e.x, _e.y, null)); }
  }

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
    if(!window._mundialArranque){   /* (v0.60) o rival do Mundial é o XI da doutrina, sen extras */
    /* (v1.01) Por nudgeSpawn coma todos os demais. Estes dous eran o
       único despregamento que non pasaba por el, e nun interior iso
       significaba nacer dentro dun muro: unha unidade que nace no
       formigón xa non sae, porque non hai nada que a empurre fóra. */
    { const _s = nudgeSpawn(g, ET, _edx(35), HQ[ET].y - 28);
      g.units.push(mkUnit(ET,'GRUNT', _s.x, _s.y, null)); }
    { const _s = nudgeSpawn(g, ET, _edx(40), HQ[ET].y + HQ[ET].h + 40);
      g.units.push(mkUnit(ET,'ENGINEER', _s.x, _s.y, null)); }
    }
  } else if(window._mundialArranque){
    /* (v0.61.4) MUNDIAL con opCount>0: NADA aquí — o rival é SÓ o XI da
       doutrina que monta o módulo. Esta rama metía 13 veteranos de campaña
       ENRIBA do XI (24 rivais no saque) e esnaquizaba os 11 do xogador en
       segundos: "siguen sin estar os 11" — estaban, pero morrían xa. */
  } else {
    const playerInitial = deployed.length + 2;  /* veteranos + GRUNT + ENGINEER */
    const playerVeterans = deployed.length;

    /* Composición: 1 Engineer garantizado + resto mezcla */
    const enemyClasses = ['ENGINEER'];
    for(let i=1; i<playerInitial; i++){
      const r = rnd();
      enemyClasses.push(r<0.55 ? 'GRUNT' : r<0.85 ? 'HEAVY' : 'ENGINEER');
    }
    /* Mezclar para que el veterano enemigo no sea siempre el Engineer */
    for(let i=enemyClasses.length-1; i>0; i--){
      const j = Math.floor(rnd()*(i+1));
      [enemyClasses[i], enemyClasses[j]] = [enemyClasses[j], enemyClasses[i]];
    }

    /* Pool de nombres enemigos veteranos sin repetidos en esta partida */
    const usedEnemyNames = new Set();
    const pickEnemyVetName = () => {
      const free = ENEMY_VETERAN_NAMES.filter(n => !usedEnemyNames.has(n));
      const name = free.length
        ? free[Math.floor(rnd()*free.length)]
        : ENEMY_VETERAN_NAMES[Math.floor(rnd()*ENEMY_VETERAN_NAMES.length)];
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
      return rnd() < p;
    });
    /* Mezclar y limitar al número de huecos disponibles */
    for(let i = recurringPool.length - 1; i > 0; i--){
      const j = Math.floor(rnd()*(i+1));
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
      /* (v1.01) Estas coordenadas eran fixas —820, 170+i*36— e viñan da
         xeometría de MAP1. Nun mapa procedural de 1920x1152 xa deixaban
         o despregamento inimigo a media travesía do seu HQ, e nunha
         planta de interior podían deixalo dentro do formigón. Agora
         saen do HQ inimigo real e pasan por nudgeSpawn coma todo o
         demais. */
      const _s = nudgeSpawn(g, ET, ET===1 ? HQ[1].x - 30 : HQ[0].x + HQ[0].w + 30,
                            HQ[ET].y - 28 + i * 36);
      g.units.push(mkUnit(ET, cls, _s.x, _s.y, persistedEnemy));
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
    setTimeout(() => hqSay(TXT('hq.crisolInicio'), 0, 'hq.crisolInicio'), 3600);
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
  let r = rnd() * total;
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
  try{ if(typeof diarioEixos === 'function') diarioEixos({apego: 1}); }catch(e){}   /* (v0.65) */
  return true;
}

