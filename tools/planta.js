#!/usr/bin/env node
/* ============================================================
   PLANTA — xerador de plantas de interior.

   POR QUE EXISTE. Un plano feito a man tiña 34 filas correctas e
   trinta e dúas cun carácter de máis; iso desprazaría todos os muros
   verticais desas filas e ninguén o vería ata entrar. Unha planta é
   unha matriz, e as matrices non se escriben a man.

   O QUE XERA, e por que así. Probouse antes cunha partición BSP: dá
   salas de tamaños arbitrarios e lese como unha casa grande. Unha
   planta industrial non é iso. É unha ESPIÑA —un corredor que a
   percorre enteira—, unha NAVE a un lado, e dependencias ao outro.
   Ese esquema xera sempre algo recoñecible, e ademais está conectado
   por construción: non hai que rezar para que a inundación saia ben.

   O QUE GARANTE, e compróbase antes de escribir nada:
     · dimensións exactas, todas as filas iguais
     · só os caracteres do alfabeto, e o bordo pechado
     · TODO O CHAN CONECTADO
     · nada de pasos dunha soa cela. TUERCA move escuadróns, non un
       axente: por un van de un pasa a primeira unidade e as outras
       fan cola. Todo paso mide dúas celas
     · fondeadeiros de verdade para os HQ e os sectores. O HQ mide
       74x84 px, que son 4,6 x 5,25 celas: buscar "chan arredor do
       punto" non abondaba e o HQ inimigo acababa dentro dun muro

   ALFABETO
     #  macizo      estrutura do edificio. Non se pasa, non se derruba.
     .  chan        transitable.
     +  porta       transitable; píntase como reixa metálica.
     =  tabique     muro DESTRUÍBLE, doutro material á vista, porque o
                    xogador ten que poder distinguir o que pode abrir.
     :  escombro    chan transitable, sucio. Só é aparencia.

   USO
     node tools/planta.js --listar
     node tools/planta.js NAVE                 (xera e amosa)
     node tools/planta.js --todas --escribir   (reescribe o ficheiro)

   Con --escribir reescribe i/js/07b-plantas.js ENTEIRO, e só se todas
   pasan. Ese ficheiro é xerado: non se edita a man, edítase este.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'i', 'js', '07b-plantas.js');

/* ---------- Azar reproducible ----------
   Con Math.random() o ficheiro xerado cambiaría en cada execución sen
   que ninguén tocase nada, e un commit non diría nada. */
function azar(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Reixa ---------- */
const MACIZO = '#', CHAN = '.', PORTA = '+', TABIQUE = '=', ESCOMBRO = ':';
const PASABLE = new Set([CHAN, PORTA, ESCOMBRO]);

const reixaChea = (cols, filas, c) =>
  Array.from({ length: filas }, () => new Array(cols).fill(c));
const dentro = (r, x, y) => y >= 0 && y < r.length && x >= 0 && x < r[0].length;
function encher(r, x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) if (dentro(r, x, y)) r[y][x] = c;
}

/* Inundación desde a primeira cela transitable. */
function alcanzables(r) {
  const filas = r.length, cols = r[0].length;
  let inicio = null;
  for (let y = 0; y < filas && !inicio; y++)
    for (let x = 0; x < cols && !inicio; x++) if (PASABLE.has(r[y][x])) inicio = [x, y];
  const vistas = new Set();
  if (!inicio) return vistas;
  const cola = [inicio];
  vistas.add(inicio[1] * cols + inicio[0]);
  while (cola.length) {
    const [cx, cy] = cola.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!dentro(r, nx, ny) || !PASABLE.has(r[ny][nx])) continue;
      const k = ny * cols + nx;
      if (!vistas.has(k)) { vistas.add(k); cola.push([nx, ny]); }
    }
  }
  return vistas;
}

/* ============================================================
   FONDEADEIROS — onde cabe unha estrutura.

   Búscanse ocos co RADIO real da cousa que vai ir dentro, porque a
   coordenada é o CENTRO e a estrutura sae del cara aos catro lados.
   ============================================================ */
