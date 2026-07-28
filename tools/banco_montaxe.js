#!/usr/bin/env node
/* ============================================================
   BANCO DE PROBAS DA MONTAXE POR PEZAS.

   As unidades miden 22 píxeles no mapa, así que unha captura da partida
   non serve para xulgar se unha montaxe queda ben: hai que velas grandes
   e unha ao lado da outra. Isto pinta:

     arriba   cada clase polas dúas vías, o sprite de clase e a montaxe
              por pezas. Se as dúas columnas non son case iguais, algo
              está mal colocado e vese ao intre.
     abaixo   montaxes MESTURADAS, que é o que non se pode precociñar e
              polo tanto o único que xustifica todo o traballo.

   Usa exactamente os mesmos datos que o xogo —19c-orde.js, 19d-pezas.js
   e as funcións de 19e-montar.js— para que o que se vexa aquí sexa o que
   se verá alí. Non se reimplanta a montaxe: cárgase.

   Uso: node tools/banco_montaxe.js [--zoom 4] [--saida f.png]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ler, escribir } = require('./png.js');

const RAIZ = path.join(__dirname, '..');
const JS = path.join(RAIZ, 'i', 'js');
const op = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i+1] : d; };
const ZOOM = parseInt(op('zoom', '5'), 10);
const SAIDA = path.resolve(op('saida', path.join(RAIZ, 'capturas', '_banco_montaxe.png')));

/* ---------- os datos do xogo, tal cal ---------- */
const dato = (f, marca) => {
  const t = fs.readFileSync(path.join(JS, f), 'utf8');
  return JSON.parse(t.match(new RegExp('const ' + marca + ' = (\\{[\\s\\S]*\\});'))[1]);
};
const PEZAS3D = dato('19d-pezas.js', 'PEZAS3D');
const ORDE3D = dato('19c-orde.js', 'ORDE3D');

/* mon3dAsento e mon3dDeClase saen do ficheiro do xogo para que non poidan
   discrepar. O Image de mentira só serve para que o cargador non pete. */
const { mon3dPousada, mon3dDeClase } = new Function('PEZAS3D', 'ORDE3D', 'Image',
  fs.readFileSync(path.join(JS, '19e-montar.js'), 'utf8') +
  '; return { mon3dPousada, mon3dDeClase };'
)(PEZAS3D, ORDE3D, function(){ return { set src(v){}, set onload(v){ v && v(); }, set onerror(v){} }; });

const SLOT_DE = {
  CABEZA: 'CABEZA', TORSO: 'CHASIS', PEITO: 'CHASIS', MOCHILA: 'CHASIS',
  BRAZO_D: 'BRAZO_DER', BRAZO_E: 'BRAZO_ESQ',
  PERNA_D: 'PERNA_DER', PERNA_E: 'PERNA_ESQ',
};

/* ---------- descodificar os atlas unha soa vez ---------- */
const tmp = path.join(RAIZ, 'capturas', '_bancotmp');
fs.mkdirSync(tmp, { recursive: true });
const atlas = {};
for(const [clave, a] of Object.entries(PEZAS3D.banco)){
  const f = path.join(tmp, clave.replace(/\|/g, '_') + '.png');
  fs.writeFileSync(f, Buffer.from(a.d.split(',')[1], 'base64'));
  atlas[clave] = Object.assign(ler(f), a);
  fs.unlinkSync(f);
}
fs.rmdirSync(tmp);

/* ---------- pintar ---------- */
const CANVAS = 40;                       /* lenzo por robot, en píxeles de sprite */
function lenzo(){ return { ancho: CANVAS, alto: CANVAS, px: Buffer.alloc(CANVAS*CANVAS*4) }; }

/* A mesma montaxe que fai o xogo en 19e-montar.js, aquí sobre un buffer.
   Repítese a aritmética porque alí é un drawImage de canvas, pero é a
   mesma liña: orixe do encadre + ancora + recorte do atlas + asento. */
