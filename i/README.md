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
│   ├── 00-preambulo.js
│   ├── 01-nucleo-datos.js  ← storage, export/import, crónica
│   ├── 01b-assets.js       ← sprites base64 (xerado; non editar á man)
│   ├── 02-pvp-lobby.js     ← salas Firebase, presenza, chat
│   ├── 03-pvp-sync.js      ← batalla host-autoritaria, snaps, predición
│   ├── 04-progresion.js    ← skills, reconstructor, desmantelamento, campaña
│   ├── 05-mapa-camara-neboa.js
│   ├── 06-audio-voces.js   ← audio procedural, música, voces
│   ├── 07-terreo-batalla.js
│   ├── 08-social-narrativa.js  ← subquests, HQ, VOLT, grises, escudo
│   ├── 09-economia-combate.js  ← chatarra, cobertura, cháchara, IA
│   ├── 10-estructuras.js   ← torretas, vehículos
│   ├── 11-retratos-ui.js
│   └── 12-debrief-hangar.js
├── dist/tuerca.html        ← ARTEFACTO: o ficheiro único que se publica
├── build.py                ← reensambla dist/ desde a fonte
└── database.rules.json     ← regras de seguridade da Realtime Database
```

**Regra de ouro**: os ficheiros de `js/` concaténanse en orde e comparten o
ámbito global (scripts clásicos, sen módulos ES). Editar calquera ficheiro e
recargar `index.html` = desenvolvemento. `python3 build.py` = publicación.

## Fluxo de traballo

1. Desenvolver contra `index.html` (os cambios vense recargando).
2. `python3 build.py` → `dist/tuerca.html` (o ficheiro único de sempre).
3. Publicar SÓ o dist (itch.io, GitHub Pages, o que sexa).

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
