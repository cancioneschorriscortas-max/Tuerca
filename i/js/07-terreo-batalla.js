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
/* (v0.50) Paletas VOXEL: máis luminosas, con cara superior (base/top2) e
   cara lateral (side) para a ilusión de bloque. Validadas nun banco de
   probas visual á parte antes do porte. */
/* (v0.60) BIOMAS: tres mundos coa mesma técnica voxel. Validados no lab
   (terreo_lab/biomas.py). setBioma() cámbiaos; a campaña usa VERDE. */
const BIOMA_PALETTES = {
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
  /* catch-light ocasional (sen raiado) */
  if(rnd2(5) > 0.62) R(px+Math.floor(rnd2(6)*8), py, 6+Math.floor(rnd2(7)*6), 1, top === p.base ? p.top2 : p.base);
  /* caras laterais do bloque cara a veciños máis baixos */
  if(TILE_HEIGHT[S] < TILE_HEIGHT[here]) R(px, py+TILE_SIZE-3, TILE_SIZE, 3, p.side);
  if(TILE_HEIGHT[E] < TILE_HEIGHT[here]) R(px+TILE_SIZE-2, py, 2, TILE_SIZE, p.side);

  /* ---- detalle por tipo ---- */
  if(here === T.GRASS){
    if(rnd2(80) > 0.86){
      cube(px+Math.floor(rnd2(81)*9)+2, py+Math.floor(rnd2(82)*8)+2, 5, 5, p.accent, p.side, '#9ec868');
    }
    if(rnd2(90) > 0.94){   /* vexetación grande por bioma */
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
  let r = Math.random();
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
  return {x: Math.round(x), y: Math.round(y)};
}
function newBattle(deployed){
  try{ startMusic(); }catch(e){ console.warn('[música]', e); }   /* (v0.36) xamais no camiño crítico */
  /* (v0.60) bioma da batalla: o Mundial fixa a sede; a campaña vai en VERDE */
  if(typeof setBioma === 'function') setBioma(window._mundialArranque ? (window._mundialBioma || 'VERDE') : 'VERDE');
  const _crisol = !!window._modoCrisol;
  window._modoCrisol = false;
  /* (v0.9) Escoller mapa segundo a operación */
  /* (v0.39) PvP: batalla 1 en MAP1 (simétrico coñecido); revanchas con mapa
     procedural SEMENTADO (o host publica o seed, os dous xeran o mesmo). */
  const mapDef = window._mundialArranque
    ? genMap()                                   /* (v0.61) Mundial: sempre procedural (campos grandes) */
    : window._pvpArranque
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
  /* (v0.76) O global `game` ASÍGNASE AQUÍ, antes de crear unha soa unidade.
     mkUnit numera os inimigos con `game ? ++game.enemyN : 1`, e ata agora
     `game` non se asignaba ata que newBattle DEVOLVÍA: na primeira batalla
     da sesión todos os inimigos do arranque saían como K-01, e nas
     seguintes numerábanse co contador da batalla ANTERIOR.
     Importa no PvP, que resolve ocupantes de torretas e vehículos por id
     (pvpAplicarSnap): con ids repetidos, find() devolve a unidade
     equivocada. */
  game = g;
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
    g.units.push(mkUnit(ET,'GRUNT',    _edx(35), HQ[ET].y - 28, null));
    g.units.push(mkUnit(ET,'ENGINEER', _edx(40), HQ[ET].y + HQ[ET].h + 40, null));
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
  try{ if(typeof diarioEixos === 'function') diarioEixos({apego: 1}); }catch(e){}   /* (v0.65) */
  return true;
}

