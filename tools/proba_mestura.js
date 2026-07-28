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
const { catalogo, esqueletoDe, obxectivoDe, SLOTS } = require('./pezas.js');
const { revisar } = require('./regras.js');

const cat = catalogo();
const CANTAS = parseInt(process.argv[2] || '40', 10);
const CLAVE = '_MESTURA';

/* Instala unha combinación como clase temporal. A pose base vén do
   CHASIS: é o corpo quen decide a postura, non os brazos. */
function instalar(sel){
  ESQUELETO[CLAVE] = esqueletoDe(sel, cat);
  OBXECTIVO_MAN[CLAVE] = obxectivoDe(sel);
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

/* ============================================================
   E O QUE DE VERDADE IMPORTA.

   As regras son un proxy. O tope de L7 mídese nun render de 176x176 e
   20 píxeles alí soan a moito, pero o sprite que vai ao xogo ten 22 de
   alto. A pregunta real é: se compoño esta montaxe por capas, ¿nótase?

   Isto compón cada montaxe coa orde calculada e compáraa co render
   enteiro, xa reducida ao tamaño do xogo.
   ============================================================ */
const { montar } = require('./modelos.js');
const { render, contornear, aRGBA, recortar, reducir } = require('./vox3d.js');
const { porGrupos, porCapasOrde, W, H, ESCALA, PITCH } = require('./proba_capas.js');

function _spr(r){
  let im = recortar(aRGBA(contornear(r, 2)));
  while(im.alto > 44) im = reducir(im, Math.max(1, im.ancho >> 1), im.alto >> 1);
  return reducir(im, Math.max(1, Math.round(im.ancho*22/im.alto)), 22);
}
function _dif(a, b){
  let n = 0, t = 0;
  for(let i = 0; i < Math.min(a.ancho*a.alto, b.ancho*b.alto); i++){
    const av = a.px[i*4+3] > 110, bv = b.px[i*4+3] > 110;
    if(av || bv) t++;
    if(av !== bv){ n++; continue; }
    if(!av) continue;
    if(Math.abs(a.px[i*4]-b.px[i*4]) + Math.abs(a.px[i*4+1]-b.px[i*4+1])
     + Math.abs(a.px[i*4+2]-b.px[i*4+2]) > 24) n++;
  }
  return { pc: t ? n*100/t : 0, n };
}

let suma = 0, casos = 0, peorPc = 0, peorPx = 0, peorNome = '';
for(const c of combos){
  instalar(c.sel);
  for(const est of ['REPOUSO', 'DISPARAR']){
    const g = porGrupos(CLAVE, est, 0.25, 'peza');
    for(const d of [0, 2, 5]){
      const yaw = d*2*Math.PI/8;
      const r = _dif(_spr(render(montar(CLAVE, est, 0.25), W, H, ESCALA, yaw, PITCH)),
                     _spr(porCapasOrde(g, yaw)));
      suma += r.pc; casos++;
      if(r.pc > peorPc){ peorPc = r.pc; peorPx = r.n; peorNome = c.nome; }
    }
  }
  desinstalar();
}
console.log('  compoñer por capas ordenadas, ao tamaño do xogo (22 px):');
console.log('    erro medio  ' + (suma/casos).toFixed(2) + '%');
console.log('    peor caso   ' + peorPc.toFixed(1) + '%  (' + peorPx + ' px de ~250)  ' + peorNome);
console.log('');
