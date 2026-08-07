/* ============================================================
   OPERACIÓNS DE CAMPAÑA

   A campaña non é unha escaramuza. Estas probas esixen exactamente iso:
   que unha operación non teña base inimiga, non produza unidades, non
   teña radar nin sectores, e que gañe polo que pide a misión e non por
   derrubarlle nada a ninguén.

   Escríbense porque cada unha destas cousas estaba antes cableada nun
   sitio distinto do motor: a vitoria en `tickEnd`, a produción no
   temporizador da IA, o radar na definición do mapa. Se algunha volve
   filtrarse, iso ponse vermello.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla, avanzar, asentar } = require('./arnes.js');

/* Unha operación de rescate na NAVE: tres inertes nas dependencias e
   unha garnición pequena. */
function opRescate(n = 2) {
  return {
    id: 'proba-rescate', planta: 'NAVE',
    obxectivo: { tipo: 'RESCATE', n },
    garnicion: [{ cls: 'GRUNT', n: 2, onde: 'DEPENDENCIAS' }],
    inertes: [{ cls: 'GRUNT', n: 3, onde: 'DEPENDENCIAS' }],
    gatillos: [],
  };
}

async function arrancar(S, operacion, roster) {
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = operacion.planta;
  S.window._operacion = operacion;
  return novaBatalla(S, { op: 3, semente: 99, roster });
}

proba('unha operación non ten base inimiga, nin produción, nin radar', async () => {
  const S = cargarXogo();
  await asentar();
  const g = await arrancar(S, opRescate());

  afirmar(g.senBases, 'unha operación ten que marcarse como sen bases');
  afirmar(g.hq.every(h => h.oculto), 'as bases teñen que quedar ocultas');
  afirmar(g.prod[0] === null && g.prod[1] === null, 'non pode haber cola de produción');
  afirmar(g.aiTimer > 1e8, 'o temporizador de oleadas da IA ten que estar apagado');
  afirmar(g.radar && g.radar.oculto, 'nunha nave non hai unha cúpula de radar no medio');
  afirmar(g.sectors.length === 0, 'unha operación de rescate non leva sectores');
  afirmar(g.turrets.length === 0 && g.vehicles.length === 0,
    'nin torretas nin vehículos nunha operación de interior');
});

proba('a garnición non se reforza soa', async () => {
  /* Nunha escaramuza o inimigo produce e a presión sobe. Aquí é ao
     revés a propósito: o que hai é o que se escribiu, e cada un que cae
     xa non volve. */
  const S = cargarXogo();
  await asentar();
  const g = await arrancar(S, opRescate());
  const inimigosAoEmpezar = g.units.filter(u => u.team === 1).length;
  afirmar(inimigosAoEmpezar === 2, `esperábanse 2 da garnición, hai ${inimigosAoEmpezar}`);
  avanzar(S, g, 4000);
  const inimigosDespois = g.units.filter(u => u.team === 1).length;
  afirmar(inimigosDespois === inimigosAoEmpezar,
    `apareceron ${inimigosDespois - inimigosAoEmpezar} inimigos que ninguén pediu`);
});

proba('unha unidade inerte non se move nin dispara ata que a ergues', async () => {
  const S = cargarXogo();
  await asentar();
  const g = await arrancar(S, opRescate());
  const inertes = g.units.filter(u => u.inerte);
  afirmar(inertes.length === 3, `esperábanse 3 inertes, hai ${inertes.length}`);
  const pos = inertes.map(u => ({ x: u.x, y: u.y }));
  avanzar(S, g, 600);
  inertes.forEach((u, i) => {
    if (u.dead) return;
    afirmar(Math.hypot(u.x - pos[i].x, u.y - pos[i].y) < 2,
      `${u.id} moveuse estando inerte`);
  });
});

