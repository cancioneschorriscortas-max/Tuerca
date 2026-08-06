#!/usr/bin/env node
/* ============================================================
   PROPS — corta os obxectos dunha lámina de interior e escríbeos
   como activos do xogo.

   POR QUE SÓ OS OBXECTOS. As láminas traen muros, pisos, portas,
   escaleiras e obxectos. Medido cos tamaños reais das pezas
   (tools/recortar.js dá 58 rexións en 1536x1024), a redución ata a
   cela de 16 px é de 3x para un obxecto e de 5x para unha baldosa de
   piso. A 3x unha caixa conserva a silueta; a 5x unha textura de piso
   convértese en ruído. Ademais os muros teñen que seguir a luz da
   escena e responder ao autotiling, e un sprite fixo non fai nin unha
   cousa nin a outra.

   Así que os muros e os pisos quedan procedurais e aquí só se cortan
   os obxectos, que é onde un sprite gaña de verdade.

   COMO SE FILTRA O QUE NON É UN OBXECTO. A lámina ten rótulos brancos
   debaixo de cada peza e unha grella de fondo. Descártanse:
     · o que sexa case todo branco (é texto)
     · o que sexa moi baixo e moi ancho (é un rótulo)
     · o que teña moi poucos píxeles (é un anaco de grella)

   USO
     node tools/props.js art/tiles_interior0.png --listar
     node tools/props.js art/tiles_interior0.png --banda 800,1010 --listar
     node tools/props.js art/tiles_interior0.png --banda 800,1010 --escribir

   Con --escribir reescribe i/js/01c-props.js enteiro. É xerado.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ler } = require('./png.js');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'i', 'js', '01c-props.js');

const argv = process.argv.slice(2);
const ruta = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ten = (n) => argv.includes('--' + n);
if (!ruta) { console.error('uso: node tools/props.js <lamina.png> [--banda y0,y1] [--alto N] [--listar|--escribir]'); process.exit(1); }

const ALTO = parseInt(op('alto', '20'), 10);     /* alto obxectivo en píxeles de xogo */
const banda = op('banda', null);
const [BY0, BY1] = banda ? banda.split(',').map(Number) : [0, 1e9];

/* ---------- Croma ---------- */
const img = ler(ruta);
const { ancho: W, alto: H, px } = img;
const en = (x, y) => (y * W + x) * 4;

/* O fondo é o verde dominante. Cóllese o píxel máis repetido do bordo
   superior, que na lámina é fondo limpo. */
const conta = new Map();
for (let x = 0; x < W; x++) {
  const i = en(x, 2);
  const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
  conta.set(k, (conta.get(k) || 0) + 1);
}
let fondoK = 0, maxN = 0;
for (const [k, n] of conta) if (n > maxN) { maxN = n; fondoK = k; }
const FR = (fondoK >> 16) & 255, FG = (fondoK >> 8) & 255, FB = fondoK & 255;

/* A GRELLA DA LÁMINA É OUTRO VERDE, e tamén é fondo. Búscase como o
   segundo máis repetido do bordo, en vez de tratar "calquera verde"
   como fondo: esa regra comía os bidóns oliva e os armarios verdes, que
   son arte. */
let grellaK = 0, maxN2 = 0;
for (const [k, n] of conta) {
  if (k === fondoK) continue;
  const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
  if (g <= r || g <= b) continue;
  if (n > maxN2) { maxN2 = n; grellaK = k; }
}
const GR = (grellaK >> 16) & 255, GG = (grellaK >> 8) & 255, GB = grellaK & 255;

const distF = (r, g, b) => Math.hypot(r - FR, g - FG, b - FB);
const distG = (r, g, b) => (maxN2 ? Math.hypot(r - GR, g - GG, b - GB) : 1e9);
const TOL = 34;
const eFondo = (i) => {
  const r = px[i], g = px[i + 1], b = px[i + 2];
  return distF(r, g, b) < TOL || distG(r, g, b) < TOL;
};