function ocosCon(r, radio) {
  const out = [];
  for (let y = radio; y < r.length - radio; y++) {
    for (let x = radio; x < r[0].length - radio; x++) {
      let vale = true;
      for (let dy = -radio; dy <= radio && vale; dy++)
        for (let dx = -radio; dx <= radio && vale; dx++)
          if (!PASABLE.has(r[y + dy][x + dx])) vale = false;
      if (vale) out.push({ x, y });
    }
  }
  return out;
}
const lonxe = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* Dispersión de Mitchell: cada punto novo vai ao oco máis lonxe de
   todo o xa colocado. Sen isto os sectores amoréanse na mesma sala. */
function repartir(ocos, xaPostos, cantos, minSep) {
  const postos = xaPostos.slice(), saca = [];
  for (let i = 0; i < cantos; i++) {
    let mellor = null, d = -1;
    for (const o of ocos) {
      let min = Infinity;
      for (const p of postos) min = Math.min(min, lonxe(o, p));
      if (min > d) { d = min; mellor = o; }
    }
    if (!mellor || d < minSep) break;
    saca.push(mellor); postos.push(mellor);
  }
  return saca;
}

/* ============================================================
   XERAR UNHA PLANTA

   Todo o traballo é nun sistema de coordenadas "ao longo / a través"
   da espiña, así que a mesma rutina serve para unha espiña vertical e
   para unha horizontal sen escribila dúas veces.
   ============================================================ */
