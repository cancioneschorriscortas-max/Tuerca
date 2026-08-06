/* ============================================================
   PLANTAS DE INTERIOR

   A proba que había antes —"toda planta escrita mide 60x34"— miraba a
   táboa de cadeas e nada máis, e arrancaba as batallas en op 0. Daba
   verde mentres pasaba todo isto:

     · applyMap recalcula COLS/ROWS co tamaño do mapa da operación
       (60x34 na primeira, 80x45 na segunda, 120x80 da terceira en
       diante). plantaAGrid enchía o resto de formigón, así que da
       operación 3 en diante o 85% do mapa era un bloque macizo.
     · O HQ inimigo caía dentro dese formigón, e en MAP1 saíase do mapa
       pola esquina inferior dereita. A proba de entón comprobaba a
       esquina SUPERIOR ESQUERDA, que era a única boa.
     · As unidades non rodeaban o edificio: perforábano. Aos 4000 pasos,
       7 de 13 vivas estaban dentro do formigón.

   Todo o que segue existe para que ningunha desas tres volva pasar sen
   que a suite se poña vermella.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, novaBatalla, avanzar, asentar } = require('./arnes.js');

const PASABLE = new Set(['.', '+', ':']);

function reixa(p) { return p.grid.map((f) => f.split('')); }

function inundar(r) {
  const filas = r.length, cols = r[0].length;
  let ini = null;
  for (let y = 0; y < filas && !ini; y++)
    for (let x = 0; x < cols && !ini; x++) if (PASABLE.has(r[y][x])) ini = [x, y];
  const vistas = new Set();
  if (!ini) return vistas;
  const cola = [ini];
  vistas.add(ini[1] * cols + ini[0]);
  while (cola.length) {
    const [cx, cy] = cola.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (ny < 0 || ny >= filas || nx < 0 || nx >= cols) continue;
      if (!PASABLE.has(r[ny][nx])) continue;
      const k = ny * cols + nx;
      if (!vistas.has(k)) { vistas.add(k); cola.push([nx, ny]); }
    }
  }
  return vistas;
}

proba('as plantas son matrices ben formadas e pechadas', async () => {
  /* Un plano feito a man tiña 34 filas correctas e trinta e dúas cun
     carácter de máis: iso desprazaría todos os muros verticais desas
     filas e non se vería ata entrar. Por iso as plantas se xeran. */
  const S = cargarXogo();
  await asentar();
  const P = S.aval('PLANTAS');
  const nomes = Object.keys(P);
  afirmar(nomes.length > 0, 'ten que haber polo menos unha planta');
  for (const nome of nomes) {
    const p = P[nome];
    afirmar(p.grid.length === p.filas, `${nome}: ${p.grid.length} filas, declaradas ${p.filas}`);
    p.grid.forEach((f, i) => {
      afirmar(f.length === p.cols, `${nome} fila ${i + 1}: mide ${f.length}, declarado ${p.cols}`);
      afirmar(/^[#.+=:]+$/.test(f), `${nome} fila ${i + 1}: caracteres fóra do alfabeto`);
    });
    const r = reixa(p);
    for (let x = 0; x < p.cols; x++)
      afirmar(!PASABLE.has(r[0][x]) && !PASABLE.has(r[p.filas - 1][x]),
        `${nome}: aberta polo bordo de arriba ou de abaixo`);
    for (let y = 0; y < p.filas; y++)
      afirmar(!PASABLE.has(r[y][0]) && !PASABLE.has(r[y][p.cols - 1]),
        `${nome}: aberta polo bordo esquerdo ou dereito`);
  }
});

proba('todo o chan dunha planta está conectado', async () => {
  const S = cargarXogo();
  await asentar();
  const P = S.aval('PLANTAS');
  for (const nome of Object.keys(P)) {
    const r = reixa(P[nome]);
    let chan = 0;
    for (const f of r) for (const c of f) if (PASABLE.has(c)) chan++;
    afirmar(inundar(r).size === chan,
      `${nome}: ${chan - inundar(r).size} celas de chan illadas — hai sala á que non se chega`);
  }
});