/* ============================================================
   DESMESTURAR O CROMA — DÚAS CORRECCIÓNS, as dúas medidas.

   1) O FONDO NON É UNIFORME. Na fila de arriba da lámina é
      rgb(21,85,29) e á altura dos obxectos é rgb(35,57,38): hai
      viñeteado. Un só valor global con limiar fixo falla nas dúas
      direccións á vez —déixase fondo dentro e cómelle arte verde ás
      pezas—. Cada peza estima o SEU fondo do anel que a rodea.

   2) A ALFA É XEOMÉTRICA, NON CROMÁTICA. Un intento anterior estimaba
      a cobertura pola distancia á cor de fondo, e iso confunde "píxel
      de arte escura verdosa" con "píxel de bordo a medio cubrir": a
      unha caixa de madeira restábaselle media compoñente verde e saía
      maxenta. Só se desmestura o BORDO real da máscara; o interior
      pasa tal cal.

   O que queda dentro só se toca no anel de antialias, que é onde
   efectivamente hai mestura.
   ============================================================ */
function fondoLocal(r) {
  /* Anel de tres píxeles arredor da caixa. Todo iso é fondo. */
  const mostras = [];
  for (let d = 1; d <= 3; d++) {
    for (let x = r.x0 - d; x <= r.x1 + d; x++) {
      for (const y of [r.y0 - d, r.y1 + d]) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = en(x, y);
        if (eFondo(i)) mostras.push([px[i], px[i + 1], px[i + 2]]);
      }
    }
    for (let y = r.y0 - d; y <= r.y1 + d; y++) {
      for (const x of [r.x0 - d, r.x1 + d]) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = en(x, y);
        if (eFondo(i)) mostras.push([px[i], px[i + 1], px[i + 2]]);
      }
    }
  }
  if (!mostras.length) return [FR, FG, FB];
  /* Mediana por canle: unha media deixaríase arrastrar polas liñas da
     grella, que tamén caen no anel. */
  const med = (k) => {
    const v = mostras.map(m => m[k]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  return [med(0), med(1), med(2)];
}

/* ---------- Rexións conexas ---------- */
const visto = new Uint8Array(W * H);
const rexions = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (visto[k] || eFondo(en(x, y))) continue;
    const pila = [k]; visto[k] = 1;
    const celas = [];
    let x0 = x, x1 = x, y0 = y, y1 = y;
    while (pila.length) {
      const c = pila.pop();
      const cx = c % W, cy = (c / W) | 0;
      celas.push(c);
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx;
        if (visto[nk] || eFondo(en(nx, ny))) continue;
        visto[nk] = 1; pila.push(nk);
      }
    }
    rexions.push({ x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n: celas.length, celas });
  }
}

/* ---------- Que é un obxecto e que é un rótulo ---------- */
function claridade(r) {
  let brancos = 0;
  for (const c of r.celas) {
    const i = (c % W) * 4 + ((c / W) | 0) * W * 4;
    if (px[i] > 175 && px[i + 1] > 175 && px[i + 2] > 175) brancos++;
  }
  return brancos / r.n;
}
/* --pezas 0,3,4 — quedarse só con algunhas.

   Fai falla porque a lámina está debuxada en ALZADO e o xogo é vista
   CENITAL. Unha caixa é unha caixa desde calquera ángulo a 16 px, pero
   un reloxo, un extintor ou un altofalante son obxectos de parede: no
   chan dunha nave lense mal por moi ben cortados que estean. Non hai
   heurística que distinga iso; míranse na folla de contacto e escóllense
   a man, unha vez. */
const escolma = op('pezas', null);
const soLista = escolma ? escolma.split(',').map(Number) : null;

const candidatas = rexions.filter(r => {
  if (r.y0 < BY0 || r.y1 > BY1) return false;
  if (r.n < 600) return false;                       /* anacos de grella */
  if (r.w < 14 || r.h < 14) return false;
  if (r.h < 22 && r.w > r.h * 3) return false;       /* rótulo: baixo e longo */
  if (claridade(r) > 0.55) return false;             /* case todo branco: texto */
  if (r.n / (r.w * r.h) < 0.16) return false;        /* moi oco: liñas soltas */
  return true;
}).sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0))
  .filter((r, i) => !soLista || soLista.includes(i));

/* ---------- Redución por media de área ----------
   Non se colle o píxel máis próximo: prómediase a caixa enteira. A
   diferenza vese moito nun bidón de 33x60 baixado a 20 px de alto —o
   veciño máis próximo deixa o contorno serrado e a peza deixa de ler. */
