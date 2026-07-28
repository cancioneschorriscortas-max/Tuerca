#!/usr/bin/env node
/* ============================================================
   ATLAS POR PEZA — o que fai posible o xerador de robots.

   O banco normal (19b-banco.js) ten un sprite por CLASE. Un robot que
   monta o xogador é unha combinación, e as combinacións non se poden
   precociñar. Isto precociña as PEZAS, e o xogo apílaas.

   Tres cousas teñen que cumprirse para que apilar funcione, e as tres
   están medidas antes de escribir isto:

     1. Que exista unha orde de pintado válida. Non a había ata separar
        os accesorios do torso e as hombreiras do corpo (regra L7).
     2. Que a orde se poida precociñar. Vale unha táboa por dirección:
        0.71% de erro fronte a 0.22% calculándoa por montaxe.
     3. Que unha peza se vexa igual vaia onde vaia. Fixo falla que a
        pose do brazo viñese do brazo e non do chasis.

   ESCALA COMÚN: todas as pezas se renderizan no MESMO encadre, medido
   nunha primeira pasada. Se cada unha se recortase polo seu contorno,
   cada peza viría a distinta escala e apilalas non tería sentido. As
   marxes transparentes recórtanse despois e gárdase o desprazamento,
   que é o que mantén o atlas pequeno sen perder a posición.

   Uso:
     node tools/xerar-pezas-xogo.js
     node tools/xerar-pezas-xogo.js --reusar
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ESQUELETO, OBXECTIVO_MAN } = require('./modelos.js');
const { PAL, rot } = require('./vox3d.js');
const { escribir } = require('./png.js');
const { xerar } = require('./sprites_blender.js');
const { catalogo, SLOTS, SLOT_CAPAS, ANCORA_DE, ancoras, capaDe } = require('./pezas.js');

const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const REUSAR = argv.includes('--reusar');
const RES = parseInt(op('res', '256'), 10);
const TOON = 3, DIRS = 8, PITCH = 0.38;
/* 10 píxeles por unidade de mundo: é a escala á que un robot de 2.2
   unidades sae de 22 píxeles, que é o que xa usa o xogo. */
const PX_UNIDADE = 10;
const ORTHO = 2.0/0.42;

const EQUIPOS = [['0','azul'], ['1','vermello'], ['2','metal']];
const ESTADOS = [['ANDAR', 4], ['REPOUSO', 1], ['DISPARAR', 4]];

/* ---------- que cadros ---------- */
const cadros = [];
const indice = {};
for(const [est, nf] of ESTADOS){
  indice[est] = { base: cadros.length, fases: nf };
  for(let d = 0; d < DIRS; d++) for(let f = 0; f < nf; f++)
    cadros.push({ nome: `${est}_${d}_${f}`, estado: est, fase: f/nf, yaw: d*2*Math.PI/DIRS });
}

const cat = catalogo();

/* ---------- que hai que renderizar ----------
   Unha entrada por (slot, peza, capa, cor). Unha peza que non teña
   ningunha caixa de cor de equipo só precisa UNHA variante: as cabezas
   son metal e visor, e renderizalas tres veces sería tirar 10 minutos. */
const traballos = [];
for(const slot of SLOTS){
  for(const peza of cat[slot] || []){
    if(!peza.caixas.length) continue;
    /* Unha entrada por CAPA, non por peza: un chasis dá torso, peito e
       mochila, e a táboa de orde ordena capas. Se fosen no mesmo sprite
       non se poderían intercalar co brazo, que é o que xa medimos que
       facía falla. */
    for(const capa of [...new Set(peza.caixas.map(capaDe))]){
      const caixas = peza.caixas.filter(c => capaDe(c) === capa);
      const temEquipo = caixas.some(c => c.cor === 'azul');
      for(const cor of (temEquipo ? EQUIPOS : [EQUIPOS[0]])){
        traballos.push({ slot, peza, capa, caixas, eq: cor[0], cor: cor[1], temEquipo });
      }
    }
  }
}

/* ---------- render ----------
   Cada peza instálase como clase temporal para poder reutilizar todo o
   pipeline (cel shading, paleta, contorno). A pose do brazo vén do
   brazo, así que a peza se ve igual monte onde monte. */