proba('ningunha planta ten pasos dunha soa cela', async () => {
  /* TUERCA move escuadróns, non un axente. Por un van de unha cela pasa
     a primeira unidade e as outras fan cola no van. */
  const S = cargarXogo();
  await asentar();
  const P = S.aval('PLANTAS');
  for (const nome of Object.keys(P)) {
    const p = P[nome], r = reixa(p);
    const malas = [];
    for (let y = 1; y < p.filas - 1; y++) {
      for (let x = 1; x < p.cols - 1; x++) {
        if (!PASABLE.has(r[y][x])) continue;
        const N = PASABLE.has(r[y - 1][x]), Su = PASABLE.has(r[y + 1][x]);
        const O = PASABLE.has(r[y][x - 1]), E = PASABLE.has(r[y][x + 1]);
        if ((O && E && !N && !Su) || (N && Su && !O && !E)) malas.push(`${x},${y}`);
      }
    }
    afirmar(!malas.length, `${nome}: pasos dunha cela en ${malas.slice(0, 6).join(' ')}`);
  }
});

proba('a planta manda sobre o mapa, vaia pola operación que vaia', async () => {
  /* ESTE É O FALLO QUE INVALIDABA TODO O DEMAIS. O mapa da operación
     decidía COLS/ROWS e a planta quedaba encaixada nun anaco del. */
  const S = cargarXogo();
  await asentar();
  const P = S.aval('PLANTAS');
  const T = S.aval('T');
  for (const op of [0, 1, 3]) {
    S.window._biomaPedido = 'INTERIOR';
    S.window._plantaPedida = 'NAVE';
    novaBatalla(S, { op, semente: 909 });
    const p = P.NAVE;
    afirmar(S.aval('COLS') === p.cols && S.aval('ROWS') === p.filas,
      `op ${op}: grella ${S.aval('COLS')}x${S.aval('ROWS')}, a planta é ${p.cols}x${p.filas}`);
    afirmar(S.aval('W') === p.cols * 16 && S.aval('H') === p.filas * 16,
      `op ${op}: o mapa mide ${S.aval('W')}x${S.aval('H')} e non o que ocupa a planta`);
    /* E o contido ten que ser o da planta, non formigón de recheo. */
    const gr = S.aval('TERRAIN_GRID');
    let macizo = 0;
    for (const f of gr) for (const t of f) if (t === T.GRASS) macizo++;
    const total = p.cols * p.filas;
    afirmar(macizo < total * 0.5,
      `op ${op}: o ${Math.round(macizo / total * 100)}% do mapa é formigón macizo; a planta non o enche`);
  }
});

proba('os dous HQ caen ENTEIROS en chan libre', async () => {
  /* Mirar só a esquina superior esquerda foi o que deixou pasar un HQ
     inimigo metido no formigón e, en MAP1, saído do mapa. Un HQ é un
     rectángulo de 74x84: compróbanse as catro esquinas e o centro. */
  const S = cargarXogo();
  await asentar();
  const T = S.aval('T');
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = 'NAVE';
  const g = novaBatalla(S, { op: 3, semente: 55 });
  const gr = S.aval('TERRAIN_GRID');
  const W = S.aval('W'), H = S.aval('H');
  const chan = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const t = gr[Math.floor(y / 16)] && gr[Math.floor(y / 16)][Math.floor(x / 16)];
    return t === T.ROAD || t === T.BRIDGE || t === T.RUBBLE;
  };
  g.hq.forEach((h, i) => {
    const puntos = [
      [h.x + 2, h.y + 2], [h.x + h.w - 2, h.y + 2],
      [h.x + 2, h.y + h.h - 2], [h.x + h.w - 2, h.y + h.h - 2],
      [h.x + h.w / 2, h.y + h.h / 2],
    ];
    for (const [x, y] of puntos)
      afirmar(chan(x, y), `HQ ${i} (${h.x},${h.y} ${h.w}x${h.h}) ten o punto ${Math.round(x)},${Math.round(y)} fóra do chan`);
  });
  for (const s of g.sectors) afirmar(chan(s.x, s.y), `sector ${s.id} fóra do chan`);
});

