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
const TUERCA_V = 'v0.76';

/* Facción do xogador (v0.29): declárase AQUÍ para estar dispoñible en toda a carga */
let PT = 0, ET = 1;
