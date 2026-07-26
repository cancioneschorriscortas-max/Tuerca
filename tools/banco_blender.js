#!/usr/bin/env node
/* ============================================================
   BANCO EN BLENDER — mesma folla de contacto ca banco.js, pero cos
   sprites renderizados en Blender en vez de co rasterizador propio.

   Está feito para COMPARAR: cada fila de Blender vai xusto enriba da
   mesma fila feita con vox3d.js. Se o cambio non se nota a 22 píxeles,
   non paga a pena manter dous pipelines.

   Diferenza importante co pipeline vello: o encadre é COMÚN a todos os
   cadros dunha clase. Recortando cada cadro polo seu propio contorno,
   o boneco baila entre fotogramas porque a caixa cambia de tamaño ao
   mover as pernas. Aquí mídese a caixa de todos e recórtase igual.

   Uso:
     node tools/banco_blender.js --clase ENGINEER
     node tools/banco_blender.js --clase ENGINEER --alto 22 --zoom 7
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { sprite, reducir, PAL } = require('./vox3d.js');
const { montar, ESTADOS } = require('./modelos.js');
const { ler, escribir } = require('./png.js');

const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };

const CLASE = op('clase', 'ENGINEER');
const ALT   = parseInt(op('alto', '22'), 10);
const ZOOM  = parseInt(op('zoom', '7'), 10);
const RES   = parseInt(op('res', '256'), 10);
const TERREO = [77, 106, 42];
const FONDO  = [22, 26, 18];
const SEPAR  = [40, 46, 32];
const CARAS = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];

const tmp = path.join(__dirname, '..', 'capturas', '_blender');
fs.mkdirSync(tmp, { recursive: true });

function atoparBlender(){
  const base = 'C:/Program Files/Blender Foundation';
  if(!fs.existsSync(base)) throw new Error('non atopo Blender en ' + base);
  for(const d of fs.readdirSync(base).sort().reverse()){
    const p = path.join(base, d, 'blender.exe');
    if(fs.existsSync(p)) return p;
  }
  throw new Error('non atopo blender.exe');
}

/* ---------- que cadros fan falla ---------- */
const cadros = [];
const engadir = (nome, estado, fase, yaw) => {
  cadros.push({ nome, yaw, pezas: montar(CLASE, estado, fase).pezas.map(([verts, cor]) => ({ verts, cor })) });
  return nome;
};
const filaAndar = [0, 0.25, 0.5, 0.75].map((f, i) => engadir(`andar${i}`, 'ANDAR', f, 0));
const filaDirs  = Array.from({length: 8}, (_, d) => engadir(`dir${d}`, 'ANDAR', 0, d*2*Math.PI/8));
const filaEst   = ESTADOS.map(e => engadir(`est_${e}`, e, e === 'ANDAR' ? 0.25 : 0.35, 0));

/* ---------- renderizar ---------- */
const entrada = path.join(tmp, 'traballo.json');
fs.writeFileSync(entrada, JSON.stringify({ caras: CARAS, cadros, luminosas: [PAL.ollo] }), 'utf8');
/* --reusar salta o render e monta a folla cos PNG que xa hai. Axustar o
   contorno ou o encadre non precisa volver renderizar 17 cadros. */
if(argv.includes('--reusar')){
  console.log('  reusando os renders de ' + tmp);
} else {
  console.log(`  renderizando ${cadros.length} cadros de ${CLASE} en Blender a ${RES}px...`);
  execFileSync(atoparBlender(), ['--background', '--python', path.join(__dirname, 'blender_banco.py'),
                                 '--', entrada, tmp, String(RES)], { stdio: 'pipe' });
}

