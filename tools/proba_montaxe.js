#!/usr/bin/env node
/* ============================================================
   ¿COMPOÑER PEZAS DÁ O MESMO QUE RENDERIZAR A CLASE?

   É a proba final do xerador, e faise contra o único que non discute:
   os renders de Blender que xa alimentan o xogo.

     capturas/_blender/<CLASE>_<cor>/   a clase montada, un só render
     capturas/_pezas/<slot>_<peza>_<capa>_<cor>/   cada peza soa

   As dúas saen do mesmo Blender, coa mesma cámara e o mesmo cel
   shading, así que calquera diferenza é da COMPOSICIÓN: as ancoras, a
   orde ou o asento. Non hai que descontar bisel nin sombreado.

   Un aviso sobre o que NON se pode esperar que dea cero. Unha peza
   renderízase soa, así que non recibe a oclusión ambiental das súas
   veciñas, e con tres chanzos de cel shading esa falta salta un paso
   enteiro de cor. Mediuse: son o 63% das diferenzas de cor. É inherente
   ao método —Diablo II tampouco ten oclusión entre pezas— e o render da
   clase non é o obxectivo, só o máis parecido a unha verdade que hai.
   Do mesmo xeito, cada peza trae o seu propio contorno negro e ao
   apilalas aparecen bordos por dentro da figura.

   O que si mide isto é o resto: pezas mal colocadas e capas na orde
   equivocada. Bandeiras para separalo:
     --bordo    reparte o erro en silueta, contorno e cor
     --sombra   separa a cor en sombreado e montaxe
     --dirs     proba remapeos do índice de dirección da táboa de orde
     --buscar   busca a man onde tería que ir cada peza
     --imaxe    escribe capturas/_montaxe.png para mirala
     --asento   aplica o asento ao chan (o render da clase non o leva,
                así que por defecto non se aplica)

   Uso: node tools/proba_montaxe.js [CLASE] [bandeiras]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ESQUELETO, CLASES } = require('./modelos.js');
const { ler } = require('./png.js');
const { catalogo, esqueletoDe, ancoras, ANCORA_DE, SLOTS, SLOT_CAPAS, capaDe } = require('./pezas.js');

const RES = 256, ORTHO = 2/0.42, PITCH = 0.38, ESC = RES/ORTHO;
const CAP = path.join(__dirname, '..', 'capturas');

/* A proxección de Blender, a mesma que usa o xerador. */
const mulM = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, v, k) => s + v*B[k][j], 0)));
const apl = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
                       M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
                       M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
function proxectar(v, yawN){
  const p = Math.PI/2 - PITCH, yawB = Math.PI - yawN;
  const w = [v[0], v[2], v[1]];
  const cp = Math.cos(p), sp = Math.sin(p), cy = Math.cos(yawB), sy = Math.sin(yawB);
  const R = mulM([[cy,-sy,0],[sy,cy,0],[0,0,1]], [[1,0,0],[0,cp,-sp],[0,sp,cp]]);
  const Rt = [[R[0][0],R[1][0],R[2][0]], [R[0][1],R[1][1],R[2][1]], [R[0][2],R[1][2],R[2][2]]];
  const c = apl(Rt, w);
  return [ c[0]*ESC, -c[1]*ESC ];
}

const ORDE = (() => {
  const f = path.join(__dirname, '..', 'i', 'js', '19c-orde.js');
  const m = fs.readFileSync(f, 'utf8').match(/const ORDE3D = (\{[\s\S]*\});/);
  return JSON.parse(m[1]);
})();

let ORDE_MAPA = d => d, ORDE_LADO = false;
const CLS = process.argv[2] || 'GRUNT';
const COR = 'azul';
const cat = catalogo();
const sel = {}; for(const s of SLOTS) sel[s] = CLS;
const esqM = esqueletoDe(sel, cat);
const anc = ancoras(CLS);
/* O render da clase non asenta nada: as pernas do GRUNT pisan onde
   pisan. O asento só entra cando se mesturan pezas de alturas distintas,
   así que aquí compárase sen el salvo que se pida. */
const asento = process.argv.includes('--asento') ? esqM.asento : 0;

/* onde está o sprite de cada capa */
function ficheiroPeza(slot, capa, cadro){
  return path.join(CAP, '_pezas', `${slot}_${CLS}_${capa}_${COR}`, cadro + '.png');
}
const SLOT_DE = {};
for(const [s, capas] of Object.entries(SLOT_CAPAS)) for(const c of capas) SLOT_DE[c] = s;

