'use strict';

/* ============================================================
   VERSIÓN — FONTE ÚNICA. Tócase SÓ aquí.
   Derivan dela: o <title>, o subtítulo da portada, o selo do
   hangar, a cabeceira do duelo online, o pé dos erros e o campo
   `v` que se publica nas salas de Firebase (control de
   compatibilidade entre host e convidado).
   Vive no preámbulo, o primeiro ficheiro que carga, para estar
   dispoñible en TODOS os módulos posteriores.
   ============================================================ */
const TUERCA_V = 'v0.85';

/* ============================================================
   (v0.78) AZAR SEMENTADO DA SIMULACIÓN

   A simulación usaba Math.random() en 65 sitios, así que dúas
   partidas coa mesma entrada divirxían e nada era reproducible.
   Iso doe onde máis: cando o fuzz das probas atopa un fallo, non
   hai forma de repetilo.

   Agora o azar do MOTOR sae dun fluxo con semente que vive no
   propio estado da batalla (g.rngEstado), así que viaxa con ela.
   O azar do RENDER —partículas, chispas, po— segue en
   Math.random() a propósito: se consumise este fluxo, o resultado
   dependería da taxa de frames e non habería determinismo ningún.

   Fóra de batalla rnd() é Math.random() sen máis, así que
   chamalo desde o hangar non ten efecto secundario.

   Xerador: mulberry32. Rápido, sen dependencias, e un estado de
   32 bits que cabe nunha instantánea de PvP.
   ============================================================ */
function rnd(){
  if(typeof game === 'undefined' || !game || typeof game.rngEstado !== 'number'){
    return Math.random();
  }
  let t = (game.rngEstado = (game.rngEstado + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* Facción do xogador (v0.29): declárase AQUÍ para estar dispoñible en toda a carga */
let PT = 0, ET = 1;
