/* ============================================================
   INVARIANTES DA SIMULACIÓN

   A simulación NON é reproducible: fai 65 chamadas a Math.random()
   no seu camiño de execución, así que "mesma entrada -> mesmo
   estado final" non se pode afirmar hoxe. O que si se pode afirmar
   é o que ten que cumprirse SEMPRE, saia o que saia o dado.

   Por iso estas probas son de fuzz: moitas partidas distintas,
   comprobando en cada intervalo que o estado segue sendo coherente.
   Collen NaN, unidades fuxidas do mapa, hp imposibles, ids
   duplicados e calquera excepción no bucle — que é exactamente o
   que rompe ao mexer no render.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla, avanzar } = require('./arnes.js');

const finito = (n) => typeof n === 'number' && Number.isFinite(n);

/* Lanza en canto algo deixa de cumprirse, dicindo onde e con que valor. */
function revisarInvariantes(S, g, onde) {
  const W = S.aval('W'), H = S.aval('H');
  const erro = (msg) => { throw new Error(`${onde} (paso ${g.t}): ${msg}`); };

  const vistos = new Map();
  for (const u of g.units) {
    const quen = `${u.id}/${u.cls}/equipo ${u.team}`;
    if (!finito(u.x) || !finito(u.y)) erro(`${quen} ten posición non finita (${u.x}, ${u.y})`);
    if (!finito(u.hp) || !finito(u.max)) erro(`${quen} ten hp non finito (${u.hp}/${u.max})`);
    /* As mortas quedan na lista (o motor márcaas con `dead` e séguenas
       debuxando como restos).

       Só se afirma unha dirección: sen hp non se pode seguir vivo. A
       contraria NON vale como invariante — `dead` é a fonte de verdade
       do motor e o hp non se mantén despois de morrer. Un piloto que
       voa coa súa torreta queda morto co hp que tiña (killPilot, en
       09-economia-combate.js:894), e iso é lexítimo: morreu pola
       explosión, non polo dano. */
    if (u.hp <= 0 && !u.dead) erro(`${quen} ten hp ${u.hp} pero non está marcada como morta`);
    if (u.hp > u.max) erro(`${quen} ten hp ${u.hp} por riba do máximo ${u.max}`);
    /* Marxe xenerosa: interesa detectar fugas, non rozar o bordo. */
    if (u.x < -64 || u.x > W + 64 || u.y < -64 || u.y > H + 64) {
      erro(`${quen} fuxiu do mapa en (${Math.round(u.x)}, ${Math.round(u.y)}); mapa ${W}x${H}`);
    }
    if (u.team !== 0 && u.team !== 1) erro(`${quen} ten equipo inválido: ${u.team}`);
    /* Os ids teñen que ser únicos: o PvP resolve ocupantes de torretas e
       vehículos por id, e un repetido faille coller a unidade equivocada. */
    if (vistos.has(u.id)) erro(`id ${u.id} repetido: ${vistos.get(u.id)} e ${quen}`);
    vistos.set(u.id, quen);
  }

  for (const h of g.hq) {
    if (!finito(h.hp)) erro(`HQ do equipo ${h.team} ten hp non finito (${h.hp})`);
    if (h.hp > h.max) erro(`HQ do equipo ${h.team} ten hp ${h.hp} por riba do máximo ${h.max}`);
  }

  for (const s of g.sectors) {
    if (!finito(s.prog)) erro(`sector ${s.id} ten prog non finito (${s.prog})`);
    if (s.prog < -100.001 || s.prog > 100.001) erro(`sector ${s.id} ten prog fóra de rango: ${s.prog}`);
    if (![-1, 0, 1].includes(s.owner)) erro(`sector ${s.id} ten dono inválido: ${s.owner}`);
  }

  if (!finito(g.t) || g.t < 0) erro(`g.t inválido: ${g.t}`);
  for (const k of g.kills) if (!finito(k) || k < 0) erro(`contador de baixas inválido: ${g.kills}`);
}

