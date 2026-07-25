# ■ TUERCA

RTS territorial estilo *Z* onde cada unidade ten nome, memoria, corpo único e
dereito a morrer mal. HTML/Canvas puro, cero dependencias de build.

## Estructura

```
tuerca/
├── index.html              ← FONTE: abre isto para desenvolver (multi-ficheiro)
├── css/style.css
├── js/
│   ├── config.js           ← credenciais Firebase (NON vai ao repo)
│   ├── config.example.js   ← plantilla: copia a config.js e enche
│   ├── 00-preambulo.js     ← TUERCA_V (versión: fonte única), facción
│   ├── 00b-i18n.js         ← galego/castelán/inglés, chrome por ids
│   ├── 01-nucleo-datos.js  ← storage, export/import, crónica
│   ├── 01b-assets.js       ← sprites base64 (xerado; non editar á man)
│   ├── 02-pvp-lobby.js     ← salas Firebase, presenza, chat
│   ├── 03-pvp-sync.js      ← batalla host-autoritaria, snaps, predición
│   ├── 04-progresion.js    ← skills, reconstructor, desmantelamento, campaña
│   ├── 05-mapa-camara-neboa.js
│   ├── 06-audio-voces.js   ← audio procedural, música, voces
│   ├── 06b-voz.js          ← síntese de voz do sistema
│   ├── 07-terreo-batalla.js
│   ├── 08-social-narrativa.js  ← subquests, HQ, VOLT, grises, escudo
│   ├── 09-economia-combate.js  ← chatarra, cobertura, cháchara, IA
│   ├── 10-estructuras.js   ← torretas, vehículos, draw() principal
│   ├── 11-retratos-ui.js   ← retratos, panel lateral, loop() do xogo
│   ├── 12-debrief-hangar.js
│   ├── 13-mundial.js       ← modo MUNDIAL (torneo, XI contra XI)
│   ├── 14-diario.js        ← ARQUIVO: a crónica lexible no xogo
│   ├── 15-luz.js           ← luz, po e viñeta (pasada de composición)
│   ├── 16-estado.js        ← columna de estado e axuda do hangar
│   ├── 17-ambiente.js      ← cama de son procedural (vento, motores)
│   └── 99-boot.js          ← arranque que depende de módulos posteriores
├── voces/                  ← .ogg por idioma + manifest.json
├── tools/                  ← xerar o manifest e placeholders de voz
├── dist/tuerca.html        ← ARTEFACTO: o ficheiro único que se publica
├── build.py                ← reensambla dist/ desde a fonte
└── database.rules.json     ← regras de seguridade da Realtime Database
```

## Versión

`TUERCA_V`, en `js/00-preambulo.js`, é o **único** sitio onde se toca. Del
derivan o `<title>`, o subtítulo da portada, o selo do hangar, a cabeceira do
duelo online, o pé dos erros e o campo `v` que se publica nas salas de
Firebase (compatibilidade entre host e convidado). O markup non leva número
de versión ningún, para que non poida quedar rancio.

**Regra de ouro**: os ficheiros de `js/` concaténanse en orde e comparten o
ámbito global (scripts clásicos, sen módulos ES). Editar calquera ficheiro e
recargar `index.html` = desenvolvemento. `python3 build.py` = publicación.

## Fluxo de traballo

1. Desenvolver contra `index.html` (os cambios vense recargando).
2. `python3 build.py` → `dist/tuerca.html` (o ficheiro único de sempre).
3. Publicar SÓ o dist (itch.io, GitHub Pages, o que sexa).

## Luz, sombras e atmosfera (v0.66-67)

`js/15-luz.js` non toca nin un sprite: o mundo debúxase igual que sempre e a
capa actúa DESPOIS, en espazo de pantalla, entre o `ctx.restore()` da cámara
e o HUD (que así queda lexible). Mapa de luz por hora do día → `multiply`
sobre a escena → bloom dos focos → po con parallaxe → viñeta.

Os focos saen do que xa contaba o xogo: portas de fábrica mentres producen,
luces de perímetro dos sectores, fogonazos dos tracers e chispas do sistema
de FX. O ambiente vén do **mesmo reloxo** que pinta o HUD (09:00 → ~19:00),
así que unha batalla longa remata ao solpor.

As tropas levan **luz propia** (`LUZ.tropas`): sen ela o `multiply` afogábaas,
porque son pequenas e detalladas e é o que hai que ler. É neutra a propósito
—tinguila por bando empeoraría a lexibilidade de quen non distingue azul de
vermello— e non fai bloom, ou parecerían farois andando.

As **sombras proxectadas** (`sombrasDebuxar`, `SOMBRA`) non van na capa de
composición senón dentro de `draw()`, en coordenadas de mundo, xusto despois
do chan e antes do sólido: así pousan sobre as plataformas de sector e cada
sprite tapa a súa. A dirección sae da mesma hora que o ambiente — o sol
crúzase de lado a lado e as sombras cambian de man ao pasar o mediodía.

En batalla: **L** acende e apaga (persistente), **K** percorre as horas para
ver o solpor sen agardar. Todo é axustable en vivo desde a consola, que `LUZ`
e `SOMBRA` son globais; con `LUZ.forza = 0` a escena queda como antes.

