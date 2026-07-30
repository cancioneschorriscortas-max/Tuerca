/* ============================================================
   COLUMNA DE ESTADO DO HANGAR (js/16-estado.js)

   O bug que orixinou estas probas: encargabas unha reensamblaxe e o
   panel seguía dicindo "ningunha en curso". A lóxica estaba ben; o
   que fallaba é que só se repintaba ao ENTRAR no hangar
   (showHangar) e ao cambiar de idioma. Calquera cambio feito xa
   dentro deixaba o panel rancio ata saír e volver.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, asentar } = require('./arnes.js');

function montar(S) {
  const D = S.aval('DATA');
  D.units = [
    { id: 'R-01', name: 'FERRO', cls: 'GRUNT', ops: 4, activity: {} },
    { id: 'R-02', name: 'BIELA', cls: 'HEAVY', ops: 0, activity: {}, folga: { ops: 2, por: 'FERRO' } },
  ];
  D.opCount = 7;
  D.fallen = [];
  D.reconstruccion = null;
  return D;
}
const html = (S) => S.document.getElementById('estadoPanel').innerHTML;

proba('a reensamblaxe en curso amósase mentres o está', async () => {
  const S = cargarXogo();
  await asentar();   /* que remate o showHangar() do arranque */
  const D = montar(S);
  const render = S.aval('estadoRender');

  render();
  afirmar(!/est-recon/.test(html(S)), 'amosa reensamblaxe sen haber ningunha');

  /* Encargada nesta mesma operación: en curso. */
  D.reconstruccion = { rec: D.units[0], pezas: [], encargadaOp: D.opCount };
  render();
  afirmar(/est-recon/.test(html(S)), 'non amosa a reensamblaxe recén encargada');
  afirmar(html(S).includes('FERRO'), 'non di de quen é a reensamblaxe');

  /* Pasou unha operación: xa é entregable, deixa de estar "en curso". */
  D.opCount = 8;
  render();
  afirmar(!/est-recon/.test(html(S)), 'segue amosándoa despois de ser entregable');
});

proba('gardar repinta o panel sen saír do hangar', async () => {
  /* ESTE é o bug. Antes, encargar unha reensamblaxe cambiaba DATA e
     gardaba, pero o panel non se enteraba ata volver entrar. */
  const S = cargarXogo();
  await asentar();   /* que remate o showHangar() do arranque */
  const D = montar(S);
  S.aval('estadoRender')();
  afirmar(!/est-recon/.test(html(S)), 'punto de partida incorrecto');

  D.reconstruccion = { rec: D.units[0], pezas: [], encargadaOp: D.opCount };
  await S.aval('saveData')(D);
  afirmar(/est-recon/.test(html(S)),
    'tras gardar, o panel segue dicindo que non hai reensamblaxe en curso');
});

proba('os contadores tampouco quedan rancios', async () => {
  const S = cargarXogo();
  await asentar();   /* que remate o showHangar() do arranque */
  const D = montar(S);
  S.aval('estadoRender')();
  afirmar(/>2</.test(html(S)), 'non contou as dúas unidades de partida');

  D.units.push({ id: 'R-03', name: 'EIXE', cls: 'SNIPER', ops: 1, activity: {} });
  await S.aval('saveData')(D);
  {
    afirmar(/>3</.test(html(S)), 'tras gardar, o contador de unidades non subiu');
  }
});

proba('a folga cóntase e destácase', async () => {
  const S = cargarXogo();
  await asentar();   /* que remate o showHangar() do arranque */
  montar(S);
  S.aval('estadoRender')();
  afirmar(/v-alerta/.test(html(S)),
    'hai unha unidade en folga e non se marca en vermello');
});

proba('saveData segue funcionando aínda que o panel peta', async () => {
  /* O aviso non pode tumbar a persistencia: gardar é máis importante
     que pintar. */
  const S = cargarXogo();
  await asentar();
  const D = montar(S);
  S.aval('(function(){ datosCambiaron = function(){ throw new Error("boom"); }; })')();
  const ok = await S.aval('saveData')(D);
  afirmar(ok === true, 'un fallo ao repintar impediu gardar a partida');
});

