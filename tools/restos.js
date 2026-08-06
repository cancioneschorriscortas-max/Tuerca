#!/usr/bin/env node
/* ============================================================
   RESTOS — os corpos, renderizados en Blender.

   POR QUE. TUERCA vai de recuperar corpos antes de que os reciclen. É a
   premisa enteira. E o corpo, hoxe, é un cadrado marrón de 14 píxeles
   cunha cruz negra pintada por riba (10-estructuras.js). Todo o demais
   do xogo —as cinco clases, oito direccións, cinco estados— sae deste
   mesmo pipeline de Blender con bisel, oclusión ambiental e cel
   shading. O obxecto máis importante do xogo é o único que quedou en
   marcador de posición.

   COMO. Non se toca nin o esqueleto nin pose(): un corpo caído non é
   unha pose, porque non hai articulación ningunha que tombe o corpo
   enteiro, e o criterio do refactor de modelos.js é que engadir un
   estado sexa escribir unha rama en pose() e nada máis. O que se fai é
   montar o modelo de sempre e TRANSFORMAR os vértices despois:

     · tombar   xirar todo o corpo sobre o eixe X ata deitalo, e
                deixalo pousado no chan
     · arrincar  separar as pezas de máis arriba e tiralas ao chan ao
                lado; é o que distingue un caído dun desfeito
     · queimar   escurecer e desaturar a cor de cada peza

   As tres traballan sobre `[verts, cor]`, que é o que devolve montar(),
   así que Blender segue calculando a luz e a oclusión sobre a xeometría
   final e non sobre un truco pintado enriba.

   USO
     node tools/restos.js --clase GRUNT --contacto
     node tools/restos.js --todas --escribir
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { montar } = require('./modelos.js');
const { xerar, PX_UNIDADE } = require('./sprites_blender.js');
const { escribir } = require('./png.js');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'i', 'js', '19f-restos.js');

const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ten = (n) => argv.includes('--' + n);

/* ---------- Azar reproducible ----------
   Un resto ten que caer sempre igual: se cambiase en cada execución, o
   ficheiro xerado mudaría sen que ninguén tocase nada. */
function azar(s){
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   TRANSFORMACIÓNS
   ============================================================ */
const xirarX = (v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c];
};
const xirarY = (v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0]*c + v[2]*s, v[1], -v[0]*s + v[2]*c];
};
const xirarZ = (v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2]];
};

/* Deitar o corpo. `caida` é canto se tomba (PI/2 = de todo), `xiro` a
   volta sobre o seu propio eixe —de costas, de lado, boca abaixo— e
   `torsión` unha inclinación pequena para que non queden todos
   aliñados coma pezas de dominó. */
function tombar(pezas, {caida = Math.PI/2, xiro = 0, torsion = 0} = {}){
  const chan = Math.min(...pezas.flatMap(([v]) => v.map(p => p[1])));
  let out = pezas.map(([v, cor]) => [
    v.map(p => {
      let q = [p[0], p[1] - chan, p[2]];   /* pivotar nos pés, non na cadeira */
      q = xirarY(q, xiro);
      q = xirarX(q, caida);
      q = xirarZ(q, torsion);
      return q;
    }), cor,
  ]);
  /* Pousar: o punto máis baixo volve ao chan de onde saíu. */
  const baixo = Math.min(...out.flatMap(([v]) => v.map(p => p[1])));
  return out.map(([v, cor]) => [v.map(p => [p[0], p[1] - baixo + chan, p[2]]), cor]);
}

/* Arrincar as `n` pezas máis altas do modelo EN PÉ (cabeza, ombreiros) e
   deixalas no chan ao lado. Faise antes de tombar, que é cando "arriba"
   aínda significa algo. */
function arrincar(pezas, n, rnd){
  const alt = pezas.map(([v], i) => ({i, y: Math.max(...v.map(p => p[1]))}))
                   .sort((a, b) => b.y - a.y).slice(0, n).map(o => o.i);
  const chan = Math.min(...pezas.flatMap(([v]) => v.map(p => p[1])));
  return pezas.map(([v, cor], i) => {
    if(alt.indexOf(i) < 0) return [v, cor];
    /* Cerca: unha peza a metro e medio non se le como parte do mesmo
       corpo, lese como outro obxecto. */
    const dx = (rnd() - 0.5) * 0.55, dz = (rnd() - 0.5) * 0.55;
    const baixa = Math.min(...v.map(p => p[1])) - chan;
    const rodar = (rnd() - 0.5) * 2.4;
    return [v.map(p => {
      let q = xirarX([p[0], p[1] - baixa, p[2]], rodar);
      return [q[0] + dx, q[1], q[2] + dz];
    }), cor];
  });
}

/* Queimado: escurece e desatura. Non se pinta negro — un robot queimado
   segue tendo o seu material debaixo, e se se apaga de todo deixa de
   distinguirse un GRUNT dun HEAVY na silueta. */
