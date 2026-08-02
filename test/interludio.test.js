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
  /* O tramo ARRANQUE dáse por VISTO. Todas as probas menos as do propio
     arranque falan do que pasa despois da primeira operación, e a esas
     alturas o guión do primeiro día xa pasou. Se non se marcase, cada
     unha delas empezaría atopando o laboratorio e non o que vai medir.
     As probas do arranque poñen `vistos: []` a man. */
  if(!extra || !extra.interludios){
    const arr = S.aval('INTERLUDIOS').filter(i => i.tramo === 'ARRANQUE').map(i => i.id);
    D.interludios = { vistos: arr, ultimaVoz: 'OPTIMA' };
  }
  return D;
}

proba('o tramo ARRANQUE existe e vai por diante de todo', async () => {
  /* Todo o sistema de interludios dispárase ao VOLVER dunha operación.
     A historia, en cambio, ten que empezar antes da primeira: no taller,
     coa montaxe do primeiro robot.

     ARRANQUE é o único tramo que pode saír sen ter xogado nada, e vai
     primeiro na lista para que a regra de "o tramo manda sobre a voz"
     nunca o adiante. */
  const S = cargarXogo();
  await asentar();
  const TRAMOS = S.aval('TRAMOS');
  afirmar(TRAMOS[0] === 'ARRANQUE',
    `ARRANQUE ten que ir primeiro e a orde é ${TRAMOS.join(' ')}`);
  afirmar(TRAMOS.indexOf('EPILOGO') === TRAMOS.length - 1,
    'o epílogo segue tendo que ir o último');
});

proba('o primeiro día recoñécese, e só ocorre unha vez', async () => {
  const S = cargarXogo();
  await asentar();
  const primeiroDia = S.aval('interludioPrimeiroDia');

  estado(S);
  afirmar(primeiroDia() === true, 'sen operacións e sen roster é o primeiro día');

  estado(S, {opCount: 1});
  afirmar(primeiroDia() === false, 'cunha operación xogada xa non o é');

  estado(S, {units: [{id: 'R-01', name: 'CROMO'}]});
  afirmar(primeiroDia() === false, 'con alguén no roster tampouco');
});

proba('fóra do primeiro día, o arranque non se mete no medio', async () => {
  /* Se non é o primeiro día, interludioArranque ten que chamar ao que
     lle pasen e desaparecer. Unha partida avanzada non pode notar que
     isto existe. */
  const S = cargarXogo();
  await asentar();
  estado(S, {opCount: 7, fallen: ['a']});
  const arranque = S.aval('interludioArranque');

  let chamado = 0;
  const saiu = arranque(() => { chamado++; });
  afirmar(saiu === false, 'nunha partida avanzada non pode saír interludio de arranque');
  afirmar(chamado === 1, 'ten que chamar ao seguinte paso exactamente unha vez');
});

proba('a primeira operación di quen es: gañaches ou perdiches', async () => {
  /* Os dous primeiros interludios son de ÓPTIMA e din o mesmo dúas
     veces: que ti es un dato. Un felicita e o outro fala do Mundial
     mentres na imaxe hai un robot morto na lama. */
  const S = cargarXogo();
  await asentar();
  const escoller = S.aval('interludioEscoller');

  estado(S);
  const gaña = escoller({result: 'victory'});
  afirmar(gaña && gaña.id === 'optima', `gañando esperábase "optima" e saíu ${gaña && gaña.id}`);

  estado(S);
  const perde = escoller({result: 'defeat'});
  afirmar(perde && perde.id === 'ultimatransmision',
    `perdendo esperábase "ultimatransmision" e saíu ${perde && perde.id}`);
});

