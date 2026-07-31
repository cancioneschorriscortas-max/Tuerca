/* ============================================================
   CHROME (v0.68)

   As etiquetas dos botóns baleirouse do HTML: agora todas veñen do
   dicionario. Iso é máis limpo, pero rompe en silencio — un botón
   sen clave queda simplemente en branco e ninguén se entera ata
   que o ve un xogador.

   Estas probas pechan ese oco: todo botón que naza sen texto no
   markup ten que acabar con etiqueta nas TRES linguas, ningunha
   etiqueta pode levar emoji (as iconas van en CSS) e toda icona
   declarada no HTML ten que existir na folla de estilos.
   ============================================================ */
const fs = require('fs');
const { proba, afirmar } = require('./probar.js');
const { cargarXogo } = require('./arnes.js');

const HTML = fs.readFileSync('C:/tuerca/i/index.html', 'utf8');
const CSS = fs.readFileSync('C:/tuerca/i/css/style.css', 'utf8');

/* Botóns cuxo texto no markup está baleiro (só comentarios ou nada):
   eses dependen por completo do dicionario. */
function botonsSenTexto() {
  const out = [];
  const re = /<button\s+id="([^"]+)"([^>]*)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(HTML))) {
    const [, id, attrs, dentro] = m;
    const visible = dentro.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!visible) out.push({ id, attrs });
  }
  return out;
}

/* Rangos de emoji e símbolos decorativos. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

proba('todo botón sen texto no markup recibe etiqueta nas tres linguas', () => {
  const baleiros = botonsSenTexto();
  afirmar(baleiros.length > 0, 'non se atopou ningún botón no HTML: cambiou o markup?');

  const S = cargarXogo();
  const setLang = S.aval('setLang');
  const doc = S.document;

  for (const lang of ['gl', 'es', 'en']) {
    setLang(lang, { persist: false });
    for (const { id } of baleiros) {
      const el = doc.getElementById(id);
      const t = (el.textContent || '').trim();
      afirmar(t.length > 0, `[${lang}] o botón #${id} quedou sen etiqueta`);
    }
  }
});

proba('ningunha etiqueta de botón leva emoji', () => {
  const S = cargarXogo();
  const setLang = S.aval('setLang');
  const doc = S.document;
  for (const lang of ['gl', 'es', 'en']) {
    setLang(lang, { persist: false });
    for (const { id } of botonsSenTexto()) {
      const t = doc.getElementById(id).textContent || '';
      afirmar(!EMOJI.test(t),
        `[${lang}] #${id} aínda leva decoración na etiqueta: ${JSON.stringify(t)}`);
    }
  }
});

proba('toda icona declarada no HTML existe no CSS', () => {
  const usadas = new Set();
  let m;
  const re = /data-icona="([^"]+)"/g;
  while ((m = re.exec(HTML))) usadas.add(m[1]);
  afirmar(usadas.size > 0, 'ningún botón declara icona');

  for (const nome of usadas) {
    afirmar(CSS.includes(`[data-icona="${nome}"]`),
      `a icona "${nome}" úsase no HTML pero non ten regra no CSS`);
  }
});

proba('non quedan estilos de cor en liña nos botóns do hangar', () => {
  /* Antes cada botón levaba o seu color/border-color en style=. Iso
     impedía calquera cambio de tema e gañáballe sempre ao CSS. */
  const re = /<button[^>]*style="([^"]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(HTML))) {
    const estilo = m[1];
    afirmar(!/(^|;)\s*color\s*:/.test(estilo) && !/border-color\s*:/.test(estilo),
      `queda cor en liña nun botón: ${JSON.stringify(estilo)}`);
  }
});

/* ---------- Idioma ---------- */

