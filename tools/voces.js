#!/usr/bin/env node
/* ============================================================
   VOCES — informe de cobertura.

   Cruza tres cousas que ata agora ninguén cruzaba:
     · as claves que o xogo PIDE  (vozMando / vozComentarista)
     · as que teñen GRAVACIÓN     (voces/manifest.json)
     · as que teñen TEXTO         (dicionario de 00b-i18n.js)

   Serve para saber que hai que gravar a seguir, e para detectar
   gravacións orfas — ficheiros que se publican e nunca soan.

   Uso: node tools/voces.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', 'i');
const JS = path.join(RAIZ, 'js');

/* ---------- O que o xogo pide ---------- */
const pedidas = new Map();   /* clave -> [ficheiro:liña] */
for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
  fs.readFileSync(path.join(JS, f), 'utf8').split('\n').forEach((l, i) => {
    if (!/voz(Mando|Comentarista)\s*\(/.test(l)) return;
    /* Colle todas as cadeas con forma de clave da liña: así entran tamén
       os ternarios, tipo vozMando(gañou ? 'op.vitoria' : 'op.derrota'). */
    for (const m of l.matchAll(/[`'"]([a-z]+\.[A-Za-z0-9_]+)[`'"]/g)) {
      if (!pedidas.has(m[1])) pedidas.set(m[1], []);
      pedidas.get(m[1]).push(`${f}:${i + 1}`);
    }
  });
}

/* ---------- O que hai gravado ---------- */
let manifesto = {};
try { manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, 'voces', 'manifest.json'), 'utf8')); }
catch (e) { console.error('non se puido ler voces/manifest.json:', e.message); }

/* ---------- O que ten texto ---------- */
const i18n = fs.readFileSync(path.join(JS, '00b-i18n.js'), 'utf8');
const temTexto = (k) => new RegExp(`['"]${k.replace('.', '\\.')}['"]\\s*:`).test(i18n);

/* ¿A chamada leva un segundo argumento? Se si, o chío ten texto aínda
   que a clave non estea no dicionario. */
function _pasaTexto(clave, onde){
  const [f, n] = onde.split(':');
  const l = fs.readFileSync(path.join(JS, f), 'utf8').split('\n')[Number(n) - 1] || '';
  return new RegExp(`[\`'"]${clave.replace('.', '\\.')}[\`'"]\\s*,`).test(l);
}

/* ---------- Linguas ---------- */
const LINGUAS = ['gl', 'es', 'en'];

/* ---------- ¿Existen os ficheiros que promete o manifesto? ---------- */
const rotos = [];
for (const [k, m] of Object.entries(manifesto)) {
  for (const [lang, ruta] of Object.entries(m)) {
    if (!fs.existsSync(path.join(RAIZ, ruta))) rotos.push(`${k}[${lang}] -> ${ruta}`);
  }
}

console.log('\nTUERCA — cobertura de voces\n');
console.log('  clave                 texto   ' + LINGUAS.map((l) => l.padEnd(4)).join('') + ' onde');
console.log('  ' + '-'.repeat(74));

const todas = [...new Set([...pedidas.keys(), ...Object.keys(manifesto)])].sort();
let gravadas = 0, orfas = [], senTexto = [];
for (const k of todas) {
  const m = manifesto[k] || {};
  const pedida = pedidas.has(k);
  const txt = temTexto(k);
  if (!pedida) orfas.push(k);
  /* Só é problema se ademais a chamada non pasa texto propio: a API é
     voz*(clave, texto) e o texto gaña. */
  if (pedida && !txt && pedidas.get(k).every((onde) => !_pasaTexto(k, onde))) senTexto.push(k);
  if (LINGUAS.some((l) => m[l])) gravadas++;
  console.log('  ' + k.padEnd(22) +
    (txt ? '  ok  ' : '  --  ').padEnd(8) +
    LINGUAS.map((l) => (m[l] ? ' ●  ' : ' ·  ')).join('') +
    (pedida ? pedidas.get(k)[0] : '\x1b[33mORFA\x1b[0m'));
}

console.log('\n  ● gravada   · sen gravar   ORFA = hai ficheiro pero o xogo non a pide\n');
console.log(`  pídense ${pedidas.size} claves; ${gravadas} teñen algunha gravación.`);
for (const l of LINGUAS) {
  const n = [...pedidas.keys()].filter((k) => manifesto[k] && manifesto[k][l]).length;
  console.log(`    ${l}: ${n}/${pedidas.size}`);
}
if (orfas.length) console.log(`\n  ORFAS (gravadas e nunca pedidas): ${orfas.join(', ')}`);
if (senTexto.length) console.log(`  SEN TEXTO nin no dicionario nin na chamada (o chío diría a clave): ${senTexto.join(', ')}`);
if (rotos.length) {
  console.log('\n  \x1b[31mMANIFESTO ROTO\x1b[0m — promete ficheiros que non existen:');
  for (const r of rotos) console.log('    ' + r);
}
console.log();
