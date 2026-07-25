#!/usr/bin/env node
/* ============================================================
   BANCO DE MODELOS — folla de contacto para aprobar ou descartar.

   Renderiza os modelos e escribe un PNG grande e ampliado, sobre a
   cor real do terreo, para poder xulgar sen abrir o xogo.

   Uso:
     node tools/banco.js                       ciclo de andar + 8 direccións
     node tools/banco.js --estados             unha fila por estado
     node tools/banco.js --alto 26 --zoom 8
     node tools/banco.js --clase HEAVY

   O xuízo métrico (densidade de contorno, número de tons) sae por
   consola. O xuízo de se é BONITO é humano — para iso está o PNG.
   ============================================================ */
const path = require('path');
const { sprite, PAL } = require('./vox3d.js');
const { montar, ESTADOS, CLASES } = require('./modelos.js');
const { escribir } = require('./png.js');

const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const ten = (n) => argv.includes('--' + n);

const ALT  = parseInt(op('alto', '22'), 10);
const ZOOM = parseInt(op('zoom', '7'), 10);
const SS   = parseInt(op('ss', '5'), 10);
const soClase = op('clase', null);
const clases = soClase ? [soClase] : CLASES;
const TERREO = [77, 106, 42];        /* a herba real do bioma VERDE */
const FONDO  = [22, 26, 18];
const SEPAR  = [40, 46, 32];

/* ---------- Lenzo ---------- */
function lenzo(w, h, cor){
  const px = Buffer.alloc(w*h*4);
  for(let i = 0; i < w*h; i++){
    px[i*4] = cor[0]; px[i*4+1] = cor[1]; px[i*4+2] = cor[2]; px[i*4+3] = 255;
  }
  return { ancho: w, alto: h, px };
}
function pegar(dst, src, dx, dy, zoom){
  for(let y = 0; y < src.alto*zoom; y++){
    for(let x = 0; x < src.ancho*zoom; x++){
      const s = ((y/zoom|0)*src.ancho + (x/zoom|0))*4;
      const a = src.px[s+3]/255;
      if(a === 0) continue;
      const X = dx+x, Y = dy+y;
      if(X < 0 || Y < 0 || X >= dst.ancho || Y >= dst.alto) continue;
      const d = (Y*dst.ancho + X)*4;
      for(let k = 0; k < 3; k++) dst.px[d+k] = Math.round(src.px[s+k]*a + dst.px[d+k]*(1-a));
    }
  }
}
function marco(dst, x, y, w, h, cor){
  for(let i = 0; i < w; i++){
    for(const Y of [y, y+h-1]){ const d = (Y*dst.ancho + x+i)*4; dst.px[d]=cor[0]; dst.px[d+1]=cor[1]; dst.px[d+2]=cor[2]; }
  }
  for(let j = 0; j < h; j++){
    for(const X of [x, x+w-1]){ const d = ((y+j)*dst.ancho + X)*4; dst.px[d]=cor[0]; dst.px[d+1]=cor[1]; dst.px[d+2]=cor[2]; }
  }
}

/* ---------- Métricas (o xuízo obxectivo) ---------- */
function metricas(im){
  let escuros = 0, opacos = 0;
  const tons = new Set();
  for(let i = 0; i < im.ancho*im.alto; i++){
    if(!im.px[i*4+3]) continue;
    opacos++;
    const r = im.px[i*4], g = im.px[i*4+1], b = im.px[i*4+2];
    if(r+g+b < 150) escuros++;
    tons.add((r<<16) | (g<<8) | b);
  }
  return { contorno: opacos ? escuros/opacos : 0, tons: tons.size, opacos };
}

/* ---------- Xeración ---------- */
const t0 = Date.now();
const filas = [];

if(ten('estados')){
  for(const cls of clases){
    for(const est of ESTADOS){
      const n = est === 'REPOUSO' ? 1 : 4;
      const cel = [];
      for(let i = 0; i < n; i++) cel.push(sprite(montar(cls, est, i/n), ALT, 0, SS));
      filas.push({ etiqueta: `${cls} · ${est}`, cel });
    }
  }
} else {
  for(const cls of clases){
    filas.push({ etiqueta: `${cls} · andar`,
      cel: [0, 0.25, 0.5, 0.75].map(f => sprite(montar(cls, 'ANDAR', f), ALT, 0, SS)) });
    filas.push({ etiqueta: `${cls} · 8 direccións`,
      cel: Array.from({length: 8}, (_, d) => sprite(montar(cls, 'ANDAR', 0), ALT, d*2*Math.PI/8, SS)) });
  }
}

const ms = Date.now() - t0;
const nSprites = filas.reduce((s, f) => s + f.cel.length, 0);

/* ---------- Composición ---------- */
const CW = Math.max(...filas.flatMap(f => f.cel.map(c => c.ancho))) * ZOOM + 10;
const CH = ALT*ZOOM + 10;
const MARXE = 150;
const W = MARXE + Math.max(...filas.map(f => f.cel.length)) * CW + 12;
const H = 16 + filas.length * (CH + 8);
const out = lenzo(W, H, FONDO);

filas.forEach((fila, r) => {
  const y = 12 + r*(CH+8);
  fila.cel.forEach((s, i) => {
    const x = MARXE + i*CW;
    /* Cada sprite sobre a cor real da herba: xulgar sobre negro engana. */
    for(let yy = 0; yy < CH; yy++) for(let xx = 0; xx < CW-6; xx++){
      const d = ((y+yy)*W + x+xx)*4;
      out.px[d] = TERREO[0]; out.px[d+1] = TERREO[1]; out.px[d+2] = TERREO[2];
    }
    marco(out, x, y, CW-6, CH, SEPAR);
    pegar(out, s, x + ((CW-6) - s.ancho*ZOOM)/2 | 0, y + CH - 5 - s.alto*ZOOM, ZOOM);
  });
});

const saida = path.join(__dirname, '..', 'capturas', op('saida', 'banco.png'));
require('fs').mkdirSync(path.dirname(saida), { recursive: true });
escribir(saida, out);

console.log(`\n${saida}`);
console.log(`${nSprites} sprites en ${ms} ms  (${(ms/nSprites).toFixed(1)} ms cada un)\n`);
console.log('  fila                      contorno   tons');
console.log('  ' + '-'.repeat(46));
for(const f of filas){
  const m = metricas(f.cel[0]);
  const aviso = m.tons < 100 ? '  <- poucos tons' : '';
  console.log(`  ${f.etiqueta.padEnd(24)}  ${(m.contorno*100).toFixed(0).padStart(5)}%  ${String(m.tons).padStart(5)}${aviso}`);
}
console.log('\n  referencia da arte: contorno ~18%, tons ~406\n');
