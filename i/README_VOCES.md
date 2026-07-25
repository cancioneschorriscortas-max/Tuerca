# TUERCA · VOCES HUMANAS — guía de xeración e integración

## O deseño (canon, definido por Agarfal)
- **Robots entre eles** (cháchara, reaccións, conversas de campo): **chíos procedurais** — sintetizados ao voo, timbre propio por robot derivado do nome. Sen ficheiros. Para sempre.
- **Voz dirixida AO COMANDANTE** (o xogador): **voz humana** — o HQ/cuartel xeral, os avisos de mando (base baixo ataque, inicio/fin de operación), os comunicados de ÓPTIMA, o saque do Mundial.
- **O REGULADOR É O MANIFESTO** (`voces/manifest.json`): toda frase cuxa clave teña ficheiro soa humana; a que non, cae en chío ou só texto. Podes empezar con 5 gravacións e medrar a 500 **sen tocar código**: engades `.ogg`, executas o xerador de manifesto, e listo.

## Estrutura
```
voces/
  manifest.json          ← xerado, NON editar á man
  gl/  r.baseAtaque.ogg  op.inicio.ogg  ...
  es/  r.baseAtaque.ogg  ...
  en/  ...
tools/
  xerar_manifest.py      ← escanea e rexenera o manifesto
  xerar_placeholders.sh  ← voces sintéticas BASTAS para probar (espeak); substituír
```
**Convención de nomes**: `<clave-i18n>.ogg` — a clave EXACTA da táboa de 00b-i18n.js (p.ex. `r.baseAtaque.ogg`). Unha carpeta por lingua.

## PASO 1 · Xerar as voces reais (na túa máquina)

### Opción A — Proxecto Nós (galego neural, recomendada probar primeiro)
O ecosistema Nós (USC/Xunta) ten síntese de voz en galego con voces neuronais (a familia de modelos "Carballo" que mencionas é a dos modelos de LINGUAXE do mesmo proxecto; a parte de VOZ é o seu TTS — verifica o nome exacto na súa web/HuggingFace: busca "proxectonos" ou "Nós TTS"). Dúas vías:
1. **Demo web**: se teñen demo pública de TTS, xera frase a frase e descarga o audio. Para ~15-30 frases é perfectamente viable á man.
2. **Modelos locais** (HuggingFace de proxectonos): normalmente son modelos VITS/Matcha executables con Python. Instrución tipo (axusta ao README do modelo concreto):
   ```bash
   pip install TTS  # ou o paquete que indique o modelo
   # exemplo xenérico coqui-tts cun modelo local descargado:
   tts --model_path modelo.pth --config_path config.json \
       --text "Base baixo ataque! Todas as unidades, replegádevos." \
       --out_path r.baseAtaque.wav
   ```

### Opción B — Cotovía (o veterano da UVigo, galego + castelán, offline)
Sintetizador clásico do GTM (Universidade de Vigo), software libre, lixeiro, roda en local sen GPU. Son máis "clásico" (menos natural que o neural) pero MOI de radio militar retro — pode que che GUSTE máis para o HQ. Busca "Cotovía UVigo" (hai paquetes .deb históricos e fonte). Uso típico:
```bash
cotovia -l gl -i frase.txt -o r.baseAtaque.wav
```

### Opción C — A túa propia voz (para as xoias)
Para os comunicados de ÓPTIMA e o comentarista do Mundial, gravarvos vós (Audacity + micro decente) é a opción con máis alma. Conxunto pequeno, retranca garantida.

### Castelán e inglés
Calquera TTS decente serve (piper con voces es_ES/en_US é libre e offline). Se ÓPTIMA fala sempre castelán (decisión de lore pendente túa), os seus comunicados só precisan carpeta `es/`.

## PASO 2 · Normalizar e converter (igual para todas as fontes)
O filtro paso-banda dá o carácter "radio militar" e a normalización iguala volumes:
```bash
ffmpeg -y -i entrada.wav \
  -af "loudnorm=I=-18:TP=-2,highpass=f=250,lowpass=f=3400" \
  -c:a libvorbis -q:a 3 voces/gl/r.baseAtaque.ogg
```
(Se queres o HQ máis limpo e só "radio" para ÓPTIMA, quita o high/lowpass nas do HQ.)

## PASO 3 · Rexenerar o manifesto e probar
```bash
python3 tools/xerar_manifest.py
python3 build.py            # o manifesto e os ogg van á dist (pendente de wiring no xogo)
```

## Claves do NIVEL HUMANO (lista de partida curada)
Mando/HQ: `r.baseAtaque` · `r.canal` · `r.hqVermello` · `r.hqAzul` · `r.baixaVet` (parte de baixas)
Operación: `op.inicio` · `op.vitoria` · `op.derrota` (claves novas a crear no wiring)
ÓPTIMA: `br.comunicadoDe` + os textos de comunicado por acto
Mundial (retransmisión, se algún día vai humana): `mun.saque` · `mun.gol` · `mun.vermella` · `mun.final` · `mun.campion`
⚠ As frases dos ROBOTS ao seren seleccionados son CENTOS (3 clases × 5 personalidades × 4 estados × contextos): esas quedan en chío por deseño. Se algún día queres humanizar algunha, o manifesto acéptaa igual — pero non é o plan.

## O que fará o xogo (wiring pendente, próxima sesión)
`voz.js`: xestor de canle (unha voz á vez, prioridades GOL/mando > selección > cháchara, dedupe 6s, ducking da música) + ruta: frase con dono robot→robot = chío procedural; clave no manifesto na lingua activa = reprodución do ogg; resto = só texto. Toggle en opcións: VOZ: OFF / CHÍOS / CHÍOS+HUMANAS.

## Estado e guión (v0.79)

```
node tools/voces.js              # cobertura: que se pide, que hai gravado, que ten texto
node tools/voces.js --guion gl   # o que falta nesa lingua, coa frase e o nome de ficheiro
```

O informe cruza tres cousas que antes ninguén cruzaba: as claves que o xogo
**pide** (`vozMando`/`vozComentarista`), as que teñen **gravación** (o manifesto) e
as que teñen **texto** (o dicionario). Detecta tres fallos silenciosos:

- **Orfas**: hai ficheiro, publícase, e o xogo non pide esa clave nunca.
- **Manifesto roto**: promete un ficheiro que non está no disco.
- **Sen texto**: sen gravación NIN texto, o chío sintetiza o nome interno da
  clave (`op.inicio`) en vez dunha frase.

**Claves con `{variables}`** (o marcador do Mundial, por exemplo) non se poden
gravar tal cal: un clip fixo non pode dicir un resultado que cambia. Ou se
gravan sen os números —o dato queda só na radio escrita— ou se deixan en chío.

**Fluxo para engadir voz**: grava o `.ogg`, ponlle de nome a clave exacta,
déixao en `voces/<lingua>/`, e executa `python tools/xerar_manifest.py`.
Non hai que tocar código.