function xerar(cfg) {
  const { nome, cols, filas, semente,
          sectores: nSectores = 4, tabiques = 3, etiquetas = {} } = cfg;
  const rnd = azar(semente);
  const r = reixaChea(cols, filas, MACIZO);

  const M = 2;                       /* cortiza exterior; unha soa cela lese como raia */
  const vertical = filas > cols;     /* a espiña percorre o lado LONGO da planta */
  const ESPINA = 3;                  /* tres celas: pasa un escuadrón e sóbralle unha */

  /* Marco interior en coordenadas do mapa. */
  const ix = M, iy = M, iw = cols - M * 2, ih = filas - M * 2;
  /* "a través" é o eixo perpendicular á espiña. */
  const grosoTotal = vertical ? iw : ih;
  const longoTotal = vertical ? ih : iw;

  /* A espiña vai entre o 38% e o 56% do groso. Nunca no medio exacto:
     unha planta simétrica lese como un taboleiro.

     E vai entre DOUS MUROS. Proba anterior: sen eles, a nave abría á
     espiña por todo o longo, as dúas fundíanse nunha explanada do 78%
     do mapa e o corredor deixaba de existir. Un corredor só é un
     corredor se ten paredes. */
  const espinaOff = Math.floor(grosoTotal * (0.38 + rnd() * 0.18));
  const muroA = espinaOff - 1, muroB = espinaOff + ESPINA;
  const ladoA = { ini: 0, gro: muroA };
  const ladoB = { ini: muroB + 1, gro: grosoTotal - muroB - 1 };
  /* A nave é sempre o lado groso: unha instalación ten unha nave e
     anexos, non dúas metades iguais. */
  const nave = ladoA.gro >= ladoB.gro ? ladoA : ladoB;
  const deps = nave === ladoA ? ladoB : ladoA;

  /* --- Escritura en coordenadas locais --- */
  /* (ao, at) = ao longo da espiña, a través dela. */
  const pon = (ao, at, c) => {
    const x = vertical ? ix + at : ix + ao;
    const y = vertical ? iy + ao : iy + at;
    if (dentro(r, x, y)) r[y][x] = c;
  };
  const bloque = (ao0, at0, largo, groso, c) => {
    for (let a = ao0; a < ao0 + largo; a++)
      for (let t = at0; t < at0 + groso; t++) pon(a, t, c);
  };

  /* --- A espiña --- */
  const portas = [];
  bloque(0, espinaOff, longoTotal, ESPINA, CHAN);

  /* --- A nave --- */
  bloque(0, nave.ini, longoTotal, nave.gro, CHAN);
  /* PORTÓNS á espiña: tres celas de ancho, dous ou tres deles. Un só
     converte a nave nunha ratoeira e nunha cola de unidades. */
  const muroNave = nave === ladoA ? muroA : muroB;
  const nPortons = 2 + (rnd() < 0.5 ? 1 : 0);
  for (let i = 0; i < nPortons; i++) {
    const a = Math.floor(longoTotal * ((i + 1) / (nPortons + 1))) - 1;
    for (let k = 0; k < 3; k++) pon(a + k, muroNave, PORTA);
  }
  /* Os PORTÓNS non entran na lista de portas a propósito: un portón con
     dous terzos tapiados deixa un paso dunha cela, e iso é exactamente o
     que non pode haber. Os tabiques van só nas portas das salas. */

  /* ANEXO no fondo da nave: un cuarto pechado cunha soa porta. Sen el a
     nave é unha explanada do tamaño de media planta, e unha explanada
     non dá nin cobertura nin decisións. */
  {
    const largo = Math.floor(longoTotal * (0.20 + rnd() * 0.10));
    /* Pegado ao bordo, non a unha cela del: unha columna de chan de un
       entre o anexo e a cortiza é un paso polo que non cabe ninguén. */
    const a0 = rnd() < 0.5 ? 0 : longoTotal - largo;
    const gro = Math.max(4, nave.gro - 3);
    const t0 = nave === ladoA ? nave.ini : nave.ini + nave.gro - gro;
    for (let a = a0; a < a0 + largo; a++) for (let t = t0; t < t0 + gro; t++) pon(a, t, MACIZO);
    /* Ocádeo por dentro deixando unha cortiza dunha cela: o que queda é
       unha sala, non un bloque. */
    for (let a = a0 + 1; a < a0 + largo - 1; a++)
      for (let t = t0 + 1; t < t0 + gro - 1; t++) pon(a, t, CHAN);
    /* Unha porta de dúas celas no lado que dá á nave. */
    const tPorta = nave === ladoA ? t0 + gro - 1 : t0;
    const aPorta = a0 + Math.floor(largo / 2) - 1;
    pon(aPorta, tPorta, PORTA); pon(aPorta + 1, tPorta, PORTA);
    portas.push({ ao: aPorta, at: tPorta });
  }
  /* Machóns: unha nave baleira non ten onde cubrirse nin que rodear. */
  const nMachons = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < nMachons; i++) {
    const largo = 3 + Math.floor(rnd() * 4), groso = 2 + Math.floor(rnd() * 2);
    const a0 = 5 + Math.floor(rnd() * Math.max(1, longoTotal - largo - 10));
    const t0 = nave.ini + 2 + Math.floor(rnd() * Math.max(1, nave.gro - groso - 4));
    bloque(a0, t0, largo, groso, MACIZO);
  }

  /* --- As dependencias: unha ringleira de salas ao longo da espiña ---
     Se o lado é fondo, párteo en DÚAS ringleiras cun corredor
     transversal no medio: dá un segundo camiño e evita que a metade
     exterior sexa un fondo de saco. */
  /* Trabállase en `d` = celas de distancia desde o muro da espiña cara
     a fóra. Así o mesmo código vale estea o lado das dependencias antes
     ou despois da espiña, que é o que decide o azar. */
  const depsDespois = deps.ini > espinaOff;
  const muroDeps = depsDespois ? muroB : muroA;
  const at = (d) => depsDespois ? muroDeps + 1 + d : muroDeps - 1 - d;

  const atallos = [];
  const bandas = [];
  if (deps.gro >= 13) {
    const g1 = Math.floor((deps.gro - 3) / 2);
    bandas.push({ d0: 0, gro: g1, abre: -1 });
    for (let k = 0; k < 2; k++) bloque(0, at(g1 + k), longoTotal, 1, CHAN);   /* corredor transversal */
    bandas.push({ d0: g1 + 3, gro: deps.gro - g1 - 3, abre: g1 + 2 });
  } else {
    bandas.push({ d0: 0, gro: deps.gro, abre: -1 });
  }

  for (const banda of bandas) {
    if (banda.gro < 4) continue;
    for (let k = 0; k < banda.gro; k++) bloque(0, at(banda.d0 + k), longoTotal, 1, CHAN);
    /* Cortes ao longo: paredes de UNHA cela entre sala e sala. O tamaño
       mínimo é 7 para que unha sala siga sendo unha sala. */
    let a = 0;
    const cortes = [];
    while (a < longoTotal) {
      const largo = 7 + Math.floor(rnd() * 6);
      a += largo;
      if (a >= longoTotal - 7) break;
      cortes.push(a);
      a += 1;
    }
    for (const c of cortes) {
      for (let k = 0; k < banda.gro; k++) pon(c, at(banda.d0 + k), MACIZO);
      /* Guárdase o muro medianeiro: é o sitio natural dun tabique, e
         alí abrir un burato é un ATALLO entre dúas salas, nunca a única
         vía —as dúas xa teñen porta ao corredor—. */
      if (banda.gro >= 5) atallos.push({ ao: c, at: at(banda.d0 + 2) });
    }

    /* Cada sala abre por unha porta de DÚAS celas ao muro que a separa
       do corredor que lle toca. */
    const abreEn = at(banda.abre);
    const bordos = [0, ...cortes, longoTotal];
    for (let i = 0; i < bordos.length - 1; i++) {
      const ini = i === 0 ? 0 : bordos[i] + 1, fin = bordos[i + 1];
      const ancho = fin - ini;
      if (ancho < 4) continue;
      const p = ini + Math.floor(ancho / 2) - 1;
      pon(p, abreEn, PORTA); pon(p + 1, abreEn, PORTA);
      portas.push({ ao: p, at: abreEn });
    }
  }

  /* --- Escombro en montóns, non en sal e pementa --- */
  for (let i = 0; i < 3 + Math.floor(rnd() * 4); i++) {
    const a0 = Math.floor(rnd() * longoTotal), t0 = nave.ini + Math.floor(rnd() * nave.gro);
    for (let j = 0; j < 4 + Math.floor(rnd() * 6); j++) {
      const a = a0 + Math.floor(rnd() * 4) - 1, t = t0 + Math.floor(rnd() * 4) - 1;
      const x = vertical ? ix + t : ix + a, y = vertical ? iy + a : iy + t;
      if (dentro(r, x, y) && r[y][x] === CHAN) r[y][x] = ESCOMBRO;
    }
  }

  /* --- Conectar o que quedase illado ---
     Por construción non debería quedar nada, pero un machón mal posto
     pode tapar unha boca. Compróbase e ábrese en vez de confiar. */
  for (let intento = 0; intento < 30; intento++) {
    const vistas = alcanzables(r);
    const illadas = [];
    for (let y = 0; y < filas; y++)
      for (let x = 0; x < cols; x++)
        if (PASABLE.has(r[y][x]) && !vistas.has(y * cols + x)) illadas.push({ x, y });
    if (!illadas.length) break;
    let feito = false;
    for (const c of illadas) {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const mx = c.x + dx, my = c.y + dy, ox = c.x + dx * 2, oy = c.y + dy * 2;
        if (!dentro(r, ox, oy) || r[my][mx] !== MACIZO || !PASABLE.has(r[oy][ox])) continue;
        if (!vistas.has(oy * cols + ox)) continue;
        /* Porta de dúas celas, perpendicular ao paso. */
        r[my][mx] = PORTA;
        const px = mx + (dx ? 0 : 1), py = my + (dx ? 1 : 0);
        if (dentro(r, px, py) && r[py][px] === MACIZO) r[py][px] = PORTA;
        feito = true; break;
      }
      if (feito) break;
    }
    if (!feito) { for (const c of illadas) r[c.y][c.x] = MACIZO; }
  }

  /* --- Tabiques ---
     Muros destruíbles: dan ao BOMBARDERO algo que facer e ao xogador
     unha decisión —rodear ou abrir—.

     PROBOUSE ANTES nas portas das salas e non se colocaba NINGÚN: cada
     sala ten unha soa porta, así que tapiala illa a sala e a
     comprobación desfacíao sempre. Un tabique só ten sentido onde xa
     hai outro camiño, e iso é o muro MEDIANEIRO entre dúas salas
     veciñas: abrilo é un atallo, nunca a única saída. */
  let postos = 0;
  const celaDe = (ao, at) => vertical ? { x: ix + at, y: iy + ao } : { x: ix + ao, y: iy + at };
  for (const p of atallos) {
    if (postos >= tabiques) break;
    /* O muro medianeiro ten unha cela de groso ao longo de `ao`; o oco
       ábrese a través, e mide dúas celas coma todo o demais. */
    const cs = [celaDe(p.ao, p.at), celaDe(p.ao, p.at + 1)];
    if (cs.some(c => !dentro(r, c.x, c.y) || r[c.y][c.x] !== MACIZO)) continue;
    /* Ten que ter sala aos dous lados; se non, non é medianeira. */
    const lados = [celaDe(p.ao - 1, p.at), celaDe(p.ao + 1, p.at)];
    if (lados.some(c => !dentro(r, c.x, c.y) || !PASABLE.has(r[c.y][c.x]))) continue;
    for (const c of cs) r[c.y][c.x] = TABIQUE;
    postos++;
  }

  /* --- Fondeadeiros --- */
  const ocosHQ = ocosCon(r, 4);     /* HQ 74x84 px = 4,6 x 5,25 celas */
  const ocosSec = ocosCon(r, 3);    /* sector, raio 54 px = 3,4 celas */
  let hq = [];
  if (ocosHQ.length >= 2) {
    let mellor = [ocosHQ[0], ocosHQ[ocosHQ.length - 1]], d = lonxe(mellor[0], mellor[1]);
    for (const a of ocosHQ) for (const b of ocosHQ) {
      const dd = lonxe(a, b);
      if (dd > d) { d = dd; mellor = [a, b]; }
    }
    hq = mellor;
  }
  const sectores = repartir(ocosSec, hq, nSectores, 8);

  /* --- Lugares con nome ---
     placeAt() busca o lugar máis próximo dentro do seu raio: son o que
     fai que o Diario poida dicir "caeu na Doca" en vez de "en campo
     aberto". Van en celas; mapaDaPlanta convérteos. */
  const cen = (lado) => {
    const at = lado.ini + Math.floor(lado.gro / 2), ao = Math.floor(longoTotal / 2);
    return vertical ? { x: ix + at, y: iy + ao } : { x: ix + ao, y: iy + at };
  };
  const cNave = cen(nave), cEsp = cen({ ini: espinaOff, gro: ESPINA }), cDep = cen(deps);
  const lugares = [
    { id: 'NAVE', ...cNave, r: Math.max(6, Math.floor(Math.min(nave.gro, longoTotal) * 0.5)), label: etiquetas.nave || 'a Nave' },
    { id: 'ESPINA', ...cEsp, r: 6, label: etiquetas.espina || 'o Corredor Central' },
    { id: 'DEPENDENCIAS', ...cDep, r: Math.max(6, Math.floor(deps.gro * 0.6)), label: etiquetas.deps || 'as Dependencias' },
  ];

  return {
    nome, cols, filas, semente, grid: r.map(f => f.join('')), hq, sectores, lugares,
    _ocosHQ: ocosHQ.length, _ocosSec: ocosSec.length, _tabiques: postos,
  };
}

