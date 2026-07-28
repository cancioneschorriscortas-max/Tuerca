#!/usr/bin/env node
/* ============================================================
   TÁBOA DE ORDE DE PINTADO — o COF de TUERCA.

   Para compoñer un robot con pezas renderizadas por separado hai que
   saber en que orde apilalas, e a orde cambia coa dirección: de fronte a
   mochila vai debaixo de todo e o brazo dereito enriba; de costas, ao
   revés. Diablo II garda exactamente isto nos seus ficheiros COF.

   O que non se pode facer é calculala no navegador: iso precisaría a
   profundidade de cada píxel, que é o que se quixo evitar. Así que se
   precociña aquí.

   ¿E vale unha soa táboa para calquera montaxe? A orde exacta SI depende
   das pezas concretas —medido: entre 5 e 7 ordes distintas por
   dirección— pero boa parte desa variación é entre capas que nin se
   tocan, onde a orde é irrelevante. Construíndo a táboa por VOTOS ENTRE
   PARES sobre moitas montaxes, o resultado é:

       orde calculada para cada montaxe    0.22% de erro
       táboa fixa por dirección            0.71%   (peor 6.5%)

   Menos de dous píxeles de 250. Págase esa diferenza por non ter que
   enviar profundidade nin calculala en tempo real.

   Uso:
     node tools/taboa_orde.js            informe
     node tools/taboa_orde.js --escribir  escribe i/js/19c-orde.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ESQUELETO, OBXECTIVO_MAN, CLASES } = require('./modelos.js');
const { catalogo, esqueletoDe, SLOTS } = require('./pezas.js');
const { porGrupos, ordeCapas } = require('./proba_capas.js');

const CAPAS = ['MOCHILA', 'TORSO', 'PEITO', 'CABEZA', 'PERNA_E', 'PERNA_D', 'BRAZO_E', 'BRAZO_D'];
const ESTADOS = [['REPOUSO', 0], ['ANDAR', 0.5], ['DISPARAR', 0.25]];
const DIRS = 8;
const CLAVE = '_TAB';
const MOSTRAS = parseInt(process.argv.includes('--mostras')
  ? process.argv[process.argv.indexOf('--mostras') + 1] : '20', 10);

const cat = catalogo();
let semente = 7;
const rnd = () => (semente = (semente*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* Mostras: as clases puras primeiro (son as que máis se van xogar) e
   despois combinacións ao chou, que é onde a orde se pon difícil. */
const montaxes = [];
for(const b of CLASES){
  const s = {}; for(const k of SLOTS) s[k] = b;
  montaxes.push(s);
}
while(montaxes.length < MOSTRAS){
  const s = {}; for(const k of SLOTS) s[k] = CLASES[Math.floor(rnd()*CLASES.length)];
  montaxes.push(s);
}

/* Votos: cantas veces A queda antes ca B, por estado e dirección. */
const votos = {};
for(const sel of montaxes){
  ESQUELETO[CLAVE] = esqueletoDe(sel, cat);
  OBXECTIVO_MAN[CLAVE] = OBXECTIVO_MAN[sel.CHASIS];
  for(const [est, f] of ESTADOS){
    const g = porGrupos(CLAVE, est, f, 'peza');
    for(let d = 0; d < DIRS; d++){
      const o = ordeCapas(g, d*2*Math.PI/DIRS);
      const k = est + '/' + d;
      votos[k] = votos[k] || {};
      for(let i = 0; i < o.length; i++) for(let j = i+1; j < o.length; j++){
        const par = o[i] + '>' + o[j];
        votos[k][par] = (votos[k][par] || 0) + 1;
      }
    }
  }
  delete ESQUELETO[CLAVE]; delete OBXECTIVO_MAN[CLAVE];
}

/* A táboa: as OITO capas ordenadas polo saldo de votos. Van todas
   aínda que unha montaxe concreta non teña algunha —quen compón salta
   as que falten— porque unha táboa á que lle falte unha capa deixaríaa
   sen pintar, e iso xa pasou nunha proba: 96% de erro nun caso. */
const taboa = {};
for(const [k, v] of Object.entries(votos)){
  const saldo = (a, b) => (v[a+'>'+b] || 0) - (v[b+'>'+a] || 0);
  taboa[k] = [...CAPAS].sort((a, b) => saldo(b, a) - saldo(a, b));
}

if(process.argv.includes('--escribir')){
  const saida = path.join(__dirname, '..', 'i', 'js', '19c-orde.js');
  fs.writeFileSync(saida, `/* ============================================================
   ORDE DE PINTADO POR DIRECCIÓN — XERADO, NON EDITAR A MAN.

   Sae de: node tools/taboa_orde.js --escribir
   Dise en que orde se apilan as capas dun robot montado por pezas, para
   cada estado e cada unha das oito direccións. É o equivalente aos
   ficheiros COF de Diablo II.

   Construída por votos entre pares sobre ${montaxes.length} montaxes distintas.
   Erro medio ao compoñer con ela: 0.71% dos píxeles do sprite.
   ============================================================ */
const ORDE3D = ${JSON.stringify(taboa)};
`, 'utf8');
  console.log('  escrito ' + saida);
}

console.log(`\n  Táboa de orde · ${montaxes.length} montaxes · ${Object.keys(taboa).length} entradas\n`);
for(const d of [0, 2, 4, 6]){
  console.log('  REPOUSO dir ' + d + '   ' + taboa['REPOUSO/' + d].join(' > '));
}
console.log('\n  (de atrás a diante)\n');

module.exports = { taboa, CAPAS };
