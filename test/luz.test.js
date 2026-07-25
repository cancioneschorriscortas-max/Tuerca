/* ============================================================
   Capa de LUZ E ATMOSFERA (js/15-luz.js).

   O arnés ten un canvas falso que engule todo o debuxo, así que
   aquí non se comproba como QUEDA —iso hai que velo cos ollos—,
   senón que a pasada se executa enteira sen lanzar en condicións
   reais de batalla: con focos, sen eles, apagada e a todas as
   horas do día. É a rede que fai falla para mexar no render.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla, avanzar } = require('./arnes.js');

const finito = (n) => typeof n === 'number' && Number.isFinite(n);

proba('o ambiente dá unha cor válida a calquera hora', () => {
  const S = cargarXogo();
  const luzAmbiente = S.aval('luzAmbiente');
  for (let h = 6; h <= 22; h += 0.25) {
    const c = luzAmbiente(h);
    afirmar(Array.isArray(c) && c.length === 3, `hora ${h}: non devolveu un RGB`);
    for (const v of c) {
      afirmar(finito(v) && v >= 0 && v <= 255, `hora ${h}: compoñente fóra de rango (${c.join(',')})`);
    }
  }
});

proba('forza 0 deixa a escena intacta (branco de multiplicación)', () => {
  const S = cargarXogo();
  const LUZ = S.aval('LUZ');
  const luzAmbiente = S.aval('luzAmbiente');
  const antes = LUZ.forza;
  LUZ.forza = 0;
  for (const h of [9, 13, 19]) {
    const c = luzAmbiente(h);
    afirmar(c.every((v) => v === 255), `hora ${h}: con forza 0 esperábase 255,255,255 e saíu ${c.join(',')}`);
  }
  LUZ.forza = antes;
});

proba('a hora segue o reloxo do mundo, e forzala mándaa', () => {
  const S = cargarXogo();
  const luzHora = S.aval('luzHora');
  const LUZ = S.aval('LUZ');
  afirmar(luzHora({ t: 0 }) === 9, `ao arrancar debía ser as 9, foi ${luzHora({ t: 0 })}`);
  afirmar(luzHora({ t: 9000 }) === 10, `tras 9000 pasos debía ser as 10, foi ${luzHora({ t: 9000 })}`);
  afirmar(luzHora({ t: 99999999 }) === 19, 'a hora ten que topar ás 19');
  LUZ.horaForzada = 18;
  afirmar(luzHora({ t: 0 }) === 18, 'a hora forzada ten prioridade');
  LUZ.horaForzada = null;
});

proba('a composición non lanza ao longo dunha batalla', () => {
  const S = cargarXogo();
  const luzComporFrame = S.aval('luzComporFrame');
  const g = novaBatalla(S, { op: 2 });
  /* Cada 120 pasos compón un frame: pasa por arranque sen focos, por
     produción, por combate con tracers e chispas, e polo final. */
  for (let i = 0; i < 40 && !g.over; i++) {
    avanzar(S, g, 120);
    luzComporFrame(g, 0.016);
  }
  afirmar(g.t > 0, 'a batalla non avanzou');
});

proba('a composición aguanta focos fóra de pantalla e zoom', () => {
  const S = cargarXogo();
  const luzComporFrame = S.aval('luzComporFrame');
  const g = novaBatalla(S, { op: 2 });
  avanzar(S, g, 600);
  /* A cámara lonxe de todo: todos os focos quedan recortados. */
  S.aval('(function(x,y){ cam.x = x; cam.y = y; })')(-5000, -5000);
  luzComporFrame(g, 0.016);
  /* E cos extremos de zoom que permite a roda. */
  for (const z of [1, 1.4, 1.8]) {
    S.aval('(function(z){ camZoom = z; })')(z);
    luzComporFrame(g, 0.016);
  }
});

proba('apagada, a composición non fai nada', () => {
  const S = cargarXogo();
  const LUZ = S.aval('LUZ');
  const luzComporFrame = S.aval('luzComporFrame');
  const g = novaBatalla(S, { op: 2 });
  avanzar(S, g, 300);
  LUZ.activa = false;
  luzComporFrame(g, 0.016);
  luzComporFrame(null, 0.016);   /* nin sequera cun estado inexistente */
  LUZ.activa = true;
});

proba('os focos saen dentro do mundo e con alfa válida', () => {
  const S = cargarXogo();
  const luzFontes = S.aval('luzFontes');
  const g = novaBatalla(S, { op: 2 });
  /* W e H hai que lelos DESPOIS: os mapas procedurais teñen tamaños
     distintos e newBattle -> applyMap redefíneos. */
  const W = S.aval('W'), H = S.aval('H');
  avanzar(S, g, 1800);   /* xa hai produción, sectores e disparos */
  const F = luzFontes(g);
  afirmar(F.length > 0, 'unha batalla en marcha debería ter algún foco');
  for (const f of F) {
    afirmar(finito(f.x) && finito(f.y), `foco con posición non finita (${f.x}, ${f.y})`);
    afirmar(finito(f.r) && f.r > 0, `foco con radio inválido: ${f.r}`);
    afirmar(finito(f.a), `foco con alfa non finita: ${f.a}`);
    afirmar(f.x > -200 && f.x < W + 200 && f.y > -200 && f.y < H + 200,
      `foco moi lonxe do mapa: (${Math.round(f.x)}, ${Math.round(f.y)})`);
  }
});