/* ============================================================
   COMPROBAR — nada sae de aquí sen pasar por isto.
   ============================================================ */
function revisar(p) {
  const erros = [];
  const r = p.grid.map(f => f.split(''));
  if (r.length !== p.filas) erros.push(`ten ${r.length} filas, esperábanse ${p.filas}`);
  r.forEach((f, i) => {
    if (f.length !== p.cols) erros.push(`fila ${i + 1} mide ${f.length}, esperábanse ${p.cols}`);
    const malo = f.find(c => !'#.+=:'.includes(c));
    if (malo) erros.push(`fila ${i + 1} ten o carácter "${malo}"`);
  });
  if (erros.length) return erros;

  for (let x = 0; x < p.cols; x++)
    if (PASABLE.has(r[0][x]) || PASABLE.has(r[p.filas - 1][x])) { erros.push('aberta polo bordo horizontal'); break; }
  for (let y = 0; y < p.filas; y++)
    if (PASABLE.has(r[y][0]) || PASABLE.has(r[y][p.cols - 1])) { erros.push('aberta polo bordo vertical'); break; }

  let chan = 0;
  for (let y = 0; y < p.filas; y++) for (let x = 0; x < p.cols; x++) if (PASABLE.has(r[y][x])) chan++;
  const vistas = alcanzables(r);
  if (vistas.size !== chan) erros.push(`${chan - vistas.size} celas de chan illadas do resto`);
  const pc = Math.round(chan / (p.cols * p.filas) * 100);
  if (pc < 25) erros.push(`só o ${pc}% é transitable; queda claustrofóbico`);
  if (pc > 88) erros.push(`o ${pc}% é transitable; iso non é un interior, é unha explanada`);

  /* PASOS DUNHA SOA CELA. Búscase o corredor de ancho 1: unha cela
     transitable con paso libre nun eixo e muro nos dous lados do outro.
     Unha porta de dúas celas non cae aquí, porque a súa compañeira
     sempre lle deixa un lado libre. */
  const estreitas = [];
  for (let y = 1; y < p.filas - 1; y++) {
    for (let x = 1; x < p.cols - 1; x++) {
      if (!PASABLE.has(r[y][x])) continue;
      const N = PASABLE.has(r[y - 1][x]), S = PASABLE.has(r[y + 1][x]);
      const O = PASABLE.has(r[y][x - 1]), E = PASABLE.has(r[y][x + 1]);
      if (O && E && !N && !S) estreitas.push(`${x},${y}`);
      if (N && S && !O && !E) estreitas.push(`${x},${y}`);
    }
  }
  if (estreitas.length) erros.push(`${estreitas.length} pasos dunha soa cela (${estreitas.slice(0, 5).join(' ')}${estreitas.length > 5 ? '…' : ''})`);

  if (p.hq.length < 2) erros.push('non hai sitio para os dous HQ');
  if (p.hq.length >= 2 && lonxe(p.hq[0], p.hq[1]) < Math.max(p.cols, p.filas) * 0.45)
    erros.push('os dous HQ quedan demasiado preto: non hai travesía');
  if (!p.sectores.length) erros.push('non hai sitio para ningún sector');
  return erros;
}