/* ---------- encadre común ---------- */
/* A caixa que contén TODOS os cadros. Así o boneco non baila. */
function contorno(im){
  let x0 = im.ancho, y0 = im.alto, x1 = -1, y1 = -1;
  for(let y = 0; y < im.alto; y++) for(let x = 0; x < im.ancho; x++){
    if(im.px[(y*im.ancho + x)*4 + 3] > 8){
      if(x < x0) x0 = x; if(x > x1) x1 = x;
      if(y < y0) y0 = y; if(y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}
const cru = {};
let caixa = null;
for(const c of cadros){
  const im = ler(path.join(tmp, c.nome + '.png'));
  cru[c.nome] = im;
  const b = contorno(im);
  caixa = caixa ? { x0: Math.min(caixa.x0, b.x0), y0: Math.min(caixa.y0, b.y0),
                    x1: Math.max(caixa.x1, b.x1), y1: Math.max(caixa.y1, b.y1) } : b;
}

/* ---------- contorno escuro ---------- */
/* A 22 píxeles, sen liña escura o boneco desfaise contra a herba. O
   rasterizador xa a poñía; aquí ponse igual, e antes de reducir para que
   quede suavizada en vez de dentada. */
function contornear(im, gr){
  const fóra = Buffer.from(im.px);
  for(let y = 0; y < im.alto; y++) for(let x = 0; x < im.ancho; x++){
    const i = (y*im.ancho + x)*4;
    if(im.px[i+3] > 24) continue;
    let veciño = false;
    for(let dy = -gr; dy <= gr && !veciño; dy++) for(let dx = -gr; dx <= gr; dx++){
      const X = x+dx, Y = y+dy;
      if(X < 0 || Y < 0 || X >= im.ancho || Y >= im.alto) continue;
      if(im.px[(Y*im.ancho + X)*4 + 3] > 128){ veciño = true; break; }
    }
    if(veciño){ fóra[i] = 12; fóra[i+1] = 14; fóra[i+2] = 12; fóra[i+3] = 255; }
  }
  return { ancho: im.ancho, alto: im.alto, px: fóra };
}

/* O grosor mídese sobre a escala FINAL, non sobre a do render: hai que
   saber cantos píxeles de render fai un píxel de sprite, e iso só se sabe
   despois de recortar. Calculándoo sobre RES saía ancho de máis e o
   boneco quedaba afogado nun halo negro.
   E o encadre ten que medrar ese mesmo grosor, ou o contorno queda
   cortado xusto polos bordos. */
const GROSO = Math.max(1, Math.round((caixa.y1 - caixa.y0 + 1)/ALT * 0.55));
caixa = {
  x0: Math.max(0, caixa.x0 - GROSO), y0: Math.max(0, caixa.y0 - GROSO),
  x1: Math.min(RES-1, caixa.x1 + GROSO), y1: Math.min(RES-1, caixa.y1 + GROSO),
};

function acabar(nome){
  const w = caixa.x1 - caixa.x0 + 1, h = caixa.y1 - caixa.y0 + 1;
  const im = contornear(cru[nome], GROSO);
  const px = Buffer.alloc(w*h*4);
  for(let y = 0; y < h; y++)
    im.px.copy(px, y*w*4, ((y+caixa.y0)*im.ancho + caixa.x0)*4, ((y+caixa.y0)*im.ancho + caixa.x0 + w)*4);
  let rec = { ancho: w, alto: h, px };
  while(rec.alto > ALT*2) rec = reducir(rec, Math.max(1, rec.ancho >> 1), rec.alto >> 1);
  return reducir(rec, Math.max(1, Math.round(rec.ancho * ALT / rec.alto)), ALT);
}

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
  { et: `${CLASE} · andar — BLENDER`,      cel: filaAndar.map(acabar) },
  { et: `${CLASE} · andar — vox3d`,        cel: [0,0.25,0.5,0.75].map(f => sprite(montar(CLASE,'ANDAR',f), ALT, 0)) },
  { et: `${CLASE} · 8 direccións — BLENDER`, cel: filaDirs.map(acabar) },
  { et: `${CLASE} · 8 direccións — vox3d`,   cel: Array.from({length:8}, (_,d) => sprite(montar(CLASE,'ANDAR',0), ALT, d*2*Math.PI/8)) },
  { et: `${CLASE} · estados — BLENDER`,    cel: filaEst.map(acabar) },
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

/* ---------- métrica ---------- */
/* As mesmas dúas medidas ca banco.js: canto contorno hai (lexibilidade)
   e cantos tons distintos (riqueza). A arte de referencia dá ~18% e ~406. */
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
