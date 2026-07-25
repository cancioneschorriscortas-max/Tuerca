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
