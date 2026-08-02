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

proba('no primeiro día o taller non ten porta de saída', () => {
  /* Montar o teu robot é a primeira mecánica do xogo e a que o fai
     distinto. Se se pode pechar a pantalla e seguir, o xogador sáltaa sen
     sabelo e entra nunha campaña sen entender de que vai isto.

     Comprobado no código e non no render, porque son dous camiños: o
     botón "volver" da propia pantalla e o PECHAR do modal. Tapar un só
     deixa o outro aberto. */
  const fs = require('fs');
  const path = require('path');
  const js = fs.readFileSync(
    path.join(__dirname, '..', 'i', 'js', '12-debrief-hangar.js'), 'utf8');

  afirmar(/_pd \? '' : '<button class="bio-btn" id="montBack">/.test(js),
    'o botón de volver do taller segue saíndo no primeiro día');
  const pechar = js.slice(js.indexOf("$('btnBioClose').onclick"), js.indexOf("$('btnBioClose').onclick") + 500);
  afirmar(/montaxePrimeiroDia/.test(pechar),
    'o PECHAR do modal non mira se estamos no primeiro día');
});

proba('o interludio de arranque deixa escoller idioma', () => {
  /* O selector vive no hangar, e o guión de arranque pasa por diante
     del: sen isto, quen abre o xogo por primeira vez non pode cambiar de
     lingua ata rematar todo o arranque, que é onde máis texto hai. */
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'i', 'index.html'), 'utf8');
  const js = fs.readFileSync(
    path.join(__dirname, '..', 'i', 'js', '21-interludio.js'), 'utf8');

  for (const l of ['gl', 'es', 'en']) {
    afirmar(html.includes(`data-lang="${l}"`), `falta o botón de idioma ${l} no arranque`);
  }
  afirmar(/tramo === 'ARRANQUE'/.test(js),
    'o selector de idioma ten que saír SÓ no arranque, non nos quince interludios');
});

proba('a apertura non se repite ao quedar sen robots', async () => {
  /* REGRESIÓN REAL, e das que borran unha partida. O primeiro día
     definíase só como "cero operacións e ninguén no roster". Se perdías o
     teu único robot antes de rematar unha operación volvías cumprir as
     dúas condicións e o xogo repetía o laboratorio, o selector de clase e
     o reparto de 90⚙ como se acabases de instalalo: a campaña empezaba de
     novo sen que ninguén cha borrase. */
  const S = await cargarXogo();
  await asentar();
  const D = S.aval('DATA');
  D.opCount = 0; D.units = []; D.piezas = []; D.chatarra = 0; D.marcas = {};
  afirmar(S.aval('montaxePrimeiroDia')(), 'nunha instalación nova si é o primeiro día');
  afirmar(S.aval('interludioPrimeiroDia')(), 'e o laboratorio ten que saír');

  /* Bautizaches o teu primeiro robot: a apertura rematou. */
  S.aval('DATA').marcas.primeiroNome = 0;
  S.aval('DATA').units = [];      /* e despois morreron todos */
  S.aval('DATA').opCount = 0;     /* sen chegar a rematar unha operación */
  afirmar(!S.aval('montaxePrimeiroDia')(), 'quedar sen robots non devolve ao primeiro día');
  afirmar(!S.aval('interludioPrimeiroDia')(), 'nin repite o laboratorio de ÓPTIMA');
  afirmar(!S.aval('primeiroDiaPreparar')(), 'nin volve repartir banco e presuposto');
});