/* ============================================================
   CATÁLOGO — as plantas da campaña.

   Cada entrada é unha SEMENTE, non un debuxo. Cambiar unha semente
   cambia a planta enteira, e unha operación deseñada sobre unha planta
   deixa de ter sentido se a planta muda debaixo: por iso están
   escritas aquí e non se tocan á lixeira.
   ============================================================ */
const CATALOGO = [
  { nome: 'NAVE', cols: 60, filas: 34, semente: 1071, sectores: 4, tabiques: 3,
    etiquetas: { nave: 'a Nave Principal', espina: 'o Corredor Central', deps: 'os Talleres' } },
  { nome: 'DOCA', cols: 60, filas: 34, semente: 2318, sectores: 4, tabiques: 4,
    etiquetas: { nave: 'a Doca de Carga', espina: 'o Peirao', deps: 'os Almacéns' } },
  { nome: 'XERADORES', cols: 60, filas: 34, semente: 4402, sectores: 3, tabiques: 2,
    etiquetas: { nave: 'a Sala de Xeradores', espina: 'a Galería de Cables', deps: 'os Cadros' } },
  { nome: 'ARQUIVO', cols: 60, filas: 34, semente: 7735, sectores: 5, tabiques: 3,
    etiquetas: { nave: 'o Depósito', espina: 'o Corredor Frío', deps: 'as Salas de Consulta' } },
  /* A GALERÍA vai en vertical: é a única planta alta e estreita, e iso
     cambia como se pelexa nela —non hai flanqueo longo, hai plantas—.
     É a "torre" da operación do SNIPER sen inventar unha torre. */
  { nome: 'GALERIA', cols: 40, filas: 50, semente: 3160, sectores: 3, tabiques: 2,
    etiquetas: { nave: 'a Galería Alta', espina: 'a Escaleira', deps: 'os Palcos' } },
  /* O COMPLEXO CENTRAL: a única localización nova da campaña, e a máis
     grande. Para o último combate. */
  { nome: 'COMPLEXO', cols: 80, filas: 45, semente: 6620, sectores: 6, tabiques: 5,
    etiquetas: { nave: 'o Patio Cuberto', espina: 'a Avenida', deps: 'as Oficinas' } },
];