function queimar(pezas, k = 0.62){
  return pezas.map(([v, cor]) => {
    const m = (cor[0] + cor[1] + cor[2]) / 3;
    return [v, cor.map((c, j) => Math.round((c*(1-k) + m*k) * (0.44 + 0.06*j)))];
  });
}

/* ============================================================
   CATÁLOGO DE RESTOS

   Catro estados, e cada un di algo distinto:

     CAIDO      corpo enteiro, de costas. É o dos teus mortos: ten que
                recoñecerse a clase e a cor do bando, porque a operación
                consiste en decidir a quen vas buscar.
     DE_LADO    caído de lado, medio recollido. Variedade para que un
                campo de restos non pareza un almacén.
     DESFEITO   sen cabeza e sen un ombreiro, as pezas ao lado. Este é o
                que non se recupera.
     QUEIMADO   desfeito e apagado. É o do campo de restos recentes: o
                que se ve de camiño á base sen que ninguén o explique.
   ============================================================ */
/* A `caida` queda entre 55 e 72 graos, NON en 90. Con cámara a 22
   graos un corpo plano véxese escorzado e convértese nunha mancha: hai
   que deixalo medio de lado para que a silueta siga tendo tronco,
   pernas dobradas e un brazo fóra. `abre` pásalle a pose() canto se
   despregou ao caer. */
const VARIANTES = [
  /* Segunda pasada sobre estes números, mirando unha captura no chan: o
     primeiro intento quedaba DEMASIADO RECOLLIDO —un lump azul— porque
     tanto a caída coma a apertura eran curtas. Un corpo que cae
     espárrase. Súbense as dúas, sen chegar aos 90 graos que xa se
     probaron e daban unha mancha escorzada. */
  {id: 'CAIDO',    caida: 1.22, xiro: 0.30, torsion: 0.12, abre: 0.50, arrinca: 0, queima: 0},
  {id: 'DE_LADO',  caida: 1.34, xiro: 1.30, torsion: -0.16, abre: 0.85, arrinca: 0, queima: 0},
  {id: 'DESFEITO', caida: 1.30, xiro: 0.62, torsion: 0.22, abre: 1.00, arrinca: 2, queima: 0},
  {id: 'QUEIMADO', caida: 1.24, xiro: 2.05, torsion: -0.10, abre: 0.70, arrinca: 3, queima: 0.62},
];
const CORES = [['0', 'azul'], ['1', 'vermello'], ['2', 'metal']];
const DIRS = parseInt(op('dirs', '4'), 10);
const ALT = parseInt(op('alt', '18'), 10);

function pezasDe(clase, variante, corEq, semente){
  const rnd = azar(semente);
  let p = montar(clase, 'CAIDO', variante.abre, corEq).pezas;
  if(variante.arrinca) p = arrincar(p, variante.arrinca, rnd);
  p = tombar(p, variante);
  if(variante.queima) p = queimar(p, variante.queima);
  return p;
}

/* ---------- Render ---------- */
const clases = ten('todas') ? ['GRUNT', 'HEAVY', 'ENGINEER', 'SNIPER', 'BOMBARDERO']
                            : [op('clase', 'GRUNT')];
const cores = op('cor', null) ? CORES.filter(c => c[1] === op('cor')) : CORES;
const RES = parseInt(op('res', '256'), 10);
const TOON = parseInt(op('toon', '3'), 10);

const banco = {};
const previa = [];
for(const clase of clases){
  banco[clase] = {};
  for(const [eq, corEq] of cores){
    /* Todos os cadros dunha clase+cor comparten encadre, coma no banco
       de unidades: se cada un se recorta polo seu contorno, ao poñelos
       no mapa cada resto viría cun desprazamento distinto. */
    const cadros = [];
    for(const v of VARIANTES)
      for(let d = 0; d < DIRS; d++)
        cadros.push({nome: `${v.id}_${d}`, yaw: d*2*Math.PI/DIRS, _v: v, _d: d});

    const semBase = clase.length * 7919 + eq.charCodeAt(0) * 104729;
    process.stdout.write(`  ${clase} ${corEq} … `);
    const imx = xerar(clase, cadros, {
      /* Alto FIXO e non escala por unidade: un corpo deitado mide o
         seu largo, non o seu alto, e pxUnidade dáballe 43x32 cando
         unha unidade en pé son 22. */
      cor: corEq, res: RES, toon: TOON, alt: ALT,
      tmp: path.join(RAIZ, 'capturas', '_restos', clase + '_' + corEq),
      reusar: ten('reusar'),
      pezasDe: (c) => pezasDe(clase, c._v, corEq, semBase + c._v.id.length * 31 + c._d),
    });
    const primeiro = imx[cadros[0].nome];
    console.log(`${cadros.length} cadros, ${primeiro.ancho}x${primeiro.alto}`);
    banco[clase][eq] = {imx, cadros};
    if(clase === clases[0]) previa.push({clase, corEq, imx, cadros});
  }
}

/* ---------- Folla de contacto ----------
   Escribir os activos sen mirarlos é confiar. Isto pon todos os restos
   a tamaño real e ampliados, sobre un fondo do valor do chan do
   interior, que é onde van estar de verdade. */