proba('o tramo manda sobre a voz: o epílogo non se adianta', async () => {
  /* Este é o motivo de que exista o campo `tramo`. Con todo desbloqueado
     á vez, a alternancia de voces podía escoller o epílogo —o campo
     comido pola herba— só por non repetir voz, e verías o final antes
     de rematar a parte escura. */
  const S = cargarXogo();
  await asentar();
  /* Aquí SI se empeza sen nada visto: esta proba percorre o arco enteiro
     desde o primeiro día ata o epílogo. */
  const D = estado(S, {opCount: 40, fallen: ['a','b','c','d','e','f'],
                       piezas: [{id:'p'}], units: [{reensamblado: true}],
                       marcas: {primeiroNome: 3},
                       interludios: {vistos: [], ultimaVoz: null}});
  const escoller = S.aval('interludioEscoller');
  const TRAMOS = S.aval('TRAMOS');

  const orde = [];
  for(let i = 0; i < 40; i++){
    /* Alternando resultado: hai un interludio que só sae ao PERDER
       —ÓPTIMA falando do Mundial sobre un robot morto na lama— e gañando
       sempre non se chegaría a el. */
    const it = escoller({result: i % 3 === 2 ? 'defeat' : 'victory'});
    if(!it) break;
    orde.push(it);
    D.interludios = D.interludios || {vistos: [], ultimaVoz: null};
    D.interludios.vistos.push(it.id);
    D.interludios.ultimaVoz = it.voz;
  }
  afirmar(orde.length === S.aval('INTERLUDIOS').length,
    `saíron ${orde.length} de ${S.aval('INTERLUDIOS').length}`);

  /* O índice de tramo nunca pode baixar. */
  let peor = -1;
  for(const it of orde){
    const ix = TRAMOS.indexOf(it.tramo);
    afirmar(ix >= peor,
      `${it.id} (${it.tramo}) saíu despois dun tramo posterior: ${orde.map(x => x.tramo).join(' ')}`);
    peor = ix;
  }
  afirmar(orde[orde.length - 1].id === 'pradera',
    `o último tiña que ser o epílogo e foi ${orde[orde.length - 1].id}`);
});

proba('ÓPTIMA cala segundo avanza a campaña', async () => {
  /* Non está escrito en ningunha condición, pero é o arco: ao principio
     a empresa fala a metade das veces e no final non aparece. Se algún
     día se engade un interludio de ÓPTIMA no tramo da XENTE, isto
     avisa. */
  const S = cargarXogo();
  await asentar();
  const porTramo = {};
  for(const it of S.aval('INTERLUDIOS')){
    porTramo[it.tramo] = porTramo[it.tramo] || {OPTIMA: 0, TUERCA: 0};
    porTramo[it.tramo][it.voz]++;
  }
  afirmar(porTramo.MAQUINA && porTramo.MAQUINA.OPTIMA >= 3,
    'no primeiro tramo ÓPTIMA ten que falar bastante');
  for(const t of ['XENTE', 'EPILOGO']){
    afirmar(!porTramo[t] || porTramo[t].OPTIMA === 0,
      `ÓPTIMA fala no tramo ${t}, e aí xa non lle toca`);
  }
});

