/* ============================================================
   INTERLUDIOS — que aparezan cando toca e non cando non.

   O que se proba aquí non é o debuxo: é a ESCOLLA. Un interludio que
   sae dúas veces, ou dous seguidos coa mesma voz, ou un que se cola
   nunha partida contra outra persoa, estraga o momento que veu crear.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, asentar } = require('./arnes.js');

/* Deixa o DATA do xogo no estado que pide cada proba. Só se tocan os
   campos que miran as condicións; o resto queda como o deixou o arranque. */
function estado(S, extra){
  const D = S.aval('DATA');
  D.opCount = 0; D.fallen = []; D.units = []; D.interludios = null;
  Object.assign(D, extra || {});
  return D;
}

proba('sen nada feito, o único que pode saír é o da vitoria', async () => {
  const S = cargarXogo();
  await asentar();
  estado(S);
  const escoller = S.aval('interludioEscoller');

  afirmar(escoller({result: 'defeat'}) === null,
    'perdendo a primeira non debería saír ningún interludio');
  const it = escoller({result: 'victory'});
  afirmar(it && it.id === 'optima', `esperábase "optima" e saíu ${it && it.id}`);
});

proba('cada interludio sae unha soa vez', async () => {
  const S = cargarXogo();
  await asentar();
  const D = estado(S, {opCount: 1});
  /* interludioQuizais non recibe o resultado por parámetro: lémbrao de
     window._ultimaOp, que pon endBattle. Aquí ponse a man. */
  S.window._ultimaOp = {result: 'victory'};
  const quizais = S.aval('interludioQuizais');
  const escoller = S.aval('interludioEscoller');

  afirmar(quizais(() => {}) === true, 'o primeiro tiña que saír');
  afirmar(D.interludios.vistos.indexOf('optima') >= 0, 'non quedou anotado');
  afirmar(escoller({result: 'victory'}) === null, 'o mesmo interludio repetiuse');
});

proba('as voces altérnanse cando hai onde escoller', async () => {
  const S = cargarXogo();
  await asentar();
  /* Con moitas operacións e unha baixa hai candidatos das dúas voces. */
  const D = estado(S, {opCount: 20, fallen: ['R-01 caído'], units: [{reensamblado: true}]});
  const escoller = S.aval('interludioEscoller');

  const voces = [];
  for(let i = 0; i < 8; i++){
    const it = escoller({result: 'victory'});
    if(!it) break;
    voces.push(it.voz);
    D.interludios = D.interludios || {vistos: [], ultimaVoz: null};
    D.interludios.vistos.push(it.id);
    D.interludios.ultimaVoz = it.voz;
  }
  afirmar(voces.length >= 5, `só saíron ${voces.length} interludios`);

  let seguidas = 1, peor = 1;
  for(let i = 1; i < voces.length; i++){
    seguidas = voces[i] === voces[i-1] ? seguidas + 1 : 1;
    peor = Math.max(peor, seguidas);
  }
  afirmar(peor <= 2,
    `${peor} interludios seguidos coa mesma voz: ${voces.join(' ')}`);
});

proba('non se colan en PvP, Mundial nin Crisol', async () => {
  const S = cargarXogo();
  await asentar();
  const escoller = S.aval('interludioEscoller');
  for(const modo of ['pvp', 'mundial', 'crisol']){
    estado(S, {opCount: 20, fallen: ['a', 'b', 'c']});
    afirmar(escoller({result: 'victory', modo}) === null,
      `saíu un interludio en modo ${modo}`);
  }
});

proba('a revelación do firmware garda a súa quenda', async () => {
  /* Pide operacións E mortos. A explicación de por que os robots teñen
     memoria non significa nada antes de perder a alguén. */
  const S = cargarXogo();
  await asentar();
  const firmware = S.aval('INTERLUDIOS').find(i => i.id === 'firmware');
  const op = {result: 'victory'};

  afirmar(!firmware.cando(estado(S, {opCount: 40, fallen: []}), op),
    'o firmware saíu sen que morrese ninguén');
  afirmar(!firmware.cando(estado(S, {opCount: 2, fallen: ['a','b','c','d']}), op),
    'o firmware saíu na segunda operación');
  afirmar(firmware.cando(estado(S, {opCount: 15, fallen: ['a','b','c']}), op),
    'co tempo e coas baixas, o firmware ten que poder saír');
});

proba('todo interludio ten imaxe, texto nas tres linguas e unha das dúas voces', async () => {
  const S = cargarXogo();
  await asentar();
  const LANGS = S.aval('LANGS');
  const UI = path.join(__dirname, '..', 'i', 'ui');

  for(const it of S.aval('INTERLUDIOS')){
    afirmar(it.voz === 'OPTIMA' || it.voz === 'TUERCA',
      `${it.id}: voz "${it.voz}" descoñecida`);
    afirmar(fs.existsSync(path.join(UI, `fondo_${it.imaxe}.jpg`)),
      `${it.id}: non existe ui/fondo_${it.imaxe}.jpg`);
    for(const lang of ['gl', 'es', 'en']){
      for(const suf of ['tit', 'txt']){
        const k = `int.${it.id}.${suf}`;
        afirmar(LANGS[lang] && LANGS[lang][k], `${it.id}: falta ${k} en ${lang}`);
      }
    }
  }
});

proba('ningún interludio usa a imaxe doutro', async () => {
  /* Se dous comparten imaxe, o segundo lese como un erro de carga. */
  const S = cargarXogo();
  await asentar();
  const vistas = new Set();
  for(const it of S.aval('INTERLUDIOS')){
    afirmar(!vistas.has(it.imaxe), `a imaxe "${it.imaxe}" úsana dous interludios`);
    vistas.add(it.imaxe);
  }
});
