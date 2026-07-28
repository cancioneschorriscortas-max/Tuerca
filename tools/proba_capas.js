#!/usr/bin/env node
/* ============================================================
   ¿PÓDESE COMPOÑER UN ROBOT POR CAPAS?

   É a pregunta que decide se o xerador de robots é viable. O xogo pinta
   desde un atlas precocido, e un robot montado polo xogador é unha
   COMBINACIÓN: non se poden precociñar decenas de miles delas. A saída
   é renderizar cada PEZA por separado e apilalas en tempo real.

   Iso funciona só se a orde de pintado por peza abonda. E non ten por
   que: o algoritmo do pintor falla cando dúas pezas se cruzan en
   profundidade —un brazo que pasa por diante do torso, un fusil que
   apunta cara á cámara—, porque entón non hai ningunha orde correcta
   para as dúas enteiras.

   Así que se mide, non se opina: renderízase o robot ENTEIRO (co
   z-buffer facendo o traballo ben) e o mesmo robot POR CAPAS, e
   compáranse píxel a píxel.

   Úsase o rasterizador propio e non Blender porque a pregunta é de
   xeometría e oclusión, non de sombreado: mesma cámara, mesma
   proxección, e tarda milisegundos en vez de minutos.

   Uso: node tools/proba_capas.js
   ============================================================ */
const { render, rot, PAL } = require('./vox3d.js');
const { montar, ESQUELETO, CLASES, ESTADOS } = require('./modelos.js');

/* Como se agrupan as caixas en PEZAS intercambiables. É o mesmo reparto
   que terá o xerador, e case o mesmo que xa usa o xogo en
   04-progresion.js (alí as pernas van separadas). */
const GRUPO = (id) => {
  if(id === 'cabeza') return 'CABEZA';
  if(id === 'torso') return 'TORSO';
  /* A ARMA vai co BRAZO DEREITO, non aparte. Non é comodidade: unha man
     pecha arredor dunha empuñadura, e con caixas iso é interpenetración
     pura — o brazo e a arma ocupan o mesmo volume e non hai orde que os
     pinte ben. Medido: era o único conflito presente nas CINCO clases.
     É tamén o que fai Front Mission (as armas van montadas no brazo) e o
     que xa facía o mockup do xerador sen dicilo: a peza "BD-1 Fusil de
     servizo" trae as caixas do brazo E do fusil. */
  if(id === 'arma') return 'BRAZO_D';
  if(id === 'brazo_e' || id === 'antebrazo_e') return 'BRAZO_E';
  if(id === 'brazo_d' || id === 'antebrazo_d') return 'BRAZO_D';
  if(id === 'perna_e') return 'PERNA_E';
  if(id === 'perna_d') return 'PERNA_D';
  return 'OUTRO';
};

const mulM = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, v, k) => s + v*B[k][j], 0)));
const apl = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
                       M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
                       M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];

const W = 176, H = 176, ESCALA = 34, PITCH = 0.38;

/* Divide o robot montado en grupos, respectando a orde do esqueleto.

   `corte` di canto se afina o reparto:
     'peza'  — un grupo por peza, tal cal (o reparto obvio)
     'fondo' — ademais, unha peza que abarque moita profundidade pártese
               en capas por z. Non é trampa: é o que xa fai o mockup ao
               ter un slot de MOCHILA aparte do torso, e o que ten que
               facer o motor de composición.
     'caixa' — cada caixa a súa capa. Non é implementable (serían
               centos de sprites), pero marca o TEITO: canto de bo pode
               chegar a ser ordenar por capas. */
function porGrupos(cls, estado, fase, corte){
  const esq = ESQUELETO[cls];
  const rb = montar(cls, estado, fase);
  const g = {};
  rb.pezas.forEach((pz, i) => {
    const orixe = esq[i] || {};
    let nome = GRUPO(orixe.id);
    if(corte === 'caixa') nome += '#' + i;
    else if(corte === 'profundidade' || corte === 'prof8'){ /* reparto igual ca 'peza' */ }
    else if(corte === 'fondo'){
      /* z do centro da caixa no espazo do modelo: adiante / medio / atrás */
      const z = orixe.centro ? orixe.centro[2] : 0;
      nome += z < -0.28 ? '·atrás' : (z > 0.28 ? '·adiante' : '');
    }
    (g[nome] = g[nome] || []).push(pz);
  });
  return g;
}