proba('o primeiro nome dispárase por un acto, non polo tempo', async () => {
  /* É o único interludio que responde a algo que FAI o xogador. Sen
     bautizar a ninguén non pode saír, por moitas operacións que leves. */
  const S = cargarXogo();
  await asentar();
  const nome = S.aval('INTERLUDIOS').find(i => i.id === 'primernombre');
  const op = {result: 'victory'};

  afirmar(!nome.cando(estado(S, {opCount: 99, fallen: ['a','b','c']}), op),
    'saíu sen que o xogador renomease a ninguén');
  afirmar(nome.cando(estado(S, {opCount: 1, marcas: {primeiroNome: 1}}), op),
    'renomeando xa na primeira operación ten que poder saír');
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

proba('a revelación tardía garda a súa quenda', async () => {
  /* A entrega do caderno pide operacións E mortos. Saber que isto xa
     pasou seis veces antes non significa nada ata que perdiches a
     alguén.

     (Este posto ocupábao o laboratorio v0.9β. Movéuse ao arranque: o
     xogador non tropeza cun fallo, entra na sala onde naceu.) */
  const S = cargarXogo();
  await asentar();
  const tardia = S.aval('INTERLUDIOS').find(i => i.id === 'entrega');
  const op = {result: 'victory'};

  afirmar(!tardia.cando(estado(S, {opCount: 40, fallen: []}), op),
    'saíu sen que morrese ninguén');
  afirmar(!tardia.cando(estado(S, {opCount: 2, fallen: ['a','b','c','d']}), op),
    'saíu na segunda operación');
  afirmar(tardia.cando(estado(S, {opCount: 15, fallen: ['a','b','c']}), op),
    'co tempo e coas baixas ten que poder saír');
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

proba('hai un retrato por clase e chegan ás dúas vías de publicación', () => {
  /* Tres veces mordeu xa isto: un ficheiro de ui/ que existe en local,
     que se ve perfecto, e que non chega ao xogo publicado porque unha das
     DÚAS listas non o coñece. build.py copia por prefixo a dist/ e
     firebase.json serve i/ menos o que exclúe o seu ignore. Son
     independentes e hai que mirar as dúas. */
  const path2 = require('path');
  const RAIZ = path2.join(__dirname, '..');
  const CLASES = ['GRUNT', 'SNIPER', 'ENGINEER', 'HEAVY', 'BOMBARDERO'];

  for (const cls of CLASES) {
    const rel = `ui/retrato_${cls}.jpg`;
    afirmar(fs.existsSync(path2.join(RAIZ, 'i', rel)),
      `falta i/${rel}: a ficha dun veterano ${cls} quedaría sen imaxe`);
  }

  const build = fs.readFileSync(path2.join(RAIZ, 'i', 'build.py'), 'utf8');
  afirmar(/_UI_PATRONS\s*=\s*\[[^\]]*'retrato_'/.test(build),
    'build.py non copia retrato_* a dist/: en local veríanse e no ficheiro único non');

  // Glob -> RegExp. O literal escápase PRIMEIRO, o punto incluído: se non,
  // o patrón dos ficheiros ocultos casa con todo e a proba mente.
  const fb = JSON.parse(fs.readFileSync(path2.join(RAIZ, 'firebase.json'), 'utf8'));
  const rex = (p) => new RegExp('^' + p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*')
    .replace(/\u0001/g, '.*') + '$');
  for (const cls of CLASES) {
    const rel = `ui/retrato_${cls}.jpg`;
    const culpable = (fb.hosting.ignore || []).find((p) => rex(p).test(rel));
    afirmar(!culpable, `firebase.json exclúe ${rel} co patrón "${culpable}"`);
  }
});

proba('o taller do primeiro día ábrese e conta o sistema que usa', async () => {
  /* ESTA PROBA EXISTE POR UN FALLO CONCRETO. A pantalla usaba unha
     variable que non estaba declarada —quedaron os usos sen a
     declaración despois dun parche a medias— e petaba con
     "ReferenceError: _pd is not defined" ao abrila.

     As 133 probas pasaban igual, porque NINGUNHA CHAMABA A showMontaxe.
     Comprobaban a aritmética do prezo e o estado do primeiro día, pero
     non abrían a pantalla. Unha pantalla que ninguén abre é unha
     pantalla que ninguén sabe se funciona. */
  const S = cargarXogo();
  await asentar();
  const D = S.aval('DATA');
  D.opCount = 0; D.units = []; D.piezas = []; D.chatarra = 0; D.reconstruccion = null;
  S.aval('primeiroDiaPreparar')();

  S.aval('showMontaxe')();
  const h = S.document.getElementById('bioBody').innerHTML;

  afirmar(h.length > 100, 'o taller do primeiro día non pintou nada');
  afirmar(/PRESUPOSTO|PRESUPUESTO|BUDGET/i.test(h),
    'non fala do presuposto, que é a decisión do primeiro día');
  afirmar(!/recambio xen/i.test(h),
    'segue contando o modelo vello de recambio xenérico');
});
