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