function montar(m, equipo, estado, dir, fase){
  const im = lenzo();
  const ix = PEZAS3D.indice[estado] || PEZAS3D.indice.REPOUSO;
  const cadro = ix.base + dir*ix.fases + (fase % ix.fases);
  const orde = ORDE3D[estado + '/' + dir] || ORDE3D['REPOUSO/' + dir];
  const pousada = mon3dPousada(m, dir) - 8;   /* o +8 é do terreo do xogo, aquí non hai */
  for(const capa of orde){
    const slot = SLOT_DE[capa], peza = m[slot];
    if(!peza) continue;
    const a = atlas[`${slot}|${peza}|${capa}|${equipo}`] || atlas[`${slot}|${peza}|${capa}|0`];
    if(!a) continue;
    const anc = (PEZAS3D.ancoras[m.CHASIS] || {})[slot];
    const dxy = anc ? anc[dir] : [0, 0];
    const ox = Math.round(CANVAS/2 + dxy[0] + a.ox - PEZAS3D.orixe[0]);
    const oy = Math.round(CANVAS/2 + dxy[1] + a.oy - PEZAS3D.orixe[1] + pousada);
    for(let y = 0; y < a.h; y++) for(let x = 0; x < a.w; x++){
      const s = (y*a.ancho + cadro*a.w + x)*4;
      if(a.px[s+3] < 110) continue;
      const X = ox + x, Y = oy + y;
      if(X < 0 || Y < 0 || X >= CANVAS || Y >= CANVAS) continue;
      const d = (Y*CANVAS + X)*4;
      im.px[d] = a.px[s]; im.px[d+1] = a.px[s+1]; im.px[d+2] = a.px[s+2]; im.px[d+3] = 255;
    }
  }
  return im;
}

/* O sprite de clase de sempre. Vai na primeira columna para poder
   comparar: se a montaxe non se parece a el, o erro vese sen medir. */
const BANCO3D = (() => {
  const t = fs.readFileSync(path.join(JS, '19b-banco.js'), 'utf8');
  return JSON.parse(t.match(/(?:const|var|let)\s+BANCO3D\s*=\s*(\{[\s\S]*\});/)[1]);
})();
const tmpC = path.join(RAIZ, 'capturas', '_bancotmp2');
fs.mkdirSync(tmpC, { recursive: true });
const clase = {};
for(const [cls, eqs] of Object.entries(BANCO3D.banco)){
  const a = eqs['0'];
  const f = path.join(tmpC, cls + '.png');
  fs.writeFileSync(f, Buffer.from(a.d.split(',')[1], 'base64'));
  clase[cls] = Object.assign(ler(f), a);
  fs.unlinkSync(f);
}
fs.rmdirSync(tmpC);

/* Recorta un cadro do atlas de clase e céntrao no mesmo lenzo, para que
   as dúas columnas se comparen na mesma referencia. */
function spriteClase(cls, estado, dir, fase){
  const a = clase[cls];
  const im = lenzo();
  if(!a) return im;
  const ix = BANCO3D.indice[estado] || BANCO3D.indice.REPOUSO;
  const cadro = ix.base + dir*ix.fases + (fase % ix.fases);
  const ox = Math.round((CANVAS - a.cw)/2), oy = Math.round((CANVAS - a.ch)/2);
  for(let y = 0; y < a.ch; y++) for(let x = 0; x < a.cw; x++){
    const s = (y*a.ancho + cadro*a.cw + x)*4;
    if(a.px[s+3] < 110) continue;
    const X = ox+x, Y = oy+y;
    if(X < 0 || Y < 0 || X >= CANVAS || Y >= CANVAS) continue;
    const d = (Y*CANVAS + X)*4;
    im.px[d] = a.px[s]; im.px[d+1] = a.px[s+1]; im.px[d+2] = a.px[s+2]; im.px[d+3] = 255;
  }
  return im;
}

/* ---------- que se pinta ---------- */
const CLASES = ['GRUNT', 'HEAVY', 'ENGINEER', 'SNIPER', 'BOMBARDERO'];
const SLOTS = ['CABEZA', 'CHASIS', 'BRAZO_DER', 'BRAZO_ESQ', 'PERNA_DER', 'PERNA_ESQ'];
const filas = [];
for(const c of CLASES) filas.push({ etiqueta: c, m: mon3dDeClase(c) });

/* Mesturas escollidas para que se note: pernas doutra altura, un brazo
   de sniper nun corpo pesado, unha cabeza que non é a do chasis. */
