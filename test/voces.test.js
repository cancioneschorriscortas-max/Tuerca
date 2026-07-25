/* ============================================================
   VOCES

   Había DOUS sistemas: o de 06b-voz.js (manifesto + chíos, bo) e
   un cargador vello que buscaba en `assets/voices/`, unha carpeta
   que non existe nin existiu. O vello disparaba 342 peticións HTTP
   fallidas por batalla e as súas funcións devolvían false sempre,
   así que os once sitios que as chamaban non facían nada.

   Estas probas evitan que volva, e vixían o outro fallo silencioso
   do sistema bo: un manifesto que promete ficheiros que non están.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { proba, afirmar } = require('./probar.js');

const RAIZ = 'C:/tuerca/i/';
const JS = RAIZ + 'js/';
const ficheiros = fs.readdirSync(JS).filter((f) => f.endsWith('.js'));
const codigo = (f) => fs.readFileSync(JS + f, 'utf8');
/* Fóra comentarios: as notas que explican o bug poden nomealo. */
const soCodigo = (f) => codigo(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

proba('non queda o cargador de voces vello', () => {
  const culpables = ficheiros.filter((f) => /assets\/voices/.test(soCodigo(f)));
  afirmar(!culpables.length,
    `aínda se buscan voces en assets/voices/, que non existe: ${culpables.join(', ')}`);
});

proba('non quedan chamadas ao sistema morto', () => {
  const culpables = [];
  for (const f of ficheiros) {
    for (const fn of ['playVoice', 'playSysVoice', 'tryLoadVoice']) {
      if (new RegExp(`\\b${fn}\\s*\\(`).test(soCodigo(f))) culpables.push(`${f}: ${fn}()`);
    }
  }
  afirmar(!culpables.length,
    `chámanse funcións que sempre devolvían false: ${culpables.join(', ')}`);
});

proba('o manifesto non promete ficheiros que non existen', () => {
  const m = JSON.parse(fs.readFileSync(RAIZ + 'voces/manifest.json', 'utf8'));
  const rotos = [];
  for (const [clave, linguas] of Object.entries(m)) {
    for (const [lang, ruta] of Object.entries(linguas)) {
      if (!fs.existsSync(path.join(RAIZ, ruta))) rotos.push(`${clave}[${lang}] -> ${ruta}`);
    }
  }
  afirmar(!rotos.length, `o manifesto apunta a ficheiros ausentes: ${rotos.join(', ')}`);
});

proba('ningunha voz acabaría dicindo o nome interno da clave', () => {
  /* A API é voz*(clave, texto). Se non hai gravación, o chío sintetízase
     do texto; e se non hai texto, sintetízao da CLAVE — "op.inicio" en
     vez dunha frase. Cada chamada ten que ter unha das dúas. */
  const i18n = codigo('00b-i18n.js');
  const temTexto = (k) => new RegExp(`['"]${k.replace('.', '\\.')}['"]\\s*:`).test(i18n);
  const malas = [];
  for (const f of ficheiros) {
    codigo(f).split('\n').forEach((l, i) => {
      if (!/voz(Mando|Comentarista)\s*\(/.test(l)) return;
      for (const mm of l.matchAll(/[`'"]([a-z]+\.[A-Za-z0-9_]+)[`'"](\s*,)?/g)) {
        const [, clave, conTexto] = mm;
        if (!conTexto && !temTexto(clave)) malas.push(`${f}:${i + 1} ${clave}`);
      }
    });
  }
  afirmar(!malas.length,
    `sen gravación nin texto, o chío diría a clave: ${malas.join(', ')}`);
});

proba('as claves de voz do mando teñen texto nas tres linguas', () => {
  const { cargarXogo } = require('./arnes.js');
  const S = cargarXogo();
  const L = S.aval('LANGS');
  const CLAVES = ['op.inicio', 'op.vitoria', 'op.derrota', 'r.baseAtaque',
                  'r.radarNoso', 'r.radarDeles'];
  for (const lang of ['gl', 'es', 'en']) {
    for (const k of CLAVES) {
      afirmar(typeof L[lang][k] === 'string' && L[lang][k].length > 3,
        `[${lang}] falta o texto de ${k}`);
    }
  }
});
