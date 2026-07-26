#!/usr/bin/env node
/* ============================================================
   BANCO EN BLENDER — mesma folla de contacto ca banco.js, pero cos
   sprites renderizados en Blender en vez de co rasterizador propio.

   Está feito para COMPARAR: cada fila de Blender vai xusto enriba da
   mesma fila feita con vox3d.js. Se o cambio non se nota a 22 píxeles,
   non paga a pena manter dous pipelines.

   O render e o encadre viven en sprites_blender.js; aquí só se monta a
   folla e se miden as dúas cifras que interesan.

   Uso:
     node tools/banco_blender.js --clase ENGINEER
     node tools/banco_blender.js --clase HEAVY --reusar
   ============================================================ */
const path = require('path');
const { sprite } = require('./vox3d.js');
const { montar, ESTADOS } = require('./modelos.js');
const { escribir } = require('./png.js');
const { xerar } = require('./sprites_blender.js');

const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };

const CLASE = op('clase', 'ENGINEER');
const ALT   = parseInt(op('alto', '22'), 10);
const ZOOM  = parseInt(op('zoom', '7'), 10);
const RES   = parseInt(op('res', '256'), 10);
const TERREO = [77, 106, 42], FONDO = [22, 26, 18], SEPAR = [40, 46, 32];

/* ---------- que cadros fan falla ---------- */
const cadros = [];
const engadir = (nome, estado, fase, yaw) => { cadros.push({ nome, estado, fase, yaw }); return nome; };
const filaAndar = [0, 0.25, 0.5, 0.75].map((f, i) => engadir(`andar${i}`, 'ANDAR', f, 0));
const filaDirs  = Array.from({length: 8}, (_, d) => engadir(`dir${d}`, 'ANDAR', 0, d*2*Math.PI/8));
const filaEst   = ESTADOS.map(e => engadir(`est_${e}`, e, e === 'ANDAR' ? 0.25 : 0.35, 0));

console.log(`  ${cadros.length} cadros de ${CLASE} en Blender a ${RES}px...`);
const bl = xerar(CLASE, cadros, { alt: ALT, res: RES, reusar: argv.includes('--reusar') });

/* ---------- folla ---------- */
function lenzo(w, h, cor){
  const px = Buffer.alloc(w*h*4);
  for(let i = 0; i < w*h; i++){ px[i*4] = cor[0]; px[i*4+1] = cor[1]; px[i*4+2] = cor[2]; px[i*4+3] = 255; }
  return { ancho: w, alto: h, px };
}
function pegar(dst, src, dx, dy, zoom){
  for(let y = 0; y < src.alto*zoom; y++) for(let x = 0; x < src.ancho*zoom; x++){
    const s = ((y/zoom|0)*src.ancho + (x/zoom|0))*4, a = src.px[s+3]/255;
    if(a === 0) continue;
    const X = dx+x, Y = dy+y;
    if(X < 0 || Y < 0 || X >= dst.ancho || Y >= dst.alto) continue;
    const d = (Y*dst.ancho + X)*4;
    for(let k = 0; k < 3; k++) dst.px[d+k] = Math.round(src.px[s+k]*a + dst.px[d+k]*(1-a));
  }
}

const filas = [
  { et: `${CLASE} · andar — BLENDER`,        cel: filaAndar.map(n => bl[n]) },
  { et: `${CLASE} · andar — vox3d`,          cel: [0,0.25,0.5,0.75].map(f => sprite(montar(CLASE,'ANDAR',f), ALT, 0)) },
  { et: `${CLASE} · 8 direccións — BLENDER`, cel: filaDirs.map(n => bl[n]) },
  { et: `${CLASE} · 8 direccións — vox3d`,   cel: Array.from({length:8}, (_,d) => sprite(montar(CLASE,'ANDAR',0), ALT, d*2*Math.PI/8)) },
  { et: `${CLASE} · estados — BLENDER`,      cel: filaEst.map(n => bl[n]) },
];

const CEL = Math.round(ALT*1.7)*ZOOM, MAR = 10;
const cols = Math.max(...filas.map(f => f.cel.length));
const folla = lenzo(MAR*2 + cols*(CEL+4), MAR*2 + filas.length*(CEL+4), FONDO);
filas.forEach((fila, r) => {
  fila.cel.forEach((s, c) => {
    const x = MAR + c*(CEL+4), y = MAR + r*(CEL+4);
    pegar(folla, lenzo(1, 1, TERREO), x, y, CEL);
    pegar(folla, s, x + ((CEL - s.ancho*ZOOM)>>1), y + ((CEL - s.alto*ZOOM)>>1), ZOOM);
    for(let i = 0; i < CEL; i++){
      for(const Y of [y-1, y+CEL]){ const d = (Y*folla.ancho + x+i)*4; folla.px[d]=SEPAR[0]; folla.px[d+1]=SEPAR[1]; folla.px[d+2]=SEPAR[2]; }
      for(const X of [x-1, x+CEL]){ const d = ((y+i)*folla.ancho + X)*4; folla.px[d]=SEPAR[0]; folla.px[d+1]=SEPAR[1]; folla.px[d+2]=SEPAR[2]; }
    }
  });
});

const saida = path.join(__dirname, '..', 'capturas', `banco_blender_${CLASE}.png`);
escribir(saida, folla);

/* ---------- métrica ----------
   As mesmas dúas medidas ca banco.js: canto contorno hai (lexibilidade) e
   cantos tons distintos (riqueza). A arte de referencia dá ~18% e ~406. */
function medir(cel){
  let bordo = 0, cheo = 0; const tons = new Set();
  for(const s of cel) for(let i = 0; i < s.ancho*s.alto; i++){
    if(s.px[i*4+3] < 24) continue;
    cheo++;
    tons.add(s.px[i*4] + ',' + s.px[i*4+1] + ',' + s.px[i*4+2]);
    if(s.px[i*4] < 40 && s.px[i*4+1] < 45) bordo++;
  }
  return { contorno: Math.round(bordo*100/Math.max(1,cheo)), tons: tons.size };
}
console.log('\n  fila                                contorno   tons');
console.log('  ' + '-'.repeat(56));
for(const f of filas){
  const m = medir(f.cel);
  console.log('  ' + f.et.padEnd(34) + String(m.contorno + '%').padStart(6) + String(m.tons).padStart(8));
}
console.log('\n  referencia da arte: contorno ~18%, tons ~406');
console.log('  ' + saida + '\n');