const MESTURAS = [
  ['HEAVY corpo · SNIPER brazos',   { CABEZA:'HEAVY', CHASIS:'HEAVY', BRAZO_DER:'SNIPER', BRAZO_ESQ:'SNIPER', PERNA_DER:'HEAVY', PERNA_ESQ:'HEAVY' }],
  ['GRUNT corpo · HEAVY pernas',    { CABEZA:'GRUNT', CHASIS:'GRUNT', BRAZO_DER:'GRUNT', BRAZO_ESQ:'GRUNT', PERNA_DER:'HEAVY', PERNA_ESQ:'HEAVY' }],
  ['SNIPER corpo · BOMBA. mochila', { CABEZA:'SNIPER', CHASIS:'BOMBARDERO', BRAZO_DER:'SNIPER', BRAZO_ESQ:'SNIPER', PERNA_DER:'SNIPER', PERNA_ESQ:'SNIPER' }],
  ['ENGINEER corpo · HEAVY brazo',  { CABEZA:'ENGINEER', CHASIS:'ENGINEER', BRAZO_DER:'HEAVY', BRAZO_ESQ:'ENGINEER', PERNA_DER:'ENGINEER', PERNA_ESQ:'ENGINEER' }],
  ['HEAVY cabeza · GRUNT resto',    { CABEZA:'HEAVY', CHASIS:'GRUNT', BRAZO_DER:'BOMBARDERO', BRAZO_ESQ:'GRUNT', PERNA_DER:'SNIPER', PERNA_ESQ:'SNIPER' }],
];

const DIRS = [0, 1, 2, 3, 4, 5, 6, 7];
const CEL = CANVAS*ZOOM;
const MARXE = 130, CAB = 34, SEP = 26;
/* Cada clase leva DÚAS filas: o sprite de clase enriba e a montaxe por
   pezas debaixo, dirección contra dirección. Só de fronte non abonda:
   as diferenzas de orde de capas viven nas diagonais. */
const W = MARXE + DIRS.length*CEL;
const H = CAB + CLASES.length*(2*CEL + 10) + SEP + CAB + MESTURAS.length*CEL + 14;
const saida = { ancho: W, alto: H, px: Buffer.alloc(W*H*4) };
for(let i = 0; i < W*H; i++){
  saida.px[i*4] = 26; saida.px[i*4+1] = 30; saida.px[i*4+2] = 24; saida.px[i*4+3] = 255;
}

function pegar(im, ox, oy){
  for(let y = 0; y < im.alto*ZOOM; y++) for(let x = 0; x < im.ancho*ZOOM; x++){
    const s = (((y/ZOOM)|0)*im.ancho + ((x/ZOOM)|0))*4;
    if(im.px[s+3] < 110) continue;
    const X = ox+x, Y = oy+y;
    if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const d = (Y*W + X)*4;
    saida.px[d] = im.px[s]; saida.px[d+1] = im.px[s+1]; saida.px[d+2] = im.px[s+2];
  }
}

/* tipografía mínima de 3×5: só o preciso para etiquetar as filas */
const FONTE = {
  A:'25255',B:'65656',C:'34443',D:'65556',E:'74747',F:'74744',G:'34156',H:'55755',I:'72227',J:'11156',
  K:'55655',L:'44447',M:'57555',N:'75555',O:'25552',P:'65644',Q:'25553',R:'65655',S:'34216',T:'72222',
  U:'55553',V:'55552',W:'55575',X:'55255',Y:'55222',Z:'71247','·':'00200',' ':'00000','.':'00002',
  '0':'25552','1':'26222','2':'71247','3':'61616','4':'55710','5':'74316','6':'34756','7':'71222',
  '8':'25252','9':'25316',
};
function texto(s, ox, oy, cor){
  let cx = ox;
  for(const ch of s.toUpperCase()){
    const g = FONTE[ch];
    if(g){
      for(let r = 0; r < 5; r++){
        const b = parseInt(g[r], 10);
        for(let c = 0; c < 3; c++) if(b & (4 >> c)){
          for(let dy = 0; dy < 2; dy++) for(let dx = 0; dx < 2; dx++){
            const X = cx + c*2 + dx, Y = oy + r*2 + dy;
            if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const d = (Y*W + X)*4;
            saida.px[d] = cor[0]; saida.px[d+1] = cor[1]; saida.px[d+2] = cor[2];
          }
        }
      }
    }
    cx += 8;
  }
}

const AMBAR = [232, 168, 56], GRIS = [150, 156, 142], VERDE = [120, 200, 120];