/* ---------- Escritura ---------- */
function comoJS(plantas) {
  const bloques = plantas.map(p => {
    const filas = p.grid.map(f => `      '${f}',`).join('\n');
    const hq = p.hq.map(h => `{x:${h.x}, y:${h.y}}`).join(', ');
    const sec = p.sectores.map((s, i) => `{id:'${String.fromCharCode(65 + i)}', x:${s.x}, y:${s.y}}`).join(', ');
    const lug = p.lugares.map(s => `{id:'${s.id}', x:${s.x}, y:${s.y}, r:${s.r}, label:'${s.label}'}`).join(',\n      ');
    return `  ${p.nome}: {
    cols: ${p.cols}, filas: ${p.filas}, semente: ${p.semente},
    hq: [${hq}],
    sectores: [${sec}],
    lugares: [
      ${lug},
    ],
    grid: [
${filas}
    ],
  },`;
  }).join('\n');

  return `/* ============================================================
   PLANTAS DE INTERIOR — FICHEIRO XERADO. NON EDITAR A MAN.

   Sae de \`node tools/planta.js --todas --escribir\`. Para cambiar unha
   planta cámbiase a súa SEMENTE no catálogo dese ficheiro e vólvese
   xerar. Editar aquí é escribir unha matriz a man, que é exactamente o
   que este sistema existe para evitar.

   Alfabeto:
     #  macizo (estrutura: non se pasa e non se derruba)
     .  chan
     +  porta (chan; píntase como reixa)
     =  tabique (muro destruíble)
     :  escombro (chan sucio)

   As coordenadas de \`hq\`, \`sectores\` e \`lugares\` van en CELAS e son o
   CENTRO da cousa que vai aí. mapaDaPlanta() convérteas a píxeles.
   ============================================================ */
const PLANTAS = {
${bloques}
};
`;
}