proba('peso e potencia: un robot puro móvese como sempre', async () => {
  /* A INVARIANTE QUE FAI SEGURO O MODELO. Nun robot todo dunha clase a
     carga vale 6M e a potencia 2M para CALQUERA clase, así que a razón dá
     sempre 1/3 e o factor exactamente 1. Se isto se rompe, o modelo
     deixou de ser unha regra de mestura e pasou a reequilibrar o xogo
     enteiro polas costas. */
  const S = await cargarXogo();
  await asentar();
  const F = S.aval('montaxeFisica'), CLS = S.aval('CLS');
  const todo = (c) => ({CHASIS:c, CABEZA:c, NUCLEO:c, BRAZO_DER:c,
                        BRAZO_ESQ:c, PERNA_DER:c, PERNA_ESQ:c});
  for(const c of Object.keys(CLS)){
    afirmar(Math.abs(F(todo(c), c).factor - 1) < 1e-9,
      'montaxe pura de ' + c + ' ten que dar factor 1');
  }
  /* Sen montaxe —unidade de fábrica— tampouco cambia nada. */
  const u = S.aval('mkUnit')(S.aval('PT'), 'HEAVY', 0, 0, null);
  afirmar(Math.abs(u.spd - CLS.HEAVY.spd) < 1e-9, 'unha unidade de fábrica non se ve tocada');
});

proba('peso e potencia: as pernas son o motor e o chasis a carga', async () => {
  const S = await cargarXogo();
  await asentar();
  const F = S.aval('montaxeFisica');
  const todo = (c) => ({CHASIS:c, CABEZA:c, NUCLEO:c, BRAZO_DER:c,
                        BRAZO_ESQ:c, PERNA_DER:c, PERNA_ESQ:c});

  /* Pernas de HEAVY baixo un corpo lixeiro: corre máis. */
  const rapido = F(Object.assign(todo('GRUNT'), {PERNA_DER:'HEAVY', PERNA_ESQ:'HEAVY'}), 'GRUNT');
  afirmar(rapido.factor > 1, 'pernas pesadas nun corpo lixeiro teñen que acelerar');

  /* Chasis de HEAVY sobre pernas lixeiras: vai máis lento, e conserva o HP. */
  const lento = F(Object.assign(todo('GRUNT'), {CHASIS:'HEAVY'}), 'HEAVY');
  afirmar(lento.factor < 1, 'un chasis pesado sobre pernas lixeiras ten que frear');

  /* E o factor está acoutado: sen tope, unhas pernas de HEAVY baixo un
     ENGINEER darían máis do triplo de velocidade. */
  const extremo = F(Object.assign(todo('ENGINEER'), {PERNA_DER:'HEAVY', PERNA_ESQ:'HEAVY'}), 'ENGINEER');
  afirmar(extremo.factor <= 1.2 + 1e-9, 'o factor non pode pasar do tope');

  /* A montaxe ten que chegar ao campo para que nada disto se note. */
  const mont = Object.assign(todo('GRUNT'), {PERNA_DER:'HEAVY', PERNA_ESQ:'HEAVY'});
  const u = S.aval('mkUnit')(S.aval('PT'), 'GRUNT', 0, 0, {montaxe: mont, ops:0});
  afirmar(u.spd > S.aval('CLS').GRUNT.spd, 'a velocidade da montaxe ten que aplicarse en batalla');
});