proba('ninguén nace dentro do formigón nin acaba dentro del', async () => {
  /* Aquí non hai pathfinding: unha unidade cun muro diante párase e
     dispáralle. Mentres o formigón foi destruíble, o escuadrón non
     rodeaba o edificio, perforábao — e dentro da masa non había
     colisión ningunha. Medido daquela: 7 de 13 vivas dentro. */
  const S = cargarXogo();
  await asentar();
  const T = S.aval('T');
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = 'NAVE';
  const g = novaBatalla(S, { op: 3, semente: 4242 });
  const gr = S.aval('TERRAIN_GRID');
  const dentro = (u) => {
    const f = gr[Math.floor(u.y / 16)];
    return !f || f[Math.floor(u.x / 16)] === T.GRASS || f[Math.floor(u.x / 16)] === undefined;
  };
  const nadas = g.units.filter(dentro);
  afirmar(!nadas.length, `nacen no formigón: ${nadas.map((u) => u.id + '/' + u.cls).join(' ')}`);

  avanzar(S, g, 4000);
  const metidas = g.units.filter((u) => !u.dead && dentro(u));
  afirmar(!metidas.length,
    `${metidas.length} de ${g.units.filter((u) => !u.dead).length} vivas acabaron dentro do formigón: ` +
    metidas.map((u) => `${u.id}@${Math.round(u.x)},${Math.round(u.y)}`).join(' '));
});

proba('nas seis plantas ninguén acaba dentro da parede', async () => {
  /* Non abonda con probar unha: o fallo que quedaba estaba nos GRISES,
     que nacen a trinta píxeles do bordo do mapa. Nun exterior iso é
     campo aberto; nunha planta é dentro da cortiza. Só saía en dúas das
     dezaoito combinacións, e por iso hai que percorrelas todas. */
  const S0 = cargarXogo();
  await asentar();
  const nomes = Object.keys(S0.aval('PLANTAS'));
  afirmar(nomes.length >= 4, 'o catálogo de plantas quedou curto');

  /* Dúas sementes por planta: as fugas que quedaban só saían nas
     partidas que chegaban a producir un TANQUE, e o tanque colocábase 30
     px ao lado do piloto sen comprobar nada —e o piloto vai DENTRO do
     tanque, así que ía onde fose el—. Cunha soa semente non se ve. */
  for (const nome of nomes) {
    for (const semente of [1004, 44444]) {
      const S = cargarXogo();
      await asentar();
      const T = S.aval('T');
      S.window._biomaPedido = 'INTERIOR';
      S.window._plantaPedida = nome;
      const g = novaBatalla(S, { op: 4, semente });
      const gr = S.aval('TERRAIN_GRID');
      const dentro = (u) => {
        const f = gr[Math.floor(u.y / 16)];
        return !f || f[Math.floor(u.x / 16)] === undefined || f[Math.floor(u.x / 16)] === T.GRASS;
      };
      afirmar(!g.units.some(dentro), `${nome}/${semente}: alguén nace dentro da parede`);
      avanzar(S, g, 4200);
      const metidas = g.units.filter((u) => !u.dead && dentro(u));
      afirmar(!metidas.length,
        `${nome}/${semente}: ${metidas.length} dentro da parede ` +
        `(${metidas.map((u) => u.id + (u.inside ? ' nun vehículo' : '')).join(', ')})`);
    }
  }
});

proba('o formigón non se derruba; o tabique si', async () => {
  /* A distinción é o que fai xogable un interior: a estrutura para, e o
     tabique é a decisión de abrilo. Se todo volvese ser destruíble, a
     lista de muros medraría a centos e volveríamos ao de antes. */
  const S = cargarXogo();
  await asentar();
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = 'NAVE';
  const g = novaBatalla(S, { op: 0, semente: 77 });
  afirmar(g.walls.length > 0, 'unha planta con tabiques ten que dar muros destruíbles');
  afirmar(g.walls.length < 40,
    `${g.walls.length} muros: iso é a cortiza do formigón outra vez, non os tabiques`);
  afirmar(g.walls.every((w) => w.tabique), 'todo muro dun interior ten que ser un tabique');
});

