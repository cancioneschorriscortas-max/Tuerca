#!/bin/bash
# Placeholders con espeak-ng (voz sintética BASTA, só para probar a canalización).
# As voces REAIS xéraas Agarfal no seu PC (Nós-TTS / Cotovía) e substitúe os ficheiros.
# Uso: bash tools/xerar_placeholders.sh
cd "$(dirname "$0")/.."
xerar(){ # $1 lingua-espeak  $2 carpeta  $3 clave  $4 texto
  espeak-ng -v "$1" -s 150 -p 40 -w /tmp/_v.wav "$4" 2>/dev/null
  ffmpeg -y -i /tmp/_v.wav -af "loudnorm=I=-18:TP=-2,highpass=f=250,lowpass=f=3400" \
         -c:a libvorbis -q:a 3 "voces/$2/$3.ogg" 2>/dev/null   # paso banda: "radio militar"
  echo "  voces/$2/$3.ogg"
}
echo "— placeholders ES (espeak; substituír por voz real) —"
xerar es es r.baseAtaque      "¡Base bajo ataque! Todas las unidades, replegarse."
xerar es es r.canal           "Canal de mando abierto. Aquí el cuartel general."
xerar es es r.hqVermello      "Cuartel enemigo localizado. Marcado en el mapa."
xerar es es op.inicio         "Comienza la operación. Suerte ahí fuera."
xerar es es op.vitoria        "Operación cumplida. Volved a casa."
xerar es es op.derrota        "Hemos perdido el sector. Retirada."
xerar es es mun.saqueHQ       "Comienza el partido. Once contra once."
xerar es es br.comunicadoDe   "Comunicado de ÓPTIMA."
echo "— placeholders GL (voz ES lendo galego: SÓ proba de canalización) —"
xerar es gl r.baseAtaque      "Base baixo ataque! Todas as unidades, replegádevos."
xerar es gl r.canal           "Canal de mando aberto. Aquí o cuartel xeral."
xerar es gl op.inicio         "Comeza a operación. Sorte aí fóra."
xerar es gl op.vitoria        "Operación cumprida. Volvede á casa."
python3 tools/xerar_manifest.py