proba('primeiro día: mesturar clases dá habilidades e corpo', async () => {
  /* DOUS FALLOS REAIS NUN. A entrega do primeiro día era un atallo
     escrito á man que non pasaba por entregarReconstruccion: nin
     habilidades cruzadas, nin sinerxía, nin doadores. Pagabas o dobre por
     unha peza doutra clase e non compraba nada.

     E aínda que as houbese, mkUnit non copiaba `montaxe` ao campo, así
     que o debuxante caía no sprite xenérico: o corpo que montabas non se
     vía no xogo. */
  const S = await cargarXogo();
  await asentar();
  const D = S.aval('DATA');
  D.opCount = 0; D.units = []; D.piezas = []; D.chatarra = 0;
  S.aval('primeiroDiaPreparar')();
  const pzs = S.aval('DATA').piezas;
  const p = (tipo, cls) => pzs.find(x => x.tipo === tipo && x.deCls === cls);
  afirmar(pzs.every(x => x.act === 0), 'as pezas de fábrica non lembran nada');

  const usadas = { CHASIS: p('CHASIS','SNIPER'), CABEZA: p('CABEZA','SNIPER'),
    BRAZO_DER: p('BRAZO_DER','ENGINEER'), BRAZO_ESQ: p('BRAZO_ESQ','BOMBARDERO'),
    NUCLEO: p('NUCLEO','SNIPER'), PERNA_DER: p('PERNA_DER','HEAVY'),
    PERNA_ESQ: p('PERNA_ESQ','SNIPER') };
  S.aval('DATA').reconstruccion = { encargadaOp: -1, sinergia: null, desdeCero: true,
    pezas: usadas,
    rec: { id:'R-01', name:'PROBA', cls:'SNIPER', ops:0, kills:0, traits:[], events:[],
           medals:[], crossings:0, recoveries:0, criticalSurvivals:0, captures:0,
           confianza:40, activity:{dist:0,shots:0,kills:0,dmgTaken:0,caps:0,veh:0} } };
  S.aval('entregarReconstruccion')([]);
  const u = S.aval('DATA').units.slice(-1)[0];

  const h = u.habilidades || {};
  afirmar(h.cazapilotos, 'cabeza de SNIPER → cazapilotos');
  afirmar(h.recolector, 'brazo de ENGINEER → recolector');
  afirmar(h.antimuro, 'brazo de BOMBARDERO → antimuro');
  afirmar((u.piezasDe || []).length === 0, 'as pezas de fábrica non teñen doador');
  afirmar(u.montaxe && u.montaxe.BRAZO_DER === 'ENGINEER', 'a montaxe garda cada slot');

  const mk = S.aval('mkUnit')(S.aval('PT'), u.cls, 0, 0, u);
  afirmar(mk.montaxe && mk.montaxe.BRAZO_DER === 'ENGINEER',
    'a montaxe ten que chegar ao campo: senón debúxase o sprite xenérico');
});

proba('primeiro día: o banco sobrevive á carga de partida', async () => {
  /* ISTO É UNHA REGRESIÓN REAL, e das caras. showHangar() fai
     `DATA = await loadData()`: SUBSTITÚE o obxecto DATA enteiro. Como o
     arranque preparaba o primeiro día ANTES de chamalo, o banco e o
     presuposto poñíanse nun obxecto que a liña seguinte tiraba, e o
     xogador atopaba o taller con PRESUPOSTO 0, sen unha soa peza nos
     desplegables, e cobrándolle igual.

     Non o colleu ningunha proba porque todas chamaban a preparar DESPOIS
     de asentar(), que xa fixera a carga: probaban a orde boa mentres o
     xogo corría a mala. Isto proba as dúas. */
  const S = await cargarXogo();
  await asentar();
  const D = S.aval('DATA');
  D.opCount = 0; D.units = []; D.piezas = []; D.chatarra = 0;

  S.aval('primeiroDiaPreparar')();
  S.aval('DATA = freshData()');            /* <- o que fai loadData */
  afirmar((S.aval('DATA').piezas || []).length === 0,
    'preparar antes da carga pérdese: iso era o fallo');

  S.aval('primeiroDiaPreparar')();          /* <- a orde correcta */
  afirmar(S.aval('DATA').chatarra === 90, 'presuposto tras a carga');
  afirmar(S.aval('DATA').piezas.length === 35, 'banco enteiro tras a carga');
});

/* E que o arranque siga a orde boa: preparar DENTRO do then de
   showHangar, nunca antes. Léese o fonte porque o que se protexe é
   literalmente unha orde de dúas liñas. */
proba('primeiro día: o arranque prepara despois de showHangar', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'i', 'js', '99-boot.js'), 'utf8');
  const iH = src.indexOf('showHangar');
  const iP = src.indexOf('primeiroDiaPreparar()');
  afirmar(iH > -1 && iP > iH,
    'primeiroDiaPreparar ten que ir despois de showHangar: antes, a carga bórrao');
});