function compoñer(estado, d, fase){
  const cadro = `${estado}_${d}_${fase}`;
  const yaw = d*2*Math.PI/8;
  const px = Buffer.alloc(RES*RES*4);
  let orde = ORDE[estado + '/' + ORDE_MAPA(d)];
  if(ORDE_LADO) orde = orde.map(c => c.endsWith('_D') ? c.slice(0,-2)+'_E'
                                   : c.endsWith('_E') ? c.slice(0,-2)+'_D' : c);
  let capas = 0;
  for(const capa of orde){
    const slot = SLOT_DE[capa];
    const f = ficheiroPeza(slot, capa, cadro);
    if(!fs.existsSync(f)) continue;          /* esta clase non ten esa capa */
    const im = ler(f);
    /* A peza xa se renderiza na súa posición do mundo, non recentrada no
       punto de montaxe. O que hai que sumar non é a ancora senón o que
       CAMBIA de chasis a chasis: montar un brazo de GRUNT nun HEAVY move
       o brazo do ombro do GRUNT ao do HEAVY, e nada máis. Nunha montaxe
       da mesma clase a diferenza é cero. */
    const a = ANCORA_DE[slot] ? anc[ANCORA_DE[slot]] : [0, 0, 0];
    const q = proxectar([a[0], a[1] + asento, a[2]], yaw);
    const dx = Math.round(q[0]), dy = Math.round(q[1]);
    for(let y = 0; y < RES; y++) for(let x = 0; x < RES; x++){
      const i = (y*RES + x)*4;
      if(im.px[i+3] < 110) continue;
      const X = x + dx, Y = y + dy;
      if(X < 0 || Y < 0 || X >= RES || Y >= RES) continue;
      const o = (Y*RES + X)*4;
      px[o] = im.px[i]; px[o+1] = im.px[i+1]; px[o+2] = im.px[i+2]; px[o+3] = 255;
    }
    capas++;
  }
  return { ancho: RES, alto: RES, px, capas };
}

function comparar(a, b){
  let sil = 0, cor = 0, tot = 0;
  for(let i = 0; i < RES*RES; i++){
    const av = a.px[i*4+3] > 110, bv = b.px[i*4+3] > 110;
    if(av || bv) tot++;
    if(av !== bv){ sil++; continue; }
    if(!av) continue;
    if(Math.abs(a.px[i*4]-b.px[i*4]) + Math.abs(a.px[i*4+1]-b.px[i*4+1])
     + Math.abs(a.px[i*4+2]-b.px[i*4+2]) > 24) cor++;
  }
  return { sil, cor, tot, pc: tot ? (sil+cor)*100/tot : 0 };
}

console.log(`\n  ${CLS} · compoñer pezas fronte a renderizar a clase (as dúas de Blender)\n`);
console.log('  estado    dir   total    silueta   cor');
console.log('  ' + '-'.repeat(48));
let peor = 0, suma = 0, n = 0;
for(const [estado, fases] of [['REPOUSO', 1], ['ANDAR', 4], ['DISPARAR', 4]]){
  for(const d of [0, 1, 2, 3, 4, 5, 6, 7]){
    const fase = fases > 1 ? 1 : 0;
    const ref = path.join(CAP, '_blender', `${CLS}_${COR}`, `${estado}_${d}_${fase}.png`);
    if(!fs.existsSync(ref)) continue;
    const c = comparar(ler(ref), compoñer(estado, d, fase));
    suma += c.pc; n++; if(c.pc > peor) peor = c.pc;
    if(d === 0 || c.pc > 30)
      console.log('  ' + estado.padEnd(10) + d + '    ' + (c.pc.toFixed(1)+'%').padStart(6) +
        '   ' + String(c.sil).padStart(6) + '   ' + String(c.cor).padStart(5));
  }
}
console.log(`\n  media ${(suma/n).toFixed(2)}%   peor ${peor.toFixed(1)}%   sobre ${n} cadros\n`);

/* --imaxe escribe a comparación: composición, referencia e diferenza.
   Cando os números non din de que van, isto si. */