proba('un ENGINEER ergue un inerte e pasa a ser teu', async () => {
  /* É a mecánica enteira de RESCATE: sen isto non hai operación de
     rescate, hai unha visita a unha sala. */
  const S = cargarXogo();
  await asentar();
  const roster = require('./arnes.js').crearRoster(S, 2, ['ENGINEER', 'ENGINEER']);
  const g = await arrancar(S, opRescate(1), roster);

  const eng = g.units.find(u => u.team === 0 && u.cls === 'ENGINEER');
  const inerte = g.units.find(u => u.inerte);
  afirmar(eng && inerte, 'fai falla un ENGINEER e un inerte');

  /* Pégase o enxeñeiro ao inerte e mantense aí. */
  const simStep = S.aval('simStep');
  for (let i = 0; i < 260 && !g.over; i++) {
    eng.x = inerte.x + 10; eng.y = inerte.y;
    eng.tx = eng.x; eng.ty = eng.y; eng.waypoints = [];
    eng.hp = eng.max;
    simStep(g);
  }
  afirmar(!inerte.inerte, 'o inerte tiña que quedar erguido');
  afirmar(inerte.team === 0, 'ao erguelo pasa a ser do xogador');
  afirmar(g.rescatados >= 1, `o contador de rescatados quedou en ${g.rescatados}`);
});

proba('a operación gáñase polo obxectivo, non por tirar nada', async () => {
  const S = cargarXogo();
  await asentar();
  const roster = require('./arnes.js').crearRoster(S, 2, ['ENGINEER', 'ENGINEER']);
  const g = await arrancar(S, opRescate(1), roster);
  const eng = g.units.find(u => u.team === 0 && u.cls === 'ENGINEER');
  const inerte = g.units.find(u => u.inerte);
  const simStep = S.aval('simStep');
  for (let i = 0; i < 400 && !g.over; i++) {
    if (inerte.inerte) { eng.x = inerte.x + 10; eng.y = inerte.y; eng.tx = eng.x; eng.ty = eng.y; }
    eng.hp = eng.max;
    simStep(g);
  }
  afirmar(g.over, 'a operación tiña que rematar ao cumprir o obxectivo');
  afirmar(g.result === 'victory', `resultado ${g.result}, esperábase victory`);
  afirmar(g.hq[1].hp > 0, 'e sen tocarlle unha base a ninguén');
});

proba('quedar sen ninguén é a derrota, e o único que a é', async () => {
  const S = cargarXogo();
  await asentar();
  const g = await arrancar(S, opRescate(3));
  for (const u of g.units) if (u.team === 0) u.dead = true;
  avanzar(S, g, 4);
  afirmar(g.over && g.result === 'defeat',
    `sen ninguén vivo tiña que ser derrota; foi over=${g.over} result=${g.result}`);
});

proba('unha operación de extracción cóntaas ao saír, e o que sae non morre', async () => {
  const S = cargarXogo();
  await asentar();
  const g = await arrancar(S, {
    id: 'proba-extraccion', planta: 'NAVE',
    obxectivo: { tipo: 'EXTRACCION', n: 2 },
    saida: 'ESPINA', garnicion: [], inertes: [], gatillos: [],
  });
  const meus = g.units.filter(u => u.team === 0 && !u.dead);
  afirmar(meus.length >= 2, 'fai falla escuadrón para extraer');
  const saida = S.aval('PLACES').find(p => p.id === 'ESPINA');
  afirmar(saida, 'a planta ten que declarar o lugar de saída');

  const simStep = S.aval('simStep');
  for (let i = 0; i < 300 && !g.over; i++) {
    meus[0].x = saida.x; meus[0].y = saida.y;
    if (g.extraidos >= 1) { meus[1].x = saida.x; meus[1].y = saida.y; }
    simStep(g);
  }
  afirmar(g.extraidos >= 2, `extraídos ${g.extraidos}, esperábanse 2`);
  afirmar(meus[0].extraido && !meus[0].dead,
    'quen sae do edificio non morre: sae, que é o contrario');
  afirmar(g.result === 'victory', `resultado ${g.result}`);
});

