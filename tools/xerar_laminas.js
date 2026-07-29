#!/usr/bin/env node
/* ============================================================
   AS LÁMINAS DE UNIDADE, listas para a interface.

   En Unit_references/ hai un blueprint por clase: o plano técnico da
   unidade, con altura, peso, despece por módulos e as barras de
   sistemas. Son a fonte de deseño dos modelos —de alí saíron as alturas
   e as antenas— e teñen sitio no xogo, porque a ficha dunha unidade xa
   amosa esa mesma información en táboa. A lámina é a versión en ficción.

   Aquí só se preparan: reducir e cuantizar.

   CUANTIZAR POR CANLE, non por paleta. Probáronse as dúas e a intuición
   falla: unha paleta sacada das cores máis frecuentes queda co fondo
   azul, e as liñas brancas —que son poucos píxeles— desaparecen. A
   lámina sae lavada. Por canle a 6 chanzos consérvase todo o debuxo,
   pesa menos (135 KB fronte a 165) e de paso gaña carácter de lámina
   impresa, que non desentoa nun xogo de píxeles.

     orixinal              2.3 MB, 1150 px
     760 px sen cuantizar  731 KB
     760 px, 6 chanzos     135 KB

   Van a i/ui/, non ao banco en base64: o build NON inlina as imaxes de
   interface —medrarían un terzo— senón que as copia soltas a dist/ui/.
   Así só se descargan cando alguén abre unha ficha.

   Uso: node tools/xerar_laminas.js [--ancho 760] [--chanzos 6]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ler, escribir } = require('./png.js');
const { reducir } = require('./vox3d.js');
const { endurecer } = require('./sprites_blender.js');

const RAIZ = path.join(__dirname, '..');
const op = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i+1] : d; };
const ANCHO = parseInt(op('ancho', '760'), 10);
const CHANZOS = parseInt(op('chanzos', '6'), 10);

const ORIXE = path.join(RAIZ, 'Unit_references');
const DESTINO = path.join(RAIZ, 'i', 'ui');

if(!fs.existsSync(ORIXE)){
  console.log('\n  non hai Unit_references/ — nada que facer\n');
  process.exit(0);
}

/* Que ficheiro é de que clase. Faise polo prefixo do nome e non por unha
   táboa escrita a man para que engadir unha clase nova sexa deixar o PNG
   no cartafol. Descártanse os apuntamentos soltos (Heavy_Unit_3d…): a
   lámina é a que leva o despece completo. */
const clases = {};
for(const f of fs.readdirSync(ORIXE)){
  const m = /^([A-Za-z]+)_Unit_reference\.png$/.exec(f);
  if(!m) continue;
  clases[m[1].toUpperCase()] = f;
}

const nomes = Object.keys(clases);
if(!nomes.length){
  console.log('\n  non se atopou ningunha lámina <Clase>_Unit_reference.png\n');
  process.exit(0);
}

fs.mkdirSync(DESTINO, { recursive: true });
console.log(`\n  ${nomes.length} láminas → ${ANCHO} px, ${CHANZOS} chanzos por canle\n`);
let total = 0;
for(const cls of nomes.sort()){
  const im = ler(path.join(ORIXE, clases[cls]));
  const alto = Math.round(im.alto * ANCHO / im.ancho);
  const q = endurecer(reducir(im, ANCHO, alto), CHANZOS, 1);
  const saida = path.join(DESTINO, 'lamina_' + cls + '.png');
  escribir(saida, q);
  const kb = fs.statSync(saida).size / 1024;
  total += kb;
  console.log(`    ${cls.padEnd(12)} ${ANCHO}×${alto}   ${kb.toFixed(0)} KB`);
}
console.log(`\n  ${(total/1024).toFixed(2)} MB en i/ui/  (o build cópiaas soltas a dist/ui/)\n`);
