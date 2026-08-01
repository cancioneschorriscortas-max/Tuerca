#!/usr/bin/env node
/* ============================================================
   CONTRASTE LOCAL DUNHA CAPTURA.

   A luma media non serve para saber se unha escena se le. Un cadro pode
   ter a media perfectamente centrada e ser unha mancha uniforme: todo na
   mesma banda de valor, nada recortado contra nada. O que distingue
   "lese ben" de "é unha mancha" é o contraste LOCAL — canto varía o
   valor dentro dun anaco pequeno da imaxe.

   Mídese así: divídese o cadro en baldosas, cálculase a desviación
   estándar da luma dentro de cada unha, e promédianse todas. Unha
   superficie plana dá cero por moito que sexa clara ou escura; unha zona
   con siluetas, contornos e sombras dá un número alto.

   DE ONDE VÉN A MÉTRICA. Doutro RTS que se someteu a un xurado cego
   contra capturas de Age of Empires II. Pasaron catro roldas optimizando
   a luma media —que xa pasaba— mentres o xurado repetía que todo estaba
   nunha soa banda de cor. O problema só tivo número ao medir contraste
   local: 28,3 fronte a 41,5 da referencia, e rango intercuartil 52,6
   fronte a 81,7. Ese 41,5 sae de sprites debuxados a man onde cada
   unidade ten liñas escuras internas a escala de poucos píxeles mentres
   as súas superficies son grandes e suaves — que é, casualmente, o que
   fai o cel shading de TUERCA.

   ISTO NON ARRANXA NADA. Dá o número e cala. Que facer con el —tocar a
   capa de luz, o contorno, a paleta do terreo— é outra conversa e ten
   outros riscos.

   Uso:
     node tools/contraste.js capturas/batalla.png
     node tools/contraste.js capturas/*.png
     node tools/contraste.js capturas/a.png --recorte 0,0,1600,760
     node tools/contraste.js capturas/a.png --baldosa 16

   Cero dependencias: só tools/png.js, que le PNG con zlib pelado.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ler } = require('./png.js');

/* Rec. 709, sobre os valores de 0 a 255 tal cal saen do PNG. NON se pasa
   a lineal a propósito: o que interesa é o contraste PERCIBIDO na
   pantalla de quen xoga, non a enerxía física da luz. */
const LUMA_R = 0.2126, LUMA_G = 0.7152, LUMA_B = 0.0722;

/* Tamaño de baldosa por defecto. 32 non é un número redondo calquera:
   unha unidade de TUERCA mide 22 píxeles, así que unha baldosa de 32
   colle un robot MÁIS o terreo que ten arredor. Esa é exactamente a
   escala na que se decide se unha unidade se recorta contra o chan, que
   é a pregunta. Con baldosas moito máis grandes mídese a variación entre
   zonas do mapa —outra cousa— e con moito máis pequenas mídese o ruído
   do propio contorno. */
const BALDOSA = 32;

/* Onde empeza a esmagarse o negro e a queimarse o branco. Son o oitavo
   de abaixo e o de arriba do rango (32/255 e 224/255): por debaixo e por
   riba deses valores, un panel normal xa non separa ben os tons e o que
   había alí déixase de ver, aínda que no ficheiro siga estando. */
const NEGRO = 32, BRANCO = 224;

/* Unha desviación estándar precisa polo menos dous valores. As capturas
   do xogo son opacas de arriba abaixo, así que isto só actúa se algún
   día se mide un PNG con transparencia. */
const MIN_OPACOS = 2;

/* ---------- medida ---------- */
/* Recibe unha imaxe xa lida ({ancho, alto, px}) e devolve as métricas.
   Sepárase do CLI para poder probala sen escribir ficheiros. */
