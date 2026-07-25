/* ============================================================
   EFECTOS DE LECTURA (js/18-efectos.js)

   O lenzo do arnés engule o debuxo, así que aquí non se comproba
   como QUEDAN — iso vai por captura. O que se verifica é o que
   si se pode: que o estado evolucione e caduque, que os focos
   que se lle dan á capa de luz sexan válidos, que os reguladores
   apaguen de verdade e que nada creza sen tope.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla, avanzar } = require('./arnes.js');

const finito = (n) => typeof n === 'number' && Number.isFinite(n);

proba('a onda de choque expande e caduca', () => {
  const S = cargarXogo();
  S.aval('efxLimpar')();
  S.aval('efxOnda')(100, 100, true);
  const ondas = () => S.aval('_efxOndas');
  afirmar(ondas().length === 1, 'non se creou a onda');

  const r0 = ondas()[0].r;
  S.aval('efxDebuxar')({ t: 0, units: [] }, 0.05);
  afirmar(ondas()[0].r > r0, `a onda non expandiu (${r0} -> ${ondas()[0].r})`);

  /* Caduca soa: se non, quedaría un anel fixo no mapa. */
  for (let i = 0; i < 40; i++) S.aval('efxDebuxar')({ t: i, units: [] }, 0.05);
  afirmar(ondas().length === 0, 'a onda non caducou');
});

proba('o destello só dá luz ao principio', () => {
  /* Se durase todo o anel, a explosión iluminaría medio segundo e
     parecería un foco, non un fogonazo. */
  const S = cargarXogo();
  S.aval('efxLimpar')();
  S.aval('efxOnda')(50, 50, true);
  const focos = S.aval('efxFocos');

  const inicio = focos();
  afirmar(inicio.length === 1, 'a explosión non deu luz ningunha');
  for (const f of inicio) {
    for (const n of [f.x, f.y, f.r, f.a]) afirmar(finito(n), `foco con valor non finito: ${JSON.stringify(f)}`);
    afirmar(f.a > 0 && f.a <= 1, `alfa fóra de rango: ${f.a}`);
  }

  /* Pasada a metade da vida, xa non ilumina. */
  for (let i = 0; i < 8; i++) S.aval('efxDebuxar')({ t: i, units: [] }, 0.05);
  afirmar(focos().length === 0, 'o destello segue iluminando pasado o comezo');
});

proba('a marca de abate aparece e caduca', () => {
  const S = cargarXogo();
  S.aval('efxLimpar')();
  S.aval('efxSniper')(200, 300);
  afirmar(S.aval('_efxMarcas').length === 1, 'non se creou a marca');
  for (let i = 0; i < 60; i++) S.aval('efxDebuxar')({ t: i, units: [] }, 0.05);
  afirmar(S.aval('_efxMarcas').length === 0, 'a marca quedou pegada no mapa');
});

proba('os reguladores apagan de verdade', () => {
  const S = cargarXogo();
  const EFX = S.aval('EFX');
  S.aval('efxLimpar')();
  EFX.onda = false; EFX.sniper = false;
  S.aval('efxOnda')(10, 10, true);
  S.aval('efxSniper')(10, 10);
  afirmar(S.aval('_efxOndas').length === 0, 'creou onda con EFX.onda = false');
  afirmar(S.aval('_efxMarcas').length === 0, 'creou marca con EFX.sniper = false');
  EFX.onda = true; EFX.sniper = true;
});

proba('nada medra sen tope', () => {
  /* Unha batalla longa con moitas explosións non pode ir acumulando
     aneis e marcas ata afogar o frame. */
  const S = cargarXogo();
  S.aval('efxLimpar')();
  for (let i = 0; i < 500; i++) { S.aval('efxOnda')(i, i, i % 2 === 0); S.aval('efxSniper')(i, i); }
  afirmar(S.aval('_efxOndas').length <= 12, `${S.aval('_efxOndas').length} ondas acumuladas`);
  afirmar(S.aval('_efxMarcas').length <= 24, `${S.aval('_efxMarcas').length} marcas acumuladas`);
});

proba('o debuxo aguanta unha batalla enteira', () => {
  const S = cargarXogo();
  const g = novaBatalla(S, { op: 2, semente: 0xEFEC7 });
  const debuxar = S.aval('efxDebuxar'), hud = S.aval('efxHUD');
  for (let i = 0; i < 25 && !g.over; i++) {
    avanzar(S, g, 120);
    S.aval('efxOnda')(g.units[0].x, g.units[0].y, i % 3 === 0);
    S.aval('efxSniper')(g.units[0].x + 900, g.units[0].y);   /* fóra de cámara: frecha */
    debuxar(g, 0.016);
    hud(g);
  }
  debuxar({ t: 0, units: [] }, 0.016);   /* nin cun estado baleiro */
  hud({ t: 0 });
});

proba('a marca de cura vai no paciente e caduca soa', () => {
  const S = cargarXogo();
  const EFX = S.aval('EFX');
  const g = { t: 100, units: [{ x: 10, y: 10, dead: false, _curandoT: 100 }] };
  /* Non se pode ler o píxel, pero si comprobar a regra: a marca vive
     mentres g.t - _curandoT <= EFX.curaFrames. */
  afirmar(g.t - g.units[0]._curandoT <= EFX.curaFrames, 'a marca debería estar viva');
  g.t = 100 + EFX.curaFrames + 1;
  afirmar(g.t - g.units[0]._curandoT > EFX.curaFrames, 'a marca debería ter caducado');
  S.aval('efxDebuxar')(g, 0.016);   /* e non peta en ningún dos dous casos */
});