proba('a orde de traballo di a mecánica sen dicir a mecánica', async () => {
  /* A pantalla de antes de entrar non pode ser un panel que poña
     "OBXECTIVO: RESCATE — erguer 3": iso é a mecánica espida e ademais
     non a di ninguén, porque ninguén fala así dentro do mundo. Ten que
     ser unha orde de traballo de ÓPTIMA.

     O que se esixe aquí é que, dita como a diría a empresa, siga
     levando TODO o que fai falla para xogar: que hai que facer, cantos,
     e que clase se precisa. */
  const S = cargarXogo();
  await asentar();
  S.aval('opOrdeDeTraballo')({
    id: 'proba', planta: 'NAVE',
    obxectivo: { tipo: 'RESCATE', n: 3 },
  }, () => {});

  /* A caixa créase con createElement e péndurase do body, e no arnés o
     body non garda fillos: pídese á propia función, que a cachea. */
  const html = String(S.aval('opCaixaOrde')().innerHTML || '');
  afirmar(html.length > 100, 'a orde de traballo non se debuxou');

  /* Leva o que fai falla para xogar… */
  afirmar(/\b3\b/.test(html), 'a orde ten que dicir cantos son');
  afirmar(html.includes('ENGINEER'), 'a orde ten que dicir que clase fai falla');
  /* …e non leva a mecánica espida. */
  afirmar(!/OBXECTIVO\s*:/i.test(html), 'iso é un panel de misión, non unha orde');
  afirmar(!html.includes('RESCATE'), 'o nome interno do obxectivo non pode saír na pantalla');
  /* E ten as dúas voces: a da empresa e a da marxe. */
  afirmar(/ORDE DE TRABALLO|ORDEN DE TRABAJO|WORK ORDER/.test(html),
    'ten que lerse como un formulario de ÓPTIMA');
  afirmar(html.includes('Non son tres chasis') || html.includes('No son tres chasis')
       || html.includes('not three chassis'),
    'falta a nota da marxe: sen a segunda voz é un parte de traballo, non unha escena');
});

proba('un diálogo de operación para a simulación', async () => {
  /* Se unha liña importa non pode pasar por riba dun tiroteo. O bucle
     de xogo consulta esta bandeira; aquí compróbase que se pon e que se
     quita, que é o que evita deixar o xogo conxelado no hangar. */
  const S = cargarXogo();
  await asentar();
  await arrancar(S, {
    id: 'proba-dialogo', planta: 'NAVE',
    obxectivo: { tipo: 'DEFENSA', ata: 600 },
    garnicion: [], inertes: [], gatillos: [],
    entrada: [{ voz: 'HQ', txt: 'Operación de rutina.' }],
  });
  afirmar(S.window._opPausa === true, 'un diálogo de entrada ten que parar a imaxe');
  S.aval('opLimpar')();
  afirmar(!S.window._opPausa, 'e ao limpar a operación ten que soltala');
});

proba('a operación 1 non ten un só hostil', async () => {
  /* Non é un descoido, é a regra: as unidades de TUERCA disparan soas a
     calquera hostil en rango, así que "o xogador aínda non matou a
     ninguén" só é certo con CERO inimigos. Poucos non abonda. */
  const S = cargarXogo();
  await asentar();
  const op = S.aval('campanaOperacion')(1);
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = op.planta;
  S.window._operacion = op;
  const g = novaBatalla(S, { op: 0, semente: 11 });

  afirmar(g.units.filter((u) => u.team === 1).length === 0,
    'a primeira misión non pode ter ningún inimigo');
  afirmar(g.sectors.length === 0, 'nin sectores');
  afirmar(g.radar.oculto, 'nin radar');
  afirmar(g.hq.every((h) => h.oculto), 'nin bases');

  const inertes = g.units.filter((u) => u.inerte);
  afirmar(inertes.length === 5, `esperábanse 5 desconectados, hai ${inertes.length}`);
  const estados = new Set(inertes.map((u) => u.estadoInerte));
  afirmar(estados.has('PERDIDA') && estados.has('ASUSTADA') && estados.has('ATRAPADA'),
    `faltan estados: ${[...estados].join(',')}`);
  afirmar(inertes.filter((u) => u.senArma).length === 1,
    'o que estaba intentando liberar a outro non pode ter arma: por iso non podía');
  afirmar(g.remains.filter((r) => r.escenario).length > 0,
    'faltan os restos vellos do camiño de volta');
});