function medir(im, opc){
  opc = opc || {};
  const lado = opc.baldosa || BALDOSA;
  const r = opc.recorte || { x: 0, y: 0, ancho: im.ancho, alto: im.alto };

  /* O recorte pódese quedar fóra da imaxe: pínzase en vez de petar. */
  const x0 = Math.max(0, Math.min(r.x, im.ancho));
  const y0 = Math.max(0, Math.min(r.y, im.alto));
  const x1 = Math.max(x0, Math.min(r.x + r.ancho, im.ancho));
  const y1 = Math.max(y0, Math.min(r.y + r.alto, im.alto));

  /* Histograma de 256 caixas: a luma redondeada é un enteiro de 0 a 255,
     así que os percentís saen EXACTOS e sen gardar o cadro enteiro. */
  const hist = new Float64Array(256);
  let opacos = 0, sumaLuma = 0;

  const luma = (i) => LUMA_R * im.px[i] + LUMA_G * im.px[i+1] + LUMA_B * im.px[i+2];

  for(let y = y0; y < y1; y++){
    for(let x = x0; x < x1; x++){
      const i = (y * im.ancho + x) * 4;
      if(im.px[i+3] === 0) continue;          /* alfa 0: non existe */
      const L = luma(i);
      opacos++; sumaLuma += L;
      hist[Math.round(L)]++;
    }
  }

  if(!opacos) return null;

  /* ---------- contraste local, baldosa a baldosa ---------- */
  /* As baldosas incompletas do bordo dereito e inferior DESCÁRTANSE:
     unha de 32x7 ten unha desviación que non é comparable coas demais e
     metela na media move o resultado sen que ninguén saiba por que. */
  let sumaDesv = 0, nBaldosas = 0;
  for(let by = y0; by + lado <= y1; by += lado){
    for(let bx = x0; bx + lado <= x1; bx += lado){
      let n = 0, s = 0, s2 = 0;
      for(let y = by; y < by + lado; y++){
        for(let x = bx; x < bx + lado; x++){
          const i = (y * im.ancho + x) * 4;
          if(im.px[i+3] === 0) continue;
          const L = luma(i);
          n++; s += L; s2 += L * L;
        }
      }
      if(n < MIN_OPACOS) continue;
      /* Varianza poboacional: interésanos ESTA baldosa, non estimar a
         dunha poboación maior da que sería unha mostra. */
      const media = s / n;
      const varianza = Math.max(0, s2 / n - media * media);
      sumaDesv += Math.sqrt(varianza);
      nBaldosas++;
    }
  }

  /* ---------- percentís e extremos ---------- */
  const percentil = (p) => {
    const obxectivo = opacos * p;
    let acum = 0;
    for(let v = 0; v < 256; v++){
      acum += hist[v];
      if(acum >= obxectivo) return v;
    }
    return 255;
  };
  let baixo = 0, alto = 0;
  for(let v = 0; v < NEGRO; v++) baixo += hist[v];
  for(let v = BRANCO + 1; v < 256; v++) alto += hist[v];

  return {
    contraste: nBaldosas ? sumaDesv / nBaldosas : 0,
    baldosas: nBaldosas,
    luma: sumaLuma / opacos,
    iqr: percentil(0.75) - percentil(0.25),
    pcNegro: 100 * baixo / opacos,
    pcBranco: 100 * alto / opacos,
    pixeles: opacos,
  };
}

module.exports = { medir, BALDOSA };

/* ---------- liña de ordes ---------- */
if(require.main === module){
  const argv = process.argv.slice(2);
  const op = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
  const ficheiros = argv.filter((a, i) =>
    !a.startsWith('--') && !(i > 0 && argv[i-1].startsWith('--')));

  if(!ficheiros.length){
    console.log(`
  CONTRASTE LOCAL — mide se unha escena se le ou é unha mancha.

    node tools/contraste.js capturas/batalla.png
    node tools/contraste.js capturas/*.png
    node tools/contraste.js a.png --recorte 0,0,1600,760
    node tools/contraste.js a.png --baldosa 16

  --recorte x,y,ancho,alto   mide só ese rectángulo
  --baldosa N                lado da baldosa (defecto ${BALDOSA})

  OLLO CO RECORTE. Sen el mídese o cadro enteiro, HUD incluído, e o HUD
  de TUERCA é interface de alto contraste debuxada por riba da escena:
  texto de fósforo sobre negro. Iso infla o número e a medida deixa de
  dicir nada sobre o terreo e as tropas, que é o que se quere saber.
  Para medir só o mapa, recorta o mapa.
`);
    process.exit(0);
  }

  const lado = parseInt(op('baldosa', String(BALDOSA)), 10);
  let recorte = null;
  const rec = op('recorte', null);
  if(rec){
    const p = rec.split(',').map(Number);
    if(p.length !== 4 || p.some(v => !isFinite(v))){
      console.error('  --recorte quere catro números: x,y,ancho,alto');
      process.exit(1);
    }
    recorte = { x: p[0], y: p[1], ancho: p[2], alto: p[3] };
  }

  const filas = [];
  for(const f of ficheiros){
    try{
      const m = medir(ler(f), { baldosa: lado, recorte });
      if(!m){ filas.push({ nome: path.basename(f), erro: 'sen píxeles opacos' }); continue; }
      filas.push({ nome: path.basename(f), m });
    }catch(e){
      filas.push({ nome: path.basename(f), erro: e.message });
    }
  }

  const anchoNome = Math.max(8, ...filas.map(f => f.nome.length));
  const cab = '  ' + 'ficheiro'.padEnd(anchoNome)
    + 'contraste'.padStart(11) + 'luma'.padStart(8) + 'IQR'.padStart(8)
    + ('<' + NEGRO).padStart(8) + ('>' + BRANCO).padStart(8);
  console.log('\n  baldosa ' + lado + ' px' + (recorte
    ? `  ·  recorte ${recorte.x},${recorte.y} ${recorte.ancho}x${recorte.alto}`
    : '  ·  CADRO ENTEIRO (o HUD entra na medida e ínflaa)'));
  console.log('');
  console.log(cab);
  console.log('  ' + '-'.repeat(cab.length - 2));
  for(const f of filas){
    if(f.erro){ console.log('  ' + f.nome.padEnd(anchoNome) + '  ' + f.erro); continue; }
    const m = f.m;
    console.log('  ' + f.nome.padEnd(anchoNome)
      + m.contraste.toFixed(1).padStart(11)
      + m.luma.toFixed(1).padStart(8)
      + m.iqr.toFixed(1).padStart(8)
      + (m.pcNegro.toFixed(1) + '%').padStart(8)
      + (m.pcBranco.toFixed(1) + '%').padStart(8));
  }
  const n = filas.find(f => f.m);
  console.log('\n  ' + (n ? n.m.baldosas + ' baldosas por imaxe.  ' : '')
    + 'Referencia: contraste local 41,5 e IQR 81,7 son o obxectivo alto');
  console.log('  (sprites debuxados a man con liñas internas escuras).\n');
}