if(ten('contacto')){
  const ref = previa[0];
  const cw = ref.imx[ref.cadros[0].nome].ancho, ch = ref.imx[ref.cadros[0].nome].alto;
  const ESC = 4, MAR = 6;
  const filas = previa.length * VARIANTES.length;
  const W = MAR + DIRS * (cw*ESC + MAR) + 40, H = MAR + filas * (ch*ESC + MAR + ch + 4);
  const buf = Buffer.alloc(W*H*4);
  for(let i = 0; i < W*H; i++){ buf[i*4] = 35; buf[i*4+1] = 35; buf[i*4+2] = 31; buf[i*4+3] = 255; }
  const pegar = (im, dx, dy, esc) => {
    for(let y = 0; y < im.alto*esc; y++) for(let x = 0; x < im.ancho*esc; x++){
      const s = (Math.floor(y/esc)*im.ancho + Math.floor(x/esc))*4;
      const a = im.px[s+3]/255;
      if(a < 0.05) continue;
      const X = dx+x, Y = dy+y;
      if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const d = (Y*W+X)*4;
      for(let k = 0; k < 3; k++) buf[d+k] = Math.round(buf[d+k]*(1-a) + im.px[s+k]*a);
    }
  };
  let fy = MAR;
  for(const p of previa){
    for(const v of VARIANTES){
      for(let d = 0; d < DIRS; d++){
        const im = p.imx[`${v.id}_${d}`];
        pegar(im, MAR + d*(cw*ESC+MAR), fy, ESC);
        pegar(im, MAR + d*(cw*ESC+MAR), fy + ch*ESC + 4, 1);
      }
      fy += ch*ESC + MAR + ch + 4;
    }
  }
  const dest = path.join(RAIZ, 'capturas', '_restos_contacto.png');
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  escribir(dest, {ancho: W, alto: H, px: buf});
  console.log(`\nfolla de contacto -> ${path.relative(RAIZ, dest)}`);
}

/* ---------- Ficheiro do xogo ---------- */
if(ten('escribir')){
  const zlib = require('zlib');
  const comoDataURL = (im) => {
    const cru = Buffer.alloc((im.ancho*4+1)*im.alto);
    for(let y = 0; y < im.alto; y++){
      cru[y*(im.ancho*4+1)] = 0;
      im.px.copy(cru, y*(im.ancho*4+1)+1, y*im.ancho*4, (y+1)*im.ancho*4);
    }
    const trozo = (n, d) => {
      const b = Buffer.alloc(8+d.length+4);
      b.writeUInt32BE(d.length, 0); b.write(n, 4, 'ascii'); d.copy(b, 8);
      b.writeUInt32BE(crc(Buffer.concat([Buffer.from(n,'ascii'), d])) >>> 0, 8+d.length);
      return b;
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(im.ancho, 0); ihdr.writeUInt32BE(im.alto, 4); ihdr[8] = 8; ihdr[9] = 6;
    const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
      trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(cru, {level:9})), trozo('IEND', Buffer.alloc(0))]);
    return 'data:image/png;base64,' + png.toString('base64');
  };
  let _t = null;
  function crc(b){
    if(!_t){ _t = new Int32Array(256);
      for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xedb88320^(c>>>1) : c>>>1; _t[n]=c; } }
    let c = 0xffffffff;
    for(let i=0;i<b.length;i++) c = _t[(c^b[i])&0xff] ^ (c>>>8);
    return c ^ 0xffffffff;
  }

  const linhas = [];
  const meta = {};
  for(const clase of clases){
    meta[clase] = {};
    for(const [eq] of cores){
      const {imx, cadros} = banco[clase][eq];
      const im0 = imx[cadros[0].nome];
      meta[clase][eq] = {w: im0.ancho, h: im0.alto};
      for(const c of cadros)
        linhas.push(`_loadAsset('rst_${clase}_${eq}_${c.nome}', '${comoDataURL(imx[c.nome])}');`);
    }
  }
  const txt = `/* ============================================================
   RESTOS — FICHEIRO XERADO. NON EDITAR A MAN.

   Sae de \`node tools/restos.js --todas --escribir\`. Son os corpos
   caídos, renderizados co mesmo pipeline de Blender que as unidades:
   bisel, oclusión ambiental e cel shading. Antes disto un resto era un
   cadrado marrón cunha cruz.

   Clave: rst_<CLASE>_<EQUIPO>_<VARIANTE>_<DIR>
   Variantes: ${VARIANTES.map(v => v.id).join(', ')} · ${DIRS} direccións.
   ============================================================ */
${linhas.join('\n')}

const RESTOS3D = {
  dirs: ${DIRS},
  variantes: ${JSON.stringify(VARIANTES.map(v => v.id))},
  meta: ${JSON.stringify(meta)},
};
`;
  fs.writeFileSync(SAIDA, txt, 'utf8');
  console.log(`\n-> ${path.relative(RAIZ, SAIDA)} (${linhas.length} sprites, ${Math.round(txt.length/1024)} KB)`);
}