proba('non se publica material de traballo', () => {
  /* firebase.json publica i/ ENTEIRO. As láminas de orixe e as pezas
     recortadas viven alí e pesan varios MB: son material de traballo, non
     do xogo, e ían a cada deploy. As dúas imaxes que usa o CSS si teñen
     que saír.

     O patrón era "ui/lamina*.png" e era GLOTÓN de máis: ao aparecer as
     láminas técnicas das clases (ui/lamina_GRUNT.png e compañía, que SI
     son do xogo) collíaas tamén, e a ficha da unidade saía sen lámina no
     xogo publicado mentres en local se vía perfectamente. Agora vai por
     nome. Que as das clases NON queden excluídas compróbase en
     montaxe.test.js, que é onde vive o que as usa. */
  const fb = JSON.parse(fs.readFileSync('C:/tuerca/firebase.json', 'utf8'));
  const ignora = fb.hosting.ignore || [];
  for (const patron of ['ui/lamina.png', 'ui/lamina1.png', 'ui/*-pezas/**']) {
    afirmar(ignora.includes(patron), `falta "${patron}" no ignore de firebase.json`);
  }
  /* ...e as que fan falla NON poden estar excluídas. */
  const usadas = [...CSS.matchAll(/url\('\.\.\/ui\/([^']+)'\)/g)].map((m) => m[1]);
  afirmar(usadas.length > 0, 'o CSS xa non referencia imaxes de ui/: revisa esta proba');
  for (const img of usadas) {
    afirmar(fs.existsSync('C:/tuerca/i/ui/' + img), `o CSS usa ui/${img} e non existe`);
    afirmar(!ignora.some((p) => p === 'ui/**' || p === 'ui/' + img),
      `ui/${img} úsase no CSS pero está no ignore de firebase.json`);
  }
});

proba('o JS non se pode cachear máis ca o index.html', () => {
  /* O peor fallo desta tanda non estaba no xogo: estaba no despregue.

     index.html carga vinte e pico <script src="js/..."> sen versión no
     URL. Firebase, sen cabeceiras declaradas, serve o index.html sen
     caché pero os .js cunha hora. Resultado: durante unha hora despois
     de cada deploy, quen xa entrara antes recibe o HTML NOVO co
     JavaScript VELLO.

     Iso non é unha molestia: é un xogo roto. Ao quitar do index.html o
     <div id="memorial"> —que o JS novo xa non usa— o JS vello seguía
     buscándoo, atopaba null e showHangar caía enteiro na primeira
     pintada. Pantalla morta, e só nos que xa xogaran antes: en local e
     nunha pestana nova víase perfectamente.

     Non chega con lembrar refrescar. Calquera cambio que toque á vez o
     HTML e o JS ten a mesma trampa, e ao subir non se sabe quen ten que
     na caché. A regra: os tres que se editan xuntos —html, js, css—
     revalidan sempre. "no-cache" non quere dicir non gardar; quere dicir
     preguntar antes de usar, e a resposta case sempre é un 304 baleiro.

     As imaxes e as voces quedan coa caché por defecto: pesan moito, non
     cambian case nunca e non teñen esta dependencia cruzada. */
  const fb = JSON.parse(fs.readFileSync('C:/tuerca/firebase.json', 'utf8'));
  const cabeceiras = fb.hosting.headers || [];

  const regra = cabeceiras.find((h) => /\bjs\b/.test(h.source) && /\bcss\b/.test(h.source) &&
                                       /\bhtml\b/.test(h.source));
  afirmar(regra,
    'firebase.json non declara Cache-Control para js/css/html: o JS cachearase ' +
    'unha hora contra un index.html sen caché e romperá o xogo despois de cada deploy');

  const cc = (regra.headers || []).find((h) => h.key === 'Cache-Control');
  afirmar(cc && /no-cache|no-store|max-age=0/.test(cc.value),
    `Cache-Control de js/css/html é "${cc ? cc.value : 'nada'}": ten que revalidar`);

  /* E que non haxa scripts con versión no URL que fixesen isto redundante
     sen que ninguén o soubese: se algún día se engade, esta proba ten que
     revisarse en vez de quedar aí dando unha falsa seguridade. */
  const conVersion = [...HTML.matchAll(/<script src="([^"]+\?[^"]*)"/g)];
  afirmar(conVersion.length === 0,
    'hai <script> con versión no URL: se se pasa a cache-busting por nome, ' +
    'esta proba sobra e hai que quitala, non deixala aquí de adorno');
});

proba('a pantalla con imaxe non colapsa co contido curto', () => {
  /* O modal ábrese como flex, e un elemento flex sen ancho DEFINIDO
     encolle ata o seu contido. Con listas longas non se nota —o contido
     xa chega aos 980 px— pero cun memorial baleiro, "sen caídos
     rexistrados" son catro palabras e a caixa colapsaba a 265 px:
     quedaba unha faixa vertical da imaxe, que nesa zona é o corredor
     escuro, e parecía que non se cargara ningún fondo.

     As marxes en porcentaxe do contido tampouco salvan: ao calcular o
     ancho natural cóntanse como cero, así que a caixa nin sabía que tiña
     que ser ancha.

     Non o colleu ningunha das capturas de revisión porque TODAS tiñan
     contido longo. De aí a proba: o caso curto non se mira nunca a ollo,
     e é onde vive.

     Compróbase o que se pode comprobar sen motor de deseño: que a regra
     declare un ancho e non só un máximo. */
  const bloque = CSS.match(/#bioModal\[data-fondo\]\s*\.inner\s*\{([^}]*)\}/);
  afirmar(bloque, 'non se atopa a regra de #bioModal[data-fondo] .inner');
  const corpo = bloque[1];
  afirmar(/(^|[;\s])width\s*:/.test(corpo),
    'a caixa da pantalla con imaxe só declara max-width. Como é un elemento ' +
    'flex, sen "width" encolle ata o contido e coas pantallas baleiras ' +
    'colapsa a unha faixa na que non se recoñece a imaxe');
  afirmar(/max-width\s*:/.test(corpo),
    'falta o max-width: sen tope, a imaxe estirábase a toda a fiestra');
});

proba('ningún url() inxectado desde o JS leva ruta relativa', () => {
  /* A trampa máis fina de toda esta tanda.

     Un url() dentro dunha VARIABLE de CSS resólvese contra a folla de
     estilos que a USA, non contra onde se declara. fondoModal poñía
     --fondo: url('ui/fondo_X.jpg') nun atributo style —base: o
     documento— pero quen a consome é css/style.css, así que o navegador
     pedía css/ui/fondo_X.jpg. Non existe. Caixa negra, sen erro ningún.

     E o que fixo que durase: as capturas de revisión facíanse sobre
     dist/tuerca.html, que leva o CSS INCRUSTADO. Alí as dúas bases son a
     mesma e funciona perfectamente. O fallo só existía na versión de
     ficheiros separados, que é xustamente a que se despregou e se xoga.
     Dez capturas seguidas dando o visto e prace a algo que na web estaba
     roto.

     A regra, entón: calquera url() que naza no JS ten que ser absoluto.
     new URL(ruta, document.baseURI).href resólveo e xa non depende de
     quen o interprete nin de como se empaquete o xogo. */
  const path2 = require('path');
  const DIR = path2.join(__dirname, '..', 'i', 'js');

  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.js'))) {
    const t = fs.readFileSync(path2.join(DIR, f), 'utf8');
    /* url(...) dentro dun literal de JS que non empeza por http, / , data:
       ou unha interpolación xa resolta. Só nas liñas que van a un estilo. */
    const re = /(setProperty|style\.[A-Za-z]+\s*=|cssText\s*=)[^\n]*url\(\s*["'`]?([^"'`)\$]+)/g;
    let m;
    while ((m = re.exec(t)) !== null) {
      const ruta = m[2].trim();
      afirmar(/^(https?:|\/|data:|blob:)/.test(ruta),
        `${f}: inxéctase desde o JS url(${ruta}), que é relativo. ` +
        'Se o consome unha folla de estilos aparte, o navegador resólveo ' +
        'contra ELA e non contra o documento. Usa ' +
        'new URL(ruta, document.baseURI).href');
    }
  }
});

proba('o idioma do documento non está fixado no markup', () => {
  const m = HTML.match(/<html[^>]*lang="([^"]+)"/);
  afirmar(m, 'o <html> non declara lang');
  afirmar(m[1] === 'gl', `o lang inicial debería ser o idioma por defecto (gl), é "${m[1]}"`);
  const i18n = fs.readFileSync('C:/tuerca/i/js/00b-i18n.js', 'utf8');
  afirmar(/documentElement\.lang\s*=\s*I18N\.lang/.test(i18n),
    'aplicarIdioma() non actualiza o lang do documento ao cambiar de idioma');
});

proba('os tres dicionarios teñen exactamente as mesmas claves', () => {
  const S = cargarXogo();
  const L = S.aval('LANGS');
  const gl = Object.keys(L.gl);
  for (const lang of ['es', 'en']) {
    const faltan = gl.filter((k) => !(k in L[lang]));
    const sobran = Object.keys(L[lang]).filter((k) => !(k in L.gl));
    afirmar(!faltan.length, `[${lang}] faltan ${faltan.length} claves: ${faltan.slice(0, 8).join(', ')}`);
    afirmar(!sobran.length, `[${lang}] sobran ${sobran.length} claves: ${sobran.slice(0, 8).join(', ')}`);
  }
});

proba('non hai entradas inglesas sen traducir', () => {
  /* Ter a clave non abonda: se o valor inglés é idéntico ao galego, o
     xogador ve galego aínda que o dicionario pareza completo. Estas
     coinciden a propósito (siglas, formatos, palabras iguais). */
  const IGUAIS_A_PROPOSITO = new Set([
    'mm.rival', 'hud.radarNeutral', 'mun.fase.semi', 'trait.PROTECTOR',
    'deb.skillUp', 'bio.base', 'ct.conf',
  ]);
  const S = cargarXogo();
  const L = S.aval('LANGS');
  const sospeitosas = Object.keys(L.gl).filter((k) => {
    if (IGUAIS_A_PROPOSITO.has(k)) return false;
    const a = L.gl[k], b = L.en[k];
    return typeof a === 'string' && typeof b === 'string' &&
           a === b && a.length > 3 && /[a-záéíóúñ]/i.test(a);
  });
  afirmar(!sospeitosas.length,
    `${sospeitosas.length} entrada(s) inglesas idénticas ao galego: ` +
    sospeitosas.slice(0, 8).map((k) => `${k}=${JSON.stringify(L.en[k])}`).join(', '));
});

proba('os rótulos de grupo non levan texto no markup', () => {
  /* Metéranse literais na v0.68 e quedaron sen traducir ata a v0.73. */
  const re = /<span class="rotulo"([^>]*)>([\s\S]*?)<\/span>/g;
  let m, n = 0;
  while ((m = re.exec(HTML))) {
    n++;
    const [, attrs, dentro] = m;
    const visible = dentro.replace(/<!--[\s\S]*?-->/g, '').trim();
    afirmar(!visible, `un rótulo leva texto no HTML: ${JSON.stringify(visible)}`);
    afirmar(/data-rot=/.test(attrs), 'un rótulo non declara a súa clave data-rot');
  }
  afirmar(n > 0, 'non se atopou ningún rótulo: cambiou o markup?');
});

proba('cambiar de idioma repinta o roster', () => {
  /* O roster non é chrome: constrúese como HTML dentro de showHangar(),
     e aplicarIdioma() traballa por ids, así que non o toca. Sen esta
     chamada, a lista queda conxelada no idioma no que se pintou. */
  const i18n = fs.readFileSync('C:/tuerca/i/js/00b-i18n.js', 'utf8');
  const corpo = i18n.slice(i18n.indexOf('function setLang'));
  const fin = corpo.indexOf('\n}');
  afirmar(/showHangar\s*\(\)/.test(corpo.slice(0, fin)),
    'setLang() xa non repinta o hangar: o roster quedará no idioma anterior');
});

proba('ningún selector global de tipo estira todos os canvas', () => {
  /* Había unha regra `canvas{width:100%; background:verde; border:...}`
     pensada para o mapa de batalla. Ao ser un selector de TIPO collía
     calquera canvas do documento: un temporal de 100x120 que quedase
     solto no body convertíase nunha franxa verde a todo o ancho da
     páxina. Aquí evítase que volva. */
  const regras = CSS.replace(/\/\*[\s\S]*?\*\//g, '')       /* fóra comentarios */
    .split('}').map(r => r.trim()).filter(Boolean);
  for (const regra of regras) {
    const [selector, corpo = ''] = regra.split('{');
    const sels = selector.split(',').map(s => s.trim());
    for (const s of sels) {
      if (s !== 'canvas') continue;
      afirmar(!/width\s*:\s*100%/.test(corpo),
        'hai unha regra `canvas` global que estira todos os canvas; ' +
        'acóutaa a #cv ou ao contedor que corresponda');
    }
  }
});

proba('o retrato temporal do arquivo retírase mesmo se peta o debuxo', () => {
  /* O removeChild estaba dentro do try, así que unha excepción en
     drawPortrait deixaba o canvas pendurado do body para sempre. */
  const diario = fs.readFileSync('C:/tuerca/i/js/14-diario.js', 'utf8');
  const veces = (diario.match(/document\.body\.appendChild\(tmp\)/g) || []).length;
  afirmar(veces > 0, 'cambiou o código do arquivo: revisa esta proba');
  const enFinally = (diario.match(/finally\s*\{\s*tmp\.remove\(\)/g) || []).length;
  afirmar(enFinally === veces,
    `${veces} canvas temporais engádense ao body pero só ${enFinally} se retiran en finally`);
});

proba('o botón de voz segue o idioma nos seus tres estados', () => {
  const S = cargarXogo();
  const setLang = S.aval('setLang');
  const TXT = S.aval('TXT');
  for (const lang of ['gl', 'es', 'en']) {
    setLang(lang, { persist: false });
    for (const clave of ['voz.off', 'voz.chios', 'voz.toda']) {
      const t = TXT(clave);
      afirmar(typeof t === 'string' && t.length > 0 && t !== clave,
        `[${lang}] falta a tradución de ${clave} (saíu ${JSON.stringify(t)})`);
    }
  }
});

proba('todo fondo que se xera úsase nalgunha pantalla', () => {
  /* tools/xerar_fondos.js converte todo art/fondo*.png e o build
     publícaos por patrón. Iso ten unha fenda: un fondo que se xera e non
     se engancha a ningunha pantalla despréganse igual, pesando, e non hai
     nada que o diga. Pasou con fondo_arquivo.jpg — 138 KB subíndose a
     produción para nada, e só se descubriu porque alguén preguntou.

     Compróbase contra os dous xeitos de usalo: fondoModal('nome') desde
     o JS ou unha url() no CSS. */
  const path2 = require('path');
  const RAIZ = path2.join(__dirname, '..', 'i');
  const UI = path2.join(RAIZ, 'ui');
  if (!fs.existsSync(UI)) return;
  const fondos = fs.readdirSync(UI)
    .filter((f) => /^fondo_[a-z0-9]+\.jpg$/.test(f))
    .map((f) => f.replace(/^fondo_|\.jpg$/g, ''));
  afirmar(fondos.length > 0, 'non hai fondos en i/ui/: revisa esta proba');

  const js = fs.readdirSync(path2.join(RAIZ, 'js'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path2.join(RAIZ, 'js', f), 'utf8'))
    .join('\n');

  for (const nome of fondos) {
    const noJs = js.includes(`fondoModal('${nome}')`);
    const noCss = CSS.includes(`fondo_${nome}.jpg`);
    afirmar(noJs || noCss,
      `fondo_${nome}.jpg xérase e publícase pero non o usa ningunha ` +
      'pantalla: ou se engancha ou se saca de art/');
  }
});

proba('toda pantalla que abre o modal decide o seu fondo, e non nunha rama', () => {
  /* A proba de arriba mira os fondos e pregunta se alguén os usa. Esta
     mira ao revés: as PANTALLAS, e pregunta se cada unha decide.

     Fan falla as dúas, porque o fallo real non o collía ningunha das
     anteriores. fondoModal('cantina') estaba escrito —así que a cantina
     "usábase"— pero dentro do `if(roster.length < 2)`: só había fondo coa
     cantina BALEIRA, que é o único caso que case non se ve. E showLobby
     nin poñía nin limpaba, así que o vestíbulo de duelo herdaba a nave do
     taller se viñas de alí.

     A regra: para CADA apertura do modal ten que haber antes unha chamada
     a fondoModal con sangría MENOR OU IGUAL. Iso é o mesmo bloque ou un
     que o contén, é dicir, un camiño que a apertura atravesa seguro; unha
     chamada máis sangrada está nunha rama e pode non executarse.

     Compróbanse todas as aperturas e non só a primeira, porque o fallo da
     cantina estaba precisamente na segunda: a primeira saída —a baleira—
     si tiña fondo ao lado.

     Compárase a sangría e non a estrutura real do bloque: é unha
     aproximación, e dous bloques irmáns coa mesma sangría pasarían. Colle
     a familia enteira de fallos que xa apareceron e non precisa un
     analizador sintáctico. */
  const path2 = require('path');
  const DIR = path2.join(__dirname, '..', 'i', 'js');
  const ABRE = /\$\('bioModal'\)\.style\.display\s*=\s*'(flex|block)'/;
  const DECIDE = /^(\s*)fondoModal\(/;
  const sangria = (l) => l.length - l.trimStart().length;

  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.js'))) {
    const liñas = fs.readFileSync(path2.join(DIR, f), 'utf8').split('\n');
    let fn = null, corpo = [];
    const revisar = () => {
      if (!fn) return;
      corpo.forEach((l, i) => {
        if (!ABRE.test(l)) return;
        const cuberta = corpo.slice(0, i).some(
          (p) => DECIDE.test(p) && sangria(p) <= sangria(l));
        afirmar(cuberta,
          `${f}:${fn}() abre o modal sen que fondoModal() estea garantido ` +
          'nese camiño. Ou chama a fondoModal(<nome>), ou a fondoModal(null) ' +
          'para limpar o da pantalla anterior, pero fóra da rama.');
      });
    };
    for (const l of liñas) {
      const m = /^function\s+([A-Za-z0-9_]+)/.exec(l);
      if (m) { revisar(); fn = m[1]; corpo = []; continue; }
      if (fn) corpo.push(l);
    }
    revisar();
  }
});