proba('un robot montado chega ao roster tras a operación que ocupa o taller', () => {
  /* Denuncia do dono: "montei un robot e non está na lista para
     escoller". A pregunta era se lle cargaramos a entrega ao tocar o
     reconstructor para que amosase as pezas.

     Isto percorre o camiño enteiro —encargar, xogar unha operación,
     entregar— e comproba que a unidade acabe en DATA.units viva e sen
     nada que a agoche. É unha cadea longa (o taller ocupa unha op, a
     entrega vai no debrief) e calquera excepción polo medio faría que a
     unidade se perdese SEN erro visible: entregarReconstruccion
     constrúe o `rec` enteiro antes de metelo no roster, así que se algo
     peta antes do push, o robot esfúmase e o taller queda ocupado. */
  const s = cargarXogo();
  const D = s.DATA;
  D.units = []; D.piezas = []; D.chatarra = 500; D.opCount = 5; D.nextId = 20;

  [['CABEZA','SNIPER','CROMO'], ['CHASIS','GRUNT','FORXA'], ['BRAZO_DER','HEAVY','REMACHE']]
    .forEach((t, i) => D.piezas.push({ id:'p'+i, tipo:t[0], deCls:t[1], deNome:t[2], act:120 }));

  const rec = {
    id:'R-20', name:'PROBA', cls:'GRUNT', ops:0, kills:0, traits:[], events:[], medals:[],
    crossings:0, recoveries:0, criticalSurvivals:0, captures:0, confianza:40,
    activity:{dist:0,shots:0,kills:0,dmgTaken:0,caps:0,veh:0},
  };
  D.reconstruccion = {
    rec, encargadaOp: D.opCount, sinergia: null, desdeCero: true,
    pezas: { CABEZA: D.piezas[0], CHASIS: D.piezas[1], BRAZO: D.piezas[2] },
  };

  /* mentres non se xogue a operación, o taller segue ocupado a propósito */
  s.entregarReconstruccion([]);
  afirmar(D.units.length === 0,
    'entregouse antes de tempo: o taller ten que ocupar unha operación');
  afirmar(D.reconstruccion, 'o taller quedou libre sen entregar nada');

  /* remata a operación seguinte */
  D.opCount++;
  s.entregarReconstruccion([]);
  afirmar(D.units.length === 1,
    'a unidade non chegou ao roster tras a operación: perdeuse no taller');
  afirmar(!D.reconstruccion, 'o taller quedou ocupado despois de entregar');

  const u = D.units[0];
  afirmar(!u.dead, 'a unidade chegou morta');
  afirmar(!u.folga, 'a unidade chegou en folga e non se podería escoller');
  afirmar(u.id && u.name && u.cls, `a unidade chegou incompleta: ${JSON.stringify(u)}`);
  /* e coas pezas alleas anotadas, que é o que a fai verse reconstruída */
  afirmar(u.montaxe && u.montaxe.CABEZA === 'SNIPER' && u.montaxe.BRAZO_DER === 'HEAVY',
    `perdéronse as pezas alleas: ${JSON.stringify(u.montaxe)}`);
});

proba('unha reensamblaxe que quedou sen entregar recupérase ao entrar no hangar', async () => {
  /* A fenda: a entrega só se chama no debrief. Se a operación remata e
     esa chamada non se executa —unha excepción antes de chegar a ela,
     pechar a páxina no debrief— o robot queda nun limbo do que non hai
     saída visible: o panel do taller deixa de amosalo, porque a súa
     condición é a mesma que a da entrega e xa se cumpriu, e o roster
     tampouco o ten porque nunca se entregou. Nin nun sitio nin no outro.

     Non era teórico: o dono montou un robot e preguntou onde estaba. */
  const S = cargarXogo();
  await asentar();
  const D = S.DATA;
  D.units = [];
  D.reconstruccion = {
    rec: { id:'R-30', name:'ORFO', cls:'GRUNT', ops:0, kills:0, traits:[], events:[],
           medals:[], crossings:0, recoveries:0, criticalSurvivals:0, captures:0,
           confianza:40, activity:{dist:0,shots:0,kills:0,dmgTaken:0,caps:0,veh:0} },
    pezas: {}, encargadaOp: 5, sinergia: null, desdeCero: true,
  };
  D.opCount = 7;              /* pasaron operacións e a entrega nunca correu */

  /* Gárdase antes de chamar: showHangar empeza cun loadData(), así que
     traballa co que hai no almacenamento e non co que haxa en memoria.
     No xogo isto xa se cumpre —o estado gárdase ao encargar—, pero na
     proba hai que reproducilo ou se estaría probando outra cousa. */
  await S.aval('saveData')(D);

  await S.aval('showHangar')();

  afirmar(S.DATA.units.length === 1,
    'o robot orfo non se recuperou ao entrar no hangar: segue sen existir en ningures');
  afirmar(!S.DATA.reconstruccion, 'o taller quedou ocupado despois de recuperar');
  afirmar(S.DATA.units[0].name === 'ORFO', 'recuperouse outra cousa');
});