As scanlines do CSS baixaron de `.18` a `.05` (variable `--scan` en
`css/style.css`): co mapa de luz por baixo, sobraba reixa.

## Ver o que se fai (capturas)

```
node tools/captura.js hangar
node tools/captura.js batalla --hora 18 --pasos 3000
node tools/captura.js batalla --sen-luz --saida capturas/antes.png
```

Renderiza o xogo de verdade —mesmo motor Chromium, JS executado, CSS
aplicado— e garda un PNG en `capturas/` (ignorado por git). Serve para
comparar antes/despois dun cambio visual sen abrir nada a man.

Cero dependencias: usa o Chrome ou o Edge que xa estea instalado.

Dúas trampas que xa están resoltas dentro da ferramenta, por se algún día
hai que tocala: o executable **devolve o control antes de escribir o PNG**
(hai que agardar a que o ficheiro apareza e deixe de medrar, non a que o
proceso remate), e sen `--user-data-dir` propio o encargo deléganse nunha
instancia xa aberta e a sonda temporal bórrase antes de cargarse.

## Ambiente sonoro (v0.74)

`js/17-ambiente.js` pon a capa que faltaba: ata agora TUERCA só soaba cando
pasaba algo e entre medias había silencio. Procedural, sen un só ficheiro de
audio, e todo colga de `masterGain` — así que a tecla **M** apaga tamén isto.

Dúas escenas: no **hangar** unha nave pechada (motores, ventilación, golpes de
taller); en **batalla** campo aberto (vento e metal moi ao lonxe). Cámbianse
soas co ecrán, desde o mesmo observador de `99-boot.js` que xa sabía cando se
ve o hangar.

O **agachado reactivo** é o que fai que funcione: canto máis tiroteo hai, máis
baixa a cama. Sen iso o ambiente pelexa cos disparos e non se entende nada. O
nivel sae dos tracers vivos, que xa é o que mide o combate en curso. Baixa ata
o 45%, non desaparece: aparta, non se vai.

Detalles que evitan que soe a zumbido: ruído **rosa** e non branco (o branco
sae sibilante e cansa aos dous minutos), o corte do filtro e o volume respiran
con osciladores lentos, e a maquinaria son dous osciladores desafinados a 43 e
44.6 Hz — o batido entre eles é o que fai que soe a motor grande e non a nota.

**Shift+A** acende e apaga (persistente). Vai con Shift porque `a` soa move a
cámara. Axustable en vivo desde a consola: `AMB.vol`, `AMB.agachar`.

## Probas

```
npm test          # ou: node test/run.js
```

Viven en `test/`, na **raíz** do repo e non aquí dentro: `firebase.json`
publica `i/` enteiro e as probas non teñen por que ir ao servidor.

`test/arnes.js` carga os 20 módulos de `js/` nun contexto de `vm` cun DOM,
canvas e Web Audio falsos, así que a simulación corre en Node sen navegador
—unhas 12× máis rápido que tempo real—. A lista de ficheiros do arnés ten
que estar en sintonía coa de `build.py`.

**A simulación non é reproducible.** Fai 65 chamadas a `Math.random()` no
seu camiño de execución, así que non se pode afirmar "mesma entrada → mesmo
estado final". Por iso as probas son de *fuzz*: moitas partidas distintas
comprobando invariantes que teñen que cumprirse saia o que saia o dado
(nada de NaN, ninguén fóra do mapa, `hp` coherente con `dead`, toda batalla
remata). Sementar o xerador sería un proxecto aparte, e desbloquearía
repeticións de batalla, informes de erro reproducibles e PvP en lockstep.

`probaPendente()` marca bugs coñecidos sen arranxar: non tinguen a suite de
vermello, pero se algún día pasan, a suite **falla** para que non se
esquezan.

## Seguridade — LER ISTO

**A apiKey de Firebase NON é un segredo.** Identifica o proxecto, non autoriza
nada: calquera app web de Firebase lévaa visible no cliente por deseño. Ocultala
nun backend non protexe nada por si só.

**A protección real, por orde de importancia:**

1. **Regras da Realtime Database** (`database.rules.json`): son o único muro de
   verdade. Súbeas na consola de Firebase (Realtime Database → Regras). As deste
   repo: raíz pechada, `salas/` con nomes validados e snaps limitados en tamaño.
2. **Firebase App Check** (consola → App Check, provedor reCAPTCHA v3): fai que
   só o teu dominio publicado poida falar coa base de datos. É o "backend" que
   necesitas sen escribir un backend.
3. **Rotar a clave actual**: a apiKey vella xa anda publicada nos HTML antigos.
   Consola → Configuración do proxecto → xerar nova app web, e restrinxir a
   clave en Google Cloud Console → Credenciais (referrers HTTP do teu dominio).
4. `js/config.js` está en `.gitignore`: o repo público leva só o `example`.

**¿E un backend de verdade?** Só faría falla se algún día queres: contas de
usuario, matchmaking global, ou lóxica autoritaria fóra do host. Para o duelo
por salas actual, regras + App Check dan a mesma protección sen servidor que
manter.

## Requisitos

Ningún. Un navegador. Para o build, Python 3 (só stdlib).
