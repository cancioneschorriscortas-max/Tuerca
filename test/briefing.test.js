/* ============================================================
   O BRIEFING FALA O IDIOMA DO XOGADOR, E NINGUÉN QUEDA MUDO.

   Dous defectos que se viron xogando en inglés na mesma pantalla:

   1. A liña de datos da unidade —clase, personalidade, estado,
      confianza, equipamento— construíase a man en galego. A interface
      ía en inglés e a ficha da unidade en galego, na mesma caixa.

   2. R-06 'YURI', un SNIPER, saía dicindo «...». Non era carácter: a
      táboa de frases só ten GRUNT, HEAVY e ENGINEER. SNIPER e
      BOMBARDERO nunca tiveron liñas de briefing en NINGÚN dos tres
      idiomas, e o fallback a '...' tapábao. Dúas das cinco clases
      mudas nun xogo que vende que cada robot ten carácter.
   ============================================================ */
const { proba, afirmar } = require('./probar.js');
const { cargarXogo, asentar } = require('./arnes.js');

const CLASES = ['GRUNT', 'SNIPER', 'ENGINEER', 'HEAVY', 'BOMBARDERO'];
const PERS = ['LEAL', 'NERVIOSO', 'IRONICO', 'ESTOICO', 'CINICO'];
const ESTADOS = ['LEAL', 'SARCASTICO', 'DESCONFIADO', 'AUTOPRESERVACION'];

proba('personalidade e estado teñen texto nas tres linguas', async () => {
  const S = cargarXogo();
  await asentar();
  const LANGS = S.aval('LANGS');
  for (const lang of ['gl', 'es', 'en']) {
    for (const p of PERS) {
      afirmar(LANGS[lang]['pers.' + p], `falta pers.${p} en ${lang}`);
    }
    for (const e of ESTADOS) {
      afirmar(LANGS[lang]['estc.' + e], `falta estc.${e} en ${lang}`);
    }
    afirmar(LANGS[lang]['br.meta2'], `falta br.meta2 en ${lang}`);
  }
});

proba('a liña de datos do briefing non leva galego escrito a man', async () => {
  const fs = require('fs');
  const path = require('path');
  const js = fs.readFileSync(
    path.join(__dirname, '..', 'i', 'js', '12-debrief-hangar.js'), 'utf8');
  /* Hai DÚAS liñas que escriben brMeta: a do comunicado de ÓPTIMA (que
     usa br.meta) e a da unidade (br.meta2). Interesa a segunda. */
  const i = js.lastIndexOf("$('brMeta').textContent");
  const bloque = js.slice(i, i + 600);
  for (const palabra of ['estado ', 'confianza ', 'ASIGNADO POLO HQ']) {
    afirmar(!bloque.includes("`" + palabra) && !bloque.includes("'" + palabra),
      `a liña do briefing aínda leva "${palabra}" escrito a man en vez de TXT()`);
  }
  afirmar(/TXT\('br\.meta2'/.test(bloque), 'brMeta xa non usa a clave br.meta2');
});

proba('ningunha clase queda muda no briefing, en ningún idioma', async () => {
  /* Esta é a que importa. Vaise por TODAS as combinacións que o xogo
     pode producir e esíxese que saia algo. O '...' non conta como frase
     salvo en AUTOPRESERVACION, onde calar SI é carácter. */
  const S = cargarXogo();
  await asentar();
  const pickFrase = S.aval('pickFrase');
  const I18N = S.aval('I18N');
  const PT = S.aval('PT');

  const mudos = [];
  for (const lang of ['gl', 'es', 'en']) {
    I18N.lang = lang;
    for (const cls of CLASES) {
      for (const pers of PERS) {
        /* estadoConfianza deriva o estado da confianza; dáselle un valor
           alto para caer en LEAL/SARCASTICO, que é o caso normal. */
        const u = { team: PT, cls, personalidad: pers, confianza: 80 };
        const f = pickFrase(u, 'briefing');
        if (!f || f === '...') mudos.push(`${lang}/${cls}/${pers}`);
      }
    }
  }
  I18N.lang = 'gl';
  afirmar(mudos.length === 0,
    `${mudos.length} combinacións sen frase de briefing: ${mudos.slice(0, 8).join(', ')}`);
});