function reducir(r, altoObx) {
  const [LR, LG, LB] = fondoLocal(r);
  const masc = new Set(r.celas);
  const eArte = (x, y) => x >= 0 && y >= 0 && x < W && y < H && masc.has(y * W + x);
  /* Devolve {r,g,b,a} da peza, ou null se é fondo. */
  const mostra = (x, y) => {
    if (!eArte(x, y)) return null;
    const i = en(x, y);
    const cr = px[i], cg = px[i + 1], cb = px[i + 2];
    const bordo = !eArte(x-1, y) || !eArte(x+1, y) || !eArte(x, y-1) || !eArte(x, y+1);
    if (!bordo) return { r: cr, g: cg, b: cb, a: 1 };
    /* Só aquí hai mestura de verdade. */
    const d = Math.hypot(cr - LR, cg - LG, cb - LB);
    const a = Math.max(0.25, Math.min(1, d / 70));
    const inv = 1 / a;
    return {
      r: Math.max(0, Math.min(255, (cr - (1 - a) * LR) * inv)),
      g: Math.max(0, Math.min(255, (cg - (1 - a) * LG) * inv)),
      b: Math.max(0, Math.min(255, (cb - (1 - a) * LB) * inv)),
      a,
    };
  };
  const esc = altoObx / r.h;
  const w2 = Math.max(4, Math.round(r.w * esc)), h2 = altoObx;
  const out = Buffer.alloc(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const sx0 = r.x0 + Math.floor(x * r.w / w2), sx1 = r.x0 + Math.max(Math.floor((x + 1) * r.w / w2), Math.floor(x * r.w / w2) + 1);
      const sy0 = r.y0 + Math.floor(y * r.h / h2), sy1 = r.y0 + Math.max(Math.floor((y + 1) * r.h / h2), Math.floor(y * r.h / h2) + 1);
      /* Promédiase a COR XA DESMESTURADA e pesada pola súa cobertura.
         Promediar o píxel cru era o que metía o verde do fondo dentro
         da peza. */
      let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          n++;
          const c = mostra(sx, sy);
          if (!c) continue;
          sr += c.r * c.a; sg += c.g * c.a; sb += c.b * c.a; sa += c.a;
        }
      }
      const d = (y * w2 + x) * 4;
      if (sa < 0.02) { out[d + 3] = 0; continue; }
      let cr = sr / sa, cg = sg / sa, cb = sb / sa;
      /* SUPRESIÓN DE DERRAME. A lámina está renderizada sobre verde e o
         propio material leva rebote verde: iso xa non o quita ningún
         croma, porque non é mestura, é iluminación. A regra clásica é
         que a canle verde non pode superar a máis alta das outras dúas;
         o que sobra devólvese repartido para non escurecer a peza. */
      const teito = Math.max(cr, cb);
      if (cg > teito) {
        const sobra = cg - teito;
        cg = teito;
        cr = Math.min(255, cr + sobra * 0.5);
        cb = Math.min(255, cb + sobra * 0.5);
      }
      out[d] = Math.round(cr); out[d + 1] = Math.round(cg); out[d + 2] = Math.round(cb);
      out[d + 3] = Math.round(255 * Math.min(1, sa / n));
    }
  }
  return { ancho: w2, alto: h2, px: out };
}