proba('un desconectado asustado afástase, e deixa de facelo cos xa recuperados', async () => {
  /* É o único comportamento novo da misión, e o que fai que atopar non
     abonde: hai que interceptar. E a regra que o pecha —dos recuperados
     non foxen— é o tema do xogo dito só con movemento. */
  const S = cargarXogo();
  await asentar();
  const op = S.aval('campanaOperacion')(1);
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = op.planta;
  S.window._operacion = op;
  const g = novaBatalla(S, { op: 0, semente: 11 });

  const asu = g.units.find((u) => u.inerte && u.estadoInerte === 'ASUSTADA');
  const meu = g.units.find((u) => u.team === 0 && !u.dead);
  afirmar(asu && meu, 'fai falla un asustado e unha unidade propia');

  const simStep = S.aval('simStep');
  /* Achégase un descoñecido: ten que afastarse. */
  const antes = { x: asu.x, y: asu.y };
  for (let i = 0; i < 90; i++) {
    meu.x = asu.x - 30; meu.y = asu.y;
    meu.tx = meu.x; meu.ty = meu.y; meu.waypoints = [];
    simStep(g);
  }
  const fuxiu = Math.hypot(asu.x - antes.x, asu.y - antes.y);
  afirmar(fuxiu > 4, `non fuxiu: moveuse ${fuxiu.toFixed(1)} px`);

  /* Agora o mesmo, pero quen se achega xa é un recuperado. */
  meu.recuperado = true;
  const antes2 = { x: asu.x, y: asu.y };
  for (let i = 0; i < 90; i++) {
    meu.x = asu.x - 30; meu.y = asu.y;
    meu.tx = meu.x; meu.ty = meu.y; meu.waypoints = [];
    simStep(g);
  }
  const quieto = Math.hypot(asu.x - antes2.x, asu.y - antes2.y);
  afirmar(quieto < 2, `dun dos seus non pode fuxir; moveuse ${quieto.toFixed(1)} px`);
});

proba('un atrapado non se ergue mentres teña os cascallos enriba', async () => {
  const S = cargarXogo();
  await asentar();
  const op = S.aval('campanaOperacion')(1);
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = op.planta;
  S.window._operacion = op;
  const g = novaBatalla(S, { op: 0, semente: 11 });

  const atr = g.units.find((u) => u.inerte && u.estadoInerte === 'ATRAPADA');
  const meu = g.units.find((u) => u.team === 0 && !u.dead);
  afirmar(atr && meu, 'fai falla un atrapado');
  /* Ponse un cascallo xusto enriba del e mantense o rescatador ao lado
     todo o tempo que faría falla para erguelo. */
  g.walls.push({ x: atr.x, y: atr.y, hp: 150, max: 150, destroyed: false, tabique: true });
  const simStep = S.aval('simStep');
  const rescatados0 = g.rescatados || 0;
  for (let i = 0; i < 260; i++) {
    meu.x = atr.x + 10; meu.y = atr.y; meu.tx = meu.x; meu.ty = meu.y;
    meu.hp = meu.max;
    simStep(g);
  }
  afirmar((g.rescatados || 0) === rescatados0,
    'cos cascallos enriba non se pode erguer a ninguén: primeiro hai que quitalos');
});