/* ---------- Liña de ordes ---------- */
const argv = process.argv.slice(2);
const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ten = (n) => argv.includes('--' + n);

if (ten('listar')) {
  console.log('Catálogo:');
  for (const c of CATALOGO) console.log(`  ${c.nome.padEnd(12)} ${c.cols}x${c.filas}  semente ${c.semente}`);
  process.exit(0);
}

const pedidas = ten('todas') ? CATALOGO
  : CATALOGO.filter(c => c.nome === (argv[0] && !argv[0].startsWith('--') ? argv[0] : 'NAVE'));
if (!pedidas.length) { console.error('non coñezo esa planta; proba con --listar'); process.exit(1); }

const feitas = [];
let houboErro = false;
for (const c of pedidas) {
  const cfg = { ...c };
  if (op('cols', null)) cfg.cols = +op('cols');
  if (op('filas', null)) cfg.filas = +op('filas');
  if (op('semente', null)) cfg.semente = +op('semente');
  const p = xerar(cfg);
  const erros = revisar(p);
  const chan = p.grid.join('').split('').filter(ch => PASABLE.has(ch)).length;
  console.log(`\n${p.nome}  ${p.cols}x${p.filas}  semente ${p.semente}`);
  console.log(`  chan ${chan} celas (${Math.round(chan / (p.cols * p.filas) * 100)}%) · ocos p/HQ ${p._ocosHQ} · ` +
    `ocos p/sector ${p._ocosSec} · sectores ${p.sectores.length} · tabiques ${p._tabiques}`);
  if (erros.length) { houboErro = true; for (const e of erros) console.log('  ✖ ' + e); }
  else console.log('  ✓ pasa todas as comprobacións');
  if (!ten('escribir') || ten('ver')) console.log(p.grid.map(f => '  ' + f).join('\n'));
  feitas.push(p);
}

if (ten('escribir')) {
  if (houboErro) { console.error('\nnon se escribe nada: hai plantas que non pasan as comprobacións'); process.exit(1); }
  fs.writeFileSync(SAIDA, comoJS(feitas), 'utf8');
  console.log(`\n-> ${path.relative(RAIZ, SAIDA)} (${feitas.length} plantas)`);
}
