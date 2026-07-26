#!/usr/bin/env node
/* ============================================================
   XERAR O BANCO DE SPRITES PARA O XOGO.

   Escribe i/js/19b-banco.js, un módulo con os atlas en base64. Vai
   embebido a propósito: así funciona igual servido, aberto con file://
   e dentro do build dun só ficheiro, sen cargador nin CORS.

   Que se xera: 3 clases × 3 cores de equipo × (ANDAR 8×4, REPOUSO 8×1,
   DISPARAR 8×4). Non se xera todo o que sabe facer modelos.js porque o
   xogo aínda non ten estados de curar nin de impacto enganchados; cando
   os teña, é engadilos a ESTADOS_XOGO e volver correr isto.

   Uso:
     node tools/xerar-sprites-xogo.js
     node tools/xerar-sprites-xogo.js --reusar --alt 22
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { CLASES } = require('./modelos.js');
const { escribir } = require('./png.js');
const { xerar } = require('./sprites_blender.js');

const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const ALT = parseInt(op('alt', '22'), 10);
const RES = parseInt(op('res', '256'), 10);
const REUSAR = argv.includes('--reusar');
/* CHANZOS de luz do sombreado (cel shading). O sprite final ten 22
   píxeles e chégase a el reducindo un render de 256: cun sombreado suave,
   ese reducido promedia un degradado, inventa tons intermedios e a
   cuantización posterior deixa moteado. Con chanzos as zonas xa nacen
   planas e o promedio dunha zona plana é a propia cor.
   --toon 0 volve ao sombreado suave para comparar. */
const TOON = parseInt(op('toon', '3'), 10);
const DIRS = 8;

/* Cor de equipo -> entrada da paleta de vox3d. O 'metal' do neutral tinxe
   tamén a cabeza, pero un robot sen bando enteiro de gris lese ben. */
const EQUIPOS = [['0', 'azul'], ['1', 'vermello'], ['2', 'metal']];
/* estado -> cantas fases ten. REPOUSO só precisa unha. */
const ESTADOS_XOGO = [['ANDAR', 4], ['REPOUSO', 1], ['DISPARAR', 4]];

const cadros = [];
const indice = {};        /* "ANDAR" -> {base, fases} dentro do atlas */
for(const [est, nf] of ESTADOS_XOGO){
  indice[est] = { base: cadros.length, fases: nf };
  for(let d = 0; d < DIRS; d++)
    for(let f = 0; f < nf; f++)
      cadros.push({ nome: `${est}_${d}_${f}`, estado: est, fase: f/nf, yaw: d*2*Math.PI/DIRS });
}

/* Unha soa fila: o atlas é longo e baixo, pero así o índice é
   `i*cw` e non hai que dividir por columnas ao debuxar. */
function atlas(mapa){
  const cel = Object.values(mapa);
  const cw = Math.max(...cel.map(s => s.ancho)), ch = Math.max(...cel.map(s => s.alto));
  const W = cadros.length*cw;
  const px = Buffer.alloc(W*ch*4);
  cadros.forEach((c, i) => {
    const s = mapa[c.nome];
    const ox = i*cw + ((cw - s.ancho) >> 1), oy = ch - s.alto;
    for(let y = 0; y < s.alto; y++) s.px.copy(px, ((oy+y)*W + ox)*4, y*s.ancho*4, (y+1)*s.ancho*4);
  });
  /* Onde están os PÉS dentro da cela: o xogo coloca a unidade polo chan,
     non polo centro. Mídese na xeometría real en vez de supoñer que a
     silueta chega ao bordo, porque o contorno deixa marxe. */
  let pes = 0;
  for(let y = 0; y < ch; y++)
    for(let x = 0; x < W; x++)
      if(px[(y*W + x)*4 + 3] > 40){ pes = y; break; }
  for(let y = ch-1; y >= 0; y--){
    let hai = false;
    for(let x = 0; x < W && !hai; x++) if(px[(y*W + x)*4 + 3] > 40) hai = true;
    if(hai){ pes = y + 1; break; }
  }
  return { ancho: W, alto: ch, px, cw, ch, pes };
}

const tmpDir = path.join(__dirname, '..', 'capturas', '_xogo');
fs.mkdirSync(tmpDir, { recursive: true });
const banco = {};
for(const cls of CLASES){
  banco[cls] = {};
  for(const [eq, cor] of EQUIPOS){
    process.stdout.write(`  ${cls} equipo ${eq} (${cor})... `);
    const m = xerar(cls, cadros, { alt: ALT, res: RES, reusar: REUSAR, cor, toon: TOON,
                                   tmp: path.join(__dirname, '..', 'capturas', '_blender', cls + '_' + cor) });
    const a = atlas(m);
    const f = path.join(tmpDir, `${cls}_${eq}.png`);
    escribir(f, a);
    banco[cls][eq] = { d: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'),
                       cw: a.cw, ch: a.ch, pes: a.pes };
    fs.unlinkSync(f);
    console.log(`${a.cw}×${a.ch}, pés en ${a.pes}`);
  }
}

const saida = path.join(__dirname, '..', 'i', 'js', '19b-banco.js');
fs.writeFileSync(saida, `/* ============================================================
   BANCO DE SPRITES 3D — XERADO, NON EDITAR A MAN.

   Sae de: node tools/xerar-sprites-xogo.js
   Os modelos viven en tools/modelos.js e as regras que teñen que
   cumprir en tools/regras.js. Se hai que cambiar unha pose, cámbiase
   alí e vólvese xerar; tocar este ficheiro pérdese na seguinte pasada.

   ${cadros.length} cadros × ${CLASES.length} clases × ${EQUIPOS.length} equipos.
   ============================================================ */
const BANCO3D = ${JSON.stringify({ dirs: DIRS, alt: ALT, indice, banco })};
`, 'utf8');

const kb = (fs.statSync(saida).size/1024).toFixed(0);
console.log(`\n  ${cadros.length} cadros × ${CLASES.length} clases × ${EQUIPOS.length} equipos`);
console.log(`  ${saida}  (${kb} KB)\n`);