proba('se mandas unha unidade a un sitio, chega', async () => {
  /* A PROBA QUE FALTABA, e sen ela todo o demais non valía nada: pódese
     ter unha planta perfecta, os HQ ben postos e ninguén dentro dun
     muro, e que o interior siga sendo inxogable porque as unidades non
     se moven por el.

     Medido antes de arranxalo: chegaba a destino o 23% na NAVE e o 3%
     en XERADORES. O resto quedaba pegado a unha parede ata o final da
     operación. As tres causas foron: non había ruta ningunha (só un
     esvaramento por eixos), a corda tirábase mal e daba puntos aos que
     non se podía ir en liña recta, e o contador de "estou tesa"
     reiniciábase cun esvaramento de cero píxeles.

     Vai polo camiño do XOGADOR e da IA á vez, que é o mesmo: orderMove. */
  const S = cargarXogo();
  await asentar();
  const T = S.aval('T');

  for (const nome of ['NAVE', 'XERADORES']) {
    const S2 = cargarXogo();
    await asentar();
    S2.window._biomaPedido = 'INTERIOR';
    S2.window._plantaPedida = nome;
    const g = novaBatalla(S2, { op: 0, semente: 7 });
    const gr = S2.aval('TERRAIN_GRID');
    const COLS = S2.aval('COLS'), ROWS = S2.aval('ROWS');
    const orderMove = S2.aval('orderMove'), simStep = S2.aval('simStep');

    const chan = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      const t = gr[y][x];
      if (t === T.ROAD || t === T.RUBBLE || t === T.BRIDGE) chan.push({ x, y });
    }
    /* Só unha unidade e nada máis vivo: aquí mídese navegación. Unha
       unidade detida a disparar tamén está quieta, e sen illar isto a
       medida di o que un queira. */
    const u = g.units.find((x) => x.team === 0);
    g.units.length = 0; g.units.push(u);
    g.vehicles.length = 0; g.sectors.length = 0;
    g.aiTimer = 1e9; g.prod = [null, null];
    u.hp = 99999; u.max = 99999;

    let chegou = 0, total = 0;
    for (let i = 0; i < 14; i++) {
      const a = chan[(i * 977) % chan.length], b = chan[(i * 311 + 53) % chan.length];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 12) continue;
      total++;
      u.x = a.x * 16 + 8; u.y = a.y * 16 + 8;
      u.waypoints = []; u._destino = null; u.dead = false;
      const tx = b.x * 16 + 8, ty = b.y * 16 + 8;
      orderMove(u, tx, ty);
      let quieto = 0, ux = u.x, uy = u.y;
      for (let k = 0; k < 3600; k++) {
        if (g.units.length > 1) g.units.length = 1;
        simStep(g);
        if (Math.hypot(u.x - tx, u.y - ty) < 20) { chegou++; break; }
        if (Math.hypot(u.x - ux, u.y - uy) < 0.2) quieto++; else quieto = 0;
        ux = u.x; uy = u.y;
        if (quieto > 400) break;
      }
    }
    afirmar(total >= 8, `${nome}: a mostra quedou curta (${total})`);
    afirmar(chegou / total >= 0.9,
      `${nome}: só chegou a destino ${chegou} de ${total} (${Math.round(chegou / total * 100)}%). ` +
      'Un interior polo que non se pode andar non é un escenario.');
  }
});

