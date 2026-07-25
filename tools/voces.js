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

/* ---------- Guión de gravación ----------
   `node tools/voces.js --guion [gl|es|en]` imprime o que falta por gravar
   nesa lingua, coa frase de referencia e o nome de ficheiro exacto. É o
   que converte "hai que gravar voces" nunha tarefa de vinte minutos. */
if (process.argv.includes('--guion')) {
  const lingua = process.argv[process.argv.indexOf('--guion') + 1] || 'gl';
  /* O texto de referencia sae do dicionario: é o que le o xogador en
     pantalla, así que a voz e o texto contan o mesmo. */
  const bloque = i18n.slice(i18n.indexOf(`  ${lingua}: {`));
  const textoDe = (k) => {
    const m = bloque.match(new RegExp(`['"]${k.replace('.', '\\.')}['"]\\s*:\\s*'([^']*)'`));
    return m ? m[1] : null;
  };
  const faltan = [...pedidas.keys()].filter((k) => !(manifesto[k] && manifesto[k][lingua])).sort();

  console.log(`\nTUERCA — guión de gravación · ${lingua.toUpperCase()}\n`);
  console.log(`  ${faltan.length} clip(s) por gravar de ${pedidas.size} que o xogo pide.\n`);
  console.log('  Formato: .ogg (Vorbis). Gárdaos en voces/' + lingua + '/ co nome exacto');
  console.log('  e despois:  python tools/xerar_manifest.py\n');
  /* A decoración da radio (o emoji e as comiñas angulares) é para a
     pantalla, non para ler en alto. */
  const limpar = (s) => s
    .replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/^[^\p{L}\p{N}«"]*/u, '').replace(/^«|»$/g, '').trim();

  const conVariables = [];
  faltan.forEach((k, i) => {
    const t = textoDe(k);
    console.log(`  ${String(i + 1).padStart(2)}. voces/${lingua}/${k}.ogg`);
    if (!t) {
      console.log('      \x1b[33m(sen texto no dicionario — escribe ti a frase)\x1b[0m');
      return;
    }
    const limpo = limpar(t);
    console.log(`      "${limpo}"`);
    if (/\{[a-z]+\}/i.test(limpo)) {
      conVariables.push(k);
      console.log('      \x1b[33m^ leva variables: un clip fixo non pode dicir un marcador que cambia\x1b[0m');
    }
  });
  if (conVariables.length) {
    console.log(`\n  ${conVariables.length} das de arriba levan {variables}. Ou se gravan SEN os`);
    console.log('  números (e o dato queda só na radio escrita), ou se deixan en chío.');
  }
  console.log('\n  Consello do README: son avisos do MANDO ao comandante.');
  console.log('  Ton seco, curto, e con paso banda 250-3400 Hz queda a radio militar.\n');
  process.exit(0);
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