if(process.argv.includes('--imaxe')){
  const { escribir } = require('./png.js');
  const Z = 2, dirs = [0, 2, 5];
  const W = RES*Z*3 + 40, H = RES*Z*dirs.length + 40;
  const px = Buffer.alloc(W*H*4);
  for(let i = 0; i < W*H; i++){ px[i*4]=30; px[i*4+1]=34; px[i*4+2]=26; px[i*4+3]=255; }
  const pon = (im, ox, oy, tinte) => {
    for(let y = 0; y < RES*Z; y++) for(let x = 0; x < RES*Z; x++){
      const s = ((y/Z|0)*RES + (x/Z|0))*4;
      if(im.px[s+3] < 110) continue;
      const d = ((oy+y)*W + ox+x)*4;
      if(tinte){ px[d]=tinte[0]; px[d+1]=tinte[1]; px[d+2]=tinte[2]; }
      else { px[d]=im.px[s]; px[d+1]=im.px[s+1]; px[d+2]=im.px[s+2]; }
    }
  };
  dirs.forEach((d, r) => {
    const ref = ler(path.join(CAP, '_blender', `${CLS}_${COR}`, `REPOUSO_${d}_0.png`));
    const com = compoñer('REPOUSO', d, 0);
    pon(ref, 10, 10 + r*RES*Z);
    pon(com, 20 + RES*Z, 10 + r*RES*Z);
    /* diferenza: vermello o que sobra, azul o que falta */
    const dif = { ancho: RES, alto: RES, px: Buffer.alloc(RES*RES*4) };
    for(let i = 0; i < RES*RES; i++){
      const a = ref.px[i*4+3] > 110, b = com.px[i*4+3] > 110;
      if(a === b) continue;
      dif.px[i*4] = b ? 255 : 60; dif.px[i*4+1] = 40;
      dif.px[i*4+2] = b ? 60 : 255; dif.px[i*4+3] = 255;
    }
    pon(dif, 30 + RES*Z*2, 10 + r*RES*Z);
  });
  escribir(path.join(CAP, '_montaxe.png'), { ancho: W, alto: H, px });
  console.log('  imaxe: capturas/_montaxe.png  (clase · composición · diferenza)');
}

/* --dirs proba todos os remapeos do índice de dirección da táboa de orde.
   A táboa mediuse con vox3d, que rota o MODELO; Blender move a CÁMARA, e
   as dúas secuencias non teñen por que coincidir. */
if(process.argv.includes('--dirs')){
  console.log('  remapeo do índice da táboa de orde:\n');
  for(const esp of [false, true]) for(let off = 0; off < 8; off++){
    /* Un espello non só reordena as direccións: intercambia esquerda e
       dereita, e coas capas hai que facer o mesmo. */
    ORDE_MAPA = d => ((esp ? -d : d) + off + 8) % 8;
      ORDE_LADO = esp;
    let s = 0, k = 0;
    for(const [estado, fases] of [['REPOUSO',1],['ANDAR',4],['DISPARAR',4]])
      for(let d = 0; d < 8; d++){
        const fase = fases > 1 ? 1 : 0;
        const r = path.join(CAP, '_blender', `${CLS}_${COR}`, `${estado}_${d}_${fase}.png`);
        if(!fs.existsSync(r)) continue;
        s += comparar(ler(r), compoñer(estado, d, fase)).pc; k++;
      }
    console.log(`    ${esp ? 'espello' : 'directo'} +${off}   ${(s/k).toFixed(2)}%`);
  }
}

/* --bordo separa o erro en tres: silueta, contorno e cor real.
   Cada peza renderízase soa e leva o seu propio contorno negro; ao
   apilalas aparecen bordos por dentro da figura que o render da clase
   non ten. É unha consecuencia do estilo, non un fallo de montaxe, e
   convén sabelo por separado. */
if(process.argv.includes('--bordo')){
  const escuro = (p, i) => p[i*4] + p[i*4+1] + p[i*4+2] < 200;
  let S = 0, B = 0, C = 0, T = 0;
  for(const [estado, fases] of [['REPOUSO',1],['ANDAR',4],['DISPARAR',4]])
    for(let d = 0; d < 8; d++){
      const fase = fases > 1 ? 1 : 0;
      const f = path.join(CAP, '_blender', `${CLS}_${COR}`, `${estado}_${d}_${fase}.png`);
      if(!fs.existsSync(f)) continue;
      const a = ler(f), b = compoñer(estado, d, fase);
      for(let i = 0; i < RES*RES; i++){
        const av = a.px[i*4+3] > 110, bv = b.px[i*4+3] > 110;
        if(av || bv) T++;
        if(av !== bv){ S++; continue; }
        if(!av) continue;
        const dif = Math.abs(a.px[i*4]-b.px[i*4]) + Math.abs(a.px[i*4+1]-b.px[i*4+1])
                  + Math.abs(a.px[i*4+2]-b.px[i*4+2]);
        if(dif <= 24) continue;
        if(escuro(a.px, i) || escuro(b.px, i)) B++; else C++;
      }
    }
  const pc = v => (v*100/T).toFixed(2) + '%';
  console.log(`  silueta ${pc(S)}   contorno ${pc(B)}   cor ${pc(C)}   (${T} px)\n`);
}

