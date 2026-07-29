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

## Montaxe por pezas (v0.83)

Un robot que monte o xogador é unha combinación de pezas, e as combinacións
non se poden precociñar: cinco pezas en seis slots son 15.625 robots. O que
se precociña son as PEZAS, e o xogo apílaas. É o mesmo que facían os
ficheiros COF de Diablo II.

```
node tools/xerar_pezas_xogo.js            # renderiza e escribe js/19d-pezas.js
node tools/xerar_pezas_xogo.js --reusar   # só reencadra, cos renders en caché
node tools/banco_montaxe.js               # banco visual: as dúas vías xuntas
node tools/banco_montaxe.js --medir       # o mesmo, en números
node tools/proba_montaxe.js GRUNT --bordo # canto se afasta de renderizar a clase
```

Tres datos xerados, cada un porque se mediu que facía falla: `19d-pezas.js`
(un sprite por peza e capa, todos á mesma escala e no mesmo encadre),
`19c-orde.js` (en que orde van as capas, por estado e dirección: de fronte a
mochila vai debaixo e o brazo dereito enriba, de costas ao revés) e as
ancoras, xa proxectadas a píxeles. Nunha proxección ortográfica trasladar en
3D é trasladar en 2D, así que abonda con sumar.

**Onde se usa.** Un robot que sae do RECONSTRUCTOR debúxase polas súas
pezas, sen tocar nada: `entregarReconstruccion` garda en `rec.montaxe` de
que clase era o doador de cada peza, e o debuxo usa esa montaxe se existe.
Non fixo falla traducir vocabularios porque os TIPOS de peza que xa usaba a
economía de despece —CABEZA, CHASIS, BRAZO_DER…— son exactamente os nomes
dos slots da montaxe. Iso non estaba garantido, así que hai unha proba que
o vixía: se alguén renomea un dos dous, os robots reconstruídos volverían
saír coa aparencia da clase sen dar erro.

Cada peza vai no SEU lado: se o doador puxo o brazo dereito, o esquerdo
segue sendo recambio da clase do chasis e o robot vese asimétrico. É o
correcto — está feito de anacos, e agora nótase.

**F10** forza a montaxe en todas as unidades, incluídas as que non foron
reconstruídas, para comparar as dúas vías: se dan o mesmo, o camiño está
ben. `node tools/captura.js batalla --reensamblado` dá unha captura con
unidades de pezas mesturadas.

Catro trampas, todas silenciosas, todas medidas antes de arranxalas:

**A escala é unha soa e está nun só sitio.** `PX_UNIDADE` en
`tools/sprites_blender.js`: píxeles de sprite por unidade de mundo, 9.3, e as
dúas vías léena de alí. Antes cada unha tiña a súa —o atlas levaba escrito a
man «10 píxeles por unidade» e o banco pedía «22 píxeles de alto»— e as
montaxes saían un 19% máis grandes que os sprites normais sen que nada o
denunciase. A proba `as pezas van á mesma escala que o banco de clases`
comproba que non volvan divirxir.

**Ancórase polos PÉS.** O sprite de clase apoia os pés en `y+8`; a montaxe
poñía alí a orixe do modelo, que está á altura da cadeira. Tapábase cun `+8`
no punto de chamada que valía para unha escala e deixou de valer ao
corrixila. Ancorando os pés o asento das pernas longas sae de balde.

**Unha peza soa non recibe a oclusión das veciñas**, e con tres chanzos de
cel shading esa falta salta un paso enteiro de cor: as montaxes saían 14
puntos máis claras. Renderízase cun oclusor invisible —o resto do robot,
con `visible_camera=False`— que é o que facían Diablo II e Os Sims. A
contrapartida é que a oclusión queda cocida contra un corpo canónico;
calculala en vivo é precisamente o que se quixo evitar precociñando.

**Blender e o rasterizador propio xiran ao revés.** `vox3d` xira o MODELO
baixo unha cámara fixa e Blender move a CÁMARA arredor do modelo, así que
as dúas secuencias de direccións corren en sentidos opostos e as imaxes
saen espelladas en x. Está resolto con `yaw = π − yaw` en
`blender_banco.py`, e a regra L5 caza a discrepancia se alguén o desfai.

