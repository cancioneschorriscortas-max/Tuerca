/* ============================================================
   DETERMINISMO DA SIMULACIÓN (v0.78)

   Ata agora o motor usaba Math.random() en 106 sitios e dúas
   partidas coa mesma entrada divirxían. Iso significaba que
   cando o fuzz atopaba un fallo, NON SE PODÍA REPETIR — que é
   exactamente o que nos pasou coa proba intermitente da v0.77.

   Agora o azar do motor sae dun fluxo con semente que vive no
   estado da batalla. O do render segue en Math.random() a
   propósito: se consumise este fluxo, o resultado dependería da
   taxa de frames.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla, avanzar } = require('./arnes.js');

/* Retrato do estado que ten que cadrar. Non se pode usar JSON.stringify
   sobre `g`: as torretas apuntan ao seu ocupante e o ocupante á lista, e
   iso é un ciclo. */
function retrato(g) {
  return JSON.stringify({
    t: g.t, over: g.over, result: g.result,
    kills: g.kills, enemyN: g.enemyN, rng: g.rngEstado,
    hq: g.hq.map((h) => [Math.round(h.hp * 100), h.team]),
    sectores: g.sectors.map((s) => [s.id, s.owner, Math.round(s.prog * 100)]),
    unidades: g.units.map((u) => [
      u.id, u.cls, u.team, u.dead ? 1 : 0,
      Math.round(u.x * 100), Math.round(u.y * 100), Math.round(u.hp * 100),
    ]),
  });
}

/* SANDBOX LIMPO POR EXECUCIÓN, e non un compartido.
   A semente non abonda: os ids das unidades saen de DATA.nextId, que é un
   contador PERSISTENTE DA CAMPAÑA e avanza en cada batalla. Reutilizando o
   mesmo sandbox, a segunda partida saía idéntica en posicións e hp pero
   cos veteranos numerados R-03/R-04 en vez de R-01/R-02.
   Non é un fallo do determinismo: é que o estado inicial hai que
   controlalo enteiro. Repetir unha partida de verdade require a semente
   E o estado da campaña. */
function correr(semente, pasos) {
  const S = cargarXogo();
  const g = novaBatalla(S, { op: 2, semente });
  avanzar(S, g, pasos);
  return { g, r: retrato(g) };
}

proba('a mesma semente dá exactamente a mesma partida', () => {
  const a = correr(0xC0FFEE, 4000);
  const b = correr(0xC0FFEE, 4000);
  afirmar(a.r === b.r, 'dúas partidas coa mesma semente divirxiron');
  afirmar(a.g.semente === 0xC0FFEE, `a semente non quedou no estado: ${a.g.semente}`);
});

proba('sementes distintas dan partidas distintas', () => {
  const a = correr(1, 3000);
  const b = correr(2, 3000);
  afirmar(a.r !== b.r, 'dúas sementes distintas deron o mesmo resultado exacto');
});

proba('o determinismo aguanta ata o final da batalla', () => {
  /* 4000 pasos son o principio. O que importa é que non diverxa nunca,
     incluído o remate, que é onde entran os camiños raros. */
  const a = correr(777, 120000);
  const b = correr(777, 120000);
  afirmar(a.g.over && b.g.over, 'a batalla non rematou nas dúas');
  afirmar(a.r === b.r, `divirxiron ao rematar (${a.g.t} vs ${b.g.t} pasos)`);
});

proba('o estado do azar viaxa co obxecto da batalla', () => {
  /* Ten que estar EN g, non nunha variable de módulo: así vai nas
     instantáneas e nos gardados, e unha partida pódese retomar. */
  const S = cargarXogo();
  const g = novaBatalla(S, { op: 2, semente: 42 });
  afirmar(typeof g.rngEstado === 'number', 'g.rngEstado non é un número');
  const antes = g.rngEstado;
  avanzar(S, g, 200);
  afirmar(g.rngEstado !== antes, 'o estado do azar non avanzou ao simular');
});

proba('fóra de batalla, rnd() non toca o fluxo da partida', () => {
  /* Chamar a rnd() desde o hangar non pode mover o azar dunha batalla
     que xa non está en curso, ou os gardados quedarían tocados. */
  const S = cargarXogo();
  S.aval('(function(){ game = null; })')();
  const rnd = S.aval('rnd');
  for (let i = 0; i < 50; i++) {
    const v = rnd();
    afirmar(v >= 0 && v < 1, `rnd() devolveu ${v} fóra de [0,1)`);
  }
});

proba('o render segue con Math.random(), non co fluxo sementado', () => {
  /* Se as partículas consumisen o fluxo, o resultado dependería da taxa
     de frames e non habería determinismo ningún. */
  const fs = require('fs');
  const luz = fs.readFileSync('C:/tuerca/i/js/15-luz.js', 'utf8');
  afirmar(!/\brnd\(\)/.test(luz), 'a capa de luz colouse no fluxo sementado');
  const estruturas = fs.readFileSync('C:/tuerca/i/js/10-estructuras.js', 'utf8');
  const fx = estruturas.slice(estruturas.indexOf('function fxBurst'),
                              estruturas.indexOf('function fxTick'));
  afirmar(!/\brnd\(\)/.test(fx), 'as partículas de FX coláronse no fluxo sementado');
});