proba('rebentar un tabique abre o paso de verdade', async () => {
  /* O formigón e os tabiques van na CACHÉ do terreo, que se pinta unha
     soa vez. Se ao derrubar un tabique só se quitase o obxecto de
     colisión, quedaría a parede debuxada e un paso invisible — que é
     peor ca non ter paso. */
  const S = cargarXogo();
  await asentar();
  const T = S.aval('T');
  S.window._biomaPedido = 'INTERIOR';
  S.window._plantaPedida = 'NAVE';
  const g = novaBatalla(S, { op: 0, semente: 31 });
  const w = g.walls.find((x) => !x.destroyed);
  afirmar(w, 'fai falla un tabique en pé');

  const inWall = S.aval('inWall');
  afirmar(inWall(g, w.x, w.y), 'un tabique en pé ten que parar a quen vaia por el');
  const gr = S.aval('TERRAIN_GRID');
  const cx = Math.floor(w.x / 16), cy = Math.floor(w.y / 16);
  afirmar(gr[cy][cx] === T.DIRT, 'un tabique ten que estar pintado como tabique');

  S.aval('damageWall')(g, w, 999);
  afirmar(w.destroyed, 'con dano de sobra ten que caer');
  afirmar(!inWall(g, w.x, w.y), 'un tabique caído non pode seguir parando a ninguén');
  afirmar(gr[cy][cx] !== T.DIRT && gr[cy][cx] !== T.GRASS,
    'a cela ten que quedar transitable e repintada, non seguir sendo parede');
  afirmar(!S.aval('macizoEn')(w.x, w.y), 'polo oco ten que poder pasarse');
});

proba('a planta xerada do Crisol non se enche de muros', async () => {
  /* T.DIRT pasou a significar TABIQUE nun interior, e buildInteriorMap
     usaba DIRT como CHAN das súas catro dependencias: o Crisol saía con
     348 obxectos de muro onde tiña catro salas. O xerador do Crisol e o
     das plantas escritas comparten alfabeto, e iso hai que protexelo. */
  const S = cargarXogo();
  await asentar();
  S.window._biomaPedido = 'INTERIOR';
  S.window._modoCrisol = true;
  const g = novaBatalla(S, { op: 2, semente: 8 });
  afirmar(g.walls.length < 60,
    `${g.walls.length} muros nun interior xerado: iso é chan convertido en parede`);
  const T = S.aval('T');
  const gr = S.aval('TERRAIN_GRID');
  let chan = 0;
  for (const f of gr) for (const t of f) if (t === T.ROAD || t === T.RUBBLE || t === T.BRIDGE) chan++;
  afirmar(chan > gr.length * gr[0].length * 0.12,
    'a planta xerada quedou sen chan transitable dabondo');
});

proba('baixo cuberta non se pinta vexetación', async () => {
  /* As "motas verdes" do chan do interior non eran unha capa perdida:
     era a cadea de `else if` da decoración (flores, herba alta, árbore
     morta) colgando do `if` da vexetación grande. Como a garda estaba
     nese `if` e non na cabeceira, con INTERIOR a condición era falsa e
     a cadea ENTRABA. Píntase a planta enteira e mírase que cor saíu. */
  const S = cargarXogo();
  await asentar();
  S.aval('(function(){ setBioma("INTERIOR"); })')();
  const grid = S.aval('plantaAGrid')('NAVE');
  afirmar(grid, 'fai falla a planta NAVE');

  const cores = new Set();
  const ctx = new Proxy({}, {
    get: (_, p) => (p === 'measureText' ? () => ({ width: 0 }) : () => {}),
    set: (_, p, v) => { if (p === 'fillStyle' && typeof v === 'string') cores.add(v.toLowerCase()); return true; },
  });
  const drawTile = S.aval('drawTile');
  const COLS = S.aval('COLS'), ROWS = S.aval('ROWS');
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(ctx, grid, x, y);

  const verdes = [...cores].filter((c) => {
    const m = /^#([0-9a-f]{6})$/.exec(c);
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, v = (n >> 8) & 255, a = n & 255;
    return v > r + 15 && v > a + 15;     /* verde de verdade, non gris */
  });
  afirmar(!verdes.length,
    `nun interior pintáronse cores vexetais: ${verdes.join(' ')}`);
});