proba('un robot montado desde cero leva marca propia no roster', async () => {
  /* Denuncia do dono: "montei un robot e non está na lista". Estaba: o
     que non tiña era ningunha marca. A etiqueta laranxa RENACIDO só se
     lle pon a quen volve do arquivo —correcto, un robot novo non renace
     de ningures— pero non había nada que a substituíse. Chegaba cun
     nome novo ao azar, sen distintivo, e non había maneira de saber cal
     era dos sete do roster. Parecía que non chegara.

     Compróbase o que se ve, non só o dato: que a unidade quede marcada E
     que a marca chegue ao HTML do roster. */
  const S = cargarXogo();
  await asentar();
  const D = S.DATA;
  D.units = [{ id:'R-01', name:'FERRO', cls:'GRUNT', ops:4, activity:{} }];
  D.reconstruccion = {
    rec: { id:'R-20', name:'NOVATO', cls:'GRUNT', ops:0, kills:0, traits:[], events:[],
           medals:[], crossings:0, recoveries:0, criticalSurvivals:0, captures:0,
           confianza:40, activity:{dist:0,shots:0,kills:0,dmgTaken:0,caps:0,veh:0} },
    pezas: {}, encargadaOp: 5, sinergia: null, desdeCero: true,
  };
  D.opCount = 7;
  await S.aval('saveData')(D);
  await S.aval('showHangar')();

  const u = S.DATA.units.find(x => x.name === 'NOVATO');
  afirmar(u, 'o robot montado non chegou ao roster');
  afirmar(u.desdeCero, 'a unidade non lembra que se montou desde cero');
  afirmar(!u.renacido, 'marcouse como RENACIDO: un robot novo non volve de ningures');

  const html = S.document.getElementById('rosterList').innerHTML;
  const arredor = html.slice(Math.max(0, html.indexOf('NOVATO') - 200),
                             html.indexOf('NOVATO') + 800);
  afirmar(/class="tag"/.test(arredor),
    'o robot montado sae no roster sen ningunha etiqueta: non hai como distinguilo');
});

proba('as habilidades cruzadas vense no roster e explícanse na ficha', async () => {
  /* As habilidades que dá montar con pezas doutra clase anunciábanse
     UNHA VEZ, no cartel do debrief, e despois desaparecían: non estaban
     nin no roster nin na ficha. As etiquetas estaban escritas dentro da
     función que redacta o debrief, así que só existían nese intre.

     E non son cosmética: antimuro fai o DOBRE de dano a estruturas e
     vehículos. Non poder distinguir esa unidade doutra normal é perder
     información que decide unha batalla. */
  const S = cargarXogo();
  await asentar();
  const D = S.DATA;
  D.units = [
    { id:'R-01', name:'NORMAL', cls:'GRUNT', ops:4, activity:{} },
    { id:'R-02', name:'CRUZADO', cls:'GRUNT', ops:4, activity:{},
      habilidades:{ antimuro:true }, piezasDe:['MARTELO'], reconstruidoOp:6 },
  ];
  D.reconstruccion = null;
  await S.aval('saveData')(D);
  await S.aval('showHangar')();

  const html = S.document.getElementById('rosterList').innerHTML;
  const arredor = n => { const i = html.indexOf(n); return i < 0 ? '' : html.slice(i, i + 900); };
  afirmar(/ANTIMURO/.test(arredor('CRUZADO')),
    'a unidade con habilidade cruzada non a amosa no roster');
  afirmar(!/ANTIMURO/.test(arredor('NORMAL')),
    'unha unidade normal amosa unha habilidade que non ten');

  /* e na ficha, co efecto dito: unha etiqueta soa non explica nada */
  S.aval('showBiography')(D.units[1]);
  const bio = S.document.getElementById('bioBody').innerHTML;
  afirmar(/ANTIMURO/.test(bio), 'a ficha non menciona a habilidade');
  afirmar(/Dobre dano/.test(bio), 'a ficha di o nome pero non o que fai');
});

proba('as etiquetas de habilidade e sinerxía seguen o idioma', async () => {
  /* Descubriuse mirando unha captura: unha etiqueta CAZAPILOTOS en
     galego no medio dunha interface en inglés. As táboas HABILIDADES e
     SINERXIAS levaban os textos escritos a man.

     Non abonda con metelos no dicionario: teñen que resolverse ao
     PINTAR e non ao cargar o módulo, ou quedarían no idioma que houbese
     ao arrancar e cambiar de lingua non os movería. Por iso se comproba
     nas tres linguas seguidas, sen recargar. */
  const S = cargarXogo();
  await asentar();
  const D = S.DATA;
  D.units = [{ id:'R-08', name:'TORNO', cls:'ENGINEER', ops:0, activity:{},
               habilidades:{ cazapilotos:true }, sinergia:'SOLDADURA' }];
  D.reconstruccion = null;
  await S.aval('saveData')(D);

  const vistos = { hab: new Set(), sin: new Set() };
  for(const lg of ['gl', 'es', 'en']){
    S.aval('setLang')(lg, { persist:false });
    await S.aval('showHangar')();
    const h = S.document.getElementById('rosterList').innerHTML;
    const hab = h.match(/◈ ([^<]+)</);
    const sin = h.match(/✦ ([^<]+)</);
    afirmar(hab, `${lg}: non se pintou a etiqueta de habilidade`);
    afirmar(sin, `${lg}: non se pintou a etiqueta de sinerxía`);
    afirmar(!/^hab\.|^sin\./.test(hab[1]),
      `${lg}: a etiqueta amosa a clave sen traducir (${hab[1]})`);
    vistos.hab.add(hab[1].trim());
    vistos.sin.add(sin[1].trim());
  }
  /* o inglés ten que diferir: se as tres dan o mesmo, non se está
     traducindo nada aínda que as claves existan */
  afirmar(vistos.hab.size > 1, `a habilidade di o mesmo nas tres linguas: ${[...vistos.hab]}`);
  afirmar(vistos.sin.size > 1, `a sinerxía di o mesmo nas tres linguas: ${[...vistos.sin]}`);
});