/* Profundidade dun grupo: o centroide dos seus vértices no espazo da
   cámara. Máis z = máis preto. Píntase de lonxe a preto. */
function fondo(pezas, M){
  let n = 0, z = 0;
  for(const [verts] of pezas) for(const v of verts){ z += apl(M, v)[2]; n++; }
  return z/n;
}

/* Compón usando a PROFUNDIDADE DE CADA PÍXEL: cada peza renderízase soa
   e gárdase o seu z; ao xuntalas, cada píxel queda co máis próximo. É un
   z-buffer feito en tempo de composición, e é a única forma correcta
   cando as pezas se interpenetran. Custo: hai que gardar unha canle de
   profundidade por peza ademais da cor. */
/* bits = 0 -> profundidade exacta (float). bits = 8 -> a que se podería
   enviar de verdade, unha canle gris por peza. O rango é fixo porque a
   cámara tamén o é: o modelo cabe de sobra en +-2 unidades. */
function porProfundidade(grupos, yaw, bits){
  const Z0 = -2, Z1 = 2, niveis = bits ? (1 << bits) - 1 : 0;
  const cuant = (v) => niveis
    ? Math.round(Math.max(0, Math.min(1, (v - Z0)/(Z1 - Z0))) * niveis)
    : v;
  const col = new Float32Array(W*H*3), masc = new Uint8Array(W*H);
  const z = new Float64Array(W*H).fill(1e9);
  for(const pezas of Object.values(grupos)){
    const r = render({ pezas }, W, H, ESCALA, yaw, PITCH);
    for(let i = 0; i < W*H; i++){
      if(!r.masc[i]) continue;
      const zi = cuant(r.zbuf[i]);
      if(zi >= z[i]) continue;
      z[i] = zi; masc[i] = 1;
      col[i*3] = r.col[i*3]; col[i*3+1] = r.col[i*3+1]; col[i*3+2] = r.col[i*3+2];
    }
  }
  return { col, masc, W, H };
}

/* Compón por capas e devolve o mesmo formato que render(). */
function porCapas(grupos, yaw){
  const M = mulM(rot('x', PITCH), rot('y', yaw));
  const orde = Object.entries(grupos).sort((a, b) => fondo(a[1], M) - fondo(b[1], M));
  const col = new Float32Array(W*H*3), masc = new Uint8Array(W*H);
  for(const [, pezas] of orde){
    const r = render({ pezas }, W, H, ESCALA, yaw, PITCH);
    for(let i = 0; i < W*H; i++){
      if(!r.masc[i]) continue;
      masc[i] = 1;
      col[i*3] = r.col[i*3]; col[i*3+1] = r.col[i*3+1]; col[i*3+2] = r.col[i*3+2];
    }
  }
  return { col, masc, W, H };
}

function comparar(a, b){
  let silueta = 0, cor = 0, cheo = 0;
  for(let i = 0; i < W*H; i++){
    if(a.masc[i] || b.masc[i]) cheo++;
    if(a.masc[i] !== b.masc[i]){ silueta++; continue; }
    if(!a.masc[i]) continue;
    const d = Math.abs(a.col[i*3]-b.col[i*3]) + Math.abs(a.col[i*3+1]-b.col[i*3+1])
            + Math.abs(a.col[i*3+2]-b.col[i*3+2]);
    if(d > 12) cor++;
  }
  return { silueta, cor, cheo, pc: cheo ? (silueta+cor)*100/cheo : 0 };
}

module.exports = { porGrupos, porCapas, porProfundidade, comparar, GRUPO, W, H, ESCALA, PITCH };

/* O informe só se corre ao invocar o ficheiro; como módulo, isto
   exporta as funcións de composición, que é o que necesitará o xerador. */
