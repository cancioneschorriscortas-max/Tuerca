#!/usr/bin/env node
/* ============================================================
   ¿AGUANTA A COMPOSICIÓN CO RENDER DE VERDADE?

   proba_capas.js xa respondeu á pregunta xeométrica co rasterizador
   propio: apilar capas ordenadas non vale (ata 15% de píxeles mal,
   porque as caixas se interpenetran), e compoñer pola profundidade de
   cada píxel dá exacto.

   Falta comprobalo onde importa: en Blender, co cel shading, o bisel e
   a oclusión ambiental postos. Aquí hai dúas fontes novas de erro que o
   rasterizador non tiña:

     - o BISEL redondea as arestas, e faino sobre cada peza POR SEPARADO.
       Unha peza soa ten bisel onde antes había unión con outra.
     - a OCLUSIÓN AMBIENTAL escurece os recunchos, e un recuncho entre
       dúas pezas non existe se se renderizan por separado.

   Esas dúas son reais e non se poden eliminar: son o prezo de compoñer.
   O que hai que saber é canto custan.

   Uso: node tools/proba_capas_blender.js [CLASE]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { montar, ESQUELETO } = require('./modelos.js');
const { PAL, reducir } = require('./vox3d.js');
const { ler } = require('./png.js');
const { GRUPO } = require('./proba_capas.js');

const CARAS = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
const CLASE = process.argv[2] || 'HEAVY';
const RES = 256, TOON = 3, ALT = 22;
const tmp = path.join(__dirname, '..', 'capturas', '_capasbl');
fs.mkdirSync(tmp, { recursive: true });

function blender(){
  const base = 'C:/Program Files/Blender Foundation';
  for(const d of fs.readdirSync(base).sort().reverse()){
    const p = path.join(base, d, 'blender.exe');
    if(fs.existsSync(p)) return p;
  }
  throw new Error('non atopo blender.exe');
}

/* Lanza Blender cun lote de cadros. `profundidade` cambia todos os
   materiais polo que codifica a distancia á cámara. */