texto('CADA CLASE DUAS VECES   ARRIBA O SPRITE DE CLASE   ABAIXO A MONTAXE POR PEZAS', 10, 10, AMBAR);
let y = CAB;
for(const f of filas){
  texto(f.etiqueta, 10, y + CEL - 16, AMBAR);
  texto('CLASE', 10, y + CEL - 4, GRIS);
  texto('PEZAS', 10, y + CEL + 8, VERDE);
  for(let i = 0; i < DIRS.length; i++){
    pegar(spriteClase(f.etiqueta, 'REPOUSO', DIRS[i], 0), MARXE + i*CEL, y);
    pegar(montar(f.m, '0', 'REPOUSO', DIRS[i], 0), MARXE + i*CEL, y + CEL);
  }
  y += 2*CEL + 10;
}

y += SEP;
texto('MESTURAS   O QUE NON SE PODE PRECOCIÑAR', 10, y - 20, VERDE);
for(const [etq, m] of MESTURAS){
  const partes = etq.split(' · ');
  texto(partes[0], 10, y + CEL/2 - 12, GRIS);
  texto(partes[1] || '', 10, y + CEL/2 + 2, GRIS);
  for(let i = 0; i < DIRS.length; i++)
    pegar(montar(m, '0', 'REPOUSO', DIRS[i], 0), MARXE + i*CEL, y);
  y += CEL;
}

escribir(SAIDA, saida);
console.log(`  ${SAIDA}  (${(fs.statSync(SAIDA).size/1024).toFixed(0)} KB)`);

/* --medir compara as dúas vías en números: alto, ancho e cor media.
   Se a montaxe sae máis grande que o sprite de clase, as dúas non están
   á mesma escala e no mapa notaríase de contado. */
if(process.argv.includes('--medir')){
  const caixa = im => {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, r = 0, g = 0, b = 0, n = 0;
    for(let y = 0; y < im.alto; y++) for(let x = 0; x < im.ancho; x++){
      const i = (y*im.ancho + x)*4;
      if(im.px[i+3] < 110) continue;
      if(x < x0) x0 = x; if(x > x1) x1 = x;
      if(y < y0) y0 = y; if(y > y1) y1 = y;
      r += im.px[i]; g += im.px[i+1]; b += im.px[i+2]; n++;
    }
    return n ? { w: x1-x0+1, h: y1-y0+1, cx: (x0+x1)/2, cy: (y0+y1)/2, baixo: y1,
                 cor: [r/n|0, g/n|0, b/n|0], n } : null;
  };
  console.log('\n  clase        vía      alto  ancho   pes   base   cor media');
  for(const c of CLASES){
    for(const [via, im] of [['clase', spriteClase(c, 'REPOUSO', 0, 0)],
                            ['pezas', montar(mon3dDeClase(c), '0', 'REPOUSO', 0, 0)]]){
      const k = caixa(im);
      console.log('  ' + c.padEnd(12) + via.padEnd(8) +
        String(k.h).padStart(5) + String(k.w).padStart(7) + String(k.n).padStart(6) +
        String(k.baixo).padStart(7) + '   ' + k.cor.join(','));
    }
  }
  console.log('');
}

/* --erro: un só número para poder comparar variantes do xerador.
   Media da diferenza de cor e de tamaño entre as dúas vías, sobre as
   cinco clases. Serve para escoller o groso do contorno sen ollo. */
if(process.argv.includes('--erro')){
  const caixa = im => {
    let x0=1e9,y0=1e9,x1=-1,y1=-1,r=0,g=0,b=0,n=0;
    for(let y=0;y<im.alto;y++) for(let x=0;x<im.ancho;x++){
      const i=(y*im.ancho+x)*4; if(im.px[i+3]<110) continue;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      r+=im.px[i]; g+=im.px[i+1]; b+=im.px[i+2]; n++;
    }
    return { w:x1-x0+1, h:y1-y0+1, cor:[r/n,g/n,b/n], n };
  };
  let dCor=0, dTam=0, k=0;
  for(const c of CLASES){
    for(let d=0; d<8; d++){
      const a=caixa(spriteClase(c,'REPOUSO',d,0)), b=caixa(montar(mon3dDeClase(c),'0','REPOUSO',d,0));
      dCor += (Math.abs(a.cor[0]-b.cor[0])+Math.abs(a.cor[1]-b.cor[1])+Math.abs(a.cor[2]-b.cor[2]))/3;
      dTam += Math.abs(a.w-b.w) + Math.abs(a.h-b.h);
      k++;
    }
  }
  console.log(`  cor ${(dCor/k).toFixed(2)}   tamaño ${(dTam/k).toFixed(2)} px`);
}
