#!/usr/bin/env node
/* ============================================================
   Xera i/voces/GUION.md desde o CÓDIGO e o DICIONARIO.

   Nada do que hai no documento está escrito a man: as claves saen
   de buscar as chamadas reais (vozMando / vozComentarista / hqSay)
   e as frases saen de 00b-i18n.js nas tres linguas. As únicas
   excepcións son as ADAPTACIÓNS de aquí abaixo, que van marcadas
   no documento cun asterisco e coa razón.

   Uso: node tools/xerar-guion.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { cargarXogo } = require('../test/arnes.js');

const JS = path.join(__dirname, '..', 'i', 'js');
const L = cargarXogo().aval('LANGS');

/* Claves que o xogo pide de verdade, coa liña onde. */
const _pedidas = new Map();
for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
  fs.readFileSync(path.join(JS, f), 'utf8').split('\n').forEach((l, i) => {
    if (!/voz(Mando|Comentarista)\s*\(|hqSay\s*\(/.test(l)) return;
    for (const m of l.matchAll(/[`'"]([a-z]+\.[A-Za-z0-9_]+)[`'"]/g)) {
      if (!_pedidas.has(m[1])) _pedidas.set(m[1], `${f}:${i + 1}`);
    }
  });
}
const CLAVES = [..._pedidas.keys()].sort().map((k) => ({
  k, onde: _pedidas.get(k), var: /\{[a-z]+\}/i.test(L.gl[k] || ''),
  gl: L.gl[k] || null, es: L.es[k] || null, en: L.en[k] || null,
}));

/* Adaptacións: texto de interface que non se le en alto, frases con
   variables que hai que dicir sen o dato, e as que non teñen texto. */
const ADAPTA = {
  'r.baseAtaque': { por: 'o texto do dicionario leva "(clic para ir)", que é interface',
    gl: 'Base baixo ataque. Todas as unidades dispoñibles, ao HQ.',
    es: 'Base bajo ataque. Todas las unidades disponibles, al HQ.',
    en: 'Base under attack. All available units, fall back to HQ.' },
  'hq.clima': { por: 'leva {label} e {vis}',
    gl: 'Parte meteorolóxico. Visibilidade reducida.',
    es: 'Parte meteorológico. Visibilidad reducida.',
    en: 'Weather report. Visibility reduced.' },
  'hq.oleada': { por: 'leva o número de oleada',
    gl: 'Oleada neutralizada. Recarguen.',
    es: 'Oleada neutralizada. Recarguen.',
    en: 'Wave neutralized. Reload.' },
  'hq.portador': { por: 'leva a peza e o nome',
    gl: 'Sinal de material propio nunha unidade hostil. Recuperádeo.',
    es: 'Señal de material propio en una unidad hostil. Recuperadlo.',
    en: 'Friendly materiel detected on a hostile unit. Recover it.' },
  'hq.senResposta': { por: 'leva o nome do operador',
    gl: 'Operador... sen resposta.',
    es: 'Operador... sin respuesta.',
    en: 'Operator... no response.' },
  'mun.gol': { por: 'leva o marcador',
    gl: 'GOL! Sector dominado! Que berre o hangar!',
    es: '¡GOL! ¡Sector dominado! ¡Que grite el hangar!',
    en: 'GOAL! Sector dominated! Let the hangar roar!' },
  'mun.golRival': { por: 'leva o marcador',
    gl: 'Gol do rival... silencio no hangar. Hai que apertar.',
    es: 'Gol del rival... silencio en el hangar. Hay que apretar.',
    en: 'They score... the hangar goes quiet. Time to push.' },
  'mun.final': { por: 'leva o marcador',
    gl: 'Pitido final! Ata aquí o partido.',
    es: '¡Pitido final! Hasta aquí el partido.',
    en: 'Full time! That is all.' },
  'mun.primeiro': { por: 'non hai texto no dicionario; ademais úsase para as dúas baixas, a nosa e a deles, así que ten que valer para ambas',
    gl: 'Primeira baixa do partido! Xa hai aceite no céspede!',
    es: '¡Primera baja del partido! ¡Ya hay aceite en el césped!',
    en: 'First casualty of the match! There is oil on the pitch!' },
  'mun.saqueHQ': { por: 'non hai texto no dicionario',
    gl: 'Comeza o encontro! Que rode o balón!',
    es: '¡Comienza el encuentro! ¡Que ruede el balón!',
    en: 'And we are under way! Let it roll!' },
};

/* Non se gravan, e por que. */
const FÓRA = {
  'hq.sqPrima': 'É un anaco que se pega ao final de hq.sqDone (" Prima: {n} de chatarra"), non unha frase. O importe varía. Queda en texto.',
};

/* Bloques por voz. */
const BLOQUES = [
  { id: 'op', voz: 'MANDO', titulo: 'Operación',
    nota: 'Sóanse en TODAS as partidas, incluído o duelo online. Se só gravas un bloque, que sexa este.' },
  { id: 'r', voz: 'MANDO', titulo: 'Avisos de campo', nota: '' },
  { id: 'hq', voz: 'MANDO', titulo: 'Partes do cuartel xeral', nota: '' },
  { id: 'mun', voz: 'COMENTARISTA', titulo: 'Mundial', nota: '' },
  { id: 'br', voz: 'ÓPTIMA', titulo: 'Comunicados', nota: '' },
];

const limpar = (s) => (s || '')
  .replace(/\\u([0-9a-f]{4})/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
  .replace(/^[^\p{L}\p{N}¡¿]*/u, '').replace(/»$/, '').trim();

const porClave = Object.fromEntries(CLAVES.map((c) => [c.k, c]));
let gravables = 0;

function tabla(prefixo) {
  const ks = CLAVES.map((c) => c.k).filter((k) => k.split('.')[0] === prefixo && !FÓRA[k]).sort();
  if (!ks.length) return '';
  let s = '| Clave | Galego | Castelán | Inglés |\n|---|---|---|---|\n';
  for (const k of ks) {
    const c = porClave[k];
    const a = ADAPTA[k];
    const gl = a ? a.gl : limpar(c.gl);
    const es = a ? a.es : limpar(c.es);
    const en = a ? a.en : limpar(c.en);
    const marca = a ? ' **\\***' : '';
    s += `| \`${k}\`${marca} | ${gl} | ${es} | ${en} |\n`;
    gravables++;
  }
  const adaptadas = ks.filter((k) => ADAPTA[k]);
  if (adaptadas.length) {
    s += '\n' + adaptadas.map((k) => `**\\*** \`${k}\` — ${ADAPTA[k].por}.`).join('  \n') + '\n';
  }
  return s;
}
const bloques = BLOQUES.map((b) => ({ ...b, tabla: tabla(b.id) })).filter((b) => b.tabla);
const total = gravables;

const doc = `# TUERCA · Guión de gravación de voces

> **Xerado**, non escrito a man: \`node tools/voces.js\` cruza as claves que o
> código pide de verdade coas frases do dicionario. Se cambia o xogo, este
> documento queda vello — rexenérao ou comproba co informe de cobertura.

**${total} frases × 3 linguas = ${total * 3} ficheiros.**

## Como se nomean

O ficheiro chámase **exactamente como a clave**, en \`.ogg\`, na carpeta da lingua:

\`\`\`
voces/gl/op.inicio.ogg
voces/es/hq.peche30.ogg
voces/en/mun.gol.ogg
\`\`\`

Nada máis. Ao acabar: \`python tools/xerar_manifest.py\`. Non hai que tocar código.

## As tres voces

| Voz | Quen é | Ton |
|---|---|---|
| **MANDO / HQ** | Máquina operativa. Datos, prioridades, silencio. | Plano e seco, ritmo constante. **Nunca berra**, nin no aviso de base baixo ataque: sobe a urxencia, non o volume. Se dubidas, aburre máis. |
| **COMENTARISTA** | Radio deportiva do Mundial. | Enerxía, saturación, retranca de tarde de domingo. Aquí **si** se berra. |
| **ÓPTIMA** | A corporación. | Amable, pulido, lixeiramente inhumano. O ton de quen le unha nota de prensa sobre despedimentos. |

Idealmente **tres persoas distintas**. Que o HQ e ÓPTIMA soen igual regala a mellor broma do xogo.

---

${bloques.map((b) => `## ${b.titulo}\n\n*Voz: **${b.voz}***${b.nota ? '\n\n> ' + b.nota : ''}\n\n${b.tabla}`).join('\n---\n\n')}
---

## Ao ler en alto

**As cifras están en díxitos** ("30 segundos", "40%", "minuto 85"). Dise o
número, obviamente — pero dío **igual nas tres linguas**, porque o mesmo clip
non se vai regravar por iso.

**As palabras en MAIÚSCULAS** son énfase para a pantalla. Ao gravar,
tradúcense en acento: *ESCUDO DE SUBMINISTRO*, *MÁIS sectores*, *ENXEÑEIRO*.
Non se berran, márcanse.

---

## ÓPTIMA: aínda non hai nada que gravar

A terceira voz está deseñada e non ten unha soa liña conectada. \`br.comunicadoDe\`
existe no dicionario pero **ningunha chamada a pide**, así que gravala hoxe sería
gravar para nada.

Se queres a ÓPTIMA falando, é unha liña de código: unha cabeceira falada
("Comunicado de ÓPTIMA") ao pintar o comunicado no panel de estado, co corpo
quedando escrito. **Unha soa gravación serve para infinitos comunicados.**
Dimo e cablease antes de que graves.

Hai outras dúas na mesma situación —\`r.canal\` e \`r.hqVermello\`— que tiñan
ficheiro e ninguén as pedía. Están fóra deste guión a propósito.

---

## O que NON se grava

${Object.entries(FÓRA).map(([k, v]) => `- \`${k}\` — ${v}`).join('\n')}

Tampouco se grava nada dos robots entre eles: **iso son chíos procedurais e
seguirano sendo**. A voz humana é só do mando ao comandante, do comentarista e
de ÓPTIMA.

## Orde suxerida

1. **Operación + avisos de campo** (${(porClave['op.inicio'] ? 3 : 0) + 3} frases × 3 = 18 ficheiros). Con isto o xogo xa fala en todas as partidas.
2. **Mundial** — o modo con máis personalidade, e o que máis se nota.
3. **Partes do cuartel xeral** — o bloque longo, pero mecánico: mesmo ton, frases curtas, gravables dun tirón por lingua.

## Gravación

- Micro a un palmo, **fóra do eixo** (evita as explosivas).
- **Sala seca**: manta detrás e debaixo. O paso banda do post non quita a reverb, multiplícaa.
- WAV, **sen compresión nin EQ**. O carácter engádese despois; se vai na gravación, non hai volta atrás.
- Un ficheiro longo por bloque e córtase despois. Parar e retomar cambia o ton entre liñas.
- **Tres tomas seguidas de cada frase** e escolles despois.
- Medio segundo de silencio antes e despois.
- **Di a clave en voz alta antes de cada frase** ("op punto inicio, toma un"). Córtase despois e aforra unha hora de identificar ficheiros.
- Picos arredor de **−12 dBFS**. O \`loudnorm\` iguala despois; o clipping non se arranxa.

## Post

\`\`\`bash
ffmpeg -y -i entrada.wav \\
  -af "loudnorm=I=-18:TP=-2,highpass=f=250,lowpass=f=3400" \\
  -c:a libvorbis -q:a 3 voces/gl/op.inicio.ogg
\`\`\`

**MANDO e COMENTARISTA** co paso banda completo: é o son de radio.

**ÓPTIMA sen \`highpass\`/\`lowpass\`.** Non fala por radio de campaña, fala por
megafonía corporativa: limpa e próxima mentres todos os demais soan a lata. Ese
contraste é de balde e di máis do personaxe ca calquera diálogo.

## Comprobar

\`\`\`bash
python tools/xerar_manifest.py     # rexenera o manifesto
node tools/voces.js                # cobertura: que falta, que sobra, que está roto
node tools/voces.js --guion en     # o que queda por gravar nesa lingua
\`\`\`

O informe avisa de tres fallos silenciosos: **orfas** (hai ficheiro e o xogo non
o pide), **manifesto roto** (promete un ficheiro que non está) e **sen texto**
(sen gravación nin texto, o chío sintetizaría o nome da clave).
`;

fs.writeFileSync(path.join(__dirname, '..', 'i', 'voces', 'GUION.md'), doc, 'utf8');
console.log(`GUION.md: ${total} frases, ${total * 3} ficheiros`);