proba('toda clave de tradución que o código pide existe nas tres linguas', () => {
  /* O dicionario estaba completo: o que faltaba era texto que nunca
     pasaba por TXT(). Aínda así, unha clave que se engade nunha lingua e
     se esquece nas outras non dá erro —TXT cae ao castelán, logo ao
     galego e por último á propia clave— así que o fallo aparece como
     unha frase no idioma equivocado ou como un identificador cru no
     medio da interface. Isto cázao antes.

     Descóntanse os prefixos: hai claves que se compoñen ao voo
     (TXT('hab.' + id)) e no código só se ve o anaco fixo. */
  const fs2 = require('fs'), path2 = require('path');
  const S = cargarXogo();
  const L = S.aval('LANGS');
  const dir = path2.join(__dirname, '..', 'i', 'js');
  const claves = new Set();
  for(const f of fs2.readdirSync(dir)){
    if(!f.endsWith('.js')) continue;
    const src = fs2.readFileSync(path2.join(dir, f), 'utf8');
    for(const m of src.matchAll(/TXT\(\s*'([^']+)'/g))
      if(!m[1].endsWith('.')) claves.add(m[1]);
  }
  afirmar(claves.size > 100, `só se atoparon ${claves.size} claves: revisa esta proba`);
  for(const lg of ['gl', 'es', 'en']){
    const faltan = [...claves].filter(k => !(k in L[lg]));
    afirmar(faltan.length === 0,
      `${lg}: faltan ${faltan.length} claves — ${faltan.slice(0, 6).join(', ')}`);
  }
});

proba('ÓPTIMA explica as pezas mentres fai falla, e cala cando xa non', () => {
  /* O titorial do hangar non ten lista de "consellos vistos" nin botón de
     pechar: os avisos van por diante das liñas xenéricas do comunicado e
     deixan de saír SÓS cando o xogador xa fixo a cousa. Un consello que
     se apaga porque deixou de ser certo non se pode quedar pegado nin
     precisa lembrar nada entre partidas.

     Compróbanse os tres estados: sen pezas cala, con pezas explica, e
     unha vez reconstruído deixa de explicar. */
  const S = cargarXogo();
  const D = S.aval('DATA');
  const optima = S.aval('estadoOptima');
  const c = { activas: 3, folga: 0, reconstruidos: 0 };

  D.units = [{ id:'R-01', name:'FERRO', cls:'GRUNT', ops:2, activity:{} }];
  D.piezas = []; D.iaArquivo = []; D.reconstruccion = null;
  const sen = optima(c);

  D.piezas = [{ id:'p1', tipo:'CABEZA', deCls:'HEAVY', deNome:'MARTELO' }];
  const con = optima(c);
  afirmar(con !== sen, 'con pezas no inventario di o mesmo que sen elas');
  afirmar(/DESPECE|DESPIECE|SALVAGE/i.test(con),
    `o aviso non manda ao sitio onde se usan as pezas: ${con}`);

  /* xa reconstruíu algunha vez: o consello sobra */
  D.units[0].reconstruidoOp = 3;
  afirmar(optima(c) === sen,
    'segue explicando as pezas despois de que o xogador xa reconstruíse');

  /* e cunha IA no arquivo, o aviso é o outro: hai algo que facer AGORA */
  D.units[0].reconstruidoOp = undefined;
  D.iaArquivo = [{ id:'R-09', name:'CROMO', cls:'GRUNT' }];
  const arq = optima(c);
  afirmar(arq !== con, 'cunha IA no arquivo di o mesmo que sen ela');
  afirmar(/arquivo|archivo|archive/i.test(arq), `o aviso non menciona o arquivo: ${arq}`);

  /* co taller ocupado non se insiste: xa está en marcha */
  D.reconstruccion = { rec: { name:'X' }, pezas:{}, encargadaOp: 1 };
  afirmar(optima(c) === sen, 'segue insistindo co taller xa ocupado');
});