proba('o presuposto do primeiro día chega aínda coa partida a medio empezar', () => {
  /* O fallo real: montaxePrimeiroDia() dicía que si —non hai operacións
     nin roster— e primeiroDiaPreparar() dicía que non, porque adiviñaba
     mirando se xa había pezas. Cunha partida a medio empezar as dúas
     discrepaban e cobrábase a prezo de primeiro día CON PRESUPOSTO CERO:
     o xogador vía "DEBES 70" tendo dereito a 90.

     Dúas condicións que teñen que coincidir non poden saír de dous
     cálculos distintos. */
  const S = cargarXogo();
  const D = S.aval('DATA');
  D.opCount = 0; D.units = []; D.chatarra = 0; D.marcas = {};
  D.piezas = [{id: 'x', tipo: 'CABEZA', deCls: 'GRUNT'}];   /* restos dun intento anterior */

  afirmar(S.aval('primeiroDiaPreparar')() === true,
    'con restos dun intento anterior deixou de repartir o presuposto');
  afirmar(D.chatarra === S.aval('PRIMEIRO_PRESUPOSTO'),
    `o presuposto quedou en ${D.chatarra}`);
  /* Chamalo outra vez NON pode duplicar nada. Non hai marca de "xa
     repartín" a propósito: o primeiro día remata só, cando montas o
     robot e xa hai alguén no roster. Con marca, unha partida a medio
     empezar quedaba sen banco e con presuposto cero, e o taller cobraba
     igual — "QUEDAS A DEBER 70" cun desplegable sen unha soa peza. */
  const nPezas = D.piezas.length;
  S.aval('primeiroDiaPreparar')();
  afirmar(D.chatarra === S.aval('PRIMEIRO_PRESUPOSTO'),
    `chamalo dúas veces cambiou o presuposto a ${D.chatarra}`);
  afirmar(D.piezas.length === nPezas,
    'chamalo dúas veces duplicou o banco de pezas');
});

proba('a primeira pantalla do taller é escoller clase, con ficha', async () => {
  /* Antes deducíase a clase do CHASIS nun desplegable no medio doutros
     seis. Iso non ensina nada: o xogador non sabe que ao trocar o chasis
     está a cambiar de clase, e chega ao seu primeiro combate sen que
     ninguén lle dixese que fai cada unha.

     E a escolla ten consecuencia: decide QUE PEZAS SON BARATAS. */
  const S = cargarXogo();
  await asentar();
  const D = S.aval('DATA');
  D.opCount = 0; D.units = []; D.piezas = []; D.chatarra = 0;
  D.marcas = {}; D.reconstruccion = null;
  S.aval('primeiroDiaPreparar')();

  S.aval('escollaClaseAberta')();
  let h = S.document.getElementById('bioBody').innerHTML;
  for (const c of Object.keys(S.aval('CLS'))) {
    afirmar(h.includes(`data-cls="${c}"`), `falta a clase ${c} no selector`);
  }
  afirmar(!h.includes('clsOk'), 'deixa montar sen escoller clase');

  D.marcas.clsInicial = 'SNIPER';
  S.aval('escollaClaseAberta')();
  h = S.document.getElementById('bioBody').innerHTML;
  afirmar(/lamina_SNIPER/.test(h), 'a ficha non amosa a lámina da clase');
  afirmar(/190/.test(h), 'a ficha non amosa os datos da clase (rango do SNIPER)');

  /* E o prezo segue a clase ESCOLLIDA, non o chasis que trabuques. */
  const pz = S.aval('prezoPeza');
  afirmar(pz({deCls: 'SNIPER'}, 'SNIPER') === S.aval('PEZA_ESTANDAR'),
    'a peza da clase escollida non é a barata');
  afirmar(pz({deCls: 'GRUNT'}, 'SNIPER') === S.aval('PEZA_ALLEA'),
    'a peza doutra clase non custa o dobre');

  /* E TODAS as clases están dispoñibles, que era a outra metade. */
  S.aval('showMontaxe')();
  const m = S.document.getElementById('bioBody').innerHTML;
  afirmar((m.match(/<option/g) || []).length >= 35,
    'o banco do primeiro día non ofrece pezas de todas as clases');
});
