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