/* --buscar mide, peza a peza, o desprazamento que a mete dentro da
   silueta da clase. Non depende da orde nin da oclusión: unha peza ben
   colocada non pinta fóra do robot. Compárase co que predí a ancora. */
if(process.argv.includes('--buscar')){
  const R = 60;
  for(const d of [0, 2, 5]){
    const ref = ler(path.join(CAP, '_blender', `${CLS}_${COR}`, `REPOUSO_${d}_0.png`));
    const dentro = i => ref.px[i*4+3] > 110;
    console.log(`\n  dirección ${d}`);
    console.log('    capa        medido      ancora     desvío');
    for(const capa of ORDE['REPOUSO/' + d]){
      const slot = SLOT_DE[capa];
      const f = ficheiroPeza(slot, capa, `REPOUSO_${d}_0`);
      if(!fs.existsSync(f)) continue;
      const im = ler(f);
      const pts = [];
      for(let i = 0; i < RES*RES; i++) if(im.px[i*4+3] > 110) pts.push([i % RES, (i/RES)|0]);
      let mellor = null;
      for(let dy = -R; dy <= R; dy++) for(let dx = -R; dx <= R; dx++){
        let fóra = 0;
        for(const [x, y] of pts){
          const X = x+dx, Y = y+dy;
          if(X < 0 || Y < 0 || X >= RES || Y >= RES || !dentro(Y*RES+X)) fóra++;
        }
        if(!mellor || fóra < mellor.f) mellor = { f: fóra, dx, dy };
      }
      const n = ANCORA_DE[slot];
      const a = n ? anc[n] : [0, 0, 0];
      const q = proxectar(a, d*2*Math.PI/8).map(Math.round);
      console.log('    ' + capa.padEnd(10) +
        `(${mellor.dx},${mellor.dy})`.padStart(10) +
        `(${q[0]},${q[1]})`.padStart(11) +
        `(${mellor.dx-q[0]},${mellor.dy-q[1]})`.padStart(11) +
        `   fóra ${mellor.f}`);
    }
  }
}

/* --sombra distingue as dúas causas posibles dunha diferenza de cor.
   Se é un problema de MONTAXE, o píxel composto vén doutra peza e ten
   outro ton. Se é de SOMBREADO —unha peza soa non recibe a oclusión
   ambiental das veciñas— o ton é o mesmo e só cambia o brillo, e con
   tres chanzos de cel shading iso salta un paso enteiro. */
if(process.argv.includes('--sombra')){
  const ton = (p, i) => {
    const r = p[i*4], g = p[i*4+1], b = p[i*4+2], m = Math.max(r,g,b) || 1;
    return [r/m, g/m, b/m];
  };
  let mesmoTon = 0, outroTon = 0;
  for(const [estado, fases] of [['REPOUSO',1],['ANDAR',4],['DISPARAR',4]])
    for(let d = 0; d < 8; d++){
      const fase = fases > 1 ? 1 : 0;
      const f = path.join(CAP, '_blender', `${CLS}_${COR}`, `${estado}_${d}_${fase}.png`);
      if(!fs.existsSync(f)) continue;
      const a = ler(f), b = compoñer(estado, d, fase);
      for(let i = 0; i < RES*RES; i++){
        if(!(a.px[i*4+3] > 110 && b.px[i*4+3] > 110)) continue;
        if(Math.abs(a.px[i*4]-b.px[i*4]) + Math.abs(a.px[i*4+1]-b.px[i*4+1])
         + Math.abs(a.px[i*4+2]-b.px[i*4+2]) <= 24) continue;
        const ta = ton(a.px, i), tb = ton(b.px, i);
        const dt = Math.abs(ta[0]-tb[0]) + Math.abs(ta[1]-tb[1]) + Math.abs(ta[2]-tb[2]);
        if(dt < 0.12) mesmoTon++; else outroTon++;
      }
    }
  const t = mesmoTon + outroTon;
  console.log(`  das ${t} diferenzas de cor:`);
  console.log(`    mesmo ton, outro brillo  ${mesmoTon}  (${(mesmoTon*100/t).toFixed(0)}%)  → sombreado`);
  console.log(`    outro ton               ${outroTon}  (${(outroTon*100/t).toFixed(0)}%)  → montaxe\n`);
}
