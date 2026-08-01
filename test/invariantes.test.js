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
const { proba, probaPendente, afirmar } = require('./probar.js');
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
    /* Semente fixa: esta proba AFIRMA que a batalla remata, así que ao
       chou é unha lotería. As probas que só comproban invariantes ou que
       nada peta poden seguir con semente aleatoria — alí a variedade
       suma. Aquí non. */
    const g = novaBatalla(S, { op, semente: 0xA5E0 + op });
    afirmar(g.units.length > 0, 'a batalla arrancou sen unidades');
    revisarInvariantes(S, g, 'ao arrancar');
    avanzarRevisando(S, g, 120000, `op=${op} semente=${g.semente}`);
    afirmar(g.over, `a batalla non rematou en 120000 pasos (semente=${g.semente})`);
  });
}

/* SEMENTES FIXAS, non ao chou.
   Con azar, a suite era unha lotería: unha de cada oito execucións fallaba
   e a seguinte xa non, así que non se podía diagnosticar nada. Agora o
   conxunto é sempre o mesmo e calquera fallo é reproducible ao instante.
   Para saír a buscar sementes novas:  TUERCA_FUZZ=azar node test/run.js */
const SEMENTES = process.env.TUERCA_FUZZ === 'azar'
  ? Array.from({ length: 12 }, () => (Math.random() * 0x100000000) >>> 0)
  : [0x1111, 0x2222, 0x3333, 0xABCDE, 0xF00D, 0xBEEF,
     0x51CE, 0x7A11, 0xC0DE, 0x09E5, 0x1D05, 0x4B1D];

proba('fuzz: 12 batallas procedurais seguidas manteñen os invariantes', () => {
  const S = cargarXogo();
  for (let i = 0; i < SEMENTES.length; i++) {
    const g = novaBatalla(S, { op: 2, semente: SEMENTES[i] });
    avanzarRevisando(S, g, 120000, `batalla ${i + 1} semente=${g.semente}`, 120);
    afirmar(g.over, `a batalla ${i + 1} non rematou (semente=${g.semente})`);
  }
});

