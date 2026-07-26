/* ============================================================
   REGRAS ANATÓMICAS DOS MODELOS

   As regras viven en tools/regras.js coas súas razóns. Aquí só se
   executan, para que un modelo que as incumpra faga fallar a suite
   en vez de descubrirse mirando unha folla de contacto.

   As tres que orixinaron todo isto —arma na entreperna, brazos que
   non chegan, soplete flotando— son A6, A1 e A7.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { revisar } = require('../tools/regras.js');
const { CLASES } = require('../tools/modelos.js');

/* Unha soa pasada: renderizar para as regras de lectura non é gratis. */
const RESULTADO = revisar(CLASES);

for (const grupo of ['esqueleto', 'movemento', 'lectura']) {
  proba(`os modelos cumpren as regras de ${grupo}`, () => {
    const malas = RESULTADO.filter((r) => r.grupo === grupo && r.fallo);
    afirmar(!malas.length,
      malas.map((r) => `[${r.cls} ${r.id}] ${r.nome}: ${r.fallo}`).join('\n      '));
  });
}

proba('cada regra explica por que existe', () => {
  /* Unha regra sen motivo é unha manía, e dentro de seis meses ninguén
     lembra se se pode relaxar. */
  const sen = RESULTADO.filter((r) => !r.por || r.por.length < 25);
  afirmar(!sen.length, `regras sen razón: ${[...new Set(sen.map((r) => r.id))].join(', ')}`);
});

proba('todas as clases pasan polas regras', () => {
  for (const cls of CLASES) {
    afirmar(RESULTADO.some((r) => r.cls === cls),
      `a clase ${cls} non se revisou`);
  }
});
