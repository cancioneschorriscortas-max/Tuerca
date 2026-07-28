#!/usr/bin/env node
/* ============================================================
   ¿AGUANTAN AS REGRAS UN ROBOT MESTURADO?

   O catálogo saca as pezas das cinco clases, que xa cumpren as 22
   regras. Pero que cada clase as cumpra POR SEPARADO non garante nada
   sobre as combinacións: unha cabeza de SNIPER nun chasis de HEAVY pode
   deixar oco, e un brazo de ENGINEER nun torso ancho pode quedar dentro
   do corpo.

   Con 5 pezas en 6 slots visibles son 15.625 combinacións. Non se
   comproban todas: próbase unha mostra ao chou e ademais os extremos
   (todo do máis ancho, todo do máis estreito), que é onde rompe.

   Uso: node tools/proba_mestura.js [cantas]
   ============================================================ */
const { ESQUELETO, OBXECTIVO_MAN, CLASES } = require('./modelos.js');
const { catalogo, esqueletoDe, SLOTS } = require('./pezas.js');
const { revisar } = require('./regras.js');

const cat = catalogo();
const CANTAS = parseInt(process.argv[2] || '40', 10);
const CLAVE = '_MESTURA';

/* Instala unha combinación como clase temporal. A pose base vén do
   CHASIS: é o corpo quen decide a postura, non os brazos. */
function instalar(sel){
  ESQUELETO[CLAVE] = esqueletoDe(sel, cat);
  OBXECTIVO_MAN[CLAVE] = OBXECTIVO_MAN[sel.CHASIS] || OBXECTIVO_MAN[CLASES[0]];
}
function desinstalar(){ delete ESQUELETO[CLAVE]; delete OBXECTIVO_MAN[CLAVE]; }

/* As regras que teñen sentido nunha combinación. L4 non: compara unha
   clase coas OUTRAS, e aquí non hai clases, hai montaxes. */
const IGNORAR = new Set(['L4']);

function probar(sel){
  instalar(sel);
  let fallos = [];
  try {
    fallos = revisar([CLAVE]).filter(r => r.fallo && !IGNORAR.has(r.id))
                             .map(r => r.id + ': ' + r.fallo);
  } catch(e){ fallos = ['LANZOU: ' + e.message]; }
  desinstalar();
  return fallos;
}

const combos = [];
/* extremos primeiro: o máis groso con todo, e o máis fino con todo */
for(const base of CLASES){
  const sel = {};
  for(const s of SLOTS) sel[s] = base;
  combos.push({ nome: 'todo ' + base, sel });
}
/* e cruces deliberados entre o máis ancho e o máis estreito */
combos.push({ nome: 'chasis HEAVY con todo de SNIPER',
  sel: Object.fromEntries(SLOTS.map(s => [s, s === 'CHASIS' ? 'HEAVY' : 'SNIPER'])) });
combos.push({ nome: 'chasis SNIPER con todo de HEAVY',
  sel: Object.fromEntries(SLOTS.map(s => [s, s === 'CHASIS' ? 'SNIPER' : 'HEAVY'])) });
/* mostra ao chou */
let semente = 12345;
const rnd = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for(let i = combos.length; i < CANTAS; i++){
  const sel = {};
  for(const s of SLOTS) sel[s] = CLASES[Math.floor(rnd() * CLASES.length)];
  combos.push({ nome: SLOTS.map(s => sel[s].slice(0, 2)).join('-'), sel });
}

console.log(`\n  ${combos.length} montaxes contra as regras\n`);
const porRegra = {};
let mal = 0;
for(const c of combos){
  const f = probar(c.sel);
  if(f.length){
    mal++;
    for(const x of f) porRegra[x.split(':')[0]] = (porRegra[x.split(':')[0]] || 0) + 1;
    if(mal <= 6) console.log('  ✗ ' + c.nome + '\n      ' + f.join('\n      '));
  }
}
console.log(`\n  ${combos.length - mal}/${combos.length} montaxes válidas`);
if(mal){
  console.log('  regras que máis fallan:');
  for(const [r, n] of Object.entries(porRegra).sort((a,b)=>b[1]-a[1]))
    console.log('    ' + r + '  ' + n + ' veces');
}
console.log('');
