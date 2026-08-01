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
  for (const h of [4, 9, 13, 18]) {
    const c = luzAmbiente(h);
    afirmar(c.every((v) => v === 255), `hora ${h}: con forza 0 esperábase 255,255,255 e saíu ${c.join(',')}`);
  }
  LUZ.forza = antes;
});

proba('a hora segue o reloxo do mundo, e forzala mándaa', () => {
  const S = cargarXogo();
  const luzHora = S.aval('luzHora');
  const LUZ = S.aval('LUZ');
  /* Sen horaInicio, o defecto son as 9. Con 900 ticks por hora, unha
     batalla media —4.343 ticks— percorre 4,8 horas: iso é o arco. Coa
     fórmula vella, 9.000 ticks por hora, todas remataban antes das 9,5
     e a rampa enteira era contido morto. */
  afirmar(luzHora({ t: 0 }) === 9, `ao arrancar debía ser as 9, foi ${luzHora({ t: 0 })}`);
  afirmar(luzHora({ t: 900 }) === 10, `tras 900 pasos debía ser as 10, foi ${luzHora({ t: 900 })}`);
  afirmar(luzHora({ t: 0, horaInicio: 4 }) === 4, 'unha batalla de noite arranca ás 4');
  afirmar(luzHora({ t: 4500, horaInicio: 4 }) === 9, 'de noite ás 4, cinco horas despois é de día');
  /* O tope non é un número redondo calquera: ás 19 o mapa tiña o 45,8%
     dos píxeles por debaixo de luma 32, sete veces máis ca ás 18. */
  afirmar(luzHora({ t: 99999999 }) === 18, 'a hora ten que topar ás 18');
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

proba('as tropas levan luz propia, e apágase co seu regulador', () => {
  const S = cargarXogo();
  const LUZ = S.aval('LUZ');
  const luzFontes = S.aval('luzFontes');
  const g = novaBatalla(S, { op: 2 });
  avanzar(S, g, 900);

  const vivas = g.units.filter((u) => !u.dead && !u.inside).length;
  afirmar(vivas > 0, 'non quedou ningunha unidade viva');

  const antes = LUZ.tropas;
  LUZ.tropas = 0.55;
  const conLuz = luzFontes(g).filter((f) => f.senBloom).length;
  afirmar(conLuz >= vivas, `esperábase unha luz por unidade viva (${vivas}), houbo ${conLuz}`);

  LUZ.tropas = 0;
  afirmar(luzFontes(g).filter((f) => f.senBloom).length === 0,
    'con LUZ.tropas = 0 non debería quedar ningunha luz de tropa');
  LUZ.tropas = antes;
});

proba('a luz das tropas non fai bloom (senón parecerían farois)', () => {
  const S = cargarXogo();
  const luzFontes = S.aval('luzFontes');
  const g = novaBatalla(S, { op: 2 });
  avanzar(S, g, 900);
  for (const f of luzFontes(g)) {
    /* Os focos de verdade (portas, sectores, disparos, chispas) SI
       derraman; os das tropas non. Aquí só se comproba que a marca
       existe e é coherente: nada sen marcar pode ser branco cálido. */
    if (f.c === '#ffe6c0') afirmar(f.senBloom === true, 'unha luz de tropa quedou sen marcar');
  }
});

proba('a sombra cambia de lado ao pasar o mediodía e acurta no cénit', () => {
  const S = cargarXogo();
  const sombraVector = S.aval('sombraVector');
  const LUZ = S.aval('LUZ');
  const antes = LUZ.horaForzada;

  const en = (h) => { LUZ.horaForzada = h; return sombraVector({ t: 0 }); };
  const mañá = en(9), cenit = en(14), solpor = en(19);

  afirmar(mañá.dx > 0 && solpor.dx < 0,
    `a sombra debía cambiar de lado: mañá dx=${mañá.dx.toFixed(1)}, solpor dx=${solpor.dx.toFixed(1)}`);
  afirmar(Math.abs(cenit.dx) < Math.abs(mañá.dx) && Math.abs(cenit.dx) < Math.abs(solpor.dx),
    'ao mediodía a sombra ten que ser a máis curta');
  afirmar(cenit.dy > 0 && mañá.dy > cenit.dy,
    'a sombra sempre cae algo cara abaixo, e máis co sol baixo');
  for (const v of [mañá, cenit, solpor]) {
    for (const n of [v.dx, v.dy, v.k]) {
      afirmar(finito(n), `compoñente non finita no vector de sombra: ${JSON.stringify(v)}`);
    }
  }
  LUZ.horaForzada = antes;
});

proba('as sombras non lanzan ao longo dunha batalla', () => {
  const S = cargarXogo();
  const sombrasDebuxar = S.aval('sombrasDebuxar');
  const SOMBRA = S.aval('SOMBRA');
  const g = novaBatalla(S, { op: 2 });
  for (let i = 0; i < 25 && !g.over; i++) {
    avanzar(S, g, 120);
    sombrasDebuxar(g);       /* con unidades, torretas, vehículos, muros e HQ */
  }
  SOMBRA.activa = false;
  sombrasDebuxar(g);
  SOMBRA.activa = true;
  sombrasDebuxar(null);      /* nin cun estado inexistente */
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