function renderizar(t, opc){
  const CL = '_PZ';
  /* Só as caixas desta capa. O resto da peza non se renderiza aquí: xa
     ten a súa propia entrada. */
  ESQUELETO[CL] = t.caixas;
  OBXECTIVO_MAN[CL] = OBXECTIVO_MAN[t.peza.de] || {};
  const r = xerar(CL, cadros, Object.assign({
    res: RES, toon: TOON, cor: t.cor, reusar: REUSAR,
    tmp: path.join(__dirname, '..', 'capturas', '_pezas', t.slot + '_' + t.peza.id + '_' + t.capa + '_' + t.cor),
  }, opc));
  delete ESQUELETO[CL]; delete OBXECTIVO_MAN[CL];
  return r;
}

console.log(`\n  ${traballos.length} pezas × ${cadros.length} cadros`);
console.log('  pasada 1 de 2: renderizar e medir o encadre común...');
let union = null;
traballos.forEach((t, i) => {
  process.stdout.write(`\r    ${i+1}/${traballos.length}  ${t.slot} ${t.peza.id} ${t.capa} ${t.cor}        `);
  const r = renderizar(t, { alt: 40, groso: 3 });
  const c = r.caixa;
  union = union ? { x0: Math.min(union.x0,c.x0), y0: Math.min(union.y0,c.y0),
                    x1: Math.max(union.x1,c.x1), y1: Math.max(union.y1,c.y1) } : { ...c };
});
/* marxe para o contorno */
const GROSO = 3;
union = { x0: Math.max(0, union.x0-GROSO), y0: Math.max(0, union.y0-GROSO),
          x1: Math.min(RES-1, union.x1+GROSO), y1: Math.min(RES-1, union.y1+GROSO) };
const altUnion = (union.y1 - union.y0 + 1);
const unidades = altUnion / (RES/ORTHO);
const ALT = Math.max(8, Math.round(unidades * PX_UNIDADE));
console.log(`\n  encadre común ${union.x1-union.x0+1}×${altUnion} px de render`);
console.log(`  = ${unidades.toFixed(2)} unidades → ${ALT} px de sprite\n`);

/* Onde cae a orixe do mundo dentro dese encadre, xa en píxeles de sprite.
   TRAMPA: no rasterizador propio a orixe vai en H*0.74 —está posta así
   para deixar sitio ás pernas— pero en Blender a cámara ORBITA a orixe e
   míraa, así que proxecta no centro exacto da imaxe. Usar aquí o 0.74 do
   rasterizador desprazaría cada peza 61 píxeles de render. */
const escalaSprite = ALT / altUnion;
const orixeX = (RES/2 - union.x0) * escalaSprite;
const orixeY = (RES/2 - union.y0) * escalaSprite;

console.log('  pasada 2 de 2: reencadrar á escala común...');
const banco = {};
traballos.forEach((t, i) => {
  process.stdout.write(`\r    ${i+1}/${traballos.length}  ${t.slot} ${t.peza.id} ${t.capa} ${t.cor}        `);
  const r = renderizar(t, { alt: ALT, groso: GROSO, caixaFixa: union, reusar: true });
  banco[t.slot + '|' + t.peza.id + '|' + t.capa + '|' + t.eq] =
    { cadros: r, capa: t.capa, slot: t.slot, peza: t.peza.id, eq: t.eq, temEquipo: t.temEquipo };
});
console.log('');

/* ---------- empaquetado ----------
   Cada capa vai nun atlas dunha fila. Recórtanse as marxes transparentes
   COMÚNS a todos os seus cadros e gárdase o desprazamento: así o atlas
   non leva aire e a posición non se perde. Recortar cadro a cadro faría
   bailar a peza entre fotogramas. */
function empaquetar(cadrosMapa){
  const nomes = cadros.map(c => c.nome);
  const ancho0 = cadrosMapa[nomes[0]].ancho, alto0 = cadrosMapa[nomes[0]].alto;
  let x0 = ancho0, y0 = alto0, x1 = -1, y1 = -1;
  for(const n of nomes){
    const s = cadrosMapa[n];
    for(let y = 0; y < s.alto; y++) for(let x = 0; x < s.ancho; x++)
      if(s.px[(y*s.ancho + x)*4 + 3] > 110){
        if(x < x0) x0 = x; if(x > x1) x1 = x;
        if(y < y0) y0 = y; if(y > y1) y1 = y;
      }
  }
  if(x1 < 0) return null;                       /* capa baleira */
  const w = x1-x0+1, h = y1-y0+1;
  const W = w*nomes.length;
  const px = Buffer.alloc(W*h*4);
  nomes.forEach((n, i) => {
    const s = cadrosMapa[n];
    for(let y = 0; y < h; y++)
      s.px.copy(px, (y*W + i*w)*4, ((y+y0)*s.ancho + x0)*4, ((y+y0)*s.ancho + x0 + w)*4);
  });
  return { ancho: W, alto: h, px, w, h, ox: x0, oy: y0 };
}