function render(cadros, profundidade, subdir, senSombras){
  const dir = path.join(tmp, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const entrada = path.join(dir, 'traballo.json');
  fs.writeFileSync(entrada, JSON.stringify({
    caras: CARAS, cadros, luminosas: [PAL.ollo], toon: TOON,
    profundidade: profundidade ? 1 : 0, zrango: [8.0, 12.0],
    sensombras: senSombras ? 1 : 0,
  }), 'utf8');
  execFileSync(blender(), ['--background', '--python', path.join(__dirname, 'blender_banco.py'),
                           '--', entrada, dir, String(RES)], { stdio: 'pipe' });
  const fóra = {};
  for(const c of cadros) fóra[c.nome] = ler(path.join(dir, c.nome + '.png'));
  return fóra;
}

/* ---------- cadros que fan falla ---------- */
const ESTADO = 'DISPARAR', FASE = 0.25, DIRS = [0, 2, 5];
const esq = ESQUELETO[CLASE];
const rb = montar(CLASE, ESTADO, FASE, 'azul');
const grupos = {};
rb.pezas.forEach(([verts, cor], i) => {
  const g = GRUPO((esq[i] || {}).id);
  (grupos[g] = grupos[g] || []).push({ verts, cor });
});
const nomesGrupo = Object.keys(grupos);

const enteiros = [], partes = [];
for(const d of DIRS){
  const yaw = d*2*Math.PI/8;
  enteiros.push({ nome: 'todo_' + d, yaw, pezas: rb.pezas.map(([verts, cor]) => ({ verts, cor })) });
  for(const g of nomesGrupo) partes.push({ nome: g + '_' + d, yaw, pezas: grupos[g] });
}

console.log(`\n  ${CLASE} · ${ESTADO} · ${nomesGrupo.length} pezas · ${DIRS.length} direccións`);
console.log('  renderizando en Blender: enteiro, pezas en cor, pezas en profundidade...');
const imEnteiro = render(enteiros, false, 'todo', false);
const imCor = render(partes, false, 'cor', false);
const imProf = render(partes, true, 'prof', false);
/* E o mesmo SEN sombras nin oclusión, que é o único xeito de que
   compoñer poida dar exacto. */
const imEnteiroS = render(enteiros, false, 'todoS', true);
const imCorS = render(partes, false, 'corS', true);

/* ---------- composición ---------- */
function compoñer(d, cor){
  const W = RES, H = RES;
  const px = Buffer.alloc(W*H*4);
  const z = new Float32Array(W*H).fill(-1);   /* 1 = preto; gaña o maior */
  for(const g of nomesGrupo){
    const c = (cor || imCor)[g + '_' + d], p = imProf[g + '_' + d];
    for(let i = 0; i < W*H; i++){
      if(c.px[i*4+3] < 110) continue;
      const zi = p.px[i*4] / 255;
      if(zi <= z[i]) continue;
      z[i] = zi;
      for(let k = 0; k < 4; k++) px[i*4+k] = c.px[i*4+k];
    }
  }
  return { ancho: W, alto: H, px };
}

function aAlt(im, alt){
  /* recorte común e redución, sen contorno: aquí compárase o render, non
     o sprite acabado. */
  let x0 = im.ancho, y0 = im.alto, x1 = -1, y1 = -1;
  for(let y = 0; y < im.alto; y++) for(let x = 0; x < im.ancho; x++)
    if(im.px[(y*im.ancho+x)*4+3] > 110){
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
  return { x0, y0, x1, y1 };
}

function comparar(a, b){
  /* Separado a propósito: unha diferenza de SILUETA é o bisel, que
     redondea cada peza por separado. Unha diferenza de COR dentro da
     silueta é a composición escollendo mal, ou a oclusión ambiental. */
  let sil = 0, cor = 0, tot = 0;
  for(let i = 0; i < a.ancho*a.alto; i++){
    const av = a.px[i*4+3] > 110, bv = b.px[i*4+3] > 110;
    if(av || bv) tot++;
    if(av !== bv){ sil++; continue; }
    if(!av) continue;
    const d = Math.abs(a.px[i*4]-b.px[i*4]) + Math.abs(a.px[i*4+1]-b.px[i*4+1])
            + Math.abs(a.px[i*4+2]-b.px[i*4+2]);
    if(d > 24) cor++;
  }
  const dif = sil + cor;
  return { pc: tot ? dif*100/tot : 0, dif, sil, cor, tot };
}

console.log('\n  dir    total     por SILUETA (bisel)      por COR (oclusión?)');
console.log('  ' + '-'.repeat(62));
let peor = 0;
for(const d of DIRS){
  const a = imEnteiro['todo_' + d], b = compoñer(d);
  const c = comparar(a, b);
  if(c.pc > peor) peor = c.pc;
  console.log('  ' + String(d).padEnd(6) + (c.pc.toFixed(1)+'%').padStart(7) +
    ((c.sil*100/c.tot).toFixed(1)+'%').padStart(14) + ('  (' + c.sil + ' px)').padEnd(13) +
    ((c.cor*100/c.tot).toFixed(1)+'%').padStart(11) + '  (' + c.cor + ' px)');
}
console.log('\n  peor: ' + peor.toFixed(1) + '%');
console.log('  (co rasterizador, sen bisel nin oclusión, era 1.4% neste modelo)\n');

/* ---------- e agora sen sombras ---------- */
console.log('  SEN SOMBRAS NIN OCLUSIÓN\n');
console.log('  dir    custo de apagalas    erro ao compoñer');
console.log('  ' + '-'.repeat(52));
let peorS = 0;
for(const d of DIRS){
  const conSombra = imEnteiro['todo_' + d];
  const senSombra = imEnteiroS['todo_' + d];
  const composto = compoñer(d, imCorS);
  const custo = comparar(conSombra, senSombra);
  const erro = comparar(senSombra, composto);
  if(erro.pc > peorS) peorS = erro.pc;
  console.log('  ' + String(d).padEnd(6) + (custo.pc.toFixed(1)+'%').padStart(12) +
    ('      ' + erro.pc.toFixed(1) + '%').padStart(22) +
    '   (' + erro.sil + ' silueta, ' + erro.cor + ' cor)');
}
console.log('\n  compoñer sen sombras erra como moito ' + peorS.toFixed(1) + '%\n');

module.exports = { compoñer, imEnteiro, imCor, imProf, DIRS, RES };