/* ---------- PNG ---------- */
function comoPNG({ ancho, alto, px }) {
  const cru = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    cru[y * (ancho * 4 + 1)] = 0;
    px.copy(cru, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  const trozo = (nome, datos) => {
    const b = Buffer.alloc(8 + datos.length + 4);
    b.writeUInt32BE(datos.length, 0); b.write(nome, 4, 'ascii');
    datos.copy(b, 8);
    const crcBuf = Buffer.concat([Buffer.from(nome, 'ascii'), datos]);
    b.writeUInt32BE(crc(crcBuf) >>> 0, 8 + datos.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(cru, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}
let _tabla = null;
function crc(buf) {
  if (!_tabla) {
    _tabla = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      _tabla[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = _tabla[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

/* ---------- Saída ---------- */
console.log(`${path.basename(ruta)} ${W}x${H} · fondo rgb(${FR},${FG},${FB}) · ${rexions.length} rexións · ${candidatas.length} candidatas a obxecto\n`);
candidatas.forEach((r, i) => {
  console.log(`  ${String(i).padStart(2)}  ${String(r.x0).padStart(4)},${String(r.y0).padStart(4)}  ${r.w}x${r.h}  ${r.n} px  → ${Math.round(r.w * ALTO / r.h)}x${ALTO}`);
});

/* ---------- Folla de contacto ----------
   Escribir os activos sen miralos é confiar. Isto pon as pezas xa
   REDUCIDAS unha ao lado da outra, ao tamaño real e ampliadas x4, sobre
   fondo neutro. É a única maneira de saber cales sobreviven á redución
   e cales quedan en tres manchas. */
if (ten('contacto')) {
  const minis = candidatas.map(r => reducir(r, ALTO));
  const COL = 8, CEL = ALTO * 4 + 12;
  const filas = Math.ceil(minis.length / COL);
  const cw = COL * CEL, ch = filas * (CEL + ALTO + 8) + 8;
  const buf = Buffer.alloc(cw * ch * 4);
  for (let i = 0; i < cw * ch; i++) { buf[i*4] = 46; buf[i*4+1] = 48; buf[i*4+2] = 52; buf[i*4+3] = 255; }
  const pegar = (m, dx, dy, esc) => {
    for (let y = 0; y < m.alto * esc; y++) {
      for (let x = 0; x < m.ancho * esc; x++) {
        const s = (Math.floor(y/esc) * m.ancho + Math.floor(x/esc)) * 4;
        const a = m.px[s+3] / 255;
        if (a < 0.05) continue;
        const px2 = dx + x, py2 = dy + y;
        if (px2 < 0 || py2 < 0 || px2 >= cw || py2 >= ch) continue;
        const d = (py2 * cw + px2) * 4;
        for (let k = 0; k < 3; k++) buf[d+k] = Math.round(buf[d+k]*(1-a) + m.px[s+k]*a);
      }
    }
  };
  minis.forEach((m, i) => {
    const cx = (i % COL) * CEL + 6, cy = Math.floor(i / COL) * (CEL + ALTO + 8) + 6;
    pegar(m, cx, cy, 4);                      /* ampliado, para xulgar */
    pegar(m, cx, cy + ALTO*4 + 4, 1);         /* tamaño real, para a verdade */
  });
  const dest = path.join(RAIZ, 'capturas', '_props_contacto.png');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, comoPNG({ ancho: cw, alto: ch, px: buf }));
  console.log(`\nfolla de contacto -> ${path.relative(RAIZ, dest)}  (x4 arriba, tamaño real abaixo)`);
}

if (ten('escribir')) {
  const pezas = candidatas.map((r, i) => {
    const mini = reducir(r, ALTO);
    return { clave: 'prop' + String(i).padStart(2, '0'), w: mini.ancho, h: mini.alto,
             b64: comoPNG(mini).toString('base64') };
  });
  const corpo = pezas.map(p =>
    `_loadAsset('${p.clave}', 'data:image/png;base64,${p.b64}');`).join('\n');
  const manifesto = pezas.map(p => `  {clave:'${p.clave}', w:${p.w}, h:${p.h}}`).join(',\n');
  const txt = `/* ============================================================
   OBXECTOS DE INTERIOR — FICHEIRO XERADO. NON EDITAR A MAN.

   Sae de \`node tools/props.js ${path.basename(ruta)} --banda ${BY0},${BY1} --escribir\`,
   que corta as pezas da lámina sobre croma verde e redúceas a ${ALTO} px
   de alto por media de área.

   Só se cortan OBXECTOS. Os muros e os pisos quedan procedurais: a
   redución ata a cela de 16 px é de 3x nun obxecto e de 5x nunha
   baldosa, e ademais un muro ten que seguir a luz da escena e o
   autotiling, cousa que un sprite fixo non fai.
   ============================================================ */
${corpo}

const PROPS_INTERIOR = [
${manifesto},
];
`;
  fs.writeFileSync(SAIDA, txt, 'utf8');
  const kb = Math.round(txt.length / 1024);
  console.log(`\n-> ${path.relative(RAIZ, SAIDA)} (${pezas.length} obxectos, ${kb} KB)`);
}