const tmpDir = path.join(__dirname, '..', 'capturas', '_pezasatlas');
fs.mkdirSync(tmpDir, { recursive: true });
const saidaBanco = {};
let bytes = 0;
for(const [clave, b] of Object.entries(banco)){
  const a = empaquetar(b.cadros);
  if(!a) continue;
  const f = path.join(tmpDir, clave.replace(/\|/g, '_') + '.png');
  escribir(f, a);
  const dat = fs.readFileSync(f); bytes += dat.length; fs.unlinkSync(f);
  saidaBanco[clave] = { d: 'data:image/png;base64,' + dat.toString('base64'),
                        w: a.w, h: a.h, ox: a.ox, oy: a.oy };
}

/* ---------- ancoras en píxeles de pantalla ----------
   Cada slot móntase nun punto do chasis. Nunha proxección ortográfica
   ese punto 3D é un desprazamento 2D fixo por dirección, así que se
   precociña: o xogo só suma. */
const mulM = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, v, k) => s + v*B[k][j], 0)));
const apl = (M, v) => [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
                       M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
                       M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
const escalaMundo = (RES/ORTHO) * escalaSprite;   /* px de sprite por unidade */
const ancorasPx = {};
for(const p of cat.CHASIS){
  if(!p.caixas.length) continue;
  const anc = ancoras(p.de);
  ancorasPx[p.id] = {};
  for(const [slot, nome] of Object.entries(ANCORA_DE)){
    ancorasPx[p.id][slot] = [];
    for(let d = 0; d < DIRS; d++){
      const M = mulM(rot('x', PITCH), rot('y', d*2*Math.PI/DIRS));
      const q = apl(M, anc[nome]);
      ancorasPx[p.id][slot].push([ +(q[0]*escalaMundo).toFixed(2),
                                   -(q[1]*escalaMundo).toFixed(2) ]);
    }
  }
}

/* ---------- datos para ASENTAR NO CHAN ----------
   A altura total dunha montaxe é variable: pernas longas, pernas curtas,
   un chasis máis alto. Sen asentar, cada robot pisaría a distinta altura.
   O montador do xogo precisa tres cousas para calculalo el mesmo, e son
   catro números por peza, non máis atlas:
     - onde ten o chasis cada ancora, en unidades de mundo
     - onde pisa a clase de orixe do chasis (a referencia)
     - por onde remata cada peza por abaixo, nas súas coordenadas */
const ancorasMundo = {}, chanDe = {}, baixoDe = {};
for(const p of cat.CHASIS){
  if(!p.caixas.length) continue;
  const anc = ancoras(p.de);
  ancorasMundo[p.id] = {};
  for(const [slot, nome] of Object.entries(ANCORA_DE)) ancorasMundo[p.id][slot] = anc[nome];
  chanDe[p.id] = Math.min(...ESQUELETO[p.de].map(c => c.centro[1] - c.tam[1]/2));
}
for(const slot of SLOTS) for(const p of cat[slot] || []){
  if(!p.caixas.length) continue;
  baixoDe[slot + '|' + p.id] = +Math.min(...p.caixas.map(c => c.centro[1] - c.tam[1]/2)).toFixed(4);
}

const saida = path.join(__dirname, '..', 'i', 'js', '19d-pezas.js');
fs.writeFileSync(saida, `/* ============================================================
   ATLAS DE PEZAS — XERADO, NON EDITAR A MAN.

   Sae de: node tools/xerar-pezas-xogo.js
   Un sprite por (slot, peza, capa, cor de equipo). O xogo apílaos coa
   orde de 19c-orde.js e desprázaos coas ancoras de aquí.

   ${Object.keys(saidaBanco).length} capas · ${cadros.length} cadros cada unha.
   Escala: ${escalaMundo.toFixed(2)} píxeles por unidade de mundo.
   ============================================================ */
const PEZAS3D = ${JSON.stringify({
  dirs: DIRS, indice, orixe: [ +orixeX.toFixed(2), +orixeY.toFixed(2) ],
  escala: +escalaMundo.toFixed(3), ancoras: ancorasPx,
  ancorasMundo, chan: chanDe, baixo: baixoDe, banco: saidaBanco,
})};
`, 'utf8');

console.log(`  ${Object.keys(saidaBanco).length} capas empaquetadas`);
console.log(`  ${saida}  (${(fs.statSync(saida).size/1024).toFixed(0)} KB)\n`);
