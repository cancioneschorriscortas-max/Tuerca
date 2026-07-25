/* ============================================================
   CAMA DE SON (js/17-ambiente.js)

   AVISO HONESTO: aquí non se comproba como SOA. O contexto de
   audio do arnés é un proxy que engule todo, así que isto
   verifica que o grafo se monta enteiro sen lanzar, que as
   escenas se cambian ben e que a lóxica de agachado dá os
   números que ten que dar. O oído non o substitúe nada.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla, avanzar } = require('./arnes.js');

proba('a cama arranca, cambia de escena e para sen lanzar', () => {
  const S = cargarXogo();
  const iniciar = S.aval('ambienteIniciar');
  const parar = S.aval('ambienteParar');

  iniciar('hangar');
  afirmar(S.aval('_amb') !== null, 'non se montou a cama do hangar');
  afirmar(S.aval('_amb').escena === 'hangar', 'escena incorrecta');

  iniciar('batalla');
  afirmar(S.aval('_amb').escena === 'batalla', 'non cambiou a escena a batalla');

  parar();
  afirmar(S.aval('_amb') === null, 'a cama non se soltou ao parar');
});

proba('pedir a mesma escena dúas veces non remonta o grafo', () => {
  const S = cargarXogo();
  const iniciar = S.aval('ambienteIniciar');
  iniciar('batalla');
  const primeiro = S.aval('_amb');
  iniciar('batalla');
  afirmar(S.aval('_amb') === primeiro,
    'volveu montar a cama estando xa na mesma escena: cortaríase o son en cada repintado');
  S.aval('ambienteParar')();
});

proba('apagada, non monta nada', () => {
  const S = cargarXogo();
  const AMB = S.aval('AMB');
  /* 99-boot.js xa arranca a cama do hangar ao cargar, así que hai que
     soltala antes: `activo = false` impide MONTAR, non para o que xa
     está soando (diso encárgase ambienteParar, como fai a tecla). */
  S.aval('ambienteParar')();
  AMB.activo = false;
  S.aval('ambienteIniciar')('batalla');
  afirmar(S.aval('_amb') === null, 'montou a cama estando apagada');
  AMB.activo = true;
});

proba('o agachado baixa co tiroteo e volve ao soltar', () => {
  const S = cargarXogo();
  const AMB = S.aval('AMB');
  const iniciar = S.aval('ambienteIniciar');
  const tick = S.aval('ambienteTick');
  iniciar('batalla');

  const g = { tracers: [] };
  tick(g);
  const quedo = S.aval('_amb').nivel;
  afirmar(Math.abs(quedo - AMB.vol) < 0.001,
    `en silencio a cama debía estar ao volume pleno (${AMB.vol}), estaba en ${quedo}`);

  g.tracers = new Array(20).fill({});   /* pasado do tope: agachado máximo */
  tick(g);
  const baixo = S.aval('_amb').nivel;
  afirmar(baixo < quedo, `con tiroteo debía baixar: ${quedo} -> ${baixo}`);
  afirmar(baixo >= AMB.vol * 0.4,
    `agachouse de máis (${baixo}): a cama non debe desaparecer, só apartarse`);

  g.tracers = [];
  tick(g);
  afirmar(Math.abs(S.aval('_amb').nivel - quedo) < 0.001, 'non recuperou ao acabar o tiroteo');
  S.aval('ambienteParar')();
});

proba('o tick aguanta unha batalla enteira', () => {
  const S = cargarXogo();
  const tick = S.aval('ambienteTick');
  S.aval('ambienteIniciar')('batalla');
  const g = novaBatalla(S, { op: 2 });
  for (let i = 0; i < 30 && !g.over; i++) { avanzar(S, g, 120); tick(g); }
  tick(null);              /* nin sen estado */
  S.aval('ambienteParar')();
  tick(g);                 /* nin coa cama xa parada */
});
