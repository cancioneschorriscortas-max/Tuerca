#!/usr/bin/env node
/* ============================================================
   RECORTAR — separa as pezas dunha lámina de interface.

   As láminas veñen sobre fondo verde (croma). Isto detecta o
   verde, agrupa o que non o é en pezas conexas, e escribe cada
   unha nun PNG con transparencia.

   Uso:
     node tools/recortar.js i/ui/lamina1.png            (só listar)
     node tools/recortar.js i/ui/lamina1.png --escribir

   O desfleco importa: nun bisel metálico, o halo verde que deixa
   a compresión nótase moito. Os píxeles do bordo suavízanse
   restándolles a compoñente verde en vez de deixalos duros.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ler, escribir } = require('./png.js');

const ruta = process.argv[2];
if (!ruta) { console.error('uso: node tools/recortar.js <lamina.png> [--escribir]'); process.exit(1); }
const escribirPezas = process.argv.includes('--escribir');
const MIN_AREA = 900;        /* por debaixo diso é ruído do croma */

const im = ler(ruta);
const { ancho, alto, px } = im;

/* ---------- Cor de fondo: a moda das catro beiras ---------- */
function corDeFondo() {
  const c = new Map();
  const mira = (x, y) => {
    const i = (y * ancho + x) * 4;
    const k = px[i] + ',' + px[i + 1] + ',' + px[i + 2];
    c.set(k, (c.get(k) || 0) + 1);
  };
  for (let x = 0; x < ancho; x++) { mira(x, 0); mira(x, alto - 1); }
  for (let y = 0; y < alto; y++) { mira(0, y); mira(ancho - 1, y); }
  const [k] = [...c].sort((a, b) => b[1] - a[1])[0];
  return k.split(',').map(Number);
}
const [FR, FG, FB] = corDeFondo();

/* Distancia ao verde. Xenerosa, que o croma ten ruído e degradado. */
const TOL = 62;
function eFondo(i) {
  const dr = px[i] - FR, dg = px[i + 1] - FG, db = px[i + 2] - FB;
  return (dr * dr + dg * dg + db * db) < TOL * TOL;
}

/* ---------- Pezas: compoñentes conexas do que non é fondo ---------- */
const fondo = new Uint8Array(ancho * alto);
for (let p = 0; p < ancho * alto; p++) fondo[p] = eFondo(p * 4) ? 1 : 0;

const etiqueta = new Int32Array(ancho * alto).fill(-1);
const caixas = [];
const pila = new Int32Array(ancho * alto);

for (let inicio = 0; inicio < ancho * alto; inicio++) {
  if (fondo[inicio] || etiqueta[inicio] >= 0) continue;
  const id = caixas.length;
  let cima = 0, n = 0;
  let x0 = ancho, y0 = alto, x1 = 0, y1 = 0;
  pila[cima++] = inicio;
  etiqueta[inicio] = id;
  while (cima > 0) {
    const p = pila[--cima];
    const x = p % ancho, y = (p / ancho) | 0;
    n++;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    /* 8-conexión: os biseis teñen diagonais finas */
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
      const q = ny * ancho + nx;
      if (fondo[q] || etiqueta[q] >= 0) continue;
      etiqueta[q] = id;
      pila[cima++] = q;
    }
  }
  caixas.push({ id, x0, y0, x1, y1, n });
}

const pezas = caixas.filter(c => c.n >= MIN_AREA)
  .sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));

console.log(`${path.basename(ruta)} — fondo rgb(${FR},${FG},${FB}) · ${pezas.length} pezas (de ${caixas.length} rexións)\n`);
console.log('  #   x     y     ancho  alto   píxeles');
pezas.forEach((c, i) => {
  console.log(`  ${String(i).padStart(2)}  ${String(c.x0).padStart(4)}  ${String(c.y0).padStart(4)}  ` +
    `${String(c.x1 - c.x0 + 1).padStart(5)}  ${String(c.y1 - c.y0 + 1).padStart(5)}  ${c.n}`);
});

if (!escribirPezas) { console.log('\n(engade --escribir para xerar os PNG)'); process.exit(0); }

/* ---------- Escritura con desfleco ---------- */
const saidaDir = path.join(path.dirname(ruta), path.basename(ruta, '.png') + '-pezas');
fs.mkdirSync(saidaDir, { recursive: true });

for (const [i, c] of pezas.entries()) {
  const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sp = ((y + c.y0) * ancho + (x + c.x0));
    const s = sp * 4, d = (y * w + x) * 4;
    if (etiqueta[sp] !== c.id) { out[d + 3] = 0; continue; }
    let r = px[s], g = px[s + 1], b = px[s + 2];
    /* Desfleco: se o píxel aínda tira a verde, quítaselle o exceso de
       verde en vez de deixar un halo arredor do bisel. */
    const exceso = g - Math.max(r, b);
    if (exceso > 12) g = Math.max(r, b) + 12;
    out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = 255;
  }
  const nome = `${String(i).padStart(2, '0')}_${w}x${h}.png`;
  escribir(path.join(saidaDir, nome), { ancho: w, alto: h, px: out });
}
console.log(`\n${pezas.length} pezas escritas en ${saidaDir}`);