proba('toda batalla remata cun resultado declarado', () => {
  /* Tamén con sementes fixas. Quedara ao chou cando se fixaron as do
     fuzz, e seguía sendo unha lotería: de cando en vez pillaba a semente
     do estancamento da IA e fallaba sen que houbese nada novo roto. */
  const S = cargarXogo();
  for (let i = 0; i < 6; i++) {
    const g = novaBatalla(S, { op: 2, semente: SEMENTES[i] });
    avanzar(S, g, 120000);
    afirmar(g.over, `a batalla ${i + 1} quedou colgada (semente=${g.semente})`);
    afirmar(g.result === 'victory' || g.result === 'defeat',
      `resultado inesperado na batalla ${i + 1}: ${JSON.stringify(g.result)} (semente=${g.semente})`);
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

/* ---------- Bugs coñecidos, aínda sen arranxar ---------- */

proba('ningunha batalla se queda sen rematar', () => {
  /* ATOPADO polo fuzz e reproducible grazas ao azar sementado (v0.78).
     Nesta semente, ao cabo de 33 minutos de xogo: cero baixas, os dous
     HQ intactos e as unidades inimigas paradas.

     Estivo marcado como pendente cunha causa que resultou ser FALSA:
     dicía que as unidades arrastraban roles que xa non se podían
     completar e non volvían a libres. Ao mirar o estado real, os oito
     sectores eran do inimigo e a limpeza de roles funcionaba ben.

     A causa era outra: `mine` exclúe as unidades gornecidas (dentro
     dunha torreta ou dun vehículo) e o asalto esixía `mine.length >= 5`.
     Con nove vivas e cinco gornecidas, a IA cóntase catro e nunca
     ataca. O exército estaba enteiro; o que fallaba era o reconto.

     Arranxado contando as gornecidas para decidir se hai exército, e
     lanzando o asalto igual cando non queda NADA que facer. */
  const S = cargarXogo();
  const g = novaBatalla(S, { op: 2, semente: 1501646933 });
  avanzar(S, g, 120000);
  afirmar(g.over, 'a batalla non rematou en 120000 pasos (33 min de xogo)');
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

proba('o titorial da primeira operación sae por orde e agarda ao xogador', () => {
  /* O titorial vai pola radio durante a operación 0, e cada paso ten unha
     CONDICIÓN en vez dun temporizador: o consello de mover non aparece
     ata que hai algo seleccionado, o dos sectores ata que alguén camiña.
     Quen xa sabe xogar avanza rápido e case non le nada.

     Compróbanse as dúas metades desa idea: que cun xogador que non fai
     NADA o titorial se detén (se non, sería unha parede de texto co
     disfrace de condicións), e que cun xogador activo saen os seis por
     orde. */
  const S = cargarXogo();
  const ditas = [];
  S.aval('(function(f){ radio = f; })')((t) => ditas.push(String(t)));
  const doTitorial = () => ditas.filter(t => /ÓPTIMA/.test(t));

  const g = novaBatalla(S, { op: 0, semente: 0x1111 });
  const PT = S.aval('PT'), ET = S.aval('ET'), orderMove = S.aval('orderMove');

  /* xogador pasivo: non pasa do primeiro consello */
  avanzar(S, g, 3000);
  afirmar(doTitorial().length === 1,
    `sen tocar nada saíron ${doTitorial().length} consellos; deberían ser 1`);

  /* Xogador activo. Cúmprese CADA condición a man en vez de xogar unha
     partida e agardar a que pase: así saen os seis sempre, e non
     segundo a semente traia unha captura ou unha baixa.

     A proba pedía antes "máis de tres" despois de xogar 60.000 pasos, e
     iso dependía do azar. Ao mover unha soa tirada —a hora á que
     amence— quedaron tres e a proba caeu, sen que o titorial tivese
     nada malo. Unha proba que falla por unha semente distinta non está
     medindo o que di medir. */
  const meus = g.units.filter(u => u.team === PT && !u.dead);

  meus.forEach(u => u.sel = true);              /* 2 · mover */
  avanzar(S, g, 200);

  const secs = g.sectors || [];
  meus.forEach((u, i) => { const s = secs[i % secs.length]; if(s) orderMove(u, s.x, s.y); });
  avanzar(S, g, 200);                            /* 3 · sectores */

  if(secs[0]) secs[0].owner = PT;                /* 4 · capturado */
  avanzar(S, g, 200);

  /* 5 · disparan: un inimigo ao alcance dun dos meus */
  const inimigo = g.units.find(u => u.team === ET && !u.dead);
  const meu = g.units.find(u => u.team === PT && !u.dead);
  if(inimigo && meu){ inimigo.inside = null; inimigo.x = meu.x + 20; inimigo.y = meu.y; }
  avanzar(S, g, 200);

  /* 6 · pezas: alguén cae */
  const vivos = g.units.filter(u => u.team === PT && !u.dead);
  if(vivos.length > 1) vivos[vivos.length - 1].dead = true;
  avanzar(S, g, 200);

  const saidas = doTitorial();
  const total = S.aval('TITORIAL').length;
  afirmar(saidas.length === total,
    `cumpríronse as ${total} condicións e só saíron ${saidas.length} consellos`);

  /* A aserción forte NON é "saen os seis" —iso depende de que a semente
     traia combate e unha baixa— senón que os que saen son os PRIMEIROS
     da lista e na súa orde. Un paso que se adiante ou se salte é un fallo
     real; que a partida non chegue a ter baixas, non. */
  const orde = S.aval('TITORIAL').map(p => S.aval('TXT')('tit.' + p.id));
  saidas.forEach((liña, i) => {
    afirmar(liña.includes(orde[i]),
      `o consello ${i+1} non é o que tocaba.
      saíu:     ${liña.slice(0, 70)}
      esperado: ${String(orde[i]).slice(0, 70)}`);
  });
  for(const s of saidas)
    afirmar(!/tit\./.test(s), `consello sen traducir: ${s}`);
});

proba('o titorial non se mete nunha partida que non sexa a primeira', () => {
  /* Nunha operación normal, no Mundial ou en PvP isto sería ruído. */
  const S = cargarXogo();
  const ditas = [];
  S.aval('(function(f){ radio = f; })')((t) => ditas.push(String(t)));
  const g = novaBatalla(S, { op: 4, semente: 0x2222 });
  g.units.filter(u => u.team === S.aval('PT')).forEach(u => u.sel = true);
  avanzar(S, g, 8000);
  afirmar(ditas.filter(t => /ÓPTIMA/.test(t)).length === 0,
    'o titorial saíu nunha operación que non é a primeira');
});
