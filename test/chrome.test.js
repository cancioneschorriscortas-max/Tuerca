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