/* Avanza revisando cada `cada` pasos. */
function avanzarRevisando(S, g, pasos, onde, cada = 60) {
  let feitos = 0;
  while (feitos < pasos && !g.over) {
    feitos += avanzar(S, g, Math.min(cada, pasos - feitos));
    revisarInvariantes(S, g, onde);
  }
  return feitos;
}

/* ---------- Probas ---------- */

/* Os tres mapas que usa a campaña: MAP1 (op 0), MAP2 (op 1) e
   procedural (op >= 2). O procedural é o que máis variedade dá. */
for (const op of [0, 1, 2]) {
  proba(`invariantes nunha batalla completa (op=${op})`, () => {
    const S = cargarXogo();
    const g = novaBatalla(S, { op });
    afirmar(g.units.length > 0, 'a batalla arrancou sen unidades');
    revisarInvariantes(S, g, 'ao arrancar');
    avanzarRevisando(S, g, 120000, `op=${op}`);
    afirmar(g.over, `a batalla non rematou en 120000 pasos (33 min de xogo)`);
  });
}

proba('fuzz: 12 batallas procedurais seguidas manteñen os invariantes', () => {
  const S = cargarXogo();
  for (let i = 0; i < 12; i++) {
    const g = novaBatalla(S, { op: 2 });
    avanzarRevisando(S, g, 120000, `batalla ${i + 1}`, 120);
    afirmar(g.over, `a batalla ${i + 1} non rematou`);
  }
});

proba('toda batalla remata cun resultado declarado', () => {
  const S = cargarXogo();
  for (let i = 0; i < 6; i++) {
    const g = novaBatalla(S, { op: 2 });
    avanzar(S, g, 120000);
    afirmar(g.over, `a batalla ${i + 1} quedou colgada`);
    afirmar(g.result === 'victory' || g.result === 'defeat',
      `resultado inesperado na batalla ${i + 1}: ${JSON.stringify(g.result)}`);
  }
});

proba('g.t avanza exactamente un por paso', () => {
  const S = cargarXogo();
  const g = novaBatalla(S, { op: 2 });
  const simStep = S.aval('simStep');
  for (let i = 1; i <= 500; i++) {
    simStep(g);
    afirmar(g.t === i, `tras ${i} pasos g.t vale ${g.t}`);
  }
});

proba('os veteranos despregados conservan a súa ficha persistente', () => {
  const S = cargarXogo();
  const PT = S.aval('PT');
  const g = novaBatalla(S, { op: 2 });
  /* Ollo: `persisted` tamén o levan os inimigos recorrentes (os que
     sobreviven a unha operación e volven na seguinte). Hai que filtrar
     por equipo para quedarse cos veteranos propios. */
  const meus = g.units.filter((u) => u.persisted && u.team === PT);
  afirmar(meus.length === 3, `esperábanse 3 veteranos propios despregados, hai ${meus.length}`);
  for (const u of meus) {
    afirmar(typeof u.name === 'string' && u.name.length > 0, `${u.id} sen nome`);
    afirmar(typeof u.personalidad === 'string' && u.personalidad.length > 0, `${u.id} sen personalidade`);
  }
});

proba('os ids son únicos tamén na PRIMEIRA batalla da sesión', () => {
  /* Era o bug de mkUnit: numeraba os inimigos con `game ? ++game.enemyN : 1`
     e `game` non se asignaba ata que newBattle devolvía, así que na
     primeira batalla saían todos como K-01. Arranxado na v0.76 asignando
     o global antes de crear unidades. Compróbanse tres batallas seguidas
     porque na segunda o síntoma era distinto: numerábase co contador da
     batalla anterior. */
  const S = cargarXogo();
  for (let n = 1; n <= 3; n++) {
    const g = novaBatalla(S, { op: 2 });
    const vistos = new Map();
    for (const u of g.units) {
      afirmar(!vistos.has(u.id),
        `batalla ${n}: id ${u.id} repetido (${vistos.get(u.id)} e ${u.cls}/equipo ${u.team})`);
      vistos.set(u.id, `${u.cls}/equipo ${u.team}`);
    }
  }
});
