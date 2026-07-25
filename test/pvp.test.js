/* ============================================================
   ROBUSTEZ DO PvP (js/03-pvp-sync.js)

   Aquí non hai Firebase nin rede: o que se comproba é a LÓXICA de
   supervivencia, que é onde estaba o oco. O convidado xa vixiaba o
   host; o host non vixiaba a ninguén, así que unha lapela conxelada
   ao outro lado deixaba a partida colgada para sempre.

   Os reloxos maniféstanse a man (Date.now non se pode mover), así
   que se falsea `ultimoPulso` cara atrás para simular silencio.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla } = require('./arnes.js');

/* Monta un host con batalla en marcha e a rede falseada. */
function montarHost(S) {
  const g = novaBatalla(S, { op: 2 });
  const escrituras = [];
  S.aval('(function(p){ window._pvp = p; })')({
    rol: 'host', sala: 'PROBA', procesadas: new Set(), ordenBuf: [],
    finFeito: false, snapPend: null, ordenPend: null,
    net: {
      write: (ruta, v) => { escrituras.push({ ruta, v }); return Promise.resolve(); },
      push: (ruta, v) => { escrituras.push({ ruta, v }); return Promise.resolve(); },
      update: () => Promise.resolve(),
    },
  });
  return { g, escrituras, P: () => S.aval('window._pvp') };
}

proba('o host avisa cando o rival leva uns segundos calado', () => {
  const S = cargarXogo();
  const { g, P } = montarHost(S);
  const hostFrame = S.aval('pvpHostFrame');
  const AVISO = S.aval('PVP_AVISO_MS');

  hostFrame(g);
  afirmar(!P().avisoPulso, 'avisou de entrada, sen darlle tempo ao rival');

  /* Un chisco antes do limiar: aínda non. */
  P().ultimoPulso = Date.now() - (AVISO - 1500);
  hostFrame(g);
  afirmar(!P().avisoPulso, 'avisou antes de tempo');

  /* Pasado o limiar: aviso, e unha soa vez. */
  P().ultimoPulso = Date.now() - (AVISO + 500);
  hostFrame(g);
  afirmar(P().avisoPulso, `non avisou tras ${AVISO} ms de silencio`);
});

proba('o host dá a partida por abandonada tras silencio longo', () => {
  const S = cargarXogo();
  const { g, P } = montarHost(S);
  const hostFrame = S.aval('pvpHostFrame');
  const ABANDONO = S.aval('PVP_ABANDONO_MS');

  P().ultimoPulso = Date.now() - (ABANDONO + 1000);
  hostFrame(g);

  afirmar(g.over, 'a batalla segue viva co rival desaparecido');
  afirmar(g.result === 'victory', `esperábase vitoria por retirada, foi ${JSON.stringify(g.result)}`);
  afirmar(P().finFeito, 'non marcou o fin como feito: podería disparar dúas veces');
});

proba('o latexo do rival rearma o aviso', () => {
  /* Sen isto, un corte pasaxeiro deixaba o aviso pegado e o segundo
     corte xa non avisaba. */
  const S = cargarXogo();
  const { g, P } = montarHost(S);
  const hostFrame = S.aval('pvpHostFrame');
  const AVISO = S.aval('PVP_AVISO_MS');

  P().ultimoPulso = Date.now() - (AVISO + 500);
  hostFrame(g);
  afirmar(P().avisoPulso, 'non avisou no primeiro corte');

  /* Chega latexo: é o que fai o onValue de `pulso`. */
  P().ultimoPulso = Date.now();
  P().avisoPulso = false;
  hostFrame(g);
  afirmar(!P().avisoPulso, 'quedou o aviso posto co rival de volta');

  P().ultimoPulso = Date.now() - (AVISO + 500);
  hostFrame(g);
  afirmar(P().avisoPulso, 'non volveu avisar no segundo corte');
});

proba('o convidado latexa, pero non en cada frame', () => {
  const S = cargarXogo();
  const escrituras = [];
  S.aval('(function(p){ window._pvp = p; })')({
    rol: 'guest', sala: 'PROBA',
    net: { write: (ruta, v) => { escrituras.push(ruta); return Promise.resolve(); } },
  });
  const pulso = S.aval('pvpPulso');
  const PULSO = S.aval('PVP_PULSO_MS');

  for (let i = 0; i < 200; i++) pulso();
  afirmar(escrituras.length === 1,
    `200 frames deberían dar UN latexo, deron ${escrituras.length}: iso é tráfico de balde`);
  afirmar(/\/pulso$/.test(escrituras[0]), `escribiu na ruta equivocada: ${escrituras[0]}`);

  /* Pasado o intervalo, outro. */
  S.aval('window._pvp')._pulsoT = Date.now() - (PULSO + 100);
  pulso();
  afirmar(escrituras.length === 2, 'non volveu latexar pasado o intervalo');
});

proba('o host non latexa (só escoita)', () => {
  const S = cargarXogo();
  const { escrituras } = montarHost(S);
  const pulso = S.aval('pvpPulso');
  for (let i = 0; i < 50; i++) pulso();
  afirmar(escrituras.length === 0, 'o host púxose a latexar: iso é traballo do convidado');
});

proba('os dous lados usan os mesmos limiares', () => {
  /* Estaban a man en 03-pvp-sync.js e en 11-retratos-ui.js con números
     literais distintos de sitio. Se divirxen, un lado corta antes que o
     outro e a partida remata en desacordo. */
  const fs = require('fs');
  const bucle = fs.readFileSync('C:/tuerca/i/js/11-retratos-ui.js', 'utf8');
  afirmar(/PVP_AVISO_MS/.test(bucle) && /PVP_ABANDONO_MS/.test(bucle),
    'o watchdog do convidado volveu aos números literais en vez das constantes');
});
