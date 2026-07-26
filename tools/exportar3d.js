#!/usr/bin/env node
/* ============================================================
   Exporta un modelo XA POSADO a JSON, para que Blender o constrúa.

   Expórtanse os VÉRTICES finais, non o esqueleto: así Blender amosa
   exactamente a mesma xeometría que rasteriza vox3d.js, sen ter que
   reimplementar en Python a cadea de poses e parentescos. Se algo se
   ve mal en Blender, está mal no modelo — non na tradución.

   Uso: node tools/exportar3d.js GRUNT ANDAR 0.25 > modelo.json
   ============================================================ */
const { montar } = require('./modelos.js');

const [cls = 'GRUNT', estado = 'REPOUSO', fase = '0'] = process.argv.slice(2);
const rb = montar(cls, estado, parseFloat(fase));

/* Mesma orde de caras que CARAS en vox3d.js: os índices dependen de como
   caixaVerts xera os oito vértices. */
const CARAS = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];

const saida = {
  clase: cls, estado, fase: parseFloat(fase),
  caras: CARAS,
  pezas: rb.pezas.map(([verts, cor]) => ({ verts, cor })),
};
process.stdout.write(JSON.stringify(saida));