if(require.main === module){
const estados = ['REPOUSO', 'ANDAR', 'DISPARAR'];
const CORTES = ['peza', 'profundidade', 'prof8'];
console.log('\n  Diferenza entre renderizar ENTEIRO e compoñer POR CAPAS');
console.log('  (% de píxeles que non coinciden; peor de 8 direccións x 4 fases x 3 estados)\n');
console.log('  clase          capas ordenadas   profund. exacta   profund. 8 bits');
console.log('  ' + '-'.repeat(70));
const peorDe = {};
for(const cls of CLASES){
  const fila = [];
  for(const corte of CORTES){
    let peor = 0, capas = 0;
    for(const est of estados) for(const fase of [0, 0.25, 0.5, 0.75]){
      const grupos = porGrupos(cls, est, fase, corte);
      capas = Math.max(capas, Object.keys(grupos).length);
      for(let d = 0; d < 8; d++){
        const yaw = d*2*Math.PI/8;
        const enteiro = render(montar(cls, est, fase), W, H, ESCALA, yaw, PITCH);
        const c = comparar(enteiro,
          corte === 'profundidade' ? porProfundidade(grupos, yaw, 0)
          : corte === 'prof8'      ? porProfundidade(grupos, yaw, 8)
          : porCapas(grupos, yaw));
        if(c.pc > peor) peor = c.pc;
      }
    }
    fila.push({ peor, capas });
    peorDe[corte] = Math.max(peorDe[corte] || 0, peor);
  }
  console.log('  ' + cls.padEnd(13) +
    fila.map(f => (f.peor.toFixed(1) + '%').padStart(7) + ('  (' + f.capas + ' capas)').padEnd(13)).join(''));
}
console.log('\n  peor caso global:');
for(const c of CORTES) console.log('    ' + c.padEnd(8) + peorDe[c].toFixed(1) + '%');
console.log('');

/* ============================================================
   E AGORA AO TAMAÑO REAL.

   Todo o de arriba mídese na resolución do render (176 px). O que
   importa é o sprite de 22 que vai ao xogo: alí a redución promedia e
   perdoa boa parte das discrepancias. Este é o número que decide.
   ============================================================ */
const { contornear, aRGBA, recortar, reducir } = require('./vox3d.js');
function aSprite(r, alt){
  let im = recortar(aRGBA(contornear(r, 2)));
  while(im.alto > alt*2) im = reducir(im, Math.max(1, im.ancho >> 1), im.alto >> 1);
  return reducir(im, Math.max(1, Math.round(im.ancho * alt / im.alto)), alt);
}
console.log('  AO TAMAÑO DO XOGO (22 px)\n');
console.log('  clase          capas ordenadas    profundidade 8 bits');
console.log('  ' + '-'.repeat(56));
for(const cls of CLASES){
  const conta = (modo) => {
    let peor = 0;
    for(const est of estados) for(const fase of [0, 0.25, 0.5, 0.75]){
      const grupos = porGrupos(cls, est, fase, 'peza');
      for(let d = 0; d < 8; d++){
        const yaw = d*2*Math.PI/8;
        const a = aSprite(render(montar(cls, est, fase), W, H, ESCALA, yaw, PITCH), 22);
        const b = aSprite(modo === 'capas' ? porCapas(grupos, yaw)
                                           : porProfundidade(grupos, yaw, 8), 22);
        let n = 0, tot = 0;
        for(let i = 0; i < Math.min(a.ancho*a.alto, b.ancho*b.alto); i++){
          const av = a.px[i*4+3] > 110, bv = b.px[i*4+3] > 110;
          if(av || bv) tot++;
          if(av !== bv){ n++; continue; }
          if(!av) continue;
          if(Math.abs(a.px[i*4]-b.px[i*4]) + Math.abs(a.px[i*4+1]-b.px[i*4+1])
           + Math.abs(a.px[i*4+2]-b.px[i*4+2]) > 24) n++;
        }
        const pc = tot ? n*100/tot : 0;
        if(pc > peor) peor = pc;
      }
    }
    return peor;
  };
  const cap = conta('capas'), pr = conta('prof');
  console.log('  ' + cls.padEnd(13) +
    (cap.toFixed(1)+'%').padStart(8) + '  (' + Math.round(cap/100*250) + ' px)' +
    (pr.toFixed(1)+'%').padStart(14) + '  (' + Math.round(pr/100*250) + ' px)');
}
console.log('');
}