**O contorno escóllese medindo.** A clase leva UN contorno arredor de todo o
robot; a composición leva un POR PEZA, así que os bordos internos —o pescozo,
o ombro— existen nunha vía e non na outra. Copiar o groso da clase deixa a
montaxe escura de máis e a metade déixaa clara de máis. Non hai valor
deducible: `banco_montaxe.js --erro` dá a diferenza media fronte ao sprite de
clase sobre as cinco clases e as oito direccións, e o mínimo está no 4 (cor
5.34) fronte ao 3 (13.42) e ao 5 (9.69). Se cambia a escala ou o cel shading,
repetir o barrido con `--groso`.

**Non ten sentido buscar o cero.** Compoñer pezas nunca vai dar exactamente o
mesmo que renderizar a clase enteira: os bordos internos están nunha vía e non
na outra. `proba_montaxe.js --bordo` reparte o erro en silueta, contorno e cor
para poder mirar só o que importa.

## Siluetas: que unha clase se recoñeza sen a cor (v0.84)

```
node tools/proba_siluetas.js           sobre o banco: o que ve o xogador
node tools/proba_siluetas.js --modelo  sobre as caixas, para probar cambios
node tools/proba_siluetas.js --imaxe   escríbeas en negro para mirar
```

A regra L4 xa esixía que dúas clases non se vesen igual, pero conta tamén a
COR, e a cor é o primeiro que se perde: coa choiva, na néboa de guerra, cando
as dúas unidades son do mesmo bando, ou se quen xoga é daltónico. Isto mide a
silueta soa, por par de clases e por dirección.

A primeira medida deu o diagnóstico: **GRUNT, ENGINEER e BOMBARDERO tiñan
practicamente a mesma silueta** e distinguíanse só polo amarelo e o laranxa.
A causa estaba en que o xogo ignoraba as alturas dos blueprints de
`Unit_references/` — chegara a ter o HEAVY como a clase MÁIS BAIXA das cinco,
cando o deseño lle dá 2.40 m fronte aos 1.85 do GRUNT.

Catro correccións, todas en `tools/modelos.js` e todas do blueprint:
`ALTURA_DESEÑO` (a altura de cada unidade, aplicada como escala uniforme
sobre as caixas, que así seguen sendo editables a man), unha firma de
`ANTENAS` por clase, a mochila do enxeñeiro rompendo a liña do ombro, e o
enxeñeiro un 15% máis ancho ca o grunt, que é o que di o seu blueprint e o
que máis rendeu: os dous miden 1.85, así que por detrás —onde ningún dos
dous ensina a arma— eran o mesmo bulto. Pasou de 27 a 68 píxeles.

Peor par: **25 → 50 px** sobre os sprites reais, media 101 → 286.

**As antenas teñen que sobrevivir ao reducido.** Naceron de 0.12 de ancho,
que é UN píxel de sprite, e o limiar de alfa comíaas: a antena longa do
enxeñeiro chegaba á pantalla como un tocón de 4 píxeles e a do sniper como
3. Un píxel de diferenza non é ningunha firma. A 0.20 sobreviven, e os
longos escóllense buscando o reparto que maximiza o PEOR par — son un
código, non cinco decisións independentes.

Dúas leccións que custaron:

**As antenas van na CABEZA, non na mochila.** No slot da mochila crúzanse coa
cabeza segundo a dirección e non hai orde de pintado que valla —65 px en
conflito, regra L7— que é xusto o que rompe o xerador por pezas. Na cabeza
son a mesma capa. Casa co blueprint do sniper, que lista a antena dentro da
HEAD UNIT, e ten a consecuencia boa de que trocar a cabeza troca a firma.

**Dúas regras castigaban a un robot por ser grande.** A3 esixía o pivote da
perna a menos de `0.20` da cadeira, un número absoluto: ao escalar o HEAVY un
37% a mesma anatomía pasou a incumprir. Vai en proporción ao torso. E L2
medía contra un lenzo que non daba: o que se esgotaba non era o alto senón o
espazo POR DEBAIXO da orixe, que vox3d pon ao 74%.

E unha que se probou e non compensa: ensanchar a mochila do enxeñeiro para
que asome de fronte gaña tres píxeles de silueta e baixa a cor de bando ao
34%, por debaixo do mínimo da regra L6. Un enxeñeiro que non se sabe de que
bando é sae máis caro.

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
